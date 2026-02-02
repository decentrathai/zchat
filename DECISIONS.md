# ZCHAT Architectural Decisions Log

**Version:** 1.2
**Created:** 2026-01-19
**Updated:** 2026-02-02
**Purpose:** Document all significant architectural and product decisions with reasoning

---

## How to Use This Document

Each decision follows this format:
- **ID**: Unique identifier (DEC-XXX)
- **Date**: When decision was made
- **Status**: Active | Superseded | Deprecated
- **Context**: What prompted this decision
- **Decision**: What was decided
- **Alternatives Considered**: What other options existed
- **Consequences**: Trade-offs and implications

---

## Platform Decisions

### DEC-001: Android as Primary Platform

**Date:** 2026-01-18
**Status:** Active

**Context:**
Web app lacks ZMSG protocol support. Significant effort (40-80 hours) required for feature parity. Resources are limited.

**Decision:**
Focus development on Android first. Web app is secondary platform (Option C from ISSUES_TO_FIX.md).

**Alternatives Considered:**
- Option A: Full web parity (40-80 hours)
- Option B: Deprecate web entirely
- Option C: Web as secondary ← **Selected**

**Consequences:**
- Android gets NOSTR features first
- Web limited to basic messaging (no groups, special messages)
- Reduced maintenance burden
- Web users sync from mobile device

---

### DEC-002: Single Seed for Zcash + NOSTR

**Date:** 2026-01-19
**Status:** Active

**Context:**
NOSTR integration requires secp256k1 keypair. Users already have BIP39 seed for Zcash wallet.

**Decision:**
Derive both identities from single BIP39 seed using different derivation paths:
- `m/44'/133'/0'/0/0` → Zcash unified address
- `m/44'/1237'/0'/0/0` → NOSTR secp256k1 keypair

**Alternatives Considered:**
- Separate seeds for each protocol (user manages two seeds)
- NOSTR-only identity (no Zcash link)

**Consequences:**
- User manages single seed phrase
- Both identities cryptographically linked
- Single backup covers both
- If seed compromised, both identities compromised

---

## Security Decisions

### DEC-003: Android Seed Storage is Secure (No Changes Needed)

**Date:** 2026-01-19
**Status:** Active (Verified False Positive)

**Context:**
Initial audit flagged potential seed file security issue. Investigation revealed Zcash SDK already handles this.

**Decision:**
Keep existing Zcash SDK storage. No custom encryption needed.

**Technical Verification:**
- Storage: `EncryptedSharedPreferences` → `co.electriccoin.zcash.encrypted.xml`
- Encryption: AES256-GCM (MasterKey) + AES256-SIV (keys) + AES256-GCM (values)
- Files: `PersistableWalletProvider.kt`, `EncryptedPreferenceProvider.kt`

**Consequences:**
- Saves 4+ hours of unnecessary work
- Maintains SDK compatibility
- No custom security code to maintain

---

### DEC-004: HKDF Required for E2E Key Derivation

**Date:** 2026-01-19
**Status:** Active (P1 Priority)

**Context:**
Current E2E encryption uses SHA-256 digest only, not proper HKDF. This is cryptographically weak.

**Decision:**
Implement RFC 5869 HKDF with backward compatibility for existing conversations.

**Technical Details:**
- New conversations: HKDF v2 with salt and proper extract/expand phases
- Existing conversations: Legacy v1 (SHA-256 digest) for decryption
- Store key version per peer in `ZchatPreferences`

**Consequences:**
- Improved cryptographic security
- Backward compatible with existing encrypted content
- Adds complexity for version negotiation
- ~3 hours implementation time

---

### DEC-005: Web App Seed Storage - sessionStorage Only

**Date:** 2026-01-19
**Status:** Pending Implementation

**Context:**
Current web app stores seed in localStorage (accessible to any JS, survives browser close).

**Decision:**
Move to sessionStorage (cleared on browser close) or React state only.

**Consequences:**
- User must re-enter seed each session
- Significantly reduced XSS attack surface
- No persistent wallet in browser

---

## Protocol Decisions

### DEC-006: 8-Character Alphanumeric Conversation IDs

**Date:** 2026-01-19
**Status:** Active (Implementation uses 8 chars, not 12 as originally planned)

