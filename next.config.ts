import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // History import uploads a Booking.com reservation export (Vercel caps bodies at 4.5 MB).
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
