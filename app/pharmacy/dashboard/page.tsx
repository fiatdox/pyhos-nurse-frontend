'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import { Alert, Button, Card, DatePicker, Empty, Segmented, Select, Table, Tag, Tooltip } from 'antd';
import { DashboardSkeleton } from '@/app/components/Skeletons';
import type { ColumnsType } from 'antd/es/table';
import { PiArrowClockwiseBold, PiClockBold, PiTrayBold, PiChartBarBold } from 'react-icons/pi';
import { getAuthHeaders } from '../../lib/auth';
import { useThemeMode } from '../../lib/theme';
import {
    STATUS, StatusBadge, Kpi, Section, useChart, baseText, grid, nf, fmtPct, share,
} from '../../lib/dashboardKit';
import { PRIORITY, PRIORITY_ORDER, PriorityDot, type RxPriority } from '../../lib/rxPriority';
import { usePharmacy } from '../PharmacyShell';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { RangePicker } = DatePicker;

/* ───────────────────────── รูปข้อมูลจาก GET /api/v1/rx/dashboard ───────────────────────── */

interface Dur { p50: number | null; p90: number | null; n?: number }
interface Sla { met: number; n: number; rate: number | null }
type Stage = 't_first' | 't_key' | 't_prep' | 't_lead' | 't_pickup' | 't_total';

interface Dashboard {
    range: { from: string; to: string; days: number };
    sla_seconds: Record<RxPriority, number>;
    summary: {
        orders: number; patients: number; wards: number;
        by_priority: Record<RxPriority, number>;
        rejected: number; resends: number; picked_up: number; open: number;
        unverified: number; tube_feed: number;
        sla: Sla;
        durations: Record<Stage, Dur>;
        files: number; file_views: number;
    };
    by_priority: { priority: RxPriority; orders: number; rejected: number; sla: Sla; durations: Record<Stage, Dur> }[];
    daily: {
        date: string; orders: number; stat: number; discharge: number; routine: number; rejected: number;
        sla: Sla; t_first_p50: number | null; t_lead_p50: number | null; t_lead_p90: number | null;
    }[];
    heatmap: { dow: number; hour: number; orders: number }[];
    hourly: { hour: number; orders: number; sla: Sla; t_first_p50: number | null; t_first_p90: number | null }[];
    by_ward: {
        ward: number; ward_name: string; orders: number; patients: number;
        stat: number; discharge: number; routine: number;
        rejected: number; resends: number; unverified: number; tube_feed: number;
        sla: Sla; t_first: Dur; t_lead: Dur; t_pickup: Dur;
    }[];
    by_staff: {
        username: string; name: string; ack: number; key: number; prep: number; handover: number; reject: number;
        t_ack_p50: number | null; t_key_p50: number | null; t_prep_p50: number | null;
    }[];
    reject_reasons: { reason: string; n: number; last_at: string }[];
    hn_source: { source: string; orders: number; verified: number; rejected: number }[];
    lead_histogram: { bucket: number; n: number }[];
    backlog: {
        waiting: number; working: number; keyed: number; ready: number; rejected_open: number;
        overdue: number; oldest_waiting: number | null; oldest_ready: number | null;
    };
}

/* ───────────────────────── สี ─────────────────────────
   ผ่านตัวตรวจสีของ dataviz แล้วทั้งสองโหมด (scripts/validate_palette.js)
   - ความด่วน: ปกติ=น้ำเงิน · กลับบ้าน=เหลือง · STAT=แดง (STAT แดงเหมือนหน้าคิว)
     ส้มคู่แดงแบบหน้าคิวไม่ผ่าน (คนตาบอดสีแยกไม่ออก) กราฟจึงใช้เหลืองแทนส้ม
     โหมดมืดคู่เหลือง-แดงอยู่ในช่วงเตือน จึงมีชื่อกำกับ ช่องว่างระหว่างแท่ง และตาราง เสมอ
   - ขั้นของใบ: น้ำเงินเฉดเดียวไล่อ่อน→เข้มตามลำดับขั้น
   - ปริมาณ (heatmap / แท่งเดี่ยว): น้ำเงินเฉดเดียว */
const PALETTE = {
    light: {
        prio: { routine: '#2a78d6', discharge: '#eda100', stat: '#e34948' } as Record<RxPriority, string>,
        stage: ['#86b6ef', '#2a78d6', '#104281'],
        one: '#2a78d6',
        context: '#a3a29d',
        heat: ['#eef4fc', '#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'],
        surface: '#ffffff',
    },
    dark: {
        prio: { routine: '#3987e5', discharge: '#c98500', stat: '#e34948' } as Record<RxPriority, string>,
        stage: ['#86b6ef', '#3987e5', '#184f95'],
        one: '#3987e5',
        context: '#6e6d68',
        heat: ['#1f2630', '#0d366b', '#1c5cab', '#3987e5', '#86b6ef', '#cde2fb'],
        surface: '#1f1f1f',
    },
};

const DOW = ['', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
const LEAD_BUCKETS = ['< 10 น.', '10–20 น.', '20–30 น.', '30–45 น.', '45–60 น.', '1–1.5 ชม.', '1.5–2 ชม.', '> 2 ชม.'];
const HN_SOURCE_LABEL: Record<string, string> = {
    barcode: 'บาร์โค้ด', pdf_text: 'ข้อความใน PDF', ocr: 'อ่านจากภาพ (OCR)', manual: 'พิมพ์เอง',
};

/* ───────────────────────── ตัวช่วยแสดงผล ───────────────────────── */

/** วินาที → ข้อความอ่านง่าย ใบที่ยังไม่มีข้อมูลขึ้นขีด ไม่ขึ้น 0 ซึ่งแปลว่าเร็วมาก */
const fmtDur = (s: number | null | undefined) => {
    if (s === null || s === undefined || !Number.isFinite(s)) return '–';
    if (s < 60) return '< 1 นาที';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} นาที`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ชม.${m % 60 ? ` ${m % 60} นาที` : ''}`;
    return `${Math.floor(h / 24)} วัน${h % 24 ? ` ${h % 24} ชม.` : ''}`;
};
const minutes = (s: number | null | undefined) => (s === null || s === undefined ? null : Math.round(s / 6) / 10);

