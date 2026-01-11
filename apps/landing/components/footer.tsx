export function Footer() {
  return (
    <footer className="border-t border-cyan-500/20 bg-[#050510] py-12">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="text-sm text-gray-400">© 2026 ZCHAT (zsend.xyz)</div>

          <div className="text-center text-sm text-gray-500">
            Experimental software. Not audited. Use at your own risk.
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/decentrathai/zchat"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 transition-colors hover:text-cyan-400"
            >
              GitHub
            </a>
            <a
              href="https://t.me/Antrbit"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 transition-colors hover:text-cyan-400"
            >
              Telegram
            </a>
            <a
              href="https://x.com/zchat_app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 transition-colors hover:text-cyan-400"
            >
              X
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
