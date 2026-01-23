# Project: ZCHAT

**Version:** 1.7
**Last Updated:** 2026-01-22

## Overview
ZCHAT is a privacy-first messaging application built on Zcash shielded transactions. Messages are sent via the memo field of shielded transactions, providing cryptographic privacy guarantees. The app supports direct messages, group chats, disappearing messages, and time-locked content. Future integration with NOSTR will add file sharing, audio messages, and voice/video calls.

**Primary Platform:** Android (forked from Zashi wallet)
**Secondary Platforms:** iOS (planned), Web (limited functionality)

---

## Architecture

**Key Architectural Decisions:**
- Messages transmitted via Zcash memo field (512 bytes max)
- ZMSG Protocol v4 for message formatting (DM, KEX, RXN, RCV, RPL, REQ, STT, CHK)
- E2E encryption using secp256r1 ECDH + AES-256-GCM
- HKDF (RFC 5869) for key derivation (implemented with V1/V2 versioning)
- Room database for local message persistence
- Single BIP39 seed derives both Zcash and NOSTR identities

**Data Flow:**
```
User Input → ZMSG Protocol → E2E Encryption → Zcash Transaction → Blockchain
Blockchain → Transaction Monitor → Memo Parsing → Decryption → UI Display
```

**Security Model:**
- Shielded transactions hide sender, receiver, and amount
- Memo field encrypted by Zcash protocol
- Additional E2E layer for multi-recipient scenarios
- KEX protocol with signatures prevents MITM attacks
- Group keys encrypted per-recipient using ECIES

See `ARCHITECTURE.md` for complete technical documentation.

---

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Android App** | Kotlin + Jetpack Compose | Kotlin 1.9.x |
| **Zcash SDK** | zcash-android-wallet-sdk | Latest |
| **Backend** | Node.js + Fastify | Fastify 5.x |
| **Database (Backend)** | PostgreSQL + Prisma | Prisma 6.x |
| **Database (Android)** | Room | 2.6.x |
| **Web Frontend** | Next.js + React | Next 15.x |
| **Wallet Core** | Rust + WASM | Rust 1.75+ |
| **Zcash Node** | zebrad | Latest |
| **Wallet Server** | lightwalletd | Latest |
| **Deployment** | Cloudflare Pages/Tunnel | - |
| **NOSTR (Planned)** | rust-nostr | 0.13.0-alpha.2 |
| **File Storage (Planned)** | Blossom Protocol | - |

---

## Coding Standards

**Follow Boris Cherny's TypeScript/Kotlin Best Practices:**

1. **No `any` types** - Use discriminated unions (TS) / sealed classes (Kotlin)
   ```kotlin
   sealed class ZchatResult<out T, out E> {
       data class Success<T>(val value: T) : ZchatResult<T, Nothing>()
       data class Failure<E>(val error: E) : ZchatResult<Nothing, E>()
   }
   ```

2. **Result types for errors** - Never throw exceptions for expected failures
   ```kotlin
   suspend fun sendMessage(content: String): ZchatResult<Transaction, SendError>
   ```

3. **Exhaustive pattern matching** - All `when` branches must be handled
   ```kotlin
   when (result) {
       is ZchatResult.Success -> handleSuccess(result.value)
       is ZchatResult.Failure -> handleError(result.error)
   }
   ```

4. **Value types** - Branded types for domain concepts
   ```kotlin
   @JvmInline value class ZcashAddress(val value: String)
   @JvmInline value class Zatoshi(val value: Long)
   ```

5. **Immutability by default** - `val` over `var`, `Readonly<T>` in TypeScript

6. **Explicit return types** - All functions must declare return types
   ```kotlin
   suspend fun fetchMessages(): ZchatResult<List<Message>, NetworkError>  // Not inferred
   ```

7. **Zod validation at boundaries** - Validate all external input (API, blockchain)

**Modern Development Practices:**

