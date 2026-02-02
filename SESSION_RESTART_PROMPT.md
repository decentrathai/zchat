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
10. /home/yourt/zchat-android/docs/DEAD_MANS_SWITCH_RESEARCH.md - Dead Man's Switch feature research
```

---

### STEP 2: CHECK AND START INFRASTRUCTURE (Required)

**CRITICAL: Services are often down after system restart. You MUST check and start them BEFORE any development work.**

#### Quick Health Check (Run This First)
```bash
echo "=== ZCHAT Service Health Check ===" && \
pgrep -f 'cloudflared tunnel' > /dev/null && echo "1. Cloudflare Tunnel: UP" || echo "1. Cloudflare Tunnel: DOWN - CRITICAL" && \
curl -s http://localhost:4000/health > /dev/null && echo "2. Backend API (4000): UP" || echo "2. Backend API (4000): DOWN" && \
curl -s http://localhost:3002 > /dev/null && echo "3. Landing Page (3002): UP" || echo "3. Landing Page (3002): DOWN" && \
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

# 3. LANDING PAGE (port 3002) - Landing page with admin panel at /admin
#    This serves zsend.xyz and zsend.xyz/admin for managing whitelist
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
    +-> zsend.xyz       --> Landing Page (localhost:3002)
    |                        |
    |                        +-> /admin route --> Admin Dashboard
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
```

**Note:** ALL zsend.xyz sites are served via Cloudflare Tunnel (NOT Cloudflare Pages).
If zsend.xyz is down, check that port 3002 (landing) is running.

#### Verify Public URLs After Starting
```bash
echo "Testing public URLs..." && \
curl -s https://zsend.xyz | head -c 100 && echo "... zsend.xyz OK" && \
curl -s https://api.zsend.xyz/health | head -c 100 && echo "... api.zsend.xyz OK"
```

Expected results:
- https://zsend.xyz - Landing page (via Cloudflare Tunnel → localhost:3002)
- https://api.zsend.xyz - Backend API (should return `{"ok":true}`)
- https://app.zsend.xyz - Web app (if frontend started)

#### Log Files for Debugging
```
~/cloudflared.log     - Tunnel logs (check for connection errors)
~/backend.log         - Backend API logs (check for startup errors)
~/landing.log         - Landing page logs (port 3002)
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
| Android seed storage | ✅ SECURE | EncryptedSharedPreferences with AES256-GCM |
| E2E key derivation | ✅ FIXED | HKDF implemented (RFC 5869, V1/V2 versioning) |
| KEX Protocol | ✅ COMPLETE | Signed key exchange prevents MITM |
| ECIES Group Keys | ✅ COMPLETE | Per-recipient encrypted group keys |
| Identity Regeneration | ✅ COMPLETE | Diversified addresses + ADDR protocol |
| Web app ZMSG protocol | MISSING | Cannot interoperate with Android |
| Web app strategy | Option C | Secondary platform, syncs from mobile |
| **Backend Security** | **✅ COMPLETE** | **3-round hostile audit, 33 fixes, 44 tests passing** |

---

### STEP 4: CURRENT IMPLEMENTATION STATUS

**P1 (Release Critical) is COMPLETE (2026-01-21).** All core security features implemented.

**Recent Work (2026-02-02):**

#### Cyberpunk UI Theme
- ✅ Custom icons (16 assets) integrated from Nano Banana Pro
- ✅ Splash screen background: `#0D0B1A` (cyberpunk deep purple)
- ✅ Color palette: bgDeep, bgPrimary, bgSecondary, accentCyan, accentMagenta
- ✅ Orbitron font for cyberpunk typography
- ✅ Glassmorphism effects via Haze library
- ✅ APK size: 237MB (4K icons)

#### Admin Dashboard Enhancements
- ✅ Delete button for whitelist entries (with confirmation modal)
- ✅ Custom message field in approval modal (appears in email)
- ✅ "Already registered" notification for duplicate email submissions

#### Backend Fixes
- ✅ CORS methods explicitly include DELETE
- ✅ Custom JSON parser handles empty bodies with Content-Type header
- ✅ HTML escaping via `escapeHtml()` for custom email messages

#### Dead Man's Switch Research
- ✅ Comprehensive research document: `/home/yourt/zchat-android/docs/DEAD_MANS_SWITCH_RESEARCH.md`
- Architecture: AlarmManager + WorkManager backup + Boot receiver
- Remote cancellation via Zcash transaction
- iOS implementation notes (BGTaskScheduler limitations)

**Latest APK:**
- Version: `zchat-v2.8.1-cyberpunk-20260202.apk`
- Location: `/home/yourt/zchat-v2.8.1-cyberpunk-20260202.apk`
- Size: 237MB

---

### STEP 5: WHITELIST & DOWNLOAD SYSTEM

**Admin Dashboard:** https://zsend.xyz/admin

**Admin Secret (stored in localStorage):**
```
b5a0a9be7f25d75b8402370a9176fec75c987c9a80a6134c65edab727e04ecff
```

