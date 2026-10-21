'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import { Alert, Button, DatePicker, Empty, Input, Segmented, Select, Table, Tooltip } from 'antd';
import { DashboardSkeleton } from '@/app/components/Skeletons';
import type { ColumnsType } from 'antd/es/table';
import { PiArrowClockwiseBold, PiChartBarBold, PiInfoBold, PiMagnifyingGlassBold, PiUsersThreeBold } from 'react-icons/pi';
import Navbar from '../../components/Navbar';
import { getAuthHeaders } from '../../lib/auth';
import { useThemeMode } from '../../lib/theme';
import { currentFiscalYear, fiscalYearOptions, fiscalYearRange } from '../../lib/fiscalYear';
import {
    STATUS, StatusBadge, Kpi, Section, useChart, baseText, grid, axisLine, nf, fmtPct, share, type Status,
} from '../../lib/dashboardKit';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { RangePicker } = DatePicker;

/* ───────────────────────── รูปข้อมูลจาก POST /api/v1/dashboard/staffing ───────────────────────── */

interface Stats {
    shifts: number; recorded: number; measured: number; unrecorded: number; no_staff: number; type_mismatch: number;
    productivity: number | null; product_type: number | null;
    required: number; regular: number; total: number;
    required_per_shift: number | null; regular_per_shift: number | null; total_per_shift: number | null;
    shortfall: number; uncovered: number; excess: number;
    under: number; over: number; ok: number;
    patients: number; crisis: number; census: number; types: number[]; care: number[];
    completeness: number | null; patients_per_nurse: number | null;
    staff_shifts: number; ot_shifts: number; ot_hours: number; ot_share: number | null; rn_share: number | null;
}

interface UnitInfo {
    unit: number; primary_code: string; primary_name: string; label: string; combined: boolean;
    members: { his_code: string; ward_name: string }[];
}

interface Staffing {
    range: { from: string; to: string; days: number; grain: 'day' | 'week' | 'month' };
    shifts: { id: number; name: string; weight: number }[];
    units: UnitInfo[];
    definitions: {
        productivity_low: number; productivity_high: number; hours_per_shift: number; shift_hours: number;
        monthly_hours_standard: number; hist_edges: number[];
        severity_levels: { id: number; name: string; care_hours: number }[];
        care_levels: { id: number; name: string }[];
    };
    summary: Stats & { histogram: number[]; headcount: number; avg_census: number };
    by_bucket: (Stats & { key: string; start: string; end: string; days: number; new_admit: number; transfer_in: number; discharge: number; avg_census: number })[];
    by_shift: (Stats & { shift: number; name: string })[];
    by_unit: (Stats & UnitInfo & { beds: number | null; avg_census: number; occupancy: number | null; headcount: number })[];
    unit_bucket: { unit: number; bucket: string; productivity: number | null; measured: number; under: number; over: number; required_per_shift: number | null; total_per_shift: number | null }[];
    dow_shift: { dow: number; shift: number; productivity: number | null; measured: number; under: number; over: number; ot_shifts: number }[];
    people: {
        staff_id: number; name: string; position: string; units: string[]; unit_ids: number[];
        morning: number; afternoon: number; night: number; ot8: number; ot4: number;
        hours: number; hours_per_month: number | null; night_share: number | null;
    }[];
    care_flow: {
        nodes: { name: string; shiftTypeId: number; shiftName: string; careLevelId: number; careLevelName: string }[];
        links: { source: string; target: string; value: number; changed: boolean }[];
        totalTransitions: number; changedTransitions: number;
    };
}

/* ───────────────────────── สี ─────────────────────────
   ผ่านตัวตรวจสีของ dataviz แล้วทั้งสองโหมด (scripts/validate_palette.js)
   - productivity: สองขั้ว น้ำเงิน = กำลังเกินภาระงาน · เทา = ช่วงเหมาะสม · แดง = ภาระงานเกินกำลัง
     ไล่เข้มออกจากกลาง (โหมดมืดไล่สว่างออกจากกลาง) แต่ละแขนผ่านเกณฑ์ ramp
   - ประจำ = น้ำเงิน · OT = ส้ม · ที่ควรมี = เส้นหมึกเข้ม (หมวด 2 สี ผ่านเกณฑ์คนตาบอดสี)
   - ประเภทผู้ป่วย 1–5: น้ำเงินเฉดเดียว · ระดับการดูแล: ส้มเฉดเดียว (สองสเกลลำดับบนหน้าเดียวต้องคนละสี)
   - รับใหม่/รับย้าย/จำหน่าย: น้ำเงิน/เขียวน้ำทะเล/ส้ม ผ่านแบบทุกคู่ */
const PALETTE = {
    light: {
        regular: '#2a78d6', ot: '#eb6834', required: '#0b0b0b', context: '#a3a29d', surface: '#ffffff',
        band: 'rgba(11,11,11,0.05)', empty: '#f3f3f1',
        prod: ['#1c5cab', '#86b6ef', '#e1e0d9', '#f2a09f', '#e34948', '#a8302f'],
        types: ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#0d366b'],
        care: ['#ee9468', '#de5a26', '#a83d14', '#6b2509'],
        move: ['#2a78d6', '#1baf7a', '#eb6834'],
    },
    dark: {
        regular: '#3987e5', ot: '#d95926', required: '#f0efec', context: '#6e6d68', surface: '#1f1f1f',
        band: 'rgba(255,255,255,0.07)', empty: '#262626',
        prod: ['#6da7ec', '#256abf', '#383835', '#a8302f', '#e34948', '#f2a09f'],
        types: ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#b7d3f6'],
        care: ['#8a3a12', '#c24a17', '#eb6834', '#f5b48f'],
        move: ['#3987e5', '#199e70', '#d95926'],
    },
};

const SHIFT_LABEL: Record<number, string> = { 1: 'ดึก', 2: 'เช้า', 3: 'บ่าย' };
const SHIFT_TIME: Record<number, string> = { 1: '00–08', 2: '08–16', 3: '16–24' };
const DOW = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

/* ───────────────────────── ตัวช่วยแสดงผล ───────────────────────── */

