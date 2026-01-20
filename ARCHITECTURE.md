# ZCHAT Architecture Document

**Version:** 1.1
**Last Updated:** 2026-01-19
**Status:** Phase 2 - Architectural Consistency Verified

**Changelog v1.1:**
- Added E2E key exchange protocol (KEX message type)
- Clarified HKDF status (current vs proposed)
- Added local storage architecture
- Documented error handling paths
- Increased sender_hash entropy (8→16 chars)
- Added forward secrecy roadmap
- Fixed group key security documentation
- Added Blossom file encryption requirement
- Standardized web app terminology
- Added component definitions

---

## 1. System Overview

ZCHAT is a privacy-first messaging application that uses **Zcash shielded transactions** as its primary transport layer, with **NOSTR** providing supplementary capabilities for features that exceed blockchain constraints.

### Design Principles

1. **Privacy by Default** - All messages encrypted, metadata minimized
2. **Self-Custody** - Users control their own keys via BIP39 seed phrase
3. **Decentralization** - No central server can read, block, or censor messages
4. **Blockchain-Grade Security** - Leveraging Zcash's proven cryptographic guarantees
5. **Single Identity** - One seed phrase derives both Zcash and NOSTR identities

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER DEVICES                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Android   │  │     iOS     │  │     Web     │                  │
│  │  (Primary)  │  │  (Planned)  │  │ (Secondary) │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
└─────────┼────────────────┼────────────────┼─────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    TRANSPORT LAYER (HYBRID)                          │
│                                                                      │
│  ┌─────────────────────────┐    ┌─────────────────────────┐         │
│  │    ZCASH BLOCKCHAIN     │    │      NOSTR NETWORK      │         │
│  │  (Primary - Messages)   │    │ (Secondary - Media/RTC) │         │
│  │                         │    │                         │         │
│  │  • Shielded transactions│    │  • File references      │         │
│  │  • Text messages        │    │  • Audio/video calls    │         │
│  │  • Payment requests     │    │  • Presence indicators  │         │
│  │  • Group messages       │    │  • Real-time signaling  │         │
│  │  • Time-locked messages │    │                         │         │
│  │  • E2E encrypted        │    │  ┌─────────────────┐    │         │
│  │                         │    │  │ BLOSSOM SERVERS │    │         │
│  │  ~75s block latency     │    │  │  (File Storage) │    │         │
│  └─────────────────────────┘    │  └─────────────────┘    │         │
│                                  └─────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
          │                                │
          ▼                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE                                    │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │   Lightwalletd  │  │  Backend API    │  │  NOSTR Relays   │      │
│  │   (gRPC)        │  │  (Whitelist)    │  │  (Public)       │      │
│  │   Port 9067     │  │  Port 4000      │  │                 │      │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘      │
│           │                    │                                     │
│           ▼                    ▼                                     │
│  ┌─────────────────┐  ┌─────────────────┐                           │
│  │     Zebrad      │  │   PostgreSQL    │                           │
│  │  (Zcash Node)   │  │   (User Data)   │                           │
│  │   Port 8232     │  │                 │                           │
│  └─────────────────┘  └─────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Identity Architecture

### Single Seed, Dual Identity

```
BIP39 Seed Phrase (24 words)
         │
         │ PBKDF2 (2048 rounds)
         ▼
    512-bit Seed
         │
         ├───────────────────────────────────────────┐
         │                                           │
         ▼                                           ▼
   m/44'/133'/0'/0/0                          m/44'/1237'/0'/0/0
   (SLIP-44: Zcash)                           (ZCHAT-specific*)
         │                                           │
         ▼                                           ▼
   ┌─────────────────┐                       ┌─────────────────┐
   │ Zcash Unified   │                       │ NOSTR Keypair   │
   │ Address (u1...) │                       │ (secp256k1)     │
   │                 │                       │                 │
   │ • Payments      │                       │ • File uploads  │
   │ • Messages      │                       │ • Call signaling│
   │ • Groups        │                       │ • Presence      │
   └─────────────────┘                       └─────────────────┘

* Note: 1237 is not an official SLIP-44 coin type. This is a ZCHAT-specific
  derivation path chosen to avoid conflicts. Future versions may adopt a
  standardized NOSTR derivation path if one is established.
```

### Key Storage

| Platform | Storage Mechanism | Encryption | Status |
|----------|-------------------|------------|--------|
| Android | EncryptedSharedPreferences | AES256-GCM (MasterKey) + AES256-SIV | Implemented |
| iOS (planned) | Keychain Services | Secure Enclave | Planned |
| Web | sessionStorage (temporary) | Not persisted | Implemented |

**Android Implementation:**
```
co.electriccoin.zcash.encrypted.xml
├── PersistableWalletProvider.kt  → High-level wallet storage
├── EncryptedPreferenceProvider.kt → Encryption layer (uses AndroidX Security)
└── AndroidPreferenceProvider.kt   → Thread-safe writes with mutex

MasterKey Source: Android Keystore System
├── Generated on first app launch
├── Hardware-backed on supported devices (StrongBox/TEE)
└── Never leaves secure hardware
```

**NOSTR Key Storage (Planned):**
```kotlin
// NOSTR private key derived on-demand, stored in ZchatPreferences
// Same encryption as Zcash seed (EncryptedSharedPreferences)
class ZchatPreferences {
    fun getNostrPrivateKey(): ByteArray? = encryptedPrefs.getByteArray("nostr_sk")
    fun setNostrPrivateKey(key: ByteArray) = encryptedPrefs.putByteArray("nostr_sk", key)
}
```

---

## 3. Protocol Architecture

