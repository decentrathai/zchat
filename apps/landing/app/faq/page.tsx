import { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { FAQ } from "@/components/faq"

export const metadata: Metadata = {
  title: "ZChat FAQ - Privacy Messenger Questions Answered",
  description: "Frequently asked questions about ZChat, the encrypted messenger built on Zcash shielded transactions. Learn about privacy, security, getting started, and how it compares to Signal and Session.",
  openGraph: {
    title: "ZChat FAQ - Privacy Messenger Questions Answered",
    description: "Frequently asked questions about ZChat, the encrypted messenger built on Zcash shielded transactions.",
  },
  alternates: {
    canonical: "https://zsend.xyz/faq",
  },
}

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-[#050510]">
      <Navbar />
      <div className="pt-20">
        <FAQ />
      </div>
      <Footer />
    </main>
  )
}
