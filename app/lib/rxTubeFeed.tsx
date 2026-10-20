'use client';

import { Tag } from 'antd';
import { PiDropBold } from 'react-icons/pi';

/**
 * ป้าย "ให้อาหารทางสายยาง"
 *
 * ใช้ร่วมกันทั้งหน้าห้องยาและหน้าหอ ให้หน้าตาและถ้อยคำเหมือนกันทุกที่
 * ห้องยาต้องจำป้ายนี้ได้ในพริบตา เพราะยาของผู้ป่วยกลุ่มนี้ต้องเตรียมคนละแบบ
 * (ยาน้ำแทนยาเม็ด บดผสมน้ำ และยาเม็ดเคลือบหรือออกฤทธิ์นานบดไม่ได้)
 *
 * ใช้สีฟ้าอมเขียว ไม่ซ้ำกับสีที่มีความหมายอยู่แล้วบนคิว
 * (แดง/ส้ม/เขียว = ความด่วน · ม่วง = ฉบับแก้)
 */
export function TubeFeedTag({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
    return (
        <Tag
            color="cyan"
            icon={<PiDropBold className="inline -mt-0.5 mr-0.5" />}
            className={`m-0! font-semibold ${compact ? 'text-[11px]!' : ''} ${className}`}
        >
            {compact ? 'สายยาง' : 'ให้อาหารทางสายยาง'}
        </Tag>
    );
}
