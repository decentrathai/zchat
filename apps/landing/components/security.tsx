import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Key,
  Server,
  AlertTriangle,
  Mail,
  Bug,
  Eye,
  EyeOff,
} from "lucide-react"

const metadataRows = [
  {
    dataPoint: "Message content",
    hidden: "Yes",
    color: "green" as const,
    how: "Zcash encrypted memo + optional E2E (AES-256-GCM)",
  },
  {
    dataPoint: "Sender address",
    hidden: "Yes",
    color: "green" as const,
    how: "Zcash shielded pool (Orchard)",
  },
  {
    dataPoint: "Receiver address",
    hidden: "Yes",
    color: "green" as const,
    how: "Zcash shielded pool (Orchard)",
  },
  {
    dataPoint: "Transaction amount",
    hidden: "Yes",
    color: "green" as const,
    how: "Zcash shielded pool",
  },
  {
    dataPoint: "Message timestamp",
    hidden: "Partial",
    color: "yellow" as const,
    how: "Block time visible (~75s resolution), exact send time hidden",
  },
  {
    dataPoint: "IP address",
    hidden: "No",
    color: "red" as const,
    how: "Visible to network observers, lightwalletd server. Use Tor/VPN.",
  },
  {
    dataPoint: "Message frequency",
    hidden: "Partial",
    color: "yellow" as const,
    how: "Transaction count on-chain is visible, but cannot be linked to specific users",
  },
  {
    dataPoint: "Device fingerprint",
    hidden: "No",
    color: "red" as const,
    how: "Standard Android HTTP headers sent to lightwalletd",
  },
  {
    dataPoint: "Contact list",
    hidden: "Yes",
    color: "green" as const,
    how: "Stored locally only, never transmitted",
  },
  {
    dataPoint: "Backend knows your IP",
    hidden: "Yes",
    color: "red" as const,
    how: "Lightwalletd sees connecting IPs. [TBD: logging policy]",
  },
]

const colorClasses = {
  green: "bg-green-500/10 text-green-400",
  yellow: "bg-yellow-500/10 text-yellow-400",
  red: "bg-red-500/10 text-red-400",
}

