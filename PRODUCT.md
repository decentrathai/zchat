# ZCHAT Product Document

**Version:** 2.0
**Last Updated:** 2026-01-19
**Status:** Phase 1 Complete - Ready for Implementation

---

## 1. Core Problem Being Solved

### The Problem
Current messaging applications face a fundamental conflict between user convenience and privacy. Mainstream messengers (WhatsApp, Telegram, Signal) require:
- Phone numbers or email addresses for identity
- Centralized servers that can be compromised, censored, or subpoenaed
- Trust in a single company to protect metadata
- Account creation that links to real-world identity

Even "privacy-focused" messengers like Signal still:
- Require phone numbers (identity exposure)
- Rely on centralized infrastructure (single point of failure)
- Can be blocked by governments
- Store metadata about who talks to whom

### Why This Matters
For journalists, activists, whistleblowers, privacy advocates, and anyone living under authoritarian regimes:
- **Identity exposure = danger** - linking a phone number to communications creates risk
- **Centralized servers = censorship** - governments can block services or demand data
- **Metadata = surveillance** - knowing who talks to whom is often enough to prosecute

### The ZCHAT Solution
ZCHAT provides **truly private messaging** by:
1. Using Zcash shielded transactions as the transport layer (no central server can read messages)
2. Requiring only a wallet address for identity (no phone, email, or real-world link)
3. Leveraging existing Zcash infrastructure (decentralized, censorship-resistant)
4. Supporting end-to-end encryption on top of blockchain privacy

**Key Insight:** By encoding messages in Zcash memo fields, ZCHAT piggybacks on the strongest privacy technology in cryptocurrency to create a messaging system that is:
- **Unstoppable** - as long as Zcash exists, messages can be sent
- **Unlinkable** - shielded transactions hide sender, receiver, and content
- **Decentralized** - no company to subpoena or shut down

---

## 2. Target Users and Pain Points

### Primary User Personas

#### Persona 1: The Privacy Absolutist
**Demographics:** Tech-savvy individuals, crypto enthusiasts, cypherpunks
**Location:** Global, concentrated in crypto communities

**Pain Points:**
- Distrust of any centralized service with their communications
- Wants mathematical guarantees of privacy, not promises
- Values self-custody of keys and identity
- Frustrated by metadata leakage in "private" messengers

**Needs:**
- Wallet-based identity with no KYC
- Full control over encryption keys
- Ability to verify privacy claims through open source
- Integration with existing Zcash holdings

#### Persona 2: The At-Risk Communicator
**Demographics:** Journalists, activists, NGO workers, whistleblowers
**Location:** Authoritarian regimes, conflict zones, sensitive situations

**Pain Points:**
- Phone number requirement creates paper trail
- Centralized services can be compromised by state actors
- Need deniable communications (cannot prove conversation happened)
- Risk of being identified as using "suspicious" apps

**Needs:**
- No identity linkage whatsoever
- Censorship resistance (cannot be blocked)
- Plausible deniability of communications
- Emergency wallet destruction capability

#### Persona 3: The Zcash Native
**Demographics:** Existing Zcash users, ZEC holders, Zcash community members
**Location:** Global Zcash ecosystem

**Pain Points:**
- No native messaging in Zcash ecosystem
- Must use separate apps for communication about Zcash transactions
- Wants unified wallet + messaging experience
- Community fragmented across Discord, Telegram, etc.

**Needs:**
- Native integration with Zcash wallet
- Ability to discuss transactions privately
- Payment request / invoice system
- Group coordination for Zcash DAOs/communities

### Secondary User Personas

#### Persona 4: The Solana Mobile User
**Demographics:** Solana ecosystem participants, dApp store users
**Location:** Solana mobile community

**Pain Points:**
- Limited privacy options in Solana ecosystem
- Wants privacy messaging that integrates with mobile dApp experience
- Interested in cross-chain privacy solutions

**Needs:**
- Solana dApp Store availability
- Mobile-first experience
- Clean integration with Solana Mobile stack

---

## 3. Key Value Propositions

### Primary Value Props

| Value Prop | Description | Differentiator |
|------------|-------------|----------------|
| **Blockchain-Grade Privacy** | Messages encoded in Zcash shielded transactions - cryptographically hidden sender, receiver, and content | Signal can't match this - centralized servers see metadata |
| **No Identity Required** | Only need a Zcash unified address - no phone, no email, no KYC | Telegram requires phone, Signal requires phone, WhatsApp requires phone |
| **Censorship Resistant** | As long as Zcash blockchain exists, messages can be sent and received | No single company or government can shut it down |
| **Self-Custody Keys** | User controls their own encryption keys via seed phrase | No trusting a company with your private keys |
| **Built-in Payments** | Send ZEC alongside messages - native payment requests, invoices | Seamless crypto payments in chat |

### Secondary Value Props

| Value Prop | Description |
|------------|-------------|
| **Open Source** | Fully verifiable privacy claims |
| **Multi-Platform** | Android (primary), iOS (planned), Web (secondary) |
| **Group Messaging** | Private group chats for communities/DAOs |
| **Emergency Destruction** | Remote wallet wipe capability for at-risk users |
| **Offline Message Queue** | Messages delivered when recipient syncs |

