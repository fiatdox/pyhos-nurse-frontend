'use client';

import { useEffect, useState, type MouseEvent as RMouseEvent, type ReactNode } from 'react';
import dayjs from 'dayjs';
import { Button, Popconfirm, Tag, Tooltip } from 'antd';
import { PiClockBold, PiHandGrabbingBold } from 'react-icons/pi';

/**
 * รอบรับยา: ห้องยากำหนดช่วงเวลา 1 ชั่วโมงให้ตึกมารับ ตอนกด "จัดยาเสร็จ"
 * ค่าที่รับส่งกับเซิร์ฟเวอร์เป็นเวลาท้องถิ่น 'YYYY-MM-DD HH:mm' (เหมือนเวลาอื่นของใบสั่งยา)
 */

export const SLOT_FORMAT = 'YYYY-MM-DD HH:00';

/** จำนวนรอบที่ให้เลือก (รอบละ 1 ชม.) */
export const PICKUP_SLOT_COUNT = 23;

/** รอบย้อนหลังที่แสดงให้เลือก เมื่อใบส่งมานานจนรอบนับจากเวลาส่งผ่านไปหมดแล้ว */
const PAST_SLOTS_FOR_OLD_ORDER = 11;

/**
 * รอบรับยา 23 รอบ เริ่มจากชั่วโมงที่หอส่งใบมา
 * รอบที่ผ่านไปแล้วยังเลือกได้ (past = true แสดงจาง) — ห้องยาจัดเสร็จแล้วลืมกด กลับมากดทีหลังต้องบันทึกรอบจริงได้
 * เซิร์ฟเวอร์รับตั้งแต่ชั่วโมงที่หอส่งใบ ถึง 24 ชม. ข้างหน้า
 * ใบที่ส่งมานานจนทุกรอบผ่านไปหมด เริ่มที่ 11 ชม. ก่อนตอนนี้ (ไม่ก่อนเวลาส่ง) จะได้มีทั้งรอบย้อนหลังและรอบข้างหน้า
 */
export const pickupSlotOptions = (submittedAt?: string | null) => {
    const now = dayjs().startOf('hour');
    const sub = submittedAt ? dayjs(submittedAt).startOf('hour') : null;
    let start = sub && sub.isValid() && !sub.isAfter(now) ? sub : now;
    if (start.add(PICKUP_SLOT_COUNT - 1, 'hour').isBefore(now)) {
        const back = now.subtract(PAST_SLOTS_FOR_OLD_ORDER, 'hour');
        start = sub && sub.isAfter(back) ? sub : back;
    }
    return Array.from({ length: PICKUP_SLOT_COUNT }, (_, i) => {
        const from = start.add(i, 'hour');
        return {
            value: from.format(SLOT_FORMAT),
            label: slotRange(from.format('YYYY-MM-DD HH:mm')),
            past: from.isBefore(now),
        };
    });
};

/** ค่าเริ่มต้น = รอบชั่วโมงถัดไป (เวลาเดินไปห้องยาได้ทัน) ถ้าไม่อยู่ในรายการ ใช้รอบแรกที่ยังไม่ผ่าน */
export const defaultPickupSlot = (submittedAt?: string | null) => {
    const opts = pickupSlotOptions(submittedAt);
    const next = dayjs().startOf('hour').add(1, 'hour').format(SLOT_FORMAT);
    return opts.find(o => o.value === next)?.value ?? opts.find(o => !o.past)?.value ?? opts[0]?.value ?? '';
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

/**
 * ถึงรอบรับยาแล้วหรือยัง · ไม่มีรอบ = รับได้ทันที
 * ตั้งเวลาปลุกตอนรอบเริ่ม ปุ่มจะเปิดเองโดยไม่ต้องรีเฟรชหน้า (เซิร์ฟเวอร์ตรวจซ้ำอีกชั้น)
 */
export const usePickupOpen = (from?: string | null) => {
    const [now, setNow] = useState(() => Date.now());
    const start = from ? dayjs(from).valueOf() : null;
    useEffect(() => {
        if (start === null || now >= start) return;
        /* setTimeout รับได้ไม่เกิน ~24.8 วัน · รอบอยู่ภายใน 24 ชม. อยู่แล้ว เผื่อไว้ */
        const t = setTimeout(() => setNow(Date.now()), Math.min(start - now + 500, 2_000_000_000));
        return () => clearTimeout(t);
    }, [start, now]);
    return start === null || now >= start;
};

/**
 * ปุ่มบันทึกว่าตึกรับยาไปแล้ว ใช้ทั้งหน้าหอและหน้าห้องยา
 * ก่อนถึงรอบกดไม่ได้ (บอกเวลาที่จะกดได้) · ถึงรอบแล้วถามยืนยันก่อน เพราะกดแล้วใบออกจากคิวทั้งสองฝั่ง
 */
export function PickupButton({ from, to, onConfirm, loading, label = 'รับยาแล้ว', confirmTitle = 'ยืนยันว่ารับยาของใบนี้แล้ว?',
    beforeHint = '', size, type = 'primary', block, className, icon }: {
    from?: string | null; to?: string | null; onConfirm: () => void | Promise<unknown>; loading?: boolean;
    label?: ReactNode; confirmTitle?: ReactNode; beforeHint?: string;
    size?: 'small' | 'middle' | 'large'; type?: 'primary' | 'default'; block?: boolean; className?: string; icon?: ReactNode;
}) {
    const open = usePickupOpen(from);
    const stop = (e?: RMouseEvent) => e?.stopPropagation();
    const btnIcon = icon ?? <PiHandGrabbingBold />;
    if (!open && from) {
        return (
            <Tooltip title={`กดได้ตั้งแต่ ${slotRange(from, to).replace(/–.*/, '')} น.${beforeHint ? ` · ${beforeHint}` : ''}`}>
                {/* span ครอบเพราะปุ่มที่ disabled ไม่ส่ง event ให้ Tooltip */}
                <span onClick={stop} className={block ? 'block' : 'inline-block'}>
                    <Button size={size} block={block} className={className} icon={<PiClockBold />} disabled>
                        รอถึงรอบ {dayjs(from).format('HH:mm')}
                    </Button>
                </span>
            </Tooltip>
        );
    }
    return (
        <Popconfirm title={confirmTitle} description="ใบจะออกจากคิวของห้องยาและของหอ" okText="รับแล้ว" cancelText="ยกเลิก"
            onConfirm={e => { stop(e as RMouseEvent | undefined); return onConfirm(); }}
            onCancel={e => stop(e as RMouseEvent | undefined)}>
            <Button size={size} type={type} block={block} className={className} icon={btnIcon} loading={loading} onClick={stop}>
                {label}
            </Button>
        </Popconfirm>
    );
}