/** เกณฑ์รับทันเวลา: 90% ขึ้นไปดี 75–89% ควรดู ต่ำกว่านั้นต้องแก้ */
const slaStatus = (r: number | null) => (r === null ? null : r >= 0.9 ? STATUS.good : r >= 0.75 ? STATUS.warning : STATUS.critical);

/* ───────────────────────── ส่วนประกอบของหน้า ───────────────────────── */

/** ปริมาณใบรายวันแยกตามความด่วน — แท่งซ้อน แกนเดียว */
function DailyVolume({ data, dark }: { data: Dashboard['daily']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const order: RxPriority[] = ['routine', 'discharge', 'stat'];
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 40, right: 16, top: 36, bottom: 40 },
        legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 12, data: [...order].reverse().map(p => PRIORITY[p].label) },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const arr = ps as { dataIndex: number }[];
                const d = data[arr[0]?.dataIndex ?? 0];
                if (!d) return '';
                return `<b>${dayjs(d.date).format('ddd D MMM')}</b><br/>`
                    + [...order].reverse().map(p => `${PRIORITY[p].label}: ${d[p]}`).join('<br/>')
                    + `<br/>รวม ${d.orders} ใบ · ส่งกลับ ${d.rejected}`
                    + `<br/>รับทันเวลา ${fmtPct(d.sla.rate)} · รอรับ P50 ${fmtDur(d.t_first_p50)}`;
            },
        },
        xAxis: {
            type: 'category', data: data.map(d => dayjs(d.date).format('D/M')),
            axisTick: { show: false }, axisLine: { lineStyle: { color: dark ? '#434343' : '#d9d8d4' } },
        },
        yAxis: { type: 'value', minInterval: 1, splitLine: grid(dark), name: 'ใบ', nameTextStyle: { align: 'right' } },
        series: order.map((p, i) => ({
            name: PRIORITY[p].label,
            type: 'bar',
            stack: 'n',
            barMaxWidth: 24,
            data: data.map(d => d[p]),
            itemStyle: {
                color: pal.prio[p],
                /* ช่องว่าง 2px สีพื้นระหว่างชั้น และมุมมนเฉพาะปลายบนของชั้นบนสุด */
                borderColor: pal.surface, borderWidth: 1,
                borderRadius: i === order.length - 1 ? [4, 4, 0, 0] : 0,
            },
            emphasis: { focus: 'series' },
        })),
    }, [data, dark]);
    return <div ref={ref} style={{ height: 300 }} />;
}

/** เวลาส่ง → ยาพร้อม รายวัน (P50 เด่น, P90 เป็นบริบท) — หน่วยเดียวกัน แกนเดียว */
function DailyLead({ data, dark }: { data: Dashboard['daily']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 44, right: 16, top: 36, bottom: 40 },
        /* legend ชิดขวา ฝั่งซ้ายบนเป็นที่ของชื่อแกน "นาที" */
        legend: { top: 0, right: 0, itemWidth: 14, itemHeight: 3, data: ['มัธยฐาน (P50)', 'ใบที่ช้า (P90)'] },
        tooltip: {
            trigger: 'axis',
            formatter: (ps: unknown) => {
                const arr = ps as { dataIndex: number }[];
                const d = data[arr[0]?.dataIndex ?? 0];
                if (!d) return '';
                return `<b>${dayjs(d.date).format('ddd D MMM')}</b><br/>ส่ง → ยาพร้อม P50 ${fmtDur(d.t_lead_p50)}`
                    + `<br/>P90 ${fmtDur(d.t_lead_p90)}<br/>${d.orders} ใบ`;
            },
        },
        xAxis: {
            type: 'category', data: data.map(d => dayjs(d.date).format('D/M')),
            axisTick: { show: false }, axisLine: { lineStyle: { color: dark ? '#434343' : '#d9d8d4' } },
        },
        yAxis: { type: 'value', name: 'นาที', splitLine: grid(dark), nameTextStyle: { align: 'right' } },
        series: [
            {
                name: 'ใบที่ช้า (P90)', type: 'line', connectNulls: false, symbolSize: 6,
                lineStyle: { width: 2, color: pal.context }, itemStyle: { color: pal.context },
                data: data.map(d => minutes(d.t_lead_p90)),
            },
            {
                name: 'มัธยฐาน (P50)', type: 'line', connectNulls: false, symbolSize: 8,
                lineStyle: { width: 2, color: pal.one },
                itemStyle: { color: pal.one, borderColor: pal.surface, borderWidth: 2 },
                areaStyle: { color: pal.one, opacity: 0.08 },
                data: data.map(d => minutes(d.t_lead_p50)),
            },
        ],
    }, [data, dark]);
    return <div ref={ref} style={{ height: 300 }} />;
}

