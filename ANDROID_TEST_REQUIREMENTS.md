# ZCHAT Android Test Requirements

**Version:** 1.0
**Last Updated:** 2026-01-19
**Status:** CRITICAL - No ZCHAT-specific tests exist

---

## Current State

The Android project (zchat-android) contains 51 test files, but **ALL are inherited from Zashi** (the upstream Zcash wallet). There are **ZERO tests for ZCHAT-specific functionality**.

### Test Gaps Identified

| Component | Location | Tests Required | Priority |
|-----------|----------|----------------|----------|
| E2EEncryption | `/ui-lib/.../crypto/E2EEncryption.kt` | Unit tests | P0 - CRITICAL |
| ZMSGProtocol | `/ui-lib/.../model/ZMSGProtocol.kt` | Unit tests | P0 - CRITICAL |
| ZMSGGroupProtocol | `/ui-lib/.../model/ZMSGGroupProtocol.kt` | Unit tests | P1 |
| ZMSGSpecialMessages | `/ui-lib/.../model/ZMSGSpecialMessages.kt` | Unit tests | P1 |
| ChatViewModel | `/ui-lib/.../viewmodel/ChatViewModel.kt` | Unit + Integration | P1 |
| GroupViewModel | `/ui-lib/.../viewmodel/GroupViewModel.kt` | Unit + Integration | P1 |
| ZchatComposeVM | `/ui-lib/.../viewmodel/ZchatComposeVM.kt` | Unit tests | P2 |
| AddressCacheImpl | `/ui-lib/.../datasource/AddressCacheImpl.kt` | Unit tests | P2 |

---

## P0 CRITICAL: E2EEncryption Tests

**File:** `ui-lib/src/main/java/co/electriccoin/zcash/ui/screen/chat/crypto/E2EEncryption.kt`

### Test Categories

#### 1. Key Generation Tests
```kotlin
@Test
fun `generateKeyPair returns valid key pair`()

@Test
fun `generateKeyPair produces different keys each call`()

@Test
fun `generated public key is base64 encoded`()

@Test
fun `generated private key is base64 encoded`()
```

#### 2. Key Derivation Tests (CRITICAL - Security)
```kotlin
@Test
fun `deriveSharedSecret produces same result for both parties`()
// Alice derives shared secret using her private + Bob's public
// Bob derives shared secret using his private + Alice's public
// Both results must be identical

@Test
fun `deriveSharedSecret produces different result with different keys`()

@Test
fun `deriveKey includes ZCHAT info string for domain separation`()

@Test
fun `deriveKey produces 256-bit output`()
```

#### 3. Encryption/Decryption Tests
```kotlin
@Test
fun `encrypt produces E2E prefixed output`()

@Test
fun `encrypt produces different ciphertext for same plaintext (random nonce)`()

@Test
fun `decrypt successfully decrypts encrypted message`()

@Test
fun `decrypt fails with wrong key`()

@Test
fun `decrypt fails with corrupted ciphertext`()

@Test
fun `decrypt fails with corrupted nonce`()

@Test
fun `roundtrip encryption works for empty string`()

@Test
fun `roundtrip encryption works for unicode content`()

@Test
fun `roundtrip encryption works for max memo length`()
```

#### 4. Message Format Tests
```kotlin
@Test
fun `isE2EEncrypted returns true for E2E prefix`()

@Test
fun `isE2EEncrypted returns false for plain text`()

@Test
fun `parseE2EMessage extracts nonce and ciphertext`()
```

### Known Issue to Test
The current implementation uses SHA-256 for key derivation (lines 87-91) instead of proper HKDF. Tests should verify:
```kotlin
@Test
fun `key derivation uses proper HKDF (RFC 5869)`()
// This test will FAIL until HKDF is implemented (P1 task)
```

---

## P0 CRITICAL: ZMSGProtocol Tests

**File:** `ui-lib/src/main/java/co/electriccoin/zcash/ui/screen/chat/model/ZMSGProtocol.kt`

### Test Categories

#### 1. Address Hash Tests
```kotlin
@Test
fun `generateAddressHash returns 12 hex characters`()

@Test
fun `generateAddressHash is deterministic for same address`()

@Test
fun `generateAddressHash differs for different addresses`()
```

#### 2. Conversation ID Tests
```kotlin
@Test
fun `generateConversationId returns 12 alphanumeric characters`()

@Test
fun `generateConversationId produces unique IDs`()

@Test
fun `generated conversation ID uses only allowed characters`()
```

#### 3. Message Creation Tests (v4)
```kotlin
@Test
fun `createV4InitMessage has correct format`()
// Expected: ZMSG|v4|<convID>|INIT|<address>|<message>

@Test
fun `createV4ReplyMessage has correct format`()
// Expected: ZMSG|v4|<convID>|<hash>|<message>

@Test
fun `createV4InitMessage handles special characters in message`()

@Test
fun `createV4ReplyMessage includes sender hash`()
```

#### 4. Message Parsing Tests
```kotlin
@Test
fun `parseZMSG correctly identifies v4 INIT message`()

@Test
fun `parseZMSG correctly identifies v4 reply message`()

@Test
fun `parseZMSG extracts conversation ID`()

@Test
fun `parseZMSG extracts sender hash`()

@Test
fun `parseZMSG extracts message content`()

@Test
fun `parseZMSG returns null for non-ZMSG content`()

@Test
fun `parseZMSG handles malformed messages gracefully`()
```

