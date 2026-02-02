# ZCHAT Development Standards

**Based on:** Boris Cherny's "Programming TypeScript" principles + Modern Development Practices
**Version:** 2.1
**Last Updated:** 2026-01-19
**Applies to:** TypeScript (Web/Backend) + Kotlin (Android)

**v2.1 Changes:**
- Added Section 7: Explicit Return Types
- Added Section 8: Functional Programming Patterns
- Added Section 9: Dependency Injection
- Updated Quick Reference with Modern Practices checklists

---

## Core Philosophy

Boris Cherny's key insight: **Make invalid states unrepresentable at the type level.**

This document translates that principle into actionable standards for both TypeScript and Kotlin codebases.

---

## 1. Type Safety: No Escape Hatches

### The Principle
Every value should have a known, explicit type. Escape hatches (`any`, `as`, force casts) hide bugs and create runtime errors.

### TypeScript

```typescript
// BAD - Escape hatches
const data: any = fetchData();
const user = response as User;
// @ts-ignore
walletCore.init();

// GOOD - Explicit types
const data: unknown = fetchData();
if (isValidUser(data)) {
  const user: User = data;  // Type narrowed safely
}

// For WASM modules - create proper declarations
// wallet-core.d.ts
declare module 'wallet-core' {
  interface WalletCore {
    init_new_wallet(): string;
    send_message_dm(to: string, text: string): TransactionResult;
    list_messages(): Message[];
  }
  const walletCore: WalletCore;
  export default walletCore;
}
```

### Kotlin

```kotlin
// BAD - Unsafe casts
val user = response as User  // ClassCastException if wrong
val data = json as? Map<*, *>  // Loses type info

// GOOD - Safe patterns
val user: User? = response as? User
user?.let { processUser(it) } ?: handleInvalidResponse()

// Or with sealed classes
when (val result = parseResponse(json)) {
    is ParseResult.Success -> processUser(result.user)
    is ParseResult.Error -> handleError(result.message)
}
```

### tsconfig.json (Required)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true
  }
}
```

---

## 2. State Machine Patterns: Discriminated Unions

### The Principle
Complex state should be modeled as a **discriminated union** (TypeScript) or **sealed class** (Kotlin). This makes invalid states impossible to construct.

### TypeScript

```typescript
// BAD - Boolean soup
interface ChatState {
  loading: boolean;
  error: string | null;
  messages: Message[];
  isConnected: boolean;
}
// Problem: loading=true AND error="failed" is representable but invalid

// GOOD - Discriminated union
type ChatState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'connected'; messages: Message[] }
  | { status: 'error'; error: Error; retryCount: number };

// TypeScript enforces valid states
function renderChat(state: ChatState): JSX.Element {
  switch (state.status) {
    case 'idle':
      return <IdleScreen />;
    case 'connecting':
      return <LoadingSpinner />;
    case 'connected':
      return <MessageList messages={state.messages} />;
    case 'error':
      return <ErrorMessage error={state.error} retry={state.retryCount} />;
  }
}
```

### Kotlin

```kotlin
// BAD - Boolean flags
data class ChatState(
    val isLoading: Boolean,
    val error: String?,
    val messages: List<Message>,
    val isConnected: Boolean
)

// GOOD - Sealed class hierarchy
sealed class ChatState {
    object Idle : ChatState()
    object Connecting : ChatState()
    data class Connected(val messages: List<Message>) : ChatState()
    data class Error(val error: Throwable, val retryCount: Int) : ChatState()
}

// Kotlin enforces exhaustive when
fun renderChat(state: ChatState): View = when (state) {
    is ChatState.Idle -> IdleScreen()
    is ChatState.Connecting -> LoadingSpinner()
    is ChatState.Connected -> MessageList(state.messages)
    is ChatState.Error -> ErrorMessage(state.error, state.retryCount)
    // No else needed - compiler checks exhaustiveness
}
```

### Application to ZCHAT

```kotlin
// For message parsing
sealed class ParsedMessage {
    data class DirectMessage(val content: String, val encrypted: Boolean) : ParsedMessage()
    data class Reaction(val targetTxid: String, val emoji: String) : ParsedMessage()
    data class ReadReceipt(val targetTxid: String) : ParsedMessage()
    data class TimeLocked(val type: TimeLockType, val lockedContent: ByteArray) : ParsedMessage()
    data class GroupMessage(val groupId: String, val content: String) : ParsedMessage()
    object Invalid : ParsedMessage()
}