/** ใบเข้าตามวัน × ชั่วโมง — ใช้วางคนตามช่วงที่งานเข้าจริง */
function ArrivalHeatmap({ data, dark }: { data: Dashboard['heatmap']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const max = Math.max(1, ...data.map(d => d.orders));
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 36, right: 16, top: 8, bottom: 64 },
        tooltip: {
            formatter: (p: unknown) => {
                const v = (p as { value: [number, number, number] }).value;
                return `${DOW[v[1] + 1]} ${String(v[0]).padStart(2, '0')}:00–${String(v[0] + 1).padStart(2, '0')}:00<br/><b>${v[2]} ใบ</b>`;
            },
        },
        xAxis: {
            type: 'category', data: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')),
            splitArea: { show: false }, axisTick: { show: false },
        },
        yAxis: { type: 'category', data: DOW.slice(1), inverse: true, axisTick: { show: false } },
        visualMap: {
            min: 0, max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
            itemWidth: 10, itemHeight: 140, text: ['มาก', 'น้อย'],
            inRange: { color: pal.heat }, textStyle: baseText(dark),
        },
        series: [{
            type: 'heatmap',
            /* ช่องที่ไม่มีใบใส่ 0 ไว้ด้วย ไม่งั้นจะเป็นช่องโหว่ที่แยกไม่ออกกับช่องที่ไม่ได้วาด */
            data: Array.from({ length: 7 * 24 }, (_, i) => {
                const dow = Math.floor(i / 24) + 1;
                const hour = i % 24;
                return [hour, dow - 1, data.find(d => d.dow === dow && d.hour === hour)?.orders ?? 0];
            }),
            itemStyle: { borderColor: pal.surface, borderWidth: 2, borderRadius: 2 },
            emphasis: { itemStyle: { borderColor: dark ? '#e8e8e8' : '#0b0b0b', borderWidth: 1 } },
        }],
    }, [data, dark]);
    return <div ref={ref} style={{ height: 300 }} />;
}

/** เวลารอให้ห้องยารับ ตามชั่วโมงที่ใบเข้า — หาชั่วโมงที่ห้องยาตามไม่ทัน */
function HourlyWait({ data, dark }: { data: Dashboard['hourly']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const byHour = Array.from({ length: 24 }, (_, h) => data.find(d => d.hour === h));
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 44, right: 16, top: 28, bottom: 32 },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const i = (ps as { dataIndex: number }[])[0]?.dataIndex ?? 0;
                const d = byHour[i];
                const hh = String(i).padStart(2, '0');
                if (!d) return `${hh}:00 · ไม่มีใบ`;
                return `<b>ใบที่เข้าช่วง ${hh}:00–${String(i + 1).padStart(2, '0')}:00</b><br/>รอรับ P50 ${fmtDur(d.t_first_p50)}`
                    + `<br/>P90 ${fmtDur(d.t_first_p90)}<br/>${d.orders} ใบ · รับทันเวลา ${fmtPct(d.sla.rate)}`;
            },
        },
        xAxis: {
            type: 'category', data: Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')),
            axisTick: { show: false }, axisLine: { lineStyle: { color: dark ? '#434343' : '#d9d8d4' } },
        },
        yAxis: { type: 'value', name: 'นาที (P50)', splitLine: grid(dark), nameTextStyle: { align: 'left' } },
        series: [{
            type: 'bar', barMaxWidth: 18,
            data: byHour.map(d => minutes(d?.t_first_p50 ?? null)),
            itemStyle: { color: pal.one, borderRadius: [4, 4, 0, 0] },
        }],
    }, [data, dark]);
    return <div ref={ref} style={{ height: 260 }} />;
}

/** เวลาแต่ละขั้นตามความด่วน (มัธยฐาน) — แท่งนอนซ้อนตามลำดับขั้น */
function StageBars({ data, dark }: { data: Dashboard['by_priority']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const rows = PRIORITY_ORDER.map(p => data.find(d => d.priority === p)).filter(Boolean) as Dashboard['by_priority'];
    const stages: { key: Stage; name: string }[] = [
        { key: 't_first', name: 'รอห้องยารับ' },
        { key: 't_prep', name: 'รับ → จัดยาเสร็จ' },
        { key: 't_pickup', name: 'ยารอตึกมารับ' },
    ];
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 84, right: 24, top: 36, bottom: 28 },
        legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 12 },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const i = (ps as { dataIndex: number }[])[0]?.dataIndex ?? 0;
                const r = rows[i];
                if (!r) return '';
                return `<b>${PRIORITY[r.priority].label}</b> · ${r.orders} ใบ<br/>`
                    + stages.map(s => `${s.name}: P50 ${fmtDur(r.durations[s.key].p50)} · P90 ${fmtDur(r.durations[s.key].p90)}`).join('<br/>');
            },
        },
        xAxis: { type: 'value', name: 'นาที', splitLine: grid(dark) },
        yAxis: { type: 'category', data: rows.map(r => PRIORITY[r.priority].label), inverse: true, axisTick: { show: false } },
        series: stages.map((s, i) => ({
            name: s.name, type: 'bar', stack: 't', barMaxWidth: 24,
            data: rows.map(r => minutes(r.durations[s.key].p50) ?? 0),
            itemStyle: {
                color: pal.stage[i],
                borderColor: pal.surface, borderWidth: 1,
                borderRadius: i === stages.length - 1 ? [0, 4, 4, 0] : 0,
            },
            emphasis: { focus: 'series' },
        })),
    }, [data, dark]);
    return <div ref={ref} style={{ height: 40 + rows.length * 52 + 40 }} />;
}

