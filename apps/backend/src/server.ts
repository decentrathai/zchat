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

// Detects the AiAccount balance CHECK-constraint violation used by the credit-reservation
// concurrency guard. A CHECK violation on a typed `.update()` surfaces as
// PrismaClientUnknownRequestError with `code === undefined` (so getPrismaErrorCode never sees
// 'P2010' — that's the RAW-query code), but the engine embeds the Postgres SQLSTATE 23514 and the
// constraint name in the message. Match on those stable tokens rather than a loose substring.
function isBalanceCheckViolation(error: unknown): boolean {
  const s = String(error);
  return /\b23514\b/.test(s) || s.includes('AiAccount_balanceMicroUsd_nonneg_check');
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
import { syncWallet, sendTransaction, getMessages, getUserWalletDbPath, ensureWalletDbDir, getPrimaryAddress, getBalance, buildTransaction, verifyDepositOnChain } from './wallet';

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
  // Log without exposing path (console.warn runs before server init)
  console.warn('Warning: APK_DIR does not exist');
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
  // SECURITY (HIGH #B1-proxy): the API is reachable only through the Cloudflare tunnel,
  // which connects to the origin from the loopback address. Without trustProxy, request.ip
  // resolves to 127.0.0.1 for EVERY external request, collapsing all internet traffic into a
  // single rate-limit bucket (any one client trips the global 100/min limiter for everyone =
  // DoS) and making the per-IP register limiter a global cap. Trusting the loopback hop lets
  // Fastify derive the real client IP from X-Forwarded-For so the limiters key per-client.
  // NOTE: cloudflared must be configured to forward X-Forwarded-For (or the limiters should
  // additionally consult the Cf-Connecting-Ip header) for this to reflect the true client.
  trustProxy: '127.0.0.1',
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
// Note: server.register returns a promise. Without await, plugin registration order
// is enforced by Fastify's internal lifecycle (avvio), so this still loads before
// .listen(). Logging confirms when the plugin is ready.
Promise.resolve(
  server.register(rateLimit, {
    max: 100, // Max 100 requests per window
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return request.ip || 'unknown';
    },
  })
).then(() => {
  server.log.info('rate-limit plugin registered');
}).catch((err: unknown) => {
  server.log.error({ err: String(err) }, 'rate-limit plugin FAILED to register');
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

    // Read changelog if available and version matches
    let changelog: Array<{ type: string; text: string }> = [];
    try {
      const changelogPath = path.join(APK_DIR, 'changelog.json');
      const changelogData = JSON.parse(await fsPromises.readFile(changelogPath, 'utf-8'));
      if (changelogData.version === versionName && Array.isArray(changelogData.changes)) {
        changelog = changelogData.changes;
      }
    } catch {
      // changelog.json missing or invalid — return empty array
    }

    return { versionCode, versionName, downloadUrl: 'https://api.zsend.xyz/app/download', changelog };
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
        return { error: 'Failed to send email. Please try again later.' };
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
    return { error: 'Failed to link wallet address' };
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
    return { error: 'Failed to broadcast transaction' };
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
    return { error: 'Failed to fetch Zcash network info' };
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
    return { error: 'Failed to get wallet address' };
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
    return { error: 'Failed to get wallet balance' };
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
    return { error: 'Failed to sync wallet' };
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
    return { error: 'Failed to get messages' };
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

  // Validate Zcash address format (unified, sapling, or transparent)
  const isValidZcashAddress = /^(u1[a-z0-9]{100,}|zs1[a-z0-9]{70,}|t1[a-zA-Z0-9]{33})$/i.test(to);
  if (!isValidZcashAddress) {
    reply.code(400);
    return { error: 'Invalid Zcash address format' };
  }

  if (typeof amount !== 'number' || amount <= 0) {
    reply.code(400);
    return { error: 'amount is required and must be a positive number (in zatoshis)' };
  }

  // Max amount validation: 21 million ZEC = 2.1e15 zatoshis (#R3-H4)
  const MAX_ZATOSHIS = 2_100_000_000_000_000; // 21 million ZEC
  if (amount > MAX_ZATOSHIS || !Number.isInteger(amount)) {
    reply.code(400);
    return { error: 'amount must be a valid integer within Zcash supply limits' };
  }

  if (typeof memo !== 'string') {
    reply.code(400);
    return { error: 'memo must be a string' };
  }

  // Memo size limit: 512 bytes max for Zcash shielded transactions
  if (Buffer.byteLength(memo, 'utf-8') > 512) {
    reply.code(400);
    return { error: 'memo exceeds 512 byte limit' };
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

    // Return generic error (don't leak internal details to client)
    reply.code(500);
    return { error: 'Failed to send transaction' };
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

// =====================
// AI / VENICE ROUTES (Phase 1)
// =====================
//
// Architecture:
//   Android app → POST /api/v1/ai/auth/register (no body) → receives bearer token
//   App stores token in EncryptedSharedPreferences; uses for all /ai/* calls
//   Backend proxies Venice API, debits user credit ledger on success
//
// Money model (BigInt micro-USD, 1 USD = 1_000_000 µUSD):
//   Venice raw cost (per request) → multiply by markup → debit user balance
//   Free trial: $0.20 (= 200_000 µUSD) on cheap models only
//
// Identity:
//   userId = cuid (random, server-issued)
//   tokenHash = sha256(bearer) stored; raw bearer never persisted
//   v2 will add wallet-signature binding for cross-device recovery
//
// Refunds: see /ai/admin/refund — manual only, per ToS click-through

const VENICE_BASE_URL = 'https://api.venice.ai/api/v1';
const VENICE_ADMIN_KEY = process.env.VENICE_ADMIN_KEY || '';
const VENICE_MARKUP = 1.15; // 15% margin on top of raw Venice cost
const FREE_TRIAL_MICRO_USD = 200_000n; // $0.20

// Cheap models eligible for $0.20 free trial — explicit whitelist
const FREE_TIER_MODELS = new Set([
  'venice-uncensored',
  'venice-uncensored-1-2',
  'qwen3-coder-480b-a35b-instruct-turbo',
  'qwen3-235b-a22b-instruct-2507',
  'llama-3.3-70b',
]);

// Cheap IMAGE models eligible for the $0.20 free trial — /ai/image mirrors /ai/chat's
// whitelist gating (#15: previously the image endpoint skipped the trial whitelist entirely,
// so a trial user could burn the $0.20 on expensive per-call image models).
// venice-sd35 is Venice's cheap SD3.5 model (~$0.01/image raw).
const FREE_TIER_IMAGE_MODELS = new Set([
  'venice-sd35',
]);

// Trial detection shared by /ai/chat, /ai/image and /ai/balance: the account received the
// free $0.20 AND has never had a real deposit credited — its balance is purely trial money.
async function isOnFreeTrial(account: { userId: string; freeTrialGranted: boolean }): Promise<boolean> {
  if (!account.freeTrialGranted) return false;
  const hasPaidTopup = await prisma.aiTopupDeposit.findFirst({
    where: { userId: account.userId, status: 'credited' },
    select: { id: true },
  });
  return hasPaidTopup === null;
}

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function microUsd(usd: number): bigint {
  // Round UP to nearest µUSD so we never under-charge
  return BigInt(Math.ceil(usd * 1_000_000));
}

async function authenticateAiUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ userId: string } | null> {
  const authHeader = request.headers['authorization'];
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    reply.code(401);
    reply.send({ error: 'Missing bearer token' });
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    reply.code(401);
    reply.send({ error: 'Empty bearer token' });
    return null;
  }
  const account = await prisma.aiAccount.findUnique({ where: { tokenHash: sha256Hex(token) } });
  if (!account) {
    reply.code(401);
    reply.send({ error: 'Invalid token' });
    return null;
  }
  return { userId: account.userId };
}

// POST /api/v1/ai/auth/register — issue a per-device bearer token + grant $0.20 free credits
//
// Optional body: { walletPubkey: <hex sha256 of wallet UA> }
//   - If walletPubkey is provided AND an AiAccount already exists for that pubkey, we re-mint
//     a new bearer token bound to the SAME userId and balance. This survives reinstalls and
//     prevents the $0.20-per-reinstall exploit.
//   - If walletPubkey is provided but no account exists, create one with the pubkey stored.
//   - If walletPubkey is absent, fall back to the legacy unbound-account flow (no rebinding).
//
// Free-trial behavior: granted exactly once per AiAccount (i.e. once per wallet when bound).
// On re-mint, the existing balance is returned unchanged — no new $0.20.
type RegisterBody = { walletPubkey?: string };
const PUBKEY_RE = /^[0-9a-fA-F]{64}$/;

// Explicit per-IP register rate limiter. Caps at 6 successful mints per hour per IP
// (each mint costs $0.20 of Venice budget). Failing requests still consume a slot so
// a botnet can't probe-then-retry. The state is in-memory; production behind a reverse
// proxy should look at X-Forwarded-For (currently NOT trusted — see trustProxy below).
const REGISTER_MAX_PER_WINDOW = 6;
const REGISTER_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const registerRateState = new Map<string, { count: number; resetAt: number }>();
function checkRegisterRate(ip: string): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const cur = registerRateState.get(ip);
  if (!cur || now >= cur.resetAt) {
    registerRateState.set(ip, { count: 1, resetAt: now + REGISTER_WINDOW_MS });
    return { allowed: true, remaining: REGISTER_MAX_PER_WINDOW - 1, resetMs: REGISTER_WINDOW_MS };
  }
  if (cur.count >= REGISTER_MAX_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetMs: cur.resetAt - now };
  }
  cur.count += 1;
  return { allowed: true, remaining: REGISTER_MAX_PER_WINDOW - cur.count, resetMs: cur.resetAt - now };
}
// Test seam — Vitest can reset state between cases by calling this.
export function __resetRegisterRateLimit(): void {
  registerRateState.clear();
  rebindRateState.clear();
}