// For time-locked message types
sealed class TimeLockType {
    data class Scheduled(val unlockTime: Instant) : TimeLockType()
    data class BlockHeight(val unlockBlock: Long) : TimeLockType()
    data class PaymentRequired(val amountZatoshi: Long) : TimeLockType()
    data class Conditional(val answerHash: String, val hint: String) : TimeLockType()
}
```

---

## 3. Result Types: Explicit Error Handling

### The Principle
Operations that can fail should return a **Result type**, not throw exceptions. This makes error handling explicit and compile-time checked.

### TypeScript

```typescript
// Define once, use everywhere
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Async version
type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Usage
async function sendTransaction(
  params: SendTransactionParams
): AsyncResult<TransactionId, TransactionError> {
  try {
    const txid = await wallet.send(params);
    return { success: true, data: txid };
  } catch (e) {
    return { success: false, error: new TransactionError(e) };
  }
}

// Caller MUST handle both cases
const result = await sendTransaction(params);
if (!result.success) {
  showError(result.error.message);
  return;
}
console.log('Sent:', result.data);
```

### Kotlin

```kotlin
// Use Kotlin's built-in Result or define custom
sealed class ZchatResult<out T, out E> {
    data class Success<T>(val data: T) : ZchatResult<T, Nothing>()
    data class Failure<E>(val error: E) : ZchatResult<Nothing, E>()

    inline fun <R> fold(
        onSuccess: (T) -> R,
        onFailure: (E) -> R
    ): R = when (this) {
        is Success -> onSuccess(data)
        is Failure -> onFailure(error)
    }

    inline fun <R> map(transform: (T) -> R): ZchatResult<R, E> = when (this) {
        is Success -> Success(transform(data))
        is Failure -> this
    }
}

// Usage
suspend fun sendTransaction(
    params: SendTransactionParams
): ZchatResult<TransactionId, TransactionError> {
    return try {
        val txid = synchronizer.send(params)
        ZchatResult.Success(txid)
    } catch (e: Exception) {
        ZchatResult.Failure(TransactionError.fromException(e))
    }
}

// Caller handles both cases
sendTransaction(params).fold(
    onSuccess = { txid -> showSuccess("Sent: $txid") },
    onFailure = { error -> showError(error.message) }
)
```

### Error Type Hierarchies

```kotlin
// Define domain-specific error hierarchies
sealed class ZchatError {
    // Network errors
    sealed class Network : ZchatError() {
        object NoConnection : Network()
        data class Timeout(val durationMs: Long) : Network()
        data class ServerError(val code: Int, val message: String) : Network()
    }

    // Wallet errors
    sealed class Wallet : ZchatError() {
        object InsufficientFunds : Wallet()
        object InvalidAddress : Wallet()
        data class SyncFailed(val cause: Throwable) : Wallet()
    }

    // Crypto errors
    sealed class Crypto : ZchatError() {
        object DecryptionFailed : Crypto()
        object InvalidSignature : Crypto()
        data class KeyDerivationFailed(val reason: String) : Crypto()
    }
}
```

---

## 4. Exhaustiveness Checking

### The Principle
When switching on a discriminated union, **always handle all cases**. Use `never` (TypeScript) or sealed classes (Kotlin) to get compile-time enforcement.

### TypeScript

```typescript
type MessageType = 'DM' | 'KEX' | 'RXN' | 'RCV' | 'RPL' | 'REQ' | 'CHK' | 'STT';

