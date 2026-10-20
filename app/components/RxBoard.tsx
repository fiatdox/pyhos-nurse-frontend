'use client';

import type { ReactNode } from 'react';

/**
 * กระดานใบสั่งยา แบ่งคอลัมน์ตามสถานะ
 *
 * ใช้ร่วมกันทั้งหน้าห้องยาและหน้าหอผู้ป่วย ตัวนี้ทำแค่การวางคอลัมน์
 * ส่วนหน้าตาของการ์ดแต่ละใบเป็นของแต่ละหน้า เพราะสองฝั่งต้องการข้อมูลคนละชุด
 * (ห้องยาต้องเห็นปุ่มทำงาน ส่วนหอต้องเห็นว่าห้องยาทำถึงไหนแล้ว)
 *
 * ตั้งใจไม่ทำลากการ์ดข้ามคอลัมน์ การลากคือการเปลี่ยนสถานะใบสั่งยาจริง
 * บนจอสัมผัสที่เคาน์เตอร์ยา การปล่อยนิ้วพลาดคอลัมน์เดียวแปลว่าใบนั้นถูกบันทึกว่าทำเสร็จ
 * ทั้งที่ยังไม่ได้ทำ ปุ่มบนการ์ดจึงบอกขั้นถัดไปแทน กดแล้วรู้แน่ว่ากดอะไร
 */

export interface BoardColumn<T> {
    key: string;
    title: string;
    /** สีแถบหัวคอลัมน์ ใช้โทนเดียวกับป้ายสถานะในตาราง */
    tint: string;
    items: T[];
    /** ข้อความตอนคอลัมน์ว่าง */
    empty?: string;
}

export const BoardCard = ({ accent, onClick, children }: {
    /** สีแถบซ้ายของการ์ด ปกติใช้บอกความเร่งด่วน */
    accent?: string;
    onClick?: () => void;
    children: ReactNode;
}) => (
    /*
      ไม่ใส่ dark: ให้คลาสเทาเลย เพราะโปรเจกต์นี้นิยาม --color-gray-* ใหม่ใต้ .dark อยู่แล้ว
      (ดูหัวไฟล์ globals.css) คลาสเดียวจึงถูกทั้งสองโหมด ส่วน bg-white ถูกสั่งทับเป็นสีการ์ดโหมดมืดให้แล้ว
      ถ้าเผลอใส่ dark:border-gray-700 จะได้ขอบ #d9d9d9 สว่างจ้าทุกใบ เพราะสเกลถูกพลิกไว้
    */
    <div
        onClick={onClick}
        className={`rounded-lg border border-gray-200 bg-white
            p-2.5 shadow-xs transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
        style={accent ? { borderLeftWidth: 4, borderLeftColor: accent } : undefined}
    >
        {children}
    </div>
);

export default function RxBoard<T>({ columns, renderCard, cardKey, height = 'calc(100vh - 330px)' }: {
    columns: BoardColumn<T>[];
    renderCard: (item: T) => ReactNode;
    cardKey: (item: T) => string;
    height?: string;
}) {
    return (
        /*
          เลื่อนแนวนอนทั้งกระดาน ไม่บีบคอลัมน์ให้แคบลงตามจำนวน
          ห้าคอลัมน์บนจอแล็ปท็อปถ้าบีบให้พอดีจอ การ์ดจะแคบจนชื่อผู้ป่วยขึ้นบรรทัดละสองคำ
        */
        <div className="flex gap-3 overflow-x-auto pb-2">
            {columns.map(col => (
                <div key={col.key} className="w-[290px] shrink-0 flex flex-col">
                    {/* หัวคอลัมน์ติดอยู่กับที่เวลาเลื่อนการ์ดในคอลัมน์ */}
                    <div
                        className="flex items-center gap-2 px-2.5 py-2 rounded-t-lg border-b-2"
                        style={{ borderColor: col.tint }}
                    >
                        <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: col.tint }} />
                        <span className="font-semibold text-sm">{col.title}</span>
                        <span className="ml-auto text-sm tabular-nums text-gray-500">{col.items.length}</span>
                    </div>

                    <div
                        className="flex flex-col gap-2 p-2 bg-gray-50 rounded-b-lg overflow-y-auto"
                        style={{ height }}
                    >
                        {col.items.map(item => (
                            <div key={cardKey(item)}>{renderCard(item)}</div>
                        ))}
                        {col.items.length === 0 && (
                            <div className="text-xs text-gray-500 text-center py-6">
                                {col.empty ?? 'ไม่มีใบในช่องนี้'}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
