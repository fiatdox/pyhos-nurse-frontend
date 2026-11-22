'use client';

/**
 * เหตุผลที่ส่งกลับ: "[กลุ่ม] ข้อความ" · ชื่อกลุ่มมากับรายการจากเซิร์ฟเวอร์ (reject_category_label)
 * ไม่ได้พิมพ์เพิ่ม ข้อความที่เก็บคือชื่อกลุ่มเอง จึงแสดงครั้งเดียว · ใบเก่าไม่มีกลุ่ม แสดงข้อความอย่างเดียว
 */
export default function RxRejectReason({ label, reason }: { label?: string | null; reason?: string | null }) {
    const text = reason?.trim() || '';
    if (!label) return <>{text || 'ไม่ระบุ'}</>;
    return (
        <>
            <span className="font-semibold">[{label}]</span>
            {text && text !== label ? <> {text}</> : null}
        </>
    );
}