**Context:**
Original design planned to increase from 8 to 12 characters. After review, 8 characters was kept for message space efficiency.

**Decision:**
Use 8 uppercase alphanumeric characters (A-Z, 0-9) providing ~41 bits entropy.

**Math:**
```
log2(36^8) = 41.4 bits
Collision probability at 100K conversations: ~10^-6
```

**Note (2026-01-20 Audit):** Original DEC-006 planned to increase from 8→12 chars for better collision resistance. The implementation has always used 8 chars (ZMSGConstants.kt). For ZCHAT's scale (<100K conversations), 8 chars is adequate and no migration needed.

**Consequences:**
- Acceptable collision risk for current scale
- More space for message content (+4 bytes vs 12-char design)
- No migration needed (original implementation was always 8 chars)

---

### DEC-007: secp256r1 for E2E, X25519 Deferred

**Date:** 2026-01-19
**Status:** Active (May Change with NOSTR)

**Context:**
E2E encryption uses ECDH with secp256r1 (NIST P-256). X25519 is generally preferred.

**Decision:**
Keep secp256r1 for now. Consider X25519 migration during NOSTR integration (can share key infrastructure).

**Reasoning:**
- secp256r1 is still secure
- NOSTR uses secp256k1, so key infrastructure will change anyway
- Avoid two migrations

**Consequences:**
- Current E2E remains functional
- NOSTR integration may require key infrastructure refactor
- Deferred complexity

---

## Technology Decisions

### DEC-008: Blossom for File Storage

**Date:** 2026-01-19
**Status:** Active (Planned)

**Context:**
NOSTR integration requires file sharing capability. Multiple storage options available.

**Decision:**
Use Blossom Protocol for file storage.

**Alternatives Considered:**
| Option | Verdict |
|--------|---------|
| Blossom | **Selected** - Native NOSTR, SHA-256 addressing |
| IPFS | Too complex, not NOSTR-native |
| Storj | Centralized billing |
| Arweave | Unnecessary permanence, token costs |

**Consequences:**
- Native NOSTR integration
- Content-addressed by SHA-256
- Metadata stripping via BUD-05
- Fewer servers available (newer protocol)

---

### DEC-009: rust-nostr SDK for Android

**Date:** 2026-01-19
**Status:** Active (Planned)

**Context:**
Multiple NOSTR libraries available for Android development.

**Decision:**
Use rust-nostr (Kotlin bindings) version 0.13.0-alpha.2.

**Reasoning:**
- Mature, well-maintained
- Native Kotlin API
- ~15MB APK size with ABI split
- Same codebase can be used for iOS

**Consequences:**
- Adds native dependency
- Increases APK size
- Benefits from Rust memory safety

---

### DEC-010: WebRTC via NOSTR Relays for Calls

**Date:** 2026-01-19
**Status:** Active (Planned)

**Context:**
Audio/video calls require WebRTC signaling. Need to choose signaling infrastructure.

**Decision:**
Use NOSTR relays with ephemeral events (kind 25050-25051) for WebRTC signaling.

**Alternatives Considered:**
- Trystero (JS only, for web)
- Matrix (overkill)
- Custom signaling server (maintenance burden)

**Consequences:**
- Reuses existing NOSTR relay infrastructure
- Decentralized signaling
- Ephemeral events don't pollute relay storage
- Need to handle relay availability

---

## Development Decisions

### DEC-011: Boris Cherny TypeScript Principles Apply to Kotlin Too

**Date:** 2026-01-19
**Status:** Active

**Context:**
Project uses both TypeScript (web/backend) and Kotlin (Android). Need consistent coding standards.

**Decision:**
Apply Boris Cherny's "Programming TypeScript" principles to both languages via DEVELOPMENT_STANDARDS.md.

**Key Principles Applied:**
- Discriminated unions / Sealed classes
- Result types for error handling
- No `any` / Runtime type assertions
- Value types / Branded types
- Exhaustiveness checking
- Immutability by default
- Zod validation at boundaries

**Consequences:**
- Consistent patterns across platforms
- Easier code review
- Type-safe codebase
- Slightly more verbose code

---

### DEC-012: Priority System (P0-P3)

**Date:** 2026-01-19
**Status:** Active

