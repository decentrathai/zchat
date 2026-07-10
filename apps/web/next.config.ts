import type { NextConfig } from "next";

// Content-Security-Policy + hardening headers (previously the app shipped with NONE).
// Notes:
//  - 'wasm-unsafe-eval' is required to instantiate the Rust wallet-core WASM.
//  - 'unsafe-inline' is unavoidable for Next's app-router inline hydration scripts/styles without
//    a nonce middleware; the strict directives below (object/base/frame/form) still close the
//    high-value clickjacking + base-hijack + plugin + foreign-script-origin vectors.
//  - connect-src is pinned to self + the backend API so exfiltration to arbitrary origins is blocked.
//    It is DERIVED from NEXT_PUBLIC_BACKEND_URL (the same var apps/web/src/lib/api.ts uses, default
//    http://localhost:4000) so dev/non-prod backends aren't blocked, while the prod API stays allowed.
//    Hard-pinning it to only https://api.zsend.xyz previously broke login/wallet calls in every
//    non-prod environment.
const backendOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
})();
const connectSrc = Array.from(
  new Set(["'self'", 'https://api.zsend.xyz', backendOrigin]),
).join(' ');

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Handle WASM files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    
    // Don't try to bundle files from public folder
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };

    return config;
  },
};

export default nextConfig;

