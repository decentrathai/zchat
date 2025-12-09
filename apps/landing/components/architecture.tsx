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
          <h2 className="mb-4 text-balance text-3xl font-bold text-white lg:text-4xl">How it works</h2>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-gray-300">
            A complete architecture running on Zcash mainnet
          </p>
        </div>

        {/* Flow diagram */}
        <div className="mb-12 overflow-x-auto">
          <div className="flex min-w-max items-center justify-center gap-4 px-4">
            {nodes.map((node, index) => (
              <div key={node} className="flex items-center gap-4">
                <div className="group relative">
                  <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-magenta-500/10 px-6 py-4 backdrop-blur-sm transition-all hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                    <p className="whitespace-nowrap text-sm font-medium text-white">{node}</p>
                  </div>
                </div>
                {index < nodes.length - 1 && <ArrowRight className="h-5 w-5 text-cyan-500" />}
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mx-auto max-w-3xl rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-magenta-500/5 p-8 backdrop-blur-sm">
          <p className="leading-relaxed text-gray-300">
            Messages are memos in shielded transactions, ensuring complete privacy. You don't have to run your own full
            node—we run zebrad and lightwalletd in the backend. You just use the app (web or mobile). The wallet engine
            talks to lightwalletd for blockchain interaction, while the backend manages state and synchronization. The
            frontend is a simple, intuitive messenger built on top of real ZEC transactions.
          </p>
        </div>
      </div>
    </section>
  )
}
