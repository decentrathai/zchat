"use client"

export function CypherpunkManifesto() {
  return (
    <section className="relative py-16 lg:py-24">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="relative mx-auto max-w-4xl text-center">
          {/* Subtle glow effect */}
          <div className="absolute left-1/2 top-1/2 h-[200px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/5 blur-[80px]" />

          <div className="relative">
            {/* Quote icon */}
            <div className="mb-6 text-4xl text-cyan-500/60">&ldquo;</div>

            {/* Quote text */}
            <blockquote className="mb-6 text-pretty text-lg italic text-gray-300 lg:text-xl">
              Privacy is necessary for an open society in the electronic age... We cannot expect governments, corporations, or other large, faceless organizations to grant us privacy out of their beneficence... We must defend our own privacy if we expect to have any... Cypherpunks write code.
            </blockquote>

            {/* Attribution */}
            <cite className="block text-sm font-medium text-cyan-400/80">
              &mdash; A Cypherpunk&apos;s Manifesto
            </cite>
          </div>
        </div>
      </div>
    </section>
  )
}
