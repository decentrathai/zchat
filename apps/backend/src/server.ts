import 'dotenv/config';
import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { Resend } from 'resend';

// HTML escape helper to prevent XSS in emails
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Constant-time string comparison to prevent timing attacks
// Uses HMAC to normalize length before comparison (prevents length oracle)
function secureCompare(a: string, b: string): boolean {
  // Use HMAC to normalize both strings to same length
  // This prevents timing attacks that could reveal the secret length
  const key = crypto.randomBytes(32);
  const hmacA = crypto.createHmac('sha256', key).update(a).digest();
  const hmacB = crypto.createHmac('sha256', key).update(b).digest();
  return crypto.timingSafeEqual(hmacA, hmacB);
}

// Type-safe error message extraction (MEDIUM #B1)
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

// Type-safe Prisma error code extraction
function getPrismaErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code: string }).code;
  }
  return undefined;
}

// Type predicate for JWT payload validation (Boris Cherny best practice)
function isValidJwtPayload(obj: unknown): obj is { userId: number; username: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'userId' in obj &&
    'username' in obj &&
    typeof (obj as Record<string, unknown>).userId === 'number' &&
    typeof (obj as Record<string, unknown>).username === 'string'
  );
}
import { syncWallet, sendTransaction, getMessages, getUserWalletDbPath, ensureWalletDbDir, getPrimaryAddress, getBalance, buildTransaction } from './wallet';

// JWT Secret - REQUIRED in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}
const jwtSecret = JWT_SECRET || 'dev-secret-DO-NOT-USE-IN-PRODUCTION';

// Admin Secret for admin endpoints - REQUIRED in production
const ADMIN_SECRET = process.env.ADMIN_SECRET;
if (!ADMIN_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('ADMIN_SECRET environment variable is required in production');
}
const adminSecret = ADMIN_SECRET || 'admin-dev-secret-DO-NOT-USE-IN-PRODUCTION';

// APK file location - validated at startup (MEDIUM #B3)
const APK_DIR = process.env.APK_DIR || '/home/yourt';

// Validate APK_DIR path to prevent misconfiguration
if (!path.isAbsolute(APK_DIR)) {
  throw new Error(`APK_DIR must be an absolute path, got: ${APK_DIR}`);
}
if (!fs.existsSync(APK_DIR)) {
  console.warn(`Warning: APK_DIR does not exist: ${APK_DIR}`);
}
if (fs.existsSync(APK_DIR) && !fs.statSync(APK_DIR).isDirectory()) {
  throw new Error(`APK_DIR is not a directory: ${APK_DIR}`);
}

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
  // HTML-escape user input to prevent XSS (HIGH #B3)
  const safeEmail = escapeHtml(email);
  const safeReason = escapeHtml(reason);

  if (resend && ADMIN_NOTIFICATION_EMAIL) {
    try {
      await resend.emails.send({
        from: 'ZCHAT <noreply@zsend.xyz>',
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: '🆕 New ZCHAT Whitelist Request',
        html: `
          <h2>New Whitelist Request</h2>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Reason:</strong> ${safeReason}</p>
          <p><strong>Time:</strong> ${timestamp}</p>
          <hr>
          <p><a href="https://zsend.xyz/admin">Go to Admin Dashboard</a></p>
        `,
      });
      server.log.info({ to: ADMIN_NOTIFICATION_EMAIL, requestEmail: email }, 'Notification email sent');
    } catch (err) {
      server.log.error({ err }, 'Failed to send notification email');
    }
  }

  // Send Telegram notification
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      const message = `🆕 *New ZCHAT Whitelist Request*\n\n📧 *Email:* ${safeEmail}\n📝 *Reason:* ${safeReason}\n⏰ *Time:* ${timestamp}`;
      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

      // Add timeout to prevent hanging (10 seconds)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'Markdown',
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      server.log.info({ chatId: TELEGRAM_CHAT_ID, requestEmail: email }, 'Telegram notification sent');
    } catch (err) {
      server.log.error({ err }, 'Failed to send Telegram notification');
    }
  }
}

