"use client"

import { useState } from "react"
import { MessageCircle, Github, Mail, Send, Loader2 } from "lucide-react"
import { SiX } from "@icons-pack/react-simple-icons"

export function Contact() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" })
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("loading")
    setErrorMessage("")

    try {
      const response = await fetch("https://api.zsend.xyz/contact", {
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
          <h2 className="mb-4 text-balance text-3xl font-bold text-white lg:text-4xl">Get in touch</h2>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-gray-300">Questions? Feedback? Let&apos;s connect.</p>
        </div>

        {/* Contact Cards */}
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-4">
          {/* Email */}
          <a
            href="mailto:contact@zsend.xyz"
            className="group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-magenta-500/10 p-8 text-center backdrop-blur-sm transition-all hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]"
          >
            <Mail className="mx-auto mb-4 h-10 w-10 text-cyan-400 transition-transform group-hover:scale-110" />
            <h3 className="mb-2 font-bold text-white">Email</h3>
            <p className="text-sm text-cyan-300">contact@zsend.xyz</p>
          </a>

          {/* Telegram */}
          <a
            href="https://t.me/Antrbit"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-magenta-500/10 p-8 text-center backdrop-blur-sm transition-all hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]"
          >
            <MessageCircle className="mx-auto mb-4 h-10 w-10 text-cyan-400 transition-transform group-hover:scale-110" />
            <h3 className="mb-2 font-bold text-white">Telegram</h3>
            <p className="text-sm text-cyan-300">@Antrbit</p>
          </a>

          {/* X (Twitter) */}
          <a
            href="https://x.com/zchat_app"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-magenta-500/10 p-8 text-center backdrop-blur-sm transition-all hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]"
          >
            <SiX className="mx-auto mb-4 h-10 w-10 text-cyan-400 transition-transform group-hover:scale-110" />
            <h3 className="mb-2 font-bold text-white">X (Twitter)</h3>
            <p className="text-sm text-cyan-300">@zchat_app</p>
          </a>

          {/* GitHub */}
          <a
            href="https://github.com/decentrathai/zchat-android"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-magenta-500/10 p-8 text-center backdrop-blur-sm transition-all hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]"
          >
            <Github className="mx-auto mb-4 h-10 w-10 text-cyan-400 transition-transform group-hover:scale-110" />
            <h3 className="mb-2 font-bold text-white">GitHub</h3>
            <p className="text-sm text-cyan-300">decentrathai/zchat-android</p>
          </a>
        </div>

        {/* Contact Form */}
        <div className="mx-auto mt-16 max-w-2xl">
          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-magenta-500/5 p-8 backdrop-blur-sm">
            <h3 className="mb-6 text-center text-2xl font-bold text-white">Send us a message</h3>

            {status === "success" ? (
              <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-6 text-center">
                <div className="mb-4 text-4xl">&#10003;</div>
                <h4 className="mb-2 text-xl font-bold text-green-400">Message Sent!</h4>
                <p className="text-gray-300">Thank you for reaching out. We&apos;ll get back to you soon.</p>
                <button
                  onClick={() => setStatus("idle")}
                  className="mt-4 text-cyan-400 hover:text-cyan-300 underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-medium text-gray-300">
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
                    className="w-full rounded-xl border border-cyan-500/30 bg-[#0a0a1a] px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    maxLength={254}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl border border-cyan-500/30 bg-[#0a0a1a] px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="mb-2 block text-sm font-medium text-gray-300">
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
                    className="w-full rounded-xl border border-cyan-500/30 bg-[#0a0a1a] px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                    placeholder="Your message..."
                  />
                </div>

                {status === "error" && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-red-400 text-sm">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-black transition-all hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
