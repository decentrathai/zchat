import { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Security } from "@/components/security"

export const metadata: Metadata = {
  title: "ZChat Security - Threat Model & Encryption Details",
  description: "ZChat security architecture: threat model, metadata analysis, encryption stack (ECDH + AES-256-GCM + HKDF), key management, known limitations, and audit status. Honest assessment of what ZChat does and does not protect.",
  openGraph: {
    title: "ZChat Security - Threat Model & Encryption Details",
    description: "ZChat security architecture: threat model, metadata analysis, encryption stack, key management, and known limitations.",
  },
  alternates: {
    canonical: "https://zsend.xyz/security",
  },
}

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#050510]">
      <Navbar />
      <div className="pt-20">
        <Security />
      </div>
      <Footer />
    </main>
  )
}