**Flow:**
1. User requests access at zsend.xyz → submits email + reason
2. Request appears in admin dashboard (click Refresh to see new entries)
3. Admin clicks "Approve & Send" → modal with optional custom message
4. Code generated (8 chars) and emailed via Resend
5. User enters code at zsend.xyz → downloads APK

**APK Location for Download System:**
- Backend serves from: `/home/yourt/` (APK_DIR)
- Pattern: `*zchat*.apk` sorted by modification time (newest first)

**API Endpoints:**
- `POST /whitelist/join` - Submit whitelist request
- `GET /admin/whitelist` - List all entries (requires X-Admin-Secret header)
- `POST /admin/whitelist/:id/generate-code` - Generate download code
- `POST /admin/whitelist/:id/send-code-email` - Send email with optional customMessage
- `DELETE /admin/whitelist/:id` - Delete entry
- `POST /download/verify-code` - Verify code and get download token
- `GET /download/apk/:token` - Download APK (one-time token)

---

### STEP 6: PROJECT STRUCTURE

```
/home/yourt/zchat/               # Main monorepo
+-- apps/
|   +-- backend/                 # Node.js API (port 4000) - PRODUCTION READY
|   +-- web/                     # Next.js frontend (port 3000)
|   +-- landing/                 # Landing page + Admin (port 3002)
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
+-- ui-design-lib/               # Design system + Cyberpunk assets
+-- sdk-ext-lib/                 # SDK extensions
+-- docs/
|   +-- DEAD_MANS_SWITCH_RESEARCH.md  # DMS feature research
```

---

### STEP 7: ANDROID BUILD COMMANDS

```bash
cd /home/yourt/zchat-android

# Build debug APK
ANDROID_HOME="$HOME/android-sdk" \
ANDROID_SDK_ROOT="$HOME/android-sdk" \
JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64" \
./gradlew assembleZcashmainnetFossDebug

# Quick compile check (faster)
./gradlew :ui-lib:compileZcashmainnetFossDebugSources

# Copy APK to Windows Downloads
cp app/build/outputs/apk/zcashmainnetFoss/debug/*.apk /mnt/c/Users/yourt/Downloads/

# Copy APK to download system location
cp app/build/outputs/apk/zcashmainnetFoss/debug/*.apk /home/yourt/

# Install to connected device
$HOME/android-sdk/platform-tools/adb install app/build/outputs/apk/zcashmainnetFoss/debug/*.apk
```

---

### STEP 8: RUN TESTS

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

### STEP 9: CODING STANDARDS (Always Follow)

**Boris Cherny TypeScript/Kotlin Principles:**

1. **No `any` types** - Use discriminated unions / sealed classes
2. **Result types for errors** - Return `ZchatResult<T, E>`, never throw
3. **Exhaustiveness checking** - All switch/when must be exhaustive
4. **Value types** - Branded types / value classes for domain concepts (ZcashAddress, Zatoshi)
5. **Immutability by default** - `val` over `var`, `readonly`, `Readonly<T>`
6. **Zod validation at boundaries** - Validate all external input

See DEVELOPMENT_STANDARDS.md for complete reference with code examples.

---

### STEP 10: UPCOMING FEATURES

**Dead Man's Switch (Researched, Not Implemented):**
- Timer-based self-destruct for high-risk users
- Survives app kill, device sleep, reboot
- Cancellation via local code or remote Zcash transaction
- See: `/home/yourt/zchat-android/docs/DEAD_MANS_SWITCH_RESEARCH.md`

**P2 Tasks (Current Phase):**
| Task | File | Time | Status |
|------|------|------|--------|
| Error handling (ZchatResult) | common/result/* | 4h | ✅ COMPLETE |
| Logging redaction | common/util/LogRedaction.kt | 2h | ✅ COMPLETE |
| ADDR transaction sending | ChangeIdentityVM.kt | 2h | Not started |
| Identity switching UI | changeidentity/* | 3h | Not started |
| Dead Man's Switch | New files | 8h | Researched |

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
6. **Ask user** what they wants to work on if unclear

**Last session work (2026-02-02):**
- ✅ Cyberpunk UI theme complete (splash, icons, colors)
- ✅ Admin dashboard: delete button + custom message in approval emails
- ✅ Backend: CORS DELETE fix, empty JSON body handling, HTML escaping
- ✅ Dead Man's Switch: comprehensive research document
- ✅ Built APK v2.8.1-cyberpunk-20260202 (237MB)
- ✅ Responded to Grok's security analysis with technical corrections

**Next recommended tasks:**
- Implement Dead Man's Switch (Phase 1: Core Timer)
- P2: ADDR transaction sending integration
- P2: Identity switching UI
- Reduce APK size (optimize 4K icons)

## END OF PROMPT

---

**Usage:** Copy everything between "START OF PROMPT" and "END OF PROMPT" into a new Claude Code session.

**File location:** `/home/yourt/zchat/SESSION_RESTART_PROMPT.md`

*Last updated: 2026-02-02*
