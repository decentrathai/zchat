import { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Comparison } from "@/components/comparison"

export const metadata: Metadata = {
  title: "ZChat vs Signal vs Session vs SimpleX - Privacy Messenger Comparison",
  description:
    "Honest comparison of ZChat with Signal, Session, and SimpleX across 16 axes: identity, transport, metadata, storage, audits, and more. Signal recommended for most users.",
  openGraph: {
    title:
      "ZChat vs Signal vs Session vs SimpleX - Privacy Messenger Comparison",
    description:
      "Honest comparison of ZChat with Signal, Session, and SimpleX across 16 axes.",
  },
  alternates: {
    canonical: "https://zsend.xyz/comparison",
  },
}

export default function ComparisonPage() {
  return (
    <main className="min-h-screen bg-[#050510]">
      <Navbar />
      <div className="pt-20">
        <Comparison />
      </div>
      <Footer />
    </main>
  )
}