function processMessage(type: MessageType): string {
  switch (type) {
    case 'DM':
      return 'Direct message';
    case 'RXN':
      return 'Reaction';
    case 'RCV':
      return 'Read receipt';
    case 'RPL':
      return 'Reply';
    case 'REQ':
      return 'Payment request';
    case 'CHK':
      return 'Chunked message';
    case 'STT':
      return 'Status update';
    case 'KEX':
      return 'Key exchange';
    default:
      // Compile error if any case is missing
      const _exhaustive: never = type;
      throw new Error(`Unhandled message type: ${_exhaustive}`);
  }
}
```

### Kotlin

```kotlin
// Sealed classes + when = exhaustive by default
sealed class MessageType {
    object DirectMessage : MessageType()
    object Reaction : MessageType()
    object ReadReceipt : MessageType()
    object Reply : MessageType()
    object PaymentRequest : MessageType()
    object ChunkedMessage : MessageType()
    object StatusUpdate : MessageType()
    object GroupMessage : MessageType()
}

fun processMessage(type: MessageType): String = when (type) {
    MessageType.DirectMessage -> "Direct message"
    MessageType.Reaction -> "Reaction"
    MessageType.ReadReceipt -> "Read receipt"
    MessageType.Reply -> "Reply"
    MessageType.PaymentRequest -> "Payment request"
    MessageType.ChunkedMessage -> "Chunked message"
    MessageType.StatusUpdate -> "Status update"
    MessageType.GroupMessage -> "Group message"
    // No else - compiler ensures exhaustiveness
}
```

---

## 5. Domain Types: Branded/NewType Patterns

### The Principle
Primitive types that represent different domain concepts should be **distinct types**. This prevents mixing up IDs, addresses, amounts, etc.

### TypeScript (Branded Types)

```typescript
// Define branded types
type ZcashAddress = string & { readonly _brand: 'ZcashAddress' };
type TransactionId = string & { readonly _brand: 'TransactionId' };
type ConversationId = string & { readonly _brand: 'ConversationId' };
type Zatoshi = number & { readonly _brand: 'Zatoshi' };
type GroupId = string & { readonly _brand: 'GroupId' };

// Factory functions with validation
function toZcashAddress(value: string): ZcashAddress {
  if (!value.startsWith('u1') && !value.startsWith('zs')) {
    throw new Error(`Invalid Zcash address: ${value}`);
  }
  return value as ZcashAddress;
}

function toZatoshi(zec: number): Zatoshi {
  if (zec < 0) throw new Error('Amount cannot be negative');
  if (!Number.isFinite(zec)) throw new Error('Amount must be finite');
  return Math.round(zec * 100_000_000) as Zatoshi;
}

function toConversationId(value: string): ConversationId {
  if (!/^[a-zA-Z0-9]{12}$/.test(value)) {
    throw new Error(`Invalid conversation ID: ${value}`);
  }
  return value as ConversationId;
}

// Now the compiler prevents mixing them up
function sendMessage(
  to: ZcashAddress,      // Can't accidentally pass a TransactionId
  amount: Zatoshi,       // Can't accidentally pass ZEC as Zatoshi
  convId: ConversationId // Can't accidentally pass a GroupId
): Promise<TransactionId>;
```

### Kotlin (Value Classes)

```kotlin
// Use value classes for zero-cost domain types
@JvmInline
value class ZcashAddress private constructor(val value: String) {
    companion object {
        fun parse(value: String): ZcashAddress {
            require(value.startsWith("u1") || value.startsWith("zs")) {
                "Invalid Zcash address: $value"
            }
            return ZcashAddress(value)
        }
    }
}

@JvmInline
value class Zatoshi(val value: Long) {
    init {
        require(value >= 0) { "Amount cannot be negative" }
    }

    companion object {
        fun fromZec(zec: Double): Zatoshi = Zatoshi((zec * 100_000_000).toLong())
    }

    fun toZec(): Double = value / 100_000_000.0
}

@JvmInline
value class ConversationId private constructor(val value: String) {
    companion object {
        private val PATTERN = Regex("^[a-zA-Z0-9]{12}$")

        fun parse(value: String): ConversationId {
            require(PATTERN.matches(value)) { "Invalid conversation ID: $value" }
            return ConversationId(value)
        }

        fun generate(): ConversationId {
            val chars = ('A'..'Z') + ('0'..'9')  // Uppercase + digits only
            return ConversationId((1..8).map { chars.random() }.joinToString(""))
        }
    }
}

