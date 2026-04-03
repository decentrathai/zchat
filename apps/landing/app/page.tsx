import { Hero } from "@/components/hero"
import { Features } from "@/components/features"
import { Architecture } from "@/components/architecture"
import { DemoVideo } from "@/components/demo-video"
import { DownloadSection } from "@/components/download-section"
import { PlatformsRoadmap } from "@/components/platforms-roadmap"
import { Hackathon } from "@/components/hackathon"
import { FinalCTA } from "@/components/final-cta"
import { CypherpunkManifesto } from "@/components/cypherpunk-manifesto"
import { Contact } from "@/components/contact"
import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { ScrollReveal } from "@/components/scroll-reveal"

export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <Hero />
      <div className="reveal"><Features /></div>
      <div className="reveal"><Architecture /></div>
      <div className="reveal"><DemoVideo /></div>
      <div className="reveal"><DownloadSection /></div>
      <div className="reveal"><PlatformsRoadmap /></div>
      <div className="reveal"><Hackathon /></div>
      <div className="reveal"><FinalCTA /></div>
      <div className="reveal"><CypherpunkManifesto /></div>
      <div className="reveal"><Contact /></div>
      <Footer />
      <ScrollReveal />
    </main>
  )
}
