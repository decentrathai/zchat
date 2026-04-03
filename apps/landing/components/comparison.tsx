import { Shield, Lock, Globe, MessageSquare } from "lucide-react"

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

type CellColor = "green" | "yellow" | "red" | "neutral"

interface Row {
  axis: string
  zchat: string
  signal: string
  session: string
  simplex: string
  /** Optional per-cell colour overrides: [zchat, signal, session, simplex] */
  colors?: [CellColor, CellColor, CellColor, CellColor]
}

const rows: Row[] = [
  {
    axis: "Identity requirement",
    zchat: "None (Zcash address from seed phrase)",
    signal: "Phone number",
    session: "None (Session ID)",
    simplex: "None",
    colors: ["green", "red", "green", "green"],
  },
  {
    axis: "Message transport",
    zchat: "Zcash blockchain (shielded transactions)",
    signal: "Signal servers (centralized)",
    session: "Lokinet (decentralized onion routing)",
    simplex: "SimpleX relays (federated)",
  },
  {
    axis: "Message storage",
    zchat: "On-chain (Zcash blockchain)",
    signal: "Device only (ephemeral on server)",
    session: "Swarm nodes (temporary)",
    simplex: "Relay queues (temporary)",
  },
  {
    axis: "On-chain metadata hidden",
    zchat: "Yes (shielded pool)",
    signal: "N/A (no blockchain)",
    session: "N/A",
    simplex: "N/A",
    colors: ["green", "neutral", "neutral", "neutral"],
  },
  {
    axis: "Server sees metadata",
    zchat: "Lightwalletd sees IP",
    signal: "Minimal (sealed sender)",
    session: "Minimal (onion routing)",
    simplex: "No user identifiers",
    colors: ["yellow", "green", "green", "green"],
  },
  {
    axis: "Forward secrecy",
    zchat: "No",
    signal: "Yes (Double Ratchet)",
    session: "No",
    simplex: "Yes (Double Ratchet)",
    colors: ["red", "green", "red", "green"],
  },
  {
    axis: "E2E encryption",
    zchat: "ECDH + AES-256-GCM",
    signal: "Signal Protocol",
    session: "Session Protocol",
    simplex: "Double Ratchet",
    colors: ["green", "green", "green", "green"],
  },
  {
    axis: "Third-party audit",
    zchat: "No (Zcash protocol audited)",
    signal: "Yes (multiple)",
    session: "Yes (Quarkslab 2024)",
    simplex: "Yes (Trail of Bits 2024)",
    colors: ["yellow", "green", "green", "green"],
  },
  {
    axis: "Open source",
    zchat: "Yes (GPLv3)",
    signal: "Yes (AGPLv3)",
    session: "Yes (GPLv3)",
    simplex: "Yes (AGPLv3)",
    colors: ["green", "green", "green", "green"],
  },
  {
    axis: "Group messaging",
    zchat: "In development",
    signal: "Yes",
    session: "Yes",
    simplex: "Yes",
    colors: ["yellow", "green", "green", "green"],
  },
  {
    axis: "File sharing",
    zchat: "Planned",
    signal: "Yes",
    session: "Yes",
    simplex: "Yes",
    colors: ["yellow", "green", "green", "green"],
  },
  {
    axis: "Voice / video calls",
    zchat: "Planned",
    signal: "Yes",
    session: "Yes (voice)",
    simplex: "Yes",
    colors: ["yellow", "green", "green", "green"],
  },
  {
    axis: "Platforms",
    zchat: "Android (beta)",
    signal: "Android, iOS, Desktop",
    session: "Android, iOS, Desktop",
    simplex: "Android, iOS, Desktop",
    colors: ["yellow", "green", "green", "green"],
  },
  {
    axis: "Payments built-in",
    zchat: "Yes (ZEC)",
    signal: "Previously (MobileCoin, removed)",
    session: "No",
    simplex: "No",
    colors: ["green", "yellow", "neutral", "neutral"],
  },
  {
    axis: "Dead Man's Switch",
    zchat: "Planned (auto-wipe after inactivity)",
    signal: "No",
    session: "No",
    simplex: "No",
    colors: ["yellow", "neutral", "neutral", "neutral"],
  },
  {
    axis: "Remote data wipe",
    zchat: "Planned (destroy app data remotely)",
    signal: "No",
    session: "No",
    simplex: "No",
    colors: ["yellow", "neutral", "neutral", "neutral"],
  },
]

/* -------------------------------------------------------------------------- */
/*  Recommendation cards                                                       */
/* -------------------------------------------------------------------------- */

interface Recommendation {
  name: string
  description: string
  icon: typeof Shield
  borderColor: string
  accentColor: string
  recommended?: boolean
}

