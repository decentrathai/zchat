"use client"

import { Button } from "@/components/ui/button"

export function Navbar() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-cyan-500/20 bg-[#050510]/80 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between px-4 py-4 lg:px-8">
        <div className="text-xl font-bold text-white">ZCHAT</div>

        <div className="hidden items-center gap-8 md:flex">
          <button
            onClick={() => scrollToSection("product")}
            className="text-sm text-gray-300 transition-colors hover:text-cyan-400"
          >
            Product
          </button>
          <button
            onClick={() => scrollToSection("how-it-works")}
            className="text-sm text-gray-300 transition-colors hover:text-cyan-400"
          >
            How it works
          </button>
          <button
            onClick={() => scrollToSection("about")}
            className="text-sm text-gray-300 transition-colors hover:text-cyan-400"
          >
            About
          </button>
          <button
            onClick={() => scrollToSection("roadmap")}
            className="text-sm text-gray-300 transition-colors hover:text-cyan-400"
          >
            Roadmap
          </button>
        </div>

        <Button
          onClick={() => scrollToSection("download")}
          className="bg-cyan-500 text-black transition-all hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.5)]"
        >
          Download App
        </Button>
      </div>
    </nav>
  )
}