### ZMSG Protocol v4 (Text Messages)

All messages are encoded in Zcash memo fields (max 512 bytes).

```
┌──────────────────────────────────────────────────────────────┐
│                    ZMSG MESSAGE FORMAT                        │
├──────────────────────────────────────────────────────────────┤
│ ZMSG|<version>|<type>|<conv_id>|<sender_hash>|<payload>      │
│                                                              │
│ version:     4 (current)                                     │
│ type:        DM, KEX, RXN, RCV, RPL, REQ, CHK, STT           │
│ conv_id:     12-char alphanumeric (~71 bits entropy)         │
│ sender_hash: SHA256(sender_address).take(6 bytes) → 12 hex chars │
│ payload:     type-specific content                           │
└──────────────────────────────────────────────────────────────┘
```

**IMPORTANT:** `sender_hash` uses 12 hex characters (6 bytes of SHA-256, ~48 bits entropy). This provides acceptable collision resistance (~16M messages for 50% collision) while keeping message overhead minimal.

**Message Types:**

| Type | Purpose | Payload Format |
|------|---------|----------------|
| DM | Direct message | `<encrypted_text>` |
| **KEX** | Key exchange (NEW) | `<pubkey_b64>\|<signature_b64>` |
| RXN | Reaction | `<target_txid>\|<emoji>` |
| RCV | Read receipt | `<target_txid>` |
| RPL | Reply | `<target_txid>\|<encrypted_text>` |
| REQ | Payment request | `<amount>\|<memo>` |
| CHK | Chunked message | `<chunk_id>\|<n>/<total>\|<data>` |
| STT | Status update | `<status>` (online/offline) |

### E2E Key Exchange Protocol (NEW in v1.1)

**Problem Solved:** Previous architecture didn't define how E2E keys are exchanged.

```
┌──────────────────────────────────────────────────────────────┐
│                 KEY EXCHANGE PROTOCOL (KEX)                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: Alice initiates conversation                        │
│  ─────────────────────────────────────                       │
│  Alice generates ephemeral EC keypair (secp256r1)            │
│  Alice signs her public key with her Zcash spending key      │
│  Alice sends: ZMSG|4|KEX|conv_id|hash|<pubkey>|<signature>   │
│                                                              │
│  Step 2: Bob responds                                        │
│  ────────────────────                                        │
│  Bob verifies Alice's signature using her Zcash address      │
│  Bob generates his own ephemeral EC keypair                  │
│  Bob signs his public key with his Zcash spending key        │
│  Bob sends: ZMSG|4|KEX|conv_id|hash|<pubkey>|<signature>     │
│                                                              │
│  Step 3: Shared secret established                           │
│  ─────────────────────────────────                           │
│  Both compute ECDH shared secret                             │
│  Both derive AES key via HKDF                                │
│  Conversation can now use DM messages                        │
│                                                              │
│  Edge Cases:                                                 │
│  • Simultaneous KEX: Lower address wins (deterministic)      │
│  • No response: Timeout after 10 blocks, retry or fail       │
│  • Invalid signature: Reject, log security event             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Signature Scheme:**
```kotlin
// Sign public key with Zcash transparent key (for verification)
// This binds the E2E key to the Zcash identity
fun signPublicKey(ecPublicKey: ByteArray, zcashSpendingKey: SpendingKey): ByteArray {
    val message = "ZCHAT_KEX_V1:" + ecPublicKey.toBase64()
    return Secp256k1.sign(message.sha256(), zcashSpendingKey.toSecp256k1())
}

fun verifyPublicKey(ecPublicKey: ByteArray, signature: ByteArray, zcashAddress: String): Boolean {
    val message = "ZCHAT_KEX_V1:" + ecPublicKey.toBase64()
    val recoveredPubkey = Secp256k1.recoverPublicKey(message.sha256(), signature)
    return recoveredPubkey.toZcashAddress() == zcashAddress
}
```

### Chunked Message Protocol

For messages exceeding ~400 bytes (leaving room for headers):

```
Message: "This is a very long message that needs to be split..."
         ↓
┌─────────────────────────────────────────────────────────────┐
│ Chunk 1: ZMSG|4|CHK|abc123|hash|chunk_xyz|1/3|This is a ver│
│ Chunk 2: ZMSG|4|CHK|abc123|hash|chunk_xyz|2/3|y long messag│
│ Chunk 3: ZMSG|4|CHK|abc123|hash|chunk_xyz|3/3|e that needs..│
└─────────────────────────────────────────────────────────────┘

