'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import { Alert, Skeleton, Tag, Typography } from 'antd';
import { PiArrowDownBold, PiArrowUpBold } from 'react-icons/pi';

dayjs.extend(buddhistEra);

const { Text } = Typography;

/**
 * ผล INR จาก HOSxP ให้เภสัชดูประกอบยาต้านการแข็งตัวของเลือด
 * ระดับเป็นแนวทางทั่วไป (เป้าหมาย warfarin ส่วนใหญ่ 2–3) — เป้าหมายจริงขึ้นกับข้อบ่งใช้ของผู้ป่วยแต่ละราย
 */

interface InrPoint { date: string; time: string | null; inr: number; item: string | null }

const flagInr = (v: number): { color: string; short: string } => {
    if (v >= 5) return { color: 'red', short: 'สูงมาก เสี่ยงเลือดออก' };
    if (v > 3) return { color: 'orange', short: 'สูงกว่าเป้าหมาย' };
    if (v >= 2) return { color: 'green', short: 'ในช่วง 2–3' };
    if (v > 1.2) return { color: 'gold', short: 'ต่ำกว่าเป้าหมาย' };
    return { color: 'default', short: 'ช่วงคนทั่วไป' };
};

const thDate = (d: string) => dayjs(d).locale('th').format('D MMM BB');

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function RxInrCard({ orderId }: { orderId: string }) {
    const [points, setPoints] = useState<InrPoint[]>([]);
    const [state, setState] = useState<'loading' | 'ok' | 'none' | 'down'>('loading');

    useEffect(() => {
        let alive = true;
        axios.get(`/api/v1/rx/orders/${orderId}/inr`, { headers: authHeaders() })
            .then(res => {
                if (!alive) return;
                const p = (res.data?.data?.points ?? []) as InrPoint[];
                setPoints(p);
                setState(res.data?.his_down ? 'down' : p.length > 0 ? 'ok' : 'none');
            })
            .catch(() => { if (alive) setState('down'); });
        return () => { alive = false; };
    }, [orderId]);

    const title = <Text className="text-xs text-gray-500 block mb-1">INR (จาก HOSxP)</Text>;
    if (state === 'loading') return <div>{title}<Skeleton active paragraph={{ rows: 1 }} title={false} /></div>;
    if (state === 'down') return <div>{title}<Alert type="warning" showIcon title="ดึงผล INR จาก HIS ไม่ได้ตอนนี้" /></div>;
    if (state === 'none') return <div>{title}<Text className="text-xs text-gray-500">ไม่พบผล INR ของผู้ป่วยรายนี้</Text></div>;

    const [last, prev] = points;
    const daysAgo = dayjs().startOf('day').diff(dayjs(last.date), 'day');

    return (
        <div>
            {title}
            {/* วันที่ผลล่าสุดต้องเห็นชัด เภสัชจะรู้ทันทีว่าค่าที่ดูอยู่เก่าแค่ไหน · เกิน 7 วันเป็นสีส้ม */}
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1.5">
                <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${daysAgo > 7
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-blue-100 text-blue-900'}`}>
                    ผลล่าสุด {thDate(last.date)}{last.time ? ` ${last.time}` : ''}
                    <span className="font-normal">· {daysAgo === 0 ? 'วันนี้' : `${daysAgo} วันก่อน`}</span>
                </span>
                {last.item && last.item !== 'INR' ? <span className="text-[11px] text-gray-500">{last.item}</span> : null}
                {prev && <span className="text-[11px] text-gray-500">ลูกศร = เทียบผลครั้งก่อน</span>}
            </div>
            {/* ล่าสุด + 2 ครั้งก่อน หน้าตาเดียวกับช่อง Cr / eGFR / CrCl */}
            <div className="grid grid-cols-3 gap-1.5">
                {points.slice(0, 3).map((p, i) => (
                    <InrBox key={`${p.date}-${p.time}-${p.inr}`} point={p} prev={points[i + 1] ?? null}
                        label={i === 0 ? 'INR ล่าสุด' : dayjs(p.date).locale('th').format('D MMM BB')} latest={i === 0} />
                ))}
            </div>
            {points.length > 3 && (
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-500 tabular-nums">
                    <span>ก่อนหน้า:</span>
                    {points.slice(3, 8).map(p => (
                        <span key={`${p.date}-${p.time}-${p.inr}`}>{dayjs(p.date).locale('th').format('D MMM')} <b>{p.inr}</b></span>
                    ))}
                </div>
            )}
        </div>
    );
}

/** ช่อง INR หนึ่งครั้ง · ลูกศรแดงเมื่อค่าขยับออกจากช่วง 2–3 */
function InrBox({ point, prev, label, latest }: { point: InrPoint; prev: InrPoint | null; label: string; latest: boolean }) {
    const flag = flagInr(point.inr);
    const diff = prev ? Math.round((point.inr - prev.inr) * 100) / 100 : 0;
    const worse = (point.inr > 3 && diff > 0) || (point.inr < 2 && diff < 0);
    return (
        <div className={`rounded border px-2 py-1.5 ${latest ? 'border-gray-300' : 'border-gray-200'}`}>
            <div className="text-[11px] text-gray-500">{label}</div>
            <div className="flex items-baseline gap-1">
                <span className={`font-semibold tabular-nums ${latest ? 'text-lg' : 'text-base'}`}>{point.inr}</span>
                {!latest && point.time && <span className="text-[10px] text-gray-500">{point.time}</span>}
            </div>
            {diff !== 0 && (
                <div className={`text-[11px] inline-flex items-center tabular-nums ${worse ? 'text-red-600' : 'text-gray-500'}`} title="เทียบผลครั้งก่อน">
                    {diff > 0 ? <PiArrowUpBold /> : <PiArrowDownBold />}{Math.abs(diff)}
                </div>
            )}
            <Tag color={flag.color} className="m-0! text-[10px]! leading-4! px-1! whitespace-normal!">{flag.short}</Tag>
        </div>
    );
}
