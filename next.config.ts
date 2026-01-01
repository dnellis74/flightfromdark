import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.projectaon.org",
      },
    ],
  },
};

export default nextConfig;
