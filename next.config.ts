import type { NextConfig } from "next";

const nextConfig: NextConfig & { allowedDevOrigins?: string[] } = {
  allowedDevOrigins: ["192.168.1.53", "localhost"],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        // URL ของ backend มาจาก NEXT_PUBLIC_API_URL ใน .env ไม่ตั้ง = API บนเครื่องเดียวกันพอร์ต 4001
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4001"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
