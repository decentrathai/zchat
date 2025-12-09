"use client"

import { Button } from "@/components/ui/button"

export function FinalCTA() {
  const scrollToVideo = () => {
    const element = document.getElementById("demo-video")
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <section className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-magenta-500/10 to-cyan-500/10 p-12 text-center backdrop-blur-sm lg:p-16">
          {/* Glow effect */}
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/20 blur-[100px]" />

          <div className="relative">
            <h2 className="mb-4 text-balance text-3xl font-bold text-white lg:text-4xl">
              Ready to make messaging actually private?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-pretty text-lg text-gray-300">
              Experience truly private communication powered by Zcash's shielded transactions.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="bg-cyan-500 text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]"
              >
                <a href="/app">Open Web App (alpha)</a>
              </Button>
              <Button
                onClick={scrollToVideo}
                size="lg"
                variant="outline"
                className="border-white/50 bg-white/10 text-white transition-all hover:border-white hover:bg-white/20"
              >
                Watch the demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
