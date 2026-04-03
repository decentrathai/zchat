"use client"

import { Button } from "@/components/ui/button"

export function FinalCTA() {
  const scrollToDownload = () => {
    const element = document.getElementById("download")
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  const scrollToVideo = () => {
    const element = document.getElementById("demo-video")
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <section className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="relative overflow-hidden rounded-lg border border-[var(--border-active)] bg-[var(--bg-surface)] p-12 text-center lg:p-16">
          {/* Glow effect */}
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-primary)]/20 blur-[100px]" />

          <div className="relative">
            <h2 className="mb-4 font-[family-name:var(--font-display)] text-balance text-3xl font-bold text-[var(--text-primary)] lg:text-4xl">
              Ready to make messaging actually private?
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-pretty text-lg text-[var(--text-secondary)]">
              Experience truly private communication powered by Zcash&apos;s shielded transactions. No servers. No sign-up. No compromise.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                onClick={scrollToDownload}
                size="lg"
                className="rounded-lg bg-[var(--accent-primary)] text-[var(--bg-base)] font-semibold transition-all hover:shadow-[0_0_30px_var(--accent-primary-glow)]"
              >
                Get Early Access
              </Button>
              <Button
                onClick={scrollToVideo}
                size="lg"
                variant="outline"
                className="rounded-lg border-[var(--text-secondary)]/50 bg-[var(--text-secondary)]/10 text-[var(--text-primary)] transition-all hover:border-[var(--text-primary)] hover:bg-[var(--text-secondary)]/20"
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
