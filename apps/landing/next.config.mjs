// Static-export build (for Cloudflare Pages) is gated behind NEXT_STATIC_EXPORT=1.
// The app has no server-side features (no app/api routes, server actions, or middleware),
// so `output: 'export'` produces a pure-static `out/` that Pages serves directly; the /api
// calls are handled in production by the Cloudflare Pages Function (functions/api/[[path]].js)
// proxying to api.zsend.xyz. In dev (no env var) we keep the rewrites so `pnpm dev` proxies
// /api to the local backend on :4000 — `rewrites` is incompatible with `output: 'export'`,
// so the two are mutually exclusive.
const isStaticExport = process.env.NEXT_STATIC_EXPORT === '1'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Disable trailing slashes for cleaner URLs
  trailingSlash: false,
  // Hide the dev indicator in development mode
  devIndicators: false,
  // Allow dev requests from Cloudflare tunnel domains
  allowedDevOrigins: ['zsend.xyz', 'zchat.sh'],
  ...(isStaticExport
    ? { output: 'export' }
    : {
        // Proxy API calls through same origin to avoid cross-domain issues
        // (Cloudflare challenge pages, CORS, ad blockers)
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: 'http://localhost:4000/:path*',
            },
          ]
        },
      }),
}

export default nextConfig