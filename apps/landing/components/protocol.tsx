import { Code, Layers, Hash, Lock, AlertTriangle, Github, MessageSquare, ArrowRightLeft, Shield } from "lucide-react"

const messageTypes = [
  {
    type: "INIT",
    name: "Initial Message",
    description: "First message to start a conversation. Includes sender's full address.",
    payload: "<sender_address>|<message_text>",
  },
  {
    type: "DM",
    name: "Direct Message",
    description: "Standard text message in an existing conversation.",
    payload: "<message_text>",
  },
  {
    type: "KEX",
    name: "Key Exchange",
    description: "E2E encryption key exchange with signature for MITM prevention.",
    payload: "<pubkey_b64>|<signature_b64>",
  },
  {
    type: "RXN",
    name: "Reaction",
    description: "Emoji reaction to a specific message.",
    payload: "<target_msg_id>|<emoji>",
  },
  {
    type: "RCV",
    name: "Receipt",
    description: "Read/delivery receipt.",
    payload: "<target_msg_id>|<receipt_type>",
  },
  {
    type: "RPL",
    name: "Reply",
    description: "Quote-reply to a specific message.",
    payload: "<target_msg_id>|<reply_text>",
  },
  {
    type: "REQ",
    name: "Payment Request",
    description: "Request ZEC payment from a contact.",
    payload: "<amount_zatoshi>|<memo>",
  },
  {
    type: "STT",
    name: "Status",
    description: "User availability status update.",
    payload: "<status_text>",
  },
  {
    type: "CHK",
    name: "Check-in",
    description: "Periodic check-in / heartbeat message.",
    payload: "<timestamp>",
  },
]

const formatFields = [
  {
    field: "ZMSG",
    description: "Protocol identifier (literal string)",
  },
  {
    field: "4",
    description: "Protocol version",
  },
  {
    field: "type",
    description: "Message type (see types below)",
  },
  {
    field: "conv_id",
    description: "8-character conversation identifier (A-Z, 0-9), uniquely identifies a conversation thread",
  },
  {
    field: "sender_hash",
    description: "12 hex characters, first 6 bytes of SHA-256 of sender's Zcash address",
  },
  {
    field: "payload",
    description: "Type-specific content",
  },
]

const constraints = [
  {
    label: "512-byte memo limit",
    detail: "Zcash ZIP 231",
  },
  {
    label: "Transaction fee per message",
    detail: "Each message costs a Zcash transaction fee",
  },
  {
    label: "~75 second block time",
    detail: "Message delivery latency tied to block confirmation",
  },
  {
    label: "No message deletion",
    detail: "Blockchain is immutable",
  },
  {
    label: "Chunked message cost",
    detail: "Chunked messages require multiple transaction fees",
  },
]

