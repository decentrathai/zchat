# ZCHAT Critical Issues and Forgotten Items

**Generated:** 2026-01-19
**Updated:** 2026-01-20 (Backend Hostile Audit v3 COMPLETE)
**Based on:** Comprehensive hostile audit + feature verification + backend code review

---

## EXECUTIVE SUMMARY

| Category | Critical | High | Medium | Low | Total | Fixed |
|----------|----------|------|--------|-----|-------|-------|
| Backend Security (R1) | 4 | 4 | 5 | 2 | 15 | **14** |
| Backend Security (R2) | 3 | 3 | 2 | 0 | 8 | **8** |
| Backend Security (R3) | 1 | 4 | 5 | 1 | 11 | **11** |
| Security (Demo Blockers) | 2 | 1 | 2 | 0 | 5 | 2 |
| Architecture (Web App) | 1 | 3 | 5 | 0 | 9 | 0 |
| Feature Gaps | 0 | 1 | 3 | 0 | 4 | 0 |
| **Total** | **11** | **16** | **22** | **3** | **52** | **35** |

**🎉 BACKEND HOSTILE AUDIT COMPLETE (2026-01-20):**

**Round 1:** 14/15 fixed ✅
- CRITICAL: 4/4 fixed (B1, B2, B3, B4) ✅
- HIGH: 4/4 fixed (B1-B4) ✅
- MEDIUM: 4/5 fixed (B1, B2, B3, B5), 1 deferred (B4 - JWT policy)
- LOW: 2/2 fixed (B1, B2) ✅

**Round 2:** 8/8 fixed ✅
- CRITICAL: 3/3 fixed (User enumeration, timing attack v2, input validation) ✅
- HIGH: 3/3 fixed (type safety, async fs, fetch timeouts) ✅
- MEDIUM: 2/2 fixed (any types, sensitive logging) ✅

**Round 3:** 11/11 fixed ✅
- CRITICAL: 1/1 fixed (CLI timeout) ✅
- HIGH: 4/4 fixed (JWT validation, password max, email max, amount max) ✅
- MEDIUM: 5/5 fixed (async dir, reason max, address validation, token limit, iteration limit) ✅
- LOW: 1/1 fixed (logging consistency) ✅

**Backend Status: PRODUCTION READY** - 44 tests passing

**Key Finding:** Web app is fundamentally broken - has NO ZMSG protocol support. Cannot interoperate with Android app. (Option C selected - web is secondary platform)

---

## PART 0: BACKEND HOSTILE AUDIT (2026-01-19)

### CRITICAL #B1: Mnemonic Sent Over Network
**File:** `apps/backend/src/server.ts` lines 745-819
**Status:** [x] FIXED - Endpoint now only accepts address, no mnemonic

**Problem:**
```typescript
server.post<{ Body: { address: string; mnemonic: string } }>('/me/wallet', ...)
```
Client sends seed phrase to server via POST request.

**Impact:**
- Network interception = permanent wallet theft
- Server compromise = all user wallets stolen
- Violates self-custody principle

**Fix:** Remove `/me/wallet` endpoint OR redesign to never receive mnemonic.

---

### CRITICAL #B2: Mnemonic Passed as CLI Argument
**File:** `apps/backend/src/wallet.ts` lines 48-55
**Status:** [x] FIXED - importWallet function disabled, throws error if called

**Problem:**
```typescript
const { stdout } = await execFileAsync(WALLET_CLI_BINARY, [
  '--mnemonic', mnemonic,  // VISIBLE IN `ps aux`
]);
```
Anyone on server can run `ps aux | grep mnemonic` to steal seeds.

**Fix:** Pass mnemonic via stdin or per-process environment variable.

---

### CRITICAL #B3: Weak Database Password
**File:** `apps/backend/.env`
**Status:** [x] FIXED - Changed to 32-char secure password

**Problem:** Password is `123456` - the #1 most common password globally.

**Fix:** Generate secure password and update PostgreSQL.

---

### CRITICAL #B4: Tests Don't Test Actual Code
**File:** `apps/backend/src/server.test.ts`
**Status:** [x] FIXED - Tests now import and test actual server module

**Problem:** Test file recreates all routes from scratch instead of importing `server.ts`. Tests pass but production code is completely untested.

**Fix:** Import and test the actual server, not a recreation.

---

