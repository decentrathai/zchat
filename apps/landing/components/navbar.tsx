"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

export function Navbar() {
  const pathname = usePathname()
  const isHomePage = pathname === "/"
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState("")

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)

      // Active section detection
      const sections = ["product", "how-it-works", "demo-video", "download", "contact"]
      let current = ""
      for (const id of sections) {
        const el = document.getElementById(id)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 120 && rect.bottom > 120) {
            current = id
          }
        }
      }
      setActiveSection(current)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    if (!isHomePage) {
      window.location.href = `/#${id}`
      return
    }
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  const navLinkClass = (sectionId: string) =>
    `relative text-sm transition-colors pb-1 ${
      activeSection === sectionId
        ? "text-[var(--accent-primary)]"
        : "text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
    }`

  const activeIndicator = (sectionId: string) =>
    activeSection === sectionId
      ? "absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-primary-glow)]"
      : ""

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-[var(--border-default)] bg-[var(--bg-base)]/80 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-4 lg:px-8">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors tracking-wider">
          ZCHAT
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <button onClick={() => scrollToSection("product")} className={navLinkClass("product")}>
            Product
            <span className={activeIndicator("product")} />
          </button>
          <button onClick={() => scrollToSection("how-it-works")} className={navLinkClass("how-it-works")}>
            How it works
            <span className={activeIndicator("how-it-works")} />
          </button>
          <Link href="/security" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]">
            Security
          </Link>
          <Link href="/comparison" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]">
            Compare
          </Link>
          <Link href="/faq" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]">
            FAQ
          </Link>
          <Link href="/about" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]">
            About
          </Link>
          <Link href="/protocol" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-primary)]">
            Docs
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => scrollToSection("donate")}
            variant="outline"
            className="rounded-lg border-purple-500/40 bg-purple-500/10 text-purple-300 transition-all hover:bg-purple-500/20 hover:border-purple-500/60 hover:text-purple-200 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)]"
          >
            Donate
          </Button>
          <Button
            onClick={() => scrollToSection("download")}
            className="rounded-lg bg-[var(--accent-primary)] text-[var(--bg-base)] font-semibold transition-all hover:shadow-[0_0_20px_var(--accent-primary-glow)]"
          >
            Download App
          </Button>
        </div>
      </div>
    </nav>
  )
}