// Per-pubkey rebind cooldown. Each successful rebind (or attempt) starts a 6h window
// during which the same pubkey can't rebind again. Narrows the TOFU takeover surface from
// "anytime" to "once per 6h" until full proof-of-possession lands.
const REBIND_WINDOW_MS = 6 * 60 * 60 * 1000;
const rebindRateState = new Map<string, { resetAt: number }>();
function checkRebindRate(pubkey: string): { allowed: boolean; resetMs: number } {
  const now = Date.now();
  const cur = rebindRateState.get(pubkey);
  if (!cur || now >= cur.resetAt) {
    rebindRateState.set(pubkey, { resetAt: now + REBIND_WINDOW_MS });
    return { allowed: true, resetMs: REBIND_WINDOW_MS };
  }
  return { allowed: false, resetMs: cur.resetAt - now };
}

server.post('/api/v1/ai/auth/register', async (request, reply) => {
  const ip = request.ip || 'unknown';
  const gate = checkRegisterRate(ip);
  reply.header('X-RateLimit-Limit', REGISTER_MAX_PER_WINDOW.toString());
  reply.header('X-RateLimit-Remaining', gate.remaining.toString());
  reply.header('X-RateLimit-Reset', Math.ceil(gate.resetMs / 1000).toString());
  if (!gate.allowed) {
    reply.code(429);
    return { error: 'Too many register attempts. Try again later.' };
  }
  const body = (request.body ?? {}) as RegisterBody;
  // Accept upper or lowercase hex but persist canonical lowercase so the @unique
  // constraint can't be tricked into creating two accounts for the same wallet.
  const rawPubkey = typeof body.walletPubkey === 'string' ? body.walletPubkey : null;
  const walletPubkey = rawPubkey && PUBKEY_RE.test(rawPubkey) ? rawPubkey.toLowerCase() : null;

  if (walletPubkey) {
    // Defense against the TOFU rebind attack (P0-2): the same pubkey may rebind at most
    // once every 6 hours. Anyone who's seen the victim's UA can still in principle rebind,
    // but their window is narrowed from "anytime" to "once per 6h" — and EVERY rebind
    // is logged so an admin can spot anomalies. Full proof-of-possession (Ed25519 challenge
    // signed by a wallet-derived key) requires Android crypto work and ships in P0-2b.
    const rebindCheck = checkRebindRate(walletPubkey);
    if (!rebindCheck.allowed) {
      reply.code(429);
      return {
        error: 'Rebind cooldown: this wallet has rebound recently. Try again later.',
        retryAfterSeconds: Math.ceil(rebindCheck.resetMs / 1000),
      };
    }
    const existing = await prisma.aiAccount.findUnique({ where: { pubkey: walletPubkey } });
    if (existing) {
      server.log.warn(
        {
          userId: existing.userId,
          pubkeyPrefix: walletPubkey.slice(0, 12),
          requestIp: ip,
          balanceMicroUsd: existing.balanceMicroUsd.toString(),
        },
        'pubkey rebind issued — old bearer invalidated',
      );
      // Rotate token: a fresh bearer is issued, the old one is invalidated by replacing tokenHash.
      const tokenRaw = crypto.randomBytes(32).toString('base64url');
      const updated = await prisma.aiAccount.update({
        where: { userId: existing.userId },
        data: { tokenHash: sha256Hex(tokenRaw) },
      });
      // SECURITY: do NOT echo the balance here — the pubkey is derived from the (publicly shared)
      // unified address, so until proof-of-possession (P0-2b: a challenge signed by a wallet-derived
      // key) gates this path, the response must not be a balance oracle. The legit client reads its
      // balance via GET /ai/balance with the new token. NOTE: this path still allows an address-knower
      // to rebind (rate-limited to once/6h + logged); fully closing it requires the PoP challenge.
      return {
        userId: updated.userId,
        token: tokenRaw,
        freeTrialCreditUsd: 0,
        rebound: true,
      };
    }
  }

  const tokenRaw = crypto.randomBytes(32).toString('base64url');
  const userId = crypto.randomBytes(16).toString('hex');
  await prisma.aiAccount.create({
    data: {
      userId,
      tokenHash: sha256Hex(tokenRaw),
      balanceMicroUsd: FREE_TRIAL_MICRO_USD,
      freeTrialGranted: true,
      pubkey: walletPubkey,
    },
  });
  return {
    userId,
    token: tokenRaw,
    freeTrialCreditUsd: 0.2,
    balanceMicroUsd: FREE_TRIAL_MICRO_USD.toString(),
    rebound: false,
  };
});

// GET /api/v1/ai/balance — user's current credit + free-trial status
server.get('/api/v1/ai/balance', async (request, reply) => {
  const auth = await authenticateAiUser(request, reply);
  if (!auth) return;
  const account = await prisma.aiAccount.findUnique({ where: { userId: auth.userId } });
  if (!account) {
    reply.code(404);
    return { error: 'Account not found' };
  }
  return {
    userId: account.userId,
    balanceMicroUsd: account.balanceMicroUsd.toString(),
    balanceUsd: Number(account.balanceMicroUsd) / 1_000_000,
    freeTrialAvailable: !account.freeTrialGranted,
    freeTrialUsd: 0.2,
    // #12: per-user trial state so the client can grey out trial-locked models upfront
    // (pair with zchat_trial_eligible from /ai/models).
    onFreeTrial: await isOnFreeTrial(account),
  };
});