**Context:**
Need clear prioritization for development tasks.

**Decision:**
Use 4-tier priority system:

| Priority | Meaning | Timeline |
|----------|---------|----------|
| P0 | Security Blocker | Immediate |
| P1 | Release Critical | Days 1-2 |
| P2 | Quality | Week 2 |
| P3 | Future | Backlog |

**Current Status:**
- **No P0 items** - App is demo-ready for security
- P1: HKDF (3h), Group History (3h), GROUP_LEAVE (2h)
- P2: Per-recipient group key, error handling, logging

---

## Superseded Decisions

### DEC-S01: Custom Seed Encryption for Android (SUPERSEDED by DEC-003)

**Date:** 2026-01-18
**Status:** Superseded

**Original Decision:**
Implement custom AES-256-GCM encryption for seed file.

**Why Superseded:**
Investigation revealed Zcash SDK already provides this via EncryptedSharedPreferences.

---

## Decisions from Architecture Consistency Review (v3.1)

### DEC-013: Authenticated Key Exchange (KEX) Protocol

**Date:** 2026-01-19
**Status:** Active (P1 Priority)

**Context:**
Architecture review identified that current E2E key exchange sends unsigned public keys. This allows MITM attacks where an attacker intercepts and replaces public keys.

**Decision:**
Implement KEX message type with cryptographic signature binding to Zcash identity.

**Format (ZMSG v4):**
```
ZMSG|4|KEX|<conv_id>|<sender_hash>|<pubkey_b64>|<signature_b64>
```

**Technical Details:**
- Signature created over `SHA256("ZCHAT_KEX_V1:" + pubkey_base64)`
- Signed using Zcash spending key (secp256k1)
- Verified against sender's Zcash address before accepting key

**Consequences:**
- MITM attacks prevented
- Public key bound to Zcash identity
- Adds 4h implementation time to P1
- Requires spending key access during key exchange

---

### DEC-014: Group Key ECIES Encryption (Elevated to P1)

**Date:** 2026-01-19
**Status:** Active (P1 Priority - Elevated from P2)

**Context:**
Architecture review found that group keys are sent as plaintext base64 in GROUP_INVITE messages. Anyone who can read the memo (blockchain observers with enough resources) can extract group keys.

**Decision:**
Encrypt group key using ECIES (Elliptic Curve Integrated Encryption Scheme) for each recipient.

**Why Elevated from P2:**
- Security critical: plaintext group keys compromise all group message confidentiality
- Blockchain data is permanent - any leaked keys allow historical decryption

**Implementation:**
- Ephemeral keypair per encryption
- ECDH shared secret → HKDF → AES-GCM
- Each member receives group invite with key encrypted to their public key

**Consequences:**
- Group keys protected even if memo is exposed
- Requires storing member public keys
- Adds 4h implementation time to P1

---

### DEC-015: sender_hash Length

**Date:** 2026-01-19
**Status:** Active (Verified Implementation)

**Context:**
Original design considered 8 characters. Collision risk analysis showed this was insufficient.

**Decision:**
Use 12 hex characters (6 bytes of SHA-256) providing ~48 bits entropy.

**Current Implementation (ZMSGProtocol.kt:53-57, ZMSGConstants.kt:28-29):**
```kotlin
fun generateAddressHash(address: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val hashBytes = digest.digest(address.toByteArray())
    return hashBytes.take(6).joinToString("") { "%02x".format(it) }  // 12 chars
}
const val HASH_LENGTH = 12
```

**Math:**
```
12 chars (48 bits): collision at ~2^24 = 16M messages (acceptable)
```

**Note:** Original decision mentioned 8→16 chars, but implementation uses 12 chars.
This provides acceptable collision resistance while keeping message overhead minimal.

**Consequences:**
- 12-byte sender_hash per message
- Acceptable collision risk for expected scale
- No change needed

---

### DEC-016: Remove Mnemonic from Backend API

**Date:** 2026-01-19
**Status:** ✅ COMPLETE (Verified 2026-01-20)

**Context:**
Backend `/me/wallet` endpoint should never return mnemonic. This is a security antipattern.

**Decision:**
Remove mnemonic from all API responses. Client should never request mnemonic from server.

