import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Set environment variables in vi.hoisted so they run BEFORE module imports
// (vi.stubEnv is not hoisted and runs too late for ESM imports)
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.ADMIN_SECRET = 'test-admin-secret';
  process.env.ZCASH_RPC_URL = 'http://mock-zcash-rpc';
  process.env.NODE_ENV = 'test';
  process.env.APK_DIR = '/tmp/test-apk';
  process.env.VENICE_ADMIN_KEY = 'test-venice-key';
});

// Use vi.hoisted to create mock objects that are available during vi.mock hoisting
const {
  mockPrismaWhitelist,
  mockPrismaDownloadCode,
  mockPrismaUser,
  mockPrismaAiAccount,
  mockPrismaAiTopupDeposit,
  mockPrismaAiUsageEvent,
  mockPrismaAiModelPricing,
  mockPrismaTransaction,
} = vi.hoisted(() => ({
  mockPrismaWhitelist: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaDownloadCode: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaUser: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaAiAccount: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaAiTopupDeposit: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaAiUsageEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  mockPrismaAiModelPricing: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  mockPrismaTransaction: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    whitelist: mockPrismaWhitelist,
    downloadCode: mockPrismaDownloadCode,
    user: mockPrismaUser,
    aiAccount: mockPrismaAiAccount,
    aiTopupDeposit: mockPrismaAiTopupDeposit,
    aiUsageEvent: mockPrismaAiUsageEvent,
    aiModelPricing: mockPrismaAiModelPricing,
    $transaction: mockPrismaTransaction,
    $disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock wallet module
vi.mock('./wallet', () => ({
  syncWallet: vi.fn().mockResolvedValue({ synced_to_height: 1000 }),
  sendTransaction: vi.fn().mockResolvedValue({ txid: 'mock-txid', txHex: '0xabc' }),
  getMessages: vi.fn().mockResolvedValue({ messages: [] }),
  getUserWalletDbPath: vi.fn().mockReturnValue('/mock/wallet/path'),
  importWallet: vi.fn().mockRejectedValue(new Error('importWallet is DISABLED')),
  ensureWalletDbDir: vi.fn(),
  getPrimaryAddress: vi.fn().mockResolvedValue('u1mockaddress'),
  getBalance: vi.fn().mockResolvedValue(100000),
  buildTransaction: vi.fn().mockResolvedValue({ txHex: '0x123', txid: 'mock-txid' }),
  // null = on-chain verification passed; tests that exercise CREDIT_REQUIRE_ONCHAIN_VERIFY
  // override this per-case.
  verifyDepositOnChain: vi.fn().mockResolvedValue(null),
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn().mockImplementation((plain: string) => Promise.resolve(plain === 'validpassword')),
  },
}));

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'email-id' } }),
    },
  })),
}));

// Now import the ACTUAL server - this tests the real code
import { server, __resetRegisterRateLimit } from './server';
// Mocked above — imported so individual tests can override verification results.
import { verifyDepositOnChain } from './wallet';

// Test secrets match the stubbed env vars above
const testJwtSecret = 'test-jwt-secret';
const testAdminSecret = 'test-admin-secret';

// Helper to create a valid JWT token
function createTestToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, testJwtSecret, { expiresIn: '1h' });
}