// GET /api/v1/ai/models — Venice catalog augmented with our marked-up pricing
// Each model in the response gets a `zchat_pricing` field containing the price
// the user actually pays (Venice cost × VENICE_MARKUP). Venice's own fields are
// preserved so client display logic that already understands Venice's shape
// keeps working.
//
// Cached server-side for 24h to avoid hammering Venice on every tab open.
const MODELS_CACHE_TTL_MS = 24 * 3600 * 1000;

// Venice serves TEXT models at /models and IMAGE models at /models?type=image. Each carries
// native pricing in model_spec.pricing. We load BOTH, normalize the prices, and cache:
//   - `pricing`: modelId → raw Venice cost, so ANY catalog model is chargeable even without a
//                hand-seeded AiModelPricing row (root fix for "model not available / not configured").
//   - `modelsJson`: the merged catalog augmented with zchat_pricing (marked up) + zchat_model_type,
//                   so the client can list AND filter text vs image models.
type CatalogPricing = {
  inputPer1mUsd: number; // raw Venice $/1M input tokens (text models)
  outputPer1mUsd: number; // raw Venice $/1M output tokens (text models)
  imagePerCallUsd: number | null; // raw Venice $/image (image models)
  isImage: boolean;
};
let veniceCatalogCache: { pricing: Map<string, CatalogPricing>; modelsJson: string } | null = null;
let veniceCatalogAt = 0;

