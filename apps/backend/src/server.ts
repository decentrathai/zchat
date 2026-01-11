import 'dotenv/config';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Resend } from 'resend';
import * as wallet from './wallet';
import { syncWallet, sendTransaction, getMessages, getUserWalletDbPath, importWallet, ensureWalletDbDir } from './wallet';

// JWT Secret - use environment variable or fallback to dev secret (ONLY FOR DEVELOPMENT)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Admin Secret for admin endpoints
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-dev-secret';

// APK file location
const APK_DIR = process.env.APK_DIR || '/home/yourt';

// Resend API for sending emails
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Admin notification settings
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL; // Email to receive whitelist notifications
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // Telegram bot token for notifications
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // Telegram chat ID to send notifications to

/**
 * Send notification to admin when new whitelist request arrives
 */
async function notifyAdminNewWhitelistRequest(email: string, reason: string) {
  const timestamp = new Date().toISOString();

  // Send email notification
  if (resend && ADMIN_NOTIFICATION_EMAIL) {
    try {
      await resend.emails.send({
        from: 'ZCHAT <noreply@zsend.xyz>',
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: '🆕 New ZCHAT Whitelist Request',
        html: `
          <h2>New Whitelist Request</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p><strong>Time:</strong> ${timestamp}</p>
          <hr>
          <p><a href="https://zsend.xyz/admin">Go to Admin Dashboard</a></p>
        `,
      });
      console.log(`[Notification] Email sent to ${ADMIN_NOTIFICATION_EMAIL} for new request: ${email}`);
    } catch (err) {
      console.error('[Notification] Failed to send email:', err);
    }
  }

  // Send Telegram notification
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      const message = `🆕 *New ZCHAT Whitelist Request*\n\n📧 *Email:* ${email}\n📝 *Reason:* ${reason}\n⏰ *Time:* ${timestamp}`;
      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown',
        }),
      });
      console.log(`[Notification] Telegram message sent for new request: ${email}`);
    } catch (err) {
      console.error('[Notification] Failed to send Telegram message:', err);
    }
  }
}

// Store for one-time download tokens (in production, use Redis)
const downloadTokens: Map<string, { whitelistId: number; codeId: number; createdAt: Date }> = new Map();

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

// =====================
// WHITELIST ENDPOINTS
// =====================

/**
 * Join the whitelist for early access
 *
 * POST /whitelist/join
 * Body: { email: string, reason: string }
 *
 * Public endpoint - no auth required
 */
server.post<{ Body: { email: string; reason: string } }>('/whitelist/join', async (request, reply) => {
  const { email, reason } = request.body;

  // Validate email
  if (!email || typeof email !== 'string') {
    reply.code(400);
    return { error: 'Email is required' };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    reply.code(400);
    return { error: 'Invalid email format' };
  }

  // Validate reason
  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    reply.code(400);
    return { error: 'Please provide a reason (at least 10 characters)' };
  }

  try {
    // Check if already registered
    const existing = await prisma.whitelist.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return {
        success: true,
        message: 'You are already on the whitelist!',
        alreadyRegistered: true
      };
    }

    // Create whitelist entry
    await prisma.whitelist.create({
      data: {
        email: email.toLowerCase().trim(),
        reason: reason.trim(),
        status: 'pending',
      },
    });

    server.log.info({ email }, 'New whitelist signup');

    // Send notification to admin (non-blocking)
    notifyAdminNewWhitelistRequest(email.toLowerCase().trim(), reason.trim());

    return {
      success: true,
      message: 'Successfully joined the whitelist!'
    };
  } catch (error: any) {
    // Handle unique constraint violation (race condition)
    if (error.code === 'P2002') {
      return {
        success: true,
        message: 'You are already on the whitelist!',
        alreadyRegistered: true
      };
    }

    server.log.error({ error: error.message }, 'Failed to join whitelist');
    reply.code(500);
    return { error: 'Failed to join whitelist. Please try again.' };
  }
});

// Admin authentication helper
async function authenticateAdmin(request: FastifyRequest, reply: FastifyReply) {
  const adminHeader = request.headers['x-admin-secret'];

  if (!adminHeader || adminHeader !== ADMIN_SECRET) {
    reply.code(401);
    throw new Error('Unauthorized: Invalid admin credentials');
  }
}

// Generate a random download code
function generateDownloadCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 character code like "A1B2C3D4"
}

