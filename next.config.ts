import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Environment variables that should be available at runtime
  env: {
    PORT: process.env.PORT || '3000',
  },
};

export default nextConfig;