### HIGH #B1: No Rate Limiting
**File:** `apps/backend/src/server.ts` (entire file)
**Status:** [x] FIXED - Added @fastify/rate-limit with 100 req/min

**Problem:** No rate limiting on any endpoint:
- `/whitelist/join` - spam signups
- `/register` - brute force
- `/login` - credential stuffing
- `/admin/verify-code` - brute force download codes

**Fix:** Add `@fastify/rate-limit` plugin with appropriate limits.

---

### HIGH #B2: Memory Leak - Unbounded Map Growth
**File:** `apps/backend/src/server.ts` line 91-92
**Status:** [x] FIXED - Added TTL cleanup via setInterval (5 min interval, 1 hour TTL)

**Problem:**
```typescript
const downloadTokens = new Map<string, { email: string; createdAt: number }>();
```
Tokens only cleaned on successful verify. Unverified tokens accumulate forever.

**Fix:** Add TTL cleanup via `setInterval` or use LRU cache with max size.

---

### HIGH #B3: XSS in Admin Emails
**File:** `apps/backend/src/server.ts` lines 201-206
**Status:** [x] FIXED - Added escapeHtml() helper, all user input now escaped

**Problem:**
```typescript
const emailHtml = `<p>Email: ${email}</p><p>Reason: ${reason}</p>`;
```
User input directly interpolated into HTML without escaping.

**Fix:** HTML-escape all user input or use text-only emails.

---

### HIGH #B4: Timing Attack on Admin Secret
**File:** `apps/backend/src/server.ts` lines 132-136
**Status:** [x] FIXED - Added secureCompare() using crypto.timingSafeEqual

**Problem:**
```typescript
if (adminSecret !== ADMIN_SECRET) { ... }
```
Standard string comparison allows timing attacks.

**Fix:** Use `crypto.timingSafeEqual()` for secret comparison.

---

### MEDIUM #B1: Uses `any` Type
**File:** `apps/backend/src/server.ts` (multiple locations)
**Status:** [x] FIXED - Added getErrorMessage() helper, all 22 catch blocks fixed

**Problem:** Error objects untyped throughout. Violates Boris Cherny principles.

**Fix:** Type all error handlers properly.

---

### MEDIUM #B2: No Request Body Size Limits
**File:** `apps/backend/src/server.ts`
**Status:** [x] FIXED - Added bodyLimit: 1048576 (1MB) to Fastify config

**Problem:** No `bodyLimit` configuration. Attackers can send huge payloads.

**Fix:** Add `bodyLimit: 1048576` (1MB) to Fastify config.

---

### MEDIUM #B3: Path Traversal Potential
**File:** `apps/backend/src/server.ts` line 288
**Status:** [x] FIXED - Added APK_DIR validation at startup (absolute path required, must be directory)

**Problem:**
```typescript
const apkDir = process.env.APK_DIR || '/home/yourt/...';
const files = await fs.readdir(apkDir);
```
Misconfigured APK_DIR could expose unintended files.

**Fix:** Validate APK_DIR path and restrict to expected directory.

---

### MEDIUM #B4: JWT Secret in Plain Text
**File:** `apps/backend/.env`
**Status:** [~] DEFERRED - Policy change, not code fix; already validated in production

**Problem:** JWT secret stored in plain text .env file.

**Fix:** Use secrets manager or at minimum rotate secret regularly.

---

### MEDIUM #B5: Edge Case Bug in Formatting
**File:** `apps/web/src/lib/formatting.ts` line 6
**Status:** [x] FIXED - Added explicit check for suffixLen=0 case

**Problem:** `slice(-0)` returns entire string when suffixLen=0.

**Fix:** Handle zero case explicitly.

---

### LOW #B1: Console Logs in Production
**File:** `apps/backend/src/server.ts` (throughout)
**Status:** [x] FIXED - Replaced console.log/error with structured server.log calls

**Problem:** Excessive console.log calls may leak information.

**Fix:** Use structured logger with log levels.

---

### LOW #B2: No Graceful Shutdown
**File:** `apps/backend/src/server.ts`
**Status:** [x] FIXED - Added SIGTERM/SIGINT handlers with graceful Fastify/Prisma shutdown

**Problem:** No SIGTERM/SIGINT handlers. Connections dropped on restart.

**Fix:** Add graceful shutdown handlers.

---

## PART 0.5: BACKEND HOSTILE AUDIT ROUND 2 (2026-01-20)

