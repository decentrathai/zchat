const API_BASE_URL = 'http://localhost:4000';

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
 */
export async function linkWalletAddress(token: string, address: string): Promise<WalletAddressResponse> {
  const response = await fetch(`${API_BASE_URL}/me/wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ address }),
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