const pctTxt = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${Math.round(v)}%`);
const num1 = (v: number | null | undefined) => (v === null || v === undefined ? '–' : (Math.round(v * 10) / 10).toLocaleString('th-TH'));
/** ผลรวมคน·เวร — ค่าใหญ่ไม่ต้องมีทศนิยม ค่าเล็กยังต้องเห็นว่าขาดครึ่งคน */
const personShifts = (v: number) => (Math.abs(v) >= 100 ? nf.format(Math.round(v)) : num1(v));
/** ชื่อหน่วยงานใส่ลงกล่อง tooltip ที่เป็น HTML จึงกันแท็กไว้อีกชั้น */
const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * ช่องสีของ productivity: <70 · 70–ต่ำ · เหมาะสม · สูง–130 · 130–150 · ≥150
 * ช่วงเหมาะสมรวมขอบทั้งสองข้าง (90 และ 110 ยังเหมาะสม) ตรงกับที่เซิร์ฟเวอร์จัดเวรเข้ากลุ่ม
 */
const prodPiece = (v: number, e: number[]) =>
    v > e[2] ? (v < e[3] ? 3 : v < e[4] ? 4 : 5) : v >= e[1] ? 2 : v < e[0] ? 0 : 1;

/** ค่าแทน "วัดไม่ได้" ในตารางสี — ต้องเป็นตัวเลขให้ช่องยังถูกวาดเป็นสีเทา ไม่ใช่หายไป */
const NO_VALUE = -1;

/**
 * heatmap ของ echarts ต้องมี visualMap เสมอ (โหมด dev โยน error ถ้าไม่มี)
 * จึงให้ visualMap แบบช่วงเป็นตัวลงสี ใช้ขอบช่วงเดียวกับ prodPiece และซ่อนไว้ เพราะมีคำอธิบายสีของหน้าเองแล้ว
 */
const prodVisualMap = (e: number[], colors: string[], empty: string) => ({
    type: 'piecewise' as const, show: false, dimension: 2, seriesIndex: 0,
    pieces: [
        { lt: 0, color: empty },
        { gte: 0, lt: e[0], color: colors[0] },
        { gte: e[0], lt: e[1], color: colors[1] },
        { gte: e[1], lte: e[2], color: colors[2] },
        { gt: e[2], lt: e[3], color: colors[3] },
        { gte: e[3], lt: e[4], color: colors[4] },
        { gte: e[4], color: colors[5] },
    ],
});

/** ช่องของตารางสี productivity — ค่าที่แสดงเป็นจำนวนเต็ม และสีคิดจากค่าเดียวกับที่แสดง */
const prodCell = (x: number, y: number, v: number | null, e: number[], pal: (typeof PALETTE)['light'], dark: boolean) => {
    if (v === null) return { value: [x, y, NO_VALUE], label: { color: baseText(dark).color } };
    const shown = Math.round(v);
    return { value: [x, y, shown], label: { color: inkOn(pal.prod[prodPiece(shown, e)]) } };
};

/** ตัวอักษรบนช่องสี: พื้นเข้มใช้ขาว พื้นอ่อนใช้ดำ */
const inkOn = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#0b0b0b' : '#ffffff';
};

const bucketLabel = (key: string, grain: Staffing['range']['grain']) =>
    grain === 'month' ? dayjs(`${key}-01`).format('MMM BB') : dayjs(key).format('D MMM');
const bucketLong = (b: { key: string; start: string; end: string }, grain: Staffing['range']['grain']) =>
    grain === 'month' ? dayjs(`${b.key}-01`).format('MMMM BBBB')
        : grain === 'week' ? `สัปดาห์ ${dayjs(b.start).format('D MMM')} – ${dayjs(b.end).format('D MMM BB')}`
            : dayjs(b.key).format('dddd D MMM BB');

const band = (d: Staffing['definitions'], v: number | null): Status | null => {
    if (v === null) return null;
    if (v > d.productivity_high) return { ...STATUS.critical, label: 'ภาระงานเกิน' };
    if (v < d.productivity_low) return { ...STATUS.warning, label: 'กำลังเกิน' };
    return { ...STATUS.good, label: 'เหมาะสม' };
};

/** สัญลักษณ์สีของ productivity ใช้ร่วมกับทุกกราฟที่ระบายตามช่วง */
function ProdLegend({ d, dark }: { d: Staffing['definitions']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const e = d.hist_edges;
    const labels = [`< ${e[0]}%`, `${e[0]}–${e[1]}`, `${e[1]}–${e[2]} เหมาะสม`, `${e[2]}–${e[3]}`, `${e[3]}–${e[4]}`, `≥ ${e[4]}%`];
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>กำลังเกินภาระงาน</span>
            {labels.map((l, i) => (
                <span key={l} className="inline-flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm" style={{ background: pal.prod[i] }} />{l}
                </span>
            ))}
            <span>ภาระงานเกินกำลัง</span>
        </div>
    );
}

/* ───────────────────────── กราฟ ───────────────────────── */

type Bucket = Staffing['by_bucket'][number];

/** พยาบาลต่อเวรเฉลี่ย: ประจำ + OT (แท่งซ้อน) เทียบที่ควรมีตามภาระงาน (เส้น) — หน่วยเดียวกัน แกนเดียว */
function StaffTrend({ data, grain, dark }: { data: Bucket[]; grain: Staffing['range']['grain']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const REG = 'ประจำ';
    const OT = 'OT';
    const REQ = 'ควรมีตามภาระงาน';
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 44, right: 16, top: 40, bottom: 32 },
        /* legend ชิดขวา ฝั่งซ้ายบนเป็นที่ของชื่อแกน */
        legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 12, data: [REG, OT, REQ] },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const b = data[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
                if (!b) return '';
                if (!b.recorded) return `<b>${bucketLong(b, grain)}</b><br/>ไม่มีเวรที่เทียบได้`;
                return `<b>${bucketLong(b, grain)}</b> · ${b.recorded} เวร`
                    + `<br/>ควรมี ${num1(b.required_per_shift)} คน/เวร`
                    + `<br/>มีจริง ${num1(b.total_per_shift)} (ประจำ ${num1(b.regular_per_shift)})`
                    + `<br/>ขาดคนประจำรวม ${num1(b.shortfall)} คน·เวร · OT ${b.ot_shifts} เวร`
                    + `<br/>productivity ${pctTxt(b.productivity)}`;
            },
        },
        xAxis: { type: 'category', data: data.map(b => bucketLabel(b.key, grain)), axisTick: { show: false }, axisLine: axisLine(dark) },
        yAxis: { type: 'value', name: 'คน/เวร', splitLine: grid(dark), nameTextStyle: { align: 'right' } },
        series: [
            {
                name: REG, type: 'bar', stack: 'have', barMaxWidth: 28,
                data: data.map(b => b.regular_per_shift),
                itemStyle: { color: pal.regular, borderColor: pal.surface, borderWidth: 1 },
            },
            {
                name: OT, type: 'bar', stack: 'have', barMaxWidth: 28,
                data: data.map(b => (b.total_per_shift !== null && b.regular_per_shift !== null ? Math.round((b.total_per_shift - b.regular_per_shift) * 100) / 100 : null)),
                itemStyle: { color: pal.ot, borderColor: pal.surface, borderWidth: 1, borderRadius: [4, 4, 0, 0] },
            },
            {
                name: REQ, type: 'line', z: 5, symbolSize: 7,
                data: data.map(b => b.required_per_shift),
                lineStyle: { width: 2, color: pal.required },
                itemStyle: { color: pal.required, borderColor: pal.surface, borderWidth: 2 },
            },
        ],
    }, [data, grain, dark]);
    return <div ref={ref} style={{ height: 320 }} />;
}

/** productivity รายช่วง เทียบช่วงเหมาะสม (แถบพื้น) — สองเส้นหน่วยเดียวกัน */
function ProductivityTrend({ data, grain, d, dark }: { data: Bucket[]; grain: Staffing['range']['grain']; d: Staffing['definitions']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const P = 'ตามระดับการดูแล';
    const PT = 'ตามประเภทผู้ป่วย 1–5';
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 44, right: 16, top: 40, bottom: 32 },
        legend: { top: 0, right: 0, itemWidth: 14, itemHeight: 3, data: [P, PT] },
        tooltip: {
            trigger: 'axis',
            formatter: (ps: unknown) => {
                const b = data[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
                if (!b) return '';
                return `<b>${bucketLong(b, grain)}</b> · วัดได้ ${b.measured} เวร`
                    + `<br/>${P}: ${pctTxt(b.productivity)}<br/>${PT}: ${pctTxt(b.product_type)}`
                    + `<br/>ภาระงานเกิน ${b.under} · เหมาะสม ${b.ok} · กำลังเกิน ${b.over} เวร`;
            },
        },
        xAxis: { type: 'category', data: data.map(b => bucketLabel(b.key, grain)), axisTick: { show: false }, axisLine: axisLine(dark) },
        yAxis: { type: 'value', name: '%', splitLine: grid(dark), nameTextStyle: { align: 'right' } },
        series: [
            {
                name: PT, type: 'line', connectNulls: false, symbolSize: 6,
                lineStyle: { width: 2, color: pal.context }, itemStyle: { color: pal.context },
                data: data.map(b => b.product_type),
            },
            {
                name: P, type: 'line', connectNulls: false, symbolSize: 8,
                lineStyle: { width: 2, color: pal.regular },
                itemStyle: { color: pal.regular, borderColor: pal.surface, borderWidth: 2 },
                data: data.map(b => b.productivity),
                markArea: {
                    silent: true,
                    itemStyle: { color: pal.band },
                    label: { show: true, position: 'insideTopRight', color: baseText(dark).color, fontSize: 11, formatter: `ช่วงเหมาะสม ${d.productivity_low}–${d.productivity_high}%` },
                    data: [[{ yAxis: d.productivity_low }, { yAxis: d.productivity_high }]],
                },
            },
        ],
    }, [data, grain, d, dark]);
    return <div ref={ref} style={{ height: 320 }} />;
}

/** หน่วยงาน × ช่วงเวลา ระบายตามช่วง productivity — หาว่าที่ไหน เมื่อไหร่ กำลังไม่พอดีกับงาน */
function UnitHeat({ data, units, buckets, grain, d, dark }: {
    data: Staffing['unit_bucket']; units: Staffing['by_unit']; buckets: Bucket[];
    grain: Staffing['range']['grain']; d: Staffing['definitions']; dark: boolean;
}) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const showLabel = buckets.length <= 16;
    const cells = units.flatMap((u, y) => buckets.map((b, x) => {
        const c = data.find(v => v.unit === u.unit && v.bucket === b.key);
        return prodCell(x, y, c?.productivity ?? null, d.hist_edges, pal, dark);
    }));
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 160, right: 12, top: 8, bottom: 32 },
        visualMap: prodVisualMap(d.hist_edges, pal.prod, pal.empty),
        tooltip: {
            formatter: (p: unknown) => {
                const [x, y] = (p as { value: [number, number, number | string] }).value;
                const u = units[y];
                const b = buckets[x];
                const c = data.find(v => v.unit === u.unit && v.bucket === b.key);
                if (!c || c.productivity === null) return `${esc(u.label)}<br/>${bucketLong(b, grain)}<br/>วัดไม่ได้ (ไม่มีเวรที่ลงประเภทและมีคนขึ้น)`;
                return `${esc(u.label)}<br/>${bucketLong(b, grain)}<br/><b>productivity ${pctTxt(c.productivity)}</b> · ${c.measured} เวร`
                    + `<br/>ควรมี ${num1(c.required_per_shift)} · มีจริง ${num1(c.total_per_shift)} คน/เวร`
                    + `<br/>ภาระงานเกิน ${c.under} · กำลังเกิน ${c.over} เวร`;
            },
        },
        xAxis: { type: 'category', data: buckets.map(b => bucketLabel(b.key, grain)), axisTick: { show: false }, splitArea: { show: false } },
        yAxis: { type: 'category', inverse: true, data: units.map(u => u.label), axisTick: { show: false }, axisLabel: { width: 150, overflow: 'truncate' } },
        series: [{
            type: 'heatmap', data: cells,
            label: { show: showLabel, fontSize: 10, formatter: (p: unknown) => { const v = Number((p as { value: unknown[] }).value[2]); return v < 0 ? '–' : String(v); } },
            itemStyle: { borderColor: pal.surface, borderWidth: 2, borderRadius: 2 },
            emphasis: { itemStyle: { borderColor: dark ? '#e8e8e8' : '#0b0b0b', borderWidth: 1 } },
        }],
    }, [data, units, buckets, grain, d, dark]);
    return <div ref={ref} style={{ height: 44 + Math.max(1, units.length) * 28 }} />;
}

/** แต่ละเวร: ที่ควรมี เทียบ มีจริง (ประจำ + OT) เฉลี่ยต่อเวร */
function ShiftCompare({ data, dark }: { data: Staffing['by_shift']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 40, right: 16, top: 40, bottom: 28 },
        legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 12, data: ['ควรมี', 'ประจำ', 'OT'] },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const s = data[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
                if (!s) return '';
                return `<b>เวร${s.name}</b> (${SHIFT_TIME[s.shift] ?? ''}) · ${s.recorded} เวร`
                    + `<br/>ควรมี ${num1(s.required_per_shift)} · ประจำ ${num1(s.regular_per_shift)} · รวม OT ${num1(s.total_per_shift)} คน/เวร`
                    + `<br/>productivity ${pctTxt(s.productivity)} · ผู้ป่วย ${num1(s.patients_per_nurse)} คน/พยาบาล 1 คน`;
            },
        },
        xAxis: { type: 'category', data: data.map(s => `เวร${s.name}`), axisTick: { show: false }, axisLine: axisLine(dark) },
        yAxis: { type: 'value', name: 'คน/เวร', splitLine: grid(dark), nameTextStyle: { align: 'right' } },
        series: [
            {
                name: 'ควรมี', type: 'bar', stack: 'need', barMaxWidth: 36,
                data: data.map(s => s.required_per_shift),
                itemStyle: { color: pal.context, borderRadius: [4, 4, 0, 0] },
                label: { show: true, position: 'top', fontSize: 11, color: baseText(dark).color, formatter: (p: unknown) => num1((p as { value: number }).value) },
            },
            {
                name: 'ประจำ', type: 'bar', stack: 'have', barMaxWidth: 36,
                data: data.map(s => s.regular_per_shift),
                itemStyle: { color: pal.regular, borderColor: pal.surface, borderWidth: 1 },
            },
            {
                name: 'OT', type: 'bar', stack: 'have', barMaxWidth: 36,
                data: data.map(s => (s.total_per_shift !== null && s.regular_per_shift !== null ? Math.round((s.total_per_shift - s.regular_per_shift) * 100) / 100 : null)),
                itemStyle: { color: pal.ot, borderColor: pal.surface, borderWidth: 1, borderRadius: [4, 4, 0, 0] },
                label: {
                    show: true, position: 'top', fontSize: 11, color: baseText(dark).color,
                    formatter: (p: unknown) => num1(data[(p as { dataIndex: number }).dataIndex]?.total_per_shift),
                },
            },
        ],
    }, [data, dark]);
    return <div ref={ref} style={{ height: 300 }} />;
}

/** วันในสัปดาห์ × เวร — หาเวรที่ขาดคนเป็นประจำ */
function DowShiftHeat({ data, shifts, d, dark }: { data: Staffing['dow_shift']; shifts: Staffing['shifts']; d: Staffing['definitions']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const cells = Array.from({ length: 7 }, (_, y) => shifts.map((s, x) => {
        const c = data.find(v => v.dow === y + 1 && v.shift === s.id);
        return prodCell(x, y, c?.productivity ?? null, d.hist_edges, pal, dark);
    })).flat();
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 64, right: 12, top: 8, bottom: 28 },
        visualMap: prodVisualMap(d.hist_edges, pal.prod, pal.empty),
        tooltip: {
            formatter: (p: unknown) => {
                const [x, y] = (p as { value: [number, number, unknown] }).value;
                const c = data.find(v => v.dow === y + 1 && v.shift === shifts[x].id);
                if (!c || c.productivity === null) return `${DOW[y + 1]} เวร${shifts[x].name}<br/>วัดไม่ได้`;
                return `<b>${DOW[y + 1]} เวร${shifts[x].name}</b><br/>productivity ${pctTxt(c.productivity)} · ${c.measured} เวร`
                    + `<br/>ภาระงานเกิน ${c.under} · กำลังเกิน ${c.over} เวร · OT ${c.ot_shifts}`;
            },
        },
        xAxis: { type: 'category', data: shifts.map(s => `เวร${s.name}`), axisTick: { show: false }, splitArea: { show: false } },
        yAxis: { type: 'category', inverse: true, data: DOW.slice(1), axisTick: { show: false } },
        series: [{
            type: 'heatmap', data: cells,
            label: { show: true, fontSize: 11, formatter: (p: unknown) => { const v = Number((p as { value: unknown[] }).value[2]); return v < 0 ? '–' : String(v); } },
            itemStyle: { borderColor: pal.surface, borderWidth: 2, borderRadius: 2 },
        }],
    }, [data, shifts, d, dark]);
    return <div ref={ref} style={{ height: 260 }} />;
}

/** การกระจายของ productivity รายเวร — ช่วงเฉลี่ยดีอาจซ่อนเวรที่ขาดหนักไว้ */
function ProdHistogram({ data, d, dark }: { data: number[]; d: Staffing['definitions']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const e = d.hist_edges;
    const labels = [`< ${e[0]}`, `${e[0]}–${e[1]}`, `${e[1]}–${e[2]}`, `${e[2]}–${e[3]}`, `${e[3]}–${e[4]}`, `≥ ${e[4]}`];
    const total = data.reduce((a, b) => a + b, 0);
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 40, right: 16, top: 24, bottom: 40 },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const i = (ps as { dataIndex: number }[])[0]?.dataIndex ?? 0;
                return `productivity ${labels[i]}%<br/><b>${data[i]} เวร</b> (${fmtPct(share(data[i], total))})`;
            },
        },
        xAxis: { type: 'category', data: labels, axisTick: { show: false }, axisLine: axisLine(dark), name: 'productivity (%)', nameLocation: 'middle', nameGap: 26 },
        yAxis: { type: 'value', minInterval: 1, splitLine: grid(dark), name: 'เวร', nameTextStyle: { align: 'right' } },
        series: [{
            type: 'bar', barMaxWidth: 48,
            data: data.map((n, i) => ({ value: n, itemStyle: { color: pal.prod[i], borderRadius: [4, 4, 0, 0] } })),
            label: { show: true, position: 'top', fontSize: 11, color: baseText(dark).color, formatter: (p: unknown) => fmtPct(share((p as { value: number }).value, total)) },
        }],
    }, [data, d, dark]);
    return <div ref={ref} style={{ height: 260 }} />;
}

/** productivity รายหน่วยงาน เรียงจากสูงไปต่ำ ระบายตามช่วง */
function UnitBars({ data, d, dark }: { data: Staffing['by_unit']; d: Staffing['definitions']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const rows = data.filter(u => u.productivity !== null);
    /* deps อ้างข้อมูลต้นทาง ไม่ใช่ rows ที่สร้างใหม่ทุก render ไม่งั้นกราฟถูกสร้างใหม่ทุกครั้งที่พิมพ์ค้นหาในหน้า */
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 160, right: 48, top: 8, bottom: 28 },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const u = rows[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
                if (!u) return '';
                return `<b>${esc(u.label)}</b><br/>productivity ${pctTxt(u.productivity)} · ตามประเภท ${pctTxt(u.product_type)}`
                    + `<br/>ควรมี ${num1(u.required_per_shift)} · มีจริง ${num1(u.total_per_shift)} คน/เวร`
                    + `<br/>ภาระงานเกิน ${u.under} · เหมาะสม ${u.ok} · กำลังเกิน ${u.over} เวร`;
            },
        },
        xAxis: { type: 'value', splitLine: grid(dark), axisLabel: { formatter: '{value}%' } },
        yAxis: { type: 'category', inverse: true, data: rows.map(u => u.label), axisTick: { show: false }, axisLabel: { width: 150, overflow: 'truncate' } },
        series: [{
            type: 'bar', barMaxWidth: 18,
            data: rows.map(u => ({ value: u.productivity, itemStyle: { color: pal.prod[prodPiece(u.productivity!, d.hist_edges)], borderRadius: [0, 4, 4, 0] } })),
            label: { show: true, position: 'right', fontSize: 11, color: baseText(dark).color, formatter: (p: unknown) => pctTxt((p as { value: number }).value) },
            markArea: {
                silent: true, itemStyle: { color: pal.band },
                data: [[{ xAxis: d.productivity_low }, { xAxis: d.productivity_high }]],
            },
        }],
    }, [data, d, dark]);
    return <div ref={ref} style={{ height: 40 + Math.max(1, rows.length) * 28 }} />;
}

/** สัดส่วนประเภทผู้ป่วย 1–5 รายหน่วยงาน (100%) — ตัวขับภาระงาน */
function AcuityMix({ units, summary, d, dark }: { units: Staffing['by_unit']; summary: Staffing['summary']; d: Staffing['definitions']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const rows = [
        { label: 'ทุกหน่วยที่เลือก', types: summary.types },
        ...units.filter(u => u.types.some(n => n > 0)).map(u => ({ label: u.label, types: u.types })),
    ];
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 160, right: 16, top: 44, bottom: 24 },
        legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 12 },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const r = rows[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
                if (!r) return '';
                const t = r.types.reduce((a, b) => a + b, 0);
                return `<b>${esc(r.label)}</b> · ${nf.format(t)} คน·เวร<br/>`
                    + d.severity_levels.map((l, i) => `ประเภท ${l.id} (${l.care_hours} ชม./วัน): ${r.types[i]} (${fmtPct(share(r.types[i], t))})`).join('<br/>');
            },
        },
        xAxis: { type: 'value', max: 100, splitLine: grid(dark), axisLabel: { formatter: '{value}%' } },
        yAxis: { type: 'category', inverse: true, data: rows.map(r => r.label), axisTick: { show: false }, axisLabel: { width: 150, overflow: 'truncate' } },
        series: d.severity_levels.map((l, i) => ({
            name: `ประเภท ${l.id}`, type: 'bar', stack: 't', barMaxWidth: 18,
            data: rows.map(r => {
                const t = r.types.reduce((a, b) => a + b, 0);
                return t ? Math.round((r.types[i] / t) * 1000) / 10 : 0;
            }),
            itemStyle: {
                color: pal.types[i], borderColor: pal.surface, borderWidth: 1,
                borderRadius: i === 0 ? [4, 0, 0, 4] : i === d.severity_levels.length - 1 ? [0, 4, 4, 0] : 0,
            },
            emphasis: { focus: 'series' },
        })),
    }, [units, summary, d, dark]);
    return <div ref={ref} style={{ height: 70 + rows.length * 28 }} />;
}

/** รับใหม่ + รับย้าย (แท่งซ้อน) และจำหน่าย (เส้น) รายช่วง — หน่วยเดียวกัน */
function Movement({ data, grain, dark }: { data: Bucket[]; grain: Staffing['range']['grain']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 44, right: 16, top: 40, bottom: 32 },
        legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 12 },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const b = data[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
                if (!b) return '';
                return `<b>${bucketLong(b, grain)}</b><br/>รับใหม่ ${b.new_admit} · รับย้าย ${b.transfer_in} · จำหน่าย ${b.discharge}`
                    + `<br/>ผู้ป่วยเฉลี่ย ${num1(b.avg_census)} คน/วัน`;
            },
        },
        xAxis: { type: 'category', data: data.map(b => bucketLabel(b.key, grain)), axisTick: { show: false }, axisLine: axisLine(dark) },
        yAxis: { type: 'value', name: 'คน', minInterval: 1, splitLine: grid(dark), nameTextStyle: { align: 'right' } },
        series: [
            { name: 'รับใหม่', type: 'bar', stack: 'in', barMaxWidth: 28, data: data.map(b => b.new_admit), itemStyle: { color: pal.move[0], borderColor: pal.surface, borderWidth: 1 } },
            { name: 'รับย้าย', type: 'bar', stack: 'in', barMaxWidth: 28, data: data.map(b => b.transfer_in), itemStyle: { color: pal.move[1], borderColor: pal.surface, borderWidth: 1, borderRadius: [4, 4, 0, 0] } },
            {
                name: 'จำหน่าย', type: 'line', symbolSize: 7, z: 5, data: data.map(b => b.discharge),
                lineStyle: { width: 2, color: pal.move[2] }, itemStyle: { color: pal.move[2], borderColor: pal.surface, borderWidth: 2 },
            },
        ],
    }, [data, grain, dark]);
    return <div ref={ref} style={{ height: 300 }} />;
}

/** การเปลี่ยนระดับการดูแลข้ามเวร (ดึก → เช้า → บ่าย) */
function CareFlow({ data, dark }: { data: Staffing['care_flow']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const nodeById = new Map(data.nodes.map(n => [n.name, n]));
    const colorOf = (id: number) => pal.care[Math.min(pal.care.length, Math.max(1, id)) - 1];
    const ref = useChart(data.links.length === 0 ? null : {
        tooltip: {
            trigger: 'item',
            formatter: (p: unknown) => {
                const q = p as { dataType: string; name: string; value: number; data: { source?: string; target?: string; changed?: boolean } };
                if (q.dataType === 'edge') {
                    const a = nodeById.get(q.data.source ?? '');
                    const b = nodeById.get(q.data.target ?? '');
                    return `เวร${a?.shiftName} <b>${a?.careLevelName}</b> → เวร${b?.shiftName} <b>${b?.careLevelName}</b><br/><b>${q.value}</b> ราย · ${q.data.changed ? 'เปลี่ยนระดับ' : 'คงระดับเดิม'}`;
                }
                const n = nodeById.get(q.name);
                return `เวร${n?.shiftName} · <b>${n?.careLevelName}</b><br/><b>${q.value}</b> ราย`;
            },
        },
        series: [{
            type: 'sankey', left: 8, right: 120, top: 8, bottom: 8, nodeWidth: 14, nodeGap: 14,
            nodeAlign: 'left', draggable: false, emphasis: { focus: 'adjacency' },
            data: data.nodes.map(n => ({
                name: n.name, itemStyle: { color: colorOf(n.careLevelId), borderWidth: 0 },
                label: { color: baseText(dark).color, fontSize: 11, formatter: `${n.shiftName} · ${n.careLevelName}` },
            })),
            links: data.links.map(l => ({
                source: l.source, target: l.target, value: l.value, changed: l.changed,
                lineStyle: { color: l.changed ? 'source' : 'gradient', opacity: l.changed ? 0.55 : 0.22, curveness: 0.5 },
            })),
        }],
    }, [data, dark]);
    if (data.links.length === 0) {
        return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ต้องมีการบันทึกระดับการดูแลอย่างน้อย 2 เวรติดกันในวันเดียวกัน" />;
    }
    return <div ref={ref} style={{ height: 360 }} />;
}

/* ───────────────────────── หน้า ───────────────────────── */

const FY_SPAN = 6;
const MAX_DAYS = 366;

interface Ward { ward: number; ward_name: string; his_code: string }

/**
 * วิเคราะห์อัตรากำลังพยาบาล — เลือกปีงบหรือช่วงวันที่ กรองหอและเวรได้
 *
 * ตอบคำถามตามลำดับที่หัวหน้าหอและฝ่ายการพยาบาลถาม
 *   1. กำลังพอกับภาระงานไหม (productivity, ควรมี vs มีจริง, ขาด/เกิน)
 *   2. ไม่พอที่ไหน เมื่อไหร่ เวรไหน (หน่วยงาน × ช่วงเวลา, วัน × เวร, การกระจาย)
 *   3. อุดด้วยอะไร (OT, สัดส่วน RN) และใครแบกงานมาก (รายบุคคล)
 *   4. งานมาจากไหน (ประเภทผู้ป่วย, รับเข้า/จำหน่าย, การเปลี่ยนระดับการดูแล)
 *
 * ตัวเลขทุกตัวคิดที่เซิร์ฟเวอร์ด้วยสูตรเดียวกับหน้า FTE (utils/fte.ts)
 */
export default function IpdStaffingDashboard() {
    const { resolved } = useThemeMode();
    const dark = resolved === 'dark';

    const current = useMemo(() => currentFiscalYear(), []);
    const fyOptions = useMemo(() => fiscalYearOptions(FY_SPAN, current), [current]);
    const [fy, setFy] = useState<number | null>(current);
    const [range, setRange] = useState<[Dayjs, Dayjs]>(() => fiscalYearRange(current));
    const [wards, setWards] = useState<string[]>([]);
    const [shifts, setShifts] = useState<number[]>([]);
    const [wardList, setWardList] = useState<Ward[]>([]);

    const [data, setData] = useState<Staffing | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [trendView, setTrendView] = useState<'chart' | 'table'>('chart');
    const [peopleQuery, setPeopleQuery] = useState('');
    const [peoplePos, setPeoplePos] = useState<string[]>([]);
    const reqId = useRef(0);

    useEffect(() => {
        axios.get('/api/v1/system/wardsV1', { headers: getAuthHeaders() })
            .then(res => setWardList(Array.isArray(res.data) ? res.data : res.data?.data ?? []))
            .catch(() => setWardList([]));
    }, []);

    const load = useCallback(async () => {
        const id = ++reqId.current;
        setLoading(true);
        setError('');
        try {
            const res = await axios.post('/api/v1/dashboard/staffing', {
                date_from: range[0].format('YYYY-MM-DD'),
                date_to: range[1].format('YYYY-MM-DD'),
                wards,
                shifts,
            }, { headers: getAuthHeaders() });
            /* เปลี่ยนตัวกรองเร็ว ๆ คำตอบเก่าอาจมาทีหลังคำตอบใหม่ — ทิ้งคำตอบที่ไม่ใช่ของคำขอล่าสุด */
            if (id === reqId.current) setData(res.data.data as Staffing);
        } catch (err) {
            if (id === reqId.current) {
                setError(axios.isAxiosError(err) ? err.response?.data?.message ?? 'โหลดข้อมูลไม่สำเร็จ' : 'โหลดข้อมูลไม่สำเร็จ');
            }
        } finally {
            if (id === reqId.current) setLoading(false);
        }
    }, [range, wards, shifts]);

    useEffect(() => { load(); }, [load]);

    const presets = useMemo((): { label: string; value: [Dayjs, Dayjs] }[] => [
        { label: 'เดือนนี้', value: [dayjs().startOf('month'), dayjs()] },
        { label: 'เดือนที่แล้ว', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
        { label: '3 เดือนล่าสุด', value: [dayjs().subtract(2, 'month').startOf('month'), dayjs()] },
        { label: '6 เดือนล่าสุด', value: [dayjs().subtract(5, 'month').startOf('month'), dayjs()] },
    ], []);

    const d = data?.definitions;
    const s = data?.summary;
    const units = useMemo(() => [...(data?.by_unit ?? [])].sort((a, b) => (b.productivity ?? -1) - (a.productivity ?? -1)), [data]);
    const combined = data?.units.filter(u => u.combined) ?? [];

    const people = useMemo(() => {
        const q = peopleQuery.trim().toLowerCase();
        return (data?.people ?? []).filter(p =>
            (!q || p.name.toLowerCase().includes(q) || p.units.some(u => u.toLowerCase().includes(q)))
            && (peoplePos.length === 0 || peoplePos.includes(p.position)));
    }, [data, peopleQuery, peoplePos]);
    const positions = useMemo(() => [...new Set((data?.people ?? []).map(p => p.position))].sort(), [data]);

    const unitColumns: ColumnsType<Staffing['by_unit'][number]> = useMemo(() => !d ? [] : [
        { title: 'หน่วยงาน', dataIndex: 'label', key: 'u', fixed: 'left', width: 170 },
        {
            title: 'productivity', key: 'p', align: 'right', width: 150,
            sorter: (a, b) => (a.productivity ?? -1) - (b.productivity ?? -1), defaultSortOrder: 'descend',
            render: (_, u) => <span className="inline-flex items-center gap-1.5 justify-end">{pctTxt(u.productivity)} <StatusBadge s={band(d, u.productivity)} /></span>,
        },
        {
            title: <Tooltip title="คิดจากชั่วโมงการพยาบาลของประเภทผู้ป่วย 1–5">ตามประเภท</Tooltip>, key: 'pt', align: 'right', width: 100,
            sorter: (a, b) => (a.product_type ?? -1) - (b.product_type ?? -1), render: (_, u) => pctTxt(u.product_type),
        },
        {
            title: 'ควรมี / มีจริง (คน/เวร)', key: 'n', align: 'right', width: 150,
            render: (_, u) => <>{num1(u.required_per_shift)} <span className="text-slate-400">/</span> {num1(u.total_per_shift)}</>,
        },
        {
            title: <Tooltip title="ผลรวมของคนประจำที่ขาดจากที่ควรมี ก่อนนับ OT (คน × เวร)">ขาดคนประจำ</Tooltip>,
            dataIndex: 'shortfall', key: 'sf', align: 'right', width: 110, sorter: (a, b) => a.shortfall - b.shortfall, render: (v: number) => personShifts(v),
        },
        {
            title: <Tooltip title={`productivity เกิน ${d.productivity_high}%`}>เวรภาระงานเกิน</Tooltip>, key: 'un', align: 'right', width: 120,
            sorter: (a, b) => (share(a.under, a.measured) ?? 0) - (share(b.under, b.measured) ?? 0),
            render: (_, u) => <>{u.under} <span className="text-slate-400 text-xs">{fmtPct(share(u.under, u.measured))}</span></>,
        },
        {
            title: <Tooltip title={`productivity ต่ำกว่า ${d.productivity_low}%`}>เวรกำลังเกิน</Tooltip>, key: 'ov', align: 'right', width: 110,
            sorter: (a, b) => (share(a.over, a.measured) ?? 0) - (share(b.over, b.measured) ?? 0),
            render: (_, u) => <>{u.over} <span className="text-slate-400 text-xs">{fmtPct(share(u.over, u.measured))}</span></>,
        },
        {
            title: 'OT', key: 'ot', align: 'right', width: 120, sorter: (a, b) => a.ot_hours - b.ot_hours,
            render: (_, u) => <>{u.ot_shifts} เวร <span className="text-slate-400 text-xs">{nf.format(u.ot_hours)} ชม.</span></>,
        },
        { title: 'RN', key: 'rn', align: 'right', width: 70, sorter: (a, b) => (a.rn_share ?? 0) - (b.rn_share ?? 0), render: (_, u) => fmtPct(u.rn_share) },
        {
            title: <Tooltip title="ผู้ป่วยต่อพยาบาล 1 คนในเวร (รวม OT)">ผู้ป่วย/พยาบาล</Tooltip>, key: 'ppn', align: 'right', width: 110,
            sorter: (a, b) => (a.patients_per_nurse ?? 0) - (b.patients_per_nurse ?? 0), render: (_, u) => num1(u.patients_per_nurse),
        },
        {
            title: 'ผู้ป่วยเฉลี่ย/วัน', key: 'c', align: 'right', width: 130, sorter: (a, b) => a.avg_census - b.avg_census,
            render: (_, u) => <>{num1(u.avg_census)} {u.occupancy !== null && <span className="text-slate-400 text-xs">ครองเตียง {fmtPct(u.occupancy)}</span>}</>,
        },
        { title: 'พยาบาล', dataIndex: 'headcount', key: 'h', align: 'right', width: 80, sorter: (a, b) => a.headcount - b.headcount },
        {
            title: <Tooltip title="ผู้ป่วยที่ลงระดับการดูแลแล้ว เทียบผู้ป่วยที่นอนอยู่จริง">ข้อมูลครบ</Tooltip>, key: 'cp', align: 'right', width: 100,
            sorter: (a, b) => (a.completeness ?? 0) - (b.completeness ?? 0), render: (_, u) => fmtPct(u.completeness),
        },
    ], [d]);

    const shiftColumns: ColumnsType<Staffing['by_shift'][number]> = useMemo(() => !d ? [] : [
        { title: 'เวร', key: 'n', render: (_, x) => <span className="whitespace-nowrap">เวร{x.name} <span className="text-slate-400 text-xs">{SHIFT_TIME[x.shift]}</span></span> },
        { title: 'productivity', key: 'p', align: 'right', render: (_, x) => <span className="inline-flex items-center gap-1.5">{pctTxt(x.productivity)} <StatusBadge s={band(d, x.productivity)} /></span> },
        { title: <span className="whitespace-nowrap">ภาระงานเกิน</span>, key: 'u', align: 'right', render: (_, x) => fmtPct(share(x.under, x.measured)) },
        { title: <span className="whitespace-nowrap">กำลังเกิน</span>, key: 'o', align: 'right', render: (_, x) => fmtPct(share(x.over, x.measured)) },
        { title: 'OT', key: 'ot', align: 'right', render: (_, x) => <span className="whitespace-nowrap">{nf.format(x.ot_shifts)} เวร</span> },
        { title: 'ผู้ป่วย/พยาบาล', key: 'ppn', align: 'right', render: (_, x) => num1(x.patients_per_nurse) },
    ], [d]);

    const peopleColumns: ColumnsType<Staffing['people'][number]> = useMemo(() => !d ? [] : [
        { title: 'ชื่อ-สกุล', dataIndex: 'name', key: 'n', fixed: 'left', width: 190 },
        { title: 'ตำแหน่ง', dataIndex: 'position', key: 'p', width: 80 },
        { title: 'หน่วยงาน', key: 'u', width: 180, render: (_, p) => p.units.join(', ') },
        { title: 'เช้า', dataIndex: 'morning', key: 'm', align: 'right', width: 64, sorter: (a, b) => a.morning - b.morning },
        { title: 'บ่าย', dataIndex: 'afternoon', key: 'a', align: 'right', width: 64, sorter: (a, b) => a.afternoon - b.afternoon },
        { title: 'ดึก', dataIndex: 'night', key: 'ng', align: 'right', width: 64, sorter: (a, b) => a.night - b.night },
        {
            title: 'OT', key: 'ot', align: 'right', width: 90, sorter: (a, b) => (a.ot8 * 2 + a.ot4) - (b.ot8 * 2 + b.ot4),
            render: (_, p) => (p.ot8 + p.ot4 > 0 ? <>{p.ot8 + p.ot4} <span className="text-slate-400 text-xs">ครั้ง</span></> : <span className="text-slate-400">–</span>),
        },
        { title: 'ชั่วโมงรวม', dataIndex: 'hours', key: 'h', align: 'right', width: 100, sorter: (a, b) => a.hours - b.hours, defaultSortOrder: 'descend', render: (v: number) => nf.format(v) },
        {
            title: <Tooltip title={`เฉลี่ยต่อเดือน เทียบมาตรฐาน ${d.monthly_hours_standard} ชม. (ช่วงสั้นกว่า 28 วันเทียบไม่ได้)`}>ชม./เดือน</Tooltip>,
            key: 'hm', align: 'right', width: 150, sorter: (a, b) => (a.hours_per_month ?? 0) - (b.hours_per_month ?? 0),
            render: (_, p) => p.hours_per_month === null ? '–' : (
                <span className="inline-flex items-center gap-1.5">
                    {num1(p.hours_per_month)}
                    {p.hours_per_month > d.monthly_hours_standard && <StatusBadge s={{ ...STATUS.critical, label: 'เกิน' }} />}
                </span>
            ),
        },
        { title: 'สัดส่วนเวรดึก', key: 'ns', align: 'right', width: 110, sorter: (a, b) => (a.night_share ?? 0) - (b.night_share ?? 0), render: (_, p) => fmtPct(p.night_share) },
    ], [d]);

    const prodStatus = d && s ? band(d, s.productivity) : null;
    const completenessStatus: Status | null = !s || s.completeness === null ? null
        : s.completeness >= 0.95 ? STATUS.good : s.completeness >= 0.8 ? { ...STATUS.warning, label: 'ไม่ครบ' } : { ...STATUS.critical, label: 'ขาดมาก' };
    const empty = !!s && s.shifts === 0;

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-4 sm:p-6 flex flex-col gap-4">
                {/* ตัวกรองแถวเดียวเหนือกราฟทั้งหมด — ใช้กับทุกส่วนของหน้า */}
                <div className="flex flex-wrap items-center gap-2">
                    <PiChartBarBold size={20} className="text-(--brand-text)" />
                    <h1 className="text-lg font-semibold m-0 mr-auto">วิเคราะห์อัตรากำลังพยาบาล</h1>
                    <Select
                        className="min-w-52" value={fy ?? 'custom'} aria-label="ปีงบประมาณ"
                        options={[...fyOptions, { value: 'custom', label: 'กำหนดช่วงเอง', disabled: true }]}
                        onChange={v => { if (typeof v === 'number') { setFy(v); setRange(fiscalYearRange(v)); } }}
                    />
                    <RangePicker
                        value={range} allowClear={false} presets={presets} format="D/M/BB"
                        disabledDate={c => c.isAfter(dayjs(), 'day')}
                        onChange={v => {
                            if (!v?.[0] || !v?.[1]) return;
                            /* ปีงบยาวสุด 366 วัน — ช่วงที่ยาวกว่านั้นตัดให้เหลือปีเดียวนับย้อนจากวันสุดท้าย */
                            const end = v[1];
                            const start = end.diff(v[0], 'day') + 1 > MAX_DAYS ? end.subtract(MAX_DAYS - 1, 'day') : v[0];
                            setRange([start, end]);
                            setFy(null);
                        }}
                    />
                    <Select
                        mode="multiple" allowClear maxTagCount="responsive" optionFilterProp="label"
                        placeholder="ทุกหอผู้ป่วย" className="min-w-56" aria-label="หอผู้ป่วย"
                        value={wards} onChange={setWards}
                        options={wardList.map(w => ({ value: w.his_code, label: w.ward_name }))}
                    />
                    <Select
                        mode="multiple" allowClear placeholder="ทุกเวร" className="min-w-40" aria-label="เวร"
                        value={shifts} onChange={setShifts}
                        options={[2, 3, 1].map(id => ({ value: id, label: `เวร${SHIFT_LABEL[id]} (${SHIFT_TIME[id]})` }))}
                    />
                    <Button icon={<PiArrowClockwiseBold />} onClick={load} loading={loading}>รีเฟรช</Button>
                </div>

                {error && <Alert type="error" showIcon title={error} />}

                {combined.length > 0 && (
                    <Alert type="info" showIcon
                        title={`${combined.map(u => u.label).join(', ')} นับเป็นหน่วยเดียวกัน`}
                        description="ใช้พยาบาลทีมเดียวกัน นับคนขึ้นเวรไม่ซ้ำ และใช้ค่าน้ำหนักชั่วโมงการพยาบาลของหอหลัก" />
                )}

                {loading && !data && <DashboardSkeleton kpis={8} charts={6} kpiGrid="grid-cols-2 md:grid-cols-4 xl:grid-cols-8" />}

                {empty && <Section title="ไม่มีข้อมูล"><Empty description="ไม่มีผู้ป่วยหรือการขึ้นเวรในหอ/เวร/ช่วงที่เลือก" /></Section>}

                {data && d && s && !empty && (
                    <div className={`flex flex-col gap-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
                        <div className="text-sm text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                            <span>{dayjs(data.range.from).format('D MMM BBBB')} – {dayjs(data.range.to).format('D MMM BBBB')} ({nf.format(data.range.days)} วัน)</span>
                            <span>{data.by_unit.length} หน่วยงาน · {shifts.length ? shifts.map(x => `เวร${SHIFT_LABEL[x]}`).join(' ') : 'ทุกเวร'}</span>
                            <span>ผู้ป่วยเฉลี่ย {num1(s.avg_census)} คน/วัน</span>
                            <span>พยาบาลที่ขึ้นเวร {nf.format(s.headcount)} คน</span>
                        </div>

                        {/* ตัวเลขหลัก */}
                        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
                            <Kpi label="Productivity" value={pctTxt(s.productivity)} status={prodStatus}
                                hint={`ชั่วโมงการพยาบาลที่ต้องการ ÷ ชั่วโมงของคนที่ขึ้นเวร (${d.hours_per_shift} ชม./คน/เวร) · เหมาะสม ${d.productivity_low}–${d.productivity_high}%`}
                                sub={`ตามประเภทผู้ป่วย ${pctTxt(s.product_type)} · วัดได้ ${nf.format(s.measured)} เวร`} />
                            <Kpi label="พยาบาลต่อเวร มีจริง / ควรมี" value={`${num1(s.total_per_shift)} / ${num1(s.required_per_shift)}`}
                                hint="ควรมี = FTE ตามภาระงานของเวรนั้น (สูตรเดียวกับหน้า FTE) · มีจริงรวม OT"
                                sub={`ประจำ ${num1(s.regular_per_shift)} คน/เวร`} />
                            <Kpi label="เวรที่ภาระงานเกินกำลัง" value={fmtPct(share(s.under, s.measured))}
                                sub={`${nf.format(s.under)} จาก ${nf.format(s.measured)} เวร (> ${d.productivity_high}%)`} />
                            <Kpi label="เวรที่กำลังเกินภาระงาน" value={fmtPct(share(s.over, s.measured))}
                                sub={`${nf.format(s.over)} จาก ${nf.format(s.measured)} เวร (< ${d.productivity_low}%)`} />
                            <Kpi label="ขาดคนประจำ (คน·เวร)" value={personShifts(s.shortfall)}
                                hint="ผลรวมของคนประจำที่ขาดจากที่ควรมีในแต่ละเวร ก่อนนับ OT"
                                sub={`รวม OT แล้วยังขาด ${personShifts(s.uncovered)} · เกินในเวรอื่น ${personShifts(s.excess)}`} />
                            <Kpi label="OT" value={`${nf.format(s.ot_shifts)} เวร`}
                                sub={`${nf.format(s.ot_hours)} ชม. · ${fmtPct(s.ot_share)} ของคน·เวรทั้งหมด`} />
                            <Kpi label="สัดส่วน RN" value={fmtPct(s.rn_share)}
                                hint="RN ต่อคนขึ้นเวรทั้งหมด (รวม OT)"
                                sub={`ผู้ป่วย ${num1(s.patients_per_nurse)} คน ต่อพยาบาล 1 คน`} />
                            <Kpi label="ลงระดับการดูแลครบ" value={fmtPct(s.completeness)} status={completenessStatus}
                                hint="ผู้ป่วยที่ลงระดับการดูแลแล้ว เทียบผู้ป่วยที่นอนอยู่จริง · เวรที่ไม่ได้ลงเลยวัด productivity ไม่ได้ จึงไม่นับ"
                                sub={`ไม่ได้ลง ${nf.format(s.unrecorded)} เวร · ไม่มีตารางเวร ${nf.format(s.no_staff)} เวร`} />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <Section
                                title="พยาบาลต่อเวร: มีจริง เทียบ ควรมีตามภาระงาน"
                                hint={`เฉลี่ยต่อเวร ราย${data.range.grain === 'day' ? 'วัน' : data.range.grain === 'week' ? 'สัปดาห์' : 'เดือน'} · แท่งต่ำกว่าเส้น = คนไม่พอ`}
                                extra={<Segmented size="small" value={trendView} onChange={v => setTrendView(v as 'chart' | 'table')}
                                    options={[{ value: 'chart', label: 'กราฟ' }, { value: 'table', label: 'ตาราง' }]} />}
                            >
                                {trendView === 'chart' ? <StaffTrend data={data.by_bucket} grain={data.range.grain} dark={dark} /> : (
                                    <Table
                                        size="small" rowKey="key" scroll={{ x: 'max-content' }} pagination={{ pageSize: 12, size: 'small', hideOnSinglePage: true }}
                                        dataSource={data.by_bucket}
                                        columns={[
                                            { title: 'ช่วง', key: 'b', fixed: 'left', render: (_: unknown, b: Bucket) => bucketLabel(b.key, data.range.grain) },
                                            { title: 'เวรที่เทียบได้', dataIndex: 'recorded', align: 'right' },
                                            { title: 'ควรมี', key: 'r', align: 'right', render: (_: unknown, b: Bucket) => num1(b.required_per_shift) },
                                            { title: 'ประจำ', key: 'g', align: 'right', render: (_: unknown, b: Bucket) => num1(b.regular_per_shift) },
                                            { title: 'รวม OT', key: 't', align: 'right', render: (_: unknown, b: Bucket) => num1(b.total_per_shift) },
                                            { title: 'ขาดคนประจำ', key: 'sf', align: 'right', render: (_: unknown, b: Bucket) => personShifts(b.shortfall) },
                                            { title: 'OT (เวร)', dataIndex: 'ot_shifts', align: 'right' },
                                            { title: 'productivity', key: 'p', align: 'right', render: (_: unknown, b: Bucket) => pctTxt(b.productivity) },
                                            { title: 'ตามประเภท', key: 'pt', align: 'right', render: (_: unknown, b: Bucket) => pctTxt(b.product_type) },
                                            { title: 'ข้อมูลครบ', key: 'c', align: 'right', render: (_: unknown, b: Bucket) => fmtPct(b.completeness) },
                                        ]}
                                    />
                                )}
                            </Section>
                            <Section title="Productivity" hint={`แถบพื้น = ช่วงเหมาะสม ${d.productivity_low}–${d.productivity_high}% · สูงกว่าแถบ = ภาระงานเกินกำลัง`}>
                                <ProductivityTrend data={data.by_bucket} grain={data.range.grain} d={d} dark={dark} />
                            </Section>
                        </div>

                        <Section title="Productivity รายหน่วยงาน × ช่วงเวลา" hint="หาว่าที่ไหน เมื่อไหร่ กำลังไม่พอดีกับงาน · ช่องเทา = วัดไม่ได้ · ชี้ที่ช่องเพื่อดูรายละเอียด">
                            <div className="mb-2"><ProdLegend d={d} dark={dark} /></div>
                            <UnitHeat data={data.unit_bucket} units={units} buckets={data.by_bucket} grain={data.range.grain} d={d} dark={dark} />
                        </Section>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                            <Section title="แต่ละเวร: ควรมี เทียบ มีจริง" hint="เฉลี่ยต่อเวร · ตัวเลขบนแท่ง = คน/เวร">
                                <ShiftCompare data={data.by_shift} dark={dark} />
                                <Table size="small" rowKey="shift" pagination={false} className="mt-2" scroll={{ x: 'max-content' }} dataSource={data.by_shift} columns={shiftColumns} />
                            </Section>
                            <Section title="วันในสัปดาห์ × เวร" hint="ตัวเลข = productivity (%) · หาเวรที่ขาดคนเป็นประจำ เช่น เวรบ่ายวันจันทร์">
                                <DowShiftHeat data={data.dow_shift} shifts={data.shifts} d={d} dark={dark} />
                                <div className="mt-2"><ProdLegend d={d} dark={dark} /></div>
                            </Section>
                            <Section title="การกระจายของ productivity รายเวร" hint="ค่าเฉลี่ยดีอาจซ่อนเวรที่ขาดหนักไว้ · ตัวเลข = สัดส่วนของเวรที่วัดได้">
                                <ProdHistogram data={s.histogram} d={d} dark={dark} />
                            </Section>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                            <div className="xl:col-span-2">
                                <Section title="Productivity รายหน่วยงาน" hint={`แถบพื้น = ${d.productivity_low}–${d.productivity_high}%`}>
                                    <UnitBars data={units} d={d} dark={dark} />
                                </Section>
                            </div>
                            <div className="xl:col-span-3">
                                <Section title="สัดส่วนประเภทผู้ป่วย 1–5" hint="ประเภทสูง = ต้องการชั่วโมงการพยาบาลมาก · ตัวขับภาระงานของแต่ละหน่วย">
                                    <AcuityMix units={units} summary={s} d={d} dark={dark} />
                                </Section>
                            </div>
                        </div>

                        <Section title="รายหน่วยงาน" hint="กดหัวคอลัมน์เพื่อเรียง · ควรมี/มีจริงเป็นค่าเฉลี่ยต่อเวร">
                            <Table size="small" rowKey="unit" pagination={false} scroll={{ x: 'max-content' }} dataSource={units} columns={unitColumns} />
                        </Section>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <Section title="รับใหม่ / รับย้าย / จำหน่าย" hint="งานรับเข้าและจำหน่ายเพิ่มภาระนอกเหนือจากจำนวนผู้ป่วย">
                                <Movement data={data.by_bucket} grain={data.range.grain} dark={dark} />
                            </Section>
                            <Section
                                title="การเปลี่ยนระดับการดูแลข้ามเวร"
                                hint={data.care_flow.totalTransitions > 0
                                    ? `ผู้ป่วยที่ประเมินต่อเนื่องสองเวรในวันเดียวกัน ${nf.format(data.care_flow.totalTransitions)} ครั้ง · เปลี่ยนระดับ ${nf.format(data.care_flow.changedTransitions)} ครั้ง (เส้นทึบ)`
                                    : undefined}
                            >
                                <CareFlow data={data.care_flow} dark={dark} />
                            </Section>
                        </div>

                        <Section
                            title="ชั่วโมงขึ้นเวรรายบุคคล"
                            hint={`เวรละ ${d.shift_hours} ชม. · OT ครึ่งเวร 4 ชม. · นับเฉพาะเวรที่เลือก · ชม./เดือน เทียบมาตรฐาน ${d.monthly_hours_standard} ชม.`}
                            extra={
                                <div className="flex items-center gap-2">
                                    <Input size="small" allowClear prefix={<PiMagnifyingGlassBold />} placeholder="ค้นชื่อหรือหอ" className="w-44"
                                        value={peopleQuery} onChange={e => setPeopleQuery(e.target.value)} />
                                    <Select size="small" mode="multiple" allowClear placeholder="ทุกตำแหน่ง" className="min-w-28"
                                        value={peoplePos} onChange={setPeoplePos} options={positions.map(p => ({ value: p, label: p }))} />
                                </div>
                            }
                        >
                            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                                <PiUsersThreeBold /> {nf.format(people.length)} คน
                                {data.people.length !== people.length && <span>จากทั้งหมด {nf.format(data.people.length)} คน</span>}
                            </div>
                            <Table size="small" rowKey="staff_id" scroll={{ x: 'max-content' }} dataSource={people} columns={peopleColumns}
                                pagination={{ pageSize: 10, size: 'small', hideOnSinglePage: true, showSizeChanger: false }} />
                        </Section>

                        <div className="text-xs text-slate-500 flex items-start gap-1.5">
                            <PiInfoBold className="mt-0.5 shrink-0" />
                            <span>
                                ทุกตัวเลขคิดรายเวร (หน่วยงาน × วัน × เวร) ด้วยสูตรเดียวกับหน้า FTE แล้วรวมแบบผลรวมตัวตั้ง ÷ ผลรวมตัวหาร ·
                                เวรที่มีผู้ป่วยแต่ไม่ได้ลงระดับการดูแล หรือไม่มีตารางเวร วัด productivity ไม่ได้ จึงไม่นับ (หน้า FTE นับรวม ค่ารายเดือนจึงอาจต่างกัน) ·
                                ช่วงเหมาะสม {d.productivity_low}–{d.productivity_high}%
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