### CRITICAL #R2-1: User Enumeration Attack
**File:** `apps/backend/src/server.ts` line 866
**Status:** [x] FIXED - Endpoint now requires admin authentication

**Problem:** `/users` endpoint returned all usernames without authentication.

---

### CRITICAL #R2-2: Timing Attack on Admin Secret (Length Oracle)
**File:** `apps/backend/src/server.ts` line 24-29
**Status:** [x] FIXED - Now uses HMAC to normalize lengths before comparison

**Problem:** Original `secureCompare` had early return on length mismatch, leaking secret length.

---

### CRITICAL #R2-3: No Input Validation on Auth Endpoints
**File:** `apps/backend/src/server.ts` lines 717-786
**Status:** [x] FIXED - Added validation for username (3-30 chars, alphanumeric) and password (min 8 chars)

**Problem:** No validation on `/auth/register` and `/auth/login` - could accept empty strings.

---

### HIGH #R2-1: Accessing error.message on Unknown Type
**File:** `apps/backend/src/server.ts` (6 locations)
**Status:** [x] FIXED - All instances now use getErrorMessage() helper

**Problem:** TypeScript `unknown` type accessed as `.message` without proper narrowing.

---

### HIGH #R2-2: Synchronous FS Operations in Request Handler
**File:** `apps/backend/src/server.ts` lines 685-709
**Status:** [x] FIXED - Converted to async fs.promises API

**Problem:** `fs.readdirSync` and `fs.statSync` blocked the event loop during APK download.

---

### HIGH #R2-3: No Timeout on External Fetch Calls
**File:** `apps/backend/src/server.ts`
**Status:** [x] FIXED - Added AbortController with 10s timeout for Telegram, 30s for Zcash RPC

**Problem:** External fetch calls to Telegram API and Zcash RPC could hang forever.

---

### MEDIUM #R2-1: Remaining `any` Types
**Files:** `server.ts`, `wallet.ts`
**Status:** [x] FIXED - Replaced with `unknown` and proper type definitions

**Problem:** `callZcashRPC` used `any[]` params, `getMessages` returned `any[]`.

---

### MEDIUM #R2-2: Sensitive Download Codes in Logs
**File:** `apps/backend/src/server.ts` (3 locations)
**Status:** [x] FIXED - Now logs only first 2 chars + '***'

**Problem:** Full download codes logged, exposing them in log files.

---

## PART 0.6: BACKEND HOSTILE AUDIT ROUND 3 (2026-01-20)

### CRITICAL #R3-C1: No Timeout on Wallet CLI Calls
**File:** `apps/backend/src/wallet.ts` (all execFileAsync calls)
**Status:** [x] FIXED - Added 30s timeout to all CLI calls

**Problem:** All `execFileAsync` calls had no timeout, could hang forever.

---

### HIGH #R3-H1: JWT Payload Not Validated at Runtime
**File:** `apps/backend/src/server.ts` line 238
**Status:** [x] FIXED - Added runtime validation of JWT payload structure

**Problem:** Used TypeScript `as` cast without runtime validation.

---

### HIGH #R3-H2: No Max Password Length
**File:** `apps/backend/src/server.ts` line 760-764
**Status:** [x] FIXED - Added max 72 chars (bcrypt truncation limit)

**Problem:** bcrypt silently truncates at 72 bytes, no validation.

---

### HIGH #R3-H3: No Email Length Limit
**File:** `apps/backend/src/server.ts` line 272-282
**Status:** [x] FIXED - Added 254 char limit (RFC 5321)

**Problem:** Unbounded email length could cause issues.

---

### HIGH #R3-H4: No Max Amount Validation
**File:** `apps/backend/src/server.ts` line 1185-1188
**Status:** [x] FIXED - Added 21M ZEC max (2.1e15 zatoshis)

**Problem:** No upper bound on transaction amounts.

---

### MEDIUM #R3-M1: Synchronous FS in ensureWalletDbDir
**File:** `apps/backend/src/wallet.ts` line 30-34
**Status:** [x] FIXED - Converted to async fs.promises

**Problem:** Used blocking `fs.existsSync` and `fs.mkdirSync`.

---

### MEDIUM #R3-M2: No Max Reason Length
**File:** `apps/backend/src/server.ts` line 285-288
**Status:** [x] FIXED - Added 1000 char limit

