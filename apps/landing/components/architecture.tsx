import { ArrowRight } from "lucide-react"

export function Architecture() {
  const nodes = [
    "Zebrad full node (mainnet)",
    "lightwalletd (gRPC)",
    "Rust wallet-core",
    "Node.js backend + PostgreSQL",
    "Next.js / React frontend",
  ]

  return (
    <section id="how-it-works" className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-balance text-3xl font-bold text-[var(--text-primary)] lg:text-4xl">How it works</h2>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-[var(--text-secondary)]">
            A complete architecture running on Zcash mainnet
          </p>
        </div>

        {/* Flow diagram */}
        <div className="mb-12 overflow-x-auto">
          <div className="flex min-w-max items-center justify-center gap-4 px-4">
            {nodes.map((node, index) => (
              <div key={node} className="flex items-center gap-4">
                <div className="group relative">
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-4 transition-all hover:border-[var(--border-active)] hover:shadow-[0_0_20px_var(--accent-primary-glow)]">
                    <p className="whitespace-nowrap text-sm font-medium text-[var(--text-primary)]">{node}</p>
                  </div>
                </div>
                {index < nodes.length - 1 && <ArrowRight className="h-5 w-5 text-[var(--accent-primary)]" />}
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mx-auto max-w-3xl rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8">
          <p className="leading-relaxed text-[var(--text-secondary)]">
            Messages are encrypted memos inside Zcash shielded transactions — no centralized server stores your message
            content. The backend infrastructure (zebrad, lightwalletd) handles blockchain synchronization only.
            The wallet engine talks to lightwalletd for blockchain interaction, while the backend manages app state and
            sync. Your messages live on the Zcash blockchain, not on our servers.
          </p>
        </div>
      </div>
    </section>
  )
}