@JvmInline
value class GroupId private constructor(val value: String) {
    companion object {
        fun parse(value: String): GroupId = GroupId(value)
        fun generate(): GroupId = GroupId(UUID.randomUUID().toString())
    }
}

// Compiler enforces correct usage
suspend fun sendMessage(
    to: ZcashAddress,
    amount: Zatoshi,
    convId: ConversationId
): TransactionId
```

---

## 6. Immutability by Default

### The Principle
Data should be **immutable unless mutation is explicitly required**. Immutable data is easier to reason about and prevents entire classes of bugs.

### TypeScript

```typescript
// Use Readonly for objects
interface User {
  readonly id: string;
  readonly email: string;
  readonly walletAddress: ZcashAddress;
}

// Use readonly arrays
type Messages = readonly Message[];

// Use as const for literal types
const MESSAGE_TYPES = ['DM', 'RXN', 'RCV', 'RPL'] as const;
type MessageType = typeof MESSAGE_TYPES[number];

// Deep readonly for nested structures
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

type ImmutableConfig = DeepReadonly<{
  network: {
    host: string;
    port: number;
  };
  wallet: {
    defaultFee: number;
  };
}>;
```

### Kotlin

```kotlin
// Use val, not var
data class User(
    val id: String,
    val email: String,
    val walletAddress: ZcashAddress
)

// Use List, not MutableList
data class ChatState(
    val messages: List<Message>,  // Immutable
    val participants: Set<ZcashAddress>  // Immutable
)

// Copy for updates
fun ChatState.addMessage(message: Message): ChatState =
    copy(messages = messages + message)

// Use sealed classes for configuration
data class NetworkConfig(
    val host: String,
    val port: Int,
    val timeout: Duration
) {
    companion object {
        val DEFAULT = NetworkConfig(
            host = "zec.rocks",
            port = 443,
            timeout = 30.seconds
        )
    }
}
```

---

## 7. Explicit Return Types

### The Principle
All functions must declare their return type explicitly. Never rely on type inference for public APIs.

### TypeScript

```typescript
// BAD - Implicit return type
function getMessages() {
  return db.query('SELECT * FROM messages');
}

// GOOD - Explicit return type
function getMessages(): Promise<Message[]> {
  return db.query('SELECT * FROM messages');
}

// BAD - Implicit in arrow functions
const processMessage = (msg: Message) => {
  return { ...msg, processed: true };
};

// GOOD - Explicit in arrow functions
const processMessage = (msg: Message): ProcessedMessage => {
  return { ...msg, processed: true };
};

// Complex return types should be explicit
async function sendTransaction(
  params: SendParams
): Promise<Result<TransactionId, TransactionError>> {
  // Implementation
}
```

### Kotlin

```kotlin
// BAD - Inferred return type
fun parseMessage(memo: String) = when {
    memo.startsWith("DM|") -> parseDM(memo)
    memo.startsWith("GM|") -> parseGM(memo)
    else -> null
}

// GOOD - Explicit return type
fun parseMessage(memo: String): ParsedMessage? = when {
    memo.startsWith("DM|") -> parseDM(memo)
    memo.startsWith("GM|") -> parseGM(memo)
    else -> null
}

// GOOD - Complex return types always explicit
suspend fun sendMessage(
    content: String,
    recipient: ZcashAddress
): ZchatResult<TransactionId, SendError> {
    // Implementation
}
```

### tsconfig.json Enforcement

```json
{
  "compilerOptions": {
    "noImplicitReturns": true  // Enforce return on all paths
  }
}
```

---

## 8. Functional Programming Patterns

### The Principle
Prefer pure functions and functional transformations over imperative loops and mutable state.

### TypeScript

```typescript
// BAD - Imperative with mutation
function getUnreadMessages(messages: Message[]): Message[] {
  const result: Message[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (!messages[i].read) {
      result.push(messages[i]);
    }
  }
  return result;
}

