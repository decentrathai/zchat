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
      <div className="absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-500/20 blur-[120px]" />
      <div className="absolute right-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-magenta-500/10 blur-[100px]" />

      <div className="container relative mx-auto px-4 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left content */}
          <div className="space-y-8">
            <div className="inline-block rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-300">
              Now in Private Beta · 2026
            </div>

            <h1 className="text-balance text-5xl font-bold leading-tight text-white lg:text-6xl xl:text-7xl">
              Private messaging, natively on Zcash.
            </h1>

            <p className="text-pretty text-lg leading-relaxed text-gray-300 lg:text-xl">
              Every message is a shielded ZEC transaction memo. No centralized chat server. No metadata leaks.
              No sign-up required. Just download the app and experience truly private communication.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Button
                onClick={scrollToDownload}
                size="lg"
                className="bg-white text-black transition-all hover:bg-gray-100 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              >
                Get Early Access
              </Button>
              <Button
                onClick={scrollToVideo}
                size="lg"
                variant="outline"
                className="border-cyan-500/50 bg-cyan-500/10 text-cyan-300 transition-all hover:border-cyan-500 hover:bg-cyan-500/20 hover:text-cyan-200"
              >
                Watch 2-minute demo
              </Button>
            </div>
          </div>

          {/* Right content - Mobile App screenshot */}
          <div className="relative flex justify-center">
            {/* Phone frame */}
            <div className="relative">
              {/* Phone outer frame */}
              <div className="relative rounded-[3rem] border-[8px] border-gray-800 bg-gray-900 p-2 shadow-[0_0_60px_rgba(34,211,238,0.4)]">
                {/* Phone notch */}
                <div className="absolute left-1/2 top-0 z-10 h-6 w-24 -translate-x-1/2 rounded-b-2xl bg-gray-800" />
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
                <div className="absolute bottom-3 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-gray-600" />
              </div>
              {/* Glow effect behind phone */}
              <div className="absolute -inset-8 -z-10 rounded-[4rem] bg-gradient-to-br from-cyan-500/30 to-magenta-500/20 blur-3xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