**Problem:** Whitelist reason could be arbitrarily large.

---

### MEDIUM #R3-M3: Weak Unified Address Validation
**File:** `apps/backend/src/server.ts` line 894-898
**Status:** [x] FIXED - Added length (100-500) and character validation

**Problem:** Only checked `startsWith('u1')`.

---

### MEDIUM #R3-M4: Unbounded Token Map
**File:** `apps/backend/src/server.ts` line 150
**Status:** [x] FIXED - Added MAX_DOWNLOAD_TOKENS = 10,000 limit

**Problem:** downloadTokens Map could grow without limit.

---

### MEDIUM #R3-M5: Infinite Loop Potential in Code Generation
**File:** `apps/backend/src/server.ts` line 418-424
**Status:** [x] FIXED - Added MAX_CODE_GENERATION_ATTEMPTS = 100

**Problem:** Code generation loop had no max iterations.

---

### LOW #R3-L1: Inconsistent Logging
**File:** `apps/backend/src/server.ts` line 1248
**Status:** [x] FIXED - Changed console.log to server.log.info

**Problem:** Used console.log instead of structured logger.

---

## PART 1: SECURITY BLOCKERS FOR DEMO

### CRITICAL #1: Seed Phrase in localStorage (Web)
**File:** `/home/yourt/zchat/apps/web/src/app/page.tsx`
**Lines:** 297, 374, 425, 496

**Problem:**
```javascript
localStorage.setItem('zchat_seed_phrase', mnemonic);
```
- Accessible to ANY JavaScript on page
- XSS attack = total wallet compromise
- Visible in browser DevTools
- Persists across sessions

**Impact:** SHOW-STOPPER for any investor demo

**Fix (30 min):**
```javascript
// Option 1: sessionStorage (cleared on browser close)
sessionStorage.setItem('zchat_seed_phrase', mnemonic);

// Option 2: React state only (recommended)
const [seedPhrase, setSeedPhrase] = useState('');
// Never persist to any storage
```

---

### CRITICAL #2: Mnemonic Sent to Backend
**Files:**
- `apps/web/src/lib/api.ts` (lines 84-105)
- `apps/backend/src/server.ts` (lines 715-789)
**Status:** [x] FIXED - Backend endpoint redesigned to accept only address, mnemonic parameter removed

**Problem:**
```typescript
// Frontend
body: JSON.stringify({ address, mnemonic })  // Seed sent to server!

// Backend
const { address, mnemonic } = request.body;  // Server receives seed
```

**Impact:** Violates "seed never leaves browser" principle. If backend is compromised, all user seeds are exposed.

**Fix (2-4 hours):**
- Remove `/me/wallet` endpoint entirely
- Backend should only store addresses, never seeds
- Client maintains wallet, backend validates

---

### ~~HIGH #1: Plain Text Seed File (Android)~~ - FALSE POSITIVE
**Status:** VERIFIED SECURE - See ANDROID_FIX_PLAN.md v3.0

**Finding:** Zcash SDK already handles seed storage via `EncryptedSharedPreferences`:
- Location: `co.electriccoin.zcash.encrypted.xml`
- Encryption: AES256-GCM (MasterKey) + AES256-SIV (keys) + AES256-GCM (values)

**No action needed.**

---

### MEDIUM #1: Weak E2E Key Derivation (Android) - NOW P1
**File:** `E2EEncryption.kt` (line 87-91)

**Problem:**
- Uses SHA-256 digest only, not HKDF
- No salt used
- secp256r1 instead of X25519

**Fix (4 hours):** Implement proper HKDF key derivation

---

### MEDIUM #2: No Rate Limiting (Backend)
**File:** `apps/backend/src/server.ts`
**Status:** [x] FIXED - See PART 0 HIGH #B1 (rate limiting added)

**Problem:** No rate limiting on:
- `/auth/register` - brute force
- `/auth/login` - password guessing
- `/whitelist/join` - spam

**Fix (2 hours):** Add `@fastify/rate-limit` plugin

---

## PART 2: ARCHITECTURE CATASTROPHE - WEB APP

### CRITICAL: Web App Has NO ZMSG Protocol Support

**The web app cannot communicate with the Android app.**