// GOOD - Functional transformation
function getUnreadMessages(messages: readonly Message[]): readonly Message[] {
  return messages.filter(msg => !msg.read);
}

// GOOD - Chained transformations
function processMessages(messages: readonly Message[]): ProcessedResult {
  return messages
    .filter(msg => msg.type === 'DM')
    .map(msg => decryptMessage(msg))
    .reduce((acc, msg) => ({
      ...acc,
      [msg.conversationId]: [...(acc[msg.conversationId] ?? []), msg]
    }), {} as Record<ConversationId, Message[]>);
}

// GOOD - Pure functions (no side effects)
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();  // Always same output for same input
}
```

### Kotlin

```kotlin
// BAD - Imperative
fun countUnread(messages: List<Message>): Int {
    var count = 0
    for (message in messages) {
        if (!message.read) {
            count++
        }
    }
    return count
}

// GOOD - Functional
fun countUnread(messages: List<Message>): Int =
    messages.count { !it.read }

// GOOD - Chained transformations
fun processMessages(messages: List<Message>): Map<ConversationId, List<Message>> =
    messages
        .filter { it.type == MessageType.DM }
        .map { decryptMessage(it) }
        .groupBy { it.conversationId }

// GOOD - fold for complex accumulation
fun calculateTotalAmount(transactions: List<Transaction>): Zatoshi =
    transactions.fold(Zatoshi(0)) { acc, tx ->
        Zatoshi(acc.value + tx.amount.value)
    }

// GOOD - Sequence for lazy evaluation (large datasets)
fun findFirstMatch(messages: Sequence<Message>, predicate: (Message) -> Boolean): Message? =
    messages.firstOrNull(predicate)
```

### When to Use Functional vs Imperative

| Use Functional | Use Imperative |
|----------------|----------------|
| Data transformations | Complex algorithms with early exit |
| Collection operations | Performance-critical tight loops |
| Pure computations | I/O operations with cleanup |
| Pipeline processing | Stateful protocols |

---

## 9. Dependency Injection

### The Principle
Pass dependencies explicitly through constructors. Use interfaces for dependencies to enable testing and flexibility.

### TypeScript

```typescript
// BAD - Hard-coded dependencies
class ChatService {
  async sendMessage(content: string): Promise<void> {
    const wallet = new WalletCore();  // Hard-coded
    const api = new ApiClient();      // Hard-coded
    await wallet.send(content);
    await api.notify();
  }
}

// GOOD - Injected dependencies
interface WalletService {
  send(content: string): Promise<TransactionId>;
}

interface NotificationService {
  notify(event: Event): Promise<void>;
}

class ChatService {
  constructor(
    private readonly wallet: WalletService,
    private readonly notifications: NotificationService
  ) {}

  async sendMessage(content: string): Promise<Result<TransactionId, Error>> {
    const result = await this.wallet.send(content);
    if (result.success) {
      await this.notifications.notify({ type: 'sent', txid: result.data });
    }
    return result;
  }
}

// Usage - production
const chatService = new ChatService(
  new WalletCoreAdapter(),
  new PushNotificationService()
);

// Usage - testing
const mockWallet: WalletService = {
  send: jest.fn().mockResolvedValue({ success: true, data: 'txid123' })
};
const testService = new ChatService(mockWallet, mockNotifications);
```

### Kotlin

```kotlin
// BAD - Hard-coded dependencies
class ChatViewModel : ViewModel() {
    private val synchronizer = Synchronizer.getInstance()  // Singleton
    private val preferences = ZchatPreferences(context)    // Created internally

    fun sendMessage(content: String) { /* ... */ }
}

// GOOD - Injected dependencies with interfaces
interface MessageRepository {
    suspend fun getMessages(conversationId: ConversationId): List<Message>
    suspend fun saveMessage(message: Message)
}

interface TransactionSender {
    suspend fun send(to: ZcashAddress, memo: String): ZchatResult<TransactionId, SendError>
}