// Store for one-time download tokens (in production, use Redis)
const downloadTokens: Map<string, { whitelistId: number; codeId: number; createdAt: Date }> = new Map();

// Max tokens to prevent memory exhaustion (#R3-M4)
const MAX_DOWNLOAD_TOKENS = 10000;

// TTL cleanup for downloadTokens to prevent memory leak (HIGH #B2)
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of downloadTokens.entries()) {
    if (now - value.createdAt.getTime() > TOKEN_TTL_MS) {
      downloadTokens.delete(key);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

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
  bodyLimit: 1048576, // 1MB max body size (MEDIUM #B2)
});

// Custom JSON parser that handles empty bodies (for DELETE requests)
server.removeContentTypeParser('application/json');
server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  if (!body || body === '') {
    done(null, {});
    return;
  }
  try {
    const json = JSON.parse(body as string);
    done(null, json);
  } catch (err) {
    done(err as Error, undefined);
  }
});

// CORS configuration - restrict to known origins in production
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'https://app.zsend.xyz',
  'https://zsend.xyz',
  'https://zchat.sh',
  'https://app.zchat.sh',
  'https://api.zchat.sh',
  'http://localhost:3000'  // Development only
];

server.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (like mobile apps, curl)
    if (!origin) return cb(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      return cb(null, true);
    }

    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return cb(null, true);
    }

    return cb(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
});

// Rate limiting to prevent abuse (HIGH #B1)
server.register(rateLimit, {
  max: 100, // Max 100 requests per window
  timeWindow: '1 minute',
  // Stricter limits for auth endpoints
  keyGenerator: (request) => {
    return request.ip || 'unknown';
  },
});