| Feature | Android | Web | Status |
|---------|---------|-----|--------|
| v4 Protocol | Full | **NONE** | BROKEN |
| Conversation IDs | Yes | **No** | BROKEN |
| Address Hashing | Yes | **No** | BROKEN |
| Chunked Messages | Full | **NONE** | BROKEN |
| Group Messaging | Full | **NONE** | BROKEN |
| Reactions | Full | **NONE** | BROKEN |
| Read Receipts | Full | **NONE** | BROKEN |
| Time-Locked Msgs | Full | **NONE** | BROKEN |
| Memo Parsing | Full | **NONE** | BROKEN |

**Impact:** Web app is essentially a demo shell, not a working product.

**Files Missing (need to create):**
- `apps/web/src/lib/zmsg-protocol.ts` - Protocol parsing
- `apps/web/src/lib/address-cache.ts` - Address hashing
- `apps/web/src/lib/chunked-messages.ts` - Message chunking
- `apps/web/src/lib/special-messages.ts` - Reactions, receipts, etc.

**Estimated Effort:** 40-80 hours to achieve Android parity

---

### HIGH: 969-Line God Component
**File:** `apps/web/src/app/page.tsx`

**Problem:** Single file handles:
- Authentication
- Wallet management
- Message sending/receiving
- Chat UI
- Developer tools
- 20+ useState calls

**Fix:** Split into:
- `hooks/useAuth.ts`
- `hooks/useWallet.ts`
- `hooks/useChat.ts`
- `components/LoginForm.tsx`
- `components/ChatInterface.tsx`

---

### HIGH: 1,083-Line Backend Monolith
**File:** `apps/backend/src/server.ts`

**Fix:** Split into:
- `routes/auth.ts`
- `routes/whitelist.ts`
- `routes/wallet.ts`
- `routes/zcash.ts`
- `middleware/auth.ts`

---

### HIGH: No Shared Types
**Problem:** Frontend and backend define types independently.

**Fix:** Create `packages/shared-types`:
- API request/response types
- Message types
- Wallet types
- Use Zod for runtime validation

---

## PART 3: ANDROID FEATURE GAPS (Minor)

### GROUP: History Not Loading from Blockchain
**File:** `GroupViewModel.kt` (line 150)
```kotlin
// TODO: Load messages from transaction history
```
**Impact:** Group history lost on app restart
**Fix:** 2-4 hours

### GROUP: LEAVE Not Broadcast
**File:** `GroupViewModel.kt` (lines 213, 569)
```kotlin
// TODO: Send GROUP_LEAVE message to all members
```
**Impact:** Other members not notified of departure
**Fix:** 1-2 hours

### GROUP: Key Distribution Security
**File:** `ZMSGGroupProtocol.kt` (line 132)
```kotlin
// TODO: Add per-recipient encryption using their public key
```
**Impact:** Group key sent in base64, not per-recipient encrypted
**Fix:** 4-8 hours

---

## PART 4: FORGOTTEN ITEMS

### 1. No Tests Anywhere
- No unit tests
- No integration tests
- No E2E tests
- Critical paths untested

### 2. No API Documentation
- Backend has no OpenAPI spec
- No API reference for mobile apps
- No postman collection

### 3. TypeScript Violations Everywhere
- `any` types in 50+ places
- Missing return types on all route handlers
- No strict mode enabled

### 4. No Error Recovery
- No retry logic for failed transactions
- No exponential backoff
- Silent failures throughout

### 5. Missing from Product Doc
Time-locked messages have **4 types** (not just "unlock at time"):
1. Scheduled (timestamp)
2. Block Height (blockchain block)
3. Payment (pay ZEC to reveal)
4. Conditional (answer question)

### 6. Remote Destruction Feature
Fully implemented but not in product doc:
- Local destroy with PIN
- Remote kill via blockchain transaction
- Memo prefix: `ZCHAT_DESTROY:<secret_phrase>`

---

## PRIORITY ACTION LIST

### Before Demo (MUST DO)

| # | Issue | Time | Effort |
|---|-------|------|--------|
| 1 | Fix localStorage seed → sessionStorage | 30 min | Easy |
| 2 | Remove mnemonic from backend OR add security warning | 2-4 hrs | Medium |
| ~~3~~ | ~~Encrypt Android seed file~~ | - | **FALSE POSITIVE** |

### Before Production (HIGH)