// Generate a one-time download token
function generateDownloadToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * List all whitelist entries (admin only)
 *
 * GET /admin/whitelist
 * Headers: X-Admin-Secret: <admin_secret>
 */
server.get('/admin/whitelist', async (request, reply) => {
  await authenticateAdmin(request, reply);

  try {
    const entries = await prisma.whitelist.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        downloadCodes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return { entries };
  } catch (error: any) {
    server.log.error({ error: error.message }, 'Failed to fetch whitelist');
    reply.code(500);
    return { error: 'Failed to fetch whitelist' };
  }
});

/**
 * Generate a download code for a whitelist entry (admin only)
 *
 * POST /admin/whitelist/:id/generate-code
 * Headers: X-Admin-Secret: <admin_secret>
 * Body: { expiresInDays?: number }
 */
server.post<{ Params: { id: string }; Body: { expiresInDays?: number } }>(
  '/admin/whitelist/:id/generate-code',
  async (request, reply) => {
    await authenticateAdmin(request, reply);

    const whitelistId = parseInt(request.params.id, 10);
    const expiresInDays = request.body?.expiresInDays || 7; // Default 7 days

    if (isNaN(whitelistId)) {
      reply.code(400);
      return { error: 'Invalid whitelist ID' };
    }

    try {
      // Check if whitelist entry exists
      const entry = await prisma.whitelist.findUnique({
        where: { id: whitelistId },
      });

      if (!entry) {
        reply.code(404);
        return { error: 'Whitelist entry not found' };
      }

      // Generate a unique code
      let code: string;
      let isUnique = false;
      do {
        code = generateDownloadCode();
        const existing = await prisma.downloadCode.findUnique({ where: { code } });
        isUnique = !existing;
      } while (!isUnique);

      // Create the download code
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const downloadCode = await prisma.downloadCode.create({
        data: {
          code,
          whitelistId,
          expiresAt,
        },
      });

      // Update whitelist status to approved
      await prisma.whitelist.update({
        where: { id: whitelistId },
        data: {
          status: 'approved',
          approvedAt: new Date(),
        },
      });

      server.log.info({ whitelistId, code }, 'Generated download code');

      return {
        success: true,
        code: downloadCode.code,
        expiresAt: downloadCode.expiresAt,
        email: entry.email,
      };
    } catch (error: any) {
      server.log.error({ error: error.message }, 'Failed to generate download code');
      reply.code(500);
      return { error: 'Failed to generate download code' };
    }
  }
);

/**
 * Send download code email to a whitelist user (admin only)
 *
 * POST /admin/whitelist/:id/send-code-email
 * Headers: X-Admin-Secret: <admin_secret>
 * Body: { code: string }
 */
