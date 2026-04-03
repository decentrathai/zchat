import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Rajdhani, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono",
})

// SEO-optimized metadata for ZCHAT
export const metadata: Metadata = {
  title: "ZCHAT - Private Encrypted Messenger | Zcash Shielded Messaging",
  description:
    "ZChat: encrypted messenger where every message is a Zcash shielded transaction. No phone number, no centralized message storage, no metadata. Android private beta.",
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
      "Every message is a Zcash shielded transaction. No phone number, no email, no centralized message storage.",
    images: [
      {
        url: "https://zsend.xyz/x-cover.jpg",
        width: 1365,
        height: 768,
        alt: "ZCHAT - Private Encrypted Messenger on Zcash",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@zchat_app",
    title: "ZCHAT - Private Encrypted Messenger",
    description:
      "Send private messages as shielded Zcash transactions. End-to-end encrypted, metadata hidden by Zcash shielded protocol.",
    images: ["https://zsend.xyz/x-cover.jpg"],
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
    <html lang="en" className="dark">
      <body className={`font-sans antialiased ${rajdhani.variable} ${jetbrainsMono.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `if(window.location.hostname==="zchat.sh"){window.location.replace("https://zsend.xyz"+window.location.pathname+window.location.search+window.location.hash);}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "name": "ZChat",
                  "url": "https://zsend.xyz",
                  "logo": "https://zsend.xyz/icon.svg",
                  "sameAs": [
                    "https://github.com/decentrathai/zchat",
                    "https://x.com/zchat_app"
                  ],
                  "description": "ZChat is a privacy-first encrypted messenger where every message is a Zcash shielded transaction."
                },
                {
                  "@type": "SoftwareApplication",
                  "name": "ZChat",
                  "operatingSystem": "Android",
                  "applicationCategory": "CommunicationApplication",
                  "description": "Encrypted messenger where every message is a Zcash shielded transaction. No phone number, no centralized message storage, no metadata.",
                  "url": "https://zsend.xyz",
                  "downloadUrl": "https://zsend.xyz/download",
                  "softwareVersion": "Private Beta",
                  "author": {
                    "@type": "Organization",
                    "name": "ZChat"
                  },
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "USD"
                  }
                },
                {
                  "@type": "WebSite",
                  "name": "ZChat",
                  "url": "https://zsend.xyz",
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": "https://zsend.xyz/faq?q={search_term_string}",
                    "query-input": "required name=search_term_string"
                  }
                }
              ]
            }),
          }}
        />
        {children}
      </body>
    </html>
  )
}
