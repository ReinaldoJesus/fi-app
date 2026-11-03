import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.29.37.134", "localhost"],
  serverExternalPackages: ["@neondatabase/serverless", "@prisma/adapter-neon"],
};

export default nextConfig;