8. **Functional programming** - Prefer pure functions, `map`/`filter`/`fold` over loops
   ```kotlin
   // Prefer
   messages.filter { it.isUnread }.map { it.content }
   // Over
   for (m in messages) { if (m.isUnread) result.add(m.content) }
   ```

9. **Dependency injection** - Pass dependencies explicitly, use interfaces
   ```kotlin
   class ChatViewModel(
       private val repository: MessageRepository,  // Injected
       private val crypto: E2EEncryption           // Injected
   ) : ViewModel()
   ```

10. **Separation of concerns** - Each class/module has one responsibility
    - ViewModels: UI state management
    - Repositories: Data access
    - Protocols: Message parsing
    - Crypto: Encryption/decryption

See `DEVELOPMENT_STANDARDS.md` for complete reference with examples.

---

## File Structure

```
/home/yourt/zchat/               # Main monorepo
├── apps/
│   ├── backend/                 # Node.js API (port 4000)
│   │   ├── src/server.ts        # API endpoints (all routes)
│   │   ├── prisma/              # Database schema
│   │   └── package.json
│   ├── web/                     # Next.js frontend (port 3000)
│   │   ├── src/app/             # App router pages
│   │   └── src/components/      # React components
│   └── landing/                 # Landing page (Cloudflare Pages)
├── packages/
│   └── wallet-core/             # Rust WASM wallet
├── docs/                        # Documentation
│   └── archive/                 # Archived docs
├── CLAUDE.md                    # This file
├── ARCHITECTURE.md              # Technical architecture
├── PRODUCT.md                   # Product vision (v2.0)
├── IMPLEMENTATION_STEPS.md      # Current tasks
├── DEVELOPMENT_STANDARDS.md     # Coding standards
├── DECISIONS.md                 # Decision log
├── ANDROID_FIX_PLAN.md          # Fix plans + NOSTR spec
└── ISSUES_TO_FIX.md             # Audit findings

/home/yourt/zchat-android/       # Android app (Zashi fork) - PRIMARY
├── app/                         # Main Android module
├── ui-lib/                      # UI components (Compose)
│   └── src/main/java/.../screen/chat/  # ZCHAT-specific code
│       ├── crypto/
│       │   └── E2EEncryption.kt     # E2E encryption
│       ├── model/
│       │   ├── ZMSGProtocol.kt      # Message protocol
│       │   ├── ZMSGGroupProtocol.kt # Group protocol
│       │   └── ZMSGConstants.kt     # Protocol constants
│       ├── viewmodel/
│       │   ├── ChatViewModel.kt     # DM chat logic
│       │   └── GroupViewModel.kt    # Group chat logic
│       └── datasource/
│           └── ZchatPreferences.kt  # Preferences storage
├── ui-design-lib/               # Design system
├── sdk-ext-lib/                 # SDK extensions
└── preference-*-lib/            # Preferences modules
```

---

## Key Patterns

**1. ZMSG Protocol Pattern (v4)**
All messages follow the ZMSG v4 pipe-delimited format:
```
ZMSG|4|<type>|<conv_id>|<sender_hash>|<payload...>

Examples:
ZMSG|4|DM|abc123xyz456|a1b2c3d4e5f6g7h8|<encrypted_content>
ZMSG|4|KEX|abc123xyz456|a1b2c3d4e5f6g7h8|<pubkey_b64>|<signature_b64>
ZMSG|4|RXN|abc123xyz456|a1b2c3d4e5f6g7h8|<target_txid>|👍
```
Note: Group messages use separate ZGRP protocol, time-locked use ZTL protocol.
See `ARCHITECTURE.md` Section 3 for complete protocol specification.

**2. Result Type Pattern**
All fallible operations return `ZchatResult<T, E>` instead of throwing:
```kotlin
fun decrypt(data: ByteArray): ZchatResult<String, CryptoError>
```

