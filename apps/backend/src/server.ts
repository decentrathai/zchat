import 'dotenv/config';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as wallet from './wallet';
import { syncWallet, sendTransaction, getMessages } from './wallet';

// JWT Secret - use environment variable or fallback to dev secret (ONLY FOR DEVELOPMENT)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Zcash RPC Configuration - GetBlock.io JSON-RPC endpoint
const ZCASH_RPC_URL = process.env.ZCASH_RPC_URL;

if (!ZCASH_RPC_URL) {
  throw new Error('ZCASH_RPC_URL is not set. Please configure it in your .env file.');
}

// Initialize Prisma Client with direct connection
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Extend Fastify types to include user in request
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      username: string;
    };
  }
}

const server = Fastify({
  logger: true,
});

server.register(cors);

// Auth helper middleware - verifies JWT and attaches user to request
async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401);
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
    
    // Attach user info to request
    request.user = {
      id: decoded.userId,
      username: decoded.username,
    };
  } catch (error) {
    reply.code(401);
    throw new Error('Invalid or expired token');
  }
}

// Health check route
server.get('/health', async (request, reply) => {
  return { ok: true };
});

// Register a new user
server.post<{ Body: { username: string; password: string } }>('/auth/register', async (request, reply) => {
  const { username, password } = request.body;

  try {
    // Hash the password with bcrypt (10 salt rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    // Create new user in database
    const newUser = await prisma.user.create({
      data: {
        username,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
      },
    });

    return { id: newUser.id, username: newUser.username };
  } catch (error: any) {
    // Check if error is due to unique constraint violation
    if (error.code === 'P2002' && error.meta?.target?.includes('username')) {
      reply.code(400);
      return { error: 'Username already taken' };
    }
    
    // Re-throw other errors
    throw error;
  }
});

// Login route
server.post<{ Body: { username: string; password: string } }>('/auth/login', async (request, reply) => {
  const { username, password } = request.body;

  // Look up user by username
  const user = await prisma.user.findUnique({
    where: { username },
  });

  if (!user) {
    reply.code(401);
    return { error: 'Invalid credentials' };
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);

  if (!passwordValid) {
    reply.code(401);
    return { error: 'Invalid credentials' };
  }

  // Sign JWT token
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
    },
  };
});

// Get current user (protected route)
server.get('/me', async (request, reply) => {
  await authenticate(request, reply);

  // User is attached to request by authenticate middleware
  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }

  // Fetch user from database to include primaryAddress
  const user = await prisma.user.findUnique({
    where: { id: request.user.id },
    select: {
      id: true,
      username: true,
      primaryAddress: true,
    },
  });

  if (!user) {
    reply.code(404);
    return { error: 'User not found' };
  }

  return user;
});

// Update user's wallet address (protected route)
server.post<{ Body: { address: string } }>('/me/wallet', async (request, reply) => {
  await authenticate(request, reply);

  // User is attached to request by authenticate middleware
  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }

  const { address } = request.body;

  // Update the user's primaryAddress
  const updatedUser = await prisma.user.update({
    where: { id: request.user.id },
    data: { primaryAddress: address },
    select: {
      id: true,
      username: true,
      primaryAddress: true,
    },
  });

  return updatedUser;
});

// Get all users
server.get('/users', async (request, reply) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
    },
  });

  return users;
});

/**
 * Helper function to make JSON-RPC calls to the Zcash node via GetBlock.io
 *
 * @param method - The RPC method name (e.g., "sendrawtransaction")
 * @param params - Array of parameters for the RPC method
 * @returns The result from the RPC call
 * @throws Error if the RPC call fails
 */
async function callZcashRPC<T = any>(method: string, params: any[] = []): Promise<T> {
  if (!ZCASH_RPC_URL) {
    throw new Error('ZCASH_RPC_URL is not configured');
  }

  const rpcRequest = {
    jsonrpc: '2.0',
    id: 'zcash-chat',
    method,
    params,
  };

  const response = await fetch(ZCASH_RPC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rpcRequest),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Zcash RPC HTTP error: ${response.status} ${response.statusText}. Body: ${errorBody}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || 'RPC error');
  }

  return data.result as T;
}

/**
 * Broadcast a signed transaction to the Zcash network
 * 
 * POST /zcash/broadcast
 * Body: { txHex: string }
 * 
 * This endpoint:
 * 1. Requires JWT authentication
 * 2. Takes a hex-encoded signed transaction
 * 3. Calls zcashd's sendrawtransaction RPC method
 * 4. Returns the transaction ID
 */
