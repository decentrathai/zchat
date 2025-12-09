import { Button } from "@/components/ui/button"
import { Navbar } from "@/components/navbar"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen bg-[#050510]">
      <Navbar />

      {/* Background effects */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#4f4f4f10_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f10_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_110%)]" />
      <div className="fixed left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 blur-[150px]" />

      <div className="container relative mx-auto flex min-h-[calc(100vh-80px)] items-center justify-center px-4 lg:px-8">
        <div className="w-full max-w-3xl text-center">
          <div className="mb-8 inline-block rounded-full border border-cyan-500/30 bg-cyan-500/10 px-5 py-2 text-sm text-cyan-300">
            Coming Soon
          </div>

          <h1 className="mb-6 text-balance text-4xl font-bold text-white lg:text-5xl xl:text-6xl">
            Zcash Chat is Almost Here
          </h1>

          <p className="mb-8 text-pretty text-xl leading-relaxed text-gray-300 lg:text-2xl">
            We're in the final stage of internal testing. Public launch is planned for Q1 2026 on web and mobile.
          </p>

          <div className="mx-auto mb-12 max-w-xl space-y-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-magenta-500/5 p-8 text-left backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-cyan-500" />
              <p className="leading-relaxed text-gray-300">Encrypted messaging over Zcash shielded transactions</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-cyan-500" />
              <p className="leading-relaxed text-gray-300">
                You don't need to run your own full node — we run zebrad and lightwalletd in the backend
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-cyan-500" />
              <p className="leading-relaxed text-gray-300">Web, iOS, and Android apps launching soon</p>
            </div>
          </div>

          {/* App badges - desaturated */}
          <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <div className="relative opacity-50 grayscale">
              <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 px-6 py-3 backdrop-blur-sm">
                <div className="text-2xl">📱</div>
                <div className="text-left">
                  <p className="font-medium text-white">App Store</p>
                  <p className="text-sm text-gray-400">Coming soon</p>
                </div>
              </div>
            </div>

            <div className="relative opacity-50 grayscale">
              <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 px-6 py-3 backdrop-blur-sm">
                <div className="text-2xl">🤖</div>
                <div className="text-left">
                  <p className="font-medium text-white">Google Play</p>
                  <p className="text-sm text-gray-400">Coming soon</p>
                </div>
              </div>
            </div>
          </div>

          <Button
            asChild
            size="lg"
            className="bg-white text-black transition-all hover:bg-gray-100 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
          >
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to main site
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
