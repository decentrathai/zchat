"use client"

import { useState } from "react"
import { MessageCircle, Github, Mail, Send, Loader2, Shield, Copy, Check } from "lucide-react"
import { SiX } from "@icons-pack/react-simple-icons"
import Image from "next/image"

const ZCASH_ADDRESS = "u1xcdd38s00czn0vn0nrpe2cwa8cutxw8y8m0lzgg627qap777zlzgsww7e2aqryrkuy2dvq4ug3m42a8xhe623a29pyrnguk5s3hcdfag39e05uyy3z6lgvxpqtufsp2er9yxyrc2np8p3wywk7quv5cgrq3t5qejeupm0re5nu6cm7al"
const EVM_ADDRESS = "0xcf1a9dE438996Dc8A6640B8f74d8D90faA4E8c2C"

function copyToClipboard(text: string): void {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-3 py-1.5 text-xs font-medium text-[var(--accent-primary)] transition-all hover:bg-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)]/50"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  )
}

export function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" })
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")
  const [showZchatQr, setShowZchatQr] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("loading")
    setErrorMessage("")

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setStatus("success")
        setFormData({ name: "", email: "", message: "" })
      } else {
        setStatus("error")
        setErrorMessage(data.error || "Failed to send message")
      }
    } catch {
      setStatus("error")
      setErrorMessage("Network error. Please try again.")
    }
  }

  return (
    <section id="contact" className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-balance text-3xl font-bold text-[var(--text-primary)] lg:text-4xl">Get in touch</h2>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-[var(--text-secondary)]">Questions? Feedback? Let&apos;s connect.</p>
        </div>

        {/* Contact Cards */}
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-5">
          {/* ZCHAT (Shielded) */}
          <button
            onClick={() => setShowZchatQr(!showZchatQr)}
            className={`group relative overflow-hidden rounded-lg border p-8 text-center backdrop-blur-sm transition-all text-left ${
              showZchatQr
                ? "border-purple-500/60 bg-gradient-to-br from-purple-500/20 to-[var(--accent-primary)]/20 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                : "border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-[var(--accent-primary)]/10 hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]"
            }`}
          >
            <Shield className="mx-auto mb-4 h-10 w-10 text-purple-400 transition-transform group-hover:scale-110" />
            <h3 className="mb-2 font-bold text-[var(--text-primary)]">ZCHAT</h3>
            <p className="mb-3 text-xs text-purple-300">Shielded contact</p>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300 transition-all group-hover:bg-purple-500/20">
              {showZchatQr ? "Hide QR" : "Show QR"}
            </span>
          </button>

          {/* Email */}
          <a
            href="mailto:contact@zsend.xyz"
            className="group relative overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center transition-all hover:border-[var(--border-active)] hover:shadow-[0_0_30px_var(--accent-primary-glow)]"
          >
            <Mail className="mx-auto mb-4 h-10 w-10 text-[var(--accent-primary)] transition-transform group-hover:scale-110" />
            <h3 className="mb-2 font-bold text-[var(--text-primary)]">Email</h3>
            <p className="text-sm text-[var(--accent-primary)]">contact@zsend.xyz</p>
          </a>

          {/* Telegram */}
          <a
            href="https://t.me/Antrbit"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center transition-all hover:border-[var(--border-active)] hover:shadow-[0_0_30px_var(--accent-primary-glow)]"
          >
            <MessageCircle className="mx-auto mb-4 h-10 w-10 text-[var(--accent-primary)] transition-transform group-hover:scale-110" />
            <h3 className="mb-2 font-bold text-[var(--text-primary)]">Telegram</h3>
            <p className="text-sm text-[var(--accent-primary)]">@Antrbit</p>
          </a>

          {/* X (Twitter) */}
          <a
            href="https://x.com/zchat_app"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center transition-all hover:border-[var(--border-active)] hover:shadow-[0_0_30px_var(--accent-primary-glow)]"
          >
            <SiX className="mx-auto mb-4 h-10 w-10 text-[var(--accent-primary)] transition-transform group-hover:scale-110" />
            <h3 className="mb-2 font-bold text-[var(--text-primary)]">X (Twitter)</h3>
            <p className="text-sm text-[var(--accent-primary)]">@zchat_app</p>
          </a>

          {/* GitHub */}
          <a
            href="https://github.com/decentrathai/zchat-android"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center transition-all hover:border-[var(--border-active)] hover:shadow-[0_0_30px_var(--accent-primary-glow)]"
          >
            <Github className="mx-auto mb-4 h-10 w-10 text-[var(--accent-primary)] transition-transform group-hover:scale-110" />
            <h3 className="mb-2 font-bold text-[var(--text-primary)]">GitHub</h3>
            <p className="text-sm text-[var(--accent-primary)]">decentrathai/zchat-android</p>
          </a>
        </div>

        {/* ZCHAT QR Expandable */}
        {showZchatQr && (
          <div className="mx-auto mt-6 max-w-sm">
            <div className="rounded-lg border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-[var(--accent-primary)]/10 p-6 text-center">
              <p className="mb-4 text-sm text-purple-300">Scan to contact us via ZCHAT</p>
              <div className="mx-auto mb-4 inline-block overflow-hidden rounded-lg border-2 border-purple-500/30 bg-white p-2">
                <Image
                  src="/images/zcash-qr.jpg"
                  alt="ZCHAT shielded contact QR code"
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>
              <div className="mb-3 rounded-lg bg-[var(--bg-base)] p-3">
                <p className="break-all font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-purple-300/80">
                  {ZCASH_ADDRESS}
                </p>
              </div>
              <CopyButton text={ZCASH_ADDRESS} label="Copy Address" />
            </div>
          </div>
        )}

        {/* Donate Section */}
        <div id="donate" className="mx-auto mt-10 max-w-3xl">
            <div className="rounded-lg border border-purple-500/30 bg-[var(--bg-surface)] p-8">
              <h3 className="mb-2 text-center font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-primary)]">Fund Privacy</h3>
              <p className="mb-8 text-center text-[var(--text-secondary)]">
                Every contribution helps us build tools that protect fundamental human rights. Privacy is not a luxury — it&apos;s a necessity.
              </p>

              <div className="grid gap-8 md:grid-cols-2">
                {/* Zcash Shielded */}
                <div className="flex flex-col items-center rounded-lg border border-purple-500/20 bg-purple-500/5 p-6">
                  <h4 className="mb-1 text-lg font-bold text-purple-300">Zcash (Shielded)</h4>
                  <p className="mb-4 text-xs text-[var(--text-tertiary)]">Fully private — recommended</p>
                  <div className="mb-4 overflow-hidden rounded-lg border-2 border-purple-500/30 bg-white p-2">
                    <Image
                      src="/images/zcash-qr.jpg"
                      alt="Zcash shielded address QR code"
                      width={180}
                      height={180}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="mb-3 w-full rounded-lg bg-[var(--bg-base)] p-3">
                    <p className="break-all text-center font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-[var(--accent-success)]/80">
                      {ZCASH_ADDRESS}
                    </p>
                  </div>
                  <CopyButton text={ZCASH_ADDRESS} label="Copy Zcash Address" />
                </div>

                {/* EVM */}
                <div className="flex flex-col items-center rounded-lg border border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5 p-6">
                  <h4 className="mb-1 text-lg font-bold text-[var(--accent-primary)]">EVM (ETH/MATIC/etc.)</h4>
                  <p className="mb-4 text-xs text-[var(--text-tertiary)]">If you&apos;re Vitalik :)</p>
                  <div className="mb-4 overflow-hidden rounded-lg border-2 border-[var(--accent-primary)]/30 bg-white p-2">
                    <Image
                      src="/images/evm-qr.png"
                      alt="EVM wallet address QR code"
                      width={180}
                      height={180}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="mb-3 w-full rounded-lg bg-[var(--bg-base)] p-3">
                    <p className="break-all text-center font-[family-name:var(--font-mono)] text-sm leading-relaxed text-purple-400/80">
                      {EVM_ADDRESS}
                    </p>
                  </div>
                  <CopyButton text={EVM_ADDRESS} label="Copy EVM Address" />
                </div>
              </div>

              <p className="mt-6 text-center text-xs text-[var(--text-tertiary)]">
                All donations go directly to ZCHAT development and infrastructure costs.
              </p>
            </div>
          </div>

        {/* Contact Form */}
        <div className="mx-auto mt-16 max-w-2xl">
          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8">
            <h3 className="mb-6 text-center font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-primary)]">Send us a message</h3>

            {status === "success" ? (
              <div className="rounded-lg bg-[var(--accent-success)]/10 border border-[var(--accent-success)]/30 p-6 text-center">
                <div className="mb-4 text-4xl text-[var(--accent-success)]">&#10003;</div>
                <h4 className="mb-2 text-xl font-bold text-[var(--accent-success)]">Message Sent!</h4>
                <p className="text-[var(--text-secondary)]">Thank you for reaching out. We&apos;ll get back to you soon.</p>
                <button
                  onClick={() => setStatus("idle")}
                  className="mt-4 text-[var(--accent-primary)] hover:text-[var(--accent-primary-dim)] underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    minLength={2}
                    maxLength={100}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--border-active)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    maxLength={254}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--border-active)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--border-active)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] resize-none"
                    placeholder="Your message..."
                  />
                </div>

                {status === "error" && (
                  <div className="rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 p-3 text-[var(--color-danger)] text-sm">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-6 py-3 font-semibold text-[var(--bg-base)] transition-all hover:shadow-[0_0_20px_var(--accent-primary-glow)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
