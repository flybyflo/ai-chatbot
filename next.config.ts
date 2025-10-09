import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cacheComponents: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.blob.core.windows.net",
        port: "",
        pathname: "/**",
      },
    ],
  },
  webpack: (config) => {
    // Exclude a2a-samples from webpack compilation
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        ...(Array.isArray(config.watchOptions?.ignored)
          ? config.watchOptions.ignored
          : []),
        "**/a2a-samples/**",
      ],
    };
    return config;
  },
};

export default nextConfig;
