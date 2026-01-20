# ZCHAT Session Restart Prompt

**Copy everything below the line to start a new Claude Code session.**

---

## START OF PROMPT

You are continuing work on ZCHAT, a privacy-first messaging application built on Zcash shielded transactions. This is an ongoing project with established documentation, architecture, and coding standards.

**Methodology Status:** Phase 1 (Product Document Formation) is COMPLETE. Now in Implementation Phase.

---

### STEP 1: READ DOCUMENTATION (Required - In This Order)

Read these files before doing anything else:

```
1. /home/yourt/zchat/CLAUDE.md                    - Infrastructure, services, commands (ALWAYS FIRST)
2. /home/yourt/zchat/IMPLEMENTATION_STEPS.md      - Current progress, next steps, session log
3. /home/yourt/zchat/PRODUCT.md                   - Product vision, features, roadmap (v2.0)
4. /home/yourt/zchat/ARCHITECTURE.md              - Technical architecture, protocols, data flows
5. /home/yourt/zchat/ANDROID_FIX_PLAN.md          - Detailed fix plans, NOSTR integration spec
6. /home/yourt/zchat/DEVELOPMENT_STANDARDS.md     - Boris Cherny principles, TypeScript/Kotlin standards
7. /home/yourt/zchat/DECISIONS.md                 - Key architectural decisions with reasoning
8. /home/yourt/zchat/ISSUES_TO_FIX.md             - Audit findings, prioritized issues
9. /home/yourt/zchat/ANDROID_TEST_REQUIREMENTS.md - Android test specs (when writing tests)
```

---

### STEP 2: CHECK AND START INFRASTRUCTURE (Required)

**CRITICAL: Services are often down after system restart. You MUST check and start them BEFORE any development work.**

#### Quick Health Check (Run This First)
```bash
echo "=== ZCHAT Service Health Check ===" && \
pgrep -f 'cloudflared tunnel' > /dev/null && echo "1. Cloudflare Tunnel: UP" || echo "1. Cloudflare Tunnel: DOWN - CRITICAL" && \
curl -s http://localhost:4000 > /dev/null && echo "2. Backend API (4000): UP" || echo "2. Backend API (4000): DOWN" && \
curl -s http://localhost:3002 > /dev/null && echo "3. Admin Dashboard (3002): UP" || echo "3. Admin Dashboard (3002): DOWN" && \
curl -s http://127.0.0.1:8232 > /dev/null && echo "4. Zebrad (8232): UP" || echo "4. Zebrad (8232): DOWN" && \
pgrep -f lightwalletd > /dev/null && echo "5. Lightwalletd (9067): UP" || echo "5. Lightwalletd (9067): DOWN" && \
curl -s http://localhost:3000 > /dev/null && echo "6. Web Frontend (3000): UP" || echo "6. Web Frontend (3000): DOWN (optional)"
```

#### Start All Services (If Any Are Down)

**Option A: Use the startup script (recommended)**
```bash
/home/yourt/start-zchat-services.sh
```

**Option B: Start manually in this exact order:**

```bash
# 1. CLOUDFLARE TUNNEL - Routes api.zsend.xyz and app.zsend.xyz to local services
#    WITHOUT THIS, the public API and web app are completely DOWN
nohup cloudflared tunnel run zchat > ~/cloudflared.log 2>&1 &

# 2. BACKEND API (port 4000) - Handles whitelist signups, API endpoints
#    First time after reinstall may need: cd ~/zchat/apps/backend && pnpm install && npx prisma generate
cd ~/zchat/apps/backend && nohup pnpm dev > ~/backend.log 2>&1 &

# 3. ADMIN DASHBOARD (port 3002) - Landing page with admin panel at /admin
#    This serves zsend.xyz/admin for managing whitelist
cd ~/zchat/apps/landing && nohup pnpm dev > ~/landing.log 2>&1 &

# 4. ZEBRAD - Zcash blockchain node (port 8232)
#    Required for wallet operations. Takes time to sync if stopped.
nohup zebrad start > ~/zebrad.log 2>&1 &

# 5. LIGHTWALLETD (port 9067) - gRPC interface for wallets
#    MUST wait for Zebrad to be ready first (check port 8232)
#    Required for Android app sync via backend
/home/yourt/go/bin/lightwalletd \
  --zcash-conf-path /home/yourt/.zcash/zcash.conf \
  --data-dir /home/yourt/lightwalletd_db \
  --log-file /home/yourt/lightwalletd.log \
  --no-tls-very-insecure &

# 6. WEB FRONTEND (port 3000) - Optional, only if working on web app
cd ~/zchat/apps/web && nohup pnpm dev > ~/frontend.log 2>&1 &
```

