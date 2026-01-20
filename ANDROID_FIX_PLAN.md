# ZCHAT Android Fix Plan v3.1 (Architecture Verified)

**Version:** 3.1
**Last Updated:** 2026-01-19
**Status:** UPDATED after architecture consistency review

**v3.1 Changes:**
- P1 expanded from 8h to 18h after security analysis
- Added: KEX protocol, group key encryption, sender_hash increase, backend mnemonic removal
- Group key encryption elevated from P2 to P1 (security critical)

---

## Critical Corrections from v2.0

### REMOVED: P0 Seed Encryption
**Finding:** Seed storage is ALREADY SECURE.

The Zcash SDK handles seed storage properly:
- **Location:** `EncryptedSharedPreferences` → `co.electriccoin.zcash.encrypted.xml`
- **Encryption:** AES256-GCM (MasterKey) + AES256-SIV (keys) + AES256-GCM (values)
- **Files:**
  - `PersistableWalletProvider.kt` - High-level storage
  - `EncryptedPreferenceProvider.kt` - Encryption layer
  - `AndroidPreferenceProvider.kt` - Thread-safe writes

**No action needed** - this was a false positive from the initial audit.

### VERIFIED: E2E Key Derivation Issue
**Finding:** The HKDF issue IS REAL.

**File:** `E2EEncryption.kt` (lines 87-91)
```kotlin
private fun deriveKey(sharedSecret: ByteArray): ByteArray {
    val digest = java.security.MessageDigest.getInstance("SHA-256")
    digest.update("ZCHAT_E2E_KEY_V1".toByteArray())  // NOT proper HKDF
    return digest.digest(sharedSecret)
}
```

**Problems:**
- No proper extract phase (no salt)
- No expand phase
- Just SHA-256(prefix || secret) - not HKDF

**Also note:** Comment on line 19 says "X25519" but code uses `secp256r1` (line 34)

---

## Verified Priority System

| Priority | Meaning | Timeline | Hours |
|----------|---------|----------|-------|
| P1 | Release Critical | Days 1-3 | 18h |
| P2 | Quality | Week 2 | 8h |
| P3 | Future | Backlog | - |

**No P0 items** - app is demo-ready for basic security.

**WARNING:** P1 items now include security-critical fixes identified during architecture review.

---

## P1: Release Critical (14.5 hours remaining)

**Status after Phase 7 Audit (2026-01-20):**
- ✅ sender_hash: Already 12 chars (adequate) - NO CHANGE NEEDED
- ✅ Backend mnemonic: Already removed from /me/wallet endpoint
- 🔄 GROUP_LEAVE: 90% done (only send path TODO)

### 1. Fix E2E Key Derivation (HKDF)
**File:** `E2EEncryption.kt`
**Time:** 3 hours

**Correct Implementation:**
```kotlin
object HKDF {
    private const val HASH_LEN = 32

    fun deriveKey(
        sharedSecret: ByteArray,
        salt: ByteArray = "ZCHAT_E2E_SALT_V2".toByteArray(),
        info: ByteArray = "ZCHAT_E2E_KEY".toByteArray(),
        length: Int = 32
    ): ByteArray {
        // Extract
        val prk = hmacSha256(salt, sharedSecret)
        // Expand
        return expand(prk, info, length)
    }

    private fun hmacSha256(key: ByteArray, data: ByteArray): ByteArray {
        val mac = javax.crypto.Mac.getInstance("HmacSHA256")
        mac.init(javax.crypto.spec.SecretKeySpec(key, "HmacSHA256"))
        return mac.doFinal(data)
    }

    private fun expand(prk: ByteArray, info: ByteArray, length: Int): ByteArray {
        val n = (length + HASH_LEN - 1) / HASH_LEN
        var t = ByteArray(0)
        val okm = ByteArray(length)
        var offset = 0
        for (i in 1..n) {
            val input = t + info + byteArrayOf(i.toByte())
            t = hmacSha256(prk, input)
            val copyLen = minOf(HASH_LEN, length - offset)
            System.arraycopy(t, 0, okm, offset, copyLen)
            offset += copyLen
        }
        return okm
    }
}

// In E2EEncryption.kt - replace deriveKey function:
private fun deriveKey(sharedSecret: ByteArray, version: Int = 2): ByteArray {
    return when (version) {
        1 -> legacyDeriveKey(sharedSecret)  // Keep old method for backward compat
        2 -> HKDF.deriveKey(sharedSecret)
        else -> throw IllegalArgumentException("Unknown key version: $version")
    }
}

private fun legacyDeriveKey(sharedSecret: ByteArray): ByteArray {
    val digest = java.security.MessageDigest.getInstance("SHA-256")
    digest.update("ZCHAT_E2E_KEY_V1".toByteArray())
    return digest.digest(sharedSecret)
}
```

