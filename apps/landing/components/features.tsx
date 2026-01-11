import { Shield, Wallet, Server } from "lucide-react"

export function Features() {
  const features = [
    {
      icon: Shield,
      title: "Shielded by design",
      description:
        "Each message is embedded in a shielded Zcash transaction memo on mainnet. Metadata is minimized; privacy is the default.",
    },
    {
      icon: Wallet,
      title: "Wallet-first chat",
      description:
        "Users get a Unified Address and QR code, can receive ZEC and messages in one place, and see balances directly in the app.",
    },
    {
      icon: Server,
      title: "Infrastructure handled for you",
      description: "The backend runs zebrad and lightwalletd; end users just use the app (web, PWA, or native mobile).",
    },
  ]

  return (
    <section id="product" className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-balance text-3xl font-bold text-white lg:text-4xl">Why ZCHAT?</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
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
