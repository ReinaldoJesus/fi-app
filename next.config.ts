import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.29.37.134", "localhost", "192.168.1.89", "100.68.8.108", "*.local"],
  serverExternalPackages: ["@neondatabase/serverless", "@prisma/adapter-neon"],
};

export default nextConfig;
