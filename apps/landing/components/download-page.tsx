"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Download,
  Smartphone,
  Monitor,
  Check,
  Shield,
  ShieldCheck,
  Clock,
  FileText,
  ExternalLink,
  Copy,
  Bell,
} from "lucide-react"
import {
  APK_DOWNLOAD_URL,
  GITHUB_RELEASES_URL,
  APK_VERSION,
  SIGNING_CERT_SHA256,
  APKSIGNER_VERIFY_CMD,
} from "@/lib/site"

export function DownloadPage() {
  // Optional (not required) beta-updates email box
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [subscribed, setSubscribed] = useState(false)

  // Fingerprint copy feedback
  const [copied, setCopied] = useState(false)

  const handleCopyFingerprint = async () => {
    try {
      await navigator.clipboard.writeText(SIGNING_CERT_SHA256)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard may be unavailable; the value is still visible/selectable.
    }
  }

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/whitelist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // reason satisfies the backend's >=10 char requirement; not surfaced to the user.
        body: JSON.stringify({ email, reason: "beta updates signup" }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Something went wrong.")
      setSubscribed(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const platforms = [
    {
      name: "Android (APK)",
      status: "Direct Download",
      statusColor: "text-cyan-400",
      icon: Smartphone,
      available: true,
    },
    {
      name: "Google Play",
      status: "Coming 2026",
      statusColor: "text-yellow-400",
      icon: Smartphone,
      available: false,
    },
    {
      name: "iOS (App Store)",
      status: "Planned",
      statusColor: "text-gray-400",
      icon: Smartphone,
      available: false,
    },
    {
      name: "Desktop (macOS, Windows, Linux)",
      status: "Planned",
      statusColor: "text-gray-400",
      icon: Monitor,
      available: false,
    },
  ]

  return (
    <section className="relative py-20 lg:py-32">
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[150px]" />

      <div className="container relative mx-auto px-4 lg:px-8">
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Download className="h-8 w-8 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white lg:text-4xl">Download ZChat</h1>
          </div>
          <p className="mx-auto max-w-2xl text-gray-300">
            A messenger where every message is a Zcash shielded transaction. No email, no account, no waitlist — download
            the signed Android APK directly and verify it yourself.
          </p>
        </div>

        <div className="mx-auto max-w-4xl space-y-12">
          {/* Platform Status */}
          <div>
            <h2 className="mb-6 text-xl font-semibold text-white">Platform Availability</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {platforms.map((platform) => (
                <div
                  key={platform.name}
                  className={`rounded-xl border p-5 backdrop-blur-sm ${
                    platform.available
                      ? "border-cyan-500/30 bg-cyan-500/5"
                      : "border-gray-700/50 bg-gray-800/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        platform.available ? "bg-cyan-500/20" : "bg-gray-700/50"
                      }`}
                    >
                      <platform.icon
                        className={`h-5 w-5 ${platform.available ? "text-cyan-400" : "text-gray-500"}`}
                      />
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${platform.available ? "text-white" : "text-gray-400"}`}>
                        {platform.name}
                      </p>
                      <p className={`text-sm ${platform.statusColor}`}>{platform.status}</p>
                    </div>
                    {platform.available && (
                      <div className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                        Available
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Download APK Section */}
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/5 p-8">
            <h2 className="mb-2 text-xl font-semibold text-white">Android APK Download</h2>
            <p className="mb-6 text-sm text-gray-300">
              Direct download of the latest signed release — v{APK_VERSION}. No email, account, or waitlist required.
            </p>

            <div className="flex flex-col items-start gap-4">
              {/* Primary CTA — real anchor for a plain direct download */}
              <a
                href={APK_DOWNLOAD_URL}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 text-base font-semibold text-black transition-all hover:bg-cyan-400 sm:w-auto"
              >
                <Download className="h-5 w-5" />
                Download APK · v{APK_VERSION}
              </a>
              <p className="text-sm text-gray-400">
                or{" "}
                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  view all releases &amp; checksums on GitHub
                </a>
              </p>
            </div>

            {/* Optional beta-updates email box */}
            <div className="mt-6 rounded-xl border border-gray-700/50 bg-gray-900/30 p-5">
              {subscribed ? (
                <div className="flex items-center gap-3">
                  <Check className="h-6 w-6 shrink-0 text-green-400" />
                  <p className="text-sm text-gray-300">
                    You&apos;re on the list — we&apos;ll email you when a new build ships.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-center gap-2">
                    <Bell className="h-4 w-4 text-gray-400" />
                    <h3 className="text-sm font-medium text-white">Get beta updates (optional)</h3>
                  </div>
                  <p className="mb-3 text-xs text-gray-400">
                    Not required to download — just an optional heads-up when new builds land.
                  </p>
                  <form onSubmit={handleNotifySubmit} className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full flex-1 rounded-lg border border-cyan-500/30 bg-gray-900/50 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      required
                    />
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      variant="outline"
                      className="shrink-0 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
                    >
                      {isSubmitting ? "Adding..." : "Notify me"}
                    </Button>
                  </form>
                  {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                </>
              )}
            </div>
          </div>

          {/* Checksums & Signing */}
          <div className="rounded-xl border border-cyan-500/20 bg-white/[0.02] p-8">
            <h2 className="mb-6 text-xl font-semibold text-white">Verification</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-medium text-white">
                  <FileText className="h-4 w-4 text-cyan-400" />
                  APK Checksum (SHA-256)
                </h3>
                <p className="text-sm text-gray-300">
                  Each release publishes a per-build SHA-256 checksum alongside the APK. Compare it against your download
                  on the{" "}
                  <a
                    href={GITHUB_RELEASES_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    GitHub release page
                  </a>
                  .
                </p>
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-medium text-white">
                  <Shield className="h-4 w-4 text-cyan-400" />
                  Signing Key
                </h3>
                <p className="mb-3 text-sm text-gray-300">
                  Every APK is signed with ZChat&apos;s dedicated release key — never re-signed by any app store. Its
                  permanent certificate fingerprint (unchanged between versions) is:
                </p>
                <div className="mb-3 flex items-start gap-2">
                  <code className="flex-1 break-all rounded-lg bg-gray-900/50 p-3 font-mono text-xs text-gray-300">
                    {SIGNING_CERT_SHA256}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyFingerprint}
                    aria-label="Copy fingerprint"
                    className="shrink-0 rounded-lg border border-cyan-500/30 p-2 text-gray-400 transition-colors hover:border-cyan-500 hover:text-cyan-300"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mb-2 flex items-center gap-2 text-sm text-gray-300">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  Verify it yourself:
                </p>
                <code className="block break-all rounded-lg bg-gray-900/50 p-3 font-mono text-xs text-gray-300">
                  {APKSIGNER_VERIFY_CMD}
                </code>
              </div>
            </div>
          </div>

          {/* Release Notes */}
          <div className="rounded-xl border border-cyan-500/20 bg-white/[0.02] p-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
              <Clock className="h-5 w-5 text-cyan-400" />
              Release Notes
            </h2>
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-700/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-white">v{APK_VERSION}</span>
                  <span className="text-sm text-gray-400">April 2026</span>
                </div>
                <ul className="space-y-1 text-sm text-gray-300">
                  <li>+ Wallet tab — view balance, receive, send, and swap crypto</li>
                  <li>+ In-App Swap — deposit BTC, ETH, SOL, USDC or 20+ tokens → ZEC</li>
                  <li>+ Redesigned onboarding with identity QR, how-it-works guide</li>
                  <li>+ Nightwire cypherpunk UI redesign — all screens</li>
                  <li>~ QR scanner instant detection (fixed FLAG_SECURE conflict)</li>
                  <li>~ Balance shows "0 ZEC" instead of 8 decimal places</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Source Code */}
          <div className="text-center">
            <p className="mb-4 text-gray-400">ZChat is open source (GPLv3)</p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://github.com/decentrathai/zchat"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 px-4 py-2 text-sm text-cyan-400 transition-colors hover:bg-cyan-500/10"
              >
                <ExternalLink className="h-4 w-4" />
                Backend + Landing (GitHub)
              </a>
              <a
                href="https://github.com/decentrathai/zchat-android"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 px-4 py-2 text-sm text-cyan-400 transition-colors hover:bg-cyan-500/10"
              >
                <ExternalLink className="h-4 w-4" />
                Android App (GitHub)
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