server.post<{ Body: { txHex: string } }>('/zcash/broadcast', async (request, reply) => {
  // Require authentication
  await authenticate(request, reply);

  // User is attached to request by authenticate middleware
  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }

  const { txHex } = request.body;

  // Validate input
  if (!txHex || typeof txHex !== 'string') {
    reply.code(400);
    return { error: 'txHex is required and must be a string' };
  }

  // Validate hex format (basic check)
  if (!/^[0-9a-fA-F]+$/.test(txHex)) {
    reply.code(400);
    return { error: 'txHex must be a valid hexadecimal string' };
  }

  try {
    // Call Zcash sendrawtransaction via GetBlock.io
    const txid = await callZcashRPC<string>('sendrawtransaction', [txHex]);

    // Return the transaction ID
    return { txid };
  } catch (error: any) {
    // Log the error for debugging
    server.log.error({ error: error.message }, 'Failed to broadcast transaction');

    // Return error response
    reply.code(500);
    return { error: error.message || 'Failed to broadcast transaction' };
  }
});

/**
 * Get basic Zcash network / blockchain info
 *
 * GET /zcash/network-info
 *
 * Returns a subset of fields from getblockchaininfo.
 */
server.get('/zcash/network-info', async (request, reply) => {
  // Require authentication
  await authenticate(request, reply);

  // User is attached to request by authenticate middleware
  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }

  try {
    const info = await callZcashRPC<{
      chain: string;
      blocks: number;
      headers: number;
      verificationprogress: number;
      size_on_disk?: number;
    }>('getblockchaininfo', []);

    const result = {
      chain: info.chain,
      blocks: info.blocks,
      headers: info.headers,
      verificationprogress: info.verificationprogress,
      size_on_disk: info.size_on_disk,
    };

    return result;
  } catch (error: any) {
    server.log.error({ error: error.message }, 'Failed to fetch Zcash network info');
    reply.code(500);
    return { error: error.message || 'Failed to fetch Zcash network info' };
  }
});

// Wallet routes
server.get('/wallet/address', async (request, reply) => {
  await authenticate(request, reply);
  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }
  try {
    const address = await wallet.getPrimaryAddress();
    return { address };
  } catch (error: any) {
    server.log.error({ error: error.message }, 'Failed to get wallet address');
    reply.code(500);
    return { error: error.message || 'Failed to get wallet address' };
  }
});

server.get('/wallet/balance', async (request, reply) => {
  await authenticate(request, reply);
  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }
  try {
    const balance = await wallet.getBalance();
    return { balance_zatoshis: balance };
  } catch (error: any) {
    server.log.error({ error: error.message }, 'Failed to get wallet balance');
    reply.code(500);
    return { error: error.message || 'Failed to get wallet balance' };
  }
});

server.post('/wallet/sync', async (request, reply) => {
  await authenticate(request, reply);
  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }
  try {
    const result = await syncWallet();
    return result;
  } catch (error: any) {
    server.log.error({ error: error.message }, 'Failed to sync wallet');
    reply.code(500);
    return { error: error.message || 'Failed to sync wallet' };
  }
});

server.get('/messages', async (request, reply) => {
  await authenticate(request, reply);
  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }
  try {
    const sinceHeight = request.query && typeof (request.query as any).sinceHeight === 'string' 
      ? parseInt((request.query as any).sinceHeight, 10) 
      : undefined;
    const result = await getMessages(sinceHeight);
    return result;
  } catch (error: any) {
    server.log.error({ error: error.message }, 'Failed to get messages');
    reply.code(500);
    return { error: error.message || 'Failed to get messages' };
  }
});

/**
 * Send a Zcash transaction using the wallet
 * 
 * POST /wallet/send
 * Body: { to: string, amount: number, memo: string }
 * 
 * This endpoint:
 * 1. Requires JWT authentication
 * 2. Builds a transaction using wallet-core
 * 3. Broadcasts it via the existing /zcash/broadcast endpoint
 * 4. Returns the transaction ID
 */
server.post<{ Body: { to: string; amount: number; memo: string } }>('/wallet/send', async (request, reply) => {
  // Require authentication
  await authenticate(request, reply);

  // User is attached to request by authenticate middleware
  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }

  const { to, amount, memo } = request.body;

  // Validate input
  if (!to || typeof to !== 'string') {
    reply.code(400);
    return { error: 'to address is required and must be a string' };
  }

  if (typeof amount !== 'number' || amount <= 0) {
    reply.code(400);
    return { error: 'amount is required and must be a positive number (in zatoshis)' };
  }

  if (typeof memo !== 'string') {
    reply.code(400);
    return { error: 'memo must be a string' };
  }

  try {
    // Step 1: Build the transaction using wallet-core
    const { txHex, txid } = await wallet.buildTransaction(to, amount, memo);

    // Step 2: Broadcast the transaction
    // We'll call the existing broadcast endpoint logic
    const broadcastTxid = await callZcashRPC<string>('sendrawtransaction', [txHex]);

    // Return the transaction ID
    return { txid: broadcastTxid || txid };
  } catch (error: any) {
    // Log the error for debugging
    server.log.error({ error: error.message }, 'Failed to send transaction');

    // Return error response
    reply.code(500);
    return { error: error.message || 'Failed to send transaction' };
  }
});

const start = async () => {
  try {
    await server.listen({ port: 4000 });
    console.log('Server listening on port 4000');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

