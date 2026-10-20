'use client';

import type { Dayjs } from 'dayjs';

/**
 * ช่วงเวลาตามเวรของโรงพยาบาล
 *
 * ให้ตรงกับการแบ่งเวรจริง จะได้เลือก "เวรที่แล้ว" ได้ในคลิกเดียว
 * ไม่ต้องมานั่งคิดว่าเวรบ่ายคือกี่โมงถึงกี่โมง
 *
 * อยู่ในไฟล์กลางเพราะทั้งหน้าหอผู้ป่วยและหน้าห้องยาต้องแบ่งเวรเหมือนกัน
 * ถ้าแยกกันเขียน วันหนึ่งสองหน้าจะนับเวรไม่ตรงกันแล้วเถียงกันว่าใบหายไปไหน
 */
export const SHIFTS = {
    'ทั้งวัน': null,
    'เช้า 08-16': ['08:00', '16:00'],
    'บ่าย 16-24': ['16:00', '24:00'],
    'ดึก 00-08': ['00:00', '08:00'],
    'กำหนดเอง': null,
} as const;

export type ShiftKey = keyof typeof SHIFTS;

export interface TimeRange { from: string; to: string }

/**
 * ขอบเวลาที่ส่งให้เซิร์ฟเวอร์
 * เป็นเวลาหน้าปัดตรง ๆ ไม่แปลงเขตเวลา ให้ตรงกับที่ฐานข้อมูลเก็บไว้
 * คืน null เมื่อเลือก "กำหนดเอง" แต่ยังไม่ได้ระบุช่วง = ยังไม่ต้องกรอง
 */
export const shiftRange = (
    date: Dayjs,
    shift: ShiftKey,
    custom?: [Dayjs, Dayjs] | null,
): TimeRange | null => {
    const d = date.format('YYYY-MM-DD');
    const nextDay = date.add(1, 'day').format('YYYY-MM-DD');

    if (shift === 'กำหนดเอง') {
        if (!custom) return null;
        return { from: `${d} ${custom[0].format('HH:mm')}`, to: `${d} ${custom[1].format('HH:mm')}` };
    }

    const preset = SHIFTS[shift];
    if (!preset) return { from: `${d} 00:00`, to: `${nextDay} 00:00` };

    /* 24:00 ไม่มีจริงบนหน้าปัด ต้องเขียนเป็นเที่ยงคืนของวันถัดไป */
    const to = preset[1] === '24:00' ? `${nextDay} 00:00` : `${d} ${preset[1]}`;
    return { from: `${d} ${preset[0]}`, to };
};
