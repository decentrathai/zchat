"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Smartphone, Check, ShieldCheck, Copy, ChevronDown, Bell } from "lucide-react"
import {
  APK_DOWNLOAD_URL,
  GITHUB_RELEASES_URL,
  APK_VERSION,
  SIGNING_CERT_SHA256,
  APKSIGNER_VERIFY_CMD,
} from "@/lib/site"

export function DownloadSection() {
  // Optional (not required) beta-updates email box
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [subscribed, setSubscribed] = useState(false)

  // "Verify this download" copy-to-clipboard feedback
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
      if (!response.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.")
      }
      setSubscribed(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="download" className="relative py-20 lg:py-32">
      {/* Background effect */}
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-primary)]/10 blur-[150px]" />

      <div className="container relative mx-auto px-4 lg:px-8">
        <div className="mb-12 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Download className="h-8 w-8 text-[var(--accent-primary)]" />
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--text-primary)] lg:text-4xl">Download ZCHAT</h2>
            <span className="rounded-lg bg-[var(--accent-primary)]/15 px-2.5 py-0.5 text-xs font-semibold text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">v{APK_VERSION}</span>
          </div>
          <p className="mx-auto max-w-2xl text-[var(--text-secondary)]">
            No email. No account. No waitlist. A direct, verifiable APK download — every message is a Zcash shielded transaction, and your messages live on the Zcash blockchain.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Store Apps - Coming Soon */}
            <div className="space-y-4">
              <h3 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">Official App Stores</h3>

              {/* App Store */}
              <div className="group relative overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 transition-all hover:border-[var(--border-active)]">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--text-tertiary)]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                    <svg viewBox="0 0 24 24" className="h-8 w-8 text-[var(--text-tertiary)]" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-tertiary)]">Download on the</p>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">App Store</p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-tertiary)]">
                    Coming Soon
                  </div>
                </div>
              </div>

              {/* Google Play */}
              <div className="group relative overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 transition-all hover:border-[var(--border-active)]">
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--text-tertiary)]/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--bg-elevated)]">
                    <svg viewBox="0 0 24 24" className="h-8 w-8 text-[var(--text-tertiary)]" fill="currentColor">
                      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-tertiary)]">Get it on</p>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">Google Play</p>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-elevated)] px-3 py-1 text-xs text-[var(--text-tertiary)]">
                    Coming Soon
                  </div>
                </div>
              </div>

              <p className="text-center text-sm text-[var(--text-tertiary)]">
                Official store releases coming in 2026
              </p>
            </div>

            {/* Direct APK Download */}
            <div className="space-y-4">
              <h3 className="mb-4 text-xl font-semibold text-[var(--text-primary)]">Direct Download (Android APK)</h3>

              <div className="relative overflow-hidden rounded-lg border border-[var(--border-active)] bg-gradient-to-br from-[var(--accent-primary)]/5 to-[var(--accent-secondary)]/5 p-6">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--accent-primary)]/20 blur-[50px]" />

                <div className="relative space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--accent-primary)]/20">
                      <Smartphone className="h-8 w-8 text-[var(--accent-primary)]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">Android APK</p>
                      <p className="text-sm text-[var(--text-secondary)]">Signed release · direct download</p>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                    Download the signed APK straight from GitHub and sideload it. No email, no account, no waitlist.
                  </p>

                  {/* Primary CTA — real anchor for a plain direct download */}
                  <a
                    href={APK_DOWNLOAD_URL}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-6 py-3 text-base font-semibold text-[var(--bg-base)] transition-all hover:shadow-[0_0_30px_var(--accent-primary-glow)]"
                  >
                    <Download className="h-5 w-5" />
                    Download APK · v{APK_VERSION}
                  </a>

                  <p className="text-center text-sm text-[var(--text-tertiary)]">
                    or{" "}
                    <a
                      href={GITHUB_RELEASES_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent-primary)] hover:underline"
                    >
                      view all releases &amp; checksums on GitHub
                    </a>
                  </p>

                  {/* Verify this download */}
                  <details className="group rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]/60 p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-[var(--text-primary)]">
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-[var(--accent-primary)]" />
                        Verify this download
                      </span>
                      <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)] transition-transform group-open:rotate-180" />
                    </summary>

                    <div className="mt-4 space-y-3">
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                        This APK is signed with ZCHAT&apos;s own release key — it is never re-signed by any app store. Its permanent certificate fingerprint is:
                      </p>

                      <div className="flex items-start gap-2">
                        <code className="flex-1 break-all rounded-lg bg-[var(--bg-input)] px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-[var(--text-primary)]">
                          {SIGNING_CERT_SHA256}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopyFingerprint}
                          aria-label="Copy fingerprint"
                          className="shrink-0 rounded-lg border border-[var(--border-default)] p-2 text-[var(--text-secondary)] transition-colors hover:border-[var(--border-active)] hover:text-[var(--accent-primary)]"
                        >
                          {copied ? <Check className="h-4 w-4 text-[var(--accent-success)]" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>

                      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                        Verify it yourself:
                      </p>
                      <code className="block break-all rounded-lg bg-[var(--bg-input)] px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-[var(--text-primary)]">
                        {APKSIGNER_VERIFY_CMD}
                      </code>
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                        Confirm the &quot;Signer #1 certificate SHA-256 digest&quot; matches the value above — it never changes between versions.
                      </p>
                    </div>
                  </details>
                </div>
              </div>

              {/* Optional beta-updates email box (subordinate to the download) */}
              <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]/40 p-4">
                {subscribed ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-success)]/20">
                      <Check className="h-5 w-5 text-[var(--accent-success)]" />
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      You&apos;re on the list — we&apos;ll email you when a new build ships.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      <Bell className="h-4 w-4 text-[var(--text-tertiary)]" />
                      <p className="text-sm font-medium text-[var(--text-primary)]">Get beta updates (optional)</p>
                    </div>
                    <p className="mb-3 text-xs text-[var(--text-tertiary)]">
                      Not required to download — just an optional heads-up when new builds land.
                    </p>
                    <form onSubmit={handleNotifySubmit} className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--border-active)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                        required
                      />
                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        variant="outline"
                        className="shrink-0 rounded-lg border-[var(--border-active)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 disabled:opacity-50"
                      >
                        {isSubmitting ? "Adding..." : "Notify me"}
                      </Button>
                    </form>
                    {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
