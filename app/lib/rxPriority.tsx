/**
 * ความเร่งด่วนของใบสั่งยา
 *
 * "ยากลับบ้าน" แยกจาก STAT เพราะเป็นคนละเรื่องกัน
 * STAT คือเรื่องฉุกเฉินทางคลินิก ส่วนยากลับบ้านคือมีคนนั่งรออยู่ที่หอ
 * ถ้าเอามารวมกัน เสียงเตือนฉุกเฉินจะดังทั้งวันจนไม่มีใครสนใจตอนที่ฉุกเฉินจริง
 *
 * อยู่ในไฟล์กลางเพราะมีสามที่ที่ต้องเห็นตรงกัน: แถบข้างของห้องยา คิวใบสั่งยา และหน้าหอผู้ป่วย
 * ถ้าแต่ละหน้าถือสีของตัวเอง วันที่แก้สีจะมีหน้าหนึ่งถูกลืมเสมอ แล้วสีเดียวกันจะแปลคนละอย่าง
 */

import type React from 'react';
import { PiCheckCircleBold, PiHouseLineBold, PiLightningBold } from 'react-icons/pi';

export type RxPriority = 'routine' | 'discharge' | 'stat';

/*
  ไล่โทนแบบสัญญาณไฟ แดง → ส้ม → เขียว อ่านได้โดยไม่ต้องเรียน
  ของเดิมใบปกติเป็นเทาอ่อน ซึ่งกลืนกับเส้นขอบจนดูเหมือนไม่มีแถบสีเลย
  เขียวบอกว่า "ใบนี้ไม่มีอะไรต้องรีบ" ซึ่งเป็นข้อมูล ไม่ใช่ความว่างเปล่า

  ค่าสีเหล่านี้ใช้กับจุดวงกลมและแถบขอบ ไม่ใช่กับตัวหนังสือ
  #52c41a เป็นตัวหนังสือบนพื้นขาวได้ความต่างแค่ 2.6:1 อ่านไม่ออก
  ป้ายชื่อระดับจึงใช้สีตัวหนังสือปกติ แล้วให้รูปทรงเป็นตัวแบกสี
*/
export const PRIORITY: Record<RxPriority, { label: string; color: string; short: string; dot: string }> = {
    stat: { label: 'ด่วนที่สุด', color: 'red', short: 'STAT', dot: '#f5222d' },
    discharge: { label: 'ยากลับบ้าน', color: 'orange', short: 'กลับบ้าน', dot: '#fa8c16' },
    routine: { label: 'ปกติ', color: 'green', short: 'ปกติ', dot: '#52c41a' },
};

/** ลำดับที่ใช้แสดงผล เรียงจากด่วนที่สุดลงมา ให้ตรงกับลำดับในคิว */
export const PRIORITY_ORDER: RxPriority[] = ['stat', 'discharge', 'routine'];

/**
 * จุดวงกลมบอกระดับความเร่งด่วน
 * ใช้สีเดียวกันทั้งตัวกรองและแถบข้างแถว คนจะได้โยงสีกับความหมายได้โดยไม่ต้องอ่าน
 * ไม่ใช้สีอย่างเดียว มีตัวหนังสือกำกับเสมอ เพราะคนตาบอดสีแดง-เขียวมีราว 1 ใน 12 ของผู้ชาย
 */
export const PriorityDot = ({ color }: { color: string }) => (
    <span
        className="inline-block size-2.5 rounded-full shrink-0 ring-1 ring-black/10"
        style={{ backgroundColor: color }}
    />
);

/*
  ปุ่มเลือกความเร่งด่วน (หน้าส่งใบ และแผงแก้ประเภทส่งใหม่) ใช้ร่วมกันให้สี/ไอคอนตรงกันทุกที่
  สีตามสัญญาณไฟเดียวกับ PRIORITY: เขียว ปกติ · ส้ม กลับบ้าน · แดง STAT
  ปุ่มที่เลือกเป็นพื้นทึบ ตัวหนังสือขาว — ใส่ค่าสีตรง ๆ (green-700 / orange-700 / red-600 ของ Tailwind) ให้ตัวหนังสือขาวอ่านได้ ≥ 4.5:1
  ไม่ใช้คลาส bg-green-700 เพราะโหมดมืดของโปรเจกต์พลิกชุดสีทั้งหมด (globals.css) เขียวเข้มจะกลายเป็นเขียวอ่อน ตัวหนังสือขาวมองไม่เห็น
  ปุ่มที่ไม่ได้เลือกใช้คลาสปกติ ปล่อยให้ชุดสีพลิกเอง (เส้นขอบเข้ม ตัวหนังสือสว่างในโหมดมืด)
  มีไอคอนและคำกำกับทุกปุ่ม ไม่ใช้สีอย่างเดียว
*/
const PRIORITY_BTN: Record<RxPriority, { icon: React.ReactNode; on: string; off: string }> = {
    routine: {
        icon: <PiCheckCircleBold />,
        on: 'bg-[#15803d] border-[#15803d] text-white',
        off: 'border-green-300 text-green-800 hover:bg-green-50',
    },
    discharge: {
        icon: <PiHouseLineBold />,
        on: 'bg-[#c2410c] border-[#c2410c] text-white',
        off: 'border-orange-300 text-orange-800 hover:bg-orange-50',
    },
    stat: {
        icon: <PiLightningBold />,
        on: 'bg-[#dc2626] border-[#dc2626] text-white',
        off: 'border-red-300 text-red-700 hover:bg-red-50',
    },
};
const PRIORITY_BTN_LABEL: Record<RxPriority, string> = { routine: 'ปกติ', discharge: 'ยากลับบ้าน', stat: 'STAT' };

export const PrioritySelect = ({ value, onChange, size = 'middle' }: {
    value: RxPriority; onChange: (v: RxPriority) => void; size?: 'small' | 'middle';
}) => (
    <div role="radiogroup" aria-label="ความเร่งด่วน" className="flex flex-wrap gap-1.5">
        {(['routine', 'discharge', 'stat'] as RxPriority[]).map(p => {
            const b = PRIORITY_BTN[p];
            const on = value === p;
            return (
                <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChange(p)}
                    className={`inline-flex items-center gap-1.5 rounded-md border font-semibold transition-colors
                        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006b5f]
                        ${size === 'small' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm'}
                        ${on ? `${b.on} shadow-sm` : `bg-transparent ${b.off}`}`}
                >
                    <span className={size === 'small' ? 'text-sm' : 'text-base'}>{b.icon}</span>
                    {PRIORITY_BTN_LABEL[p]}
                </button>
            );
        })}
    </div>
);
