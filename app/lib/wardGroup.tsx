'use client';

import { Alert } from 'antd';

/**
 * หอที่นับภาระงานรวมเป็นหน่วยเดียวกัน (ward.fte_group) — รูปร่างที่ API ส่งมาในช่อง group
 *
 * เช่น NICU กับ Nursery ใช้พยาบาลทีมเดียวกัน แค่แยกห้องตามระดับอาการ
 * FTE / product / dashboard จึงคิดรวมทั้งหน่วย และจัดตารางเวรที่หอหลักที่เดียว
 */
export interface WardGroupInfo {
    primary_code: string;
    primary_name: string;
    /** เช่น "Nursery + NICU" */
    label: string;
    members: { his_code: string; ward_name: string }[];
    combined: boolean;
}

/**
 * แถบบอกว่าตัวเลขในหน้านี้รวมหอไหนบ้าง
 *
 * ต้องบอกให้ชัด ไม่งั้นคนที่เลือก NICU แล้วเห็นยอดผู้ป่วยมากกว่าที่อยู่ในห้องจริง
 * จะคิดว่าระบบนับผิด แสดงเฉพาะหน่วยที่รวมหลายหอ หอปกติไม่เห็นแถบนี้
 */
export function WardGroupNote({ group, what = 'ตัวเลขในหน้านี้', detail, className = 'mb-4' }: {
    group?: WardGroupInfo | null;
    what?: string;
    /** แทนคำอธิบายมาตรฐาน เมื่อหน้านั้นไม่เกี่ยวกับค่าน้ำหนักผู้ป่วย */
    detail?: string;
    className?: string;
}) {
    if (!group?.combined) return null;
    return (
        <Alert
            type="info"
            showIcon
            className={className}
            title={`${what}คิดรวม ${group.label} เป็นหน่วยเดียวกัน`}
            description={detail ?? `ใช้พยาบาลทีมเดียวกัน จัดตารางเวรที่ ${group.primary_name} · ค่าน้ำหนักผู้ป่วยใช้ของ ${group.primary_name}`}
        />
    );
}
