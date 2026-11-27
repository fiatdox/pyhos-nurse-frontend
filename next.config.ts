import type { NextConfig } from "next";

const nextConfig: NextConfig & { allowedDevOrigins?: string[] } = {
  allowedDevOrigins: ["192.168.1.53", "localhost"],
  experimental: {
    /*
      มี proxy.ts อยู่ Next จึงพักตัวคำขอไว้ก่อนส่งต่อ และตัดที่ 10MB (ค่าเริ่มต้น) แม้ /api จะไม่ผ่าน proxy ก็ตาม
      ใบสั่งยาแนบสแกนได้ 10 ไฟล์ ไฟล์ละไม่เกิน 20MB (rxOrderController ฝั่ง backend)
      ถ้าเกิน 10MB ตัวคำขอถูกตัดครึ่งทาง backend อ่านไม่ครบ → socket hang up
      ตั้งให้พอกับเพดานของ backend (10 × 20MB + ส่วนหัว multipart)
    */
    proxyClientMaxBodySize: "210mb",
  },
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
