import { Button } from "@/components/ui/button"
import { Award } from "lucide-react"

export function Hackathon() {
  return (
    <section className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-magenta-500/30 bg-gradient-to-br from-magenta-500/10 to-cyan-500/5 p-8 backdrop-blur-sm lg:p-12">
          <div className="mb-6 flex items-center gap-3">
            <Award className="h-8 w-8 text-magenta-400" />
            <h2 className="text-2xl font-bold text-white lg:text-3xl">Built for the Zephyrpunk Hackathon</h2>
          </div>

          <p className="mb-8 leading-relaxed text-gray-300">
            Zcash Chat is a hackathon project proving that chat can be truly private by using ZEC shielded memos and a
            self-hosted stack. The backend runs a synced node and lightwalletd, while the current focus is making the UX
            as simple as a normal messenger. This demonstrates that privacy-first communication doesn't have to
            compromise on usability.
          </p>

          <Button
            asChild
            variant="outline"
            className="border-magenta-500/50 bg-magenta-500/10 text-magenta-300 transition-all hover:border-magenta-500 hover:bg-magenta-500/20 hover:text-magenta-200"
          >
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              View source on GitHub
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