**3. Repository Pattern**
Data access abstracted through repositories:
- `ZchatPreferences` - Key-value storage
- `MessageRepository` - Room database access
- `TransactionRepository` - Blockchain queries

**4. ViewModel + StateFlow Pattern**
UI state managed via Compose ViewModels:
```kotlin
class ChatViewModel : ViewModel() {
    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages.asStateFlow()
}
```

**5. Retry with Backoff Pattern**
Network/blockchain operations use exponential backoff:
```kotlin
RetryStrategy.TRANSACTION.execute { sendTransaction(...) }
```

**6. Chunked Message Pattern**
Large messages split across multiple transactions, reassembled via `ChunkCache`.

---

## Testing Strategy

### Test Commands

```bash
# Backend tests (44 tests - API endpoints, auth, validation)
cd /home/yourt/zchat/apps/backend && pnpm test

# Web frontend tests (18 tests - utilities)
cd /home/yourt/zchat/apps/web && pnpm test

# Run all tests
cd /home/yourt/zchat && pnpm test --filter backend && pnpm test --filter web
```

### Test Coverage Status

| Platform | Tests | Status |
|----------|-------|--------|
| Backend API | 44 | ✅ Passing |
| Web Frontend | 18 | ✅ Passing |
| Android (ZCHAT) | 0 | ❌ CRITICAL GAP |

**Android Note:** 51 test files exist but ALL are inherited from Zashi. See `ANDROID_TEST_REQUIREMENTS.md` for required ZCHAT-specific tests.

### Test Locations

- **Backend:** `/apps/backend/src/server.test.ts`
- **Web:** `/apps/web/src/lib/formatting.test.ts`
- **Android (planned):** `/ui-lib/src/test/java/.../chat/`

### What Backend Tests Cover

- Health check endpoint
- Whitelist join (validation, duplicates)
- Admin authentication (X-Admin-Secret)
- User registration and login
- JWT authentication (valid, expired, malformed)
- Download code verification
- Input validation (email, codes)

### What to Test (Guidelines)

- All crypto operations (encryption, decryption, key derivation)
- All ZMSG message types (parsing, generation)
- Error paths (network failures, invalid data)
- Backward compatibility (old message formats)

### Test Naming Convention

```kotlin
@Test
fun `sendMessage returns Failure when wallet has insufficient balance`() { }
```

### Manual Testing Checklist

See `ANDROID_FIX_PLAN.md` → Testing Checklist section

---

## Current Status

**Phase:** Implementation Phase - P1 Release Critical

**P1 Tasks (Status as of 2026-01-20):**
| Task | Status | Notes |
|------|--------|-------|
| HKDF key derivation | ✅ COMPLETE | RFC 5869, V1/V2 versioning |
| Group history loading | ✅ COMPLETE | Load, decrypt, store |
| GROUP_LEAVE broadcast | ✅ COMPLETE | Broadcast implemented |
| KEX protocol | ✅ COMPLETE | Sign/verify, message format |
| Group key ECIES | ✅ COMPLETE | Encrypt/decrypt group keys |
| sender_hash collision | ✅ 12 chars adequate | ~48 bits entropy |
| Backend mnemonic fix | ✅ COMPLETE | Removed from /me/wallet |

**Completed:**
- ✅ Product documentation (PRODUCT.md v2.0)
- ✅ Architecture documentation (ARCHITECTURE.md v1.1)
- ✅ Development standards (DEVELOPMENT_STANDARDS.md)
- ✅ Security audit (seed storage verified secure)
- ✅ Architecture consistency review (56 issues fixed)
- ✅ Backend test infrastructure (38 tests passing)
- ✅ Web frontend test infrastructure (18 tests passing)
- ✅ Android test requirements documented (ANDROID_TEST_REQUIREMENTS.md)

**Pending (P2+):**
- Error handling improvements (ZchatResult types implemented, integration ongoing)
- NOSTR integration (48h estimated)