#### 5. Chunked Message Tests
```kotlin
@Test
fun `createChunkedV4InitMessages splits long messages`()

@Test
fun `chunk count is correct for message length`()

@Test
fun `chunks have correct sequence numbers`()

@Test
fun `reassembled chunks equal original message`()

@Test
fun `chunked messages fit within 512 byte limit`()
```

#### 6. Backward Compatibility Tests
```kotlin
@Test
fun `parseZMSG handles v3 messages`()

@Test
fun `parseZMSG handles v2 messages`()

@Test
fun `parseZMSG handles legacy formats`()
```

---

## P1: ViewModel Tests

### ChatViewModel Tests

**File:** `ui-lib/src/main/java/co/electriccoin/zcash/ui/screen/chat/viewmodel/ChatViewModel.kt`

```kotlin
@Test
fun `sendMessage creates correct ZMSG format`()

@Test
fun `sendMessage encrypts content when E2E enabled`()

@Test
fun `receiveMessage decrypts E2E content`()

@Test
fun `receiveMessage handles unencrypted messages`()

@Test
fun `conversation state updates on new message`()

@Test
fun `message list is ordered by timestamp`()
```

### GroupViewModel Tests

**File:** `ui-lib/src/main/java/co/electriccoin/zcash/ui/screen/chat/viewmodel/GroupViewModel.kt`

```kotlin
@Test
fun `createGroup generates valid group ID`()

@Test
fun `sendGroupInvite creates correct ZGRP format`()

@Test
fun `acceptGroupInvite stores group key`()

@Test
fun `sendGroupMessage encrypts with group key`()

@Test
fun `leaveGroup broadcasts GROUP_LEAVE message`()

@Test
fun `group member list updates on join/leave`()
```

---

## Test Setup Instructions

### 1. Create Test Directory Structure

```
ui-lib/src/test/java/co/electriccoin/zcash/ui/screen/chat/
├── crypto/
│   └── E2EEncryptionTest.kt
├── model/
│   ├── ZMSGProtocolTest.kt
│   ├── ZMSGGroupProtocolTest.kt
│   └── ZMSGSpecialMessagesTest.kt
└── viewmodel/
    ├── ChatViewModelTest.kt
    └── GroupViewModelTest.kt
```

### 2. Add Test Dependencies (build.gradle.kts)

```kotlin
dependencies {
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.mockito:mockito-core:5.8.0")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.2.1")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("io.mockk:mockk:1.13.8")
}
```

### 3. Create Base Test Class

```kotlin
abstract class ZchatBaseTest {
    @get:Rule
    val mainDispatcherRule = MainDispatcherRule()

    protected val testAddress = "u1testaddress123456789"
    protected val testConversationId = "abc123xyz456"
}
```

---

## Test Vectors

### E2E Encryption Test Vectors

```kotlin
object E2ETestVectors {
    // Known key pairs for deterministic testing
    val alicePublicKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE..."
    val alicePrivateKey = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEH..."
    val bobPublicKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE..."
    val bobPrivateKey = "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEH..."

    // Expected shared secret (hex)
    val expectedSharedSecret = "a1b2c3d4..."

    // Test message
    val plaintext = "Hello, secure world!"
    val nonce = "..." // 12 bytes
    val expectedCiphertext = "..." // with known nonce
}
```

### ZMSG Protocol Test Vectors

```kotlin
object ZMSGTestVectors {
    // v4 INIT message
    val v4InitInput = Triple(
        "abc123xyz456", // convId
        "u1sender...",   // address
        "Hello!"         // message
    )
    val v4InitExpected = "ZMSG|v4|abc123xyz456|INIT|u1sender...|Hello!"

    // v4 reply message
    val v4ReplyInput = Triple(
        "abc123xyz456",
        "u1sender...",
        "Reply!"
    )
    // Address hash of u1sender... should be calculated

    // Chunked message test
    val longMessage = "A".repeat(1000) // Exceeds memo limit
    val expectedChunkCount = 3
}
```

---

## CI Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/android-tests.yml
name: Android Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Run unit tests
        run: ./gradlew :ui-lib:test

      - name: Upload test results
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: ui-lib/build/reports/tests/
```

---

## Implementation Priority

1. **Week 1 (P0 Critical)**
   - E2EEncryption unit tests (key generation, derivation, encrypt/decrypt)
   - ZMSGProtocol unit tests (parsing, generation, chunking)

2. **Week 2 (P1 High)**
   - ChatViewModel tests
   - GroupViewModel tests
   - ZMSGGroupProtocol tests

3. **Week 3 (P2 Medium)**
   - ZchatComposeVM tests
   - AddressCacheImpl tests
   - Integration tests

---

## Related Documents

- `IMPLEMENTATION_STEPS.md` - Current P1 tasks include HKDF implementation
- `DEVELOPMENT_STANDARDS.md` - Test naming conventions
- `ARCHITECTURE.md` - ZMSG Protocol specification
- `ISSUES_TO_FIX.md` - Security issues requiring test coverage

---

*This document should be updated as tests are implemented. Mark items as DONE with dates.*