// Auth helper middleware - verifies JWT and attaches user to request
async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401);
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  try {
    const decoded = jwt.verify(token, jwtSecret);

    // Runtime validation of JWT payload structure using type predicate
    if (!isValidJwtPayload(decoded)) {
      reply.code(401);
      throw new Error('Invalid token payload');
    }

    const payload = decoded; // Type narrowed by predicate — no assertion needed

    // Attach user info to request
    request.user = {
      id: payload.userId,
      username: payload.username,
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

// App version check — public, no auth
// Returns latest APK version info extracted from filename in APK_DIR
server.get('/app/version', async (request, reply) => {
  try {
    const fsPromises = fs.promises;
    const allFiles = await fsPromises.readdir(APK_DIR);
    const apkFiles = allFiles.filter(file => file.endsWith('.apk') && file.includes('zchat'));

    if (apkFiles.length === 0) {
      reply.code(404);
      return { error: 'No APK found' };
    }

    // Sort by mtime (newest first), same as download endpoint
    const filesWithStats = await Promise.all(
      apkFiles.map(async (file) => {
        const stat = await fsPromises.stat(path.join(APK_DIR, file));
        return { file, mtime: stat.mtime.getTime() };
      })
    );
    filesWithStats.sort((a, b) => b.mtime - a.mtime);

    const latestApk = filesWithStats[0].file;
    const versionMatch = latestApk.match(/zchat-v(\d+\.\d+\.\d+)/);

    if (!versionMatch) {
      reply.code(404);
      return { error: 'Could not extract version from APK filename' };
    }

    const versionName = versionMatch[1];
    const parts = versionName.split('.').map(Number);
    const versionCode = parts[0] * 10000 + parts[1] * 100 + parts[2];

    server.log.info({ versionName, versionCode, apk: latestApk }, 'Version check served');

    return { versionCode, versionName, downloadUrl: 'https://api.zsend.xyz/app/download' };
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Version check failed');
    reply.code(500);
    return { error: 'Failed to check version' };
  }
});

// Public APK download — serves the latest APK file directly (for in-app updates)
server.get('/app/download', async (request, reply) => {
  try {
    const fsPromises = fs.promises;
    const allFiles = await fsPromises.readdir(APK_DIR);
    const apkFiles = allFiles.filter(file => file.endsWith('.apk') && file.includes('zchat'));

    if (apkFiles.length === 0) {
      reply.code(404);
      return { error: 'No APK found' };
    }

    const filesWithStats = await Promise.all(
      apkFiles.map(async (file) => {
        const stat = await fsPromises.stat(path.join(APK_DIR, file));
        return { file, mtime: stat.mtime.getTime(), size: stat.size };
      })
    );
    filesWithStats.sort((a, b) => b.mtime - a.mtime);

    const latest = filesWithStats[0];
    const apkPath = path.join(APK_DIR, latest.file);

    server.log.info({ apk: latest.file, size: latest.size }, 'Public APK download started');

    reply.header('Content-Disposition', `attachment; filename="${latest.file}"`);
    reply.header('Content-Type', 'application/vnd.android.package-archive');
    reply.header('Content-Length', latest.size);

    const stream = fs.createReadStream(apkPath);
    return reply.send(stream);
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Public APK download failed');
    reply.code(500);
    return { error: 'Failed to download APK' };
  }
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

  // Email length validation (RFC 5321 limits to 254 chars - #R3-H3)
  if (email.length > 254) {
    reply.code(400);
    return { error: 'Email is too long (max 254 characters)' };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    reply.code(400);
    return { error: 'Invalid email format' };
  }

  // Validate reason (10-1000 characters - #R3-M2)
  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    reply.code(400);
    return { error: 'Please provide a reason (at least 10 characters)' };
  }
  if (reason.length > 1000) {
    reply.code(400);
    return { error: 'Reason is too long (max 1000 characters)' };
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
  } catch (error) {
    // Handle unique constraint violation (race condition)
    if (getPrismaErrorCode(error) === 'P2002') {
      return {
        success: true,
        message: 'You are already on the whitelist!',
        alreadyRegistered: true
      };
    }

    server.log.error({ error: getErrorMessage(error) }, 'Failed to join whitelist');
    reply.code(500);
    return { error: 'Failed to join whitelist. Please try again.' };
  }
});

// Admin authentication helper - uses constant-time comparison (HIGH #B4)
async function authenticateAdmin(request: FastifyRequest, reply: FastifyReply) {
  const adminHeader = request.headers['x-admin-secret'];

  // Use secureCompare to prevent timing attacks
  if (!adminHeader || typeof adminHeader !== 'string' || !secureCompare(adminHeader, adminSecret)) {
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
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to fetch whitelist');
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
    const expiresInDays = request.body?.expiresInDays || 30; // Default 30 days

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

      // Generate a unique code with max iterations to prevent infinite loop (#R3-M5)
      let code: string;
      let isUnique = false;
      let attempts = 0;
      const MAX_CODE_GENERATION_ATTEMPTS = 100;
      do {
        if (attempts >= MAX_CODE_GENERATION_ATTEMPTS) {
          throw new Error('Failed to generate unique download code after max attempts');
        }
        code = generateDownloadCode();
        const existing = await prisma.downloadCode.findUnique({ where: { code } });
        isUnique = !existing;
        attempts++;
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

      server.log.info({ whitelistId, codePrefix: code.substring(0, 2) + '***' }, 'Generated download code');

      return {
        success: true,
        code: downloadCode.code,
        expiresAt: downloadCode.expiresAt,
        email: entry.email,
      };
    } catch (error) {
      server.log.error({ error: getErrorMessage(error) }, 'Failed to generate download code');
      reply.code(500);
      return { error: 'Failed to generate download code' };
    }
  }
);

/**
 * Delete a whitelist entry (admin only)
 *
 * DELETE /admin/whitelist/:id
 * Headers: X-Admin-Secret: <admin_secret>
 */
server.delete<{ Params: { id: string } }>(
  '/admin/whitelist/:id',
  async (request, reply) => {
    await authenticateAdmin(request, reply);

    const whitelistId = parseInt(request.params.id, 10);

    if (isNaN(whitelistId)) {
      reply.code(400);
      return { error: 'Invalid whitelist ID' };
    }

    try {
      // Delete associated download codes first (due to foreign key constraint)
      await prisma.downloadCode.deleteMany({
        where: { whitelistId },
      });

      // Delete the whitelist entry
      await prisma.whitelist.delete({
        where: { id: whitelistId },
      });

      server.log.info({ whitelistId }, 'Whitelist entry deleted');

      return { success: true, message: 'Entry deleted successfully' };
    } catch (error) {
      if (getPrismaErrorCode(error) === 'P2025') {
        reply.code(404);
        return { error: 'Whitelist entry not found' };
      }
      server.log.error({ error: getErrorMessage(error) }, 'Failed to delete whitelist entry');
      reply.code(500);
      return { error: 'Failed to delete entry' };
    }
  }
);

/**
 * Send download code email to a whitelist user (admin only)
 *
 * POST /admin/whitelist/:id/send-code-email
 * Headers: X-Admin-Secret: <admin_secret>
 * Body: { code: string, customMessage?: string }
 */
server.post<{ Params: { id: string }; Body: { code: string; customMessage?: string } }>(
  '/admin/whitelist/:id/send-code-email',
  async (request, reply) => {
    await authenticateAdmin(request, reply);

    const whitelistId = parseInt(request.params.id, 10);
    const { code, customMessage } = request.body;

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
          <body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #0a0a0f;">
              <!-- Header -->
              <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="color: #00d4ff; font-size: 32px; margin: 0; text-shadow: 0 0 10px rgba(0,212,255,0.5);">ZCHAT</h1>
                <p style="color: #666666; margin-top: 8px; font-size: 14px;">Private messaging on Zcash</p>
              </div>

              <!-- Congratulations Banner -->
              <div style="background-color: #1a1a2e; border: 1px solid #00d4ff; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <p style="font-size: 32px; margin: 0 0 12px 0;">&#127881;</p>
                <h2 style="color: #00d4ff; font-size: 22px; margin: 0 0 8px 0; font-weight: 600;">Congratulations!</h2>
                <p style="color: #b0b0b0; margin: 0; font-size: 15px;">You're now part of our exclusive testing team</p>
              </div>

              ${customMessage ? `
              <!-- Personal Message from Admin -->
              <div style="background-color: #1a1a2e; border-left: 4px solid #a855f7; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 24px;">
                <p style="color: #e0e0e0; margin: 0; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(customMessage)}</p>
              </div>
              ` : ''}

              <!-- Main Content -->
              <div style="background-color: #12121a; border: 1px solid #333; border-radius: 16px; padding: 32px;">
                <h2 style="color: #00d4ff; font-size: 24px; margin: 0 0 16px 0; font-weight: 600;">Your Download Code</h2>
                <p style="color: #cccccc; line-height: 1.7; margin: 0 0 24px 0; font-size: 15px;">
                  Thank you for believing in privacy! Your support means the world to us, and we won't forget it. Use the code below to download the app:
                </p>

                <!-- Code Box -->
                <div style="background-color: #0a0a12; border: 2px solid #00d4ff; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                  <code style="font-size: 36px; font-weight: bold; color: #00ffcc; letter-spacing: 6px; font-family: 'Courier New', monospace;">${code}</code>
                </div>

                <p style="color: #999999; font-size: 14px; margin: 0 0 24px 0; text-align: center;">
                  This code expires in 30 days and can be used multiple times.
                </p>

                <!-- CTA Button -->
                <div style="text-align: center;">
                  <a href="https://zsend.xyz/#download" style="display: inline-block; background-color: #00d4ff; color: #000000; font-weight: 700; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
                    Download ZCHAT
                  </a>
                </div>
              </div>

              <!-- Instructions -->
              <div style="margin-top: 32px; padding: 24px; background-color: #12121a; border: 1px solid #333; border-radius: 12px;">
                <h3 style="color: #00d4ff; font-size: 16px; margin: 0 0 16px 0; font-weight: 600;">How to download:</h3>
                <ol style="color: #b0b0b0; margin: 0; padding-left: 24px; line-height: 2;">
                  <li>Visit <a href="https://zsend.xyz" style="color: #00d4ff; text-decoration: underline;">zsend.xyz</a></li>
                  <li>Click "I have a download code"</li>
                  <li>Enter your code: <strong style="color: #00ffcc;">${code}</strong></li>
                  <li>Install the APK on your Android device</li>
                </ol>
              </div>

              <!-- Footer -->
              <div style="margin-top: 40px; text-align: center; border-top: 1px solid #333; padding-top: 24px;">
                <p style="color: #666666; font-size: 12px; margin: 0; line-height: 1.8;">
                  ZCHAT - The most private messenger in the world<br>
                  <a href="https://zsend.xyz" style="color: #00d4ff;">zsend.xyz</a> |
                  <a href="https://x.com/zchat_app" style="color: #00d4ff;">@zchat_app</a>
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

      server.log.info({ email: entry.email, codePrefix: code.substring(0, 2) + '***' }, 'Download code email sent');

      return {
        success: true,
        message: `Email sent to ${entry.email}`,
        emailId: data?.id,
      };
    } catch (error) {
      server.log.error({ error: getErrorMessage(error) }, 'Failed to send email');
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

    // Check if expired (codes can be reused for re-downloads)
    if (new Date() > downloadCode.expiresAt) {
      reply.code(400);
      return { error: 'This download code has expired. Please request a new code.' };
    }

    // Check token limit to prevent memory exhaustion (#R3-M4)
    if (downloadTokens.size >= MAX_DOWNLOAD_TOKENS) {
      reply.code(503);
      return { error: 'Service temporarily unavailable. Please try again later.' };
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

    server.log.info({ codePrefix: code.substring(0, 2) + '***', email: downloadCode.whitelist.email }, 'Download code verified');

    return {
      success: true,
      downloadUrl: `/download/apk/${token}`,
      message: 'Your download is ready! Click the link to download the APK.',
    };
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to verify download code');
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

    // Find the latest APK file (async to avoid blocking event loop)
    const fsPromises = fs.promises;
    const allFiles = await fsPromises.readdir(APK_DIR);
    const apkFilesUnsorted = allFiles.filter(file => file.endsWith('.apk') && file.includes('zchat'));

    if (apkFilesUnsorted.length === 0) {
      reply.code(404);
      return { error: 'APK file not found. Please contact support.' };
    }

    // Get file stats for sorting by modification time
    const filesWithStats = await Promise.all(
      apkFilesUnsorted.map(async (file) => {
        const stat = await fsPromises.stat(path.join(APK_DIR, file));
        return { file, mtime: stat.mtime.getTime() };
      })
    );

    // Sort by modification time (newest first)
    filesWithStats.sort((a, b) => b.mtime - a.mtime);

    const apkPath = path.join(APK_DIR, filesWithStats[0].file);
    const apkName = filesWithStats[0].file;

    server.log.info({ apkName, whitelistId: tokenData.whitelistId }, 'APK download started');

    // Send the file
    reply.header('Content-Disposition', `attachment; filename="${apkName}"`);
    reply.header('Content-Type', 'application/vnd.android.package-archive');

    const stream = fs.createReadStream(apkPath);
    return reply.send(stream);
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to serve APK');
    reply.code(500);
    return { error: 'Failed to download APK' };
  }
});

// Register a new user
server.post<{ Body: { username: string; password: string } }>('/auth/register', async (request, reply) => {
  const { username, password } = request.body || {};

  // Input validation
  if (!username || typeof username !== 'string') {
    reply.code(400);
    return { error: 'Username is required' };
  }

  if (!password || typeof password !== 'string') {
    reply.code(400);
    return { error: 'Password is required' };
  }

  // Username validation: 3-30 chars, alphanumeric and underscores only
  if (username.length < 3 || username.length > 30) {
    reply.code(400);
    return { error: 'Username must be between 3 and 30 characters' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    reply.code(400);
    return { error: 'Username can only contain letters, numbers, and underscores' };
  }

  // Password validation: 8-72 characters (bcrypt truncates at 72 bytes - #R3-H2)
  if (password.length < 8) {
    reply.code(400);
    return { error: 'Password must be at least 8 characters' };
  }
  if (password.length > 72) {
    reply.code(400);
    return { error: 'Password must be at most 72 characters' };
  }

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
  } catch (error) {
    // Check if error is due to unique constraint violation
    if (
      error && typeof error === 'object' &&
      'code' in error && (error as { code: string }).code === 'P2002' &&
      'meta' in error && ((error as { meta?: { target?: string[] } }).meta?.target?.includes('username'))
    ) {
      reply.code(400);
      return { error: 'Username already taken' };
    }

    // Re-throw other errors
    throw error;
  }
});

// Login route
server.post<{ Body: { username: string; password: string } }>('/auth/login', async (request, reply) => {
  const { username, password } = request.body || {};

  // Input validation
  if (!username || typeof username !== 'string') {
    reply.code(400);
    return { error: 'Username is required' };
  }

  if (!password || typeof password !== 'string') {
    reply.code(400);
    return { error: 'Password is required' };
  }

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
    jwtSecret,
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

// REMOVED: /me/wallet endpoint that received mnemonic from client
// Security: Seed phrase should NEVER be sent over the network
// The backend now only stores public addresses, never seeds
// See ISSUES_TO_FIX.md CRITICAL #B1 for details

// Link wallet address to user (address only, no mnemonic)
server.post<{ Body: { address: string } }>('/me/wallet', async (request, reply) => {
  await authenticate(request, reply);

  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }

  const { address } = request.body;

  if (!address || typeof address !== 'string') {
    reply.code(400);
    return { error: 'address is required and must be a string' };
  }

  // Zcash unified address validation (#R3-M3)
  // - Must start with 'u1'
  // - Length: typically 141+ chars for mainnet unified addresses
  // - Only alphanumeric characters (no +, /, = like base64)
  if (!address.startsWith('u1')) {
    reply.code(400);
    return { error: 'Invalid Zcash unified address format (must start with u1)' };
  }
  if (address.length < 100 || address.length > 500) {
    reply.code(400);
    return { error: 'Invalid Zcash unified address length' };
  }
  if (!/^[a-zA-Z0-9]+$/.test(address)) {
    reply.code(400);
    return { error: 'Invalid Zcash unified address characters' };
  }

  try {
    // Update the user's primaryAddress in the database (no wallet import)
    const updatedUser = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        primaryAddress: address,
      },
      select: {
        id: true,
        username: true,
        primaryAddress: true,
      },
    });

    return updatedUser;
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to link wallet address');
    reply.code(500);
    return { error: getErrorMessage(error) || 'Failed to link wallet address' };
  }
});