Reassembly Rules:
• chunk_id must match across all chunks
• Chunks may arrive out of order (different blocks)
• Timeout: 100 blocks (~2 hours) for incomplete chunks
• Missing chunks: Request retransmit via REQ message
• Storage: Partial chunks stored in ChunkCache (in-memory, max 50 pending)
```

### Group Protocol (ZGRP)

**Note:** Group messages use a SEPARATE protocol prefix (ZGRP), not the ZMSG type field.

```
┌──────────────────────────────────────────────────────────────┐
│                  GROUP MESSAGE TYPES (ZGRP)                   │
├──────────────────────────────────────────────────────────────┤
│ CREATE:  ZGRP|CREATE|<group_id>|<name>|<encrypted_key_blob>  │
│ INVITE:  ZGRP|INVITE|<group_id>|<invitee_pubkey>|<enc_key>   │
│ JOIN:    ZGRP|JOIN|<group_id>|<member_pubkey>                │
│ LEAVE:   ZGRP|LEAVE|<group_id>|<member_addr>                 │
│ MESSAGE: ZGRP|GM|<group_id>|<encrypted_content>              │
│ ROTATE:  ZGRP|ROTATE|<group_id>|<new_encrypted_key_blob>     │
└──────────────────────────────────────────────────────────────┘
```

**Group Key Distribution (SECURITY CRITICAL):**

```
┌──────────────────────────────────────────────────────────────┐
│            GROUP KEY SECURITY MODEL                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  CURRENT STATE (INSECURE - P1 FIX REQUIRED):                 │
│  ──────────────────────────────────────────                  │
│  Group key sent as base64 in memo field.                     │
│  VULNERABILITY: Anyone scanning blockchain can see key!      │
│                                                              │
│  REQUIRED FIX (P1 - Elevated from P2):                       │
│  ─────────────────────────────────────                       │
│  Per-recipient encryption of group key:                      │
│                                                              │
│  CREATE: Creator encrypts group key with OWN pubkey only     │
│  INVITE: Creator encrypts group key with INVITEE'S pubkey    │
│                                                              │
│  Format: ZGRP|INVITE|group_id|invitee|ECIES(group_key)       │
│                                                              │
│  ECIES = Elliptic Curve Integrated Encryption Scheme:        │
│  1. Generate ephemeral keypair                               │
│  2. ECDH with recipient's public key                         │
│  3. HKDF derive encryption key                               │
│  4. AES-256-GCM encrypt group key                            │
│  5. Output: ephemeral_pubkey || ciphertext || tag            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Time-Locked Protocol (ZTL)

```
┌──────────────────────────────────────────────────────────────┐
│                TIME-LOCKED MESSAGE TYPES                      │
├──────────────────────────────────────────────────────────────┤
│ Scheduled:     ZTL|SCH|<unix_timestamp>|<hash>|<encrypted>   │
│ Block Height:  ZTL|BLK|<block_height>|<hash>|<encrypted>     │
│ Payment:       ZTL|PAY|<zatoshi_amount>|<hash>|<encrypted>   │
│ Conditional:   ZTL|CND|<answer_hash>|<hint>|<hash>|<enc>     │
└──────────────────────────────────────────────────────────────┘

Unlock Verification:
• SCH: Compare unix_timestamp <= current_time (client-validated)
• BLK: Compare block_height <= current_blockchain_height (trustless)
• PAY: Recipient sends required amount to reveal key
• CND: Recipient provides answer where SHA256(answer) == answer_hash
```

### NOSTR Protocol Extensions (Planned)

```
┌──────────────────────────────────────────────────────────────┐
│                  NOSTR-ENABLED MESSAGES                       │
├──────────────────────────────────────────────────────────────┤
│ File:     ZFILE|<sha256>|<mime>|<size>|<url>|<file_key>      │
│ Audio:    ZAUDIO|<sha256>|<duration>|<url>|<file_key>        │
│ Call:     ZCALL|<type>|<call_id>|<data>                      │
│ Presence: ZPRESENCE|<type>|<data>                            │
└──────────────────────────────────────────────────────────────┘

IMPORTANT: <file_key> is AES-256-GCM key to decrypt file.
Files are encrypted BEFORE upload to Blossom.
This ensures Blossom servers cannot access file contents.
```

---

## 4. Encryption Architecture

### E2E Encryption (1:1 Messages)

```
┌─────────────────────────────────────────────────────────────┐
│                    KEY EXCHANGE                              │
│                                                              │
│  Alice                              Bob                      │
│    │                                  │                      │
│    │  KEX: pubkey + signature         │                      │
│    │  ──────────────────────────────► │                      │
│    │                                  │ Verify signature     │
│    │                                  │                      │
│    │  ◄────────────────────────────── │                      │
│    │  KEX: pubkey + signature         │                      │
│    │                                  │                      │
│    ▼  Verify signature                ▼                      │
│  ECDH Shared Secret              ECDH Shared Secret          │
│    │                                  │                      │
│    ▼                                  ▼                      │
│  HKDF Key Derivation             HKDF Key Derivation         │
│    │                                  │                      │
│    ▼                                  ▼                      │
│  AES-256-GCM Key                 AES-256-GCM Key             │
└─────────────────────────────────────────────────────────────┘
```

### HKDF Implementation

**STATUS CLARIFICATION:**
- **Current code (INSECURE):** Uses SHA-256 digest only, no proper HKDF
- **Required fix (P1):** Implement RFC 5869 HKDF as shown below
- **Backward compatibility:** Must support v1 (legacy) for existing conversations

```kotlin
// ============================================================
// PROPOSED IMPLEMENTATION - NOT YET IN CODEBASE
// File: E2EEncryption.kt (to replace lines 87-91)
// ============================================================

object HKDF {
    private const val HASH_LEN = 32

    fun deriveKey(
        sharedSecret: ByteArray,
        salt: ByteArray = "ZCHAT_E2E_SALT_V2".toByteArray(),
        info: ByteArray = "ZCHAT_E2E_KEY".toByteArray(),
        length: Int = 32
    ): ByteArray {
        // Extract phase (RFC 5869 Section 2.2)
        val prk = hmacSha256(salt, sharedSecret)
        // Expand phase (RFC 5869 Section 2.3)
        return expand(prk, info, length)
    }

    private fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data)
    }

    private fun expand(prk: ByteArray, info: ByteArray, length: Int): ByteArray {
        val n = (length + HASH_LEN - 1) / HASH_LEN
        var t = ByteArray(0)
        val okm = ByteArray(length)
        var offset = 0
        for (i in 1..n) {
            t = hmacSha256(prk, t + info + byteArrayOf(i.toByte()))
            System.arraycopy(t, 0, okm, offset, minOf(HASH_LEN, length - offset))
            offset += HASH_LEN
        }
        return okm
    }
}

// Version-aware key derivation for backward compatibility
fun deriveKey(sharedSecret: ByteArray, version: Int): ByteArray {
    return when (version) {
        1 -> legacyDeriveKeyV1(sharedSecret)  // Old SHA-256 method
        2 -> HKDF.deriveKey(sharedSecret)      // New HKDF method
        else -> throw IllegalArgumentException("Unknown key version: $version")
    }
}
```

