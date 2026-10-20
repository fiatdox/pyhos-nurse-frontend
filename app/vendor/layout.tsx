'use client';

import { usePathname } from 'next/navigation';
import VendorShell from './VendorShell';

/**
 * กรอบของทุกหน้าในส่วนของบริษัท
 *
 * เดิมแต่ละหน้าห่อ VendorShell เอง ซึ่งแปลว่าเมนูข้างถูกสร้างใหม่ทุกครั้งที่กดสลับหน้า
 * อ่าน sessionStorage ใหม่ทุกครั้ง และสถานะย่อเมนูหายทุกครั้ง
 * ย้ายมาไว้ที่ layout กรอบจึงอยู่คงที่ เปลี่ยนเฉพาะเนื้อหาข้างใน
 *
 * ยกเว้นหน้าเข้าระบบ เพราะตอนนั้นยังไม่มีตัวตนให้แสดงบนเมนู
 * และ VendorShell จะเด้งกลับมาหน้านี้เอง กลายเป็นวนไม่จบ
 */
export default function VendorLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    if (pathname === '/vendor/login') return <>{children}</>;

    return <VendorShell>{children}</VendorShell>;
}
