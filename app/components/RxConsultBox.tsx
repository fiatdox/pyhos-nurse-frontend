'use client';

import { useState } from 'react';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import { App, Button, DatePicker, Input, Tooltip, Typography } from 'antd';
import { PiPhoneCallBold, PiPlusBold } from 'react-icons/pi';

dayjs.extend(buddhistEra);

const { Text } = Typography;
const { TextArea } = Input;

/**
 * บันทึกการโทรปรึกษาแพทย์ของใบสั่งยา
 *
 * ใช้ร่วมกันทั้งหน้าหอผู้ป่วยและหน้าคิวห้องยา ทั้งสองฝั่งบันทึกได้และเห็นของกันและกัน
 * จะได้ไม่โทรตามแพทย์คนเดียวกันซ้ำ หรือรอกันโดยไม่รู้ว่าอีกฝั่งคุยไปแล้ว
 *
 * ข้อมูลมาจากประวัติของใบ (action = consult) ไม่ได้ดึงแยก
 * หน้าที่เปิดใบอยู่โหลดประวัติมาแล้ว ส่งเข้ามาตรง ๆ
 */

export interface ConsultEvent {
    action: string;
    actor_name: string | null;
    at: string;
    detail?: { consulted_at?: string; note?: string } | null;
}

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmt = (v?: string | null) => (v ? dayjs(v).locale('th').format('D MMM HH:mm') : '-');

/**
 * ไอคอนโทรศัพท์ในรายการ/การ์ด: ใบนี้มีคนโทรปรึกษาแพทย์แล้ว
 * ชี้ค้างดูเวลา ผู้บันทึก และข้อความได้โดยไม่ต้องเปิดใบ
 */
export function ConsultTag({ at, note, by, count, className }: {
    at: string | null | undefined; note?: string | null; by?: string | null; count?: number; className?: string;
}) {
    if (!at) return null;
    const label = `ปรึกษาแพทย์แล้ว ${fmt(at)} น.${count && count > 1 ? ` (${count} ครั้ง)` : ''}`;
    return (
        <Tooltip title={<span>{label} · {by || '-'}<br />{note}</span>}>
            {/* ป้ายพื้นสีมีจำนวนครั้ง ให้เห็นจากระยะจอห้องยา · สีโหมดมืดสลับให้เองจาก globals.css ห้ามใส่ dark: ซ้ำ */}
            <span
                role="img"
                aria-label={label}
                className={`inline-flex items-center gap-0.5 align-middle rounded-full px-1.5 py-px bg-cyan-100 text-cyan-800 border border-cyan-300 text-[11px] font-semibold leading-4 cursor-help ${className ?? ''}`}
            >
                <PiPhoneCallBold className="text-sm" />
                {count && count > 1 ? <span className="tabular-nums">{count}</span> : null}
            </span>
        </Tooltip>
    );
}

export default function RxConsultBox({ orderId, events, onSaved }: {
    orderId: string;
    /** ประวัติทั้งหมดของใบ คัดเฉพาะ consult ข้างใน */
    events: ConsultEvent[];
    onSaved?: () => void;
}) {
    const { message } = App.useApp();
    const [adding, setAdding] = useState(false);
    const [when, setWhen] = useState<Dayjs | null>(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    /* ใหม่สุดขึ้นก่อน เรียงตามเวลาที่ปรึกษา ไม่ใช่เวลาที่กดบันทึก */
    const consults = events
        .filter(e => e.action === 'consult')
        .sort((a, b) => String(b.detail?.consulted_at ?? '').localeCompare(String(a.detail?.consulted_at ?? '')));

    const start = () => { setWhen(dayjs()); setNote(''); setAdding(true); };

    const save = async () => {
        setBusy(true);
        try {
            await axios.post(`/api/v1/rx/orders/${orderId}/consult`, {
                note: note.trim(),
                consulted_at: (when ?? dayjs()).format('YYYY-MM-DD HH:mm'),
            }, { headers: authHeaders() });
            /* key เดียวกับข้อความจากสัญญาณ เครื่องที่บันทึกเองจะไม่เห็นซ้ำสองอัน */
            message.success({ key: `consult-${orderId}`, content: 'บันทึกการปรึกษาแพทย์แล้ว อีกฝั่งเห็นทันที' });
            setAdding(false);
            onSaved?.();
        } catch (err) {
            const m = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
            message.error(m || 'บันทึกไม่สำเร็จ');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-md border border-cyan-300 dark:border-cyan-800 p-2">
            <div className="flex items-center gap-1.5">
                <PiPhoneCallBold className="text-cyan-600" />
                <Text className="text-xs font-semibold">ปรึกษาแพทย์</Text>
                {!adding && (
                    <Button size="small" type="link" icon={<PiPlusBold />} className="ml-auto p-0!" onClick={start}>
                        บันทึกว่าโทรแล้ว
                    </Button>
                )}
            </div>

            {consults.length === 0 && !adding && (
                <div className="text-xs text-gray-500 mt-1">ยังไม่มีการบันทึก</div>
            )}

            <div className="flex flex-col gap-1.5 mt-1">
                {consults.map((c, i) => (
                    <div key={i} className="text-xs leading-snug">
                        <div>
                            <span className="font-semibold tabular-nums">{fmt(c.detail?.consulted_at)} น.</span>
                            <span className="text-gray-500"> · {c.actor_name || '-'}</span>
                        </div>
                        <div className="whitespace-pre-wrap wrap-break-word">{c.detail?.note}</div>
                    </div>
                ))}
            </div>

            {adding && (
                <div className="flex flex-col gap-2 mt-2">
                    <div>
                        <Text className="text-xs text-gray-500 block mb-0.5">เวลาที่โทรปรึกษา</Text>
                        <DatePicker
                            id="rx-consult-time"
                            showTime={{ format: 'HH:mm' }}
                            format={v => v.locale('th').format('D MMM BBBB HH:mm น.')}
                            value={when}
                            onChange={setWhen}
                            allowClear={false}
                            size="small"
                            className="w-full"
                            /* ห้ามอนาคต และย้อนหลังได้ไม่เกิน 7 วัน ตรงกับที่เซิร์ฟเวอร์ตรวจ */
                            disabledDate={d => d.isAfter(dayjs(), 'day') || d.isBefore(dayjs().subtract(7, 'day'), 'day')}
                        />
                    </div>
                    <TextArea
                        id="rx-consult-note"
                        rows={3}
                        maxLength={500}
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        placeholder="คุยกับแพทย์ท่านใด ได้ข้อสรุปว่าอย่างไร เช่น โทรปรึกษาแพทย์เวรเรื่องขนาดยา แพทย์ให้ลดขนาดตามค่าไต"
                    />
                    <div className="flex gap-2">
                        <Button size="small" className="flex-1" onClick={() => setAdding(false)}>ยกเลิก</Button>
                        <Button size="small" type="primary" className="flex-1" loading={busy}
                            disabled={note.trim().length < 3 || !when}
                            onClick={save}>
                            บันทึก
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
