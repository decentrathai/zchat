export function DemoVideo() {
  return (
    <section id="demo-video" className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-balance text-3xl font-bold text-white lg:text-4xl">See ZCHAT in action</h2>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-magenta-500/10 p-1 shadow-[0_0_50px_rgba(34,211,238,0.2)]">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-900">
              <iframe
                className="absolute left-0 top-0 h-full w-full"
                src="https://www.youtube.com/embed/-MzQoHxw-qs"
                title="ZCHAT Demo Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-400">
            2-minute demo: sending fully private messages over Zcash mainnet.
          </p>
        </div>
      </div>
    </section>
  )
}