**Implementation Verification (Phase 7 Audit):**
- `/me/wallet` endpoint accepts only `address: string`, returns `{ id, username, primaryAddress }`
- No mnemonic field in Prisma User model
- `importWallet()` function in wallet.ts is DISABLED and throws error
- All API routes verified - none return mnemonic

**Rationale:**
- Mnemonic is client-side only after initial generation
- Server storing mnemonic violates privacy model
- Reduces attack surface if API is compromised

**Consequences:**
- No breaking changes - backend never had this exposure in production

---

## UI/UX Decisions

### DEC-017: Cyberpunk UI Theme

**Date:** 2026-02-02
**Status:** Active (Implemented)

**Context:**
ZCHAT needed a distinctive visual identity separate from the original Zashi wallet. Target users (privacy-conscious, technical) respond well to cyberpunk aesthetics.

**Decision:**
Implement a comprehensive cyberpunk theme with:
- Custom icons from Nano Banana Pro (16 assets, 4K resolution)
- Dark color palette: bgDeep (#0D0B1A), bgPrimary (#1A1625), accentCyan (#00D9FF), accentMagenta (#FF006E)
- Orbitron font for cyberpunk typography
- Glassmorphism effects via Haze library

**Alternatives Considered:**
- Keep Zashi's original design (too generic)
- Minimal dark theme (not distinctive enough)
- Neon-heavy design (too visually noisy)

**Consequences:**
- Distinctive brand identity
- APK size increased to 237MB (4K icons)
- May need icon optimization for APK size reduction
- Splash screen uses cyberpunk deep purple (#0D0B1A)

---

### DEC-018: Dead Man's Switch Architecture

**Date:** 2026-02-02
**Status:** Active (Researched, Implementation Pending)

**Context:**
High-risk users (journalists, activists) need automatic data destruction if they're detained/arrested and cannot manually destroy data.

**Decision:**
Implement Dead Man's Switch using hybrid approach:
- Primary: `AlarmManager.setExactAndAllowWhileIdle()` for exact timing in Doze mode
- Backup: `WorkManager` periodic check every 15 minutes
- Recovery: `BroadcastReceiver` for BOOT_COMPLETED to restore timer after reboot
- Remote cancellation via Zcash shielded transaction with secret code

**Technical Details:**
- Timer state stored in persistent preferences
- Dual clock validation (wall clock + elapsed realtime) to detect time manipulation
- Cancellation via local code or remote `ZCHAT_DMS_CANCEL:<code>` transaction
- Leverages existing `DestroyManager` for complete data wipe

**Alternatives Considered:**
- WorkManager only (not reliable for exact timing)
- Foreground service (high battery drain)
- Server-based dead man's switch (requires online, defeats purpose)

**Consequences:**
- Works offline (critical for high-risk scenarios)
- Survives device reboot
- May require battery optimization exemption
- iOS implementation more limited (BGTaskScheduler)

**Reference:** `/home/yourt/zchat-android/docs/DEAD_MANS_SWITCH_RESEARCH.md`

---

### DEC-019: Admin Dashboard Whitelist Management

**Date:** 2026-02-02
**Status:** Active (Implemented)

**Context:**
Admin dashboard needed enhanced controls for managing whitelist entries beyond just approval.

**Decision:**
Add delete functionality and custom approval messages:
- Delete button with confirmation modal for removing entries
- Custom message field in approval modal (appears in email body)
- Backend: CORS DELETE method, HTML escaping for custom messages, empty JSON body handling

**Technical Details:**
- `DELETE /admin/whitelist/:id` endpoint with X-Admin-Secret auth
- `escapeHtml()` function for safe HTML rendering in emails
- Custom JSON parser to handle empty bodies with Content-Type header

**Consequences:**
- Admins can clean up duplicate/spam entries
- Personalized approval emails improve user experience
- Backend handles edge cases (empty bodies, HTML injection)

---

## Pending Decisions

### DEC-P01: iOS Development Approach

**Status:** Pending

**Options:**
1. Native Swift with zcash-swift-wallet-sdk
2. Kotlin Multiplatform sharing Android code
3. React Native for web+mobile

**Blocking on:** NOSTR integration completion on Android

---

*This document is updated whenever significant architectural decisions are made.*

*Document Version 1.1 (Updated after architecture consistency review)*