// Get all users - ADMIN ONLY to prevent user enumeration
server.get('/users', async (request, reply) => {
  await authenticateAdmin(request, reply);

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
async function callZcashRPC<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  if (!ZCASH_RPC_URL) {
    throw new Error('ZCASH_RPC_URL is not configured');
  }

  const rpcRequest = {
    jsonrpc: '2.0',
    id: 'zcash-chat',
    method,
    params,
  };

  // Add timeout to prevent hanging (30 seconds for blockchain operations)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(ZCASH_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpcRequest),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

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

  // Validate hex format and length
  // Max 100KB hex = 50KB raw transaction (Zcash txs are typically 2-10KB)
  const MAX_TX_HEX_LENGTH = 200000;
  if (txHex.length > MAX_TX_HEX_LENGTH) {
    reply.code(400);
    return { error: `txHex exceeds maximum length of ${MAX_TX_HEX_LENGTH} characters` };
  }

  if (!/^[0-9a-fA-F]+$/.test(txHex)) {
    reply.code(400);
    return { error: 'txHex must be a valid hexadecimal string' };
  }

  try {
    // Call Zcash sendrawtransaction via GetBlock.io
    const txid = await callZcashRPC<string>('sendrawtransaction', [txHex]);

    // Return the transaction ID
    return { txid };
  } catch (error) {
    // Log the error for debugging
    const errorMsg = getErrorMessage(error);
    server.log.error({ error: errorMsg }, 'Failed to broadcast transaction');

    // Return error response
    reply.code(500);
    return { error: errorMsg || 'Failed to broadcast transaction' };
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
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to fetch Zcash network info');
    reply.code(500);
    return { error: getErrorMessage(error) || 'Failed to fetch Zcash network info' };
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
    const address = await getPrimaryAddress(walletDbPath);
    return { address };
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to get wallet address');
    reply.code(500);
    return { error: getErrorMessage(error) || 'Failed to get wallet address' };
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
    const balance = await getBalance(walletDbPath);
    return { balance_zatoshis: balance };
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to get wallet balance');
    reply.code(500);
    return { error: getErrorMessage(error) || 'Failed to get wallet balance' };
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
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to sync wallet');
    reply.code(500);
    return { error: getErrorMessage(error) || 'Failed to sync wallet' };
  }
});

