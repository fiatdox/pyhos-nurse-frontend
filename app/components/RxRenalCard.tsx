'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import * as echarts from 'echarts';
import { Alert, Button, Empty, Modal, Skeleton, Table, Tag, Typography } from 'antd';
import { PiArrowDownBold, PiArrowUpBold, PiChartLineBold } from 'react-icons/pi';
import { useThemeMode } from '../lib/theme';
import { registerNurseDark, chartThemeName } from '../lib/echartsTheme';

dayjs.extend(buddhistEra);

const { Text } = Typography;

/**
 * การทำงานของไต สำหรับเภสัชดูประกอบการจ่ายยา (โดยเฉพาะยากลับบ้าน)
 *
 * ข้อมูลและสูตรเดียวกับหน้าประเมินการใช้ยาของ DUE (Creatinine จาก HOSxP · eGFR CKD-EPI 2009 · CrCl Cockcroft-Gault)
 * ต่างจาก DUE ตรงที่ไม่รวม CrCl/eGFR (mL/min) กับ Creatinine (mg/dL) ไว้ในกราฟเดียวสองแกน
 * เพราะสองแกนชวนอ่านจุดตัดของเส้นผิด แยกเป็นสองกราฟที่ใช้แกนวันเดียวกันแทน
 */

interface RenalPoint {
    date: string;
    time: string | null;
    scr: number;
    age: number | null;
    egfr: number | null;
    crcl: number | null;
}
interface RenalData {
    sex: '1' | '2';
    weight: number | null;
    weight_date: string | null;
    points: RenalPoint[];
}

type Tone = 'ok' | 'warn' | 'critical';
const TONE_COLOR: Record<Tone, string> = { ok: 'green', warn: 'gold', critical: 'red' };

/* ค่าอ้างอิงและระดับ ชุดเดียวกับ DUE (app/lib/renal.ts) — ควรยืนยันกับห้องแล็บของ รพ. */
const SCR_REF: Record<'1' | '2', [number, number]> = { '1': [0.7, 1.2], '2': [0.5, 1.0] };
const CRCL_DOSE_ADJUST_BELOW = 50;

const flagScr = (v: number, sex: '1' | '2'): { tone: Tone; label: string } => {
    const [min, max] = SCR_REF[sex];
    if (v > max * 2) return { tone: 'critical', label: 'สูงกว่าปกติมาก' };
    if (v > max) return { tone: 'warn', label: 'สูงกว่าปกติ' };
    if (v < min) return { tone: 'warn', label: 'ต่ำกว่าปกติ' };
    return { tone: 'ok', label: 'ปกติ' };
};
const flagEgfr = (v: number): { tone: Tone; label: string } => {
    if (v >= 90) return { tone: 'ok', label: 'G1 ปกติ' };
    if (v >= 60) return { tone: 'warn', label: 'G2 ลดลงเล็กน้อย' };
    if (v >= 45) return { tone: 'warn', label: 'G3a ลดลงปานกลาง' };
    if (v >= 30) return { tone: 'warn', label: 'G3b ลดลงปานกลาง-มาก' };
    if (v >= 15) return { tone: 'critical', label: 'G4 ลดลงมาก' };
    return { tone: 'critical', label: 'G5 ไตวาย' };
};
const flagCrcl = (v: number): { tone: Tone; label: string } => {
    if (v >= 90) return { tone: 'ok', label: 'ปกติ' };
    if (v >= CRCL_DOSE_ADJUST_BELOW) return { tone: 'warn', label: 'ต่ำกว่าปกติ' };
    if (v >= 30) return { tone: 'warn', label: 'ต้องตรวจขนาดยา' };
    return { tone: 'critical', label: 'ต้องตรวจขนาดยา' };
};

const thDate = (d: string, withYear = true) => dayjs(d).locale('th').format(withYear ? 'D MMM BB' : 'D MMM');

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/* สีเส้น: ลำดับคงที่ ไม่ใช้สีสถานะ (แดง/เขียว) ซ้ำกับป้ายระดับ */
const C_EGFR = '#3b6fd8';
const C_CRCL = '#c2410c';
const C_SCR = '#7c3aed';

