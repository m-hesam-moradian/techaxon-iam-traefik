import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    if (!process.env.IAM_INTERNAL_URL) {
      return [];
    }

    return [
      {
        source: "/iam/:path*",
        destination: `${process.env.IAM_INTERNAL_URL}/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${process.env.IAM_INTERNAL_URL}/auth/:path*`,
      },
    ];
  },
  /* config options here */
};

export default nextConfig;
