"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"

const ZCASH_ADDRESS = "u1xcdd38s00czn0vn0nrpe2cwa8cutxw8y8m0lzgg627qap777zlzgsww7e2aqryrkuy2dvq4ug3m42a8xhe623a29pyrnguk5s3hcdfag39e05uyy3z6lgvxpqtufsp2er9yxyrc2np8p3wywk7quv5cgrq3t5qejeupm0re5nu6cm7al"

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

function FooterCopyAddress() {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    copyToClipboard(ZCASH_ADDRESS)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-sm text-[var(--accent-primary)] transition-colors hover:text-[var(--accent-primary-dim)]"
      title="Copy shielded Zcash address"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "ZCHAT Contact"}
    </button>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-default)] bg-[var(--bg-surface)] py-12">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="text-sm text-[var(--text-secondary)]">&copy; 2026 ZCHAT (zsend.xyz)</div>

          <div className="text-center text-sm text-[var(--text-tertiary)]">
            <p>Experimental software. No third-party audit. Use at your own risk.</p>
            <p className="mt-1">ZChat (zsend.xyz) is a Zcash shielded memo messenger. Not affiliated with zchat.com or other products named ZChat.</p>
          </div>

          <div className="flex items-center gap-6">
            <FooterCopyAddress />
            <a
              href="https://github.com/decentrathai/zchat"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]"
            >
              GitHub
            </a>
            <a
              href="https://t.me/Antrbit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]"
            >
              Telegram
            </a>
            <a
              href="https://x.com/zchat_app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]"
            >
              X
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
