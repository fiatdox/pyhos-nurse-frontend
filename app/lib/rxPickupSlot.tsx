'use client';

import dayjs from 'dayjs';
import { Tag, Tooltip } from 'antd';
import { PiClockBold } from 'react-icons/pi';

/**
 * รอบรับยา: ห้องยากำหนดช่วงเวลา 1 ชั่วโมงให้ตึกมารับ ตอนกด "จัดยาเสร็จ"
 * ค่าที่รับส่งกับเซิร์ฟเวอร์เป็นเวลาท้องถิ่น 'YYYY-MM-DD HH:mm' (เหมือนเวลาอื่นของใบสั่งยา)
 */

export const SLOT_FORMAT = 'YYYY-MM-DD HH:00';

/** จำนวนรอบที่ให้เลือก (รอบละ 1 ชม.) */
export const PICKUP_SLOT_COUNT = 23;

/**
 * รอบรับยา 23 รอบ เริ่มจากชั่วโมงที่หอส่งใบมา
 * รอบที่ผ่านไปแล้ว (ก่อนชั่วโมงนี้) แสดงแต่เลือกไม่ได้ · เซิร์ฟเวอร์รับตั้งแต่ชั่วโมงนี้ถึง 24 ชม. ข้างหน้า
 * ใบที่ส่งมานานจนทุกรอบผ่านไปหมดแล้ว เริ่มนับจากชั่วโมงนี้แทน จะได้มีรอบให้เลือกเสมอ
 */
export const pickupSlotOptions = (submittedAt?: string | null) => {
    const now = dayjs().startOf('hour');
    let start = submittedAt ? dayjs(submittedAt).startOf('hour') : now;
    if (!start.isValid() || start.isAfter(now) || start.add(PICKUP_SLOT_COUNT - 1, 'hour').isBefore(now)) start = now;
    return Array.from({ length: PICKUP_SLOT_COUNT }, (_, i) => {
        const from = start.add(i, 'hour');
        return {
            value: from.format(SLOT_FORMAT),
            label: slotRange(from.format('YYYY-MM-DD HH:mm')),
            disabled: from.isBefore(now),
        };
    });
};

/** ค่าเริ่มต้น = รอบชั่วโมงถัดไป (เวลาเดินไปห้องยาได้ทัน) ถ้าไม่อยู่ในรายการ ใช้รอบแรกที่เลือกได้ */
export const defaultPickupSlot = (submittedAt?: string | null) => {
    const opts = pickupSlotOptions(submittedAt);
    const next = dayjs().startOf('hour').add(1, 'hour').format(SLOT_FORMAT);
    return opts.find(o => o.value === next && !o.disabled)?.value ?? opts.find(o => !o.disabled)?.value ?? '';
};

/** "11:00–12:00" · ถ้าไม่ใช่วันนี้ใส่ "พรุ่งนี้" หรือวันที่นำหน้า */
export const slotRange = (from: string, to?: string | null) => {
    const f = dayjs(from);
    const t = to ? dayjs(to) : f.add(1, 'hour');
    const today = dayjs().startOf('day');
    const day = f.isSame(today, 'day') ? ''
        : f.isSame(today.add(1, 'day'), 'day') ? 'พรุ่งนี้ '
            : `${f.format('D MMM')} `;
    return `${day}${f.format('HH:mm')}–${t.format('HH:mm')}`;
};

/** ป้ายรอบรับยา · เลยเวลาแล้วยังไม่มารับ = สีส้ม */
export function PickupSlotTag({ from, to, className = '' }: { from?: string | null; to?: string | null; className?: string }) {
    if (!from) return null;
    const late = to ? dayjs().isAfter(dayjs(to)) : false;
    return (
        <Tooltip title={late ? 'เลยรอบรับยาแล้ว ตึกยังไม่มารับ' : 'รอบที่ให้ตึกมารับยา'}>
            <Tag color={late ? 'orange' : 'green'} className={`m-0! inline-flex! items-center gap-1 tabular-nums ${className}`}>
                <PiClockBold /> รับยา {slotRange(from, to)}
            </Tag>
        </Tooltip>
    );
}