// Single test setup/teardown for all tests
beforeAll(async () => {
  await server.ready();
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Backend API Tests - Testing ACTUAL server.ts code', () => {

  describe('Health Check', () => {
    it('GET /health returns ok: true', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    });
  });

  describe('Whitelist Endpoints', () => {
    describe('POST /whitelist/join', () => {
      it('returns error when email is missing', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/whitelist/join',
          payload: { reason: 'I want to test the app' },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe('Email is required');
      });

      it('returns error for invalid email format', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/whitelist/join',
          payload: { email: 'invalid-email', reason: 'I want to test the app' },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe('Invalid email format');
      });

      it('returns error when reason is too short', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/whitelist/join',
          payload: { email: 'test@example.com', reason: 'short' },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe('Please provide a reason (at least 10 characters)');
      });

      it('successfully joins whitelist with valid data', async () => {
        mockPrismaWhitelist.findUnique.mockResolvedValueOnce(null);
        mockPrismaWhitelist.create.mockResolvedValueOnce({
          id: 1,
          email: 'test@example.com',
          reason: 'I want to test privacy features',
          status: 'pending',
        });

        const response = await server.inject({
          method: 'POST',
          url: '/whitelist/join',
          payload: {
            email: 'test@example.com',
            reason: 'I want to test privacy features',
          },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().success).toBe(true);
        expect(response.json().message).toBe('Successfully joined the whitelist!');
      });

      it('returns already registered for existing email', async () => {
        mockPrismaWhitelist.findUnique.mockResolvedValueOnce({
          id: 1,
          email: 'existing@example.com',
          status: 'pending',
        });

        const response = await server.inject({
          method: 'POST',
          url: '/whitelist/join',
          payload: {
            email: 'existing@example.com',
            reason: 'I want to test privacy features again',
          },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().alreadyRegistered).toBe(true);
      });
    });

    describe('GET /admin/whitelist', () => {
      it('returns 401 without admin secret', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/admin/whitelist',
        });

        expect(response.statusCode).toBe(401);
      });

      it('returns 401 with invalid admin secret', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/admin/whitelist',
          headers: { 'x-admin-secret': 'wrong-secret' },
        });

        expect(response.statusCode).toBe(401);
      });

      it('returns entries with valid admin secret', async () => {
        const mockEntries = [
          { id: 1, email: 'test1@example.com', status: 'pending', downloadCodes: [] },
          { id: 2, email: 'test2@example.com', status: 'approved', downloadCodes: [] },
        ];
        mockPrismaWhitelist.findMany.mockResolvedValueOnce(mockEntries);

        const response = await server.inject({
          method: 'GET',
          url: '/admin/whitelist',
          headers: { 'x-admin-secret': testAdminSecret },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().entries).toEqual(mockEntries);
      });
    });
  });

  describe('Auth Endpoints', () => {
    describe('POST /auth/register', () => {
      it('creates new user with valid credentials', async () => {
        mockPrismaUser.create.mockResolvedValueOnce({ id: 1, username: 'newuser' });

        const response = await server.inject({
          method: 'POST',
          url: '/auth/register',
          payload: { username: 'newuser', password: 'password123' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().username).toBe('newuser');
      });

      it('returns error for existing username (P2002 error)', async () => {
        const prismaError = new Error('Unique constraint failed') as any;
        prismaError.code = 'P2002';
        prismaError.meta = { target: ['username'] };
        mockPrismaUser.create.mockRejectedValueOnce(prismaError);

        const response = await server.inject({
          method: 'POST',
          url: '/auth/register',
          payload: { username: 'existinguser', password: 'password123' },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe('Username already taken');
      });
    });

    describe('POST /auth/login', () => {
      it('returns token for valid credentials', async () => {
        mockPrismaUser.findUnique.mockResolvedValueOnce({
          id: 1,
          username: 'testuser',
          passwordHash: 'hashedpassword',
        });

        const response = await server.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { username: 'testuser', password: 'validpassword' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().token).toBeDefined();
        expect(response.json().user.username).toBe('testuser');
      });

      it('returns 401 for non-existent user', async () => {
        mockPrismaUser.findUnique.mockResolvedValueOnce(null);

        const response = await server.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { username: 'nonexistent', password: 'anypassword' },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json().error).toBe('Invalid credentials');
      });

      it('returns 401 for wrong password', async () => {
        mockPrismaUser.findUnique.mockResolvedValueOnce({
          id: 1,
          username: 'testuser',
          passwordHash: 'hashedpassword',
        });

        const response = await server.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { username: 'testuser', password: 'wrongpassword' },
        });

        expect(response.statusCode).toBe(401);
        expect(response.json().error).toBe('Invalid credentials');
      });
    });

    describe('GET /me', () => {
      it('returns 401 without auth header', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/me',
        });

        expect(response.statusCode).toBe(401);
      });

      it('returns 401 with invalid token', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/me',
          headers: { authorization: 'Bearer invalid-token' },
        });

        expect(response.statusCode).toBe(401);
      });

      it('returns user with valid token', async () => {
        mockPrismaUser.findUnique.mockResolvedValueOnce({
          id: 1,
          username: 'testuser',
          primaryAddress: 'u1address',
        });

        const token = createTestToken(1, 'testuser');
        const response = await server.inject({
          method: 'GET',
          url: '/me',
          headers: { authorization: `Bearer ${token}` },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().username).toBe('testuser');
      });

      it('returns 404 when user not found in database', async () => {
        mockPrismaUser.findUnique.mockResolvedValueOnce(null);

        const token = createTestToken(999, 'deleteduser');
        const response = await server.inject({
          method: 'GET',
          url: '/me',
          headers: { authorization: `Bearer ${token}` },
        });

        expect(response.statusCode).toBe(404);
      });
    });
  });

  describe('POST /me/wallet - Address linking (NO mnemonic)', () => {
    it('returns 401 without auth', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/me/wallet',
        payload: { address: 'u1testaddress' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns error when address is missing', async () => {
      const token = createTestToken(1, 'testuser');
      const response = await server.inject({
        method: 'POST',
        url: '/me/wallet',
        payload: {},
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('address is required and must be a string');
    });

    it('returns error for invalid address format', async () => {
      const token = createTestToken(1, 'testuser');
      const response = await server.inject({
        method: 'POST',
        url: '/me/wallet',
        payload: { address: 't1invalidformat' },
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('Invalid Zcash unified address format (must start with u1)');
    });

    it('links address successfully (mnemonic NOT required)', async () => {
      // Valid unified address format: u1 prefix + 139 alphanumeric chars (141 total, typical mainnet length)
      const validTestAddress = 'u1' + 'a'.repeat(139);

      mockPrismaUser.update.mockResolvedValueOnce({
        id: 1,
        username: 'testuser',
        primaryAddress: validTestAddress,
      });

      const token = createTestToken(1, 'testuser');
      const response = await server.inject({
        method: 'POST',
        url: '/me/wallet',
        payload: { address: validTestAddress },
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().primaryAddress).toBe(validTestAddress);
      // Verify mnemonic is NOT passed to update
      expect(mockPrismaUser.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { primaryAddress: validTestAddress },
        select: { id: true, username: true, primaryAddress: true },
      });
    });
  });

  describe('Download Endpoints', () => {
    describe('POST /download/verify-code', () => {
      it('returns error when code is missing', async () => {
        const response = await server.inject({
          method: 'POST',
          url: '/download/verify-code',
          payload: {},
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe('Download code is required');
      });

      it('returns 404 for invalid code', async () => {
        mockPrismaDownloadCode.findUnique.mockResolvedValueOnce(null);

        const response = await server.inject({
          method: 'POST',
          url: '/download/verify-code',
          payload: { code: 'INVALID' },
        });

        expect(response.statusCode).toBe(404);
        expect(response.json().error).toBe('Invalid download code');
      });

      it('allows reuse of already used code (codes are reusable for re-downloads)', async () => {
        mockPrismaDownloadCode.findUnique.mockResolvedValueOnce({
          id: 1,
          code: 'USEDCODE',
          used: true,
          expiresAt: new Date(Date.now() + 86400000),
          whitelist: { email: 'test@example.com' },
        });

        const response = await server.inject({
          method: 'POST',
          url: '/download/verify-code',
          payload: { code: 'USEDCODE' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().downloadUrl).toBeDefined();
      });

      it('returns error for expired code', async () => {
        mockPrismaDownloadCode.findUnique.mockResolvedValueOnce({
          id: 1,
          code: 'EXPIRED',
          used: false,
          expiresAt: new Date(Date.now() - 86400000),
          whitelist: { email: 'test@example.com' },
        });

        const response = await server.inject({
          method: 'POST',
          url: '/download/verify-code',
          payload: { code: 'EXPIRED' },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe('This download code has expired. Please request a new code.');
      });

      it('returns download URL for valid code', async () => {
        mockPrismaDownloadCode.findUnique.mockResolvedValueOnce({
          id: 1,
          code: 'VALIDCODE',
          used: false,
          expiresAt: new Date(Date.now() + 86400000),
          whitelistId: 1,
          whitelist: { email: 'test@example.com' },
        });

        const response = await server.inject({
          method: 'POST',
          url: '/download/verify-code',
          payload: { code: 'VALIDCODE' },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().success).toBe(true);
        expect(response.json().downloadUrl).toBeDefined();
      });
    });
  });
});

describe('Input Validation Tests', () => {
  describe('Email validation', () => {
    const invalidEmails = [
      'plaintext',
      '@missinglocal.com',
      'missing@.com',
      'missing.domain@',
      'spaces in@email.com',
      'double@@at.com',
    ];

    it.each(invalidEmails)('rejects invalid email: %s', async (email) => {
      const response = await server.inject({
        method: 'POST',
        url: '/whitelist/join',
        payload: { email, reason: 'This is a valid reason for testing' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('Invalid email format');
    });

    const validEmails = [
      'simple@example.com',
      'user.name@example.com',
      'user+tag@example.com',
      'user@subdomain.example.com',
    ];

    it.each(validEmails)('accepts valid email: %s', async (email) => {
      mockPrismaWhitelist.findUnique.mockResolvedValueOnce(null);
      mockPrismaWhitelist.create.mockResolvedValueOnce({ id: 1, email, status: 'pending' });

      const response = await server.inject({
        method: 'POST',
        url: '/whitelist/join',
        payload: { email, reason: 'This is a valid reason for testing' },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Download code normalization', () => {
    it('normalizes code to uppercase', async () => {
      mockPrismaDownloadCode.findUnique.mockResolvedValueOnce({
        id: 1,
        code: 'ABCD1234',
        used: false,
        expiresAt: new Date(Date.now() + 86400000),
        whitelistId: 1,
        whitelist: { email: 'test@example.com' },
      });

      await server.inject({
        method: 'POST',
        url: '/download/verify-code',
        payload: { code: 'abcd1234' },
      });

      expect(mockPrismaDownloadCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'ABCD1234' },
        include: { whitelist: true },
      });
    });

    it('trims whitespace from code', async () => {
      mockPrismaDownloadCode.findUnique.mockResolvedValueOnce({
        id: 1,
        code: 'ABCD1234',
        used: false,
        expiresAt: new Date(Date.now() + 86400000),
        whitelistId: 1,
        whitelist: { email: 'test@example.com' },
      });

      await server.inject({
        method: 'POST',
        url: '/download/verify-code',
        payload: { code: '  ABCD1234  ' },
      });

      expect(mockPrismaDownloadCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'ABCD1234' },
        include: { whitelist: true },
      });
    });
  });
});

describe('JWT Authentication Edge Cases', () => {
  it('rejects request without Authorization header', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/me',
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects request with malformed Authorization header', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: 'NotBearer token' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects request with expired token', async () => {
    const expiredToken = jwt.sign(
      { userId: 1, username: 'testuser' },
      testJwtSecret,
      { expiresIn: '-1h' }
    );

    const response = await server.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${expiredToken}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects request with token signed with wrong secret', async () => {
    const wrongSecretToken = jwt.sign(
      { userId: 1, username: 'testuser' },
      'wrong-secret',
      { expiresIn: '1h' }
    );

    const response = await server.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${wrongSecretToken}` },
    });

    expect(response.statusCode).toBe(401);
  });

  it('accepts valid token', async () => {
    mockPrismaUser.findUnique.mockResolvedValueOnce({
      id: 1,
      username: 'testuser',
      primaryAddress: null,
    });

    const validToken = createTestToken(1, 'testuser');
    const response = await server.inject({
      method: 'GET',
      url: '/me',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(response.statusCode).toBe(200);
  });
});

describe('AI Revenue Routes', () => {
  describe('POST /api/v1/ai/auth/register', () => {
    it('creates a new account with $0.20 free trial', async () => {
      let createdAccount: { userId: string; tokenHash: string; balanceMicroUsd: bigint } | null = null;
      mockPrismaAiAccount.create.mockImplementation(async ({ data }: { data: { userId: string; tokenHash: string; balanceMicroUsd: bigint } }) => {
        createdAccount = data;
        return data;
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/auth/register',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(typeof body.userId).toBe('string');
      expect(body.userId.length).toBeGreaterThan(16);
      expect(typeof body.token).toBe('string');
      expect(body.freeTrialCreditUsd).toBe(0.2);
      expect(body.balanceMicroUsd).toBe('200000');
      expect(body.rebound).toBe(false);
      expect(mockPrismaAiAccount.create).toHaveBeenCalledTimes(1);
      expect(createdAccount).not.toBeNull();
      expect(createdAccount!.balanceMicroUsd.toString()).toBe('200000');
    });

    it('persists walletPubkey when provided', async () => {
      const pubkey = 'a'.repeat(64);
      mockPrismaAiAccount.findUnique.mockResolvedValueOnce(null); // no existing account
      let createdAccount: { pubkey: string | null } | null = null;
      mockPrismaAiAccount.create.mockImplementation(async ({ data }: { data: { pubkey: string | null; userId: string; tokenHash: string; balanceMicroUsd: bigint } }) => {
        createdAccount = data;
        return data;
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/auth/register',
        payload: { walletPubkey: pubkey },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().rebound).toBe(false);
      expect(createdAccount!.pubkey).toBe(pubkey);
    });

    it('rejects malformed walletPubkey by falling back to unbound account', async () => {
      // Non-hex pubkey is silently dropped (treated as missing); existing-account lookup skipped.
      let createdAccount: { pubkey: string | null } | null = null;
      mockPrismaAiAccount.create.mockImplementation(async ({ data }: { data: { pubkey: string | null; userId: string; tokenHash: string; balanceMicroUsd: bigint } }) => {
        createdAccount = data;
        return data;
      });
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/auth/register',
        payload: { walletPubkey: 'not-a-hex-pubkey' },
      });
      expect(response.statusCode).toBe(200);
      expect(createdAccount!.pubkey).toBeNull();
      expect(mockPrismaAiAccount.findUnique).not.toHaveBeenCalled();
    });

    it('re-mints token for existing pubkey without re-granting free trial', async () => {
      const pubkey = 'b'.repeat(64);
      mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
        userId: 'cuid_existing',
        tokenHash: 'old-hash',
        balanceMicroUsd: 8_500_000n,
        freeTrialGranted: true,
        pubkey,
      });
      mockPrismaAiAccount.update.mockResolvedValueOnce({
        userId: 'cuid_existing',
        tokenHash: 'new-hash',
        balanceMicroUsd: 8_500_000n,
        freeTrialGranted: true,
        pubkey,
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/auth/register',
        payload: { walletPubkey: pubkey },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.userId).toBe('cuid_existing');
      // SECURITY: rebind response must NOT echo the balance (no balance oracle on a pubkey-derived,
      // address-knowable rebind). The client fetches balance via /ai/balance with the new token.
      expect(body.balanceMicroUsd).toBeUndefined();
      expect(body.freeTrialCreditUsd).toBe(0);
      expect(body.rebound).toBe(true);
      expect(mockPrismaAiAccount.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/ai/balance', () => {
    it('returns 401 without bearer token', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/ai/balance',
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 401 for unknown bearer token', async () => {
      mockPrismaAiAccount.findUnique.mockResolvedValueOnce(null);
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/ai/balance',
        headers: { authorization: 'Bearer unknown-token' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns balance for known token', async () => {
      // authenticateAiUser hashes the token and does findUnique({ tokenHash })
      // Then /ai/balance does a second findUnique({ userId })
      mockPrismaAiAccount.findUnique
        .mockResolvedValueOnce({
          userId: 'cuid_abc',
          balanceMicroUsd: 1_500_000n,
          freeTrialGranted: false,
          tokenHash: 'x',
        })
        .mockResolvedValueOnce({
          userId: 'cuid_abc',
          balanceMicroUsd: 1_500_000n,
          freeTrialGranted: false,
        });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/ai/balance',
        headers: { authorization: 'Bearer some-token' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.balanceMicroUsd).toBe('1500000');
      expect(body.balanceUsd).toBe(1.5);
      // freeTrialGranted=false → not a trial account (no deposit lookup needed).
      expect(body.onFreeTrial).toBe(false);
    });

    // #12: the client greys out trial-locked models by pairing this per-user flag with the
    // per-model zchat_trial_eligible flag from /ai/models.
    it('reports onFreeTrial=true for a trial account with no credited deposit', async () => {
      mockPrismaAiAccount.findUnique
        .mockResolvedValueOnce({ userId: 'cuid_abc', balanceMicroUsd: 150_000n, freeTrialGranted: true, tokenHash: 'x' })
        .mockResolvedValueOnce({ userId: 'cuid_abc', balanceMicroUsd: 150_000n, freeTrialGranted: true });
      mockPrismaAiTopupDeposit.findFirst.mockResolvedValueOnce(null);

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/ai/balance',
        headers: { authorization: 'Bearer some-token' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().onFreeTrial).toBe(true);
    });

    it('reports onFreeTrial=false once a deposit has been credited', async () => {
      mockPrismaAiAccount.findUnique
        .mockResolvedValueOnce({ userId: 'cuid_abc', balanceMicroUsd: 5_150_000n, freeTrialGranted: true, tokenHash: 'x' })
        .mockResolvedValueOnce({ userId: 'cuid_abc', balanceMicroUsd: 5_150_000n, freeTrialGranted: true });
      mockPrismaAiTopupDeposit.findFirst.mockResolvedValueOnce({ id: 'dep_1' });

      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/ai/balance',
        headers: { authorization: 'Bearer some-token' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().onFreeTrial).toBe(false);
    });
  });

  describe('GET /api/v1/ai/topup/address', () => {
    it('returns 503 when ZCHAT_AI_TOPUP_ZADDR is not configured', async () => {
      mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
        userId: 'cuid_abc',
        tokenHash: 'x',
        balanceMicroUsd: 0n,
        freeTrialGranted: false,
      });
      const originalAddr = process.env.ZCHAT_AI_TOPUP_ZADDR;
      delete process.env.ZCHAT_AI_TOPUP_ZADDR;
      try {
        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/ai/topup/address',
          headers: { authorization: 'Bearer some-token' },
        });
        expect(response.statusCode).toBe(503);
      } finally {
        if (originalAddr) process.env.ZCHAT_AI_TOPUP_ZADDR = originalAddr;
      }
    });

    it('returns address + memo + tiers when configured', async () => {
      mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
        userId: 'cuid_abc',
        tokenHash: 'x',
        balanceMicroUsd: 0n,
        freeTrialGranted: false,
      });
      process.env.ZCHAT_AI_TOPUP_ZADDR = 'u1mockaddress';
      try {
        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/ai/topup/address',
          headers: { authorization: 'Bearer some-token' },
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.address).toBe('u1mockaddress');
        expect(body.memo).toBe('ai-topup:cuid_abc');
        expect(body.tiers).toEqual([5, 10, 20, 100]);
      } finally {
        delete process.env.ZCHAT_AI_TOPUP_ZADDR;
      }
    });
  });

  describe('POST /api/v1/ai/admin/credit', () => {
    it('returns 401 without admin secret', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit',
        payload: { userId: 'u', microUsd: '1000' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 400 for missing fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit',
        headers: { 'x-admin-secret': testAdminSecret },
        payload: {},
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 for over-cap microUsd', async () => {
      const tooMuch = (10_000n * 1_000_000n + 1n).toString();
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit',
        headers: { 'x-admin-secret': testAdminSecret },
        payload: { userId: 'u', microUsd: tooMuch },
      });
      expect(response.statusCode).toBe(400);
    });

    it('increments balance for valid credit', async () => {
      mockPrismaAiAccount.update.mockResolvedValueOnce({
        userId: 'cuid_abc',
        balanceMicroUsd: 1_200_000n,
      });
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit',
        headers: { 'x-admin-secret': testAdminSecret },
        payload: { userId: 'cuid_abc', microUsd: '1000000', note: 'manual' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.newBalanceMicroUsd).toBe('1200000');
      expect(body.newBalanceUsd).toBe(1.2);
      expect(mockPrismaAiAccount.update).toHaveBeenCalledWith({
        where: { userId: 'cuid_abc' },
        data: { balanceMicroUsd: { increment: 1_000_000n } },
      });
    });
  });

  describe('POST /api/v1/ai/admin/credit-from-deposit', () => {
    const baseBody = {
      userId: 'cuid_abc',
      zecTxId: 'tx_test_1',
      zatoshi: '50000000',
      zecUsdPrice: '40.00',
      microUsd: '20000000',
    };

    // On-chain verification is ON BY DEFAULT now (#26). These base tests opt out explicitly
    // to stay hermetic; the default-on and CREDIT_REQUIRE_ONCHAIN_VERIFY describes below
    // exercise the verification path itself.
    beforeEach(() => {
      process.env.CREDIT_REQUIRE_ONCHAIN_VERIFY = '0';
    });
    afterEach(() => {
      delete process.env.CREDIT_REQUIRE_ONCHAIN_VERIFY;
    });

    it('returns 401 without admin secret', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit-from-deposit',
        payload: baseBody,
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns 400 for missing fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit-from-deposit',
        headers: { 'x-admin-secret': testAdminSecret },
        payload: { userId: 'cuid_abc' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatch(/required/);
    });

    it('returns 400 for non-bigint microUsd', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit-from-deposit',
        headers: { 'x-admin-secret': testAdminSecret },
        payload: { ...baseBody, microUsd: 'not-a-number' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 for negative microUsd', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit-from-deposit',
        headers: { 'x-admin-secret': testAdminSecret },
        payload: { ...baseBody, microUsd: '-1' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 400 for zero zatoshi', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit-from-deposit',
        headers: { 'x-admin-secret': testAdminSecret },
        payload: { ...baseBody, zatoshi: '0' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns 404 when AiAccount does not exist', async () => {
      mockPrismaAiTopupDeposit.findUnique.mockResolvedValueOnce(null);
      mockPrismaAiAccount.findUnique.mockResolvedValueOnce(null);
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit-from-deposit',
        headers: { 'x-admin-secret': testAdminSecret },
        payload: baseBody,
      });
      expect(response.statusCode).toBe(404);
    });

    it('credits new deposit atomically and increments balance', async () => {
      mockPrismaAiTopupDeposit.findUnique.mockResolvedValueOnce(null);
      mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
        userId: 'cuid_abc',
        tokenHash: 'x',
        balanceMicroUsd: 200_000n,
        freeTrialGranted: true,
      });
      const fakeDeposit = {
        id: 'dep_1',
        zecTxId: baseBody.zecTxId,
        microUsdCredited: 20_000_000n,
        userId: 'cuid_abc',
      };
      const fakeUpdatedAccount = { userId: 'cuid_abc', balanceMicroUsd: 20_200_000n };
      mockPrismaTransaction.mockResolvedValueOnce([fakeDeposit, fakeUpdatedAccount]);

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit-from-deposit',
        headers: { 'x-admin-secret': testAdminSecret },
        payload: baseBody,
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('credited');
      expect(body.depositId).toBe('dep_1');
      expect(body.microUsdCredited).toBe('20000000');
      expect(body.newBalanceMicroUsd).toBe('20200000');
      expect(body.newBalanceUsd).toBe(20.2);
      expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
    });

    it('returns already-credited (idempotent) when zecTxId already exists', async () => {
      mockPrismaAiTopupDeposit.findUnique.mockResolvedValueOnce({
        id: 'dep_existing',
        userId: 'cuid_abc',
        zecTxId: baseBody.zecTxId,
        microUsdCredited: 5_000_000n,
        status: 'credited',
      });
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit-from-deposit',
        headers: { 'x-admin-secret': testAdminSecret },
        payload: baseBody,
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('already-credited');
      expect(body.depositId).toBe('dep_existing');
      expect(body.microUsdCredited).toBe('5000000');
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('returns 400 for microUsd over per-call cap', async () => {
      const tooMuch = (10_000n * 1_000_000n + 1n).toString();
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/credit-from-deposit',
        headers: { 'x-admin-secret': testAdminSecret },
        payload: { ...baseBody, microUsd: tooMuch },
      });
      expect(response.statusCode).toBe(400);
    });

    // Regression for #26: verification used to be opt-IN (=== '1') and the flag was absent in
    // production, so any admin-key holder could credit fabricated txids. It is now opt-OUT.
    describe('on-chain verification is ON by default', () => {
      it('returns 503 when the flag is unset and WALLET_DB_PATH is not configured', async () => {
        delete process.env.CREDIT_REQUIRE_ONCHAIN_VERIFY; // default path (outer beforeEach set '0')
        const originalWalletDb = process.env.WALLET_DB_PATH; // dotenv may have loaded one
        delete process.env.WALLET_DB_PATH;
        mockPrismaAiTopupDeposit.findUnique.mockResolvedValueOnce(null);
        mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
          userId: 'cuid_abc', tokenHash: 'x', balanceMicroUsd: 200_000n, freeTrialGranted: true,
        });
        try {
          const response = await server.inject({
            method: 'POST',
            url: '/api/v1/ai/admin/credit-from-deposit',
            headers: { 'x-admin-secret': testAdminSecret },
            payload: baseBody,
          });
          expect(response.statusCode).toBe(503);
          expect(response.json().error).toMatch(/WALLET_DB_PATH not set/);
          // Never reached the balance-mutating transaction — fail closed, no credit.
          expect(mockPrismaTransaction).not.toHaveBeenCalled();
        } finally {
          if (originalWalletDb !== undefined) process.env.WALLET_DB_PATH = originalWalletDb;
        }
      });

      it('runs verification when the flag is unset: a failed on-chain check rejects with 403', async () => {
        delete process.env.CREDIT_REQUIRE_ONCHAIN_VERIFY;
        const originalWalletDb = process.env.WALLET_DB_PATH;
        process.env.WALLET_DB_PATH = '/tmp/mock-wallet-db';
        mockPrismaAiTopupDeposit.findUnique.mockResolvedValueOnce(null);
        mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
          userId: 'cuid_abc', tokenHash: 'x', balanceMicroUsd: 200_000n, freeTrialGranted: true,
        });
        vi.mocked(verifyDepositOnChain).mockResolvedValueOnce('txid not found in wallet');
        try {
          const response = await server.inject({
            method: 'POST',
            url: '/api/v1/ai/admin/credit-from-deposit',
            headers: { 'x-admin-secret': testAdminSecret },
            payload: baseBody,
          });
          expect(response.statusCode).toBe(403);
          expect(response.json().error).toMatch(/On-chain verification failed/);
          expect(verifyDepositOnChain).toHaveBeenCalledTimes(1);
          expect(mockPrismaTransaction).not.toHaveBeenCalled();
        } finally {
          if (originalWalletDb !== undefined) process.env.WALLET_DB_PATH = originalWalletDb;
          else delete process.env.WALLET_DB_PATH;
        }
      });
    });

    // With on-chain verification enabled, the credited µUSD must be bound to the verified
    // on-chain zatoshi × price — a holder of ADMIN_SECRET must not be able to credit an
    // inflated dollar amount against a small genuine deposit.
    describe('CREDIT_REQUIRE_ONCHAIN_VERIFY binds µUSD to on-chain value', () => {
      beforeEach(() => {
        process.env.CREDIT_REQUIRE_ONCHAIN_VERIFY = '1';
        process.env.WALLET_DB_PATH = '/tmp/mock-wallet-db';
      });
      afterEach(() => {
        delete process.env.CREDIT_REQUIRE_ONCHAIN_VERIFY;
        delete process.env.WALLET_DB_PATH;
      });

      it('rejects an inflated microUsd that does not match zatoshi × price (403)', async () => {
        mockPrismaAiTopupDeposit.findUnique.mockResolvedValueOnce(null);
        mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
          userId: 'cuid_abc', tokenHash: 'x', balanceMicroUsd: 200_000n, freeTrialGranted: true,
        });
        // 0.5 ZEC at $40 = $20.00 ⇒ 20_000_000 µUSD. Claim ~$9,999 instead.
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/ai/admin/credit-from-deposit',
          headers: { 'x-admin-secret': testAdminSecret },
          payload: { ...baseBody, microUsd: '9999000000' },
        });
        expect(response.statusCode).toBe(403);
        expect(response.json().error).toMatch(/inconsistent with on-chain zatoshi/);
        // Never reached the balance-mutating transaction.
        expect(mockPrismaTransaction).not.toHaveBeenCalled();
      });

      it('rejects an implausible zecUsdPrice (400)', async () => {
        mockPrismaAiTopupDeposit.findUnique.mockResolvedValueOnce(null);
        mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
          userId: 'cuid_abc', tokenHash: 'x', balanceMicroUsd: 200_000n, freeTrialGranted: true,
        });
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/ai/admin/credit-from-deposit',
          headers: { 'x-admin-secret': testAdminSecret },
          payload: { ...baseBody, zecUsdPrice: '999999999', microUsd: '20000000' },
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().error).toMatch(/zecUsdPrice out of plausible bounds/);
        expect(mockPrismaTransaction).not.toHaveBeenCalled();
      });

      it('credits the server-computed value for a consistent deposit', async () => {
        mockPrismaAiTopupDeposit.findUnique.mockResolvedValueOnce(null);
        mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
          userId: 'cuid_abc', tokenHash: 'x', balanceMicroUsd: 200_000n, freeTrialGranted: true,
        });
        mockPrismaTransaction.mockResolvedValueOnce([
          { id: 'dep_ok', zecTxId: baseBody.zecTxId, microUsdCredited: 20_000_000n, userId: 'cuid_abc' },
          { userId: 'cuid_abc', balanceMicroUsd: 20_200_000n },
        ]);
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/ai/admin/credit-from-deposit',
          headers: { 'x-admin-secret': testAdminSecret },
          payload: baseBody, // 0.5 ZEC × $40 = $20 = 20_000_000 µUSD (consistent)
        });
        expect(response.statusCode).toBe(200);
        expect(response.json().status).toBe('credited');
        expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('GET /api/v1/ai/models', () => {
    const veniceCatalog = {
      data: [
        { id: 'venice-uncensored-1-2', object: 'model', model_spec: { pricing: { input: 0.30, output: 0.90 } } },
        { id: 'flux-1-schnell', object: 'model', model_spec: { type: 'image' } },
        { id: 'no-pricing-known', object: 'model' },
      ],
    };

    it('returns 401 without auth', async () => {
      const response = await server.inject({ method: 'GET', url: '/api/v1/ai/models' });
      expect(response.statusCode).toBe(401);
    });

    it('augments each known model with zchat_pricing at 1.15x markup', async () => {
      mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
        userId: 'cuid_abc',
        tokenHash: 'x',
        balanceMicroUsd: 0n,
        freeTrialGranted: false,
      });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(veniceCatalog),
      }) as unknown as typeof fetch;
      mockPrismaAiModelPricing.findMany.mockResolvedValueOnce([
        { modelId: 'venice-uncensored-1-2', inputPer1mUsd: 0.30, outputPer1mUsd: 0.90, imagePerCallUsd: null, isFreeTier: true },
        { modelId: 'flux-1-schnell', inputPer1mUsd: 0, outputPer1mUsd: 0, imagePerCallUsd: 0.0027, isFreeTier: false },
      ]);

      try {
        // Force fresh cache fetch by also flushing first
        await server.inject({
          method: 'POST',
          url: '/api/v1/ai/admin/flush-models-cache',
          headers: { 'x-admin-secret': testAdminSecret },
        });
        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/ai/models',
          headers: { authorization: 'Bearer some-token' },
        });
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        const byId = new Map<string, Record<string, unknown>>();
        for (const m of body.data) byId.set(m.id, m);

        // Marked-up text model
        const text = byId.get('venice-uncensored-1-2') as { zchat_pricing?: { inputPer1mUsd: number; outputPer1mUsd: number; markup: number; isFreeTier: boolean } };
        expect(text.zchat_pricing).toBeDefined();
        expect(text.zchat_pricing!.inputPer1mUsd).toBeCloseTo(0.30 * 1.15, 8);
        expect(text.zchat_pricing!.outputPer1mUsd).toBeCloseTo(0.90 * 1.15, 8);
        expect(text.zchat_pricing!.markup).toBe(1.15);
        expect(text.zchat_pricing!.isFreeTier).toBe(true);

        // Marked-up image model
        const image = byId.get('flux-1-schnell') as { zchat_pricing?: { imagePerCallUsd: number; isFreeTier: boolean } };
        expect(image.zchat_pricing).toBeDefined();
        expect(image.zchat_pricing!.imagePerCallUsd).toBeCloseTo(0.0027 * 1.15, 8);
        expect(image.zchat_pricing!.isFreeTier).toBe(false);

        // Unknown model passes through unchanged
        const unknown = byId.get('no-pricing-known') as { zchat_pricing?: unknown };
        expect(unknown.zchat_pricing).toBeUndefined();

        // Trial-eligibility flags (#12/#15): whitelisted chat model → eligible; the rest → locked
        // for trial accounts. The whitelists are also exposed top-level for the client.
        expect((text as { zchat_trial_eligible?: boolean }).zchat_trial_eligible).toBe(true);
        expect((image as { zchat_trial_eligible?: boolean }).zchat_trial_eligible).toBe(false);
        expect((unknown as { zchat_trial_eligible?: boolean }).zchat_trial_eligible).toBe(false);
        expect(body.zchat_free_tier_models).toContain('venice-uncensored-1-2');
        expect(body.zchat_free_tier_image_models).toContain('venice-sd35');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('returns 502 if Venice upstream errors', async () => {
      mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
        userId: 'cuid_abc',
        tokenHash: 'x',
        balanceMicroUsd: 0n,
        freeTrialGranted: false,
      });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'service unavailable',
      }) as unknown as typeof fetch;
      try {
        await server.inject({
          method: 'POST',
          url: '/api/v1/ai/admin/flush-models-cache',
          headers: { 'x-admin-secret': testAdminSecret },
        });
        const response = await server.inject({
          method: 'GET',
          url: '/api/v1/ai/models',
          headers: { authorization: 'Bearer some-token' },
        });
        expect(response.statusCode).toBe(502);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('POST /api/v1/ai/chat — billing input validation', () => {
    // Regression for the credit-minting bug: a negative max_tokens made the estimated
    // charge negative, and `decrement` of a negative INCREASES the balance. The route must
    // reject non-positive / non-integer max_tokens with 400 BEFORE touching the balance.
    function mockChatAccount() {
      // authenticateAiUser → findUnique({ tokenHash }); handler → findUnique({ userId })
      mockPrismaAiAccount.findUnique
        .mockResolvedValueOnce({ userId: 'cuid_abc', tokenHash: 'x', balanceMicroUsd: 200_000n, freeTrialGranted: false })
        .mockResolvedValueOnce({ userId: 'cuid_abc', balanceMicroUsd: 200_000n, freeTrialGranted: false });
    }

    for (const badValue of [-100, 0, -1, 3.5, Number.NaN] as const) {
      it(`rejects max_tokens=${String(badValue)} with 400 and never touches the balance`, async () => {
        mockChatAccount();
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/ai/chat',
          headers: { authorization: 'Bearer some-token' },
          payload: { model: 'venice-uncensored-1-2', messages: [{ role: 'user', content: 'hi' }], max_tokens: badValue },
        });
        expect(response.statusCode).toBe(400);
        expect(response.json().error).toMatch(/max_tokens must be a positive integer/);
        // The balance-mutating update must never have run for an invalid request.
        expect(mockPrismaAiAccount.update).not.toHaveBeenCalled();
      });
    }
  });

  describe('POST /api/v1/ai/chat — Venice-catalog pricing fallback', () => {
    // Regression for the "Model X not available or pricing not configured" 400: a model with no
    // seeded AiModelPricing row must still resolve pricing from the live Venice catalog, so it gets
    // PAST the pricing gate (here it then hits the free-trial gate, proving pricing resolved).
    it('resolves an unseeded catalog model instead of 400 "not available"', async () => {
      mockPrismaAiAccount.findUnique.mockResolvedValue({ userId: 'cuid_abc', tokenHash: 'x', balanceMicroUsd: 200_000n, freeTrialGranted: true });
      mockPrismaAiModelPricing.findUnique.mockResolvedValue(null); // no seeded row for this model
      mockPrismaAiModelPricing.findMany.mockResolvedValue([]);
      mockPrismaAiTopupDeposit.findFirst.mockResolvedValue(null); // still on free trial
      // Venice catalog: text fetch returns our model priced; image fetch returns empty.
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          status: 200,
          text: async () =>
            String(url).includes('type=image')
              ? JSON.stringify({ data: [] })
              : JSON.stringify({ data: [{ id: 'glm-unseeded-test', model_spec: { pricing: { input: { usd: 1 }, output: { usd: 3 } } } }] }),
        }),
      ) as unknown as typeof fetch;
      try {
        await server.inject({
          method: 'POST',
          url: '/api/v1/ai/admin/flush-models-cache',
          headers: { 'x-admin-secret': testAdminSecret },
        });
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/ai/chat',
          headers: { authorization: 'Bearer some-token' },
          payload: { model: 'glm-unseeded-test', messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 },
        });
        // The fix: an unseeded model must NOT be rejected by the pricing gate anymore — its price
        // is resolved from the live Venice catalog, so the request proceeds past it.
        expect(response.json().error ?? '').not.toMatch(/not available or pricing not configured/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('POST /api/v1/ai/chat — free-tier billing (#221)', () => {
    // Regression: a model flagged isFreeTier (shown as "Free" in the picker — contract is "no charge")
    // must charge the user 0; the master key absorbs Venice's cost. Previously the charge path ignored
    // isFreeTier and debited the seeded token rates, so a "Free" model still charged (~$0.0009) and
    // decremented the balance.
    it('charges 0 and never debits the balance for an isFreeTier model', async () => {
      const account = {
        userId: 'cuid_abc', tokenHash: 'x', balanceMicroUsd: 200_000n, freeTrialGranted: true,
      };
      mockPrismaAiAccount.findUnique.mockResolvedValue(account);
      // Seeded free-tier BUT with NON-ZERO rates — the exact bug shape (would have charged > 0).
      mockPrismaAiModelPricing.findUnique.mockResolvedValue({
        modelId: 'venice-uncensored-1-2', inputPer1mUsd: 0.30, outputPer1mUsd: 0.90,
        imagePerCallUsd: null, isFreeTier: true,
      });
      mockPrismaAiModelPricing.findMany.mockResolvedValue([]);
      mockPrismaAiTopupDeposit.findFirst.mockResolvedValue(null); // on free trial; model is whitelisted
      // Settle runs as $transaction(async (tx) => …) — execute the callback against a tx stub.
      const usageCreate = vi.fn().mockResolvedValue({});
      mockPrismaTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          aiAccount: {
            findUniqueOrThrow: vi.fn().mockResolvedValue(account),
            update: vi.fn().mockResolvedValue(account),
          },
          aiUsageEvent: { create: usageCreate },
        }),
      );
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            id: 'venice-req-1',
            usage: { prompt_tokens: 5, completion_tokens: 3 },
            choices: [{ message: { content: 'pong' } }],
          }),
      }) as unknown as typeof fetch;
      try {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/ai/chat',
          headers: { authorization: 'Bearer some-token' },
          payload: { model: 'venice-uncensored-1-2', messages: [{ role: 'user', content: 'ping' }], max_tokens: 10 },
        });
        expect(response.statusCode).toBe(200);
        const meta = response.json().zchat_meta;
        expect(meta.chargedMicroUsd).toBe('0');
        expect(meta.chargedUsd).toBe(0);
        // The reservation/decrement must NEVER run for a free-tier request (top-level update is the
        // reserve; only the in-transaction tx.aiAccount is touched, for the response balance read).
        expect(mockPrismaAiAccount.update).not.toHaveBeenCalled();
        // Usage is still recorded, with chargedMicroUsd = 0 (margin absorbs the Venice cost).
        expect(usageCreate).toHaveBeenCalled();
        expect(usageCreate.mock.calls[0][0].data.chargedMicroUsd).toBe(0n);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('POST /api/v1/ai/image — input validation', () => {
    // Regression: a non-numeric `n` used to reach Math.max('x',1)=NaN → microUsd(NaN) RangeError → 500.
    it('rejects a non-numeric n with 400 (not a 500 crash)', async () => {
      mockPrismaAiAccount.findUnique.mockResolvedValueOnce({
        userId: 'cuid_abc', tokenHash: 'x', balanceMicroUsd: 200_000n, freeTrialGranted: false,
      });
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/image',
        headers: { authorization: 'Bearer some-token' },
        payload: { model: 'flux-1-schnell', prompt: 'a cat', n: 'lots' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toMatch(/n must be a finite number/);
    });
  });

  describe('POST /api/v1/ai/image — free-trial whitelist (#15)', () => {
    // Regression: /ai/image previously skipped the trial whitelist entirely, so a trial user
    // could burn the $0.20 on ANY priced image model while /ai/chat blocked non-whitelisted
    // text models. The image endpoint must gate exactly like /ai/chat.
    function mockTrialAccount() {
      // authenticateAiUser → findUnique({ tokenHash }); handler → findUnique({ userId })
      mockPrismaAiAccount.findUnique.mockResolvedValue({
        userId: 'cuid_abc', tokenHash: 'x', balanceMicroUsd: 200_000n, freeTrialGranted: true,
      });
      mockPrismaAiTopupDeposit.findFirst.mockResolvedValue(null); // no credited top-up → on trial
    }

    it('rejects an expensive image model for a trial user with 402 trial_model_restricted', async () => {
      mockTrialAccount();
      mockPrismaAiModelPricing.findUnique.mockResolvedValue({
        modelId: 'hunyuan-image-v3', inputPer1mUsd: 0, outputPer1mUsd: 0,
        imagePerCallUsd: 0.1, isFreeTier: false,
      });
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/image',
        headers: { authorization: 'Bearer some-token' },
        payload: { model: 'hunyuan-image-v3', prompt: 'a cat' },
      });
      expect(response.statusCode).toBe(402);
      const body = response.json();
      expect(body.code).toBe('trial_model_restricted');
      expect(body.freeTierModels).toContain('venice-sd35');
      // The reservation/decrement must never run for a rejected request.
      expect(mockPrismaAiAccount.update).not.toHaveBeenCalled();
    });

    it('allows a trial user to use the whitelisted cheap image model (venice-sd35)', async () => {
      mockTrialAccount();
      mockPrismaAiModelPricing.findUnique.mockResolvedValue({
        modelId: 'venice-sd35', inputPer1mUsd: 0, outputPer1mUsd: 0,
        imagePerCallUsd: 0.01, isFreeTier: false,
      });
      mockPrismaAiAccount.update.mockResolvedValue({}); // reservation decrement
      const usageCreate = vi.fn().mockResolvedValue({});
      mockPrismaTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          aiAccount: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({ userId: 'cuid_abc', balanceMicroUsd: 188_500n }),
          },
          aiUsageEvent: { create: usageCreate },
        }),
      );
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'img-1', images: ['aGVsbG8='] }),
      }) as unknown as typeof fetch;
      try {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/ai/image',
          headers: { authorization: 'Bearer some-token' },
          payload: { model: 'venice-sd35', prompt: 'a cat' },
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.data[0].b64_json).toBe('aGVsbG8=');
        expect(usageCreate).toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('exempts an isFreeTier image model from the trial gate ($0-charge contract, #221)', async () => {
      mockTrialAccount();
      mockPrismaAiModelPricing.findUnique.mockResolvedValue({
        modelId: 'lustify-free-test', inputPer1mUsd: 0, outputPer1mUsd: 0,
        imagePerCallUsd: 0.1, isFreeTier: true, // pricey upstream but "Free" to the user
      });
      const usageCreate = vi.fn().mockResolvedValue({});
      mockPrismaTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          aiAccount: {
            findUniqueOrThrow: vi.fn().mockResolvedValue({ userId: 'cuid_abc', balanceMicroUsd: 200_000n }),
          },
          aiUsageEvent: { create: usageCreate },
        }),
      );
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'img-2', images: ['aGVsbG8='] }),
      }) as unknown as typeof fetch;
      try {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/ai/image',
          headers: { authorization: 'Bearer some-token' },
          payload: { model: 'lustify-free-test', prompt: 'a cat' },
        });
        expect(response.statusCode).toBe(200);
        expect(response.json().zchat_meta.chargedMicroUsd).toBe('0');
        // Free-tier reserves 0 → the balance decrement must never run.
        expect(mockPrismaAiAccount.update).not.toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('POST /api/v1/ai/chat — free-trial 402 carries a machine-readable code', () => {
    // #14: the client must be able to distinguish "trial-restricted model" from "out of credit";
    // both were bare 402s before.
    it('rejects a non-whitelisted model for a trial user with code trial_model_restricted', async () => {
      mockPrismaAiAccount.findUnique.mockResolvedValue({
        userId: 'cuid_abc', tokenHash: 'x', balanceMicroUsd: 200_000n, freeTrialGranted: true,
      });
      mockPrismaAiModelPricing.findUnique.mockResolvedValue({
        modelId: 'openai-gpt-56-sol-pro', inputPer1mUsd: 7.19, outputPer1mUsd: 43.13,
        imagePerCallUsd: null, isFreeTier: false,
      });
      mockPrismaAiTopupDeposit.findFirst.mockResolvedValue(null); // on trial
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/chat',
        headers: { authorization: 'Bearer some-token' },
        payload: { model: 'openai-gpt-56-sol-pro', messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 },
      });
      expect(response.statusCode).toBe(402);
      const body = response.json();
      expect(body.code).toBe('trial_model_restricted');
      expect(body.freeTierModels).toContain('venice-uncensored');
      expect(mockPrismaAiAccount.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/ai/admin/flush-models-cache', () => {
    it('returns 401 without admin secret', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/flush-models-cache',
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns ok with valid admin secret', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/ai/admin/flush-models-cache',
        headers: { 'x-admin-secret': testAdminSecret },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    });
  });

  describe('POST /api/v1/ai/auth/register — per-route rate limit', () => {
    it('returns 429 after the 6th call from the same IP within the window', async () => {
      __resetRegisterRateLimit();
      mockPrismaAiAccount.create.mockImplementation(async ({ data }: { data: { userId: string } }) => data);
      const statuses: number[] = [];
      for (let i = 0; i < 8; i++) {
        const response = await server.inject({
          method: 'POST',
          url: '/api/v1/ai/auth/register',
          remoteAddress: '203.0.113.99',
          payload: {},
        });
        statuses.push(response.statusCode);
      }
      // First 6 calls succeed (200), 7th and 8th are rate-limited (429).
      expect(statuses.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200]);
      expect(statuses.slice(6)).toEqual([429, 429]);
    });

    it('tracks the rate-limit window independently per remote IP', async () => {
      __resetRegisterRateLimit();
      mockPrismaAiAccount.create.mockImplementation(async ({ data }: { data: { userId: string } }) => data);
      // Same IP a hammered first
      for (let i = 0; i < 6; i++) {
        await server.inject({ method: 'POST', url: '/api/v1/ai/auth/register', remoteAddress: '198.51.100.1', payload: {} });
      }
      const sevenA = await server.inject({ method: 'POST', url: '/api/v1/ai/auth/register', remoteAddress: '198.51.100.1', payload: {} });
      // A different IP must still succeed.
      const freshB = await server.inject({ method: 'POST', url: '/api/v1/ai/auth/register', remoteAddress: '198.51.100.2', payload: {} });
      expect(sevenA.statusCode).toBe(429);
      expect(freshB.statusCode).toBe(200);
    });

    it('429 response includes X-RateLimit headers', async () => {
      __resetRegisterRateLimit();
      mockPrismaAiAccount.create.mockImplementation(async ({ data }: { data: { userId: string } }) => data);
      for (let i = 0; i < 6; i++) {
        await server.inject({ method: 'POST', url: '/api/v1/ai/auth/register', remoteAddress: '198.51.100.3', payload: {} });
      }
      const blocked = await server.inject({ method: 'POST', url: '/api/v1/ai/auth/register', remoteAddress: '198.51.100.3', payload: {} });
      expect(blocked.statusCode).toBe(429);
      expect(blocked.headers['x-ratelimit-limit']).toBe('6');
      expect(blocked.headers['x-ratelimit-remaining']).toBe('0');
    });
  });
});
