/**
 * AI top-up deposit watcher.
 *
 * Polls the zchat-wallet CLI for incoming Zcash notes with a memo of the form
 * `ai-topup:<userId>`, waits for confirmation depth, fetches the spot ZEC/USD
 * price, and POSTs to /api/v1/ai/admin/credit-from-deposit. Idempotent on txid
 * via the backend's @unique constraint on AiTopupDeposit.zecTxId — safe to
 * restart at any time.
 *
 * Single tight loop: sync → list new messages → credit → persist last_seen_height.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

type Env = {
  backendUrl: string;
  adminSecret: string;
  walletBinary: string;
  walletDbPath: string;
  lwdUrl: string;
  statePath: string;
  pollIntervalSeconds: number;
  minConfirmations: number;
  priceApiUrl: string;
  memoPrefix: string;
};

function loadEnv(): Env {
  const required = (name: string): string => {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
  };
  return {
    backendUrl: process.env.BACKEND_URL ?? 'http://127.0.0.1:4000',
    adminSecret: required('ADMIN_SECRET'),
    walletBinary: process.env.WALLET_BINARY ?? '/home/yourt/zchat/target/release/zchat-wallet',
    walletDbPath: process.env.WALLET_DB_PATH ?? '/home/yourt/ai-topup-wallet/wallet',
    lwdUrl: process.env.LWD_URL ?? 'https://zec.rocks:443',
    statePath: process.env.STATE_PATH ?? '/home/yourt/ai-topup-wallet/watcher-state.json',
    pollIntervalSeconds: parseInt(process.env.POLL_INTERVAL_SECONDS ?? '60', 10),
    minConfirmations: parseInt(process.env.MIN_CONFIRMATIONS ?? '3', 10),
    priceApiUrl:
      process.env.PRICE_API_URL ??
      'https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd',
    memoPrefix: process.env.MEMO_PREFIX ?? 'ai-topup:',
  };
}

type State = {
  lastSeenHeight: number;
  processedTxids: string[];
};

function loadState(path: string): State {
  if (!existsSync(path)) return { lastSeenHeight: 0, processedTxids: [] };
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      lastSeenHeight: typeof parsed.lastSeenHeight === 'number' ? parsed.lastSeenHeight : 0,
      processedTxids: Array.isArray(parsed.processedTxids) ? parsed.processedTxids : [],
    };
  } catch (e) {
    console.error('Failed to parse state file, starting fresh:', e);
    return { lastSeenHeight: 0, processedTxids: [] };
  }
}

function saveState(path: string, state: State): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

type WalletMessage = {
  txid: string;
  height: number;
  timestamp: number;
  incoming: boolean;
  value_zatoshis: number;
  memo: string;
  to_address?: string | null;
  from_address?: string | null;
};

function runWalletCommand(env: Env, args: string[]): string {
  return execFileSync(
    env.walletBinary,
    ['--db-path', env.walletDbPath, '--lightwalletd', env.lwdUrl, ...args],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
}

function extractSafeRewindHeight(message: string): number | null {
  // Rust error format: "safe_rewind_height: Some(BlockHeight(3350900))"
  const m = message.match(/safe_rewind_height:\s*Some\(BlockHeight\((\d+)\)\)/);
  return m ? Number(m[1]) : null;
}

function truncateWalletTo(env: Env, height: number): number {
  const out = runWalletCommand(env, ['truncate-to', String(height)]);
  const lastLine = out.trim().split('\n').filter((l) => l.startsWith('{')).pop() ?? '{}';
  const parsed = JSON.parse(lastLine);
  return Number(parsed.truncated_to_height ?? 0);
}

function syncWallet(env: Env): number {
  try {
    const out = runWalletCommand(env, ['sync']);
    const lastLine = out.trim().split('\n').filter((l) => l.startsWith('{')).pop() ?? '{}';
    const parsed = JSON.parse(lastLine);
    return Number(parsed.synced_to_height ?? 0);
  } catch (err: unknown) {
    // Chain reorgs cause `PrevHashMismatch` — the wallet-core can't recover on its own.
    // Catch it, truncate to a safe height (extracted from `RequestedRewindInvalid` if we get
    // one, else current_tip - 32), and retry once. If the reorg is deeper than 32 blocks
    // we'll keep retrying on subsequent watcher cycles.
    const errMsg = err instanceof Error ? err.message + ' ' + (err as { stderr?: string }).stderr : String(err);
    const isReorg = /PrevHashMismatch|RequestedRewindInvalid/.test(errMsg);
    if (!isReorg) throw err;

    let safeHeight = extractSafeRewindHeight(errMsg);
    if (safeHeight === null) {
      // Fallback: probe truncate-to current_tip-32 — the wallet-core will report the safe
      // height in the error if we go below the supported window.
      try {
        const probe = runWalletCommand(env, ['debug-sync']);
        const last = probe.trim().split('\n').filter((l) => l.startsWith('{')).pop() ?? '{}';
        const parsed = JSON.parse(last);
        const tip = Number(parsed.chain_tip_height ?? 0);
        safeHeight = Math.max(0, tip - 32);
      } catch {
        throw err;
      }
    }
    console.warn(
      `[${new Date().toISOString()}] chain reorg detected — truncating wallet to ${safeHeight} and retrying sync`,
    );
    try {
      truncateWalletTo(env, safeHeight);
    } catch (truncErr: unknown) {
      // Wallet-core might reject the requested height with another safe_rewind_height —
      // extract it and try once more.
      const tMsg = truncErr instanceof Error ? truncErr.message + ' ' + (truncErr as { stderr?: string }).stderr : String(truncErr);
      const altHeight = extractSafeRewindHeight(tMsg);
      if (altHeight !== null) {
        console.warn(`[${new Date().toISOString()}] retrying truncate at safe_rewind_height ${altHeight}`);
        truncateWalletTo(env, altHeight);
      } else {
        throw truncErr;
      }
    }
    // Retry sync after truncate.
    const out2 = runWalletCommand(env, ['sync']);
    const lastLine2 = out2.trim().split('\n').filter((l) => l.startsWith('{')).pop() ?? '{}';
    const parsed2 = JSON.parse(lastLine2);
    return Number(parsed2.synced_to_height ?? 0);
  }
}

function listMessages(env: Env, sinceHeight: number): WalletMessage[] {
  const args = ['messages'];
  if (sinceHeight > 0) args.push('--since-height', String(sinceHeight));
  const out = runWalletCommand(env, args);
  const lastLine = out.trim().split('\n').filter((l) => l.startsWith('{')).pop() ?? '{"messages":[]}';
  const parsed = JSON.parse(lastLine);
  return Array.isArray(parsed.messages) ? (parsed.messages as WalletMessage[]) : [];
}

let cachedPrice: { usd: number; fetchedAt: number } | null = null;
const PRICE_CACHE_TTL_MS = 60_000;
const NEAR_TOKENS_URL = 'https://1click.chaindefuser.com/v0/tokens';

// Sanity-bound the spot price. If a compromised or buggy oracle returns $1 trillion / ZEC,
// the watcher would credit absurd microUSD against a tiny deposit. The window is wide
// enough to survive black-swan crashes (ZEC has historically been near $0.50) and parabolic
// runs (mid-2026 it's around $640) — anything outside is treated as oracle error.
const MIN_ZEC_USD_PRICE = 0.01;
const MAX_ZEC_USD_PRICE = 100_000;

function isPlausiblePrice(usd: unknown): usd is number {
  return typeof usd === 'number' && Number.isFinite(usd) && usd >= MIN_ZEC_USD_PRICE && usd <= MAX_ZEC_USD_PRICE;
}

async function fetchPriceFromNear(): Promise<number | null> {
  try {
    const res = await fetch(NEAR_TOKENS_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (!Array.isArray(body)) return null;
    for (const t of body) {
      if (!t || typeof t !== 'object') continue;
      const sym = (t as { symbol?: unknown }).symbol;
      const price = (t as { price?: unknown }).price;
      if (typeof sym === 'string' && sym.toUpperCase() === 'ZEC' && isPlausiblePrice(price)) {
        return price;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchPriceFromCoinGecko(env: Env): Promise<number | null> {
  try {
    const res = await fetch(env.priceApiUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { zcash?: { usd?: unknown } };
    const usd = json.zcash?.usd;
    return isPlausiblePrice(usd) ? usd : null;
  } catch {
    return null;
  }
}

// Max accepted disagreement between the two independent price sources before we distrust the
// higher one. The plausibility window [0.01, 100000] is ~10M-fold wide, so a single manipulated
// but in-bounds quote could otherwise credit deposits at many times their true value.
const PRICE_CROSS_SOURCE_TOLERANCE = 0.25;

async function getZecUsdPrice(env: Env): Promise<number> {
  if (cachedPrice && Date.now() - cachedPrice.fetchedAt < PRICE_CACHE_TTL_MS) {
    return cachedPrice.usd;
  }
  // Fetch BOTH sources so we can cross-check. Prefer NEAR Intents 1Click (matches the price the
  // backend quoted the user at top-up time) when the two agree; on significant disagreement,
  // distrust the higher quote and credit at the LOWER value so we never over-credit.
  const near = await fetchPriceFromNear();
  const gecko = await fetchPriceFromCoinGecko(env);
  if (near === null || gecko === null) {
    // FAIL CLOSED. With only one source we cannot cross-check, and the plausibility band alone
    // ([0.01, 100000], ~10M-fold) is far too wide to stop a single manipulated-but-in-band quote from
    // massively over-crediting. Require TWO independent sources to credit; otherwise throw — the caller
    // treats a price failure as priceUnavailable, holds the scan floor, and retries next cycle, so
    // deposits WAIT (not lost) until both oracles are back. Over-crediting is irreversible; delay isn't.
    throw new Error(
      `Refusing to credit on a single price source (NEAR=${near}, CoinGecko=${gecko}) — need two to cross-check`,
    );
  }
  let usd: number;
  const lo = Math.min(near, gecko);
  const hi = Math.max(near, gecko);
  if (hi > lo * (1 + PRICE_CROSS_SOURCE_TOLERANCE)) {
    console.warn(
      `[${new Date().toISOString()}] price sources disagree: NEAR=${near} CoinGecko=${gecko} (>${PRICE_CROSS_SOURCE_TOLERANCE * 100}%) — distrusting higher, using ${lo}`,
    );
    usd = lo;
  } else {
    usd = near; // agree → prefer NEAR to match the user's top-up quote
  }
  cachedPrice = { usd, fetchedAt: Date.now() };
  return usd;
}

function zatoshiToMicroUsd(zatoshi: bigint, zecUsd: number): bigint {
  // 1 ZEC = 1e8 zatoshi; 1 USD = 1e6 microUSD
  // microUsd = zatoshi * zecUsd * 1e6 / 1e8 = zatoshi * zecUsd / 100
  // Use integer math via fixed-point: encode price as priceE8 (zecUsd * 1e8)
  const priceE8 = BigInt(Math.round(zecUsd * 1e8));
  // microUsd = zatoshi * priceE8 / 1e8 / 100 = zatoshi * priceE8 / 1e10
  return (zatoshi * priceE8) / 10_000_000_000n;
}

async function creditDeposit(
  env: Env,
  body: {
    userId: string;
    zecTxId: string;
    zatoshi: bigint;
    zecUsdPrice: number;
    microUsd: bigint;
    note?: string;
  },
): Promise<{ ok: boolean; status: string; httpStatus: number; raw: unknown }> {
  const res = await fetch(`${env.backendUrl}/api/v1/ai/admin/credit-from-deposit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': env.adminSecret,
    },
    body: JSON.stringify({
      userId: body.userId,
      zecTxId: body.zecTxId,
      zatoshi: body.zatoshi.toString(),
      zecUsdPrice: body.zecUsdPrice.toFixed(8),
      microUsd: body.microUsd.toString(),
      note: body.note ?? '',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const raw = (await res.json().catch(() => ({}))) as { status?: string };
  return { ok: res.ok, status: raw.status ?? `http-${res.status}`, httpStatus: res.status, raw };
}

// A 4xx from the credit endpoint means the backend will NEVER accept this deposit (e.g. 404 unknown
// user, 400/422 validation) — poison it rather than re-POSTing forever. 408 (timeout) and 429
// (rate-limit) are transient, as are 5xx and network errors, and are safe to retry next cycle.
function isPermanentCreditRejection(httpStatus: number): boolean {
  if (httpStatus === 408 || httpStatus === 429) return false;
  return httpStatus >= 400 && httpStatus < 500;
}

function parseTopupMemo(memo: string, prefix: string): string | null {
  if (!memo.startsWith(prefix)) return null;
  const userId = memo.slice(prefix.length).trim();
  if (userId.length < 8 || userId.length > 64) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) return null;
  return userId;
}

async function processOnce(env: Env, state: State): Promise<State> {
  console.log(`[${new Date().toISOString()}] sync: starting (last_seen=${state.lastSeenHeight})`);
  const chainTip = syncWallet(env);
  console.log(`[${new Date().toISOString()}] sync: synced to height ${chainTip}`);

  // Lookback covers the confirmation window + a small buffer so deposits still maturing
  // toward `minConfirmations` stay in scope across multiple watcher cycles.
  const lookbackStart = Math.max(0, state.lastSeenHeight - Math.max(env.minConfirmations + 20, 30));
  const messages = listMessages(env, lookbackStart);
  const candidates = messages.filter(
    (m) => m.incoming && m.value_zatoshis > 0 && parseTopupMemo(m.memo, env.memoPrefix) !== null,
  );
  console.log(
    `[${new Date().toISOString()}] found ${messages.length} message(s) since height ${lookbackStart}, ${candidates.length} ai-topup candidate(s)`,
  );

  const processed = new Set(state.processedTxids);
  let highestSeen = state.lastSeenHeight;
  // Lowest height of any candidate we did NOT credit this cycle (deferred for confirmations, or a
  // failed credit POST). We must never advance the scan window past it, or it would drop out of the
  // lookback and the user's ZEC would be lost.
  let lowestUncredited = Infinity;
  // Set when the price oracle is unavailable: we credited nothing, so the floor must not advance.
  let priceUnavailable = false;
  const markUncredited = (height: number) => {
    if (height < lowestUncredited) lowestUncredited = height;
  };

  for (const m of candidates) {
    if (processed.has(m.txid)) continue;
    const confirmations = chainTip - m.height + 1;
    if (confirmations < env.minConfirmations) {
      console.log(
        `[${new Date().toISOString()}] tx ${m.txid} at height ${m.height} has only ${confirmations} confs (need ${env.minConfirmations}) — defer`,
      );
      markUncredited(m.height);
      continue;
    }
    const userId = parseTopupMemo(m.memo, env.memoPrefix);
    if (!userId) continue;

    let zecUsd: number;
    try {
      zecUsd = await getZecUsdPrice(env);
    } catch (e) {
      console.error('Price fetch failed, will retry next cycle:', e);
      priceUnavailable = true;
      break;
    }
    const zatoshi = BigInt(m.value_zatoshis);
    const microUsd = zatoshiToMicroUsd(zatoshi, zecUsd);
    if (microUsd <= 0n) {
      console.warn(
        `[${new Date().toISOString()}] tx ${m.txid} would credit 0 µUSD (zatoshi=${zatoshi}, price=${zecUsd}) — skipping`,
      );
      processed.add(m.txid);
      continue;
    }
    try {
      const result = await creditDeposit(env, {
        userId,
        zecTxId: m.txid,
        zatoshi,
        zecUsdPrice: zecUsd,
        microUsd,
        note: `auto-credit at height ${m.height}, ${confirmations} confs`,
      });
      console.log(
        `[${new Date().toISOString()}] credit tx=${m.txid} user=${userId} zatoshi=${zatoshi} µUSD=${microUsd} price=${zecUsd} → ${result.status}`,
      );
      if (result.ok || result.status === 'already-credited') {
        processed.add(m.txid);
        if (m.height > highestSeen) highestSeen = m.height;
      } else if (isPermanentCreditRejection(result.httpStatus)) {
        // PERMANENT rejection (404 unknown user / 400|422 validation): this deposit can never credit.
        // POISON it — record the txid as processed so the scan floor advances past it — and ALERT for
        // manual handling, instead of re-POSTing forever. The old code called markUncredited() here,
        // which pinned the scan floor at the bad deposit and re-sent it every cycle; over time the
        // lookback grew unbounded toward the chain tip and the wallet-CLI output overflowed
        // execFileSync's maxBuffer, halting ALL crediting (cheap self-DoS via one junk-memo deposit).
        // The deposit's ZEC is NOT credited; an operator must resolve it (refund / fix userId) manually.
        console.error(
          `[${new Date().toISOString()}] ALERT: permanent credit rejection for tx=${m.txid} user=${userId} ` +
            `(http ${result.httpStatus}, status=${result.status}) — poisoning (won't retry). Manual review required.`,
        );
        processed.add(m.txid);
        if (m.height > highestSeen) highestSeen = m.height;
      } else {
        // TRANSIENT failure (5xx / 408 / 429 / unrecognized) — leave uncredited and retry next cycle.
        markUncredited(m.height);
      }
    } catch (e) {
      console.error(`Credit POST failed for ${m.txid}, will retry next cycle:`, e);
      markUncredited(m.height);
    }
  }

  // Only advance lastSeenHeight from a SUCCESSFUL scan path. If `listMessages` succeeded
  // (we reached this point — earlier sync failures would have thrown out of processOnce)
  // we know the wallet did scan the window and any incoming ai-topup notes in that window
  // are now visible. Advancing the high-water mark to the safe floor (chainTip - 60)
  // bounds the lookback even when no candidates were seen, so we don't re-scan history.
  //
  // Lookback window in the caller is (lastSeenHeight - LOOKBACK_BUFFER), which gives a
  // generous catch-up for deposits awaiting confirmations to mature; bumped to 60 so that
  // a slow-to-confirm tx at chainTip-N can survive a few cycles even after the floor advances.
  const safeFloor = chainTip - 60;
  // On a price-oracle outage we credited nothing this cycle, so keep the floor where it was —
  // don't let it creep toward the tip and strand matured deposits before the oracle recovers.
  let nextLastSeen = priceUnavailable
    ? state.lastSeenHeight
    : Math.max(highestSeen, safeFloor, state.lastSeenHeight);
  // Never advance past a deposit we didn't credit this cycle: cap just below it so the next
  // lookback still covers it. May pull the floor BELOW its prior value (a wider re-scan) — safe.
  if (lowestUncredited !== Infinity && lowestUncredited - 1 < nextLastSeen) {
    nextLastSeen = lowestUncredited - 1;
  }
  return {
    lastSeenHeight: Math.max(0, nextLastSeen),
    processedTxids: [...processed].slice(-1000),
  };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const once = process.argv.includes('--once');
  console.log(`[ai-topup-watcher] starting; once=${once}, poll=${env.pollIntervalSeconds}s, confs=${env.minConfirmations}`);
  let state = loadState(env.statePath);

  let stopping = false;
  const shutdown = (sig: string) => {
    console.log(`[ai-topup-watcher] received ${sig}, exiting after current cycle`);
    stopping = true;
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  while (!stopping) {
    try {
      state = await processOnce(env, state);
      saveState(env.statePath, state);
    } catch (e) {
      console.error('[ai-topup-watcher] cycle failed, will retry:', e);
    }
    if (once) break;
    await new Promise<void>((resolve) => setTimeout(resolve, env.pollIntervalSeconds * 1000));
  }
}

main().catch((e) => {
  console.error('[ai-topup-watcher] fatal:', e);
  process.exit(1);
});
