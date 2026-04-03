"use client"

import { Button } from "@/components/ui/button"
import Image from "next/image"

export function Hero() {
  const scrollToVideo = () => {
    const element = document.getElementById("demo-video")
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  const scrollToDownload = () => {
    const element = document.getElementById("download")
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
      {/* Background grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f10_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f10_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      {/* Neon gradient effect */}
      <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[var(--accent-primary)]/20 blur-[120px]" />
      <div className="absolute right-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-[var(--accent-secondary)]/10 blur-[100px]" />

      <div className="container relative mx-auto px-4 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left content */}
          <div className="space-y-8">
            <div className="animate-fade-in-up animate-fade-in-up-1 inline-block rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-4 py-1.5 text-sm text-[var(--accent-primary)]">
              NEW: In-App Swap — deposit BTC, ETH, SOL → ZEC
            </div>

            <h1 className="animate-fade-in-up animate-fade-in-up-2 font-[family-name:var(--font-display)] text-balance text-5xl font-bold leading-tight text-[var(--text-primary)] lg:text-6xl xl:text-7xl">
              Private messaging, natively on{" "}
              <span className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] bg-clip-text text-transparent">
                Zcash
              </span>
              .
            </h1>

            <p className="animate-fade-in-up animate-fade-in-up-3 text-pretty text-lg leading-relaxed text-[var(--text-secondary)] lg:text-xl">
              Every message is a shielded ZEC transaction memo. No centralized message storage. On-chain metadata hidden by Zcash shielded transactions.
              No sign-up required. Just download the app and experience truly private communication.
            </p>

            <div className="animate-fade-in-up animate-fade-in-up-4 flex flex-col gap-4 sm:flex-row">
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
                className="rounded-lg border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] transition-all hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20"
              >
                Watch 2-minute demo
              </Button>
            </div>
          </div>

          {/* Right content - Mobile App screenshot */}
          <div className="animate-fade-in-up animate-fade-in-up-5 relative flex justify-center">
            {/* Phone frame */}
            <div className="relative">
              {/* Phone outer frame */}
              <div className="relative rounded-[3rem] border-[8px] border-[var(--bg-elevated)] bg-[var(--bg-surface)] p-2 shadow-[0_0_60px_var(--accent-primary-glow)]">
                {/* Phone notch */}
                <div className="absolute left-1/2 top-0 z-10 h-6 w-24 -translate-x-1/2 rounded-b-2xl bg-[var(--bg-elevated)]" />
                {/* Screen */}
                <div className="relative overflow-hidden rounded-[2.2rem] bg-white">
                  <Image
                    src="/images/mobile-screenshot.png"
                    alt="ZCHAT mobile app interface"
                    width={360}
                    height={800}
                    className="w-[280px] lg:w-[320px]"
                    priority
                  />
                </div>
                {/* Home indicator */}
                <div className="absolute bottom-3 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-[var(--text-tertiary)]" />
              </div>
              {/* Glow effect behind phone */}
              <div className="absolute -inset-8 -z-10 rounded-[4rem] bg-gradient-to-br from-[var(--accent-primary)]/30 to-[var(--accent-secondary)]/20 blur-3xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