// Extract a per-image USD cost from Venice's image pricing, which is either
// { generation: { usd } } or resolution-tiered { resolutions: { '1K': { usd }, ... } }.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function veniceImagePerCallUsd(pricing: any): number | null {
  if (!pricing || typeof pricing !== 'object') return null;
  if (typeof pricing.generation?.usd === 'number') return pricing.generation.usd;
  const res = pricing.resolutions;
  if (res && typeof res === 'object') {
    if (typeof res['1K']?.usd === 'number') return res['1K'].usd; // app sends ~1024px
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vals = Object.values(res).map((r: any) => r?.usd).filter((v): v is number => typeof v === 'number');
    if (vals.length) return Math.min(...vals);
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchVeniceModelList(url: string): Promise<Array<Record<string, any>>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (VENICE_ADMIN_KEY) headers.Authorization = `Bearer ${VENICE_ADMIN_KEY}`;
  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!resp.ok) throw new Error(`Venice ${url} returned ${resp.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = JSON.parse(await resp.text()) as { data?: Array<Record<string, any>> };
  return Array.isArray(parsed?.data) ? parsed.data : [];
}

async function loadVeniceCatalog(): Promise<{ pricing: Map<string, CatalogPricing>; modelsJson: string }> {
  const now = Date.now();
  if (veniceCatalogCache && now - veniceCatalogAt < MODELS_CACHE_TTL_MS) return veniceCatalogCache;
  const [textRaw, imageRaw] = await Promise.all([
    fetchVeniceModelList(`${VENICE_BASE_URL}/models`),
    fetchVeniceModelList(`${VENICE_BASE_URL}/models?type=image`).catch(() => []), // image is best-effort
  ]);
  const dbRows = await prisma.aiModelPricing.findMany();
  const dbById = new Map(dbRows.map((r) => [r.modelId, r]));
  const pricing = new Map<string, CatalogPricing>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const augment = (m: Record<string, any>, isImage: boolean) => {
    const id = typeof m.id === 'string' ? m.id : null;
    if (!id) return;
    const vp = m.model_spec?.pricing;
    const cat: CatalogPricing = isImage
      ? { inputPer1mUsd: 0, outputPer1mUsd: 0, imagePerCallUsd: veniceImagePerCallUsd(vp), isImage: true }
      : {
          inputPer1mUsd: Number(vp?.input?.usd ?? 0),
          outputPer1mUsd: Number(vp?.output?.usd ?? 0),
          imagePerCallUsd: null,
          isImage: false,
        };
    pricing.set(id, cat);
    m.zchat_model_type = isImage ? 'image' : 'text';
    // Surface the uncensored signal so the client can badge models. Venice marks its most permissive
    // models with the `most_uncensored` trait (e.g. lustify-v7/v8 for images, venice-uncensored for
    // text). This is the model that actually produces explicit output once safe_mode is off.
    const traits: unknown = m.model_spec?.traits;
    m.zchat_uncensored = Array.isArray(traits) && traits.some((t) => String(t).toLowerCase().includes('uncensored'));
    const db = dbById.get(id);
    // Trial-gating visibility (#12/#15): per-model flag so the client can render trial-locked
    // models upfront (pair with `onFreeTrial` from /ai/balance) instead of failing at send time.
    // The whitelists are static globals — safe to bake into the shared 24h cache. Image models
    // additionally honor the isFreeTier ($0-charge) exemption, matching the /ai/image gate.
    m.zchat_trial_eligible = isImage
      ? FREE_TIER_IMAGE_MODELS.has(id) || db?.isFreeTier === true
      : FREE_TIER_MODELS.has(id);
    // Display pricing: prefer a hand-seeded row (authoritative), else the live catalog. Marked up.
    // Only attach zchat_pricing when a REAL price exists, so the client can hide/disable any model
    // Venice lists without usable pricing (it would otherwise 400 at the charge guard anyway).
    const hasRealPrice = db != null ||
      (isImage ? cat.imagePerCallUsd !== null : (cat.inputPer1mUsd > 0 || cat.outputPer1mUsd > 0));
    if (!hasRealPrice) return;
    const rawIn = db ? Number(db.inputPer1mUsd) : cat.inputPer1mUsd;
    const rawOut = db ? Number(db.outputPer1mUsd) : cat.outputPer1mUsd;
    const rawImg = db
      ? (db.imagePerCallUsd !== null ? Number(db.imagePerCallUsd) : cat.imagePerCallUsd)
      : cat.imagePerCallUsd;
    m.zchat_pricing = {
      inputPer1mUsd: rawIn * VENICE_MARKUP,
      outputPer1mUsd: rawOut * VENICE_MARKUP,
      imagePerCallUsd: rawImg !== null ? rawImg * VENICE_MARKUP : null,
      isFreeTier: db?.isFreeTier ?? false,
      markup: VENICE_MARKUP,
    };
  };
  for (const m of textRaw) augment(m, false);
  for (const m of imageRaw) augment(m, true);
  const result = {
    pricing,
    modelsJson: JSON.stringify({
      data: [...textRaw, ...imageRaw],
      // Top-level copies of the trial whitelists (#12) so the client can gate without
      // scanning every model's zchat_trial_eligible flag.
      zchat_free_tier_models: Array.from(FREE_TIER_MODELS),
      zchat_free_tier_image_models: Array.from(FREE_TIER_IMAGE_MODELS),
    }),
  };
  if (pricing.size > 0) {
    veniceCatalogCache = result;
    veniceCatalogAt = now;
  }
  return veniceCatalogCache ?? result;
}

// Effective pricing for a charge: hand-seeded AiModelPricing row (authoritative — sets isFreeTier
// and lets us override Venice), else the live Venice catalog so any model is usable by a paid user.
async function resolveModelPricing(modelId: string): Promise<{
  inputPer1mUsd: number;
  outputPer1mUsd: number;
  imagePerCallUsd: number | null;
  isFreeTier: boolean;
} | null> {
  const row = await prisma.aiModelPricing.findUnique({ where: { modelId } });
  if (row) {
    return {
      inputPer1mUsd: Number(row.inputPer1mUsd),
      outputPer1mUsd: Number(row.outputPer1mUsd),
      imagePerCallUsd: row.imagePerCallUsd !== null ? Number(row.imagePerCallUsd) : null,
      isFreeTier: row.isFreeTier,
    };
  }
  const cat = await loadVeniceCatalog().then((c) => c.pricing.get(modelId)).catch(() => null);
  if (!cat) return null;
  return {
    inputPer1mUsd: cat.inputPer1mUsd,
    outputPer1mUsd: cat.outputPer1mUsd,
    imagePerCallUsd: cat.imagePerCallUsd,
    isFreeTier: false, // catalog models aren't free-tier unless explicitly seeded
  };
}

server.get('/api/v1/ai/models', async (request, reply) => {
  const auth = await authenticateAiUser(request, reply);
  if (!auth) return;
  try {
    const { modelsJson } = await loadVeniceCatalog();
    reply.header('content-type', 'application/json; charset=utf-8');
    return modelsJson;
  } catch (err) {
    server.log.error({ err: getErrorMessage(err) }, 'Failed to fetch Venice catalog');
    reply.code(502);
    return { error: 'Upstream model fetch failed' };
  }
});

// Admin-only: flush the /models cache (use after AiModelPricing rows change)
server.post('/api/v1/ai/admin/flush-models-cache', async (request, reply) => {
  await authenticateAdmin(request, reply);
  veniceCatalogCache = null;
  veniceCatalogAt = 0;
  return { ok: true };
});

// GET /api/v1/ai/admin/venice-balance — Venice account health for ops monitoring.
// Calls Venice's rate-limits endpoint with our master key and surfaces the USD balance,
// per-epoch consumption cap, current period usage, and trailing 7d usage. Cron / external
// monitoring should hit this and alert when balanceUsd falls below a threshold so we top
// Venice up before users start seeing 402s.
server.get('/api/v1/ai/admin/venice-balance', async (request, reply) => {
  await authenticateAdmin(request, reply);
  if (!VENICE_ADMIN_KEY) {
    reply.code(503);
    return { error: 'Venice key not configured' };
  }
  try {
    const [rateLimitsRes, apiKeysRes] = await Promise.all([
      fetch(`${VENICE_BASE_URL}/api_keys/rate_limits`, {
        headers: { Authorization: `Bearer ${VENICE_ADMIN_KEY}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`${VENICE_BASE_URL}/api_keys`, {
        headers: { Authorization: `Bearer ${VENICE_ADMIN_KEY}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      }),
    ]);
    if (!rateLimitsRes.ok) {
      reply.code(502);
      return { error: `Venice rate_limits returned ${rateLimitsRes.status}` };
    }
    const rateLimitsBody = (await rateLimitsRes.json()) as {
      data?: { balances?: { USD?: number }; apiTier?: { id?: string }; nextEpochBegins?: string };
    };
    const balanceUsd = rateLimitsBody?.data?.balances?.USD ?? null;
    const apiTier = rateLimitsBody?.data?.apiTier?.id ?? null;
    const nextEpochBegins = rateLimitsBody?.data?.nextEpochBegins ?? null;

    let consumptionLimitUsd: number | null = null;
    let currentPeriodUsageUsd: number | null = null;
    let trailingSevenDayUsd: number | null = null;
    if (apiKeysRes.ok) {
      const apiKeysBody = (await apiKeysRes.json()) as {
        data?: Array<{
          consumptionLimits?: { usd?: number | null };
          currentPeriodUsage?: { usd?: string };
          usage?: { trailingSevenDays?: { usd?: string } };
        }>;
      };
      const us = apiKeysBody?.data?.[0];
      consumptionLimitUsd = us?.consumptionLimits?.usd ?? null;
      currentPeriodUsageUsd = us?.currentPeriodUsage?.usd ? Number(us.currentPeriodUsage.usd) : null;
      trailingSevenDayUsd = us?.usage?.trailingSevenDays?.usd ? Number(us.usage.trailingSevenDays.usd) : null;
    }

    return {
      balanceUsd,
      apiTier,
      nextEpochBegins,
      consumptionLimitUsd,
      currentPeriodUsageUsd,
      trailingSevenDayUsd,
      // Convenience flags for alerting
      lowBalance: balanceUsd !== null && balanceUsd < 5,
      criticalBalance: balanceUsd !== null && balanceUsd < 1,
    };
  } catch (err) {
    server.log.error({ err: getErrorMessage(err) }, 'Failed to fetch Venice balance');
    reply.code(502);
    return { error: 'Venice balance fetch failed' };
  }
});

// GET /api/v1/ai/topup/address — Returns the shielded address + memo for caller
// Memo encodes userId so the watcher can credit the right account.
// Also returns a ZEC/USD spot price (60s cache) so clients can compute the ZEC amount
// for each tier and embed it in a ZIP-321 URI for QR-code payment.
//
// Price source: NEAR Intents 1Click /v0/tokens. NEAR's published ZEC price is the live
// swap-engine quote (what users would actually achieve in a real swap), which matches
// what Zashi already uses for in-app swaps via NearApiProvider. Falls back to CoinGecko
// spot price if the NEAR endpoint is unreachable; falls back to the last cached value
// if both fail. The watcher uses the same source at credit time for consistency.
let zecUsdPriceCache: { usd: number; source: string; fetchedAt: number } | null = null;
const ZEC_USD_TTL_MS = 60_000;
const NEAR_TOKENS_URL = 'https://1click.chaindefuser.com/v0/tokens';
const COINGECKO_ZEC_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd';

// Sanity-bound the spot price. Mirrors the watcher's bounds — a poisoned upstream
// returning $1e9/ZEC would otherwise drive bogus QR amounts on /topup/address.
const MIN_ZEC_USD_PRICE = 0.01;
const MAX_ZEC_USD_PRICE = 100_000;
function isPlausibleZecUsdPrice(usd: unknown): usd is number {
  return typeof usd === 'number' && Number.isFinite(usd) && usd >= MIN_ZEC_USD_PRICE && usd <= MAX_ZEC_USD_PRICE;
}

// Fixed-point conversion mirroring apps/ai-topup-watcher/src/watcher.ts:238 so the backend can
// recompute the dollar value of an on-chain deposit independently of the caller's claim.
// 1 ZEC = 1e8 zatoshi; µUSD = zatoshi * (price * 1e8) / 1e10.
function zatoshiToMicroUsd(zatoshi: bigint, zecUsd: number): bigint {
  const priceE8 = BigInt(Math.round(zecUsd * 1e8));
  return (zatoshi * priceE8) / 10_000_000_000n;
}

async function fetchZecPriceFromNear(): Promise<number | null> {
  try {
    const res = await fetch(NEAR_TOKENS_URL, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (!Array.isArray(body)) return null;
    for (const t of body) {
      if (!t || typeof t !== 'object') continue;
      const sym = (t as { symbol?: unknown }).symbol;
      const price = (t as { price?: unknown }).price;
      if (typeof sym === 'string' && sym.toUpperCase() === 'ZEC' && isPlausibleZecUsdPrice(price)) {
        return price;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchZecPriceFromCoinGecko(): Promise<number | null> {
  try {
    const res = await fetch(COINGECKO_ZEC_URL, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { zcash?: { usd?: unknown } };
    const usd = j.zcash?.usd;
    return isPlausibleZecUsdPrice(usd) ? usd : null;
  } catch {
    return null;
  }
}

async function getCachedZecUsdPrice(): Promise<{ usd: number; source: string } | null> {
  const now = Date.now();
  if (zecUsdPriceCache && now - zecUsdPriceCache.fetchedAt < ZEC_USD_TTL_MS) {
    return { usd: zecUsdPriceCache.usd, source: zecUsdPriceCache.source };
  }
  // Prefer NEAR Intents (matches Zashi's swap engine).
  let usd = await fetchZecPriceFromNear();
  let source = 'near-intents';
  if (usd === null) {
    usd = await fetchZecPriceFromCoinGecko();
    source = 'coingecko';
  }
  if (usd === null) {
    return zecUsdPriceCache
      ? { usd: zecUsdPriceCache.usd, source: `${zecUsdPriceCache.source}-stale` }
      : null;
  }
  zecUsdPriceCache = { usd, source, fetchedAt: now };
  return { usd, source };
}

server.get('/api/v1/ai/topup/address', async (request, reply) => {
  const auth = await authenticateAiUser(request, reply);
  if (!auth) return;
  const topupZaddr = process.env.ZCHAT_AI_TOPUP_ZADDR || '';
  if (!topupZaddr) {
    reply.code(503);
    return { error: 'Top-up address not configured on this server yet' };
  }
  // Memo tag: "ai-topup:<userId>" — watcher matches incoming notes by prefix
  const memo = `ai-topup:${auth.userId}`;
  // Default tiers offered as buttons; clients may also send a custom USD amount.
  const tiers = [5, 10, 20, 100];
  const price = await getCachedZecUsdPrice();
  return {
    address: topupZaddr,
    memo,
    tiers,
    zecUsdPrice: price?.usd ?? null,
    zecUsdPriceSource: price?.source ?? null,
  };
});

// GET /api/v1/ai/topup/status — list of pending + recent deposits
server.get('/api/v1/ai/topup/status', async (request, reply) => {
  const auth = await authenticateAiUser(request, reply);
  if (!auth) return;
  const deposits = await prisma.aiTopupDeposit.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return {
    deposits: deposits.map((d) => ({
      id: d.id,
      zecTxId: d.zecTxId,
      zatoshi: d.zatoshi.toString(),
      microUsdCredited: d.microUsdCredited.toString(),
      usdCredited: Number(d.microUsdCredited) / 1_000_000,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
      creditedAt: d.creditedAt?.toISOString() ?? null,
    })),
  };
});

// POST /api/v1/ai/chat — proxy /chat/completions, debit user on success
// Body: { model, messages, max_tokens?, temperature?, stream? }
type ChatBody = {
  model?: string;
  messages?: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
};
server.post('/api/v1/ai/chat', async (request, reply) => {
  const auth = await authenticateAiUser(request, reply);
  if (!auth) return;
  if (!VENICE_ADMIN_KEY) {
    reply.code(503);
    return { error: 'Venice not configured' };
  }
  const body = request.body as ChatBody | undefined;
  const model = body?.model ?? 'venice-uncensored-1-2';
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    reply.code(400);
    return { error: 'messages required' };
  }
  // SECURITY: max_tokens drives the pre-flight cost estimate which is decremented from
  // the balance. A negative value would make the estimated charge negative, and a
  // `decrement` of a negative number INCREASES the balance (Postgres: bal - (-x) = bal + x),
  // letting any user mint free credit. Reject non-positive / non-integer before any math.
  const rawMaxTokens = body?.max_tokens;
  if (
    rawMaxTokens !== undefined &&
    (typeof rawMaxTokens !== 'number' || !Number.isInteger(rawMaxTokens) || rawMaxTokens < 1)
  ) {
    reply.code(400);
    return { error: 'max_tokens must be a positive integer' };
  }
  const maxTokens = Math.min(rawMaxTokens ?? 1024, 8192);

  const account = await prisma.aiAccount.findUnique({ where: { userId: auth.userId } });
  if (!account) {
    reply.code(404);
    return { error: 'Account not found' };
  }

  // Hard balance gate — the $0.20 was credited at registration; balance == 0 = top up.
  if (account.balanceMicroUsd <= 0n) {
    reply.code(402);
    return { error: 'Insufficient credit. Please top up.' };
  }

  // Lookup per-model pricing (seeded row, else derived from the live Venice catalog so any model works)
  const pricing = await resolveModelPricing(model);
  if (!pricing) {
    reply.code(400);
    return { error: `Model "${model}" not available or pricing not configured` };
  }

  // GUARD: image-only models can't be invoked through /ai/chat — they have zero token rates
  // and would either charge $0 or fail upstream with a confusing error. Force routing to /ai/image.
  if (Number(pricing.outputPer1mUsd) === 0 && pricing.imagePerCallUsd !== null) {
    reply.code(400);
    return { error: `Model "${model}" is image-only — use /api/v1/ai/image` };
  }

  // FREE-TIER GATING (user requirement): until the user has consumed ALL $0.20 and topped
  // up at least once, restrict to cheap whitelisted models (see isOnFreeTrial).
  // `code` lets the client distinguish "restricted model" from "broke" — both are 402s.
  const onFreeTrial = await isOnFreeTrial(account);
  if (onFreeTrial && !FREE_TIER_MODELS.has(model)) {
    reply.code(402);
    return {
      error: 'Free trial restricted to cheap models. Top up to unlock paid models.',
      code: 'trial_model_restricted',
      freeTierModels: Array.from(FREE_TIER_MODELS),
    };
  }

  // Pre-flight: estimate worst-case cost = (input tokens × inputPer1m) + (maxTokens out × outputPer1m).
  // Token count is approximated from character length — for most BPE tokenizers used by these models,
  // ~3 chars ≈ 1 token in English (Cyrillic, CJK and code can be denser). Using 3 keeps us conservative
  // (overestimates), so we never under-quote a user and end up in the negative after the call.
  const totalInputChars = messages.reduce(
    (acc, m) => acc + (typeof m.content === 'string' ? m.content.length : 0),
    0,
  );
  const estInputTokens = Math.ceil(totalInputChars / 3);
  // #221: a model flagged isFreeTier (shown as "Free" in the picker — the contract is "no charge")
  // must NOT debit the user; the master key absorbs Venice's cost. Reserve/charge 0 for it. Previously
  // the charge path ignored isFreeTier and debited the token rates, so a free-tier model with non-zero
  // seeded rates still charged (e.g. $0.0009), contradicting its own "Free" label.
  const isFree = pricing.isFreeTier === true;
  const estInputUsd = (estInputTokens / 1_000_000) * Number(pricing.inputPer1mUsd);
  const estOutputUsd = (maxTokens / 1_000_000) * Number(pricing.outputPer1mUsd);
  const estCostUsd = estInputUsd + estOutputUsd;
  const estChargeMicroUsd = isFree ? 0n : microUsd(estCostUsd * VENICE_MARKUP);
  // Defense-in-depth: a non-positive reservation must never reach the `decrement` below for a PAID
  // model — `max_tokens` is validated positive, but a misconfigured (negative) pricing row could still
  // produce a ≤0 charge which, decremented, would mint balance. A free-tier model legitimately
  // reserves 0, so this guard must not fire on it.
  if (!isFree && estChargeMicroUsd <= 0n) {
    reply.code(400);
    return { error: 'Computed charge is non-positive; request rejected.' };
  }
  if (estChargeMicroUsd > account.balanceMicroUsd) {
    reply.code(402);
    return {
      error: 'Estimated cost exceeds available balance. Top up or reduce prompt size or max_tokens.',
      estChargeMicroUsd: estChargeMicroUsd.toString(),
      estInputTokens,
      estOutputTokens: maxTokens,
      balanceMicroUsd: account.balanceMicroUsd.toString(),
    };
  }

  // Reserve the worst-case charge BEFORE we call Venice. The DB CHECK constraint
  // (AiAccount.balanceMicroUsd >= 0) catches concurrent /chat calls that would otherwise
  // race the in-memory balance gate above and drain the account negative. If the reservation
  // fails we never pay Venice, so the user sees a 402 instead of a free LLM call charged
  // to the master key.
  // Free-tier reserves 0 → skip the decrement entirely (no balance touched).
  if (estChargeMicroUsd > 0n) {
    try {
      await prisma.aiAccount.update({
        where: { userId: auth.userId },
        data: { balanceMicroUsd: { decrement: estChargeMicroUsd } },
      });
    } catch (err) {
      if (isBalanceCheckViolation(err)) {
        reply.code(402);
        return { error: 'Insufficient credit for this request. Concurrent calls may have drained the balance.' };
      }
      throw err;
    }
  }

  // Call Venice
  let venicePayload: { id?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: unknown[] };
  try {
    const upstream = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_ADMIN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: body?.temperature ?? 0.7,
        stream: false, // SSE streaming is Phase 1.1
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      // Venice rejected the call — refund the full reservation and record the failure.
      await prisma.$transaction([
        prisma.aiAccount.update({
          where: { userId: auth.userId },
          data: { balanceMicroUsd: { increment: estChargeMicroUsd } },
        }),
        prisma.aiUsageEvent.create({
          data: {
            userId: auth.userId,
            model,
            endpoint: 'chat',
            veniceCostMicroUsd: 0n,
            chargedMicroUsd: 0n,
            marginMicroUsd: 0n,
            success: false,
            errorCode: `HTTP_${upstream.status}`,
          },
        }),
      ]);
      reply.code(upstream.status === 429 ? 429 : 502);
      return { error: `Venice error (${upstream.status})`, detail: text.slice(0, 300) };
    }
    venicePayload = JSON.parse(text);
  } catch (err) {
    // Refund the reservation on a Venice connection failure too.
    await prisma.aiAccount.update({
      where: { userId: auth.userId },
      data: { balanceMicroUsd: { increment: estChargeMicroUsd } },
    }).catch(() => undefined);
    server.log.error({ err: getErrorMessage(err), model }, 'Venice chat upstream failed');
    reply.code(504);
    return { error: 'Venice upstream timeout/failure' };
  }

  // Compute actual cost from returned usage
  const inTok = venicePayload.usage?.prompt_tokens ?? 0;
  const outTok = venicePayload.usage?.completion_tokens ?? 0;
  const veniceCostUsd =
    (inTok / 1_000_000) * Number(pricing.inputPer1mUsd) +
    (outTok / 1_000_000) * Number(pricing.outputPer1mUsd);
  const veniceMicroUsd = microUsd(veniceCostUsd);
  // #221: free-tier charges the USER 0 (master key eats the Venice cost → negative margin, recorded
  // for accounting). Paid models charge cost × markup as before.
  const chargedMicroUsd = isFree ? 0n : microUsd(veniceCostUsd * VENICE_MARKUP);

  // Reconcile: the reservation already debited estChargeMicroUsd. If the actual charge
  // is lower (almost always — output tokens ≤ max), refund the diff. If higher (extremely
  // rare: Venice exceeds max_tokens), still cap at the reserved amount and accept the
  // margin loss rather than failing the request after we've already paid Venice.
  const reconcileDelta = estChargeMicroUsd - chargedMicroUsd; // ≥0 means refund
  const finalChargeMicroUsd = chargedMicroUsd > estChargeMicroUsd ? estChargeMicroUsd : chargedMicroUsd;
  const finalMarginMicroUsd = finalChargeMicroUsd - veniceMicroUsd;
  const after = await prisma.$transaction(async (tx) => {
    const updated =
      reconcileDelta > 0n
        ? await tx.aiAccount.update({
            where: { userId: auth.userId },
            data: { balanceMicroUsd: { increment: reconcileDelta } },
          })
        : await tx.aiAccount.findUniqueOrThrow({ where: { userId: auth.userId } });
    await tx.aiUsageEvent.create({
      data: {
        userId: auth.userId,
        model,
        endpoint: 'chat',
        inputTokens: inTok,
        outputTokens: outTok,
        veniceCostMicroUsd: veniceMicroUsd,
        chargedMicroUsd: finalChargeMicroUsd,
        marginMicroUsd: finalMarginMicroUsd,
        success: true,
        veniceRequestId: venicePayload.id ?? null,
      },
    });
    return updated;
  });

  return {
    ...venicePayload,
    zchat_meta: {
      chargedMicroUsd: finalChargeMicroUsd.toString(),
      chargedUsd: Number(finalChargeMicroUsd) / 1_000_000,
      balanceAfterMicroUsd: after.balanceMicroUsd.toString(),
      balanceAfterUsd: Number(after.balanceMicroUsd) / 1_000_000,
    },
  };
});

// POST /api/v1/ai/image — proxy Venice's NATIVE /image/generate, debit by per-image price.
// We use the native endpoint (not the OpenAI-compat /images/generations) because only the native
// endpoint exposes `safe_mode` and `hide_watermark`. The OpenAI-compat endpoint has
// additionalProperties:false (rejects safe_mode with a 400) and defaults to blurring adult content.
// Default safe_mode to FALSE so this "Private/Shielded AI" surface is genuinely uncensored; the
// client may still send safe_mode:true to opt into blurring. Native returns {images:[base64]} which
// we repackage into the OpenAI {data:[{b64_json}]} shape the Android client already parses.
type ImageBody = { model?: string; prompt?: string; n?: number; size?: string; safe_mode?: boolean };
server.post('/api/v1/ai/image', async (request, reply) => {
  const auth = await authenticateAiUser(request, reply);
  if (!auth) return;
  if (!VENICE_ADMIN_KEY) {
    reply.code(503);
    return { error: 'Venice not configured' };
  }
  const body = request.body as ImageBody | undefined;
  const model = body?.model ?? 'venice-sd35';
  const prompt = body?.prompt;
  // Validate `n` before the cost math: a non-numeric value (JSON allows strings) would make
  // Math.max('x', 1) = NaN → veniceCostUsd NaN → microUsd(NaN) throws an uncaught RangeError (500).
  const rawN = body?.n;
  if (rawN !== undefined && (typeof rawN !== 'number' || !Number.isFinite(rawN))) {
    reply.code(400);
    return { error: 'n must be a finite number' };
  }
  const n = Math.min(Math.max(rawN ?? 1, 1), 4);
  if (!prompt || typeof prompt !== 'string') {
    reply.code(400);
    return { error: 'prompt required' };
  }

  const account = await prisma.aiAccount.findUnique({ where: { userId: auth.userId } });
  if (!account) {
    reply.code(404);
    return { error: 'Account not found' };
  }
  const pricing = await resolveModelPricing(model);
  if (!pricing || !pricing.imagePerCallUsd) {
    reply.code(400);
    return { error: `Image model "${model}" not available or pricing not configured` };
  }
  // #221: free-tier image models charge the user 0 (master key absorbs Venice's cost) — honor the
  // "Free" contract here too, mirroring /ai/chat. A free-tier model is usable at $0 balance, so the
  // positive-balance gate applies only to PAID models.
  const isFree = pricing.isFreeTier === true;
  if (!isFree && account.balanceMicroUsd <= 0n) {
    reply.code(402);
    return { error: 'Insufficient credit. Please top up.' };
  }
  // FREE-TIER GATING (#15): mirror /ai/chat — a trial account must not burn its $0.20 on
  // expensive per-call image models. Whitelisted cheap image models stay available, and an
  // explicit isFreeTier model ($0-charge contract, #221) is exempt: it never touches the
  // user's balance, so blocking it for trial users would break its own "Free" label.
  const onFreeTrial = await isOnFreeTrial(account);
  if (onFreeTrial && !isFree && !FREE_TIER_IMAGE_MODELS.has(model)) {
    reply.code(402);
    return {
      error: 'Free trial restricted to cheap image models. Top up to unlock paid models.',
      code: 'trial_model_restricted',
      freeTierModels: Array.from(FREE_TIER_IMAGE_MODELS),
    };
  }
  const veniceCostUsd = Number(pricing.imagePerCallUsd) * n;
  const veniceMicroUsd = microUsd(veniceCostUsd);
  const chargedMicroUsd = isFree ? 0n : microUsd(veniceCostUsd * VENICE_MARKUP);
  // A PAID model that computes to $0 means broken/missing pricing — reject rather than serve free
  // (mirrors /ai/chat). Free-tier ($0 by contract) is allowed through.
  if (!isFree && chargedMicroUsd <= 0n) {
    reply.code(500);
    return { error: 'Pricing unavailable for this model.' };
  }
  if (chargedMicroUsd > account.balanceMicroUsd) {
    reply.code(402);
    // Structured fields let the client show a specific "$X balance, needs ~$Y" message.
    return {
      error: 'Insufficient credit for this image request.',
      estChargeMicroUsd: chargedMicroUsd.toString(),
      balanceMicroUsd: account.balanceMicroUsd.toString(),
    };
  }

  // Reserve the charge before calling Venice (matches /ai/chat — see comment there). Free-tier
  // reserves 0 → skip the decrement entirely.
  if (chargedMicroUsd > 0n) {
    try {
      await prisma.aiAccount.update({
        where: { userId: auth.userId },
        data: { balanceMicroUsd: { decrement: chargedMicroUsd } },
      });
    } catch (err) {
      if (isBalanceCheckViolation(err)) {
        reply.code(402);
        return { error: 'Insufficient credit for this image request. Concurrent calls may have drained the balance.' };
      }
      throw err;
    }
  }

  // Native /image/generate takes width/height (1–1280), not an OpenAI "WxH" size string. Parse and
  // clamp; fall back to 1024². `variants` (1–4) is the native equivalent of OpenAI `n`.
  const parseDim = (v: string | undefined, idx: number): number => {
    const parts = (v ?? '1024x1024').toLowerCase().split('x');
    const raw = Number(parts[idx]);
    if (!Number.isFinite(raw)) return 1024;
    return Math.min(Math.max(Math.round(raw), 1), 1280);
  };
  const width = parseDim(body?.size, 0);
  const height = parseDim(body?.size, 1);
  const safeMode = body?.safe_mode === true; // default false → uncensored
  try {
    const upstream = await fetch(`${VENICE_BASE_URL}/image/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VENICE_ADMIN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        width,
        height,
        variants: n,
        safe_mode: safeMode,
        hide_watermark: true,
        format: 'png',
        return_binary: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      // Refund the reservation on Venice failure.
      await prisma.$transaction([
        prisma.aiAccount.update({
          where: { userId: auth.userId },
          data: { balanceMicroUsd: { increment: chargedMicroUsd } },
        }),
        prisma.aiUsageEvent.create({
          data: {
            userId: auth.userId,
            model,
            endpoint: 'image',
            imageCount: n,
            veniceCostMicroUsd: 0n,
            chargedMicroUsd: 0n,
            marginMicroUsd: 0n,
            success: false,
            errorCode: `HTTP_${upstream.status}`,
          },
        }),
      ]);
      reply.code(upstream.status === 429 ? 429 : 502);
      return { error: `Venice error (${upstream.status})`, detail: text.slice(0, 300) };
    }
    // Native shape: { id, images: ["<base64>", ...], timing }. Repackage into the OpenAI-compatible
    // { created, data: [{ b64_json }] } shape the Android client parses.
    const native = JSON.parse(text) as { id?: string; images?: unknown };
    const images = Array.isArray(native.images) ? native.images.filter((x): x is string => typeof x === 'string') : [];
    const payload = {
      created: Math.floor(Date.now() / 1000),
      data: images.map((b64) => ({ b64_json: b64 })),
    };
    const after = await prisma.$transaction(async (tx) => {
      // Reservation already debited chargedMicroUsd; just look up the current row for the response.
      const updated = await tx.aiAccount.findUniqueOrThrow({
        where: { userId: auth.userId },
      });
      await tx.aiUsageEvent.create({
        data: {
          userId: auth.userId,
          model,
          endpoint: 'image',
          imageCount: n,
          veniceCostMicroUsd: veniceMicroUsd,
          chargedMicroUsd: chargedMicroUsd,
          marginMicroUsd: chargedMicroUsd - veniceMicroUsd,
          success: true,
        },
      });
      return updated;
    });
    return {
      ...payload,
      zchat_meta: {
        chargedMicroUsd: chargedMicroUsd.toString(),
        chargedUsd: Number(chargedMicroUsd) / 1_000_000,
        balanceAfterMicroUsd: after.balanceMicroUsd.toString(),
        balanceAfterUsd: Number(after.balanceMicroUsd) / 1_000_000,
      },
    };
  } catch (err) {
    // Refund the reservation on Venice connection failure.
    await prisma.aiAccount.update({
      where: { userId: auth.userId },
      data: { balanceMicroUsd: { increment: chargedMicroUsd } },
    }).catch(() => undefined);
    server.log.error({ err: getErrorMessage(err) }, 'Venice image upstream failed');
    reply.code(504);
    return { error: 'Venice upstream failure' };
  }
});

