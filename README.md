# ZCHAT

Private messaging built on Zcash shielded transactions.

## Overview

ZCHAT is a privacy-first messaging application that uses Zcash's shielded transaction memo field to send encrypted messages. Messages are stored on the Zcash blockchain, providing:

- **End-to-end encryption** - Messages encrypted with ECDH + AES-256-GCM
- **Blockchain privacy** - Shielded transactions hide sender, recipient, and content
- **No central server** - Messages exist only on the blockchain
- **Self-destructing messages** - Remote destruction via blockchain transactions

## Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| Android | Primary | Forked from Zashi wallet |
| iOS | Planned | After NOSTR integration |
| Web | Secondary | Basic messaging only |

## Features

### Current (Android)
- Direct messaging via Zcash memos
- Group messaging with shared key encryption
- Time-locked messages (scheduled, block-height, payment-gated)
- Read receipts and reactions
- Message chunking for long content (>400 bytes)
- Remote account destruction

### Planned (NOSTR Integration)
- File and image sharing (via Blossom)
- Audio messages
- Voice and video calls (WebRTC)
- Typing indicators
- Online presence

## Architecture

```
BIP39 Seed Phrase (24 words)
         |
         +--- m/44'/133'/0'/0/0  --> Zcash unified address
         |                          (payments + private messages)
         |
         +--- m/44'/1237'/0'/0/0 --> NOSTR secp256k1 keypair
                                     (files + calls + presence)
```

One seed phrase provides both identities, cryptographically linked.

## Project Structure

```
/home/yourt/zchat/           # Main monorepo
+-- apps/
|   +-- backend/             # Node.js API (port 4000)
|   +-- web/                 # Next.js frontend (port 3000)
|   +-- landing/             # Landing page (zsend.xyz)
+-- packages/
|   +-- wallet-core/         # Rust WASM wallet
+-- docs/                    # Documentation

/home/yourt/zchat-android/   # Android app (Zashi fork)
```

## Documentation

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](CLAUDE.md) | Project context, infrastructure, commands |
| [PRODUCT.md](PRODUCT.md) | Product vision, features, roadmap |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Technical architecture, protocols |
| [ANDROID_FIX_PLAN.md](ANDROID_FIX_PLAN.md) | Current priorities, NOSTR integration |
| [DEVELOPMENT_STANDARDS.md](DEVELOPMENT_STANDARDS.md) | Coding standards (TypeScript/Kotlin) |
| [DECISIONS.md](DECISIONS.md) | Architectural decision log |
| [ISSUES_TO_FIX.md](ISSUES_TO_FIX.md) | Audit findings, prioritized bugs |

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm
- Rust (for WASM wallet)
- Android Studio (for mobile development)

### Backend
```bash
cd apps/backend
pnpm install
npx prisma generate
pnpm dev
```

### Web Frontend
```bash
cd apps/web
pnpm install
pnpm dev
```

### Android
```bash
cd /home/yourt/zchat-android
ANDROID_HOME="$HOME/android-sdk" ./gradlew assembleDebug
```

## Public URLs

| Service | URL |
|---------|-----|
| Landing Page | https://zsend.xyz |
| Web App | https://app.zsend.xyz |
| API | https://api.zsend.xyz |

## Protocol

Messages use the ZMSG protocol (v4):

```
ZMSG|4|<type>|<conv_id>|<sender_hash>|<payload>
```

Types: `DM` (direct), `RXN` (reaction), `RCV` (receipt), `RPL` (reply), `REQ` (request), `CHK` (chunk), `STT` (status), `GRP` (group)

See [ARCHITECTURE.md](ARCHITECTURE.md) for full protocol specification.

## Security

- Seeds stored in EncryptedSharedPreferences (Android)
- E2E encryption: ECDH (secp256r1) + AES-256-GCM
- Key derivation: HKDF with HMAC-SHA256 (v2)
- No seed transmission to servers

## Contributing

This is a private project. Contact the maintainer for access.

## License

Proprietary. All rights reserved.

---

*Built with Zcash shielded transactions for true privacy.*