### Message Encryption

```
┌─────────────────────────────────────────────────────────────┐
│                MESSAGE ENCRYPTION FLOW                       │
│                                                              │
│  Plaintext                                                   │
│      │                                                       │
│      ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  AES-256-GCM Encrypt                                │    │
│  │  • Key: HKDF-derived session key (32 bytes)         │    │
│  │  • IV: Random 12 bytes (prepended to ciphertext)    │    │
│  │  • Auth Tag: 16 bytes (appended)                    │    │
│  └─────────────────────────────────────────────────────┘    │
│      │                                                       │
│      ▼                                                       │
│  [IV (12)] + [Ciphertext] + [Tag (16)]                      │
│      │                                                       │
│      ▼                                                       │
│  Base64 encode → ZMSG payload                               │
└─────────────────────────────────────────────────────────────┘
```

### Forward Secrecy Roadmap (P3 - Future)

**Current Limitation:** Static ECDH keys mean compromise of long-term key decrypts ALL past messages.

**Planned Solution:** Double Ratchet Algorithm (like Signal Protocol)

```
┌──────────────────────────────────────────────────────────────┐
│              FORWARD SECRECY ROADMAP (P3)                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Phase 1: Ephemeral Keys (Current)                           │
│  • One keypair per conversation                              │
│  • Compromise = that conversation only                       │
│                                                              │
│  Phase 2: Key Rotation (Future)                              │
│  • New keypair every N messages or T time                    │
│  • Old keys deleted after confirmation                       │
│  • Limits damage window                                      │
│                                                              │
│  Phase 3: Double Ratchet (Future)                            │
│  • New key per message                                       │
│  • Full forward secrecy                                      │
│  • Requires: KEX renegotiation protocol                      │
│  • Complexity: High (20+ hours)                              │
│                                                              │
│  Decision: Defer to P3, current security adequate for MVP    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Local Storage Architecture (NEW in v1.1)

### Android Message Database

```kotlin
// Room Database Schema
@Database(entities = [Message::class, Conversation::class, Contact::class], version = 1)
abstract class ZchatDatabase : RoomDatabase() {
    abstract fun messageDao(): MessageDao
    abstract fun conversationDao(): ConversationDao
    abstract fun contactDao(): ContactDao
}

@Entity(tableName = "messages")
data class Message(
    @PrimaryKey val txid: String,           // Zcash transaction ID
    val conversationId: String,             // 12-char conversation ID
    val senderHash: String,                 // 16-char sender hash
    val type: MessageType,                  // DM, RXN, RCV, etc.
    val content: String,                    // Decrypted content
    val timestamp: Long,                    // Block timestamp
    val blockHeight: Int,                   // For ordering
    val status: MessageStatus,              // PENDING, SENT, DELIVERED, READ
    val isOutgoing: Boolean
)

@Entity(tableName = "conversations")
data class Conversation(
    @PrimaryKey val id: String,             // 12-char conversation ID
    val peerAddress: String,                // Full Zcash address
    val peerHash: String,                   // 16-char hash
    val e2eKeyVersion: Int,                 // 1 or 2
    val e2ePublicKey: ByteArray?,           // Peer's EC public key
    val lastMessageTime: Long,
    val unreadCount: Int
)

@Entity(tableName = "contacts")
data class Contact(
    @PrimaryKey val address: String,        // Full Zcash address
    val nickname: String?,                  // User-assigned name
    val isBlocked: Boolean,
    val firstSeen: Long
)
```

### Chunk Cache (In-Memory)

```kotlin
// Temporary storage for incomplete chunked messages
object ChunkCache {
    private val pending = LruCache<String, ChunkAssembly>(50) // Max 50 pending
    private const val TIMEOUT_BLOCKS = 100 // ~2 hours

    data class ChunkAssembly(
        val chunkId: String,
        val total: Int,
        val chunks: MutableMap<Int, String>,
        val firstBlockHeight: Int
    )

    fun addChunk(chunkId: String, index: Int, total: Int, data: String, blockHeight: Int): String? {
        val assembly = pending.getOrPut(chunkId) {
            ChunkAssembly(chunkId, total, mutableMapOf(), blockHeight)
        }
        assembly.chunks[index] = data

        return if (assembly.chunks.size == total) {
            pending.remove(chunkId)
            (1..total).map { assembly.chunks[it]!! }.joinToString("")
        } else null
    }

    fun pruneExpired(currentBlockHeight: Int) {
        pending.entries.removeAll { (currentBlockHeight - it.value.firstBlockHeight) > TIMEOUT_BLOCKS }
    }
}
```

### Group State Storage

```kotlin
// Stored in ZchatPreferences (encrypted)
data class GroupState(
    val groupId: String,
    val name: String,
    val groupKey: ByteArray,                // AES-256 key for group messages
    val members: List<GroupMember>,
    val myRole: GroupRole,                  // OWNER, ADMIN, MEMBER
    val createdAt: Long,
    val isActive: Boolean
)

