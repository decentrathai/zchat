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
        "Get a Unified Address, receive ZEC and messages in one place. Your messages live on the blockchain — decentralized and censorship-resistant.",
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
          <h2 className="mb-4 text-balance text-3xl font-bold text-white lg:text-4xl">Why ZCHAT?</h2>
          <p className="mx-auto max-w-2xl text-gray-400">
            Messages encrypted with zero-knowledge proofs. Only you and your recipient can read them — not us, not anyone.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-magenta-500/5 p-8 backdrop-blur-sm transition-all hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]"
            >
              <div className="mb-4 inline-flex rounded-xl bg-cyan-500/10 p-3 text-cyan-400">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-white">{feature.title}</h3>
              <p className="leading-relaxed text-gray-300">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