/** การกระจายของเวลา ส่ง → ยาพร้อม */
function LeadHistogram({ data, dark }: { data: Dashboard['lead_histogram']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const total = data.reduce((a, b) => a + b.n, 0);
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 40, right: 16, top: 16, bottom: 40 },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const p = (ps as { dataIndex: number; value: number }[])[0];
                return `${LEAD_BUCKETS[p.dataIndex]}<br/><b>${p.value} ใบ</b> (${fmtPct(share(p.value, total))})`;
            },
        },
        xAxis: { type: 'category', data: LEAD_BUCKETS, axisTick: { show: false }, axisLabel: { interval: 0, fontSize: 11 } },
        yAxis: { type: 'value', minInterval: 1, splitLine: grid(dark) },
        series: [{
            type: 'bar', barMaxWidth: 24,
            data: LEAD_BUCKETS.map((_, i) => data.find(d => d.bucket === i)?.n ?? 0),
            itemStyle: { color: pal.one, borderRadius: [4, 4, 0, 0] },
        }],
    }, [data, dark]);
    return <div ref={ref} style={{ height: 260 }} />;
}

/** ปริมาณรายหอ แยกความด่วน — แท่งนอนเรียงจากมากไปน้อย */
function WardVolume({ data, dark }: { data: Dashboard['by_ward']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const rows = data.slice(0, 15);
    const order: RxPriority[] = ['routine', 'discharge', 'stat'];
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 120, right: 40, top: 32, bottom: 16 },
        legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 12, data: [...order].reverse().map(p => PRIORITY[p].label) },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        xAxis: { type: 'value', minInterval: 1, splitLine: grid(dark) },
        yAxis: {
            type: 'category', inverse: true, axisTick: { show: false },
            data: rows.map(r => r.ward_name), axisLabel: { width: 110, overflow: 'truncate' },
        },
        series: order.map((p, i) => ({
            name: PRIORITY[p].label, type: 'bar', stack: 'n', barMaxWidth: 18,
            data: rows.map(r => r[p]),
            itemStyle: {
                color: pal.prio[p], borderColor: pal.surface, borderWidth: 1,
                borderRadius: i === order.length - 1 ? [0, 4, 4, 0] : 0,
            },
            /* ตัวเลขรวมที่ปลายแท่งเดียว ไม่ใส่ทุกชั้น */
            label: i === order.length - 1 ? {
                show: true, position: 'right', color: baseText(dark).color, fontSize: 11,
                formatter: (p2: unknown) => String(rows[(p2 as { dataIndex: number }).dataIndex]?.orders ?? ''),
            } : undefined,
        })),
    }, [data, dark]);
    return <div ref={ref} style={{ height: Math.max(160, 48 + rows.length * 30) }} />;
}

/* ───────────────────────── หน้า ───────────────────────── */

