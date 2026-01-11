import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

// Configuration from environment variables
const WALLET_DB_BASE_DIR = process.env.WALLET_DB_BASE_DIR || '/home/yourt/zchat/wallet-db';
const LIGHTWALLETD_URL = process.env.ZCASH_LIGHTWALLETD_URL || 'http://127.0.0.1:9067';
const WALLET_CLI_BINARY = process.env.WALLET_CLI_BINARY || path.join(__dirname, '../../../target/release/zchat-wallet');

/**
 * Get the wallet database path for a specific user
 */
export function getUserWalletDbPath(userId: number): string {
  return path.join(WALLET_DB_BASE_DIR, `user_${userId}.sqlite`);
}

/**
 * Ensure the wallet database directory exists
 */
export function ensureWalletDbDir(): void {
  if (!fs.existsSync(WALLET_DB_BASE_DIR)) {
    fs.mkdirSync(WALLET_DB_BASE_DIR, { recursive: true });
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
    ]);

    const output = stdout.trim();
    const result = JSON.parse(output);

    if (!result.txHex || !result.txid) {
      throw new Error('Invalid response from wallet CLI: missing txHex or txid');
    }

    return {
      txHex: result.txHex,
      txid: result.txid,
    };
  } catch (error: any) {
    throw new Error(`Failed to build transaction: ${error.message}`);
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
    ]);

    const output = stdout.trim();
    const result = JSON.parse(output);
    
    if (typeof result.balance_zatoshis !== 'number') {
      throw new Error('Invalid balance response from wallet CLI');
    }

    return result.balance_zatoshis;
  } catch (error: any) {
    throw new Error(`Failed to get balance: ${error.message}`);
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
    ]);

    return stdout.trim();
  } catch (error: any) {
    throw new Error(`Failed to get primary address: ${error.message}`);
  }
}

/**
 * Import a wallet from a mnemonic seed phrase
 * @param walletDbPath - Path to the user's wallet database
 * @param mnemonic - The user's 24-word BIP39 mnemonic seed phrase (passed from frontend)
 */
export async function importWallet(walletDbPath: string, mnemonic: string): Promise<{ address: string }> {
  try {
    // Ensure the wallet db directory exists
    ensureWalletDbDir();

    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', walletDbPath,
      '--lightwalletd', LIGHTWALLETD_URL,
      'import',
      '--mnemonic', mnemonic,
    ]);

    // The import command returns JSON with address or error
    const output = stdout.trim();
    const result = JSON.parse(output);

    if (result.address) {
      return { address: result.address };
    } else if (result.error === 'wallet-already-exists') {
      throw new Error('Wallet already exists');
    } else {
      throw new Error(`Unexpected import response: ${output}`);
    }
  } catch (error: any) {
    throw new Error(`Failed to import wallet: ${error.message}`);
  }
}

/**
 * Initialize a new wallet (generates new seed - legacy function)
 * @param walletDbPath - Path to the user's wallet database
 * @deprecated Use importWallet instead for per-user wallets with client-derived seeds
 */
export async function initWallet(walletDbPath: string): Promise<{ address: string }> {
  try {
    // Ensure the wallet db directory exists
    ensureWalletDbDir();

    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', walletDbPath,
      '--lightwalletd', LIGHTWALLETD_URL,
      'init',
    ]);

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
  } catch (error: any) {
    throw new Error(`Failed to initialize wallet: ${error.message}`);
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
    ]);

    const output = stdout.trim();
    const result = JSON.parse(output);
    
    if (typeof result.synced_to_height !== 'number') {
      throw new Error('Invalid sync response from wallet CLI');
    }

    return { synced_to_height: result.synced_to_height };
  } catch (error: any) {
    throw new Error(`Failed to sync wallet: ${error.message}`);
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
    ]);

    const output = stdout.trim();
    const result = JSON.parse(output);

    if (!result.txid || !result.txHex) {
      throw new Error('Invalid send response from wallet CLI');
    }

    return {
      txid: result.txid,
      txHex: result.txHex,
    };
  } catch (error: any) {
    throw new Error(`Failed to send transaction: ${error.message}`);
  }
}

/**
 * Get messages from transactions
 * @param walletDbPath - Path to the user's wallet database
 */
export async function getMessages(walletDbPath: string, sinceHeight?: number): Promise<{ messages: any[] }> {
  try {
    const args = [
      '--db-path', walletDbPath,
      '--lightwalletd', LIGHTWALLETD_URL,
      'messages',
    ];
    
    if (sinceHeight !== undefined) {
      args.push('--since-height', sinceHeight.toString());
    }
    
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, args);

    const output = stdout.trim();
    const result = JSON.parse(output);
    
    if (!Array.isArray(result.messages)) {
      throw new Error('Invalid messages response from wallet CLI');
    }

    return { messages: result.messages };
  } catch (error: any) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }
}

