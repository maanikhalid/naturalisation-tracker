import type { NextConfig } from "next";

const cspHeader = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
  "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com",
].join("; ");

const nextConfig: NextConfig = {
  // Plesk hooks set PLESK_SKIP_TYPESCRIPT=1; shared hosting often hangs on `next build` typecheck.
  // Run `npx tsc --noEmit` locally or in CI before release.
  typescript: {
    ignoreBuildErrors: process.env.PLESK_SKIP_TYPESCRIPT === "1",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
