import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptAndStoreSeed,
  decryptFromStorage,
  clearStoredSeed,
  hasStoredSeed,
} from './secureSeedStorage';

const STORAGE_KEY = 'zchat_seed_phrase';
const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Minimal in-memory localStorage stub (node test env has no DOM).
function installFakeLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
  return store;
}

// Build a legacy (pre-iterations-field) envelope encrypted at 100k rounds, the way the old code did.
async function writeLegacyEnvelope(mnemonic: string, password: string): Promise<void> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(mnemonic));
  const b64 = (b: ArrayBuffer | Uint8Array) => {
    const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
    let s = '';
    for (const byte of bytes) s += String.fromCharCode(byte);
    return btoa(s);
  };
  // NOTE: no `iterations` field — exactly the legacy shape.
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) }));
}

describe('secureSeedStorage', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installFakeLocalStorage();
  });

  it('round-trips a seed through encrypt → decrypt', async () => {
    await encryptAndStoreSeed(MNEMONIC, 'correct horse');
    expect(hasStoredSeed()).toBe(true);
    const got = await decryptFromStorage('correct horse');
    expect(got).toBe(MNEMONIC);
  });

  it('writes new envelopes at the hardened 600k iteration count', async () => {
    await encryptAndStoreSeed(MNEMONIC, 'pw');
    const env = JSON.parse(store.get(STORAGE_KEY)!);
    expect(env.iterations).toBe(600_000);
  });

  it('returns null when no seed is stored', async () => {
    expect(await decryptFromStorage('pw')).toBeNull();
  });

  it('throws on wrong password', async () => {
    await encryptAndStoreSeed(MNEMONIC, 'right');
    await expect(decryptFromStorage('wrong')).rejects.toThrow();
  });

  it('decrypts a legacy 100k envelope AND migrates it up to 600k on unlock', async () => {
    await writeLegacyEnvelope(MNEMONIC, 'pw');
    // Sanity: the legacy envelope has no iterations field.
    expect(JSON.parse(store.get(STORAGE_KEY)!).iterations).toBeUndefined();

    const got = await decryptFromStorage('pw');
    expect(got).toBe(MNEMONIC);

    // After unlock it must have been re-encrypted at the stronger count.
    const migrated = JSON.parse(store.get(STORAGE_KEY)!);
    expect(migrated.iterations).toBe(600_000);
    // And it must still decrypt with the same password.
    expect(await decryptFromStorage('pw')).toBe(MNEMONIC);
  });

  it('clearStoredSeed wipes the entry', async () => {
    await encryptAndStoreSeed(MNEMONIC, 'pw');
    clearStoredSeed();
    expect(hasStoredSeed()).toBe(false);
  });
});
