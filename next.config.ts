import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.83"],
  experimental: {
    proxyClientMaxBodySize: "25mb",
  },
  reactStrictMode: true,
};

export default nextConfig;
