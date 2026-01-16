import { Metadata } from "next"
import { About } from "@/components/about"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "About ZCHAT - Features & Protocol Specification",
  description:
    "Learn about ZCHAT's features, protocol specification, and development roadmap. Private encrypted messaging on Zcash blockchain.",
  openGraph: {
    title: "About ZCHAT - Features & Protocol Specification",
    description:
      "Learn about ZCHAT's features, protocol specification, and development roadmap. Private encrypted messaging on Zcash blockchain.",
  },
}

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#050510]">
      <Navbar />
      <div className="pt-20">
        <About />
      </div>
      <Footer />
    </main>
  )
}