---

## 4. Feature List

### Core Features (MVP - Implemented)

#### Messaging
- [x] Direct messaging (1:1 conversations)
- [x] Message threading by conversation ID
- [x] Chunked messages for long content (>500 bytes)
- [x] Message reactions (emoji responses)
- [x] Read receipts
- [x] Reply-to specific messages

#### Wallet Integration
- [x] Unified Zcash address generation
- [x] Seed phrase import/export
- [x] Balance display (ZEC + USD)
- [x] Send ZEC with messages
- [x] Transaction history

#### Security
- [x] End-to-end encryption (E2E) on top of Zcash privacy
- [x] Local key storage (EncryptedSharedPreferences on Android)
- [x] Remote wallet destruction
- [x] BIP39 seed phrase
- [x] Time-locked messages (4 types: scheduled, block-height, payment-gated, conditional)

#### Anti-Spam
- [x] User-controlled blocking (mark wallet as spammer)
- [x] Spam folder for blocked senders
- [x] Economic spam deterrent (every message costs zatoshi)

**Note:** Spam actually benefits recipients - blocked messages still include payment, so spammers pay you.

### In Progress Features

#### Group Messaging (v3.0)
- [x] Create groups
- [x] Invite members
- [x] Group message broadcast
- [ ] Group key rotation on member leave
- [ ] Admin controls

#### Advanced Features
- [x] Time-locked messages (unlock at specific time)
- [x] Payment requests
- [x] User status (online/offline indicators)
- [ ] Contact book with nicknames

### Planned Features (Roadmap)

#### Short-term (NOSTR Integration)
- [ ] File attachments (images, documents) via Blossom
- [ ] Voice messages via Blossom
- [ ] Typing indicators via NOSTR
- [ ] Online presence via NOSTR

#### Medium-term
- [ ] iOS app (AppStore)
- [ ] Google Play Store release
- [ ] Solana Mobile dApp Store
- [ ] Audio/video calls (WebRTC via NOSTR)
- [ ] Multi-device sync

#### Long-term
- [ ] Non-Zcash payments via Near Intents (already in Zashi wallet)
- [ ] Desktop app (Electron)
- [ ] Message search
- [ ] Channel broadcasts (one-to-many)
- [ ] Cross-chain messaging (bridge to other privacy coins)
- [ ] Hardware wallet integration

---

## 5. Platform Strategy

### Platform Priority

| Platform | Priority | Status | Notes |
|----------|----------|--------|-------|
| **Android** | Primary | MVP Complete | Forked from Zashi, full ZMSG protocol |
| **iOS** | Secondary | Planned | After NOSTR integration on Android |
| **Web** | Tertiary | Basic Only | Syncs from mobile, no standalone wallet |

### Web App Strategy (Decision: Option C)

The web app is a **secondary platform** that:
- Provides basic messaging only (no groups, no special messages)
- Syncs wallet data from mobile device (not standalone)
- Will be developed after mobile versions are stable
- Mobile is the source of truth for all wallet data

**Rationale:** Web lacks ZMSG protocol parity (40-80 hours to implement). Focus resources on mobile-first.

### Data Recovery Policy

**Seed phrase lost = messages unrecoverable.**

ZCHAT is non-custodial:
- We never store user seeds
- We cannot recover accounts
- Users must backup their own seed phrase
- This is a feature, not a bug (true privacy requires self-custody)

---

## 6. Technical Constraints

### Zcash Memo Limitations
- **Max memo size:** 512 bytes per transaction
- **Throughput:** ~75 seconds per block
- **Cost:** Each message requires ZEC fee (~0.00001 ZEC)
- **Latency:** Messages only visible after block confirmation

### Latency Mitigation (Research Needed)
Current block time is 75 seconds. Strategies to improve UX:
- Optimistic UI (show message as "sending" immediately)
- Batch multiple messages in single transaction
- NOSTR for real-time features (typing, presence)
- Future: Investigate Zcash protocol improvements

### Protocol Requirements
- ZMSG Protocol v4 for message encoding
- ZIP321 URIs for payment requests
- Unified addresses (u1...) for privacy

### Platform Requirements
- **Android:** Zcash SDK 2.4.3+, Kotlin, Jetpack Compose
- **iOS (planned):** Swift, Zcash iOS SDK
- **Web:** Next.js, WASM wallet-core (sync from mobile only)
- **Backend:** Fastify, Prisma, PostgreSQL

---

## 7. Business Model

### Revenue Streams

| Stream | Description | Priority |
|--------|-------------|----------|
| **Transaction Fees** | Small fee on each message transaction | Primary |
| **Hackathons** | Prize money from Zcash/crypto hackathons | Active |
| **Grants** | Zcash Foundation, Electric Coin Company grants | Active |
| **VC Funding** | Venture capital for scaling | Future |

### Development Philosophy

**Code quality > Speed to market**