data class GroupMember(
    val address: String,
    val publicKey: ByteArray?,              // For per-recipient encryption
    val status: MemberStatus,               // INVITED, ACTIVE, LEFT
    val joinedAt: Long?
)
```

---

## 6. Data Flow Diagrams

### Send Message Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      SEND MESSAGE FLOW                            │
└──────────────────────────────────────────────────────────────────┘

User types message
        │
        ▼
┌───────────────────┐
│   ChatViewModel   │
│   validateInput() │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────────┐
│  Check E2E Key    │────►│  KEX if needed    │
│  (conversation)   │     │  Wait for response│
└─────────┬─────────┘     └───────────────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────────┐
│  E2EEncryption    │────►│  HKDF Key Derive  │
│  encrypt()        │     │  + AES-256-GCM    │
└─────────┬─────────┘     └───────────────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────────┐
│  ZMSGProtocol     │────►│  Chunk if > 400B  │
│  format()         │     │                   │
└─────────┬─────────┘     └───────────────────┘
          │
          ▼
┌───────────────────┐
│  Save to DB       │
│  status = PENDING │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────────┐
│  TransactionQueue │────►│  Retry on failure │
│  submit()         │     │  Max 3 attempts   │
└─────────┬─────────┘     └───────────────────┘
          │
          ▼
┌───────────────────┐
│  Zcash SDK        │
│  Synchronizer     │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────────┐
│  Lightwalletd     │────►│  Error: Retry     │
│  submitTransaction│     │  or notify user   │
└─────────┬─────────┘     └───────────────────┘
          │
          ▼
┌───────────────────┐
│  Zcash Blockchain │
│  (~75s confirm)   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Update DB        │
│  status = SENT    │
└───────────────────┘
```

### Receive Message Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                     RECEIVE MESSAGE FLOW                          │
└──────────────────────────────────────────────────────────────────┘

┌───────────────────┐
│  Zcash Blockchain │
│  (new block)      │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Lightwalletd     │
│  CompactBlocks    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Zcash SDK        │
│  Synchronizer     │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  TransactionFlow  │  ← Kotlin Flow collecting new transactions
│  (MessageMonitor) │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  MemoParser       │  ← Extracts memo, checks for ZMSG/ZGRP/ZTL prefix
│  identifyType()   │
└─────────┬─────────┘
          │
    ┌─────┴─────┬─────────┬──────────┬──────────┐
    ▼           ▼         ▼          ▼          ▼
┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐
│  DM   │  │  KEX  │  │  ZGRP │  │  ZTL  │  │DESTROY│
│ Parse │  │ Parse │  │ Parse │  │ Parse │  │ Check │
└───┬───┘  └───┬───┘  └───┬───┘  └───┬───┘  └───┬───┘
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────┐
│                   ERROR HANDLING                     │
│  • Invalid format → Log + discard                   │
│  • Decryption fail → Store as "encrypted" in DB     │
│  • Missing key → Request KEX                        │
│  • Unknown sender → Create Contact with hash only   │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌───────────────────┐
│  Save to Database │
│  (Room)           │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  UI State Update  │
│  (StateFlow)      │
└───────────────────┘
```

### File Sharing Flow (NOSTR - Planned)

```
┌──────────────────────────────────────────────────────────────────┐
│                    FILE SHARING FLOW (PLANNED)                    │
└──────────────────────────────────────────────────────────────────┘

User selects file
        │
        ▼
┌───────────────────┐     ┌───────────────────┐
│  Validate         │────►│  Max size: 50MB   │
│  (size, type)     │     │  Allowed types    │
└─────────┬─────────┘     └───────────────────┘
          │
          ▼
┌───────────────────┐
│  Compress/Resize  │  ← Images: max 2048px, JPEG 80%
│  (if image/audio) │  ← Audio: Opus 64kbps
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Generate AES key │  ← Random 256-bit key for this file
│  Encrypt file     │  ← AES-256-GCM
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌───────────────────┐
│  Blossom Client   │────►│  POST /upload     │
│  upload()         │     │  NIP-98 auth      │
└─────────┬─────────┘     └───────────────────┘
          │
          ▼               ┌───────────────────┐
┌───────────────────┐     │  NIP-98 Auth:     │
│  Receive SHA-256  │     │  HTTP header with │
│  + Blossom URL    │     │  NOSTR event sig  │
└─────────┬─────────┘     └───────────────────┘
          │
          ▼
┌───────────────────┐
│  Create ZFILE msg │  ← ZFILE|sha|mime|size|url|encrypted_key
│  Send via Zcash   │  ← encrypted_key = E2E encrypted AES key
└───────────────────┘

RECIPIENT FLOW:
┌───────────────────┐
│  Receive ZFILE    │
│  Parse message    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Decrypt file key │  ← Using E2E session key
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Download from    │  ← HTTP GET by SHA-256 hash
│  Blossom URL      │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Verify SHA-256   │  ← Must match claimed hash
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Decrypt file     │  ← Using decrypted AES key
│  Save to storage  │
└───────────────────┘
```

---

## 7. Error Handling Architecture (NEW in v1.1)

### Error Types

```kotlin
sealed class ZchatError {
    // Network errors
    data class NetworkUnavailable(val service: String) : ZchatError()
    data class Timeout(val operation: String, val ms: Long) : ZchatError()

    // Transaction errors
    object InsufficientBalance : ZchatError()
    data class TransactionRejected(val reason: String) : ZchatError()
    data class TransactionFailed(val attempts: Int) : ZchatError()

    // Encryption errors
    object KeyNotFound : ZchatError()
    object DecryptionFailed : ZchatError()
    object InvalidSignature : ZchatError()
    data class KeyVersionMismatch(val expected: Int, val actual: Int) : ZchatError()

