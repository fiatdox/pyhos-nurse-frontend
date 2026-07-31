'use client';

import { StyleProvider } from '@ant-design/cssinjs';

/**
 * ห่อ CSS ที่ antd ฉีดเข้ามาไว้ใน `@layer antd`
 * ลำดับ layer กำหนดไว้ที่ app/globals.css โดยให้ antd มาก่อน utilities ของ Tailwind
 * เพื่อให้ className ที่เขียนกำกับไว้ที่ element (เช่น text-white) ชนะสไตล์ global ของ antd
 */
export default function AntdStyleProvider({ children }: { children: React.ReactNode }) {
  return <StyleProvider layer>{children}</StyleProvider>;
}
