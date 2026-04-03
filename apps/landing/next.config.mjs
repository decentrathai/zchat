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
}

export default nextConfig