"use client"

import { useState } from "react"

interface FAQItem {
  question: string
  answer: string
}

interface FAQSection {
  title: string
  items: FAQItem[]
}

const faqSections: FAQSection[] = [
  {
    title: "Privacy & Security",
    items: [
      {
        question: "What is ZChat?",
        answer:
          "ZChat is an encrypted messenger where every message is a Zcash shielded transaction. Instead of routing messages through a centralized server, ZChat encodes them as encrypted memos inside Zcash shielded transactions. This means your messages inherit the privacy guarantees of the Zcash protocol \u2014 hidden sender, hidden receiver, hidden content.",
      },
      {
        question: "How is ZChat different from Signal or WhatsApp?",
        answer:
          "Signal and WhatsApp encrypt message content, but their servers still see who is messaging whom, when, and how often (metadata). ZChat messages are Zcash shielded transactions, so on-chain metadata is hidden by the Zcash protocol. However, ZChat is early-stage beta software without a third-party audit, while Signal is battle-tested and recommended for most users.",
      },
      {
        question: "Does ZChat have access to my messages?",
        answer:
          "No. Messages are encrypted memos inside Zcash shielded transactions. The ZChat backend infrastructure (zebrad, lightwalletd) handles blockchain synchronization only \u2014 it never sees your message content. Your messages live on the Zcash blockchain.",
      },
      {
        question: "What metadata does ZChat hide?",
        answer:
          "Zcash shielded transactions hide sender address, receiver address, and amount on-chain. The memo field (which contains your message) is also encrypted. However, network-level metadata (IP address when broadcasting transactions) is NOT hidden by ZChat \u2014 you would need to use Tor or a VPN for that. See our Security page for the full threat model.",
      },
      {
        question: "Is ZChat open source?",
        answer:
          "Yes. The source code is available on GitHub at github.com/decentrathai/zchat (backend + landing) and github.com/decentrathai/zchat-android (Android app, forked from the official Zcash wallet Zashi). The license is GPLv3.",
      },
      {
        question: "Has ZChat been audited?",
        answer:
          "No. ZChat has not received a third-party security audit. It is experimental software in private beta. We strongly recommend not using it for high-stakes communications until an audit has been completed. The Zcash protocol itself has been audited, but ZChat\u2019s application layer has not.",
      },
    ],
  },
  {
    title: "Getting Started",
    items: [
      {
        question: "How do I get ZChat?",
        answer:
          "ZChat is currently in Android private beta. You can request early access on our download page. Once approved, you\u2019ll receive a download code via email to download the APK directly.",
      },
      {
        question: "Do I need a phone number or email to use ZChat?",
        answer:
          "No. ZChat does not require a phone number, email, or any personal information to create an account. Your identity is a Zcash shielded address derived from a BIP39 seed phrase.",
      },
      {
        question: "Does ZChat cost money?",
        answer:
          "The app is free. However, each message is a Zcash shielded transaction, which costs a small network fee (typically less than $0.01 USD). You need a small amount of ZEC to send messages.",
      },
      {
        question: "Is there an iOS or desktop version?",
        answer:
          "Not yet. Android is the only platform currently supported. iOS and desktop versions are planned but have no release date.",
      },
    ],
  },
  {
    title: "Technical",
    items: [
      {
        question: "What is the ZMSG protocol?",
        answer:
          "ZMSG is ZChat\u2019s message format protocol (currently v4). Each message is encoded as a pipe-delimited string inside a Zcash memo field: ZMSG|4|type|conv_id|sender_hash|payload. It supports message types including text, key exchange (KEX), reactions, receipts, replies, payment requests, status updates, and check-ins. See our Protocol page for the full specification.",
      },
      {
        question: "What encryption does ZChat use?",
        answer:
          "ZChat uses two layers of encryption: (1) Zcash protocol encryption \u2014 shielded transactions encrypt the memo field containing your message, and (2) Application-layer E2E encryption using secp256r1 ECDH key exchange with AES-256-GCM, with keys derived via HKDF (RFC 5869). Group messages use ECIES for per-recipient key encryption.",
      },
      {
        question: "What is the 512-byte memo limit?",
        answer:
          "Zcash shielded transaction memos are limited to 512 bytes. ZChat uses the ZMSG v4c chunking protocol to split longer messages across multiple transactions, which are reassembled by the recipient.",
      },
      {
        question: "Can I send files or images?",
        answer:
          "Not yet. File and image sharing is planned via NOSTR/Blossom protocol integration, but is not currently available.",
      },
      {
        question: "What happens if I lose my seed phrase?",
        answer:
          "You lose access to your identity and message history. There is no recovery mechanism. Back up your seed phrase securely.",
      },
    ],
  },
  {
    title: "Comparisons",
    items: [
      {
        question: "Should I use ZChat instead of Signal?",
        answer:
          "For most people, Signal is the better choice \u2014 it\u2019s mature, audited, and widely used. ZChat is best for users who specifically want message transport via Zcash shielded transactions and are comfortable with beta software. See our Comparison page for a detailed breakdown.",
      },
      {
        question: "How does ZChat compare to Session?",
        answer:
          "Session routes messages through a decentralized onion network (Lokinet). ZChat stores messages as Zcash shielded transactions on the blockchain. Session has been audited and is more mature. ZChat offers tighter integration with Zcash payments. Both avoid phone number requirements.",
      },
      {
        question: "Is ZChat truly decentralized?",
        answer:
          "Partially. Messages are stored on the decentralized Zcash blockchain, but the current beta relies on ZChat\u2019s backend infrastructure for blockchain synchronization and lightwalletd access. Users cannot yet run fully independent nodes, though the architecture supports it.",
      },
    ],
  },
  {
    title: "Trust & Safety",
    items: [
      {
        question: "Who built ZChat?",
        answer:
          "ZChat was built for the Zypherpunk Hackathon 2025 and received a prize in the Zcash-related projects track. Development continues as an open-source project. The source code is on GitHub.",
      },
      {
        question: "How do I report a security issue?",
        answer:
          "Email contact@zsend.xyz or report via GitHub at github.com/decentrathai/zchat/security. See our security.txt at zsend.xyz/.well-known/security.txt.",
      },
    ],
  },
]

