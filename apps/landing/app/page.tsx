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

export default function Page() {
  return (
    <main className="min-h-screen bg-[#050510]">
      <Navbar />
      <Hero />
      <Features />
      <Architecture />
      <DemoVideo />
      <DownloadSection />
      <PlatformsRoadmap />
      <Hackathon />
      <FinalCTA />
      <CypherpunkManifesto />
      <Contact />
      <Footer />
    </main>
  )
}