**Recently Completed:**
- ✅ Logging redaction (LogRedaction utility, address/key sanitization)
- ✅ ZchatResult/ZchatError types for explicit error handling
- ✅ Identity Regeneration (diversified addresses)

See `IMPLEMENTATION_STEPS.md` for detailed task breakdown.

**Implementation Rules (for each step):**
1. **Implement** → 2. **Test** → 3. **Mark Progress** → 4. **Document deviations**

---

## Documentation Index (READ THESE ON SESSION RESTART)

**Priority order for restoring context:**

| # | Document | Purpose | Read When |
|---|----------|---------|-----------|
| 1 | **CLAUDE.md** (this file) | Infrastructure, services, build commands | Always first |
| 2 | **IMPLEMENTATION_STEPS.md** | Current progress, next steps, session log | What to work on next |
| 3 | **PRODUCT.md** | Product vision, features, roadmap, user personas | Understanding what to build |
| 4 | **ARCHITECTURE.md** | Technical architecture, protocols, data flows | Understanding how it works |
| 5 | **ANDROID_FIX_PLAN.md** | Detailed fix plans, NOSTR integration spec | Implementation details |
| 6 | **DEVELOPMENT_STANDARDS.md** | Boris Cherny principles, TypeScript/Kotlin standards | How to write code |
| 7 | **DECISIONS.md** | Key architectural decisions with reasoning | Understanding why |
| 8 | **ISSUES_TO_FIX.md** | Audit findings, prioritized issues | Reference for bugs |
| 9 | **ANDROID_TEST_REQUIREMENTS.md** | Android test specs, test vectors | Writing Android tests |
| 10 | **README.md** | User-facing documentation | Project overview |
| 11 | **SESSION_RESTART_PROMPT.md** | Complete restart prompt for new sessions | Starting new session |
| 12 | **SYSTEM_PROMPT.md** | AI development assistant system prompt | AI-assisted development |

**IMPORTANT:** When updating SESSION_RESTART_PROMPT.md, also copy to Windows:
```bash
cp /home/yourt/zchat/SESSION_RESTART_PROMPT.md "/mnt/c/Users/yourt/OneDrive/Рабочий стол/ZCHAT/RESTART PROMPT.txt"
```

**Key verified facts (from hostile audit):**
- Android seed storage is ALREADY SECURE (EncryptedSharedPreferences)
- E2E key derivation now uses HKDF (RFC 5869) with V1/V2 versioning ✅
- Web app has NO ZMSG protocol - cannot interoperate with Android
- Decision: Web app is secondary platform (Option C)

**Current phase:** Implementation Phase - P1 Release Critical (HKDF, Group History, GROUP_LEAVE)

**Methodology status:** Phase 1 (Product Document Formation) COMPLETE - see PRODUCT.md v2.0

**Archived docs:** Old implementation files moved to `docs/archive/`

---

## CRITICAL: Daily Startup Checklist

**Run this at the start of each session to ensure all services are online.**

### Quick Start All Services
```bash
/home/yourt/start-zchat-services.sh
```

### Auto-Recovery
Services are automatically checked every 5 minutes via cron. If any service is down, it will be restarted automatically.
Check auto-recovery logs: `tail -50 /home/yourt/zchat-health.log`

### Critical Services (Priority Order)

| # | Service | Port | Check Command | Start Command |
|---|---------|------|---------------|---------------|
| 1 | **Cloudflare Tunnel** | - | `pgrep -f 'cloudflared tunnel'` | `nohup cloudflared tunnel run zchat > ~/cloudflared.log 2>&1 &` |
| 2 | **Backend API** | 4000 | `curl -s http://localhost:4000` | `cd ~/zchat/apps/backend && nohup pnpm dev > ~/backend.log 2>&1 &` |
| 3 | **Landing Page** | 3002 | `curl -s http://localhost:3002` | `cd ~/zchat/apps/landing && nohup pnpm dev > ~/landing.log 2>&1 &` |
| 4 | **Zebrad** | 8232 | `curl -s http://127.0.0.1:8232` | `nohup zebrad start > ~/zebrad.log 2>&1 &` |
| 5 | **Lightwalletd** | 9067 | `pgrep -f lightwalletd` | See startup commands below |
| 6 | **Web Frontend** | 3000 | `curl -s http://localhost:3000` | `cd ~/zchat/apps/web && nohup pnpm dev > ~/frontend.log 2>&1 &` |

