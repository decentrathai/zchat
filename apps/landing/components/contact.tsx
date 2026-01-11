import { MessageCircle, Github } from "lucide-react"
import { SiX } from "@icons-pack/react-simple-icons"

export function Contact() {
  return (
    <section id="contact" className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-balance text-3xl font-bold text-white lg:text-4xl">Get in touch</h2>
          <p className="mx-auto max-w-2xl text-pretty text-lg text-gray-300">Questions? Feedback? Let&apos;s connect.</p>
        </div>

        <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-3">
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
      </div>
    </section>
  )
}