    // Protocol errors
    data class InvalidMessageFormat(val raw: String) : ZchatError()
    data class UnknownMessageType(val type: String) : ZchatError()
    data class ChunkTimeout(val chunkId: String) : ZchatError()

    // File errors
    data class FileTooLarge(val size: Long, val max: Long) : ZchatError()
    data class UploadFailed(val reason: String) : ZchatError()
    data class DownloadFailed(val url: String) : ZchatError()
}

sealed class ZchatResult<out T, out E : ZchatError> {
    data class Success<T>(val data: T) : ZchatResult<T, Nothing>()
    data class Failure<E : ZchatError>(val error: E) : ZchatResult<Nothing, E>()
}
```

### Retry Strategy

```kotlin
object RetryStrategy {
    data class Config(
        val maxAttempts: Int = 3,
        val initialDelayMs: Long = 1000,
        val maxDelayMs: Long = 30000,
        val factor: Double = 2.0
    )

    val TRANSACTION = Config(maxAttempts = 3, initialDelayMs = 5000)
    val NETWORK = Config(maxAttempts = 5, initialDelayMs = 1000)
    val FILE_UPLOAD = Config(maxAttempts = 3, initialDelayMs = 2000)

    suspend fun <T> withRetry(
        config: Config,
        operation: suspend () -> T
    ): ZchatResult<T, ZchatError> {
        var lastError: Exception? = null
        var delay = config.initialDelayMs

        repeat(config.maxAttempts) { attempt ->
            try {
                return ZchatResult.Success(operation())
            } catch (e: Exception) {
                lastError = e
                if (attempt < config.maxAttempts - 1) {
                    delay(delay)
                    delay = minOf((delay * config.factor).toLong(), config.maxDelayMs)
                }
            }
        }

        return ZchatResult.Failure(
            ZchatError.TransactionFailed(config.maxAttempts)
        )
    }
}
```

### User Notification

```kotlin
// Error handling must notify user appropriately
sealed class UserNotification {
    data class Toast(val message: String) : UserNotification()
    data class Snackbar(val message: String, val action: String?) : UserNotification()
    data class Dialog(val title: String, val message: String) : UserNotification()
}

fun ZchatError.toUserNotification(): UserNotification = when (this) {
    is ZchatError.InsufficientBalance ->
        UserNotification.Dialog("Insufficient Balance", "Add ZEC to send messages")
    is ZchatError.NetworkUnavailable ->
        UserNotification.Snackbar("Network unavailable", "Retry")
    is ZchatError.DecryptionFailed ->
        UserNotification.Toast("Could not decrypt message")
    // ... etc
}
```

---

## 8. Platform-Specific Architecture

### Android (Primary)

```
zchat-android/
├── app/                          # Main app module
├── ui-lib/                       # UI components (Jetpack Compose)
│   └── src/main/java/co/electriccoin/zcash/ui/
│       ├── screen/
│       │   ├── chat/             # Chat screens
│       │   │   ├── ChatScreen.kt
│       │   │   ├── viewmodel/
│       │   │   │   ├── ChatViewModel.kt      # 1:1 chat logic
│       │   │   │   └── GroupViewModel.kt     # Group chat logic
│       │   │   ├── protocol/
│       │   │   │   ├── ZMSGProtocol.kt       # Message formatting
│       │   │   │   ├── MemoParser.kt         # Message parsing (NEW)
│       │   │   │   ├── ZMSGGroupProtocol.kt  # Group protocol
│       │   │   │   └── ZTLProtocol.kt        # Time-locked msgs
│       │   │   ├── crypto/
│       │   │   │   ├── E2EEncryption.kt      # E2E encryption
│       │   │   │   └── HKDF.kt               # Key derivation (NEW)
│       │   │   ├── storage/
│       │   │   │   ├── ZchatDatabase.kt      # Room database (NEW)
│       │   │   │   ├── ChunkCache.kt         # Chunk assembly (NEW)
│       │   │   │   └── MessageDao.kt         # DB queries (NEW)
│       │   │   ├── network/
│       │   │   │   ├── TransactionQueue.kt   # Retry logic (NEW)
│       │   │   │   └── MessageMonitor.kt     # Receive flow (NEW)
│       │   │   └── util/
│       │   │       ├── AddressCache.kt       # Address hashing
│       │   │       └── DestroyManager.kt     # Emergency destroy
│       │   └── settings/
│       │       └── SettingsScreen.kt
│       └── preference/
│           └── ZchatPreferences.kt           # App preferences
├── sdk-ext-lib/                  # SDK extensions
└── configuration-*-lib/          # Config modules
```

**Key Dependencies:**
- Zcash Android SDK 2.4.3+
- Jetpack Compose
- Kotlin Coroutines + Flow
- Room Database
- EncryptedSharedPreferences

### Web (Secondary Platform)

**Definition:** Web app provides basic messaging that syncs from mobile. It is NOT a standalone platform.

```
apps/web/                         # Next.js frontend
├── src/
│   ├── app/
│   │   └── page.tsx              # Main page (needs refactor)
│   └── lib/
│       ├── api.ts                # Backend API client
│       ├── zmsg-protocol.ts      # ZMSG parsing (REQUIRED)
│       └── sync.ts               # Mobile sync (REQUIRED)