### Why Each Service Matters
- **Cloudflare Tunnel**: Routes ALL zsend.xyz domains to local services. **Without it, everything is DOWN.**
- **Landing Dev Server (port 3002)**: Serves zsend.xyz landing page via tunnel.
- **Backend API**: Handles whitelist signups, admin dashboard, download codes. **Without it, no new signups work.**
- **Zebrad**: Zcash blockchain node. Required for wallet operations.
- **Lightwalletd**: gRPC interface for wallets. Required for Android app sync.
- **Web Frontend**: Web app at app.zsend.xyz (NOT the landing page).

### Public URLs to Verify
- https://zsend.xyz - Landing page
- https://api.zsend.xyz - Backend API (should return JSON)
- https://zsend.xyz/admin - Admin dashboard

### Automated Health Checks
Health checks run automatically every 12 hours via cron. Check logs:
```bash
tail -50 /home/yourt/zchat-health.log
```

---

## Infrastructure

### Node Setup
- **Zcash Node**: zebrad (NOT zcashd)
- **Zebrad Config**: `/home/yourt/.config/zebrad.toml`
- **Zebrad Data**: `/home/yourt/.cache/zebra`
- **Lightwalletd Binary**: `/home/yourt/go/bin/lightwalletd`
- **Lightwalletd Data**: `/home/yourt/lightwalletd_db`
- **Lightwalletd Log**: `/home/yourt/lightwalletd.log`
- **Zcash Params**: `/home/yourt/.zcash-params`

### Service Ports
| Service | Port |
|---------|------|
| Backend API | 4000 |
| Landing App (with admin) | 3002 |
| Web Frontend | 3000 |
| Zebrad RPC | 8232 |
| Zebrad P2P | 8233 |
| Lightwalletd gRPC | 9067 |

### Environment Variables (Backend)

**Required in Production (NODE_ENV=production):**
| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT token signing | Random 32+ char string |
| `ADMIN_SECRET` | Secret for admin API endpoints | Random 32+ char string |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/zchat` |

**Optional:**
| Variable | Description | Default |
|----------|-------------|---------|
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `https://app.zsend.xyz,https://zsend.xyz,http://localhost:3000` |
| `RESEND_API_KEY` | Resend.com API key for emails | (disabled if not set) |
| `ADMIN_NOTIFICATION_EMAIL` | Email for whitelist notifications | (disabled if not set) |
| `APK_DIR` | Directory containing APK files | `/home/yourt` |
| `ZCASH_RPC_URL` | Zcash node RPC URL | `http://127.0.0.1:8232` |

**Development defaults:** In development (NODE_ENV !== 'production'), JWT_SECRET and ADMIN_SECRET have insecure fallbacks. Never use these in production.

### Cloudflare

#### zsend.xyz Deployment (Cloudflare Tunnel)
**ALL zsend.xyz sites are served via Cloudflare Tunnel, NOT Pages.**

| Domain | Routes To | Service |
|--------|-----------|---------|
| `zsend.xyz` | localhost:3002 | Landing page (Next.js dev server) |
| `app.zsend.xyz` | localhost:3000 | Web Frontend |
| `api.zsend.xyz` | localhost:4000 | Backend API |
| `lwd.zsend.xyz` | localhost:9067 | Lightwalletd gRPC |

**Tunnel config:** `~/.cloudflared/config.yml`
**Tunnel name:** `zchat`

