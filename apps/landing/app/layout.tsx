import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

// SEO-optimized metadata for ZCHAT
export const metadata: Metadata = {
  title: "ZCHAT - Private Encrypted Messenger | Zcash Shielded Messaging",
  description:
    "ZCHAT is a privacy-first encrypted messenger that sends chat messages as shielded Zcash transactions. End-to-end encrypted, no metadata, fully anonymous communication. Send private messages and ZEC payments in one app. Built for the Zypherpunk Hackathon.",
  keywords: [
    "private messenger",
    "encrypted chat",
    "Zcash messenger",
    "anonymous messaging",
    "privacy chat app",
    "end-to-end encryption",
    "shielded transactions",
    "crypto messenger",
    "secure messaging",
    "private communication",
    "ZEC wallet",
    "Zcash wallet",
    "privacy coin",
    "anonymous chat",
    "blockchain messenger",
    "decentralized chat",
    "Web3 messenger",
    "crypto payments",
    "private payments",
    "Zypherpunk",
    "ZCHAT",
    "zsend",
  ],
  authors: [{ name: "ZCHAT Team" }],
  creator: "ZCHAT",
  publisher: "ZCHAT",
  generator: "Next.js",
  applicationName: "ZCHAT",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://zsend.xyz",
    siteName: "ZCHAT",
    title: "ZCHAT - Private Encrypted Messenger on Zcash",
    description:
      "Send private messages as shielded Zcash transactions. End-to-end encrypted, zero metadata, fully anonymous. The most private messenger ever built.",
    images: [
      {
        url: "/images/mobile-screenshot.png",
        width: 577,
        height: 1280,
        alt: "ZCHAT Private Messenger App",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZCHAT - Private Encrypted Messenger",
    description:
      "Send private messages as shielded Zcash transactions. End-to-end encrypted, zero metadata, fully anonymous.",
    images: ["/images/mobile-screenshot.png"],
  },
  alternates: {
    canonical: "https://zsend.xyz",
  },
  category: "technology",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