#### Service Dependencies Diagram
```
Internet
    |
    v
Cloudflare Tunnel (zchat)
    |
    +-> api.zsend.xyz   --> Backend API (localhost:4000) --> PostgreSQL
    |                                |
    |                                v
    |                         Lightwalletd (localhost:9067)
    |                                |
    |                                v
    |                         Zebrad (localhost:8232) --> Zcash Blockchain
    |
    +-> app.zsend.xyz   --> Web Frontend (localhost:3000)
    |
    +-> lwd.zsend.xyz   --> Lightwalletd (localhost:9067)

Cloudflare Pages (separate)
    |
    +-> zsend.xyz       --> Landing page (static export)
                             |
                             +-> /admin route --> Admin Dashboard (localhost:3002)
```

**Note:** The landing page at zsend.xyz is deployed via Cloudflare Pages (static).
The /admin dashboard requires the local landing app (port 3002) to be running
and routed through the Cloudflare tunnel.

#### Verify Public URLs After Starting
```bash
echo "Testing public URLs..." && \
curl -s https://zsend.xyz | head -c 100 && echo "... zsend.xyz OK" && \
curl -s https://api.zsend.xyz | head -c 100 && echo "... api.zsend.xyz OK"
```

Expected results:
- https://zsend.xyz - Landing page (served by Cloudflare Pages, always up)
- https://api.zsend.xyz - Backend API (should return JSON)
- https://app.zsend.xyz - Web app (if frontend started)

#### Log Files for Debugging
```
~/cloudflared.log     - Tunnel logs (check for connection errors)
~/backend.log         - Backend API logs (check for startup errors)
~/landing.log         - Admin dashboard logs (port 3002)
~/zebrad.log          - Zcash node logs (check sync status)
~/lightwalletd.log    - Wallet server logs
~/frontend.log        - Web frontend logs
~/zchat-health.log    - Auto-recovery logs (cron runs every 5 min)
```

---

### STEP 3: KEY VERIFIED FACTS (DO NOT RE-AUDIT)

These were verified during hostile audit. Accept them as true:

| Fact | Status | Details |
|------|--------|---------|
| Android seed storage | SECURE | EncryptedSharedPreferences with AES256-GCM |
| E2E key derivation | NEEDS FIX | Uses weak SHA-256, needs HKDF (P1 priority) |
| Web app ZMSG protocol | MISSING | Cannot interoperate with Android |
| Web app strategy | Option C | Secondary platform, syncs from mobile |
| **Backend Security** | **COMPLETE** | **3-round hostile audit, 33 fixes, 44 tests passing** |

**File with security issue:** `/home/yourt/zchat-android/.../E2EEncryption.kt` lines 87-91

---

### STEP 4: CURRENT IMPLEMENTATION PHASE

**Backend audit is COMPLETE (2026-01-20).** 33 security fixes across 3 rounds. All tests passing.

**Phase:** P1 - Release Critical (17 hours remaining) - Android work

| Task | File | Time | Status |
|------|------|------|--------|
| HKDF key derivation | E2EEncryption.kt | 3h | Not started |
| Group history loading | GroupViewModel.kt | 3h | Not started |
| GROUP_LEAVE broadcast | GroupViewModel.kt | 2h | Not started |
| KEX protocol | E2EEncryption.kt | 4h | Not started |
| Group key ECIES | GroupCrypto.kt | 4h | Not started |
| sender_hash 16 chars | ZMSGProtocol.kt | 1h | Not started |
| ~~Backend mnemonic fix~~ | ~~wallet.ts~~ | ~~1h~~ | **DONE** (audit) |

Check IMPLEMENTATION_STEPS.md for detailed task breakdown with checkboxes.

**Implementation Rules (for each step):**
1. **Implement** -> 2. **Test** -> 3. **Mark Progress** -> 4. **Document deviations**

---

### STEP 5: PROJECT STRUCTURE

```
/home/yourt/zchat/               # Main monorepo
+-- apps/
|   +-- backend/                 # Node.js API (port 4000) - PRODUCTION READY
|   +-- web/                     # Next.js frontend (port 3000)
|   +-- landing/                 # Landing page (Cloudflare Pages)
+-- packages/
|   +-- wallet-core/             # Rust WASM wallet
+-- CLAUDE.md                    # Project context (read first)
+-- IMPLEMENTATION_STEPS.md      # Current tasks
+-- PRODUCT.md                   # Product vision (v2.0)
+-- ARCHITECTURE.md              # Technical architecture
+-- ANDROID_FIX_PLAN.md          # Fix plans + NOSTR spec
+-- DEVELOPMENT_STANDARDS.md     # Coding standards
+-- DECISIONS.md                 # Decision log
+-- ISSUES_TO_FIX.md             # Audit findings

/home/yourt/zchat-android/       # Android app (Zashi fork) - PRIMARY PLATFORM
+-- app/                         # Main Android module
+-- ui-lib/                      # UI components (Compose)
+-- sdk-ext-lib/                 # SDK extensions
```