| # | Issue | Time | Effort |
|---|-------|------|--------|
| 4 | Implement ZMSG protocol in Web app | 40-80 hrs | Hard |
| 5 | Split god components | 8-16 hrs | Medium |
| 6 | Add rate limiting | 2 hrs | Easy |
| 7 | Add shared types package | 8 hrs | Medium |
| 8 | Add basic tests | 20+ hrs | Medium |

### Before v1.0 (MEDIUM)

| # | Issue | Time | Effort |
|---|-------|------|--------|
| 9 | Implement proper HKDF | 4 hrs | Medium |
| 10 | Fix group history loading | 4 hrs | Medium |
| 11 | Add GROUP_LEAVE broadcast | 2 hrs | Easy |
| 12 | Add API documentation | 8 hrs | Easy |
| 13 | Enable TypeScript strict mode | 16 hrs | Hard |

---

## DECISION REQUIRED

### Web App Strategy

**Option A: Fix Web App (40-80 hours)**
- Implement full ZMSG protocol
- Achieve Android parity
- Use WASM wallet-core

**Option B: Deprecate Web App (0 hours)**
- Focus on Android + iOS
- Web becomes landing page only
- Reduce maintenance burden

**Option C: Web as Secondary (20 hours)**
- Implement basic messaging only (no groups, no special messages)
- Mobile is primary
- Web syncs from mobile device

**Recommendation:** Option C for now, Option A later.

---

## PART 5: ANDROID CRYPTO HOSTILE AUDIT (2026-01-20)

**File:** `E2EEncryption.kt`
**Status:** Review Complete - Implementation Issues Identified

### CRITICAL Issues (P1 - Must Fix)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C1 | SharedKey length not validated | encrypt(), decrypt() | Wrong-sized keys create weak crypto |
| C2 | Nonce length validation missing | decrypt(), decryptECIES() | Invalid nonces cause crypto failures |

### HIGH Issues (P2 - Should Fix)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| H1 | Base64 decode exceptions uncaught | sign(), deriveSharedSecret() | Can crash app |
| H2 | ECIES uses null salt | encryptECIES(), decryptECIES() | Weaker than V2 derivation |
| H3 | Decryption returns null for both format errors AND auth failures | decrypt() | Can't distinguish tampering |
| H4 | KEX signature missing replay protection | createKEXPayload() | Replay attacks possible |
| H5 | Empty/null key inputs not validated | multiple functions | Cryptographic failures |

### MEDIUM Issues (P3 - Consider)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| M1 | Broad exception catching | all decrypt functions | Hides root cause |
| M2 | No key context separation | deriveKeyV2() | Same key for different purposes |
| M3 | ECDSA signature malleability | sign(), verify() | Theoretical attack vector |
| M4 | Ciphertext empty check missing | decrypt() | Edge case not handled |

### Recommendations

1. **Add input validation helper:**
```kotlin
fun validateAESKey(key: ByteArray) {
    require(key.size == 32) { "AES key must be 32 bytes" }
}
fun validateNonce(nonce: ByteArray) {
    require(nonce.size == NONCE_SIZE) { "Nonce must be $NONCE_SIZE bytes" }
}
```

2. **Distinguish crypto failures:**
```kotlin
sealed class DecryptResult {
    data class Success(val plaintext: String) : DecryptResult()
    object InvalidFormat : DecryptResult()
    object AuthenticationFailed : DecryptResult()  // GCM tag mismatch = tampering
}
```

3. **Add replay protection to KEX:**
```kotlin
// Include session nonce and timestamp in signature
val messageToSign = "$senderAddress|$publicKey|$sessionNonce|$timestamp"
```

4. **Use consistent salt in ECIES:**
```kotlin
private val ECIES_SALT = "ZCHAT_ECIES_SALT_V1".toByteArray(Charsets.UTF_8)
```

---

## DOCUMENTATION FIXES APPLIED (2026-01-20)

Fixed incorrect CONV_ID_LENGTH in documentation:
- **Reality:** 8 chars (A-Z, 0-9) = ~41 bits entropy
- **Was documented as:** 12 chars = ~71 bits entropy

Files updated:
- ARCHITECTURE.md
- SYSTEM_PROMPT.md
- DECISIONS.md
- ANDROID_FIX_PLAN.md
- ANDROID_TEST_REQUIREMENTS.md
- DEVELOPMENT_STANDARDS.md
- IMPLEMENTATION_STEPS.md

---

*Document will be updated as issues are fixed.*
