"use client"

import { Calendar } from "lucide-react"

export function PlatformsRoadmap() {
  const roadmapItems = [
    {
      phase: "Now",
      description: "Private beta testing on mainnet. Join the whitelist for early access.",
    },
    {
      phase: "Q1 2026",
      description: "Public release on Google Play and App Store.",
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
        <div className="mx-auto max-w-2xl">
          {/* Roadmap */}
          <div>
            <div className="mb-8 flex items-center justify-center gap-3">
              <Calendar className="h-6 w-6 text-cyan-400" />
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