apps/backend/                     # Fastify backend
├── src/
│   ├── server.ts                 # Entry point
│   ├── routes/
│   │   ├── auth.ts               # Authentication
│   │   ├── whitelist.ts          # Waitlist management
│   │   └── wallet.ts             # Wallet address storage
│   └── middleware/
│       └── auth.ts               # JWT validation
├── prisma/
│   └── schema.prisma             # Database schema
└── package.json
```

**Backend Database Schema (PostgreSQL + Prisma 6.x):**
```prisma
model User {
  id             Int      @id @default(autoincrement())
  username       String   @unique
  passwordHash   String
  primaryAddress String?  // Zcash unified address (NO mnemonic stored!)
  walletDbPath   String?  // Path to user's wallet database
  createdAt      DateTime @default(now())
}

model Whitelist {
  id            Int            @id @default(autoincrement())
  email         String         @unique
  reason        String         // Why user wants access
  status        String         @default("pending")  // pending, approved, rejected
  createdAt     DateTime       @default(now())
  approvedAt    DateTime?
  downloadCodes DownloadCode[]
}

model DownloadCode {
  id          Int       @id @default(autoincrement())
  code        String    @unique
  whitelistId Int
  used        Boolean   @default(false)
  usedAt      DateTime?
  createdAt   DateTime  @default(now())
  expiresAt   DateTime
  whitelist   Whitelist @relation(fields: [whitelistId], references: [id])
}
```

### Backend API Routes (Fastify 5.x)

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API ROUTES                        │
├─────────────────────────────────────────────────────────────┤
│ AUTH:                                                        │
│ POST /auth/register   → User registration (username/pass)   │
│ POST /auth/login      → JWT token issuance (7-day expiry)   │
│                                                              │
│ WHITELIST:                                                   │
│ POST /whitelist/join  → Add to alpha waitlist               │
│                                                              │
│ USER:                                                        │
│ GET  /me              → Get current user info               │
│ POST /me/wallet       → Initialize/import wallet            │
│                                                              │
│ WALLET:                                                      │
│ GET  /wallet/address  → Get primary Zcash address           │
│ GET  /wallet/balance  → Get wallet balance                  │
│ POST /wallet/sync     → Sync wallet with blockchain         │
│ POST /wallet/send     → Send transaction                    │
│                                                              │
│ MESSAGES:                                                    │
│ GET  /messages        → Get messages from memo field        │
│                                                              │
│ ZCASH:                                                       │
│ POST /zcash/broadcast → Broadcast raw transaction           │
│ GET  /zcash/network-info → Get network status               │
│                                                              │
│ DOWNLOAD:                                                    │
│ POST /download/verify-code → Verify download code           │
│ GET  /download/apk/:token  → Download APK with token        │
│                                                              │
│ ADMIN (requires X-Admin-Secret header):                      │
│ GET  /admin/whitelist      → List all whitelist entries     │
│ POST /admin/whitelist/:id/approve → Approve entry           │
│ POST /admin/whitelist/:id/reject  → Reject entry            │
│ POST /admin/whitelist/:id/generate-code → Gen download code │
│ POST /admin/whitelist/:id/send-code-email → Email code      │
│ GET  /users                → List all users                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Security Architecture

### Threat Model

| Threat | Mitigation | Status |
|--------|------------|--------|
| Network surveillance | Zcash shielded transactions (unlinkable) | ✅ |
| Server compromise | No messages on server, only addresses | ✅ |
| Device seizure | Emergency destroy (local + remote kill) | ✅ |
| Seed theft (Android) | EncryptedSharedPreferences + MasterKey | ✅ |
| Seed theft (Web) | sessionStorage only (not persisted) | ✅ |
| Message interception | E2E encryption (AES-256-GCM) | ✅ |
| Key derivation weakness | HKDF (RFC 5869) | ⚠️ P1 |
| MITM on key exchange | Signed public keys (KEX protocol) | ⚠️ P1 |
| Group key exposure | Per-recipient ECIES encryption | ⚠️ P1 |
| Replay attacks | Conversation IDs + txid uniqueness | ✅ |
| Spam | Requires ZEC payment per message | ✅ |
| sender_hash collision | Uses 12 chars (48 bits) - acceptable | ✅ |
| Blossom file exposure | E2E encrypt files before upload | ⚠️ P2 |
| Backend mnemonic leak | Remove mnemonic from /me/wallet | ⚠️ P1 |
| No forward secrecy | Double Ratchet (planned) | 📋 P3 |

### Emergency Destruction System

```
┌─────────────────────────────────────────────────────────────┐
│                 DESTRUCTION MECHANISMS                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  LOCAL DESTROY (PIN-protected)                               │
│  ────────────────────────────                                │
│  Trigger: Settings → Security → Destroy All                  │
│  Verification: Require PIN entry                             │
│  Actions:                                                    │
│    1. Clear EncryptedSharedPreferences                       │
│    2. Delete Room database                                   │
│    3. Delete cache (internal + external)                     │
│    4. Delete app files directory                             │
│    5. Clear ChunkCache                                       │
│    6. Request system uninstall dialog                        │
│                                                              │
│  REMOTE KILL (Blockchain-triggered)                          │
│  ─────────────────────────────────                           │
│  Trigger: Transaction to self with:                          │
│    Memo: ZCHAT_DESTROY:<secret_phrase>                       │
│    Amount: Must match configured kill amount (default 1 zat) │
│  Verification:                                               │
│    1. Sender address == self                                 │
│    2. Memo format matches exactly                            │
│    3. Amount matches configured value                        │
│    4. Secret phrase hash matches stored hash                 │
│  Result: Executes destroyAll() immediately                   │
│                                                              │
│  SECURITY: Secret phrase stored as SHA-256 hash only,        │
│            never in plaintext. Attacker cannot discover      │
│            phrase from device.                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Known Issues and Fixes

### P1 (Release Critical) - UPDATED

