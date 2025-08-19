// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // ✅ Do not fail the production build on ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Optional: if you also have TS type errors you want to bypass during build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;