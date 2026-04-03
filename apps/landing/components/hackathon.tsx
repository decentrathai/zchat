import { Button } from "@/components/ui/button"
import { Award, Trophy, ExternalLink } from "lucide-react"

export function Hackathon() {
  return (
    <section className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-lg border border-[var(--color-warning)]/50 bg-gradient-to-br from-[var(--color-warning)]/10 to-[var(--accent-secondary)]/5 p-8 lg:p-12">
          <div className="mb-6 flex items-center gap-3">
            <Trophy className="h-8 w-8 text-[var(--color-warning)]" />
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--text-primary)] lg:text-3xl">Zypherpunk Hackathon 2025</h2>
            <Award className="h-6 w-6 text-[var(--color-warning)]" />
          </div>

          <p className="mb-6 leading-relaxed text-[var(--text-secondary)]">
            ZChat received a prize at the <span className="font-semibold text-[var(--color-warning)]">Zypherpunk Hackathon 2025</span> in the Zcash-related projects track ($600), demonstrating that truly private messaging built on Zcash shielded transactions is viable.
          </p>

          <p className="mb-8 leading-relaxed text-[var(--text-secondary)]">
            Our focus is making privacy-first communication as simple as any normal messenger. No phone number, no email, no account required — just pure private messaging powered by zero-knowledge cryptography.
          </p>

          <div className="flex flex-wrap gap-4">
            <Button
              asChild
              variant="outline"
              className="rounded-lg border-[var(--color-warning)]/50 bg-[var(--color-warning)]/10 text-[var(--color-warning)] transition-all hover:border-[var(--color-warning)] hover:bg-[var(--color-warning)]/20"
            >
              <a href="https://forum.zcashcommunity.com/t/zypherpunk-hackathon-winners/53985" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                See Official Results
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-lg border-[var(--accent-secondary)]/50 bg-[var(--accent-secondary)]/10 text-[var(--accent-secondary)] transition-all hover:border-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)]/20"
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