server.get<{ Querystring: { sinceHeight?: string } }>('/messages', async (request, reply) => {
  await authenticate(request, reply);
  if (!request.user) {
    reply.code(401);
    return { error: 'Unauthorized' };
  }
  try {
    const walletDbPath = getUserWalletDbPath(request.user.id);
    const sinceHeight = request.query.sinceHeight
      ? parseInt(request.query.sinceHeight, 10)
      : undefined;
    const result = await getMessages(walletDbPath, sinceHeight);
    return result;
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to get messages');
    reply.code(500);
    return { error: getErrorMessage(error) || 'Failed to get messages' };
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

  // Max amount validation: 21 million ZEC = 2.1e15 zatoshis (#R3-H4)
  // Use Number.MAX_SAFE_INTEGER as upper bound for safety
  const MAX_ZATOSHIS = 2_100_000_000_000_000; // 21 million ZEC
  if (amount > MAX_ZATOSHIS || !Number.isInteger(amount)) {
    reply.code(400);
    return { error: 'amount must be a valid integer within Zcash supply limits' };
  }

  if (typeof memo !== 'string') {
    reply.code(400);
    return { error: 'memo must be a string' };
  }

  try {
    // Step 1: Build the transaction using wallet-core with per-user wallet
    const walletDbPath = getUserWalletDbPath(request.user.id);
    const { txHex, txid } = await buildTransaction(walletDbPath, to, amount, memo);

    // Step 2: Broadcast the transaction
    // We'll call the existing broadcast endpoint logic
    const broadcastTxid = await callZcashRPC<string>('sendrawtransaction', [txHex]);

    // Return the transaction ID
    return { txid: broadcastTxid || txid };
  } catch (error) {
    // Log the error for debugging
    const errorMsg = getErrorMessage(error);
    server.log.error({ error: errorMsg }, 'Failed to send transaction');

    // Return error response
    reply.code(500);
    return { error: errorMsg || 'Failed to send transaction' };
  }
});

// =====================
// CONTACT FORM ENDPOINT
// =====================

/**
 * Submit a contact form message
 *
 * POST /contact
 * Body: { name: string, email: string, message: string }
 *
 * Public endpoint - no auth required
 */
server.post<{ Body: { name: string; email: string; message: string } }>('/contact', async (request, reply) => {
  const { name, email, message } = request.body;

  // Validate name
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    reply.code(400);
    return { error: 'Name is required (at least 2 characters)' };
  }
  if (name.length > 100) {
    reply.code(400);
    return { error: 'Name is too long (max 100 characters)' };
  }

  // Validate email
  if (!email || typeof email !== 'string') {
    reply.code(400);
    return { error: 'Email is required' };
  }
  if (email.length > 254) {
    reply.code(400);
    return { error: 'Email is too long (max 254 characters)' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    reply.code(400);
    return { error: 'Invalid email format' };
  }

  // Validate message
  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    reply.code(400);
    return { error: 'Message is required (at least 10 characters)' };
  }
  if (message.length > 5000) {
    reply.code(400);
    return { error: 'Message is too long (max 5000 characters)' };
  }

  try {
    // Store in database
    const submission = await prisma.contactSubmission.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        message: message.trim(),
      },
    });

    server.log.info({ id: submission.id, email: email.toLowerCase().trim() }, 'New contact form submission');

    // Send email notification (non-blocking)
    const CONTACT_NOTIFICATION_EMAIL = process.env.CONTACT_NOTIFICATION_EMAIL || 'btcpresent@gmail.com';

    if (resend) {
      const safeName = escapeHtml(name.trim());
      const safeEmail = escapeHtml(email.toLowerCase().trim());
      const safeMessage = escapeHtml(message.trim());
      const timestamp = new Date().toISOString();

      resend.emails.send({
        from: 'ZCHAT Contact <noreply@zsend.xyz>',
        to: CONTACT_NOTIFICATION_EMAIL,
        replyTo: email.toLowerCase().trim(),
        subject: `📬 New Contact Form: ${safeName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #050510; color: #fff;">
            <h2 style="color: #22d3ee; margin-bottom: 20px;">New Contact Form Submission</h2>

            <div style="background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
              <p style="margin: 0 0 12px 0;"><strong style="color: #22d3ee;">Name:</strong> ${safeName}</p>
              <p style="margin: 0 0 12px 0;"><strong style="color: #22d3ee;">Email:</strong> <a href="mailto:${safeEmail}" style="color: #22d3ee;">${safeEmail}</a></p>
              <p style="margin: 0;"><strong style="color: #22d3ee;">Time:</strong> ${timestamp}</p>
            </div>

            <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px;">
              <h3 style="color: #22d3ee; margin: 0 0 12px 0;">Message:</h3>
              <p style="color: #d1d5db; line-height: 1.6; white-space: pre-wrap; margin: 0;">${safeMessage}</p>
            </div>

            <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 24px 0;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              Reply directly to this email to respond to ${safeName}.
            </p>
          </div>
        `,
      }).catch(err => {
        server.log.error({ err }, 'Failed to send contact notification email');
      });
    }

    return {
      success: true,
      message: 'Thank you for your message! We will get back to you soon.',
    };
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to submit contact form');
    reply.code(500);
    return { error: 'Failed to submit your message. Please try again.' };
  }
});

