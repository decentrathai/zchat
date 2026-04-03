export function DemoVideo() {
  return (
    <section id="demo-video" className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-balance text-3xl font-bold text-[var(--text-primary)] lg:text-4xl">See ZCHAT in action</h2>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-lg border border-[var(--border-active)] bg-[var(--bg-surface)] p-1 shadow-[0_0_50px_var(--accent-primary-glow)]">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-[var(--bg-base)]">
              <iframe
                className="absolute left-0 top-0 h-full w-full"
                src="https://www.youtube.com/embed/-MzQoHxw-qs"
                title="ZCHAT Demo Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-[var(--text-tertiary)]">
            2-minute demo: sending fully private messages over Zcash mainnet.
          </p>
        </div>
      </div>
    </section>
  )
}
