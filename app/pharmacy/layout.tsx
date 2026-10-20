'use client';

import PharmacyShell from './PharmacyShell';

/**
 * ทุกหน้าของห้องยาใช้กรอบเดียวกัน
 *
 * อยู่ที่ layout ไม่ใช่ในแต่ละหน้า แถบข้างจึงไม่ถูกสร้างใหม่ตอนสลับหน้า
 * ตัวเลือกตึกที่รับและสถานะย่อเมนูจึงอยู่คงที่ ไม่รีเซ็ตทุกครั้งที่กดเมนู
 */
export default function PharmacyLayout({ children }: { children: React.ReactNode }) {
    return <PharmacyShell>{children}</PharmacyShell>;
}