---

### STEP 6: ANDROID BUILD COMMANDS

```bash
cd /home/yourt/zchat-android

# Build debug APK
ANDROID_HOME="$HOME/android-sdk" \
ANDROID_SDK_ROOT="$HOME/android-sdk" \
JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64" \
./gradlew assembleDebug

# Quick compile check (faster)
./gradlew :ui-lib:compileZcashmainnetFossReleaseSources

# Copy APK to Windows Downloads
cp app/build/outputs/apk/zcashmainnetFoss/debug/*.apk /mnt/c/Users/yourt/Downloads/

# Install to connected device
$HOME/android-sdk/platform-tools/adb install app/build/outputs/apk/zcashmainnetFoss/debug/*.apk
```

---

### STEP 6.5: RUN TESTS

```bash
# Backend tests (44 tests - API, auth, validation, security)
cd /home/yourt/zchat/apps/backend && pnpm test

# Web frontend tests (18 tests - utilities)
cd /home/yourt/zchat/apps/web && pnpm test
```

**Test Coverage:**
| Platform | Tests | Status |
|----------|-------|--------|
| Backend API | 44 | PASSING (audit complete) |
| Web Frontend | 18 | PASSING |
| Android (ZCHAT) | 0 | CRITICAL GAP |

**Note:** Android has 51 test files but ALL are from Zashi. See `ANDROID_TEST_REQUIREMENTS.md` for ZCHAT test specs.

---

### STEP 7: CODING STANDARDS (Always Follow)

**Boris Cherny TypeScript/Kotlin Principles:**

1. **No `any` types** - Use discriminated unions / sealed classes
2. **Result types for errors** - Return `ZchatResult<T, E>`, never throw
3. **Exhaustiveness checking** - All switch/when must be exhaustive
4. **Value types** - Branded types / value classes for domain concepts (ZcashAddress, Zatoshi)
5. **Immutability by default** - `val` over `var`, `readonly`, `Readonly<T>`
6. **Zod validation at boundaries** - Validate all external input

See DEVELOPMENT_STANDARDS.md for complete reference with code examples.

---

### STEP 8: METHODOLOGY COMPLIANCE

This project follows the "AI-Assisted Product Development Methodology":

1. **Phase 1 (Product Document Formation)** - COMPLETE (PRODUCT.md v2.0)
2. **Phase 2 (Architectural Consistency)** - COMPLETE (hostile audit done)
3. **Phase 3 (CLAUDE.md Formation)** - COMPLETE
4. **Phase 4 (System Prompt)** - Embedded in CLAUDE.md
5. **Phase 5 (Implementation Planning)** - COMPLETE (IMPLEMENTATION_STEPS.md)
6. **Phase 6 (Codebase Consistency)** - Do during implementation
7. **Phase 7 (Periodic Audits)** - Every 3-4 features

**Rules:**
- Always update IMPLEMENTATION_STEPS.md after completing work
- Log decisions in DECISIONS.md when making architectural choices
- Before fixing issues, verify they're not false positives (Double-Check Protocol)
- Never commit unless user explicitly requests

---

### WHAT TO DO NOW

1. **Read documentation** (Step 1) - Start with CLAUDE.md
2. **Run health check** (Step 2) - Check all services
3. **Start any down services** (Step 2) - Especially Cloudflare Tunnel and Backend
4. **Check IMPLEMENTATION_STEPS.md** - Find current task
5. **Report status** to user:
   - Which services are up/down
   - Current implementation phase
   - What was the last completed task
   - What should be worked on next
6. **Ask user** what they want to work on if unclear

**Last completed work (2026-01-20):**
- Backend hostile audit Round 3 complete (11 fixes)
- Total: 33 security fixes across 3 rounds
- All 44 backend tests passing
- Backend is PRODUCTION READY

**Next recommended task:**
- P1.1: HKDF Key Derivation Fix in Android (`E2EEncryption.kt`)

## END OF PROMPT

---

**Usage:** Copy everything between "START OF PROMPT" and "END OF PROMPT" into a new Claude Code session.

**File location:** `/home/yourt/zchat/SESSION_RESTART_PROMPT.md`

*Last updated: 2026-01-20*