#### To Update zsend.xyz Landing Page:
```bash
# 1. Edit code in /home/yourt/zchat/apps/landing/
# 2. Ensure landing dev server is running:
cd /home/yourt/zchat/apps/landing && pnpm dev
# 3. Changes are live immediately (dev server with HMR)
```

#### If zsend.xyz Shows Old Content:
```bash
# Fix DNS to route through tunnel (not Pages):
cloudflared tunnel route dns --overwrite-dns zchat zsend.xyz
```

#### Tunnel Management:
```bash
# Check tunnel status
pgrep -f "cloudflared tunnel" && echo "Running"

# Restart tunnel
pkill -f "cloudflared tunnel"
nohup cloudflared tunnel run zchat > ~/cloudflared.log 2>&1 &
```

#### Wrangler (NOT used for zsend.xyz):
Wrangler/Pages is NOT used for zsend.xyz deployment. Only use if needed for other Cloudflare services.
```bash
npx wrangler login  # Re-auth if needed
```

## Project Structure
```
/home/yourt/zchat/           # Main monorepo
├── apps/
│   ├── backend/             # Node.js backend (port 4000)
│   ├── web/                 # Next.js frontend (port 3000)
│   └── landing/             # Landing page
├── packages/
│   └── wallet-core/         # Rust WASM wallet
├── wallet-db/               # SQLite wallet database
└── target/                  # Rust build output

/home/yourt/zchat-android/   # Android app (forked from Zashi)
```

## Android App (zchat-android)

### Overview
Forked from **Zashi** (official Zcash Android wallet by Electric Coin Company).
Based on Zcash Android SDK.

### Build Commands
```bash
cd /home/yourt/zchat-android

# Build debug APK
ANDROID_HOME="$HOME/android-sdk" \
ANDROID_SDK_ROOT="$HOME/android-sdk" \
JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64" \
./gradlew assembleDebug

# Quick compile check (faster than full build)
./gradlew :ui-lib:compileZcashmainnetFossReleaseSources

# Clean build
./gradlew clean

# List connected devices
$HOME/android-sdk/platform-tools/adb devices
```

### APK Output Location
- Debug APK: `app/build/outputs/apk/zcashmainnetFoss/debug/`
- After build, copy to Windows Downloads:
```bash
cp /home/yourt/zchat-android/app/build/outputs/apk/zcashmainnetFoss/debug/*.apk /mnt/c/Users/yourt/Downloads/
```

### Key Files to Modify for ZCHAT Branding
1. `gradle.properties` - `ZCASH_RELEASE_APP_NAME`
2. `app/build.gradle.kts` - `ZCASH_RELEASE_PACKAGE_NAME`
3. `ui-lib/src/main/res/ui/non_translatable/values/strings.xml` - `support_email_address`
4. `ui-lib/src/main/res/common/` - Launcher icons

### Project Structure
- `app/` - Main Android app module
- `ui-lib/` - UI components (Compose)
- `ui-design-lib/` - Design system
- `sdk-ext-lib/` - SDK extensions
- `configuration-*-lib/` - Configuration modules
- `preference-*-lib/` - Preferences modules

## Startup Commands

### Start All Services
```bash
# 1. Zebrad
zebrad start

# 2. Lightwalletd
/home/yourt/go/bin/lightwalletd \
  --zcash-conf-path /home/yourt/.zcash/zcash.conf \
  --data-dir /home/yourt/lightwalletd_db \
  --log-file /home/yourt/lightwalletd.log \
  --no-tls-very-insecure

# 3. Backend
cd /home/yourt/zchat/apps/backend && pnpm dev

# 4. Admin Dashboard (zsend.xyz/admin)
cd /home/yourt/zchat/apps/landing && pnpm dev

# 5. Web Frontend
cd /home/yourt/zchat/apps/web && pnpm dev

# 6. Cloudflare Tunnel
cloudflared tunnel run zchat
```

