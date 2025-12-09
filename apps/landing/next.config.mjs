/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Enable static export for self-hosting
  output: 'export',
  // Disable trailing slashes for cleaner URLs
  trailingSlash: false,
}

export default nextConfig