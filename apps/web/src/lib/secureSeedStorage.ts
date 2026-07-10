/**
 * Password-encrypted seed storage backed by Web Crypto (AES-GCM + PBKDF2).
 *
 * Plaintext seed in localStorage = XSS = total wallet drain. We can't move the
 * seed off localStorage entirely without breaking "stay logged in across tabs",
 * so the next best thing is to encrypt it at rest with a key the attacker
 * doesn't have. PBKDF2 with the user's login password as input means an XSS
 * needs the password too — which a sleeping browser doesn't expose.
 *
 * Format stored under `zchat_seed_phrase` once encrypted:
 *   { v: 1, salt: base64, iv: base64, ct: base64 }
 *
 * Legacy plaintext entries (no JSON envelope) are auto-migrated on first
 * decryptFromStorage() call, then re-written encrypted.
 */

// OWASP 2023 guidance for PBKDF2-HMAC-SHA256 is 600k iterations. New envelopes record the
// iteration count they were written with (`iterations` field) so this can be raised again later
// without bricking existing seeds. Envelopes written before this field existed used 100k.
const PBKDF2_ITERATIONS = 600_000;
const LEGACY_PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const STORAGE_KEY = 'zchat_seed_phrase';

interface SeedEnvelope {
  v: 1;
  salt: string; // base64
  iv: string;   // base64
  ct: string;   // base64 ciphertext
  iterations?: number; // PBKDF2 rounds; absent ⇒ legacy 100k
}

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptAndStoreSeed(mnemonic: string, password: string): Promise<void> {
  if (!password) throw new Error('encryptAndStoreSeed: password is required');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(mnemonic)
  );
  const envelope: SeedEnvelope = {
    v: 1,
    salt: b64(salt),
    iv: b64(iv),
    ct: b64(ct),
    iterations: PBKDF2_ITERATIONS,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

/**
 * Returns the decrypted seed, or null if no entry exists. Throws on wrong
 * password or corrupted envelope. Auto-migrates a legacy plaintext entry
 * by re-encrypting it under the supplied password.
 */
export async function decryptFromStorage(password: string): Promise<string | null> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  // Legacy plaintext path: no JSON envelope → migrate.
  if (!raw.startsWith('{')) {
    if (password) {
      await encryptAndStoreSeed(raw, password);
    }
    return raw;
  }
  let envelope: SeedEnvelope;
  try {
    envelope = JSON.parse(raw) as SeedEnvelope;
  } catch {
    throw new Error('Seed storage envelope is corrupted');
  }
  if (envelope.v !== 1) throw new Error(`Unsupported seed envelope version ${envelope.v}`);
  const salt = unb64(envelope.salt);
  const iv = unb64(envelope.iv);
  const ct = unb64(envelope.ct);
  const iterations = envelope.iterations ?? LEGACY_PBKDF2_ITERATIONS;
  const key = await deriveKey(password, salt, iterations);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct as BufferSource
  );
  const seed = new TextDecoder().decode(pt);
  // Migrate-on-unlock: if this envelope used a weaker iteration count than current, re-encrypt
  // under the stronger one now that we have the plaintext + correct password.
  if (iterations < PBKDF2_ITERATIONS && password) {
    await encryptAndStoreSeed(seed, password);
  }
  return seed;
}

/** Wipe the encrypted seed from localStorage. */
export function clearStoredSeed(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** True iff a (legacy plaintext OR encrypted) seed entry exists. */
export function hasStoredSeed(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}