export function Security() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <section className="mb-16 text-center">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Shield className="h-10 w-10 text-cyan-500" />
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Security
          </h1>
        </div>
        <p className="mx-auto max-w-2xl text-lg text-gray-300">
          Honest assessment of what ZChat protects and what it does not.
        </p>
      </section>

      {/* Threat Model */}
      <section className="mb-12 rounded-xl border border-cyan-500/20 bg-white/[0.02] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-cyan-500" />
          <h2 className="text-2xl font-semibold text-white">Threat Model</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-green-400">
              <EyeOff className="h-5 w-5" />
              ZChat protects against
            </h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400" />
                <span>
                  <strong className="text-white">Server-side message interception.</strong>{" "}
                  Messages are on-chain, not on our servers.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400" />
                <span>
                  <strong className="text-white">On-chain metadata analysis.</strong>{" "}
                  Zcash shielded transactions hide sender, receiver, and amount.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400" />
                <span>
                  <strong className="text-white">Message content exposure.</strong>{" "}
                  Encrypted memos + optional E2E layer.
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-red-400">
              <Eye className="h-5 w-5" />
              ZChat does NOT protect against
            </h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                <span>
                  <strong className="text-white">Network-level surveillance.</strong>{" "}
                  IP addresses are visible unless you use Tor or a VPN.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                <span>
                  <strong className="text-white">Compromised device.</strong>{" "}
                  If your phone is compromised, messages are readable.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                <span>
                  <strong className="text-white">Zcash protocol vulnerabilities.</strong>{" "}
                  If Zcash&apos;s cryptography were broken.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                <span>
                  <strong className="text-white">Application-layer bugs.</strong>{" "}
                  No third-party audit has been performed.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Metadata Analysis Table */}
      <section className="mb-12 rounded-xl border border-cyan-500/20 bg-white/[0.02] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Eye className="h-6 w-6 text-cyan-500" />
          <h2 className="text-2xl font-semibold text-white">
            Metadata Analysis
          </h2>
        </div>
        <p className="mb-6 text-gray-400">
          What data is visible, partially visible, or hidden when you use ZChat.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-700/50">
                <th className="whitespace-nowrap px-4 py-3 font-medium text-gray-300">
                  Data Point
                </th>
                <th className="whitespace-nowrap px-4 py-3 font-medium text-gray-300">
                  Hidden?
                </th>
                <th className="px-4 py-3 font-medium text-gray-300">How</th>
              </tr>
            </thead>
            <tbody>
              {metadataRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-800/50 last:border-b-0"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-white">
                    {row.dataPoint}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses[row.color]}`}
                    >
                      {row.hidden}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{row.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Encryption Stack */}
      <section className="mb-12 rounded-xl border border-cyan-500/20 bg-white/[0.02] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Lock className="h-6 w-6 text-cyan-500" />
          <h2 className="text-2xl font-semibold text-white">
            Encryption Stack
          </h2>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-800/50 bg-white/[0.02] p-4">
            <h3 className="mb-1 text-sm font-medium text-cyan-400">
              Transport Layer
            </h3>
            <p className="text-gray-300">
              Zcash shielded transactions (Orchard pool, Halo2 proving system)
            </p>
          </div>
          <div className="rounded-lg border border-gray-800/50 bg-white/[0.02] p-4">
            <h3 className="mb-1 text-sm font-medium text-cyan-400">
              Application E2E
            </h3>
            <p className="text-gray-300">
              secp256r1 ECDH key agreement + AES-256-GCM
            </p>
          </div>
          <div className="rounded-lg border border-gray-800/50 bg-white/[0.02] p-4">
            <h3 className="mb-1 text-sm font-medium text-cyan-400">
              Key Derivation
            </h3>
            <p className="text-gray-300">
              HKDF (RFC 5869) with V1/V2 versioning
            </p>
          </div>
          <div className="rounded-lg border border-gray-800/50 bg-white/[0.02] p-4">
            <h3 className="mb-1 text-sm font-medium text-cyan-400">
              Group Encryption
            </h3>
            <p className="text-gray-300">
              ECIES (per-recipient key wrapping)
            </p>
          </div>
          <div className="rounded-lg border border-gray-800/50 bg-white/[0.02] p-4">
            <h3 className="mb-1 text-sm font-medium text-cyan-400">
              Key Exchange
            </h3>
            <p className="text-gray-300">
              KEX protocol with digital signatures (MITM prevention)
            </p>
          </div>
          <div className="rounded-lg border border-gray-800/50 bg-white/[0.02] p-4">
            <h3 className="mb-1 text-sm font-medium text-cyan-400">
              Memo Limit
            </h3>
            <p className="text-gray-300">
              512 bytes (ZIP 231), chunking via ZMSG v4c for larger messages
            </p>
          </div>
        </div>
      </section>

      {/* Key Management */}
      <section className="mb-12 rounded-xl border border-cyan-500/20 bg-white/[0.02] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Key className="h-6 w-6 text-cyan-500" />
          <h2 className="text-2xl font-semibold text-white">Key Management</h2>
        </div>

        <ul className="space-y-3 text-gray-300">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400" />
            <span>
              BIP39 seed phrase generates Zcash keys.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400" />
            <span>
              <strong className="text-white">Android:</strong>{" "}
              EncryptedSharedPreferences (AES-256-GCM, hardware-backed keystore
              where available).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400" />
            <span>
              E2E keys derived from seed via HKDF.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
            <span>
              <strong className="text-white">
                No key escrow, no recovery mechanism.
              </strong>{" "}
              Lose your seed, lose your identity.
            </span>
          </li>
        </ul>
      </section>

      {/* Backend Transparency */}
      <section className="mb-12 rounded-xl border border-cyan-500/20 bg-white/[0.02] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Server className="h-6 w-6 text-cyan-500" />
          <h2 className="text-2xl font-semibold text-white">
            Backend Transparency
          </h2>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
              Backend runs
            </h3>
            <p className="text-gray-300">
              zebrad (full node), lightwalletd (gRPC interface).
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-gray-400">
              Backend stores
            </h3>
            <p className="text-gray-300">
              Whitelist entries and download codes (landing page admin only).
              Nothing is stored for Android users — the app talks directly to
              lightwalletd for blockchain data.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-green-400">
              Backend does NOT store
            </h3>
            <p className="text-gray-300">
              Messages, keys, seed phrases, contact lists.
            </p>
          </div>

          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
            <p className="text-sm text-yellow-400">
              [TBD: detailed logging policy -- what IPs/metadata are logged and
              for how long]
            </p>
          </div>
        </div>
      </section>

      {/* Audit Status */}
      <section className="mb-12 rounded-xl border border-red-500/30 bg-red-500/5 p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-red-400" />
          <h2 className="text-2xl font-semibold text-red-400">Audit Status</h2>
        </div>

        <ul className="space-y-3 text-gray-300">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
            <span>
              <strong className="text-white">
                ZChat has NOT received a third-party security audit.
              </strong>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green-400" />
            <span>
              The Zcash protocol (Orchard, Halo2) has been audited by multiple
              firms.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
            <span>
              ZChat&apos;s application layer (ZMSG protocol, E2E implementation,
              Android app) is unaudited.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
            <span>
              We plan to seek an audit when the product reaches maturity.{" "}
              <strong className="text-red-400">
                Until then, do not use ZChat for high-stakes communications.
              </strong>
            </span>
          </li>
        </ul>
      </section>

      {/* Responsible Disclosure */}
      <section className="mb-12 rounded-xl border border-cyan-500/20 bg-white/[0.02] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <Bug className="h-6 w-6 text-cyan-500" />
          <h2 className="text-2xl font-semibold text-white">
            Responsible Disclosure
          </h2>
        </div>
        <p className="mb-6 text-gray-400">
          Found a vulnerability? Please report it responsibly.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-gray-300">
            <Mail className="h-4 w-4 flex-shrink-0 text-cyan-400" />
            <span>
              <strong className="text-white">Email:</strong>{" "}
              <a
                href="mailto:contact@zsend.xyz"
                className="text-cyan-400 underline underline-offset-4 hover:text-cyan-300"
              >
                contact@zsend.xyz
              </a>
            </span>
          </div>
          <div className="flex items-center gap-3 text-gray-300">
            <Bug className="h-4 w-4 flex-shrink-0 text-cyan-400" />
            <span>
              <strong className="text-white">GitHub:</strong>{" "}
              <a
                href="https://github.com/decentrathai/zchat/security"
                className="text-cyan-400 underline underline-offset-4 hover:text-cyan-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/decentrathai/zchat/security
              </a>
            </span>
          </div>
          <div className="flex items-center gap-3 text-gray-300">
            <Shield className="h-4 w-4 flex-shrink-0 text-cyan-400" />
            <span>
              <strong className="text-white">security.txt:</strong>{" "}
              <a
                href="https://zsend.xyz/.well-known/security.txt"
                className="text-cyan-400 underline underline-offset-4 hover:text-cyan-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                zsend.xyz/.well-known/security.txt
              </a>
            </span>
          </div>
        </div>
      </section>

      {/* Known Limitations */}
      <section className="mb-12 rounded-xl border border-cyan-500/20 bg-white/[0.02] p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-yellow-400" />
          <h2 className="text-2xl font-semibold text-white">
            Known Limitations
          </h2>
        </div>

        <ul className="space-y-3 text-gray-300">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
            <span>No third-party audit</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
            <span>
              No forward secrecy (key compromise exposes past messages)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
            <span>No Tor integration (IP visible to lightwalletd)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
            <span>
              Message frequency patterns potentially observable on-chain
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
            <span>
              512-byte memo limit requires chunking for longer messages
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
            <span>Single developer team</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-yellow-400" />
            <span>
              Beta software -- expect bugs
            </span>
          </li>
        </ul>
      </section>
    </div>
  )
}
