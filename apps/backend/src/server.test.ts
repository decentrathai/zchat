import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock environment variables BEFORE importing server
vi.stubEnv('JWT_SECRET', 'test-jwt-secret');
vi.stubEnv('ADMIN_SECRET', 'test-admin-secret');
vi.stubEnv('ZCASH_RPC_URL', 'http://mock-zcash-rpc');
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('APK_DIR', '/tmp/test-apk');

// Use vi.hoisted to create mock objects that are available during vi.mock hoisting
const { mockPrismaWhitelist, mockPrismaDownloadCode, mockPrismaUser } = vi.hoisted(() => ({
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
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    whitelist: mockPrismaWhitelist,
    downloadCode: mockPrismaDownloadCode,
    user: mockPrismaUser,
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
import { server, jwtSecret, adminSecret } from './server';

// Helper to create a valid JWT token
function createTestToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, jwtSecret, { expiresIn: '1h' });
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
          headers: { 'x-admin-secret': adminSecret },
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

      it('returns error for already used code', async () => {
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

        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe('This download code has already been used');
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
        expect(response.json().error).toBe('This download code has expired');
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
      jwtSecret,
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