server.post<{ Params: { id: string }; Body: { code: string } }>(
  '/admin/whitelist/:id/send-code-email',
  async (request, reply) => {
    await authenticateAdmin(request, reply);

    const whitelistId = parseInt(request.params.id, 10);
    const { code } = request.body;

    if (isNaN(whitelistId)) {
      reply.code(400);
      return { error: 'Invalid whitelist ID' };
    }

    if (!code || typeof code !== 'string') {
      reply.code(400);
      return { error: 'Download code is required' };
    }

    if (!resend) {
      reply.code(500);
      return { error: 'Email service not configured. Set RESEND_API_KEY in environment.' };
    }

    try {
      // Get whitelist entry
      const entry = await prisma.whitelist.findUnique({
        where: { id: whitelistId },
      });

      if (!entry) {
        reply.code(404);
        return { error: 'Whitelist entry not found' };
      }

      // Send email via Resend
      const { data, error } = await resend.emails.send({
        from: 'ZCHAT <noreply@zsend.xyz>',
        to: entry.email,
        subject: 'Your ZCHAT Download Code',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background-color: #050510; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <!-- Header -->
              <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="color: #22d3ee; font-size: 32px; margin: 0;">ZCHAT</h1>
                <p style="color: #9ca3af; margin-top: 8px;">Private messaging on Zcash</p>
              </div>

              <!-- Congratulations Banner -->
              <div style="background: linear-gradient(135deg, rgba(34,211,238,0.2) 0%, rgba(139,92,246,0.15) 100%); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <p style="font-size: 28px; margin: 0 0 8px 0;">&#127881;</p>
                <h2 style="color: #22d3ee; font-size: 20px; margin: 0 0 8px 0;">Congratulations!</h2>
                <p style="color: #d1d5db; margin: 0; font-size: 15px;">You're now part of our exclusive testing team</p>
              </div>

              <!-- Main Content -->
              <div style="background: linear-gradient(135deg, rgba(34,211,238,0.1) 0%, rgba(139,92,246,0.05) 100%); border: 1px solid rgba(34,211,238,0.3); border-radius: 16px; padding: 32px;">
                <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 16px 0;">Your Download Code</h2>
                <p style="color: #d1d5db; line-height: 1.6; margin: 0 0 24px 0;">
                  Thank you for believing in privacy! Your support means the world to us, and we won't forget it. Use the code below to download the app:
                </p>

                <!-- Code Box -->
                <div style="background: #111827; border: 2px solid #22d3ee; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                  <code style="font-size: 32px; font-weight: bold; color: #22d3ee; letter-spacing: 4px;">${code}</code>
                </div>

                <p style="color: #9ca3af; font-size: 14px; margin: 0 0 24px 0;">
                  This code expires in 7 days and can only be used once.
                </p>

                <!-- CTA Button -->
                <a href="https://zsend.xyz/#download" style="display: inline-block; background: #22d3ee; color: #000000; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">
                  Download ZCHAT
                </a>
              </div>

              <!-- Instructions -->
              <div style="margin-top: 32px; padding: 24px; background: rgba(255,255,255,0.03); border-radius: 12px;">
                <h3 style="color: #ffffff; font-size: 16px; margin: 0 0 12px 0;">How to download:</h3>
                <ol style="color: #9ca3af; margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Visit <a href="https://zsend.xyz" style="color: #22d3ee;">zsend.xyz</a></li>
                  <li>Click "I have a download code"</li>
                  <li>Enter your code: <strong style="color: #22d3ee;">${code}</strong></li>
                  <li>Install the APK on your Android device</li>
                </ol>
              </div>

              <!-- Footer -->
              <div style="margin-top: 40px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">
                  ZCHAT - The most private messenger in the world<br>
                  <a href="https://zsend.xyz" style="color: #22d3ee;">zsend.xyz</a> |
                  <a href="https://x.com/zchat_app" style="color: #22d3ee;">@zchat_app</a>
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        server.log.error({ error }, 'Failed to send email');
        reply.code(500);
        return { error: 'Failed to send email: ' + error.message };
      }

      server.log.info({ email: entry.email, code }, 'Download code email sent');

      return {
        success: true,
        message: `Email sent to ${entry.email}`,
        emailId: data?.id,
      };
    } catch (error: any) {
      server.log.error({ error: error.message }, 'Failed to send email');
      reply.code(500);
      return { error: 'Failed to send email' };
    }
  }
);

/**
 * Verify a download code and return a one-time download token
 *
 * POST /download/verify-code
 * Body: { code: string }
 */
server.post<{ Body: { code: string } }>('/download/verify-code', async (request, reply) => {
  const { code } = request.body;

  if (!code || typeof code !== 'string') {
    reply.code(400);
    return { error: 'Download code is required' };
  }

  try {
    // Find the download code
    const downloadCode = await prisma.downloadCode.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: { whitelist: true },
    });

    if (!downloadCode) {
      reply.code(404);
      return { error: 'Invalid download code' };
    }

    // Check if already used
    if (downloadCode.used) {
      reply.code(400);
      return { error: 'This download code has already been used' };
    }

    // Check if expired
    if (new Date() > downloadCode.expiresAt) {
      reply.code(400);
      return { error: 'This download code has expired' };
    }

    // Generate a one-time download token
    const token = generateDownloadToken();
    downloadTokens.set(token, {
      whitelistId: downloadCode.whitelistId,
      codeId: downloadCode.id,
      createdAt: new Date(),
    });

    // Clean up old tokens (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [key, value] of downloadTokens.entries()) {
      if (value.createdAt < oneHourAgo) {
        downloadTokens.delete(key);
      }
    }

    server.log.info({ code, email: downloadCode.whitelist.email }, 'Download code verified');

    return {
      success: true,
      downloadUrl: `/download/apk/${token}`,
      message: 'Your download is ready! Click the link to download the APK.',
    };
  } catch (error: any) {
    server.log.error({ error: error.message }, 'Failed to verify download code');
    reply.code(500);
    return { error: 'Failed to verify download code' };
  }
});

/**
 * Download the APK file (one-time download)
 *
 * GET /download/apk/:token
 */