**Backward Compatibility:**
- Store key version in ZchatPreferences per peer
- New conversations use v2, existing use stored version
- Add `getE2EKeyVersion(peerAddress)` / `setE2EKeyVersion(peerAddress, version)`

---

### 2. Group History Loading
**File:** `GroupViewModel.kt` (line 150)
**Time:** 3 hours

**Implementation:**
```kotlin
private suspend fun loadGroupMessagesFromHistory(groupId: String) {
    val groupKey = zchatPreferences.getGroupKey(groupId) ?: return

    synchronizerProvider.getSynchronizer()
        .transactions
        .first()
        .mapNotNull { tx ->
            tx.memos.firstOrNull()?.let { memo ->
                parseAndDecryptGroupMessage(memo, groupId, groupKey)
            }
        }
        .filter { it != null && it.groupId == groupId }
        .sortedBy { it.timestamp }
        .let { messages ->
            _groupMessages.value = (messages + _pendingMessages.value).distinctBy { it.id }
        }
}

private fun parseAndDecryptGroupMessage(
    memo: String,
    expectedGroupId: String,
    groupKey: ByteArray
): GroupMessage? {
    return try {
        val parsed = ZMSGGroupProtocol.parseGroupMessage(memo) ?: return null
        if (parsed.groupId != expectedGroupId) return null
        if (parsed.type != GroupMessageType.GM) return null

        val decrypted = decryptGroupContent(parsed.payload, groupKey)
        parsed.copy(content = decrypted)
    } catch (e: Exception) {
        null
    }
}
```

---

### 3. GROUP_LEAVE Broadcast + Minor Fixes
**Time:** 2 hours (batched)

**GROUP_LEAVE:**
```kotlin
suspend fun leaveGroup(groupId: String) {
    val members = zchatPreferences.getGroupMembers(groupId)
        .filter { it.status == MemberStatus.ACTIVE && it.address != myAddress }

    val leavePayload = ZMSGGroupProtocol.createLeavePayload(groupId, myAddress)

    // Best-effort broadcast to all members
    members.forEach { member ->
        runCatching {
            sendTransaction(member.address, ZMSGConstants.MIN_AMOUNT, leavePayload)
        }
    }

    // Update local state
    zchatPreferences.setMemberStatus(groupId, myAddress, MemberStatus.LEFT)
    zchatPreferences.setGroupActive(groupId, false)
}
```

**Also in this batch:**
- Increase conversation ID from 8 → 12 chars (~71 bits entropy)
- Add debounce (2 sec) to status updates

---

### 4. Authenticated KEX Protocol (NEW in v3.1)
**File:** `E2EEncryption.kt`
**Time:** 4 hours

**Context:** Current key exchange sends unsigned public keys. MITM attack possible.

**Implementation:**
```kotlin
// New KEX message type (follows ZMSG v4 format)
// ZMSG|4|KEX|<conv_id>|<sender_hash>|<pubkey_b64>|<signature_b64>

fun signPublicKey(ecPublicKey: ByteArray, zcashSpendingKey: SpendingKey): ByteArray {
    val message = "ZCHAT_KEX_V1:" + ecPublicKey.toBase64()
    return Secp256k1.sign(message.sha256(), zcashSpendingKey.toSecp256k1())
}

fun verifyKEX(kexMessage: KEXMessage, expectedSenderAddress: String): Boolean {
    val expectedHash = SHA256(expectedSenderAddress).take(16)
    if (kexMessage.senderHash != expectedHash) return false

    val message = "ZCHAT_KEX_V1:" + kexMessage.ecPubkey.toBase64()
    return Secp256k1.verify(
        message.sha256(),
        kexMessage.signature,
        derivePublicKeyFromAddress(expectedSenderAddress)
    )
}
```

**Steps:**
- Define KEX message format in ZMSGProtocol
- Implement signature creation using Zcash spending key
- Implement signature verification
- Update E2E handshake to use KEX messages
- Reject unsigned key exchanges

