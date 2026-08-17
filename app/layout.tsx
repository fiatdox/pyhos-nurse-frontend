import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ThemeProvider, themeInitScript } from "./lib/theme";

const sarabun = Sarabun({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ["thai"],
  variable: "--font-sarabun",
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: "PYHOS x Nurse | Phayao Hospital Nurse System",
  description: "A nurse management system for Phayao Hospital.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ต้องรันก่อนหน้าถูกวาด ไม่งั้นโหมดมืดจะเห็นหน้าสว่างวาบทุกครั้งที่โหลด
            คลาส .dark ถูกใส่จากสคริปต์นี้ HTML จึงต่างจากที่เซิร์ฟเวอร์ส่งมา
            เลยต้อง suppressHydrationWarning ที่ <html> */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${sarabun.variable} antialiased`}
      >
        {/* antd สร้าง CSS ตอนรันด้วย CSS-in-JS ถ้าไม่เก็บสไตล์ที่สร้างฝั่งเซิร์ฟเวอร์
            ใส่ลงใน HTML ที่ส่งไป เบราว์เซอร์จะคำนวณคลาสได้ไม่ตรงกับที่เซิร์ฟเวอร์วาด
            แล้วขึ้น hydration mismatch — AntdRegistry ทำหน้าที่เก็บและแทรกให้ */}
        <AntdRegistry>
          <ThemeProvider>{children}</ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