class ChatViewModel(
    private val repository: MessageRepository,
    private val sender: TransactionSender,
    private val crypto: E2EEncryption
) : ViewModel() {

    suspend fun sendMessage(
        content: String,
        recipient: ZcashAddress
    ): ZchatResult<TransactionId, SendError> {
        val encrypted = crypto.encrypt(content, recipient)
        return sender.send(recipient, encrypted)
    }
}

// Factory for production
object ChatViewModelFactory {
    fun create(
        synchronizer: Synchronizer,
        preferences: ZchatPreferences
    ): ChatViewModel = ChatViewModel(
        repository = RoomMessageRepository(database),
        sender = ZcashTransactionSender(synchronizer),
        crypto = E2EEncryption(preferences)
    )
}

// Factory for testing
fun createTestViewModel(
    repository: MessageRepository = FakeMessageRepository(),
    sender: TransactionSender = FakeTransactionSender()
): ChatViewModel = ChatViewModel(repository, sender, FakeE2EEncryption())
```

### Dependency Injection with Hilt (Android)

```kotlin
@Module
@InstallIn(ViewModelComponent::class)
object ChatModule {

    @Provides
    fun provideMessageRepository(
        database: ZchatDatabase
    ): MessageRepository = RoomMessageRepository(database)

    @Provides
    fun provideTransactionSender(
        synchronizer: Synchronizer
    ): TransactionSender = ZcashTransactionSender(synchronizer)
}

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val repository: MessageRepository,
    private val sender: TransactionSender,
    private val crypto: E2EEncryption
) : ViewModel()
```

---

## 10. Runtime Validation with Zod (TypeScript)

### The Principle
External data (API responses, user input, config files) must be **validated at runtime**. Use Zod to define schemas that serve as both validators and type generators.

```typescript
import { z } from 'zod';

// Define schemas for API data
const MessageSchema = z.object({
  txid: z.string().length(64),
  fromAddress: z.string().nullable(),
  toAddress: z.string(),
  content: z.string(),
  timestamp: z.number().int().positive(),
  incoming: z.boolean(),
  type: z.enum(['DM', 'KEX', 'RXN', 'RCV', 'RPL', 'REQ', 'CHK', 'STT']),
});

// Infer TypeScript type from schema
type Message = z.infer<typeof MessageSchema>;

// Define API response schemas
const GetMessagesResponseSchema = z.object({
  messages: z.array(MessageSchema),
  lastSyncedBlock: z.number().int(),
  hasMore: z.boolean(),
});

type GetMessagesResponse = z.infer<typeof GetMessagesResponseSchema>;

// Validate API responses
async function fetchMessages(): Promise<GetMessagesResponse> {
  const response = await fetch('/api/messages');
  const data = await response.json();

  // Runtime validation - throws ZodError if invalid
  return GetMessagesResponseSchema.parse(data);
}

// Safe parse (doesn't throw)
async function fetchMessagesSafe(): Promise<Result<GetMessagesResponse, z.ZodError>> {
  const response = await fetch('/api/messages');
  const data = await response.json();

  const result = GetMessagesResponseSchema.safeParse(data);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data };
}

// Request validation
const SendMessageRequestSchema = z.object({
  to: z.string().refine(
    (val) => val.startsWith('u1') || val.startsWith('zs'),
    { message: 'Invalid Zcash address' }
  ),
  content: z.string().min(1).max(500),
  amount: z.number().int().min(0).optional(),
  convId: z.string().regex(/^[A-Z0-9]{8}$/),  // 8 uppercase alphanumeric
});
```

---

## 11. Code Organization

### Directory Structure (TypeScript)

```
apps/web/src/
├── types/
│   ├── index.ts          # Re-exports
│   ├── api.types.ts      # API request/response
│   ├── wallet.types.ts   # Wallet domain
│   ├── message.types.ts  # Message domain
│   ├── result.ts         # Result<T, E>
│   └── branded.ts        # ZcashAddress, Zatoshi, etc.
├── schemas/
│   ├── index.ts          # Re-exports
│   ├── api.schemas.ts    # Zod schemas
│   └── message.schemas.ts
├── hooks/
│   ├── useWallet.ts
│   └── useChat.ts
├── components/
│   ├── Chat/
│   └── Wallet/
└── lib/
    ├── api.ts            # API client
    └── zmsg-protocol.ts  # Protocol parsing
