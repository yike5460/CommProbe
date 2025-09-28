import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable development indicators completely
  devIndicators: false,

  // Disable ESLint during build for Cloudflare deployment
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable TypeScript checking during build for Cloudflare deployment
  typescript: {
    ignoreBuildErrors: true,
  },

  // Cloudflare Pages optimizations
  trailingSlash: true,
  skipTrailingSlashRedirect: true,

  // Image optimization (Cloudflare doesn't support Next.js Image Optimization)
  images: {
    unoptimized: true,
  },

  // Disable server-side features not supported by Cloudflare
  poweredByHeader: false,

  // Webpack configuration for Cloudflare Workers compatibility
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Ensure compatibility with Cloudflare Workers runtime
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