const recommendations: Recommendation[] = [
  {
    name: "Signal",
    description:
      "Recommended for most people. Battle-tested, widely adopted, supports all platforms. If you need a secure messenger today, use Signal.",
    icon: Shield,
    borderColor: "border-[var(--accent-success)]/50",
    accentColor: "text-[var(--accent-success)]",
    recommended: true,
  },
  {
    name: "Session",
    description:
      "Best for users who want decentralized messaging without phone numbers and don\u2019t need forward secrecy. More mature than ZChat.",
    icon: Globe,
    borderColor: "border-fuchsia-500/30",
    accentColor: "text-fuchsia-400",
  },
  {
    name: "SimpleX",
    description:
      "Best for maximum server-side privacy. No user identifiers at all, even at the protocol level.",
    icon: Lock,
    borderColor: "border-[var(--accent-primary)]/30",
    accentColor: "text-[var(--accent-primary)]",
  },
  {
    name: "ZChat",
    description:
      "Best for Zcash users who want messaging integrated with ZEC payments, or users who specifically want messages stored as blockchain transactions. Currently Android-only beta without a third-party audit.",
    icon: MessageSquare,
    borderColor: "border-[var(--accent-primary)]/30",
    accentColor: "text-[var(--accent-primary)]",
  },
]

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function cellColorClass(color: CellColor): string {
  switch (color) {
    case "green":
      return "text-[var(--accent-success)]"
    case "yellow":
      return "text-[var(--color-warning)]"
    case "red":
      return "text-[var(--color-danger)]"
    case "neutral":
    default:
      return "text-[var(--text-secondary)]"
  }
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function Comparison() {
  return (
    <section className="relative px-4 py-20 sm:px-6 lg:px-8">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[var(--accent-primary)]/5 blur-[120px]" />
        <div className="absolute right-1/4 top-40 h-[400px] w-[400px] translate-x-1/2 rounded-full bg-[var(--accent-secondary)]/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* ---------------------------------------------------------------- */}
        {/*  Header                                                          */}
        {/* ---------------------------------------------------------------- */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">
            Privacy Messenger{" "}
            <span className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] bg-clip-text text-transparent">
              Comparison
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-[var(--text-secondary)]">
            An honest look at how ZChat compares with Signal, Session, and
            SimpleX across 16 axes. We believe transparency builds trust.
          </p>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/*  Table                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="-mx-4 mb-20 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            {/* Head */}
            <thead>
              <tr className="border-b border-[var(--border-default)]">
                <th className="whitespace-nowrap bg-[var(--bg-elevated)] px-4 py-4 font-semibold text-[var(--text-secondary)] rounded-tl-lg">
                  Feature
                </th>
                <th className="whitespace-nowrap bg-[var(--accent-primary)]/10 px-4 py-4 font-semibold text-[var(--accent-primary)]">
                  ZChat
                </th>
                <th className="whitespace-nowrap bg-[var(--bg-elevated)] px-4 py-4 font-semibold text-[var(--text-secondary)]">
                  Signal
                </th>
                <th className="whitespace-nowrap bg-[var(--bg-elevated)] px-4 py-4 font-semibold text-[var(--text-secondary)]">
                  Session
                </th>
                <th className="whitespace-nowrap bg-[var(--bg-elevated)] px-4 py-4 font-semibold text-[var(--text-secondary)] rounded-tr-lg">
                  SimpleX
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {rows.map((row, i) => {
                const colors = row.colors ?? [
                  "neutral",
                  "neutral",
                  "neutral",
                  "neutral",
                ]
                return (
                  <tr
                    key={row.axis}
                    className={`border-b border-[var(--border-default)] transition-colors hover:bg-white/[0.02] ${
                      i % 2 === 0 ? "bg-[var(--bg-surface)]" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-[var(--text-secondary)]">
                      {row.axis}
                    </td>
                    <td
                      className={`bg-[var(--accent-primary)]/10 px-4 py-3.5 ${cellColorClass(colors[0])}`}
                    >
                      {row.zchat}
                    </td>
                    <td className={`px-4 py-3.5 ${cellColorClass(colors[1])}`}>
                      {row.signal}
                    </td>
                    <td className={`px-4 py-3.5 ${cellColorClass(colors[2])}`}>
                      {row.session}
                    </td>
                    <td className={`px-4 py-3.5 ${cellColorClass(colors[3])}`}>
                      {row.simplex}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/*  Who should choose what?                                         */}
        {/* ---------------------------------------------------------------- */}
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Who should choose{" "}
            <span className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] bg-clip-text text-transparent">
              what?
            </span>
          </h2>
          <p className="mx-auto max-w-xl text-[var(--text-secondary)]">
            Every messenger makes trade-offs. Here is our honest take on who
            each option serves best.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {recommendations.map((rec) => {
            const Icon = rec.icon
            return (
              <div
                key={rec.name}
                className={`relative rounded-lg border bg-[var(--bg-surface)] p-6 transition-colors hover:bg-[var(--bg-elevated)] ${rec.borderColor}`}
              >
                {rec.recommended && (
                  <span className="absolute -top-3 right-4 rounded-lg border border-[var(--accent-success)]/30 bg-[var(--accent-success)]/10 px-3 py-0.5 text-xs font-medium text-[var(--accent-success)]">
                    Recommended for most users
                  </span>
                )}

                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 ${rec.accentColor}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    {rec.name}
                  </h3>
                </div>

                <p className="leading-relaxed text-[var(--text-secondary)]">
                  {rec.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/*  Closing note                                                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="mt-16 rounded-lg border border-[var(--accent-primary)]/10 bg-[var(--accent-primary)]/[0.03] p-6 text-center">
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            This comparison was last updated in February 2026. We are committed
            to keeping it accurate. If you spot an error, please{" "}
            <a
              href="https://github.com/decentrathai/zchat"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent-primary)] underline decoration-[var(--accent-primary)]/30 underline-offset-2 transition-colors hover:text-[var(--accent-primary-dim)]"
            >
              open an issue on GitHub
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  )
}