---

### 5. Group Key ECIES Encryption (Elevated from P2)
**File:** `GroupViewModel.kt`, `GroupCrypto.kt`
**Time:** 4 hours

**Context:** Group key currently sent as base64 - anyone seeing the memo can extract the key.

**Implementation:**
```kotlin
// ECIES: Encrypt group key for each recipient
fun encryptGroupKeyForMember(
    groupKey: ByteArray,
    memberPublicKey: ECPublicKey
): ByteArray {
    // ECIES envelope
    val ephemeral = KeyPairGenerator.getInstance("EC").generateKeyPair()
    val sharedSecret = ECDH.deriveShared(ephemeral.private, memberPublicKey)
    val encKey = HKDF.deriveKey(sharedSecret, info = "ZCHAT_GROUP_KEY".toByteArray())
    return AesGcm.encrypt(groupKey, encKey)
}

// GROUP_INVITE now includes encrypted key blob instead of raw key
// GI|<group_id>|<group_name>|<encrypted_key_blob>|<sender_hash>
```

**Why elevated to P1:**
- Security critical: plaintext group keys leak to blockchain observers
- All group message confidentiality depends on this

---

### 6. sender_hash Already Adequate (12 chars)
**Files:** `ZMSGProtocol.kt:53-57`, `ZMSGConstants.kt:28-29`
**Time:** 0 hours (NO CHANGE NEEDED)

**Verification (Phase 7 Audit 2026-01-20):**
The implementation already uses 12 hex characters (6 bytes of SHA-256):
```kotlin
fun generateAddressHash(address: String): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val hashBytes = digest.digest(address.toByteArray())
    return hashBytes.take(6).joinToString("") { "%02x".format(it) }  // 12 chars
}
const val HASH_LENGTH = 12
```

**Math:** 12 chars (48 bits) → collision at ~2^24 = 16M messages (acceptable for ZCHAT scale)

**Status:** ✅ No change needed - implementation is adequate.

---

### 7. Remove Mnemonic from Backend /me/wallet (NEW in v3.1)
**File:** `apps/backend/src/routes/wallet.ts`
**Time:** 1 hour

**Context:** Backend returns mnemonic in `/me/wallet` response - security risk.

**Fix:**
```typescript
// Remove mnemonic from response
router.get('/me/wallet', async (req, res) => {
    const wallet = await getWallet(req.user.id);
    res.json({
        address: wallet.address,
        balance: wallet.balance,
        // mnemonic: wallet.mnemonic  // REMOVE THIS LINE
    });
});
```

---

## P2: Quality Improvements (6 hours)

### 8. Error Handling
**Time:** 4 hours
- Create `sealed class ZchatResult<T, E>`
- Apply to critical paths

### 9. Logging Redaction
**Time:** 2 hours
```kotlin
fun String.redactAddress(): String =
    if (length > 20) "${take(6)}...${takeLast(4)}" else "***"
```

---

## P3: Future / NOSTR Integration

### 10. Split ChatViewModel
**Defer until:** NOSTR integration (will restructure anyway)

### 11. X25519 Migration
**Note:** Current E2E uses secp256r1 (NIST P-256). X25519 is preferred but not urgent.
**Defer until:** NOSTR integration (can share key derivation)

---

## NOSTR Integration Specification

### Why NOSTR for ZCHAT?

| Feature | Current (Zcash only) | With NOSTR |
|---------|---------------------|------------|
| Text messages | 75s block latency | Keep on Zcash (privacy) |
| File sharing | Not possible | Blossom servers |
| Audio messages | Not possible | Blossom + NIP-94 |
| Video/audio calls | Not possible | WebRTC via NOSTR |
| "Typing..." indicator | Not possible | NOSTR ephemeral events |
| Instant notifications | Not possible | NOSTR relays |

### Recommended Stack

#### 1. SDK: rust-nostr (Kotlin bindings)
```kotlin
// build.gradle.kts
dependencies {
    implementation("io.github.rust-nostr:nostr-sdk:0.13.0-alpha.2")
}
```
- Mature, well-maintained
- ~15MB APK size (with ABI split)
- Native Kotlin API

#### 2. File Storage: Blossom Protocol
**Why Blossom over alternatives:**