```

### Directory Structure (Kotlin)

```
ui-lib/src/main/java/co/electriccoin/zcash/ui/
├── screen/
│   └── chat/
│       ├── model/            # Domain types
│       │   ├── Message.kt
│       │   ├── ChatState.kt
│       │   └── ParsedMessage.kt
│       ├── viewmodel/        # ViewModels
│       │   ├── ChatViewModel.kt
│       │   └── GroupViewModel.kt
│       ├── protocol/         # Protocol parsing
│       │   ├── ZMSGProtocol.kt
│       │   ├── ZMSGGroupProtocol.kt
│       │   └── ZTLProtocol.kt
│       ├── crypto/           # Encryption
│       │   ├── E2EEncryption.kt
│       │   └── HKDF.kt
│       ├── util/             # Utilities
│       │   ├── AddressCache.kt
│       │   └── DestroyManager.kt
│       └── view/             # Compose UI
│           ├── ChatScreen.kt
│           └── MessageItem.kt
└── common/
    ├── result/               # Result types
    │   └── ZchatResult.kt
    └── types/                # Domain types
        ├── ZcashAddress.kt
        ├── Zatoshi.kt
        └── ConversationId.kt
```

---

## 12. Testing Standards

### Unit Tests

```kotlin
// Test sealed class exhaustiveness
@Test
fun `all message types are handled`() {
    val allTypes = listOf(
        ParsedMessage.DirectMessage("test", false),
        ParsedMessage.Reaction("txid", "emoji"),
        ParsedMessage.ReadReceipt("txid"),
        ParsedMessage.TimeLocked(TimeLockType.Scheduled(Instant.now()), byteArrayOf()),
        ParsedMessage.GroupMessage("groupId", "content"),
        ParsedMessage.Invalid
    )

    allTypes.forEach { message ->
        // This will fail to compile if we add a new type and forget to handle it
        val result = processMessage(message)
        assertNotNull(result)
    }
}

// Test Result type handling
@Test
fun `sendTransaction returns Success on valid params`() = runTest {
    val result = sendTransaction(validParams)
    assertTrue(result is ZchatResult.Success)
}

@Test
fun `sendTransaction returns Failure on insufficient funds`() = runTest {
    val result = sendTransaction(paramsExceedingBalance)
    assertTrue(result is ZchatResult.Failure)
    assertTrue((result as ZchatResult.Failure).error is ZchatError.Wallet.InsufficientFunds)
}
```

### Integration Tests

```typescript
// Test Zod schema validation
describe('MessageSchema', () => {
  it('validates correct message', () => {
    const validMessage = {
      txid: 'a'.repeat(64),
      fromAddress: 'u1test...',
      toAddress: 'u1dest...',
      content: 'Hello',
      timestamp: Date.now(),
      incoming: true,
      type: 'DM',
    };

    expect(() => MessageSchema.parse(validMessage)).not.toThrow();
  });

  it('rejects invalid txid length', () => {
    const invalidMessage = {
      ...validMessage,
      txid: 'short',
    };

    expect(() => MessageSchema.parse(invalidMessage)).toThrow();
  });
});
```

---

## 13. Security Practices

### Sensitive Data Handling

```kotlin
// Redact addresses in logs
fun String.redactAddress(): String =
    if (length > 20) "${take(6)}...${takeLast(4)}" else "***"

// Clear sensitive data
fun ByteArray.secureWipe() {
    java.util.Arrays.fill(this, 0.toByte())
}

