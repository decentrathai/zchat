import { Shield, Wallet, Server, Lock, Users, Zap } from "lucide-react"

export function Features() {
  const features = [
    {
      icon: Shield,
      title: "Zero-Knowledge Privacy",
      description:
        "Your messages join millions of shielded notes in an anonymity set so large, even unlimited resources can't distinguish your transactions.",
    },
    {
      icon: Lock,
      title: "No Sign-Up Required",
      description:
        "No phone number. No email. No account. Just pure private messaging powered by Zcash's battle-tested cryptography.",
    },
    {
      icon: Wallet,
      title: "Wallet-First Chat",
      description:
        "Built-in wallet with in-app swap. Deposit BTC, ETH, SOL or 20+ tokens, swap to ZEC, and start messaging. No external wallet needed.",
    },
    {
      icon: Users,
      title: "Perfect Anonymity Set",
      description:
        "Every shielded transaction hides among all notes ever created. Privacy strengthens over time as your messages become indistinguishable.",
    },
    {
      icon: Zap,
      title: "Orchard Protocol",
      description:
        "Built on Zcash's latest shielded pool with quantum-ready foundations. Your privacy is protected today and prepared for tomorrow.",
    },
    {
      icon: Server,
      title: "Self-Hosted Stack",
      description:
        "The infrastructure runs zebrad and lightwalletd — no third-party servers touching your messages. True end-to-end privacy.",
    },
  ]

  return (
    <section id="product" className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-balance text-3xl font-bold text-[var(--text-primary)] lg:text-4xl">Why ZCHAT?</h2>
          <p className="mx-auto max-w-2xl text-[var(--text-secondary)]">
            Messages encrypted with zero-knowledge proofs. Only you and your recipient can read them — not us, not anyone.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 transition-all hover:border-[var(--border-active)] hover:shadow-[0_0_30px_var(--accent-primary-glow)]"
            >
              <div className="mb-4 inline-flex rounded-lg bg-[var(--accent-primary)]/10 p-3 text-[var(--accent-primary)]">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[var(--text-primary)]">{feature.title}</h3>
              <p className="leading-relaxed text-[var(--text-secondary)]">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
