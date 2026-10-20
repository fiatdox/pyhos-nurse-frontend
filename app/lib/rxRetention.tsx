'use client';

import { useEffect, useState } from 'react';
import { Alert, Tag } from 'antd';
import { PiClockCounterClockwiseBold } from 'react-icons/pi';

/**
 * ระยะเวลาจัดเก็บไฟล์ใบสั่งยา
 *
 * ไฟล์ภาพเก่ากว่ากำหนดถูกเซิร์ฟเวอร์ลบออกจากดิสก์ แต่ข้อมูลใบและประวัติยังอยู่
 * หน้าจอต้องบอกผู้ใช้ตรง ๆ ว่าไฟล์ "ลบตามกำหนด" ไม่ใช่ปล่อยให้ขึ้นว่าเปิดไม่สำเร็จ
 * แล้วคนก็โทรแจ้งว่าระบบเสีย หรือคิดว่ามีคนแอบลบไฟล์ผู้ป่วย
 */

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/** จำนวนวันที่เก็บไฟล์ ว่าง = ยังไม่รู้ (ถามไม่สำเร็จ) ข้อความจะไม่ระบุตัวเลข */
export const useRxRetention = (): number | null => {
    const [days, setDays] = useState<number | null>(null);
    useEffect(() => {
        let alive = true;
        fetch('/api/v1/rx/retention', { headers: authHeaders() })
            .then(r => r.json())
            .then(j => { if (alive && Number.isInteger(j?.data?.days)) setDays(j.data.days); })
            .catch(() => { /* ไม่รู้จำนวนวันก็ยังบอกได้ว่าไฟล์ถูกลบ */ });
        return () => { alive = false; };
    }, []);
    return days;
};

const daysText = (days: number | null) => (days ? ` ${days} วัน` : '');

/** แถบบอกเหนือผลค้นหา เมื่อมีใบที่ไฟล์ภาพถูกลบไปแล้วอยู่ในรายการ */
export function PurgedNotice({ days, count }: { days: number | null; count: number }) {
    return (
        <Alert
            type="info"
            showIcon
            icon={<PiClockCounterClockwiseBold />}
            title={`มี ${count} ใบในรายการนี้ที่ไฟล์ภาพถูกลบแล้ว ตามระยะเวลาจัดเก็บไฟล์${daysText(days)}`}
            description="ยังเปิดดูข้อมูลใบ ชื่อผู้ป่วย สถานะ และประวัติการดำเนินการได้ตามเดิม · เฉพาะภาพสแกนที่ไม่มีแล้ว"
        />
    );
}

/** ป้ายสั้นบนแถว/การ์ด */
export function PurgedTag({ className = '' }: { className?: string }) {
    return (
        <Tag className={`m-0! text-[11px]! ${className}`} icon={<PiClockCounterClockwiseBold className="inline -mt-0.5 mr-0.5" />}>
            ไฟล์ถูกลบแล้ว
        </Tag>
    );
}

/** ข้อความในช่องดูไฟล์ เมื่อไฟล์หน้านั้นถูกลบไปแล้ว */
export const purgedMessage = (purgedAt: string | null | undefined, days: number | null | undefined) => {
    const when = purgedAt ? purgedAt.slice(0, 10).split('-') : null;
    const date = when && when.length === 3 ? ` เมื่อ ${Number(when[2])}/${Number(when[1])}/${Number(when[0]) + 543}` : '';
    return `ไฟล์นี้ถูกลบออกจากระบบแล้ว${date} ตามระยะเวลาจัดเก็บไฟล์${daysText(days ?? null)}`;
};