/**
 * List all contact submissions (admin only)
 *
 * GET /admin/contacts
 * Headers: X-Admin-Secret: <admin_secret>
 */
server.get('/admin/contacts', async (request, reply) => {
  await authenticateAdmin(request, reply);

  try {
    const submissions = await prisma.contactSubmission.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return { submissions };
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to fetch contact submissions');
    reply.code(500);
    return { error: 'Failed to fetch contact submissions' };
  }
});

/**
 * Mark a contact submission as read (admin only)
 *
 * POST /admin/contacts/:id/read
 * Headers: X-Admin-Secret: <admin_secret>
 */
server.post<{ Params: { id: string } }>('/admin/contacts/:id/read', async (request, reply) => {
  await authenticateAdmin(request, reply);

  const id = parseInt(request.params.id, 10);
  if (isNaN(id)) {
    reply.code(400);
    return { error: 'Invalid submission ID' };
  }

  try {
    const submission = await prisma.contactSubmission.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return { success: true, submission };
  } catch (error) {
    server.log.error({ error: getErrorMessage(error) }, 'Failed to mark submission as read');
    reply.code(500);
    return { error: 'Failed to mark submission as read' };
  }
});

// Export server for testing
export { server, prisma, jwtSecret, adminSecret };

// Graceful shutdown handlers (LOW #B2)
const gracefulShutdown = async (signal: string) => {
  server.log.info({ signal }, 'Received shutdown signal, closing gracefully...');

  try {
    // Close Fastify server (stops accepting new connections)
    await server.close();
    server.log.info('HTTP server closed');

    // Disconnect Prisma (check if method exists for test compatibility)
    if (typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
      server.log.info('Database disconnected');
    }

    process.exit(0);
  } catch (err) {
    server.log.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const start = async () => {
  try {
    await server.listen({ port: 4000 });
    server.log.info('Server listening on port 4000'); // #R3-L1: Use server.log for consistency
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Only start server if this is the main module (not imported for testing)
if (require.main === module) {
  start();
}

