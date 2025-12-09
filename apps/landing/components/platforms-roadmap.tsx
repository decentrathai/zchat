"use client"

import { Smartphone, Calendar } from "lucide-react"
import Link from "next/link"

export function PlatformsRoadmap() {
  const roadmapItems = [
    {
      phase: "Now",
      description: "Internal testing on mainnet with full node + lightwalletd.",
    },
    {
      phase: "Q1 2026",
      description: "Public beta for web and mobile.",
    },
    {
      phase: "Next",
      description: "Encrypted images and audio attachments.",
    },
    {
      phase: "Under research",
      description: "Fully private live calls anchored to Zcash.",
    },
  ]

  return (
    <section id="roadmap" className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Platforms */}
          <div>
            <div className="mb-8 flex items-center gap-3">
              <Smartphone className="h-6 w-6 text-cyan-400" />
              <h2 className="text-2xl font-bold text-white lg:text-3xl">Platforms</h2>
            </div>

            <p className="mb-8 leading-relaxed text-gray-300">
              Launching on web first, with native mobile apps to follow.
            </p>

            <div className="space-y-4">
              {/* App Store mockup */}
              <Link href="/coming-soon" className="block">
                <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 px-6 py-3 backdrop-blur-sm transition-all hover:border-cyan-500/50 hover:bg-gray-800/70">
                  <div className="text-2xl">📱</div>
                  <div>
                    <p className="font-medium text-white">App Store</p>
                    <p className="text-sm text-gray-400">Coming soon</p>
                  </div>
                </div>
              </Link>

              {/* Google Play mockup */}
              <Link href="/coming-soon" className="block">
                <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 px-6 py-3 backdrop-blur-sm transition-all hover:border-cyan-500/50 hover:bg-gray-800/70">
                  <div className="text-2xl">🤖</div>
                  <div>
                    <p className="font-medium text-white">Google Play</p>
                    <p className="text-sm text-gray-400">Coming soon</p>
                  </div>
                </div>
              </Link>
            </div>

            <p className="mt-4 text-xs text-gray-500">Badges are mockups; final branding TBD.</p>
          </div>

          {/* Roadmap */}
          <div>
            <div className="mb-8 flex items-center gap-3">
              <Calendar className="h-6 w-6 text-magenta-400" />
              <h2 className="text-2xl font-bold text-white lg:text-3xl">Roadmap</h2>
            </div>

            <div className="space-y-6">
              {roadmapItems.map((item, index) => (
                <div key={index} className="flex gap-4">
                  <div className="relative flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-500 bg-cyan-500/10">
                      <div className="h-3 w-3 rounded-full bg-cyan-500" />
                    </div>
                    {index < roadmapItems.length - 1 && <div className="h-full w-0.5 bg-cyan-500/30" />}
                  </div>
                  <div className="flex-1 pb-8">
                    <p className="mb-1 font-bold text-cyan-400">{item.phase}</p>
                    <p className="leading-relaxed text-gray-300">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