| Solution | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Blossom** | Native NOSTR, SHA-256 addressing, metadata stripping, simple API | Newer, fewer servers | **Best for ZCHAT** |
| IPFS | Established, many pinning services | Complex, no native NOSTR | Good backup |
| Storj | Fixed pricing ($0.004/GB/mo), E2E encrypted | Centralized billing | For large files |
| Arweave | Permanent storage | Costs AR tokens | Not needed |

**Blossom features:**
- [BUD-01](https://github.com/hzrd149/blossom): Basic upload/download
- [BUD-05](https://github.com/hzrd149/blossom): Media endpoint (strips metadata)
- Multi-server redundancy
- Content addressed by SHA-256

#### 3. WebRTC Signaling: NOSTR Relays

**Options evaluated:**

| Solution | Pros | Cons | Verdict |
|----------|------|------|---------|
| **NOSTR relays** | Already using NOSTR, ephemeral events, decentralized | Need relay infrastructure | **Best fit** |
| [Trystero](https://github.com/dmotz/trystero) | Multi-protocol (NOSTR, BitTorrent, MQTT), no server | JS library (not native Android) | Web app option |
| [webConnect.js](https://webconnect.js.org/) | Auto mesh, zero config | JS only | Web app option |
| Matrix | Full-featured | Adds complexity | Overkill |

**For Android:** Use rust-nostr SDK directly for signaling
**For Web (future):** Consider Trystero for simplicity

### Identity Architecture

**One seed phrase = Two identities:**

```
BIP39 Seed Phrase (24 words)
         │
         ├─── m/44'/133'/0'/0/0  → Zcash unified address
         │                        (existing, for payments + messages)
         │
         └─── m/44'/1237'/0'/0/0 → NOSTR secp256k1 keypair
                                   (new, for files + calls + presence)
```

**Implementation:**
```kotlin
fun deriveNostrKeypair(bip39Seed: ByteArray): NostrKeypair {
    // NOSTR uses coin type 1237 (from SLIP-44)
    val derivationPath = "m/44'/1237'/0'/0/0"
    val derivedKey = Bip32.derivePrivateKey(bip39Seed, derivationPath)
    return NostrKeypair.fromPrivateKeyBytes(derivedKey)
}
```

**Benefits:**
- User manages single seed phrase
- Zcash and NOSTR identities cryptographically linked
- Backup covers both

### Protocol Extensions

#### New ZMSG Types for NOSTR Features

```
# File reference (sent via Zcash, file on Blossom)
ZFILE|<sha256>|<mime_type>|<size_bytes>|<blossom_url>|<sender_hash>

# Audio message reference
ZAUDIO|<sha256>|<duration_sec>|<blossom_url>|<sender_hash>

# Call initiation (sent via NOSTR relay, not Zcash)
ZCALL|OFFER|<call_id>|<sdp_hash>
ZCALL|ANSWER|<call_id>|<sdp_hash>
ZCALL|ICE|<call_id>|<candidate_data>
ZCALL|END|<call_id>|<reason>

# Presence (sent via NOSTR relay)
ZPRESENCE|TYPING|<conversation_id>
ZPRESENCE|ONLINE|<timestamp>
```

### Data Flow Diagrams

#### File Sharing Flow
```
1. User selects image/file
         │
2. Upload to Blossom server
   POST /upload (with NIP-98 auth)
         │
3. Receive SHA-256 hash + URL
         │
4. Create ZMSG:
   ZFILE|abc123...|image/jpeg|245000|https://blossom.server/abc123|<hash>
         │
5. Send via Zcash shielded transaction
         │
6. Recipient parses ZFILE, fetches from Blossom by hash
```

#### Audio/Video Call Flow
```
1. Caller initiates call
         │
2. Send ZCALL|OFFER via NOSTR relay (ephemeral event, kind 25050)
   - Encrypted to recipient's NOSTR pubkey
         │
3. Callee receives offer, shows incoming call UI
         │
4. Callee accepts, sends ZCALL|ANSWER via NOSTR
         │
5. Exchange ICE candidates via NOSTR (kind 25051)
         │
6. WebRTC peer connection established
         │
7. Audio/video streams directly peer-to-peer
         │
8. Call ends → ZCALL|END via NOSTR
         │
9. (Optional) Write call record to Zcash for history:
   ZCALLRECORD|<call_id>|<duration>|<participants>|<sender_hash>
```

### Implementation Phases

#### Phase 1: NOSTR Foundation (4 hours)
- Add rust-nostr SDK dependency
- Implement NOSTR keypair derivation from Zcash seed
- Connect to public relays
- Store NOSTR identity in ZchatPreferences

#### Phase 2: Blossom File Upload (8 hours)
- Implement Blossom HTTP client
- Add NIP-98 authentication
- Create ZFILE message type
- UI for file selection and preview

#### Phase 3: File Sharing in Chat (8 hours)
- Parse ZFILE messages
- Download from Blossom
- Display images inline
- Handle other file types (download prompt)

#### Phase 4: Audio Messages (8 hours)
- Record audio (MediaRecorder)
- Compress (AAC/Opus)
- Upload to Blossom
- ZAUDIO message type
- Playback UI

#### Phase 5: WebRTC Calls (20 hours)
- Add WebRTC dependency (libwebrtc)
- NOSTR signaling (ephemeral events)
- Call UI (incoming, ongoing, ended)
- ICE/STUN/TURN configuration
- Audio call first, then video

**Total NOSTR integration: ~48 hours**

---

## Implementation Schedule (Updated v3.1)

### Days 1-3 (14.5 hours) - Release Critical + Security
| Time | Task | Status |
|------|------|--------|
| 3h | P1-1: HKDF implementation + backward compat | Not started |
| 3h | P1-2: Group history loading | Not started |
| 0.5h | P1-3: GROUP_LEAVE send path | 90% done |
| 4h | P1-4: Authenticated KEX protocol | Not started |
| 4h | P1-5: Group key ECIES encryption | Not started |
| - | P1-6: sender_hash | ✅ Already 12 chars (adequate) |
| - | P1-7: Backend mnemonic fix | ✅ Already fixed |

### Week 2 (6 hours) - Quality
| Time | Task |
|------|------|
| 4h | P2: Error handling |
| 2h | P2: Logging redaction |

### Weeks 3-4 (48 hours) - NOSTR
| Time | Task |
|------|------|
| 4h | NOSTR foundation |
| 8h | Blossom upload |
| 8h | File sharing UI |
| 8h | Audio messages |
| 20h | WebRTC calls |

---

## Testing Checklist

### After P1:
- [ ] New E2E conversations work with HKDF v2
- [ ] Existing E2E conversations decrypt with legacy v1
- [ ] Group messages persist after app restart
- [ ] GROUP_LEAVE notifies other members
- [ ] Status updates are debounced
- [ ] KEX messages include valid signatures
- [ ] Unsigned key exchanges are rejected
- [ ] Group invites use ECIES-encrypted keys
- [x] sender_hash uses 12 chars (verified in Phase 7 Audit - adequate)
- [x] Backend /me/wallet no longer returns mnemonic (verified in Phase 7 Audit)

### After NOSTR Phase 2:
- [ ] File uploads to Blossom succeed
- [ ] Files are retrievable by SHA-256 hash
- [ ] ZFILE messages parse correctly

### After NOSTR Phase 5:
- [ ] Audio calls connect peer-to-peer
- [ ] Video calls work
- [ ] Call history recorded (optional)

---

## Architecture Validation

**What's correct:**
- Seed storage (Zcash SDK handles securely)
- ZMSG protocol design
- AES-256-GCM for encryption
- DestroyManager implementation
- Time-locked messages

**What this plan fixes (P1):**
- E2E key derivation (HKDF) - cryptographically proper
- Group message persistence - history loads on restart
- GROUP_LEAVE notification - broadcast to all members
- **NEW v3.1:** Authenticated key exchange (KEX) - prevents MITM
- **NEW v3.1:** Group key encryption (ECIES) - prevents key leakage
- **NEW v3.1:** sender_hash 16 chars - prevents birthday collisions
- **NEW v3.1:** Backend mnemonic removal - reduces API attack surface

**What's deferred (will change with NOSTR):**
- ChatViewModel split
- X25519 migration
- Rate limiting infrastructure

---

## Success Metrics

| Milestone | Criteria |
|-----------|----------|
| Release Ready | All P1 done (14.5h remaining), E2E backward compat, KEX verified |
| Quality | P2 done, no sensitive data in logs |
| NOSTR MVP | File sharing works |
| NOSTR Complete | Audio/video calls work |

---

*Total critical path (P1): 14.5 hours remaining (was 18h, 2 items verified complete)*
*Total P1 + P2: 20.5 hours*
*Total with NOSTR: 68.5 hours*
