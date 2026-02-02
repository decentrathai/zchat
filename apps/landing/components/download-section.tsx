"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Smartphone, Check, ExternalLink, Key } from "lucide-react"

type FormStep = "email" | "reason" | "success" | "already_registered"
type CodeStep = "enter" | "downloading" | "error"

export function DownloadSection() {
  // Whitelist form state
  const [formStep, setFormStep] = useState<FormStep>("email")
  const [email, setEmail] = useState("")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [showForm, setShowForm] = useState(false)

  // Download code state
  const [showCodeForm, setShowCodeForm] = useState(false)
  const [downloadCode, setDownloadCode] = useState("")
  const [codeStep, setCodeStep] = useState<CodeStep>("enter")
  const [codeError, setCodeError] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Basic email validation
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
      const response = await fetch("https://api.zsend.xyz/whitelist/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, reason }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to join whitelist")
      }

      // Check if email was already registered
      if (data.alreadyRegistered) {
        setFormStep("already_registered")
      } else {
        setFormStep("success")
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCodeError("")

    if (!downloadCode.trim()) {
      setCodeError("Please enter your download code")
      return
    }

    setIsVerifying(true)

    try {
      const response = await fetch("https://api.zsend.xyz/download/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: downloadCode.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Invalid download code")
      }

      // Redirect to download
      setCodeStep("downloading")

      // Trigger the download
      window.location.href = `https://api.zsend.xyz${data.downloadUrl}`
    } catch (err: any) {
      setCodeError(err.message || "Failed to verify code. Please try again.")
      setCodeStep("error")
    } finally {
      setIsVerifying(false)
    }
  }

  const resetCodeForm = () => {
    setShowCodeForm(false)
    setDownloadCode("")
    setCodeStep("enter")
    setCodeError("")
  }

  return (
    <section id="download" className="relative py-20 lg:py-32">
      {/* Background effect */}
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[150px]" />

      <div className="container relative mx-auto px-4 lg:px-8">
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Download className="h-8 w-8 text-cyan-400" />
            <h2 className="text-3xl font-bold text-white lg:text-4xl">Download ZCHAT</h2>
          </div>
          <p className="mx-auto max-w-2xl text-gray-300">
            Get the most private messenger in the world. No sign-up required. Your messages live on the Zcash blockchain.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Store Apps - Coming Soon */}
            <div className="space-y-4">
              <h3 className="mb-4 text-xl font-semibold text-white">Official App Stores</h3>

              {/* App Store */}
              <div className="group relative overflow-hidden rounded-xl border border-gray-700/50 bg-gray-800/30 p-6 backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-600/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-700/50">
                    <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-400" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-400">Download on the</p>
                    <p className="text-lg font-semibold text-white">App Store</p>
                  </div>
                  <div className="rounded-full bg-gray-700/50 px-3 py-1 text-xs text-gray-400">
                    Coming Soon
                  </div>
                </div>
              </div>

              {/* Google Play */}
              <div className="group relative overflow-hidden rounded-xl border border-gray-700/50 bg-gray-800/30 p-6 backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-600/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-700/50">
                    <svg viewBox="0 0 24 24" className="h-8 w-8 text-gray-400" fill="currentColor">
                      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-400">Get it on</p>
                    <p className="text-lg font-semibold text-white">Google Play</p>
                  </div>
                  <div className="rounded-full bg-gray-700/50 px-3 py-1 text-xs text-gray-400">
                    Coming Soon
                  </div>
                </div>
              </div>

              <p className="text-center text-sm text-gray-500">
                Official store releases coming in Q1 2026
              </p>
            </div>

            {/* APK Download with Whitelist */}
            <div className="space-y-4">
              <h3 className="mb-4 text-xl font-semibold text-white">Early Access (Android APK)</h3>

              <div className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-magenta-500/5 p-6 backdrop-blur-sm">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-500/20 blur-[50px]" />

                {/* Initial state - no forms shown */}
                {!showForm && !showCodeForm ? (
                  <div className="relative space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-500/20">
                        <Smartphone className="h-8 w-8 text-cyan-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">Android APK</p>
                        <p className="text-sm text-gray-400">Direct download for testers</p>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-gray-300">
                      Join our exclusive whitelist to get early access to ZCHAT. Limited spots available for beta testers.
                    </p>

                    <div className="space-y-3">
                      <Button
                        onClick={() => setShowForm(true)}
                        className="w-full bg-cyan-500 text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Request Early Access
                      </Button>

                      <button
                        onClick={() => setShowCodeForm(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-transparent px-4 py-2.5 text-sm font-medium text-cyan-400 transition-all hover:border-cyan-500/50 hover:bg-cyan-500/10"
                      >
                        <Key className="h-4 w-4" />
                        I have a download code
                      </button>
                    </div>
                  </div>
                ) : showCodeForm ? (
                  /* Download Code Form */
                  <div className="relative">
                    {codeStep === "enter" && (
                      <form onSubmit={handleCodeSubmit} className="space-y-4">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20">
                            <Key className="h-6 w-6 text-cyan-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">Enter Download Code</p>
                            <p className="text-sm text-gray-400">Received via email from us</p>
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={downloadCode}
                            onChange={(e) => setDownloadCode(e.target.value.toUpperCase())}
                            placeholder="Enter your code (e.g., A1B2C3D4)"
                            className="w-full rounded-lg border border-cyan-500/30 bg-gray-900/50 px-4 py-3 text-center text-lg font-mono tracking-widest text-white uppercase placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            maxLength={8}
                            required
                          />
                        </div>

                        {codeError && <p className="text-sm text-red-400">{codeError}</p>}

                        <Button
                          type="submit"
                          disabled={isVerifying}
                          className="w-full bg-cyan-500 text-black transition-all hover:bg-cyan-400 disabled:opacity-50"
                        >
                          {isVerifying ? "Verifying..." : "Download APK"}
                        </Button>

                        <button
                          type="button"
                          onClick={resetCodeForm}
                          className="w-full text-sm text-gray-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </form>
                    )}

                    {codeStep === "downloading" && (
                      <div className="space-y-4 text-center py-4">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/20">
                          <Download className="h-8 w-8 text-cyan-400 animate-bounce" />
                        </div>
                        <h4 className="text-xl font-semibold text-white">
                          Download Starting...
                        </h4>
                        <p className="text-gray-300">
                          Your APK download should begin automatically. If it doesn&apos;t start, check your browser&apos;s download settings.
                        </p>
                        <button
                          onClick={resetCodeForm}
                          className="text-sm text-cyan-400 hover:text-cyan-300"
                        >
                          Go back
                        </button>
                      </div>
                    )}

                    {codeStep === "error" && (
                      <div className="space-y-4 text-center py-4">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
                          <span className="text-2xl">!</span>
                        </div>
                        <h4 className="text-xl font-semibold text-white">
                          Code Invalid
                        </h4>
                        <p className="text-gray-300">{codeError}</p>
                        <Button
                          onClick={() => setCodeStep("enter")}
                          className="bg-cyan-500 text-black hover:bg-cyan-400"
                        >
                          Try Again
                        </Button>
                        <button
                          onClick={resetCodeForm}
                          className="block w-full text-sm text-gray-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Whitelist Form */
                  <div className="relative">
                    {formStep === "email" && (
                      <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <div>
                          <label htmlFor="email" className="mb-2 block text-sm font-medium text-white">
                            Enter your email
                          </label>
                          <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full rounded-lg border border-cyan-500/30 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            required
                          />
                        </div>
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <Button
                          type="submit"
                          className="w-full bg-cyan-500 text-black transition-all hover:bg-cyan-400"
                        >
                          Continue
                        </Button>
                        <button
                          type="button"
                          onClick={() => setShowForm(false)}
                          className="w-full text-sm text-gray-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </form>
                    )}

                    {formStep === "reason" && (
                      <form onSubmit={handleReasonSubmit} className="space-y-4">
                        <div>
                          <label htmlFor="reason" className="mb-2 block text-sm font-medium text-white">
                            Why do you want to test the #1 most private messenger in the world?
                          </label>
                          <textarea
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Tell us why privacy matters to you..."
                            rows={4}
                            className="w-full rounded-lg border border-cyan-500/30 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                            required
                          />
                        </div>
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        <Button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full bg-cyan-500 text-black transition-all hover:bg-cyan-400 disabled:opacity-50"
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
                    )}

                    {formStep === "success" && (
                      <div className="space-y-4 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                          <Check className="h-8 w-8 text-green-400" />
                        </div>
                        <h4 className="text-xl font-semibold text-white">
                          Thanks for joining the whitelist!
                        </h4>
                        <p className="text-gray-300">
                          Keep an eye on our X account and you&apos;ll be the first to know when new testing slots are available.
                        </p>
                        <a
                          href="https://x.com/zchat_app"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-black px-6 py-3 font-medium text-white transition-all hover:bg-gray-900"
                        >
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                          Follow @zchat_app
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    )}

                    {formStep === "already_registered" && (
                      <div className="space-y-4 text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20">
                          <Key className="h-8 w-8 text-yellow-400" />
                        </div>
                        <h4 className="text-xl font-semibold text-white">
                          You&apos;re already on the whitelist!
                        </h4>
                        <p className="text-gray-300">
                          This email is already registered. If you&apos;ve received a download code, use it below. Otherwise, wait for approval.
                        </p>
                        <div className="space-y-3 pt-2">
                          <Button
                            onClick={() => {
                              setShowForm(false)
                              setShowCodeForm(true)
                              setFormStep("email")
                              setEmail("")
                              setReason("")
                            }}
                            className="w-full bg-cyan-500 text-black transition-all hover:bg-cyan-400"
                          >
                            <Key className="mr-2 h-4 w-4" />
                            Enter Download Code
                          </Button>
                          <button
                            onClick={() => {
                              setShowForm(false)
                              setFormStep("email")
                              setEmail("")
                              setReason("")
                            }}
                            className="w-full text-sm text-gray-400 hover:text-white"
                          >
                            Go Back
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <p className="text-center text-sm text-gray-500">
                By joining, you agree to receive updates about ZCHAT
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
