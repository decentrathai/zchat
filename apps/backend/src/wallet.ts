import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFileAsync = promisify(execFile);

// Configuration from environment variables
const WALLET_DB_PATH = process.env.WALLET_DB_PATH || '/home/yourt/zchat/wallet-db/zchat.sqlite';
const LIGHTWALLETD_URL = process.env.ZCASH_LIGHTWALLETD_URL || 'http://127.0.0.1:9067';
const WALLET_CLI_BINARY = process.env.WALLET_CLI_BINARY || path.join(__dirname, '../../../target/release/zchat-wallet');

/**
 * Build a transaction using the wallet CLI
 *
 * @param toAddress - Recipient unified address
 * @param amount - Amount in zatoshis
 * @param memo - Memo text (message)
 * @returns Transaction hex and txid
 */
export async function buildTransaction(
  toAddress: string,
  amount: number,
  memo: string
): Promise<{ txHex: string; txid: string }> {
  try {
    // Call the wallet CLI to build the transaction
    // CLI uses positional arguments: send <TO> <AMOUNT> <MEMO>
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', WALLET_DB_PATH,
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
 */
export async function getBalance(): Promise<number> {
  try {
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', WALLET_DB_PATH,
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
 */
export async function getPrimaryAddress(): Promise<string> {
  try {
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', WALLET_DB_PATH,
      '--lightwalletd', LIGHTWALLETD_URL,
      'address',
    ]);

    return stdout.trim();
  } catch (error: any) {
    throw new Error(`Failed to get primary address: ${error.message}`);
  }
}

/**
 * Initialize a new wallet
 */
export async function initWallet(): Promise<{ address: string; seedPhrase: string }> {
  try {
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', WALLET_DB_PATH,
      '--lightwalletd', LIGHTWALLETD_URL,
      'init',
    ]);

    // The init command returns "wallet-initialized: <address>" or "wallet-already-exists"
    const output = stdout.trim();
    
    if (output.startsWith('wallet-initialized:')) {
      const address = output.split(':')[1].trim();
      // We'd need to get the seed phrase separately or modify CLI
      return {
        address,
        seedPhrase: '', // TODO: Get from CLI or modify CLI to return it
      };
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
 */
export async function syncWallet(): Promise<{ synced_to_height: number }> {
  try {
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', WALLET_DB_PATH,
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
 */
export async function sendTransaction(
  to: string,
  amountZatoshis: number,
  memo: string
): Promise<{ txid: string; txHex: string }> {
  try {
    // CLI uses positional arguments: send <TO> <AMOUNT> <MEMO>
    const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
      '--db-path', WALLET_DB_PATH,
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
 */
export async function getMessages(sinceHeight?: number): Promise<{ messages: any[] }> {
  try {
    const args = [
      '--db-path', WALLET_DB_PATH,
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