// Use try-finally for sensitive operations
fun useSensitiveKey(key: ByteArray, operation: (ByteArray) -> Unit) {
    try {
        operation(key)
    } finally {
        key.secureWipe()
    }
}
```

### Input Validation

```kotlin
// Validate at system boundaries
class ZMSGProtocol {
    fun parse(memo: String): ParsedMessage {
        // Validate length
        if (memo.length > 512) return ParsedMessage.Invalid

        // Validate format
        val parts = memo.split("|")
        if (parts.isEmpty() || parts[0] != "ZMSG") return ParsedMessage.Invalid

        // Validate version
        val version = parts.getOrNull(1)?.toIntOrNull() ?: return ParsedMessage.Invalid
        if (version !in 1..4) return ParsedMessage.Invalid

        // Continue parsing...
    }
}
```

---

## 14. Anti-Patterns to Avoid

### Current Codebase Issues

| File | Issue | Fix |
|------|-------|-----|
| `page.tsx:14,20,21,132,210,328,521` | `any` types | Replace with proper interfaces |
| `page.tsx` (19 locations) | `catch (error: any)` | Use `catch (error: unknown)` + type guards |
| `server.ts` (30+ handlers) | Missing return types | Add explicit return types |
| `api.ts` | Type assertions without validation | Use Zod schemas |
| `page.tsx:96` | `@ts-ignore` | Create proper `.d.ts` declarations |

### Bad Patterns

```typescript
// BAD: any everywhere
function processData(data: any): any { ... }

// BAD: Implicit returns
function getUser(id: string) {
  return db.query(...)  // Return type unknown
}

// BAD: Throwing for control flow
function validateAddress(addr: string): string {
  if (!addr.startsWith('u1')) throw new Error('Invalid');
  return addr;
}

// BAD: Mutable state
let messages: Message[] = [];
function addMessage(m: Message) { messages.push(m); }
```

### Good Patterns

```typescript
// GOOD: Explicit types
function processData(data: unknown): ProcessedData { ... }

// GOOD: Explicit returns
function getUser(id: string): Promise<User | null> {
  return db.query(...)
}

// GOOD: Result types
function validateAddress(addr: string): Result<ZcashAddress, ValidationError> {
  if (!addr.startsWith('u1')) {
    return { success: false, error: new ValidationError('Invalid') };
  }
  return { success: true, data: addr as ZcashAddress };
}

// GOOD: Immutable updates
function addMessage(messages: readonly Message[], m: Message): readonly Message[] {
  return [...messages, m];
}
```

---

## 15. Quick Reference

### TypeScript Checklist

**Boris Cherny Principles:**
- [ ] `strict: true` in tsconfig.json
- [ ] No `any` types (use `unknown` + type guards)
- [ ] No `as` assertions (use validation)
- [ ] Discriminated unions for state
- [ ] `never` for exhaustiveness
- [ ] Explicit return types on all functions
- [ ] Branded types for domain primitives
- [ ] `readonly` by default

**Modern Practices:**
- [ ] Zod for external data validation
- [ ] Functional transformations (map/filter/reduce)
- [ ] Dependency injection via constructor
- [ ] Pure functions where possible
- [ ] Clear separation of concerns

### Kotlin Checklist

**Boris Cherny Principles:**
- [ ] Sealed classes for state machines
- [ ] `when` without `else` for exhaustiveness
- [ ] `ZchatResult<T, E>` instead of exceptions
- [ ] Value classes for domain primitives
- [ ] Explicit return types on public functions
- [ ] `val` over `var`
- [ ] `List` over `MutableList`

**Modern Practices:**
- [ ] `copy()` for immutable updates
- [ ] Functional transformations (map/filter/fold)
- [ ] Constructor injection for dependencies
- [ ] Interfaces for testability
- [ ] Validation at system boundaries

---

## References

- [Boris Cherny - Programming TypeScript (O'Reilly)](https://www.oreilly.com/library/view/programming-typescript/9781492037644/)
- [TypeScript Handbook - Discriminated Unions](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html)
- [Kotlin Sealed Classes](https://kotlinlang.org/docs/sealed-classes.html)
- [Kotlin Value Classes](https://kotlinlang.org/docs/inline-classes.html)
- [Zod Documentation](https://zod.dev/)
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/)

---

*Document Version 2.0 - Expanded from TypeScript-only to full development standards*
