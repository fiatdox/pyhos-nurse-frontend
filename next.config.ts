import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        // เปลี่ยน http://127.0.0.1:8080 เป็น URL Backend ของคุณ (ถ้ามีใน env ก็จะใช้ค่าจาก env)
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
