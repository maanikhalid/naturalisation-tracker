import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plesk hooks set PLESK_SKIP_TYPESCRIPT=1; shared hosting often hangs on `next build` typecheck.
  // Run `npx tsc --noEmit` locally or in CI before release.
  typescript: {
    ignoreBuildErrors: process.env.PLESK_SKIP_TYPESCRIPT === "1",
  },
};

export default nextConfig;