const schemaQuestions = [
  { q: "What is ZChat?", section: 0, index: 0 },
  { q: "How is ZChat different from Signal or WhatsApp?", section: 0, index: 1 },
  { q: "Does ZChat have access to my messages?", section: 0, index: 2 },
  { q: "What metadata does ZChat hide?", section: 0, index: 3 },
  { q: "Has ZChat been audited?", section: 0, index: 5 },
  { q: "Do I need a phone number or email to use ZChat?", section: 1, index: 1 },
  { q: "Does ZChat cost money?", section: 1, index: 2 },
  { q: "Should I use ZChat instead of Signal?", section: 3, index: 0 },
]

function buildJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: schemaQuestions.map(({ section, index }) => {
      const item = faqSections[section].items[index]
      return {
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      }
    }),
  }
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-cyan-500 transition-transform duration-300 flex-shrink-0 ${
        open ? "rotate-90" : ""
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function FAQItemCard({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border border-cyan-500/20 rounded-lg bg-gray-800/30 overflow-hidden transition-colors duration-200 hover:border-cyan-500/40">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="text-white font-medium text-sm sm:text-base leading-snug">
          {item.question}
        </span>
        <ChevronIcon open={isOpen} />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-0">
            <div className="border-t border-cyan-500/10 pt-4">
              <p className="text-gray-300 text-sm leading-relaxed">
                {item.answer}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FAQ() {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const expandAll = () => {
    const allKeys: Record<string, boolean> = {}
    faqSections.forEach((section, si) => {
      section.items.forEach((_, qi) => {
        allKeys[`${si}-${qi}`] = true
      })
    })
    setOpenItems(allKeys)
  }

  const collapseAll = () => {
    setOpenItems({})
  }

  const allExpanded =
    faqSections.every((section, si) =>
      section.items.every((_, qi) => openItems[`${si}-${qi}`])
    )

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }}
      />

      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Frequently Asked{" "}
              <span className="bg-gradient-to-r from-cyan-500 to-magenta-500 bg-clip-text text-transparent">
                Questions
              </span>
            </h1>
            <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
              Everything you need to know about ZChat, privacy messaging on
              Zcash, and how to get started.
            </p>
          </div>

          {/* Expand / Collapse controls */}
          <div className="flex justify-end mb-6">
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              className="text-xs text-cyan-500 hover:text-cyan-400 transition-colors cursor-pointer"
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </button>
          </div>

          {/* FAQ Sections */}
          <div className="space-y-10">
            {faqSections.map((section, si) => (
              <div key={si}>
                <h2 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-fuchsia-500 rounded-full" />
                  {section.title}
                </h2>
                <div className="space-y-3">
                  {section.items.map((item, qi) => {
                    const key = `${si}-${qi}`
                    return (
                      <FAQItemCard
                        key={key}
                        item={item}
                        isOpen={!!openItems[key]}
                        onToggle={() => toggleItem(key)}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 text-center border border-cyan-500/20 rounded-xl bg-gray-800/20 p-8 sm:p-10">
            <h3 className="text-xl sm:text-2xl font-semibold text-white mb-3">
              Still have questions?
            </h3>
            <p className="text-gray-400 mb-6 text-sm sm:text-base">
              Reach out to us directly or check out the source code.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:contact@zsend.xyz"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition-colors"
              >
                Contact Us
              </a>
              <a
                href="https://github.com/decentrathai/zchat"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 text-sm font-medium hover:bg-fuchsia-500/20 transition-colors"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