export function Protocol() {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-magenta-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl relative z-10">
        {/* ── Header ── */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Code className="w-8 h-8 text-cyan-400" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
              ZMSG Protocol{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
                v4
              </span>
            </h1>
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Message format specification for ZChat&apos;s Zcash-based messaging
          </p>
        </div>

        {/* ── Overview ── */}
        <div className="mb-14 p-6 rounded-xl bg-gray-900/40 border border-cyan-500/20">
          <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-cyan-400" />
            Overview
          </h2>
          <p className="text-gray-300 leading-relaxed">
            ZMSG (ZChat Message Protocol) is the wire format for messages sent via
            Zcash shielded transaction memos. Each message is encoded as a
            pipe-delimited string within the 512-byte memo field of a shielded
            transaction.
          </p>
        </div>

        {/* ── Message Format ── */}
        <div className="mb-14">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Code className="w-5 h-5 text-cyan-400" />
            Message Format
          </h2>

          <div className="bg-gray-900/50 border border-cyan-500/20 rounded-lg p-5 mb-6 overflow-x-auto">
            <pre className="font-mono text-sm sm:text-base text-cyan-300 whitespace-pre">
              {`ZMSG|4|<type>|<conv_id>|<sender_hash>|<payload>`}
            </pre>
          </div>

          <div className="space-y-3">
            {formatFields.map((f) => (
              <div
                key={f.field}
                className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 p-3 rounded-lg bg-gray-900/30 border border-gray-800"
              >
                <code className="font-mono text-fuchsia-400 text-sm shrink-0 min-w-[140px]">
                  {f.field}
                </code>
                <span className="text-gray-300 text-sm">{f.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Message Types ── */}
        <div className="mb-14">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
            Message Types
          </h2>

          {/* Desktop table */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-cyan-500/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900/70 border-b border-cyan-500/20">
                  <th className="text-left px-4 py-3 text-cyan-400 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 text-cyan-400 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 text-cyan-400 font-semibold">Description</th>
                  <th className="text-left px-4 py-3 text-cyan-400 font-semibold">Example Payload</th>
                </tr>
              </thead>
              <tbody>
                {messageTypes.map((m, i) => (
                  <tr
                    key={m.type}
                    className={`border-b border-gray-800/60 ${
                      i % 2 === 0 ? "bg-gray-900/30" : "bg-gray-900/10"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <code className="font-mono text-fuchsia-400 font-semibold">{m.type}</code>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-gray-300">{m.description}</td>
                    <td className="px-4 py-3">
                      <code className="font-mono text-cyan-300 text-xs">{m.payload}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {messageTypes.map((m) => (
              <div
                key={m.type}
                className="p-4 rounded-lg bg-gray-900/40 border border-cyan-500/20"
              >
                <div className="flex items-center gap-3 mb-2">
                  <code className="font-mono text-fuchsia-400 font-semibold text-sm bg-fuchsia-500/10 px-2 py-0.5 rounded">
                    {m.type}
                  </code>
                  <span className="text-white font-medium text-sm">{m.name}</span>
                </div>
                <p className="text-gray-300 text-sm mb-2">{m.description}</p>
                <div className="bg-gray-900/50 border border-gray-800 rounded px-3 py-2 overflow-x-auto">
                  <code className="font-mono text-cyan-300 text-xs">{m.payload}</code>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chunking (v4c) ── */}
        <div className="mb-14">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            Chunking (v4c)
          </h2>

          <p className="text-gray-300 mb-5 leading-relaxed">
            When a message exceeds the 512-byte memo limit, it is split across
            multiple Zcash transactions. The recipient&apos;s client reassembles chunks
            using the sequence numbers (M/N). All chunks in a message are sent as
            separate shielded transactions.
          </p>

          <div className="bg-gray-900/50 border border-cyan-500/20 rounded-lg p-5 overflow-x-auto space-y-1">
            <div className="font-mono text-sm">
              <span className="text-gray-500">{`// First chunk`}</span>
            </div>
            <pre className="font-mono text-sm text-cyan-300 whitespace-pre">
              {`ZMSG|v4c|1/N|<conv_id>|<type>|<sender_hash>|<payload_part>`}
            </pre>
            <div className="pt-2 font-mono text-sm">
              <span className="text-gray-500">{`// Middle chunks`}</span>
            </div>
            <pre className="font-mono text-sm text-cyan-300 whitespace-pre">
              {`ZMSG|v4c|M/N|CONT|<payload_part>`}
            </pre>
            <div className="pt-2 font-mono text-sm">
              <span className="text-gray-500">{`// Last chunk`}</span>
            </div>
            <pre className="font-mono text-sm text-cyan-300 whitespace-pre">
              {`ZMSG|v4c|N/N|CONT|<payload_part>`}
            </pre>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-gray-900/30 border border-gray-800">
            <p className="text-gray-400 text-sm leading-relaxed">
              The first chunk carries the full header (conversation ID, type, sender
              hash) while continuation chunks use the{" "}
              <code className="text-fuchsia-400 font-mono">CONT</code> marker to
              reduce overhead and maximize payload space.
            </p>
          </div>
        </div>

        {/* ── Encryption Layers ── */}
        <div className="mb-14">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-cyan-400" />
            Encryption Layers
          </h2>

          <div className="space-y-4">
            {/* Layer 1 */}
            <div className="p-5 rounded-xl bg-gray-900/40 border border-cyan-500/20">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 font-mono font-bold text-sm">
                  1
                </span>
                <h3 className="text-white font-semibold">
                  Zcash Protocol Encryption
                </h3>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed pl-11">
                The shielded pool encrypts the entire memo field at the protocol
                level. Sender, recipient, amount, and memo are all hidden from
                third-party observers on the blockchain.
              </p>
            </div>

            {/* Layer 2 */}
            <div className="p-5 rounded-xl bg-gray-900/40 border border-fuchsia-500/20">
              <div className="flex items-center gap-3 mb-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-fuchsia-500/20 text-fuchsia-400 font-mono font-bold text-sm">
                  2
                </span>
                <h3 className="text-white font-semibold">
                  Application E2E Encryption{" "}
                  <span className="text-gray-500 font-normal text-sm">(optional)</span>
                </h3>
              </div>
              <div className="pl-11 space-y-3">
                <p className="text-gray-300 text-sm leading-relaxed">
                  End-to-end encryption using{" "}
                  <code className="font-mono text-cyan-300 text-xs">secp256r1 ECDH</code>{" "}
                  key agreement with{" "}
                  <code className="font-mono text-cyan-300 text-xs">AES-256-GCM</code>{" "}
                  via HKDF for symmetric key derivation.
                </p>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
                    Key exchange via <code className="font-mono text-fuchsia-400">KEX</code> message type with digital signatures for MITM prevention
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
                    Group messages: <code className="font-mono text-cyan-300 text-xs">AES-256-GCM</code> with a shared group key, distributed via ECIES
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Encryption flow diagram */}
          <div className="mt-6 bg-gray-900/50 border border-cyan-500/20 rounded-lg p-5 overflow-x-auto">
            <p className="text-gray-500 font-mono text-xs mb-3">Encryption flow</p>
            <pre className="font-mono text-sm text-cyan-300 whitespace-pre leading-relaxed">{`Plaintext Message
    |
    v
[AES-256-GCM Encrypt]  <-- ECDH shared secret via HKDF
    |
    v
ZMSG Payload (encrypted)
    |
    v
[Zcash Shielded Memo]  <-- Protocol-level encryption
    |
    v
Blockchain (opaque to observers)`}</pre>
          </div>
        </div>

        {/* ── Conversation ID ── */}
        <div className="mb-14">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Hash className="w-5 h-5 text-cyan-400" />
            Conversation ID
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-gray-900/40 border border-cyan-500/20">
              <p className="text-cyan-400 font-mono text-sm font-semibold mb-1">Format</p>
              <p className="text-gray-300 text-sm">
                8 characters, uppercase alphanumeric (A-Z, 0-9)
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gray-900/40 border border-cyan-500/20">
              <p className="text-cyan-400 font-mono text-sm font-semibold mb-1">Entropy</p>
              <p className="text-gray-300 text-sm">
                36<sup>8</sup> &asymp; 2.8 trillion possible values (~41 bits)
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gray-900/40 border border-cyan-500/20">
              <p className="text-cyan-400 font-mono text-sm font-semibold mb-1">Generation</p>
              <p className="text-gray-300 text-sm">
                Randomly generated by the conversation initiator
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gray-900/40 border border-cyan-500/20">
              <p className="text-cyan-400 font-mono text-sm font-semibold mb-1">Scope</p>
              <p className="text-gray-300 text-sm">
                Shared between both participants of a conversation
              </p>
            </div>
          </div>

          <div className="mt-4 bg-gray-900/50 border border-cyan-500/20 rounded-lg p-4">
            <p className="text-gray-500 font-mono text-xs mb-2">Example</p>
            <code className="font-mono text-cyan-300 text-sm">A7K3BX9R</code>
          </div>
        </div>

        {/* ── Constraints ── */}
        <div className="mb-14">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-cyan-400" />
            Constraints
          </h2>

          <div className="space-y-3">
            {constraints.map((c) => (
              <div
                key={c.label}
                className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 p-4 rounded-lg bg-gray-900/40 border border-gray-800"
              >
                <span className="text-white font-medium text-sm shrink-0 sm:min-w-[220px]">
                  {c.label}
                </span>
                <span className="text-gray-400 text-sm">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Source Code ── */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Github className="w-5 h-5 text-cyan-400" />
            Source Code
          </h2>

          <div className="p-6 rounded-xl bg-gray-900/40 border border-cyan-500/20">
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              The canonical implementation is in the Android app:
            </p>
            <a
              href="https://github.com/decentrathai/zchat-android"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors font-mono text-sm mb-5"
            >
              <Github className="w-4 h-4" />
              github.com/decentrathai/zchat-android
            </a>

            <div className="space-y-2 mt-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-900/50 border border-gray-800">
                <Code className="w-4 h-4 text-fuchsia-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-sm font-medium">Protocol parsing</p>
                  <code className="font-mono text-cyan-300 text-xs">ZMSGProtocol.kt</code>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-900/50 border border-gray-800">
                <Lock className="w-4 h-4 text-fuchsia-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white text-sm font-medium">Encryption</p>
                  <code className="font-mono text-cyan-300 text-xs">E2EEncryption.kt</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer note ── */}
        <div className="text-center pt-8 border-t border-cyan-500/10">
          <p className="text-gray-600 text-xs font-mono">
            ZMSG Protocol v4 &mdash; ZChat Message Format Specification
          </p>
        </div>
      </div>
    </section>
  )
}