## Key Technical Details
- Uses Zcash mainnet (not testnet)
- Wallet uses Orchard shielded pool
- Messages sent via memo field in shielded transactions
- WASM wallet compiled from Rust

## Common Issues
- If lightwalletd fails: check that zebrad RPC is accessible on port 8232
- Zcash.conf location: `/home/yourt/.zcash/zcash.conf` (created for lightwalletd compatibility)

---
## Session Notes

### 2026-01-21 (Continuation) - P2 Quality Improvements

**Completed:**
- ✅ Created ZchatResult<T, E> sealed class with fold, map, flatMap, zip
- ✅ Created ZchatError sealed class hierarchy (Network, Wallet, Crypto, Protocol, Identity, Group)
- ✅ Created LogRedaction.kt (redactAddress, redactSeed, redactKey, redactTxId, etc.)
- ✅ Build successful, APK at Windows Downloads

**New Files:**
- `ui-lib/src/main/java/.../common/result/ZchatResult.kt`
- `ui-lib/src/main/java/.../common/result/ZchatError.kt`
- `ui-lib/src/main/java/.../common/util/LogRedaction.kt`

---

### 2026-01-21 - Identity Regeneration Feature Complete

**Completed:**
- ✅ Implemented Identity Regeneration (Masks) system per user request
- ✅ Created IdentityManager with SharedPreferences storage
- ✅ Two modes: Diversified Address (can switch back) and Full Reset (permanent)
- ✅ Added ADDR protocol for address change notifications
- ✅ Complete UI with mode selection, notification options, confirmation dialogs
- ✅ Build successful, APK at Windows Downloads

**New Files:**
- `ui-lib/src/main/java/.../changeidentity/` - 5 new files (State, View, VM, Screen, IdentityManager)

**Modified Files:**
- ZMSGProtocol.kt, ZMSGConstants.kt, ZchatPreferences.kt
- DataSourceModule.kt, ViewModelModule.kt, WalletNavGraph.kt, MoreVM.kt

**Access:** Settings → More → "Change Identity"

**TODO (P2):** Actual ADDR transaction sending, identity switching UI, per-identity conversation storage

---

### 2026-01-20 (Continuation) - Hostile Audit & Documentation Fixes

**Completed:**
- ✅ Cleaned old APKs (kept latest build only)
- ✅ Fixed dashboard auth issue (localStorage had invalid admin secret)
- ✅ Fixed CONV_ID_LENGTH documentation (docs said 12, code uses 8)
- ✅ Backend tests: 44 passing, Web tests: 18 passing
- ✅ E2EEncryption.kt edge case audit completed

**Documentation Fixes:**
- CONV_ID_LENGTH: 8 chars (not 12 as documented) - updated 7 files
- Character set: A-Z, 0-9 (36 chars, uppercase only)
- ~41 bits entropy - adequate for ZCHAT scale (<100K conversations)
- DEC-006 wording corrected: "planned to increase" not "incorrectly stated"

**Crypto Audit Findings (P2/P3):**
- CRITICAL: SharedKey/nonce length not validated
- HIGH: Base64 decode exceptions uncaught, ECIES null salt
- MEDIUM: Broad exception catching, silent auth failures

**P1 Status Update:**
- ✅ HKDF: Complete (RFC 5869, V1/V2 versioning)
- ✅ KEX: Core complete (sign/verify, message format)
- ✅ ECIES: Core complete (encrypt/decrypt group keys)
- ✅ GROUP_LEAVE: Complete (broadcast implemented)
- ✅ Group History: Complete (load, decrypt, store)
- ⏳ Integration: KEX/ECIES handlers in ViewModels

---

### 2026-01-20 - Phase 7 Audit Complete

**Phase 7 Audit Results:**

**Documentation Consistency:**
- ✅ Fixed DEC-015: sender_hash is 12 chars (documented as 8→16, reality is 12)
- ✅ Fixed DEC-016: Marked as COMPLETE (mnemonic removal already done)
- ✅ HKDF implemented with RFC 5869 compliance (V1/V2 versioning)