// POST /api/v1/ai/admin/credit — manual credit (admin-only, for ZEC top-ups or refunds)
// Body: { userId, microUsd, note? }
//
// Capped at $10,000 per call (10^10 µUSD). If the admin secret leaks and an attacker
// drives this endpoint, the per-call cap bounds damage; we still log every call.
const ADMIN_CREDIT_MAX_MICRO_USD = 10_000n * 1_000_000n; // 10^10 µUSD = $10,000
server.post('/api/v1/ai/admin/credit', async (request, reply) => {
  await authenticateAdmin(request, reply);
  const body = request.body as { userId?: string; microUsd?: string; note?: string } | undefined;
  if (!body?.userId || !body.microUsd) {
    reply.code(400);
    return { error: 'userId and microUsd required' };
  }
  let amount: bigint;
  try { amount = BigInt(body.microUsd); } catch { reply.code(400); return { error: 'Invalid microUsd' }; }
  if (amount <= 0n || amount > ADMIN_CREDIT_MAX_MICRO_USD) {
    reply.code(400);
    return { error: `microUsd must be 1..${ADMIN_CREDIT_MAX_MICRO_USD.toString()}` };
  }
  const account = await prisma.aiAccount.update({
    where: { userId: body.userId },
    data: { balanceMicroUsd: { increment: amount } },
  });
  server.log.info(
    { userId: body.userId, microUsd: amount.toString(), note: body.note ?? '' },
    'AI admin credit applied',
  );
  return {
    userId: account.userId,
    newBalanceMicroUsd: account.balanceMicroUsd.toString(),
    newBalanceUsd: Number(account.balanceMicroUsd) / 1_000_000,
  };
});

