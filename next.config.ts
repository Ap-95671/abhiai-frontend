import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker copies Next.js' standalone server, while Vercel produces and
  // deploys its own server output during the platform build.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
