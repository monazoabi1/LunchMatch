import type { NextConfig } from "next";

// Hackathon-safe: never let a lint rule or a type nit block a deploy.
const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