**Test Suite:**
- ✅ Backend: 38 tests passing
- ✅ Web: 18 tests passing (fixed truncateAddress test)
- ❌ Android: 0 ZCHAT-specific tests

**Security Hostile Audit Findings:**
- HIGH: Debug logging exposes convIDs and peer addresses (ChatViewModel.kt, ZchatPreferences.kt)
- ✅ FIXED: E2E private keys now stored in EncryptedSharedPreferences (AES256-GCM)
- MEDIUM: No certificate pinning for external APIs
- Crypto: Uses ECDH + AES-GCM (acceptable), but key derivation needs HKDF

**Performance Hostile Audit Findings:**
- HIGH: Preferences loaded on every transaction sync
- HIGH: O(n) conversation lookups with repeated hash computation
- MEDIUM: 500ms blocking delays in group messaging
- MEDIUM: JSON parsing on main thread per group

**Updated P1 Status:**
- sender_hash 16 chars: ✅ 12 chars is adequate
- Backend mnemonic fix: ✅ COMPLETE
- GROUP_LEAVE: 90% done (only send path TODO)
- Remaining: HKDF (3h), Group history (3h), KEX (4h), ECIES (4h)

---

### 2025-12-17 - Services Restart & Android Focus

**Services Started:**
- ✅ Zebrad (PID 2521) - port 8232
- ✅ Lightwalletd (PID 3997) - port 9067
- ✅ Backend API (PID 4447) - port 4000
- ✅ Web Frontend (PID 4569) - port 3000
- ✅ Cloudflare Tunnel (PID 4798) - zchat tunnel

**Log Files:**
- Zebrad: `/home/yourt/zebrad.log`
- Lightwalletd: `/home/yourt/lightwalletd.log`
- Backend: `/home/yourt/backend.log`
- Frontend: `/home/yourt/frontend.log`
- Cloudflared: `/home/yourt/cloudflared.log`

**Key Findings:**
- Android app (`zchat-android`) uses **public lightwalletd** servers (zec.rocks) - no local lightwalletd needed for Android development
- Backend uses local lightwalletd (127.0.0.1:9067)
- Had to run `pnpm install` and `npx prisma generate` for backend after Claude reinstall

**Current Focus:** Android app development in Android Studio

**Public URLs (via Cloudflare):**
- Web App: https://app.zsend.xyz
- API: https://api.zsend.xyz
- Lightwalletd: https://lwd.zsend.xyz

---

### Android App 403 Error - FIXED

**Problem:** Android app getting HTTP 403 from lightwalletd servers
- Public `zec.rocks` servers returned 403
- Cloudflare tunnel (`lwd.zsend.xyz`) returns 403 because gRPC not enabled (API token lacks write permission)

**Root Cause:** The installed APK had package `xyz.zsend.zchat` but source code uses `co.electriccoin.zcash`. Package mismatch likely caused WAF to block requests.

**Solution Applied:**
1. Reverted `LightWalletEndpointProvider.kt` to use public servers only (eu.zec.rocks, zec.rocks, etc.)
2. Removed `lwd.zsend.xyz` (requires Cloudflare gRPC enabled which needs manual dashboard action)
3. Rebuilt app with original package name `co.electriccoin.zcash`

**APK Location:** `/home/yourt/zchat-zashi-debug.apk` (178 MB)

**To Install:**
1. Connect Android device via USB
2. Enable USB debugging on device
3. Run: `$HOME/android-sdk/platform-tools/adb install /home/yourt/zchat-zashi-debug.apk`

Or transfer APK to device and install manually.

**Future:** To use own lightwalletd (`lwd.zsend.xyz`):
- Enable gRPC in Cloudflare Dashboard: Network → gRPC → ON
- Then add `LightWalletEndpoint(host = "lwd.zsend.xyz", port = 443, isSecure = true)` back