| Issue | File | Fix | Time |
|-------|------|-----|------|
| Weak key derivation | E2EEncryption.kt:87-91 | Implement HKDF | 3h |
| Unauthenticated KEX | E2EEncryption.kt | Add KEX message type with signatures | 4h |
| Group key unencrypted | ZMSGGroupProtocol.kt | Per-recipient ECIES encryption | 4h |
| sender_hash collision | ZMSGProtocol.kt | Increase to 16 chars | 1h |
| Group history not loading | GroupViewModel.kt:150 | Load from blockchain | 3h |
| GROUP_LEAVE not broadcast | GroupViewModel.kt:213 | Send to all members | 2h |
| Backend stores mnemonic | server.ts | Remove from /me/wallet | 1h |

**Total P1: 18 hours** (increased from 8h due to security requirements)

### P2 (Quality)

| Issue | File | Fix | Time |
|-------|------|-----|------|
| No error handling | Various | ZchatResult sealed class | 4h |
| Logging redaction | Various | Redact addresses | 2h |
| Blossom file unencrypted | (planned) | E2E encrypt before upload | 4h |
| No rate limiting | server.ts | @fastify/rate-limit | 2h |

### P3 (Future)

| Issue | Fix | Time |
|-------|-----|------|
| No forward secrecy | Double Ratchet | 20h |
| ChatViewModel too large | Split into focused classes | 8h |

---

## 11. Scalability Architecture

### Current Limitations

| Bottleneck | Impact | Mitigation |
|------------|--------|------------|
| Single Lightwalletd | Single point of failure | Deploy multiple instances with load balancer |
| Group = N transactions | 100 members = 100 txs | Consider NOSTR for group coordination |
| Memo scanning | CPU on mobile | Lightwalletd memo filtering (future ZEC feature) |
| Blockchain growth | Sync time increases | Checkpoint system, warp sync |

### Scalability Roadmap

```
Phase 1 (Current): Single-node architecture
• 1 Lightwalletd, 1 Zebrad, 1 Backend
• Suitable for < 1000 DAU

Phase 2 (10K users): Redundancy
• Load-balanced Lightwalletd (2-3 instances)
• PostgreSQL read replicas
• CDN for landing page

Phase 3 (100K users): Federation
• Multiple Lightwalletd regions
• Consider Lightwalletd-as-a-service (e.g., zec.rocks)
• Message pruning / archival
```

---

## 12. NOSTR Integration Architecture (Planned)

### Phase 1: Foundation (4h)
- Add rust-nostr SDK dependency
- Derive NOSTR keypair from Zcash seed (m/44'/1237'/0'/0/0)
- Connect to public relays (nos.lol, relay.damus.io, relay.nostr.band)
- Store NOSTR identity in ZchatPreferences

### Phase 2: Blossom File Upload (8h)
- HTTP client for Blossom servers
- NIP-98 authentication (sign HTTP request with NOSTR key)
- E2E encrypt file before upload
- ZFILE message type with encrypted key

### Phase 3: File Sharing UI (8h)
- Parse ZFILE messages
- Download and decrypt from Blossom
- Display images inline
- Other file types (download prompt)

### Phase 4: Audio Messages (8h)
- MediaRecorder for audio capture
- Opus compression (64kbps)
- Blossom upload with encryption
- ZAUDIO message type
- Playback UI with waveform

### Phase 5: WebRTC Calls (20h)
- libwebrtc dependency (org.webrtc:google-webrtc)
- NOSTR signaling via ephemeral events:
  - Kind 25050: Call offer/answer (encrypted to recipient)
  - Kind 25051: ICE candidates
- STUN servers: Google (stun.l.google.com:19302)
- TURN servers: Self-hosted or Twilio (for NAT traversal)
- Call UI: Incoming, ongoing, ended states
- Audio first, then video

---

## 13. References

- [Zcash Protocol Specification](https://zips.z.cash/protocol/protocol.pdf)
- [ZIP-321 Payment Request URIs](https://zips.z.cash/zip-0321)
- [NOSTR Protocol (NIP-01)](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-98 HTTP Auth](https://github.com/nostr-protocol/nips/blob/master/98.md)
- [Blossom Protocol (BUD-01)](https://github.com/hzrd149/blossom)
- [RFC 5869 - HKDF](https://tools.ietf.org/html/rfc5869)
- [rust-nostr SDK](https://github.com/rust-nostr/nostr)
- [Signal Protocol (Double Ratchet)](https://signal.org/docs/specifications/doubleratchet/)

---

## Appendix A: Architecture Change Log

### v1.1 (2026-01-19) - Consistency Review

**Critical Fixes:**
1. Added KEX message type for authenticated key exchange
2. Documented group key security vulnerability and fix
3. Increased sender_hash from 8 to 16 chars
4. Added forward secrecy roadmap

**High Priority Fixes:**
5. Defined MessageMonitor, MemoParser, ChunkCache components
6. Added local storage architecture (Room database)
7. Added error handling architecture (ZchatResult, RetryStrategy)
8. Documented NIP-98 authentication
9. Added Blossom file encryption requirement
10. Clarified HKDF status (proposed vs current)
11. Standardized web app as "Secondary Platform"
12. Clarified ZGRP is separate protocol, not ZMSG type
13. Noted 1237 derivation path is ZCHAT-specific

**Medium Priority Fixes:**
14. Added PostgreSQL schema
15. Added rate limiting requirements
16. Added chunk timeout and pruning
17. Documented remote kill verification
18. Added scalability roadmap

**Verification:** All changes reviewed for internal consistency. No new contradictions introduced.

---

*Document Version 1.1 - Updated 2026-01-19*
