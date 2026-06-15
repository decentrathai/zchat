import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

// Timeout for wallet CLI operations (30 seconds)
const CLI_TIMEOUT_MS = 30000;

// Type-safe error message extraction (MEDIUM #B1)
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

// Configuration from environment variables
// In production, all paths MUST be explicitly configured
const isProduction = process.env.NODE_ENV === 'production';

function getRequiredEnvOrDefault(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`${name} must be configured in production environment`);
  }
  return devDefault;
}

const WALLET_DB_BASE_DIR = getRequiredEnvOrDefault(
  'WALLET_DB_BASE_DIR',
  path.join(__dirname, '../../../wallet-db')  // Relative to project root in dev
);
const LIGHTWALLETD_URL = process.env.ZCASH_LIGHTWALLETD_URL || 'http://127.0.0.1:9067';
const WALLET_CLI_BINARY = getRequiredEnvOrDefault(
  'WALLET_CLI_BINARY',
  path.join(__dirname, '../../../target/release/zchat-wallet')  // Relative path in dev
);

/**
 * Get the wallet database path for a specific user
 */
export function getUserWalletDbPath(userId: number): string {
  return path.join(WALLET_DB_BASE_DIR, `user_${userId}.sqlite`);
}

/**
 * Ensure the wallet database directory exists (async version - #R3-M1)
 */
export async function ensureWalletDbDir(): Promise<void> {
  try {
    await fs.promises.access(WALLET_DB_BASE_DIR);
  } catch {
    await fs.promises.mkdir(WALLET_DB_BASE_DIR, { recursive: true });
  }
}

/**
 * Build a transaction using the wallet CLI
 *
 * @param walletDbPath - Path to the user's wallet database
 * @param toAddress - Recipient unified address
 * @param amount - Amount in zatoshis
 * @param memo - Memo text (message)
 * @returns Transaction hex and txid
 */
export async function buildTransaction(
  walletDbPath: string,
  toAddress: string,
  amount: number,
  memo: string
): Promise<{ txHex: string; txid: string }> {
  try {
    // Call the wallet CLI to build the transaction
    // CLI uses positional arguments: send <TO> <AMOUNT> <MEMO>
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', walletDbPath,
      '--lightwalletd', LIGHTWALLETD_URL,
      'send',
      toAddress,
      amount.toString(),
      memo,
    ], { timeout: CLI_TIMEOUT_MS });

    const output = stdout.trim();
    const result = JSON.parse(output);

    if (!result.txHex || !result.txid) {
      throw new Error('Invalid response from wallet CLI: missing txHex or txid');
    }

    return {
      txHex: result.txHex,
      txid: result.txid,
    };
  } catch (error) {
    throw new Error(`Failed to build transaction: ${getErrorMessage(error)}`);
  }
}

/**
 * Get wallet balance
 * @param walletDbPath - Path to the user's wallet database
 */
export async function getBalance(walletDbPath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', walletDbPath,
      '--lightwalletd', LIGHTWALLETD_URL,
      'balance',
    ], { timeout: CLI_TIMEOUT_MS });

    const output = stdout.trim();
    const result = JSON.parse(output);
    
    if (typeof result.balance_zatoshis !== 'number') {
      throw new Error('Invalid balance response from wallet CLI');
    }

    return result.balance_zatoshis;
  } catch (error) {
    throw new Error(`Failed to get balance: ${getErrorMessage(error)}`);
  }
}

/**
 * Get primary address
 * @param walletDbPath - Path to the user's wallet database
 */
export async function getPrimaryAddress(walletDbPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', walletDbPath,
      '--lightwalletd', LIGHTWALLETD_URL,
      'address',
    ], { timeout: CLI_TIMEOUT_MS });

    return stdout.trim();
  } catch (error) {
    throw new Error(`Failed to get primary address: ${getErrorMessage(error)}`);
  }
}

/**
 * Import a wallet from a mnemonic seed phrase
 *
 * SECURITY: This function is DISABLED. Mnemonic should never reach the server.
 * The wallet is now managed entirely client-side (Android/Web).
 * Backend only stores public addresses.
 *
 * See ISSUES_TO_FIX.md CRITICAL #B1 and #B2 for details.
 *
 * @deprecated This function is disabled for security reasons
 * @throws Always throws - function is disabled
 */
export async function importWallet(_walletDbPath: string, _mnemonic: string): Promise<{ address: string }> {
  throw new Error(
    'importWallet is DISABLED for security. ' +
    'Mnemonic should never be sent to the server. ' +
    'Wallet management is now client-side only.'
  );
}

/**
 * Initialize a new wallet (generates new seed - legacy function)
 * @param walletDbPath - Path to the user's wallet database
 * @deprecated Use importWallet instead for per-user wallets with client-derived seeds
 */
export async function initWallet(walletDbPath: string): Promise<{ address: string }> {
  try {
    // Ensure the wallet db directory exists
    await ensureWalletDbDir();

    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', walletDbPath,
      '--lightwalletd', LIGHTWALLETD_URL,
      'init',
    ], { timeout: CLI_TIMEOUT_MS });

    // The init command returns "wallet-initialized: <address>" format
    const output = stdout.trim();

    if (output.startsWith('wallet-initialized:')) {
      const address = output.split(':')[1].trim();
      return { address };
    } else if (output === 'wallet-already-exists') {
      throw new Error('Wallet already exists');
    } else {
      throw new Error(`Unexpected init response: ${output}`);
    }
  } catch (error) {
    throw new Error(`Failed to initialize wallet: ${getErrorMessage(error)}`);
  }
}

