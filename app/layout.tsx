import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

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
    <html lang="en">
      <body
        className={`${sarabun.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
