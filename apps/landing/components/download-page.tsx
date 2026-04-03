"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Download,
  Smartphone,
  Monitor,
  Check,
  Key,
  Shield,
  Clock,
  FileText,
  ExternalLink,
} from "lucide-react"

type CodeStep = "enter" | "downloading" | "error"

export function DownloadPage() {
  const [downloadCode, setDownloadCode] = useState("")
  const [codeStep, setCodeStep] = useState<CodeStep>("enter")
  const [codeError, setCodeError] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)

  // Whitelist form
  const [email, setEmail] = useState("")
  const [reason, setReason] = useState("")
  const [formStep, setFormStep] = useState<"email" | "reason" | "success" | "already_registered">("email")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [showWhitelistForm, setShowWhitelistForm] = useState(false)

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeError("")

    if (!downloadCode.trim()) {
      setCodeError("Please enter your download code")
      return
    }

    setIsVerifying(true)

    try {
      let response: Response
      try {
        response = await fetch("/api/download/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: downloadCode.trim() }),
        })
      } catch {
        throw new Error("Cannot reach the server. Please check your internet connection and try again.")
      }

      let data: Record<string, unknown>
      try {
        data = await response.json()
      } catch {
        throw new Error("Server returned an unexpected response. Please try again.")
      }

      if (!response.ok) {
        throw new Error((data.error as string) || "Invalid download code")
      }

      if (!data.downloadUrl || typeof data.downloadUrl !== "string") {
        throw new Error("Invalid download URL received")
      }

      // downloadUrl from backend is like "/download/apk/<token>" — prefix with /api
      setCodeStep("downloading")
      window.location.href = `/api${data.downloadUrl}`
    } catch (err: unknown) {
      setCodeError(err instanceof Error ? err.message : "Failed to verify code.")
      setCodeStep("error")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address")
      return
    }
    setFormStep("reason")
  }

  const handleReasonSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (reason.trim().length < 10) {
      setError("Please provide a more detailed reason (at least 10 characters)")
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/whitelist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to join whitelist")
      if (data.alreadyRegistered) {
        setFormStep("already_registered")
      } else {
        setFormStep("success")
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const platforms = [
    {
      name: "Android (APK)",
      status: "Private Beta",
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
            A messenger where every message is a Zcash shielded transaction. Currently available as Android APK in
            private beta.
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
            <h2 className="mb-6 text-xl font-semibold text-white">Android APK Download</h2>

            <div className="grid gap-8 md:grid-cols-2">
              {/* Enter Download Code */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-lg font-medium text-white">
                  <Key className="h-5 w-5 text-cyan-400" />
                  Have a download code?
                </h3>

                {codeStep === "enter" && (
                  <form onSubmit={handleCodeSubmit} className="space-y-3">
                    <input
                      type="text"
                      value={downloadCode}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase()
                        if (/^[A-Z0-9]*$/.test(value)) setDownloadCode(value)
                      }}
                      placeholder="Enter code (e.g., A1B2C3D4)"
                      className="w-full rounded-lg border border-cyan-500/30 bg-gray-900/50 px-4 py-3 text-center font-mono text-lg tracking-widest text-white uppercase placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      maxLength={8}
                      required
                    />
                    {codeError && <p className="text-sm text-red-400">{codeError}</p>}
                    <Button
                      type="submit"
                      disabled={isVerifying}
                      className="w-full bg-cyan-500 text-black transition-all hover:bg-cyan-400 disabled:opacity-50"
                    >
                      {isVerifying ? "Verifying..." : "Download APK"}
                    </Button>
                  </form>
                )}

                {codeStep === "downloading" && (
                  <div className="space-y-3 text-center py-4">
                    <Download className="mx-auto h-8 w-8 animate-bounce text-cyan-400" />
                    <p className="text-white font-medium">Download starting...</p>
                    <button
                      onClick={() => {
                        setCodeStep("enter")
                        setDownloadCode("")
                      }}
                      className="text-sm text-cyan-400 hover:text-cyan-300"
                    >
                      Download again
                    </button>
                  </div>
                )}

                {codeStep === "error" && (
                  <div className="space-y-3 text-center py-4">
                    <p className="text-red-400">{codeError}</p>
                    <Button
                      onClick={() => setCodeStep("enter")}
                      className="bg-cyan-500 text-black hover:bg-cyan-400"
                    >
                      Try Again
                    </Button>
                  </div>
                )}
              </div>

              {/* Request Access */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-lg font-medium text-white">
                  <Shield className="h-5 w-5 text-cyan-400" />
                  Request early access
                </h3>

                {!showWhitelistForm ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-300">
                      Join the whitelist to get a download code. Limited spots available for beta testers.
                    </p>
                    <Button
                      onClick={() => setShowWhitelistForm(true)}
                      variant="outline"
                      className="w-full border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10"
                    >
                      Request Early Access
                    </Button>
                  </div>
                ) : formStep === "email" ? (
                  <form onSubmit={handleEmailSubmit} className="space-y-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full rounded-lg border border-cyan-500/30 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      required
                    />
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <Button type="submit" className="w-full bg-cyan-500 text-black hover:bg-cyan-400">
                      Continue
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowWhitelistForm(false)}
                      className="w-full text-sm text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </form>
                ) : formStep === "reason" ? (
                  <form onSubmit={handleReasonSubmit} className="space-y-3">
                    <label htmlFor="dl-reason" className="block text-sm text-gray-300">
                      Why do you want to test this private messenger?
                    </label>
                    <textarea
                      id="dl-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Tell us why privacy matters to you..."
                      rows={3}
                      className="w-full rounded-lg border border-cyan-500/30 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      required
                    />
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-50"
                    >
                      {isSubmitting ? "Submitting..." : "Join Whitelist"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setFormStep("email")}
                      className="w-full text-sm text-gray-400 hover:text-white"
                    >
                      Back
                    </button>
                  </form>
                ) : formStep === "success" ? (
                  <div className="space-y-3 text-center py-4">
                    <Check className="mx-auto h-8 w-8 text-green-400" />
                    <p className="font-medium text-white">You&apos;re on the whitelist!</p>
                    <p className="text-sm text-gray-300">
                      Follow{" "}
                      <a
                        href="https://x.com/zchat_app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300"
                      >
                        @zchat_app
                      </a>{" "}
                      for updates.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 text-center py-4">
                    <Key className="mx-auto h-8 w-8 text-yellow-400" />
                    <p className="font-medium text-white">Already registered!</p>
                    <p className="text-sm text-gray-300">Check your email for a download code, or wait for approval.</p>
                  </div>
                )}
              </div>
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
                <div className="rounded-lg bg-gray-900/50 p-3">
                  <code className="break-all text-xs text-gray-400">[TBD — checksum published with each release]</code>
                </div>
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-medium text-white">
                  <Shield className="h-4 w-4 text-cyan-400" />
                  Signing Key
                </h3>
                <p className="text-sm text-gray-300">
                  APKs are signed with the ZChat debug key during beta. Production signing key will be published when the
                  app reaches stable release.
                </p>
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
                  <span className="font-medium text-white">v2.10.5</span>
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