// POST /api/v1/ai/admin/credit-from-deposit — idempotent credit from on-chain ZEC deposit
// Called by the deposit watcher after it observes an incoming note with memo `ai-topup:<userId>`
// and waits for confirmation depth. Idempotent on zecTxId via @unique constraint.
// Body: { userId, zecTxId, zatoshi, zecUsdPrice, microUsd, note? }
server.post('/api/v1/ai/admin/credit-from-deposit', async (request, reply) => {
  await authenticateAdmin(request, reply);
  const body = request.body as {
    userId?: string;
    zecTxId?: string;
    zatoshi?: string;
    zecUsdPrice?: string;
    microUsd?: string;
    note?: string;
  } | undefined;
  if (!body?.userId || !body.zecTxId || !body.zatoshi || !body.zecUsdPrice || !body.microUsd) {
    reply.code(400);
    return { error: 'userId, zecTxId, zatoshi, zecUsdPrice, microUsd all required' };
  }
  // Rename local to avoid shadowing the module-level `microUsd(usd)` helper used elsewhere.
  let amountMicroUsd: bigint;
  let zatoshi: bigint;
  try {
    amountMicroUsd = BigInt(body.microUsd);
    zatoshi = BigInt(body.zatoshi);
  } catch {
    reply.code(400);
    return { error: 'Invalid bigint for microUsd or zatoshi' };
  }
  if (amountMicroUsd <= 0n || amountMicroUsd > ADMIN_CREDIT_MAX_MICRO_USD) {
    reply.code(400);
    return { error: `microUsd must be 1..${ADMIN_CREDIT_MAX_MICRO_USD.toString()}` };
  }
  if (zatoshi <= 0n) {
    reply.code(400);
    return { error: 'zatoshi must be > 0' };
  }
  const existing = await prisma.aiTopupDeposit.findUnique({ where: { zecTxId: body.zecTxId } });
  if (existing) {
    return {
      status: 'already-credited',
      depositId: existing.id,
      userId: existing.userId,
      microUsdCredited: existing.microUsdCredited.toString(),
    };
  }
  const account = await prisma.aiAccount.findUnique({ where: { userId: body.userId } });
  if (!account) {
    reply.code(404);
    return { error: `AiAccount not found for userId=${body.userId}` };
  }
  // On-chain re-verification — ON BY DEFAULT (#26) so admin-key holders can't fabricate
  // credits: the txid must actually exist in our watcher's wallet with the claimed memo
  // and zatoshi. Opt OUT only for hermetic unit tests / wallet-less local dev by setting
  // CREDIT_REQUIRE_ONCHAIN_VERIFY=0 explicitly — never in production.
  if (process.env.CREDIT_REQUIRE_ONCHAIN_VERIFY !== '0') {
    const walletDbPath = process.env.WALLET_DB_PATH;
    if (!walletDbPath) {
      reply.code(503);
      return { error: 'On-chain verification configured but WALLET_DB_PATH not set' };
    }
    const verifyErr = await verifyDepositOnChain({
      walletDbPath,
      zecTxId: body.zecTxId,
      expectedUserId: body.userId,
      expectedZatoshi: zatoshi,
    });
    if (verifyErr) {
      server.log.warn(
        { zecTxId: body.zecTxId, userId: body.userId, reason: verifyErr },
        'credit-from-deposit on-chain verification failed',
      );
      reply.code(403);
      return { error: `On-chain verification failed: ${verifyErr}` };
    }
    // SECURITY: on-chain verify confirms the txid/memo/zatoshi, but the *dollar* amount in the
    // body is otherwise unbound — an ADMIN_SECRET holder (or a buggy/compromised watcher) could
    // reference a genuine sub-$1 deposit and credit any µUSD up to the cap. Recompute the expected
    // µUSD from the verified zatoshi and a bounds-checked price, and bind the credit to it.
    const priceNum = Number(body.zecUsdPrice);
    if (!isPlausibleZecUsdPrice(priceNum)) {
      reply.code(400);
      return { error: 'zecUsdPrice out of plausible bounds' };
    }
    const expectedMicroUsd = zatoshiToMicroUsd(zatoshi, priceNum);
    const diff = amountMicroUsd > expectedMicroUsd ? amountMicroUsd - expectedMicroUsd : expectedMicroUsd - amountMicroUsd;
    // 1% tolerance for fixed-point rounding differences between watcher and server.
    if (expectedMicroUsd <= 0n || diff * 100n > expectedMicroUsd) {
      server.log.warn(
        { zecTxId: body.zecTxId, userId: body.userId, claimed: amountMicroUsd.toString(), expected: expectedMicroUsd.toString(), price: priceNum },
        'credit-from-deposit µUSD inconsistent with on-chain zatoshi',
      );
      reply.code(403);
      return {
        error: `microUsd ${amountMicroUsd} inconsistent with on-chain zatoshi ${zatoshi} at price ${priceNum} (expected ~${expectedMicroUsd})`,
      };
    }
    // Credit the server-computed value, never the caller's raw assertion.
    amountMicroUsd = expectedMicroUsd;
  }
  // Race: between the findUnique above and the transaction below, a concurrent watcher
  // request can sneak in with the same zecTxId. Catch the @unique violation (P2002) and
  // return already-credited so the watcher's retry sees a clean success.
  let deposit: { id: string; microUsdCredited: bigint };
  let updatedAccount: { userId: string; balanceMicroUsd: bigint };
  try {
    [deposit, updatedAccount] = await prisma.$transaction([
      prisma.aiTopupDeposit.create({
        data: {
          userId: body.userId,
          zecTxId: body.zecTxId,
          zatoshi,
          zecUsdPriceAtCredit: body.zecUsdPrice,
          microUsdCredited: amountMicroUsd,
          status: 'credited',
          creditedAt: new Date(),
        },
      }),
      prisma.aiAccount.update({
        where: { userId: body.userId },
        data: { balanceMicroUsd: { increment: amountMicroUsd } },
      }),
    ]);
  } catch (err) {
    if (getPrismaErrorCode(err) === 'P2002') {
      const dupe = await prisma.aiTopupDeposit.findUnique({ where: { zecTxId: body.zecTxId } });
      if (dupe) {
        return {
          status: 'already-credited',
          depositId: dupe.id,
          userId: dupe.userId,
          microUsdCredited: dupe.microUsdCredited.toString(),
        };
      }
      // P2002 raised but the dupe row was rolled back — surface a retryable status.
      server.log.warn(
        { zecTxId: body.zecTxId, userId: body.userId },
        'credit-from-deposit P2002 but dupe row not found — likely concurrent rollback',
      );
      reply.code(503);
      return { error: 'Concurrent write detected. Please retry.' };
    }
    throw err;
  }
  server.log.info(
    {
      userId: body.userId,
      zecTxId: body.zecTxId,
      zatoshi: zatoshi.toString(),
      microUsd: amountMicroUsd.toString(),
      note: body.note ?? '',
    },
    'AI deposit credited',
  );
  return {
    status: 'credited',
    depositId: deposit.id,
    userId: updatedAccount.userId,
    microUsdCredited: deposit.microUsdCredited.toString(),
    newBalanceMicroUsd: updatedAccount.balanceMicroUsd.toString(),
    newBalanceUsd: Number(updatedAccount.balanceMicroUsd) / 1_000_000,
  };
});

// Export server for testing (secrets NOT exported — tests use env vars)
export { server, prisma };

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
    await server.listen({ port: 4000, host: '127.0.0.1' });
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