/* สร้างตอนเปิดหน้า ไม่ใช่ตอนโหลดไฟล์ จอห้องยาเปิดค้างข้ามวัน "วันนี้" ต้องเป็นวันนี้จริง */
const makePresets = (): { label: string; value: [Dayjs, Dayjs] }[] => [
    { label: 'วันนี้', value: [dayjs().startOf('day'), dayjs()] },
    { label: '7 วัน', value: [dayjs().subtract(6, 'day'), dayjs()] },
    { label: '30 วัน', value: [dayjs().subtract(29, 'day'), dayjs()] },
    { label: 'เดือนนี้', value: [dayjs().startOf('month'), dayjs()] },
    { label: 'เดือนที่แล้ว', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
    { label: '90 วัน', value: [dayjs().subtract(89, 'day'), dayjs()] },
];

/**
 * วิเคราะห์การรับส่งใบสั่งยา หอผู้ป่วย → ห้องยา
 *
 * ตอบคำถามสี่ข้อ ตามลำดับที่หัวหน้าห้องยาและหัวหน้าหอถามกันจริง
 *   1. ตอนนี้มีอะไรค้าง (แถบบนสุด ไม่ขึ้นกับช่วงวันที่)
 *   2. รับทันเวลาไหม ช้าที่ขั้นไหน (เวลาแต่ละขั้น แยกความด่วน)
 *   3. งานเข้าช่วงไหน ช่วงไหนตามไม่ทัน (วัน × ชั่วโมง)
 *   4. หอไหน / ใคร ทำอะไรไปเท่าไหร่ ส่งกลับเพราะอะไร
 *
 * ตัวเลขทุกตัวคิดที่เซิร์ฟเวอร์ หน้านี้ไม่ได้รับรายใบหรือข้อมูลผู้ป่วยเลย
 */
export default function RxDashboardPage() {
    const { wardList } = usePharmacy();
    const { resolved } = useThemeMode();
    const dark = resolved === 'dark';

    const presets = useMemo(makePresets, []);
    const [range, setRange] = useState<[Dayjs, Dayjs]>(() => makePresets()[2].value);
    const [wards, setWards] = useState<number[]>([]);
    const [prios, setPrios] = useState<RxPriority[]>([]);
    const [data, setData] = useState<Dashboard | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dailyView, setDailyView] = useState<'chart' | 'table'>('chart');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get('/api/v1/rx/dashboard', {
                headers: getAuthHeaders(),
                params: {
                    from: range[0].format('YYYY-MM-DD'),
                    to: range[1].format('YYYY-MM-DD'),
                    wards: wards.join(',') || undefined,
                    priorities: prios.join(',') || undefined,
                },
            });
            setData(res.data.data as Dashboard);
        } catch (err) {
            setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'โหลดข้อมูลไม่สำเร็จ' : 'โหลดข้อมูลไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [range, wards, prios]);

    useEffect(() => { load(); }, [load]);

    const s = data?.summary;
    const d = s?.durations;

    const wardColumns: ColumnsType<Dashboard['by_ward'][number]> = useMemo(() => [
        { title: 'หอผู้ป่วย', dataIndex: 'ward_name', key: 'w', fixed: 'left', width: 150 },
        { title: 'ใบ', dataIndex: 'orders', key: 'o', align: 'right', width: 70, sorter: (a, b) => a.orders - b.orders, defaultSortOrder: 'descend' },
        { title: 'ผู้ป่วย', dataIndex: 'patients', key: 'pt', align: 'right', width: 70, sorter: (a, b) => a.patients - b.patients },
        {
            title: 'STAT', key: 'stat', align: 'right', width: 80, sorter: (a, b) => a.stat - b.stat,
            render: (_, r) => <>{r.stat} <span className="text-slate-400 text-xs">{fmtPct(share(r.stat, r.orders))}</span></>,
        },
        {
            title: 'รับทันเวลา', key: 'sla', align: 'right', width: 110,
            sorter: (a, b) => (a.sla.rate ?? -1) - (b.sla.rate ?? -1),
            render: (_, r) => (
                <span className="inline-flex items-center gap-1.5 justify-end">
                    {fmtPct(r.sla.rate)} <StatusBadge s={slaStatus(r.sla.rate)} />
                </span>
            ),
        },
        {
            title: 'รอรับ P50 / P90', key: 'tf', align: 'right', width: 140,
            sorter: (a, b) => (a.t_first.p50 ?? 0) - (b.t_first.p50 ?? 0),
            render: (_, r) => <>{fmtDur(r.t_first.p50)} <span className="text-slate-400 text-xs">/ {fmtDur(r.t_first.p90)}</span></>,
        },
        {
            title: 'ส่ง → ยาพร้อม P50', key: 'tl', align: 'right', width: 130,
            sorter: (a, b) => (a.t_lead.p50 ?? 0) - (b.t_lead.p50 ?? 0),
            render: (_, r) => fmtDur(r.t_lead.p50),
        },
        {
            title: 'ยารอตึกมารับ P50', key: 'tp', align: 'right', width: 130,
            sorter: (a, b) => (a.t_pickup.p50 ?? 0) - (b.t_pickup.p50 ?? 0),
            render: (_, r) => fmtDur(r.t_pickup.p50),
        },
        {
            title: 'ส่งกลับ', key: 'rj', align: 'right', width: 90,
            sorter: (a, b) => (share(a.rejected, a.orders) ?? 0) - (share(b.rejected, b.orders) ?? 0),
            render: (_, r) => <>{r.rejected} <span className="text-slate-400 text-xs">{fmtPct(share(r.rejected, r.orders))}</span></>,
        },
        {
            title: <Tooltip title="ค้นชื่อใน HIS ไม่เจอตอนส่ง ห้องยาต้องตรวจ HN กับภาพเอง">HN ไม่ยืนยัน</Tooltip>,
            key: 'uv', align: 'right', width: 100,
            sorter: (a, b) => a.unverified - b.unverified,
            render: (_, r) => <>{r.unverified} <span className="text-slate-400 text-xs">{fmtPct(share(r.unverified, r.orders))}</span></>,
        },
        { title: 'ฉบับแก้', dataIndex: 'resends', key: 'rs', align: 'right', width: 80 },
        { title: 'NG-Tube', dataIndex: 'tube_feed', key: 'tf2', align: 'right', width: 80 },
    ], []);

    const staffColumns: ColumnsType<Dashboard['by_staff'][number]> = useMemo(() => [
        { title: 'เจ้าหน้าที่', dataIndex: 'name', key: 'n', fixed: 'left', width: 180 },
        { title: 'รับใบ', dataIndex: 'ack', key: 'a', align: 'right', width: 70, sorter: (a, b) => a.ack - b.ack, defaultSortOrder: 'descend' },
        { title: 'คีย์ HIS', dataIndex: 'key', key: 'k', align: 'right', width: 80, sorter: (a, b) => a.key - b.key },
        { title: 'จัดยาเสร็จ', dataIndex: 'prep', key: 'p', align: 'right', width: 90, sorter: (a, b) => a.prep - b.prep },
        { title: 'ส่งมอบ', dataIndex: 'handover', key: 'h', align: 'right', width: 80, sorter: (a, b) => a.handover - b.handover },
        { title: 'ส่งกลับ', dataIndex: 'reject', key: 'r', align: 'right', width: 80, sorter: (a, b) => a.reject - b.reject },
        {
            title: <Tooltip title="ใบที่คนนี้กดรับ: นับจากหอส่งถึงกดรับ">รอรับ P50</Tooltip>,
            key: 'ta', align: 'right', width: 100, render: (_, r) => fmtDur(r.t_ack_p50),
            sorter: (a, b) => (a.t_ack_p50 ?? 0) - (b.t_ack_p50 ?? 0),
        },
        {
            title: <Tooltip title="ใบที่คนนี้กดจัดยาเสร็จ: นับจากกดรับถึงจัดเสร็จ">รับ → จัดเสร็จ P50</Tooltip>,
            key: 'tp', align: 'right', width: 130, render: (_, r) => fmtDur(r.t_prep_p50),
            sorter: (a, b) => (a.t_prep_p50 ?? 0) - (b.t_prep_p50 ?? 0),
        },
        {
            title: <Tooltip title="ใบที่คนนี้กดคีย์เสร็จ: นับจากกดรับถึงคีย์เสร็จ">รับ → คีย์เสร็จ P50</Tooltip>,
            key: 'tk', align: 'right', width: 130, render: (_, r) => fmtDur(r.t_key_p50),
        },
    ], []);

    const stageRows = useMemo(() => {
        if (!data) return [];
        const stages: { key: Stage; name: string }[] = [
            { key: 't_first', name: 'ส่ง → ห้องยารับ' },
            { key: 't_key', name: 'รับ → คีย์ HIS เสร็จ' },
            { key: 't_prep', name: 'รับ → จัดยาเสร็จ' },
            { key: 't_lead', name: 'ส่ง → ยาพร้อม' },
            { key: 't_pickup', name: 'ยาพร้อม → ตึกมารับ' },
            { key: 't_total', name: 'ส่ง → ตึกรับยาไป' },
        ];
        return stages.map(st => ({
            key: st.key, name: st.name,
            all: data.summary.durations[st.key],
            ...Object.fromEntries(PRIORITY_ORDER.map(p => [p, data.by_priority.find(b => b.priority === p)?.durations[st.key] ?? null])),
        })) as ({ key: Stage; name: string; all: Dur } & Record<RxPriority, Dur | null>)[];
    }, [data]);

    const empty = !!data && data.summary.orders === 0;
    const slaTxt = data
        ? `เกณฑ์รับทันเวลา: STAT ${data.sla_seconds.stat / 60} นาที · กลับบ้าน ${data.sla_seconds.discharge / 60} นาที · ปกติ ${data.sla_seconds.routine / 60} นาที (ตรงกับที่หน้าคิวขึ้นเตือน)`
        : '';

    return (
        <div className="flex flex-col gap-4">
            {/* ตัวกรองแถวเดียวเหนือกราฟทั้งหมด — ใช้กับทุกส่วนของหน้า */}
            <div className="flex flex-wrap items-center gap-2">
                <PiChartBarBold size={20} className="text-[#24497a] dark:text-[#86b6ef]" />
                <h1 className="text-lg font-semibold m-0 mr-auto">วิเคราะห์การรับส่งใบสั่งยา</h1>
                <RangePicker
                    value={range}
                    onChange={v => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
                    presets={presets}
                    allowClear={false}
                    /* ตัวเลขล้วน — ปฏิทินของ antd ไม่ได้ตั้งภาษาไทย ชื่อเดือนจะขึ้นเป็นภาษาอังกฤษ */
                    format="D/M/BB"
                    disabledDate={c => c.isAfter(dayjs(), 'day')}
                />
                <Select
                    mode="multiple" allowClear maxTagCount="responsive" optionFilterProp="label"
                    placeholder="ทุกหอผู้ป่วย" className="min-w-48"
                    value={wards} onChange={setWards}
                    options={wardList.map(w => ({ value: w.ward, label: w.ward_name }))}
                />
                <Select
                    mode="multiple" allowClear placeholder="ทุกความด่วน" className="min-w-40"
                    value={prios} onChange={setPrios}
                    options={PRIORITY_ORDER.map(p => ({
                        value: p,
                        label: <span className="inline-flex items-center gap-1.5"><PriorityDot color={PRIORITY[p].dot} />{PRIORITY[p].label}</span>,
                    }))}
                />
                <Button icon={<PiArrowClockwiseBold />} onClick={load} loading={loading}>รีเฟรช</Button>
            </div>

            {error && <Alert type="error" showIcon title={error} />}

            {/* งานค้างตอนนี้ — ไม่ขึ้นกับช่วงวันที่ */}
            {data && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                        <PiTrayBold /> งานค้างตอนนี้
                        <span className="text-xs font-normal text-slate-500">ไม่ขึ้นกับช่วงวันที่ · กรองตามหอและความด่วนที่เลือก</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                        <Kpi label="รอห้องยารับ" value={nf.format(data.backlog.waiting)}
                            status={data.backlog.overdue > 0 ? STATUS.critical : data.backlog.waiting > 0 ? null : STATUS.good}
                            sub={data.backlog.overdue > 0
                                ? `เกินเวลา ${data.backlog.overdue} ใบ · นานสุด ${fmtDur(data.backlog.oldest_waiting)}`
                                : data.backlog.waiting > 0 ? `นานสุด ${fmtDur(data.backlog.oldest_waiting)}` : 'ไม่มีใบค้าง'} />
                        <Kpi label="รับแล้ว กำลังทำ" value={nf.format(data.backlog.working)} />
                        <Kpi label="คีย์ HIS แล้ว รอจัดยา" value={nf.format(data.backlog.keyed)} />
                        <Kpi label="ยาพร้อม รอตึกมารับ" value={nf.format(data.backlog.ready)}
                            sub={data.backlog.ready > 0 ? `วางรอนานสุด ${fmtDur(data.backlog.oldest_ready)}` : undefined} />
                        <Kpi label="ส่งกลับ ยังไม่ปิดเรื่อง" value={nf.format(data.backlog.rejected_open)}
                            hint="หอยังไม่ได้ส่งฉบับแก้ และยังไม่มีใครกดปิดเรื่อง" />
                    </div>
                </div>
            )}

            {loading && !data && <DashboardSkeleton kpis={8} charts={6} kpiGrid="grid-cols-2 md:grid-cols-4 xl:grid-cols-8" />}

            {empty && (
                <Card><Empty description="ไม่มีใบสั่งยาในช่วงที่เลือก" /></Card>
            )}

            {data && s && d && !empty && (
                <>
                    {/* ตัวเลขหลักของช่วงที่เลือก */}
                    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
                        <Kpi label="ใบสั่งยา" value={nf.format(s.orders)}
                            sub={`${nf.format(s.patients)} ผู้ป่วย · ${s.wards} หอ · ${(s.orders / data.range.days).toFixed(1)} ใบ/วัน`} />
                        <Kpi label="รับทันเวลา" value={fmtPct(s.sla.rate)} status={slaStatus(s.sla.rate)}
                            sub={`${nf.format(s.sla.met)} จาก ${nf.format(s.sla.n)} ใบ`} hint={slaTxt} />
                        <Kpi label="รอห้องยารับ (P50)" value={fmtDur(d.t_first.p50)} sub={`ใบที่ช้า (P90) ${fmtDur(d.t_first.p90)}`} />
                        <Kpi label="ส่ง → ยาพร้อม (P50)" value={fmtDur(d.t_lead.p50)} sub={`P90 ${fmtDur(d.t_lead.p90)}`}
                            hint="เวลาที่หอรู้สึกจริง: ตั้งแต่กดส่งจนยาจัดเสร็จพร้อมให้มารับ" />
                        <Kpi label="ยารอตึกมารับ (P50)" value={fmtDur(d.t_pickup.p50)} sub={`P90 ${fmtDur(d.t_pickup.p90)}`}
                            hint="ยาจัดเสร็จแล้ววางที่เคาน์เตอร์นานแค่ไหนกว่าตึกจะมารับ" />
                        <Kpi label="ส่งกลับ" value={fmtPct(share(s.rejected, s.orders))}
                            sub={`${s.rejected} ใบ · ส่งฉบับแก้ ${s.resends} ใบ`} />
                        <Kpi label="HN ไม่ยืนยันกับ HIS" value={fmtPct(share(s.unverified, s.orders))}
                            sub={`${s.unverified} ใบ`} hint="ค้นชื่อใน HIS ไม่เจอตอนส่ง ห้องยาต้องตรวจ HN กับภาพเอง" />
                        <Kpi label="เปิดดูไฟล์ต่อใบ" value={s.orders ? (s.file_views / s.orders).toFixed(1) : '–'}
                            sub={`${nf.format(s.files)} หน้า · NG-Tube ${s.tube_feed} ใบ`}
                            hint="ห้องยาเปิดดูภาพกี่ครั้งต่อใบ ถ้าสูงผิดปกติแปลว่าภาพอ่านยากหรือต้องย้อนกลับมาดูบ่อย" />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <Section
                            title="ปริมาณใบรายวัน แยกตามความด่วน"
                            hint="ชี้ที่แท่งเพื่อดูรับทันเวลาและเวลารอของวันนั้น"
                            extra={<Segmented size="small" value={dailyView} onChange={v => setDailyView(v as 'chart' | 'table')}
                                options={[{ value: 'chart', label: 'กราฟ' }, { value: 'table', label: 'ตาราง' }]} />}
                        >
                            {dailyView === 'chart' ? <DailyVolume data={data.daily} dark={dark} /> : (
                                <Table
                                    size="small" rowKey="date" pagination={{ pageSize: 10, size: 'small' }} scroll={{ x: 'max-content' }}
                                    dataSource={[...data.daily].reverse()}
                                    columns={[
                                        { title: 'วันที่', dataIndex: 'date', render: (v: string) => dayjs(v).format('ddd D MMM') },
                                        { title: 'ใบ', dataIndex: 'orders', align: 'right' },
                                        ...PRIORITY_ORDER.map(p => ({ title: PRIORITY[p].label, dataIndex: p, align: 'right' as const })),
                                        { title: 'ส่งกลับ', dataIndex: 'rejected', align: 'right' },
                                        { title: 'รับทันเวลา', key: 'sla', align: 'right', render: (_: unknown, r: Dashboard['daily'][number]) => fmtPct(r.sla.rate) },
                                        { title: 'รอรับ P50', key: 'tf', align: 'right', render: (_: unknown, r: Dashboard['daily'][number]) => fmtDur(r.t_first_p50) },
                                        { title: 'ส่ง → ยาพร้อม P50', key: 'tl', align: 'right', render: (_: unknown, r: Dashboard['daily'][number]) => fmtDur(r.t_lead_p50) },
                                    ]}
                                />
                            )}
                        </Section>
                        <Section title="เวลาส่ง → ยาพร้อม รายวัน" hint="เส้นน้ำเงิน = ใบทั่วไป (มัธยฐาน) · เส้นเทา = ใบที่ช้า 10% สุดท้าย (P90)">
                            <DailyLead data={data.daily} dark={dark} />
                        </Section>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                        <div className="xl:col-span-2">
                            <Section title="เวลาแต่ละขั้น แยกตามความด่วน (มัธยฐาน)" hint="ขั้นที่ยาวที่สุดคือคอขวด · ชี้ที่แท่งเพื่อดู P90">
                                <StageBars data={data.by_priority} dark={dark} />
                            </Section>
                        </div>
                        <div className="xl:col-span-3">
                            <Section title="ตารางเวลาแต่ละขั้น" hint={slaTxt}>
                                <Table
                                    size="small" rowKey="key" pagination={false} scroll={{ x: 'max-content' }}
                                    dataSource={stageRows}
                                    columns={[
                                        { title: 'ขั้น', dataIndex: 'name', fixed: 'left' },
                                        {
                                            title: 'ทั้งหมด', key: 'all', align: 'right',
                                            render: (_, r) => <>{fmtDur(r.all.p50)} <span className="text-slate-400 text-xs">/ {fmtDur(r.all.p90)}</span></>,
                                        },
                                        ...PRIORITY_ORDER.map(p => ({
                                            title: <span className="inline-flex items-center gap-1.5"><PriorityDot color={PRIORITY[p].dot} />{PRIORITY[p].label}</span>,
                                            key: p, align: 'right' as const,
                                            render: (_: unknown, r: (typeof stageRows)[number]) => r[p]
                                                ? <>{fmtDur(r[p]!.p50)} <span className="text-slate-400 text-xs">/ {fmtDur(r[p]!.p90)}</span></>
                                                : '–',
                                        })),
                                    ]}
                                    summary={() => (
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0}><b>รับทันเวลา</b></Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="right">
                                                <span className="inline-flex items-center gap-1.5">{fmtPct(s.sla.rate)} <StatusBadge s={slaStatus(s.sla.rate)} /></span>
                                            </Table.Summary.Cell>
                                            {PRIORITY_ORDER.map((p, i) => {
                                                const b = data.by_priority.find(x => x.priority === p);
                                                return (
                                                    <Table.Summary.Cell key={p} index={i + 2} align="right">
                                                        {b ? <span className="inline-flex items-center gap-1.5">{fmtPct(b.sla.rate)} <StatusBadge s={slaStatus(b.sla.rate)} /></span> : '–'}
                                                    </Table.Summary.Cell>
                                                );
                                            })}
                                        </Table.Summary.Row>
                                    )}
                                />
                                <div className="text-xs text-slate-500 mt-2">ตัวเลข = มัธยฐาน (P50) / ใบที่ช้า (P90) · คีย์ HIS กับจัดยาสลับลำดับกันได้ จึงนับจากเวลารับทั้งคู่</div>
                            </Section>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <Section title="ใบเข้าตามวันและชั่วโมง" hint="ช่องเข้ม = ช่วงที่ใบเข้ามาก ใช้วางคนให้ตรงกับงาน">
                            <ArrivalHeatmap data={data.heatmap} dark={dark} />
                        </Section>
                        <Section title="เวลารอห้องยารับ ตามชั่วโมงที่ใบเข้า (มัธยฐาน)" hint="แท่งสูง = ช่วงที่ห้องยาตามไม่ทัน · ชี้เพื่อดูจำนวนใบและรับทันเวลา">
                            <HourlyWait data={data.hourly} dark={dark} />
                        </Section>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <Section title="การกระจายของเวลา ส่ง → ยาพร้อม" hint="ใบส่วนใหญ่อยู่ช่วงไหน และมีหางยาวแค่ไหน">
                            <LeadHistogram data={data.lead_histogram} dark={dark} />
                        </Section>
                        <Section title="ปริมาณใบรายหอ" hint={data.by_ward.length > 15 ? 'แสดง 15 หอที่ส่งมากที่สุด · ดูครบในตารางด้านล่าง' : undefined}>
                            <WardVolume data={data.by_ward} dark={dark} />
                        </Section>
                    </div>

                    <Section title="รายหอผู้ป่วย" hint="กดหัวคอลัมน์เพื่อเรียง · ใช้หาหอที่ส่งกลับบ่อยหรือ HN ไม่ยืนยันบ่อย (ควรอบรมการสแกน/ใส่ HN)">
                        <Table size="small" rowKey="ward" pagination={false} scroll={{ x: 'max-content' }}
                            dataSource={data.by_ward} columns={wardColumns} />
                    </Section>

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                        <div className="xl:col-span-3">
                            <Section title="ผลงานรายเจ้าหน้าที่ห้องยา" hint="นับตามขั้นที่แต่ละคนกด · หนึ่งใบมีได้หลายคน">
                                <Table size="small" rowKey="username" pagination={false} scroll={{ x: 'max-content' }}
                                    dataSource={data.by_staff} columns={staffColumns} />
                            </Section>
                        </div>
                        <div className="xl:col-span-2 flex flex-col gap-4">
                            <Section title="เหตุผลที่ส่งกลับ" hint="เหตุผลเดียวกันที่พิมพ์ต่างกันเล็กน้อยรวมเป็นบรรทัดเดียว">
                                {data.reject_reasons.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีใบที่ส่งกลับ" /> : (
                                    <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
                                        {data.reject_reasons.map((r, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <Tag className="m-0! shrink-0 tabular-nums">{r.n}</Tag>
                                                <span className="flex-1 min-w-0 wrap-break-word">{r.reason}</span>
                                                <span className="text-xs text-slate-400 shrink-0">{dayjs(r.last_at).format('D MMM')}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Section>
                            <Section title="ที่มาของ HN" hint="HN ที่พิมพ์เองหรืออ่านจากภาพมีโอกาสผิดมากกว่า">
                                <Table size="small" rowKey="source" pagination={false}
                                    dataSource={[...data.hn_source].sort((a, b) => b.orders - a.orders)}
                                    columns={[
                                        { title: 'ที่มา', dataIndex: 'source', render: (v: string) => HN_SOURCE_LABEL[v] ?? v },
                                        { title: 'ใบ', dataIndex: 'orders', align: 'right' },
                                        {
                                            title: 'ยืนยันกับ HIS', key: 'v', align: 'right',
                                            render: (_, r) => fmtPct(share(r.verified, r.orders)),
                                        },
                                        {
                                            title: 'ส่งกลับ', key: 'r', align: 'right',
                                            render: (_, r) => `${r.rejected} (${fmtPct(share(r.rejected, r.orders))})`,
                                        },
                                    ]} />
                            </Section>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <PiClockBold /> ช่วงข้อมูล {dayjs(data.range.from).format('D MMM BBBB')} – {dayjs(data.range.to).format('D MMM BBBB')}
                        ({data.range.days} วัน) · P50 = มัธยฐาน (ใบทั่วไป) · P90 = ใบที่ช้า 10% สุดท้าย · ไม่มีข้อมูลผู้ป่วยในหน้านี้
                    </div>
                </>
            )}
        </div>
    );
}
