import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
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
};

export default nextConfig;