/**
 * Sync wallet with lightwalletd
 * @param walletDbPath - Path to the user's wallet database
 */
export async function syncWallet(walletDbPath: string): Promise<{ synced_to_height: number }> {
  try {
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', walletDbPath,
      '--lightwalletd', LIGHTWALLETD_URL,
      'sync',
    ], { timeout: CLI_TIMEOUT_MS });

    const output = stdout.trim();
    const result = JSON.parse(output);
    
    if (typeof result.synced_to_height !== 'number') {
      throw new Error('Invalid sync response from wallet CLI');
    }

    return { synced_to_height: result.synced_to_height };
  } catch (error) {
    throw new Error(`Failed to sync wallet: ${getErrorMessage(error)}`);
  }
}

/**
 * Send a transaction
 * @param walletDbPath - Path to the user's wallet database
 */
export async function sendTransaction(
  walletDbPath: string,
  to: string,
  amountZatoshis: number,
  memo: string
): Promise<{ txid: string; txHex: string }> {
  try {
    // CLI uses positional arguments: send <TO> <AMOUNT> <MEMO>
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', walletDbPath,
      '--lightwalletd', LIGHTWALLETD_URL,
      'send',
      to,
      amountZatoshis.toString(),
      memo,
    ], { timeout: CLI_TIMEOUT_MS });

    const output = stdout.trim();
    const result = JSON.parse(output);

    if (!result.txid || !result.txHex) {
      throw new Error('Invalid send response from wallet CLI');
    }

    return {
      txid: result.txid,
      txHex: result.txHex,
    };
  } catch (error) {
    throw new Error(`Failed to send transaction: ${getErrorMessage(error)}`);
  }
}

/**
 * Get messages from transactions
 * @param walletDbPath - Path to the user's wallet database
 */
// Message type from wallet CLI
interface WalletMessage {
  txid: string;
  height: number;
  timestamp: number;
  memo: string;
  from?: string;
  to?: string;
  amount_zatoshis?: number;
}

/**
 * Verify a claimed top-up deposit against the on-chain wallet view.
 *
 * Called from `/api/v1/ai/admin/credit-from-deposit` to make sure the requester actually
 * delivered ZEC to our shielded top-up address — defends against an attacker who has
 * obtained ADMIN_SECRET from crediting fake txids.
 *
 * The watcher's wallet DB (WALLET_DB_PATH env) is the source of truth: it contains every
 * incoming note tagged with `ai-topup:<userId>`. The check:
 *   1. The txid must exist in `zchat-wallet messages`.
 *   2. The memo must equal `ai-topup:<expectedUserId>`.
 *   3. The note must be incoming (incoming === true).
 *   4. The value must match the claimed zatoshi (±0 — exact).
 *
 * Returns null on success, or a string describing the mismatch on failure.
 */
export async function verifyDepositOnChain(args: {
  walletDbPath: string;
  zecTxId: string;
  expectedUserId: string;
  expectedZatoshi: bigint;
}): Promise<string | null> {
  const { walletDbPath, zecTxId, expectedUserId, expectedZatoshi } = args;
  let messages: WalletMessage[];
  try {
    const result = await getMessages(walletDbPath);
    messages = result.messages;
  } catch (err) {
    return `wallet messages CLI failed: ${getErrorMessage(err)}`;
  }
  const note = messages.find((m) => m.txid === zecTxId);
  if (!note) return `txid ${zecTxId.slice(0, 16)}… not found in watcher wallet`;
  // Walletmessages typing has memo + amount_zatoshis as optional. Accept the shape the
  // wallet CLI actually returns (incoming:true + value_zatoshis); fall back to legacy fields.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyNote = note as any;
  // Fail closed: credit ONLY a definitively-incoming note. `=== false` would let a note with a
  // missing/undefined `incoming` field through and credit a non-deposit (e.g. change output).
  if (anyNote.incoming !== true) return 'note is not a confirmed incoming deposit';
  const memo = (note.memo ?? '').trim();
  const expectedMemo = `ai-topup:${expectedUserId}`;
  if (memo !== expectedMemo) return `memo mismatch: got "${memo.slice(0, 32)}", expected "${expectedMemo}"`;
  const value = BigInt(anyNote.value_zatoshis ?? note.amount_zatoshis ?? 0);
  if (value !== expectedZatoshi) return `zatoshi mismatch: got ${value}, expected ${expectedZatoshi}`;
  return null;
}

export async function getMessages(walletDbPath: string, sinceHeight?: number): Promise<{ messages: WalletMessage[] }> {
  try {
    const args = [
      '--db-path', walletDbPath,
      '--lightwalletd', LIGHTWALLETD_URL,
      'messages',
    ];
    
    if (sinceHeight !== undefined) {
      args.push('--since-height', sinceHeight.toString());
    }
    
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, args, { timeout: CLI_TIMEOUT_MS });

    const output = stdout.trim();
    const result = JSON.parse(output);
    
    if (!Array.isArray(result.messages)) {
      throw new Error('Invalid messages response from wallet CLI');
    }

    return { messages: result.messages };
  } catch (error) {
    throw new Error(`Failed to get messages: ${getErrorMessage(error)}`);
  }
}

