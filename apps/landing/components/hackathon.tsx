import { Button } from "@/components/ui/button"
import { Award, Trophy, ExternalLink } from "lucide-react"

export function Hackathon() {
  return (
    <section className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-yellow-500/50 bg-gradient-to-br from-yellow-500/20 to-magenta-500/10 p-8 backdrop-blur-sm lg:p-12">
          <div className="mb-6 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-400" />
            <h2 className="text-2xl font-bold text-white lg:text-3xl">Zypherpunk Hackathon Winner</h2>
            <Award className="h-6 w-6 text-yellow-400" />
          </div>

          <p className="mb-6 leading-relaxed text-gray-300">
            ZCHAT won the <span className="font-semibold text-yellow-400">Zypherpunk Hackathon</span> in the "Zcash Related Projects" category, proving that truly private messaging is possible. Built on ZEC shielded memos, ZCHAT delivers end-to-end encrypted communication where messages live on the blockchain — no servers, no sign-up, no compromise.
          </p>

          <p className="mb-8 leading-relaxed text-gray-300">
            Our focus is making privacy-first communication as simple as any normal messenger. No phone number, no email, no account required — just pure private messaging powered by zero-knowledge cryptography.
          </p>

          <div className="flex flex-wrap gap-4">
            <Button
              asChild
              variant="outline"
              className="border-yellow-500/50 bg-yellow-500/10 text-yellow-300 transition-all hover:border-yellow-500 hover:bg-yellow-500/20 hover:text-yellow-200"
            >
              <a href="https://forum.zcashcommunity.com/t/zypherpunk-hackathon-winners/53985" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                See Official Results
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-magenta-500/50 bg-magenta-500/10 text-magenta-300 transition-all hover:border-magenta-500 hover:bg-magenta-500/20 hover:text-magenta-200"
            >
              <a href="https://github.com/decentrathai/zchat" target="_blank" rel="noopener noreferrer">
                View source on GitHub
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