- Hackathon deadlines do not compromise code quality
- Technical debt is tracked and addressed
- Boris Cherny TypeScript/Kotlin standards enforced
- Security audits before major releases

### Regulatory Approach

**Current stance: Privacy-first, compliance-later**

- No KYC/AML implementation initially
- Open source = transparency about capabilities
- Regulatory compliance will be addressed when required by specific jurisdictions
- "Transparency is the bug" - we cannot comply with data requests because we don't have the data

---

## 8. Success Metrics

### User Metrics
| Metric | Target (6 months) | Target (12 months) |
|--------|-------------------|---------------------|
| Daily Active Users | 1,000 | 10,000 |
| Messages Sent/Day | 10,000 | 100,000 |
| App Downloads | 5,000 | 50,000 |
| Retention (7-day) | 40% | 50% |

### Technical Metrics
| Metric | Target |
|--------|--------|
| Message Delivery Success | >99.5% |
| Sync Time (empty wallet) | <30 seconds |
| Sync Time (active wallet) | <2 minutes |
| Crash-free Rate | >99.9% |

### Business Metrics
| Metric | Target |
|--------|--------|
| App Store Rating | >4.5 stars |
| Hackathon Placements | Top 3 in Zcash grants |
| Community Growth | 5,000 Discord members |

---

## 9. Competitive Analysis

| Feature | ZCHAT | Signal | Telegram | Session | Status |
|---------|-------|--------|----------|---------|--------|
| No Phone Required | ✅ | ❌ | ❌ | ✅ | ✅ |
| Blockchain Transport | ✅ | ❌ | ❌ | ❌ | ✅ |
| Censorship Resistant | ✅ | ❌ | ❌ | ✅ | ✅ |
| Metadata Private | ✅ | ⚠️ | ❌ | ✅ | ⚠️ |
| Built-in Payments | ✅ | ❌ | ⚠️ | ⚠️ | ✅ |
| Group Chat | ✅ | ✅ | ✅ | ✅ | ✅ |
| File Sharing | ⏳ | ✅ | ✅ | ✅ | ✅ |
| Open Source | ✅ | ✅ | ❌ | ✅ | ✅ |
| Decentralized | ✅ | ❌ | ❌ | ⚠️ | ⚠️ |

**Legend:** ✅ Full support | ⚠️ Partial | ❌ No | ⏳ Planned

### ZCHAT Unique Advantages
1. **True blockchain privacy** - Not just encrypted, but cryptographically unlinkable
2. **Native payments** - ZEC built into every conversation
3. **Zcash ecosystem** - Tap into existing privacy-focused community
4. **No infrastructure dependency** - Messages go on-chain, not through our servers

### ZCHAT Disadvantages to Address
1. **Latency** - 75-second block times vs instant delivery (mitigation: optimistic UI, NOSTR for real-time)
2. **Cost** - Fees per message (mitigation: batch messages, subsidize initial users)
3. **Storage** - Blockchain bloat (mitigation: pruning, light clients)
4. **Complexity** - Wallet management learning curve (mitigation: better UX, tutorials)

---

## 10. Open Questions (Remaining)

### Technical (Research Needed)
1. **Sub-second UX** - How to achieve perceived instant messaging with 75s blocks? (NOSTR helps but not fully solved)
2. **iOS SDK parity** - Strategy for matching Android feature set on iOS?

### Business (Decisions Pending)
1. **Go-to-market** - What's the launch strategy for each platform?
   - Options: Zcash community first, privacy subreddits, crypto Twitter, hackathon demos

---

## Appendix: Iteration Log

### Iteration 1 (2026-01-19) - Initial Draft
- Created Sections 1-7
- Defined 4 user personas
- Listed MVP features
- Identified technical constraints

### Iteration 2 (2026-01-19) - User Feedback Integration
- Added NOSTR integration to roadmap
- Updated Platform Strategy section
- Added Business Model section (Section 7)

### Iteration 3 (2026-01-19) - Hostile Audit Findings
- Confirmed seed storage is secure (no changes needed)
- Identified HKDF fix as P1 priority
- Decided web app is secondary platform (Option C)

### Iteration 4 (2026-01-19) - Open Questions Resolution
**Resolved:**
- Non-Zcash payments: Yes, via Near Intents (long-term roadmap)
- Monetization: Transaction fees + hackathons/grants/VC
- Spam handling: User-controlled blocking + economic deterrent
- Message expiry: Optional feature exists (time-locked messages)
- Message recovery: Impossible by design (non-custodial)
- Web backup: Sync from mobile device
- Quality vs speed: Quality always wins

**Remaining Open:**
- Sub-second UX strategy (research needed)
- iOS SDK parity approach
- Go-to-market specifics

### Iteration 5 (2026-01-19) - Phase 1 Completion
- Integrated all answered questions into main sections
- Created Platform Strategy section (Section 5)
- Created Business Model section (Section 7)
- Added Anti-Spam to features
- Updated version to 2.0
- Marked Phase 1 complete

---

*Phase 1 (Product Document Formation) complete. Ready for Phase 2 implementation.*

*Document Version 2.0*
