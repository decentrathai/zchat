const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export interface RegisterResponse {
  id: number;
  username: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
  };
}

export interface ApiError {
  error: string;
}

export interface WalletAddressResponse {
  id: number;
  username: string;
  primaryAddress: string | null;
}

/**
 * Get the authentication token from localStorage
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

/**
 * Register a new user
 */
export async function register(username: string, password: string): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as ApiError).error || 'Registration failed');
  }

  return data as RegisterResponse;
}

/**
 * Login with username and password
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as ApiError).error || 'Login failed');
  }

  return data as LoginResponse;
}

/**
 * Link wallet address to the authenticated user
 * Also imports the wallet on the backend using the provided mnemonic
 *
 * @param token - JWT auth token
 * @param address - The user's Zcash unified address (derived client-side)
 * @param mnemonic - The user's 24-word BIP39 mnemonic (client-side generated)
 */
export async function linkWalletAddress(
  token: string,
  address: string,
  mnemonic: string
): Promise<WalletAddressResponse> {
  const response = await fetch(`${API_BASE_URL}/me/wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ address, mnemonic }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as ApiError).error || 'Failed to link wallet address');
  }

  return data as WalletAddressResponse;
}

export interface BroadcastResponse {
  txid: string;
}

/**
 * Broadcast a signed transaction to the Zcash network
 */
export async function broadcastTransaction(token: string, txHex: string): Promise<BroadcastResponse> {
  const response = await fetch(`${API_BASE_URL}/zcash/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ txHex }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as ApiError).error || 'Failed to broadcast transaction');
  }

  return data as BroadcastResponse;
}

/**
 * Get wallet address
 */
export async function getWalletAddress(token: string): Promise<{ address: string }> {
  const response = await fetch(`${API_BASE_URL}/wallet/address`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as ApiError).error || 'Failed to get wallet address');
  }

  return data as { address: string };
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(token: string): Promise<{ balance_zatoshis: number }> {
  const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as ApiError).error || 'Failed to get wallet balance');
  }

  return data as { balance_zatoshis: number };
}

/**
 * Sync wallet
 */
export async function syncWallet(token: string): Promise<{ synced_to_height: number }> {
  const response = await fetch(`${API_BASE_URL}/wallet/sync`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as ApiError).error || 'Failed to sync wallet');
  }

  return data as { synced_to_height: number };
}

/**
 * Send a message (transaction with memo)
 * @param amountZatoshis - Amount in zatoshis (not ZEC)
 */
export async function sendMessage(
  token: string,
  to: string,
  amountZatoshis: number,
  memo: string
): Promise<{ txid: string }> {
  const response = await fetch(`${API_BASE_URL}/wallet/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ to, amount: amountZatoshis, memo }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as ApiError).error || 'Failed to send message');
  }

  return data as { txid: string };
}

/**
 * Get messages
 */
export interface ChatMessage {
  txid: string;
  height: number;
  timestamp: number;
  incoming: boolean;
  value_zatoshis: number;
  memo: string;
  to_address?: string;
}

export async function getMessages(token: string, sinceHeight?: number): Promise<{ messages: ChatMessage[] }> {
  const url = sinceHeight !== undefined
    ? `${API_BASE_URL}/messages?sinceHeight=${sinceHeight}`
    : `${API_BASE_URL}/messages`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as ApiError).error || 'Failed to get messages');
  }

  return data as { messages: ChatMessage[] };
}