/** กราฟหนึ่งตัว: clearance = eGFR + CrCl (mL/min) · scr = Creatinine (mg/dL) */
function RenalChart({ data, kind, height, compact = false }: {
    data: RenalData; kind: 'clearance' | 'scr'; height: number; compact?: boolean;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const { resolved } = useThemeMode();

    useEffect(() => {
        if (!ref.current) return;
        registerNurseDark(echarts);
        const chart = echarts.init(ref.current, chartThemeName(resolved === 'dark'));
        const pts = [...data.points].reverse();
        const at = (p: RenalPoint) => `${p.date}T${p.time ?? '00:00'}:00`;
        const muted = resolved === 'dark' ? '#8c8c8c' : '#8a8a8a';
        const line = (name: string, color: string, values: [string, number | null][]) => ({
            type: 'line' as const, name, color, smooth: 0.3, showSymbol: true, symbolSize: compact ? 5 : 7,
            lineStyle: { width: 2 }, connectNulls: true, data: values,
        });
        const ref50 = {
            silent: true, symbol: 'none',
            lineStyle: { type: 'dashed' as const, color: '#dc2626', width: 1 },
            label: { formatter: compact ? '50' : 'CrCl 50 · ตรวจปรับขนาดยา', color: '#dc2626', fontSize: 10, position: 'insideStartTop' as const },
            data: [{ yAxis: CRCL_DOSE_ADJUST_BELOW }],
        };
        const series = kind === 'clearance'
            ? [
                { ...line('eGFR', C_EGFR, pts.map(p => [at(p), p.egfr])), markLine: ref50 },
                line('CrCl', C_CRCL, pts.map(p => [at(p), p.crcl])),
            ]
            : [{
                ...line('Creatinine', C_SCR, pts.map(p => [at(p), p.scr])),
                /* แถบค่าปกติตามเพศ */
                markArea: {
                    silent: true,
                    itemStyle: { color: 'rgba(34,197,94,0.10)' },
                    label: { show: !compact, formatter: 'ช่วงปกติ', color: muted, fontSize: 10, position: 'insideTopLeft' as const },
                    data: [[{ yAxis: SCR_REF[data.sex][0] }, { yAxis: SCR_REF[data.sex][1] }]],
                },
            }];
        chart.setOption({
            animation: false,
            grid: { left: compact ? 30 : 44, right: 12, top: kind === 'clearance' ? 28 : 12, bottom: 24 },
            legend: kind === 'clearance' ? { top: 0, left: 'center', itemWidth: 14, textStyle: { fontSize: 11 } } : undefined,
            tooltip: {
                trigger: 'axis',
                valueFormatter: (v: unknown) => (v === null || v === undefined ? '-' : `${v}${kind === 'scr' ? ' mg/dL' : ' mL/min'}`),
            },
            xAxis: {
                type: 'time',
                axisLabel: { fontSize: 10, hideOverlap: true, formatter: (v: number) => thDate(dayjs(v).format('YYYY-MM-DD'), !compact) },
                splitLine: { show: false },
            },
            yAxis: {
                type: 'value', scale: kind === 'scr', min: kind === 'clearance' ? 0 : undefined,
                name: compact ? undefined : (kind === 'scr' ? 'mg/dL' : 'mL/min'),
                nameTextStyle: { fontSize: 10, color: muted },
                axisLabel: { fontSize: 10 },
            },
            series,
        });
        const onResize = () => chart.resize();
        window.addEventListener('resize', onResize);
        /* modal เปิดด้วย animation ขนาดกล่องยังไม่นิ่งตอน init */
        const t = setTimeout(onResize, 300);
        return () => { clearTimeout(t); window.removeEventListener('resize', onResize); chart.dispose(); };
    }, [data, kind, compact, resolved]);

    return <div ref={ref} style={{ height, width: '100%' }} role="img"
        aria-label={kind === 'clearance' ? 'กราฟ eGFR และ CrCl ตามวันที่ตรวจ' : 'กราฟ Creatinine ตามวันที่ตรวจ'} />;
}

/** ค่าหนึ่งช่อง พร้อมทิศทางเทียบผลครั้งก่อน */
function Stat({ label, unit, value, prev, flag, higherIsBetter }: {
    label: string; unit: string; value: number | null; prev: number | null;
    flag: { tone: Tone; label: string } | null; higherIsBetter: boolean;
}) {
    const diff = value !== null && prev !== null ? value - prev : null;
    const worse = diff !== null && Math.abs(diff) > 0.001 && (higherIsBetter ? diff < 0 : diff > 0);
    return (
        <div className="rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5">
            <div className="text-[11px] text-gray-500">{label}</div>
            <div className="flex items-baseline gap-1">
                <span className="text-lg font-semibold tabular-nums">{value ?? '-'}</span>
                <span className="text-[10px] text-gray-500">{unit}</span>
            </div>
            {diff !== null && Math.abs(diff) > 0.001 && (
                <div className={`text-[11px] inline-flex items-center tabular-nums ${worse ? 'text-red-600' : 'text-gray-500'}`}
                    title="เทียบผลครั้งก่อน">
                    {diff > 0 ? <PiArrowUpBold /> : <PiArrowDownBold />}{Math.abs(Math.round(diff * 100) / 100)}
                </div>
            )}
            {flag && <Tag color={TONE_COLOR[flag.tone]} className="m-0! text-[10px]! leading-4! px-1! whitespace-normal!">{flag.label}</Tag>}
        </div>
    );
}

export default function RxRenalCard({ orderId }: { orderId: string }) {
    const [data, setData] = useState<RenalData | null>(null);
    const [state, setState] = useState<'loading' | 'ok' | 'none' | 'down' | 'error'>('loading');
    const [full, setFull] = useState(false);

    useEffect(() => {
        let alive = true;
        axios.get(`/api/v1/rx/orders/${orderId}/renal`, { headers: authHeaders() })
            .then(res => {
                if (!alive) return;
                const d = res.data?.data as RenalData | null;
                setData(d);
                setState(res.data?.his_down ? 'down' : d && d.points.length > 0 ? 'ok' : 'none');
            })
            .catch(() => { if (alive) setState('error'); });
        return () => { alive = false; };
    }, [orderId]);

    const title = <Text className="text-xs text-gray-500 block mb-1">การทำงานของไต (จาก HOSxP)</Text>;
    if (state === 'loading') return <div>{title}<Skeleton active paragraph={{ rows: 3 }} title={false} /></div>;
    if (state === 'down' || state === 'error') {
        return <div>{title}<Alert type="warning" showIcon title="ดึงค่าไตจาก HIS ไม่ได้ตอนนี้" /></div>;
    }
    if (state === 'none' || !data) {
        return <div>{title}<Text className="text-xs text-gray-500">ไม่พบผล Creatinine ของผู้ป่วยรายนี้</Text></div>;
    }

    const [last, prev] = data.points;
    const daysAgo = dayjs().startOf('day').diff(dayjs(last.date), 'day');
    const lowCrcl = last.crcl !== null && last.crcl < CRCL_DOSE_ADJUST_BELOW;

    return (
        <div>
            {title}
            <div className="text-[11px] text-gray-500 mb-1.5">
                {prev ? 'ลูกศร = เทียบผลครั้งก่อน · ' : ''}ผลล่าสุด {thDate(last.date)}{last.time ? ` ${last.time}` : ''}
                {' · '}<span className={daysAgo > 7 ? 'text-orange-600 font-semibold' : ''}>
                    {daysAgo === 0 ? 'วันนี้' : `${daysAgo} วันก่อน`}
                </span>
                {last.age !== null ? ` · อายุ ${last.age} ปี` : ''}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
                <Stat label="Cr" unit="mg/dL" value={last.scr} prev={prev?.scr ?? null}
                    flag={flagScr(last.scr, data.sex)} higherIsBetter={false} />
                <Stat label="eGFR" unit="" value={last.egfr} prev={prev?.egfr ?? null}
                    flag={last.egfr !== null ? flagEgfr(last.egfr) : null} higherIsBetter />
                <Stat label="CrCl" unit="" value={last.crcl} prev={prev?.crcl ?? null}
                    flag={last.crcl !== null ? flagCrcl(last.crcl) : null} higherIsBetter />
            </div>
            {lowCrcl && (
                <Alert className="mt-1.5" type="error" showIcon
                    title={`CrCl < ${CRCL_DOSE_ADJUST_BELOW} mL/min`}
                    description={<span className="text-xs">ตรวจสอบการปรับขนาดยาตามการทำงานของไตก่อนจ่าย</span>} />
            )}
            {data.points.length > 1 && <div className="mt-1"><RenalChart data={data} kind="clearance" height={150} compact /></div>}
            <div className="flex items-center justify-between mt-1">
                <Text className="text-[10px] text-gray-500 leading-tight">
                    {data.weight ? `CrCl ใช้น้ำหนัก ${data.weight} kg${data.weight_date ? ` (ชั่ง ${thDate(data.weight_date)})` : ''}` : 'ไม่มีน้ำหนัก คำนวณ CrCl ไม่ได้'}
                </Text>
                <Button size="small" type="link" icon={<PiChartLineBold />} className="p-0!" onClick={() => setFull(true)}>
                    ดูทั้งหมด ({data.points.length})
                </Button>
            </div>

            <Modal open={full} onCancel={() => setFull(false)} footer={null} width={900} centered destroyOnHidden
                title="การทำงานของไต">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Text className="text-xs text-gray-500">eGFR / CrCl (mL/min)</Text>
                        <RenalChart data={data} kind="clearance" height={260} />
                    </div>
                    <div>
                        <Text className="text-xs text-gray-500">Creatinine (mg/dL)</Text>
                        <RenalChart data={data} kind="scr" height={260} />
                    </div>
                </div>
                <Table
                    className="mt-3"
                    size="small"
                    rowKey={r => `${r.date}-${r.time}-${r.scr}`}
                    dataSource={data.points}
                    pagination={false}
                    scroll={{ y: 240 }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                    columns={[
                        { title: 'วันที่ตรวจ', key: 'd', render: (_, r) => <span className="tabular-nums">{thDate(r.date)}{r.time ? ` ${r.time}` : ''}</span> },
                        { title: 'อายุ', dataIndex: 'age', align: 'right', width: 60 },
                        { title: 'Cr', dataIndex: 'scr', align: 'right', render: (v: number) => <b className="tabular-nums">{v}</b> },
                        { title: 'eGFR', dataIndex: 'egfr', align: 'right', render: (v: number | null) => v === null ? '-' : <span className="tabular-nums">{v} <Tag color={TONE_COLOR[flagEgfr(v).tone]} className="m-0! ml-1! text-[10px]!">{flagEgfr(v).label.split(' ')[0]}</Tag></span> },
                        { title: 'CrCl', dataIndex: 'crcl', align: 'right', render: (v: number | null) => v === null ? '-' : <span className={`tabular-nums ${v < CRCL_DOSE_ADJUST_BELOW ? 'text-red-600 font-semibold' : ''}`}>{v}</span> },
                    ]}
                />
                <Text className="text-xs text-gray-500 block mt-2">
                    eGFR: CKD-EPI 2009 · CrCl: Cockcroft-Gault ใช้น้ำหนักล่าสุดทุกจุด (เหมือนระบบ DUE)
                    {data.weight ? ` · ${data.weight} kg${data.weight_date ? ` ชั่ง ${thDate(data.weight_date)}` : ''}` : ''}
                    {' · '}ค่าอ้างอิง Cr {data.sex === '2' ? 'หญิง' : 'ชาย'} {SCR_REF[data.sex].join('–')} mg/dL — ควรยืนยันกับห้องปฏิบัติการของโรงพยาบาล
                </Text>
            </Modal>
        </div>
    );
}