server.get<{ Params: { token: string } }>('/download/apk/:token', async (request, reply) => {
  const { token } = request.params;

  // Validate token
  const tokenData = downloadTokens.get(token);
  if (!tokenData) {
    reply.code(404);
    return { error: 'Invalid or expired download link' };
  }

  try {
    // Mark the download code as used
    await prisma.downloadCode.update({
      where: { id: tokenData.codeId },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    // Remove the token (one-time use)
    downloadTokens.delete(token);

    // Find the latest APK file
    const apkFiles = fs.readdirSync(APK_DIR)
      .filter(file => file.endsWith('.apk') && file.includes('zchat'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(APK_DIR, a));
        const statB = fs.statSync(path.join(APK_DIR, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      });

    if (apkFiles.length === 0) {
      reply.code(404);
      return { error: 'APK file not found. Please contact support.' };
    }

    const apkPath = path.join(APK_DIR, apkFiles[0]);
    const apkName = apkFiles[0];

    server.log.info({ apkName, whitelistId: tokenData.whitelistId }, 'APK download started');

    // Send the file
    reply.header('Content-Disposition', `attachment; filename="${apkName}"`);
    reply.header('Content-Type', 'application/vnd.android.package-archive');

    const stream = fs.createReadStream(apkPath);
    return reply.send(stream);
  } catch (error: any) {
    server.log.error({ error: error.message }, 'Failed to serve APK');
    reply.code(500);
    return { error: 'Failed to download APK' };
  }
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
// This also initializes the per-user wallet database from the client's seed phrase
server.post<{ Body: { address: string; mnemonic: string } }>('/me/wallet', async (request, reply) => {
  await authenticate(request, reply);

  // User is attached to request by authenticate middleware
  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }

  const { address, mnemonic } = request.body;

  if (!address || typeof address !== 'string') {
    reply.code(400);
    return { error: 'address is required and must be a string' };
  }

  if (!mnemonic || typeof mnemonic !== 'string') {
    reply.code(400);
    return { error: 'mnemonic is required and must be a string' };
  }

  // Validate mnemonic is 24 words
  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 24) {
    reply.code(400);
    return { error: 'mnemonic must be exactly 24 words' };
  }

  try {
    // Initialize the per-user wallet database by importing the mnemonic
    const walletDbPath = getUserWalletDbPath(request.user.id);

    try {
      // Try to import wallet - this will fail if already exists
      const result = await importWallet(walletDbPath, mnemonic);
      server.log.info({ userId: request.user.id, walletDbPath, derivedAddress: result.address }, 'Imported wallet for user');

      // Verify the derived address matches what the client derived
      if (result.address !== address) {
        server.log.warn({
          userId: request.user.id,
          clientAddress: address,
          serverAddress: result.address
        }, 'Address mismatch between client and server derivation');
        // We'll use the server's derived address as the source of truth
      }
    } catch (initError: any) {
      // Wallet might already exist, which is OK
      if (!initError.message.includes('already exists')) {
        throw initError;
      }
      server.log.info({ userId: request.user.id }, 'Wallet already exists for user');
    }

    // Update the user's primaryAddress and walletDbPath in the database
    const updatedUser = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        primaryAddress: address,
        walletDbPath: walletDbPath,
      },
      select: {
        id: true,
        username: true,
        primaryAddress: true,
      },
    });

    return updatedUser;
  } catch (error: any) {
    server.log.error({ error: error.message }, 'Failed to initialize wallet');
    reply.code(500);
    return { error: error.message || 'Failed to initialize wallet' };
  }
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
    const walletDbPath = getUserWalletDbPath(request.user.id);
    const address = await wallet.getPrimaryAddress(walletDbPath);
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
    const walletDbPath = getUserWalletDbPath(request.user.id);
    const balance = await wallet.getBalance(walletDbPath);
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
    const walletDbPath = getUserWalletDbPath(request.user.id);
    const result = await syncWallet(walletDbPath);
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
    const walletDbPath = getUserWalletDbPath(request.user.id);
    const sinceHeight = request.query && typeof (request.query as any).sinceHeight === 'string'
      ? parseInt((request.query as any).sinceHeight, 10)
      : undefined;
    const result = await getMessages(walletDbPath, sinceHeight);
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
    // Step 1: Build the transaction using wallet-core with per-user wallet
    const walletDbPath = getUserWalletDbPath(request.user.id);
    const { txHex, txid } = await wallet.buildTransaction(walletDbPath, to, amount, memo);

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

