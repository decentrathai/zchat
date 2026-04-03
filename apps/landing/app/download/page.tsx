import { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { DownloadPage } from "@/components/download-page"

export const metadata: Metadata = {
  title: "Download ZChat - Android Private Beta APK",
  description:
    "Download ZChat for Android. Private beta APK with whitelist access. Every message is a Zcash shielded transaction. iOS and desktop versions planned.",
  openGraph: {
    title: "Download ZChat - Android Private Beta APK",
    description:
      "Download ZChat for Android. Private beta APK with whitelist access.",
  },
  alternates: {
    canonical: "https://zsend.xyz/download",
  },
}

export default function DownloadPageRoute() {
  return (
    <main className="min-h-screen bg-[#050510]">
      <Navbar />
      <div className="pt-20">
        <DownloadPage />
      </div>
      <Footer />
    </main>
  )
}
