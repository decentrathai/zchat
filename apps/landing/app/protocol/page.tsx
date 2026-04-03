import { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Protocol } from "@/components/protocol"

export const metadata: Metadata = {
  title: "ZMSG Protocol v4 Specification - ZChat Message Format",
  description:
    "Technical specification of the ZMSG Protocol v4 used by ZChat. Message format, 8 message types, chunking mechanism, encryption layers, and 512-byte memo constraint.",
  openGraph: {
    title: "ZMSG Protocol v4 Specification - ZChat Message Format",
    description:
      "Technical specification of the ZMSG Protocol v4 used by ZChat.",
  },
  alternates: {
    canonical: "https://zsend.xyz/protocol",
  },
}

export default function ProtocolPage() {
  return (
    <main className="min-h-screen bg-[#050510]">
      <Navbar />
      <div className="pt-20">
        <Protocol />
      </div>
      <Footer />
    </main>
  )
}
