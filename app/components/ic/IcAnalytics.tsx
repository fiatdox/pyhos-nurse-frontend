'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Alert, Empty, Segmented, Table, Tooltip } from 'antd';
import { DashboardSkeleton } from '@/app/components/Skeletons';
import type { ColumnsType } from 'antd/es/table';
import { PiArrowDownRightBold, PiArrowUpRightBold, PiMinusBold, PiInfoBold } from 'react-icons/pi';
import { getAuthHeaders } from '../../lib/auth';
import { useThemeMode } from '../../lib/theme';
import {
    STATUS, StatusBadge, Kpi, Section, useChart, baseText, grid, axisLine, nf, fmtPct, share, type Status,
} from '../../lib/dashboardKit';

/* ───────────────────────── รูปข้อมูลจาก GET /api/v1/ic/analytics ───────────────────────── */

type GroupKey = 'CRE' | 'CRAB' | 'CRPA' | 'VRE' | 'MRSA' | 'ESCR' | 'MDR' | 'OTHER';
type Counts = Record<GroupKey, number>;
interface Top { name: string; n: number }
interface Matrix { rows: { name: string; total: number; counts: Counts }[]; other_rows: number; other_total: number }

interface Analytics {
    fiscal_year: number;
    current_fiscal_year: number;
    start_date: string;
    end_date: string;
    until_date: string;
    prior: { fiscal_year: number; start_date: string; end_date: string; same_until: string };
    definitions: {
        groups: GroupKey[]; critical_groups: GroupKey[];
        ho_day: number; cluster_window_days: number; cluster_min_patients: number;
    };
    summary: {
        isolates: number; patients: number; critical: number; critical_patients: number;
        opd_isolates: number; co_isolates: number; ho_isolates: number;
        inpatient_events: number; ho_events: number; patient_days: number;
        ho_rate: number | null; inpatient_rate: number | null;
        repeat_patients: number; units: number; organisms: number;
        tat_p50: number | null; tat_p90: number | null; tat_n: number;
        clusters: number; active_clusters: number;
        prior_same_period: { isolates: number; patients: number; critical: number };
        prior_full_year: { isolates: number };
    };
    monthly: {
        month: string; future: boolean; isolates: number; patients: number; groups: Counts; critical: number;
        prior_isolates: number; ho_events: number; inpatient_events: number; patient_days: number;
        ho_rate: number | null; inpatient_rate: number | null; tat_p50: number | null; tat_p90: number | null;
    }[];
    by_group: {
        group: GroupKey; isolates: number; patients: number; opd: number; co: number; ho: number;
        ho_events: number; top_organism: Top | null;
    }[];
    hosp_days: { label: string; ho: boolean; events: number }[];
    organism_matrix: Matrix;
    specimen_matrix: Matrix;
    by_unit: {
        unit: string; isolates: number; patients: number; inpatient_isolates: number; ho_events: number;
        critical: number; top_group: Top | null; top_organism: Top | null;
    }[];
    age_bands: { label: string; patients: number; male: number; female: number }[];
    clusters: {
        unit: string; organism: string; group: GroupKey; patients: number; events: number;
        first: string; last: string; active: boolean;
    }[];
}

/* ───────────────────────── สี ─────────────────────────
   ผ่านตัวตรวจสีของ dataviz แล้วทั้งสองโหมด ตามลำดับที่ซ้อนในกราฟ (CRE อยู่ล่างสุดติดฐาน)
   คู่ที่ติดกันแย่ที่สุดสำหรับคนตาบอดสี ΔE 9.2 สว่าง / 9.4 มืด (เกณฑ์ ≥ 8)
   CRE แดงเหมือนป้ายในหน้าอื่นของงาน IC ส่วน "อื่นๆ" เป็นเทา ไม่แย่งสายตา
   กลุ่มที่เหลือเลือกสีจากลำดับที่ผ่านเกณฑ์ ไม่ได้ตามป้ายเดิม จึงแสดงชื่อกลุ่มคู่สีทุกที่ */
const GROUP_COLOR: Record<'light' | 'dark', Record<GroupKey, string>> = {
    light: {
        CRE: '#e34948', CRAB: '#2a78d6', CRPA: '#eda100', VRE: '#e87ba4',
        MRSA: '#6250d6', ESCR: '#eb6834', MDR: '#1baf7a', OTHER: '#a3a29d',
    },
    dark: {
        CRE: '#e66767', CRAB: '#3987e5', CRPA: '#c98500', VRE: '#d55181',
        MRSA: '#9085e9', ESCR: '#d95926', MDR: '#199e70', OTHER: '#6e6d68',
    },
};

const GROUP_LABEL: Record<GroupKey, string> = {
    CRE: 'CRE', CRAB: 'CRAB', CRPA: 'CRPA', VRE: 'VRE', MRSA: 'MRSA', ESCR: 'ESCR', MDR: 'MDR', OTHER: 'อื่นๆ',
};

const GROUP_HINT: Record<GroupKey, string> = {
    CRE: 'Enterobacterales ดื้อ carbapenem',
    CRAB: 'Acinetobacter baumannii ดื้อ carbapenem',
    CRPA: 'Pseudomonas aeruginosa ดื้อ carbapenem',
    VRE: 'Enterococcus ดื้อ vancomycin',
    MRSA: 'Staphylococcus aureus ดื้อ methicillin',
    ESCR: 'ดื้อ cephalosporin รุ่นที่ 3 (กลุ่ม ESBL)',
    MDR: 'ดื้อยาหลายกลุ่ม',
    OTHER: 'กลุ่มอื่น เช่น MRCoNS',
};

/* ที่มาของเชื้อ: ไล่น้ำเงินเฉดเดียวตามลำดับ นอก → เข้ามาใหม่ → ติดในโรงพยาบาล
   ติดในโรงพยาบาลเด่นที่สุดทั้งสองโหมด (สว่าง = เข้มสุด, มืด = สว่างสุด) */
const PALETTE = {
    light: {
        one: '#2a78d6', context: '#a3a29d', ink2: '#52514e',
        onset: ['#86b6ef', '#2a78d6', '#104281'],
        heat: ['#eef4fc', '#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'],
        surface: '#ffffff',
    },
    dark: {
        one: '#3987e5', context: '#6e6d68', ink2: '#c3c2b7',
        onset: ['#184f95', '#3987e5', '#86b6ef'],
        heat: ['#1f2630', '#0d366b', '#1c5cab', '#3987e5', '#86b6ef', '#cde2fb'],
        surface: '#1f1f1f',
    },
};

const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/* ───────────────────────── ตัวช่วยแสดงผล ───────────────────────── */

/** 2025-10 → ต.ค. 68 */
const monthLabel = (ym: string) => `${TH_MONTH[Number(ym.slice(5, 7)) - 1]} ${String((Number(ym.slice(0, 4)) + 543) % 100).padStart(2, '0')}`;
/** 2025-10-05 → 5 ต.ค. 68 */
const beDate = (iso: string) => `${Number(iso.slice(8, 10))} ${monthLabel(iso.slice(0, 7))}`;
/** ช่วงวันที่สั้น ๆ ปีเดียวกันบอกปีครั้งเดียว: 2 มี.ค. – 27 มี.ค. 69 */
const beRange = (a: string, b: string) => (a.slice(0, 4) === b.slice(0, 4)
    ? `${Number(a.slice(8, 10))} ${TH_MONTH[Number(a.slice(5, 7)) - 1]} – ${beDate(b)}`
    : `${beDate(a)} – ${beDate(b)}`);

const fmtRate = (r: number | null | undefined) => (r === null || r === undefined ? '–' : r.toFixed(2));
const fmtDays = (d: number | null | undefined) => {
    if (d === null || d === undefined) return '–';
    if (d < 1) return 'ภายในวันเดียว';
    return `${Number.isInteger(d) ? d : d.toFixed(1)} วัน`;
};

/** ชื่อเชื้อ/หน่วยงานมาจาก HIS ใส่ลงกล่อง tooltip ที่เป็น HTML จึงกันแท็กไว้อีกชั้น */
const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ONSET = [
    { key: 'opd', label: 'ผู้ป่วยนอก / ยังไม่ได้นอน' },
    { key: 'co', label: 'พบใน 3 วันแรกของการนอน' },
    { key: 'ho', label: 'ติดในโรงพยาบาล (วันนอนที่ 4 ขึ้นไป)' },
] as const;

const GroupDot = ({ g, dark }: { g: GroupKey; dark: boolean }) => (
    <Tooltip title={GROUP_HINT[g]}>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: GROUP_COLOR[dark ? 'dark' : 'light'][g] }} />
            {GROUP_LABEL[g]}
        </span>
    </Tooltip>
);

/** เทียบกับช่วงเดียวกันของปีงบก่อน — เชื้อดื้อยาเพิ่มคือแย่ จึงใช้แดงขึ้น เขียวลง และมีลูกศรกำกับเสมอ */
function Delta({ now, before, dark }: { now: number; before: number; dark: boolean }) {
    if (before === 0) return <span>{now === 0 ? 'เท่ากับปีก่อน' : 'ช่วงเดียวกันปีก่อนไม่พบ'}</span>;
    const r = (now - before) / before;
    const pctTxt = `${r > 0 ? '+' : ''}${Math.round(r * 100)}%`;
    const Icon = r > 0 ? PiArrowUpRightBold : r < 0 ? PiArrowDownRightBold : PiMinusBold;
    const color = r > 0 ? (dark ? '#e66767' : '#d03b3b') : r < 0 ? (dark ? '#0ca30c' : '#006300') : undefined;
    return (
        <span>
            <span className="inline-flex items-center gap-0.5 font-medium" style={{ color }}><Icon />{pctTxt}</span>
            {' '}จากปีก่อน ({nf.format(before)})
        </span>
    );
}

/* ───────────────────────── กราฟ ───────────────────────── */

type Monthly = Analytics['monthly'];

/** ผลเพาะเชื้อรายเดือนแยกกลุ่มดื้อยา (แท่งซ้อน) + ยอดรวมปีงบก่อน (เส้นประ) — หน่วยเดียวกัน แกนเดียว */
function MonthlyGroups({ data, groups, priorFy, partial, dark }: {
    data: Monthly; groups: GroupKey[]; priorFy: number;
    /** เดือนที่ยังไม่จบ (YYYY-MM) และวันสุดท้ายที่นับ — เทียบกับเดือนเต็มของปีก่อนต้องรู้ว่ายังไม่ครบ */
    partial: { month: string; until: string } | null; dark: boolean;
}) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const colors = GROUP_COLOR[dark ? 'dark' : 'light'];
    const priorName = `ปีงบ ${priorFy} (รวม)`;
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 44, right: 16, top: 56, bottom: 32 },
        legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 12, data: [...groups.map(g => GROUP_LABEL[g]), priorName] },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const arr = ps as { dataIndex: number; seriesName: string; marker: string; value: number | null }[];
                const m = data[arr[0]?.dataIndex ?? 0];
                if (!m) return '';
                const head = `<b>${monthLabel(m.month)}</b>`;
                const prior = `<br/><span style="opacity:.75">${priorName}: ${m.prior_isolates}</span>`;
                if (m.future) return `${head}<br/>ยังไม่ถึงเดือนนี้${prior}`;
                const rows = arr
                    .filter(p => p.seriesName !== priorName && Number(p.value) > 0)
                    .reverse()
                    .map(p => `${p.marker}${p.seriesName}: ${p.value}`)
                    .join('<br/>');
                const cut = partial?.month === m.month ? `<br/><span style="opacity:.75">ยังไม่ครบเดือน นับถึง ${beDate(partial.until)}</span>` : '';
                return `${head} · รวม ${m.isolates} ครั้ง · ${m.patients} คน${rows ? `<br/>${rows}` : ''}${prior}${cut}`;
            },
        },
        xAxis: { type: 'category', data: data.map(m => monthLabel(m.month)), axisTick: { show: false }, axisLine: axisLine(dark) },
        yAxis: { type: 'value', minInterval: 1, splitLine: grid(dark), name: 'ครั้ง', nameTextStyle: { align: 'right' } },
        series: [
            ...groups.map((g, i) => ({
                name: GROUP_LABEL[g],
                type: 'bar' as const,
                stack: 'n',
                barMaxWidth: 32,
                data: data.map(m => (m.future ? null : m.groups[g])),
                itemStyle: {
                    color: colors[g],
                    /* ช่องว่าง 2px สีพื้นระหว่างชั้น และมุมมนเฉพาะปลายบนของชั้นบนสุด */
                    borderColor: pal.surface, borderWidth: 1,
                    borderRadius: i === groups.length - 1 ? [4, 4, 0, 0] : 0,
                },
                emphasis: { focus: 'series' as const },
            })),
            {
                name: priorName, type: 'line' as const, z: 5, symbolSize: 6,
                data: data.map(m => m.prior_isolates),
                lineStyle: { width: 2, type: 'dashed' as const, color: pal.ink2 },
                itemStyle: { color: pal.ink2, borderColor: pal.surface, borderWidth: 1 },
            },
        ],
    }, [data, groups, partial, dark]);
    return <div ref={ref} style={{ height: 340 }} />;
}

/** อัตราต่อ 1,000 วันนอน — ติดในโรงพยาบาล (เด่น) เทียบผู้ป่วยในทั้งหมด (บริบท) */
function RateTrend({ data, dark }: { data: Monthly; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const HO = 'ติดในโรงพยาบาล';
    const ALL = 'ผู้ป่วยในทั้งหมด';
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 44, right: 16, top: 56, bottom: 32 },
        legend: { top: 0, right: 0, itemWidth: 14, itemHeight: 3, data: [HO, ALL] },
        tooltip: {
            trigger: 'axis',
            formatter: (ps: unknown) => {
                const m = data[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
                if (!m) return '';
                if (m.future) return `<b>${monthLabel(m.month)}</b><br/>ยังไม่ถึงเดือนนี้`;
                return `<b>${monthLabel(m.month)}</b> · ${nf.format(m.patient_days)} วันนอน`
                    + `<br/>${HO}: ${fmtRate(m.ho_rate)} (${m.ho_events} ราย)`
                    + `<br/>${ALL}: ${fmtRate(m.inpatient_rate)} (${m.inpatient_events} ราย)`;
            },
        },
        xAxis: { type: 'category', data: data.map(m => monthLabel(m.month)), axisTick: { show: false }, axisLine: axisLine(dark) },
        yAxis: { type: 'value', name: 'ต่อ 1,000 วันนอน', splitLine: grid(dark), nameTextStyle: { align: 'left' } },
        series: [
            {
                name: ALL, type: 'line', connectNulls: false, symbolSize: 6,
                lineStyle: { width: 2, color: pal.context }, itemStyle: { color: pal.context },
                data: data.map(m => m.inpatient_rate),
            },
            {
                name: HO, type: 'line', connectNulls: false, symbolSize: 8,
                lineStyle: { width: 2, color: pal.one },
                itemStyle: { color: pal.one, borderColor: pal.surface, borderWidth: 2 },
                areaStyle: { color: pal.one, opacity: 0.08 },
                data: data.map(m => m.ho_rate),
            },
        ],
    }, [data, dark]);
    return <div ref={ref} style={{ height: 340 }} />;
}

/** ที่มาของเชื้อแต่ละกลุ่ม เป็นสัดส่วน — กลุ่มไหนเกิดในโรงพยาบาลมาก */
function OnsetByGroup({ data, dark }: { data: Analytics['by_group']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 64, right: 24, top: 56, bottom: 24 },
        legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 12 },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const g = data[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
                if (!g) return '';
                return `<b>${GROUP_LABEL[g.group]}</b> · ${g.isolates} ครั้ง ${g.patients} คน<br/>`
                    + ONSET.map(o => `${o.label}: ${g[o.key]} (${fmtPct(share(g[o.key], g.isolates))})`).join('<br/>')
                    + (g.top_organism ? `<br/><span style="opacity:.75">พบมากสุด: ${esc(g.top_organism.name)} (${g.top_organism.n})</span>` : '');
            },
        },
        xAxis: { type: 'value', max: 100, splitLine: grid(dark), axisLabel: { formatter: '{value}%' } },
        yAxis: { type: 'category', inverse: true, axisTick: { show: false }, data: data.map(g => GROUP_LABEL[g.group]) },
        series: ONSET.map((o, i) => ({
            name: o.label, type: 'bar', stack: 'p', barMaxWidth: 20,
            data: data.map(g => (g.isolates ? Math.round((g[o.key] / g.isolates) * 1000) / 10 : 0)),
            itemStyle: {
                color: pal.onset[i], borderColor: pal.surface, borderWidth: 1,
                borderRadius: i === ONSET.length - 1 ? [0, 4, 4, 0] : i === 0 ? [4, 0, 0, 4] : 0,
            },
            emphasis: { focus: 'series' },
        })),
    }, [data, dark]);
    return <div ref={ref} style={{ height: 80 + data.length * 34 }} />;
}

/** วันนอนที่พบเชื้อครั้งแรก — แท่งแรก (3 วันแรก) เป็นบริบท ที่เหลือคือติดในโรงพยาบาล */
function HospDayBars({ data, dark }: { data: Analytics['hosp_days']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const total = data.reduce((a, b) => a + b.events, 0);
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 40, right: 16, top: 24, bottom: 40 },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const i = (ps as { dataIndex: number }[])[0]?.dataIndex ?? 0;
                const b = data[i];
                return `วันนอนที่ ${b.label}${b.ho ? '' : ' (ติดมาจากข้างนอก)'}<br/><b>${b.events} ราย</b> (${fmtPct(share(b.events, total))})`;
            },
        },
        xAxis: {
            type: 'category', data: data.map(b => b.label), axisTick: { show: false }, axisLine: axisLine(dark),
            name: 'วันนอนที่', nameLocation: 'middle', nameGap: 26,
        },
        yAxis: { type: 'value', minInterval: 1, splitLine: grid(dark), name: 'ราย', nameTextStyle: { align: 'right' } },
        series: [{
            type: 'bar', barMaxWidth: 40,
            data: data.map(b => ({ value: b.events, itemStyle: { color: b.ho ? pal.one : pal.context, borderRadius: [4, 4, 0, 0] } })),
            label: { show: true, position: 'top', color: baseText(dark).color, fontSize: 11, formatter: (p: unknown) => ((p as { value: number }).value ? String((p as { value: number }).value) : '') },
        }],
    }, [data, dark]);
    return <div ref={ref} style={{ height: 260 }} />;
}

/** ตาราง เชื้อ (หรือสิ่งส่งตรวจ) × กลุ่มดื้อยา — น้ำเงินเฉดเดียว ตัวเลขในช่อง */
function MatrixHeat({ data, groups, dark }: { data: Matrix; groups: GroupKey[]; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const cells = data.rows.flatMap((r, y) => groups.map((g, x) => [x, y, r.counts[g]] as [number, number, number]));
    const max = Math.max(1, ...cells.map(c => c[2]));
    /* ตัวเลขในช่องเข้มต้องเป็นตัวอักษรสว่าง ช่องอ่อนใช้ตัวเข้ม — กลับกันในโหมดมืดเพราะสเกลกลับด้าน */
    const ink = (v: number) => {
        const strong = v / max > 0.55;
        return dark ? (strong ? '#0b0b0b' : '#e8e8e8') : (strong ? '#ffffff' : '#0b0b0b');
    };
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 190, right: 16, top: 8, bottom: 28 },
        tooltip: {
            formatter: (p: unknown) => {
                const [x, y, v] = (p as { value: [number, number, number] }).value;
                const r = data.rows[y];
                return `${esc(r.name)}<br/>${GROUP_LABEL[groups[x]]}: <b>${v}</b> ครั้ง<br/><span style="opacity:.75">ทั้งแถว ${r.total} ครั้ง</span>`;
            },
        },
        xAxis: { type: 'category', data: groups.map(g => GROUP_LABEL[g]), position: 'bottom', axisTick: { show: false }, splitArea: { show: false } },
        yAxis: {
            type: 'category', inverse: true, axisTick: { show: false },
            data: data.rows.map(r => r.name), axisLabel: { width: 178, overflow: 'truncate' },
        },
        visualMap: { show: false, min: 0, max, inRange: { color: pal.heat } },
        series: [{
            type: 'heatmap',
            data: cells.map(([x, y, v]) => ({ value: [x, y, v], label: { color: ink(v) } })),
            label: { show: true, fontSize: 11, formatter: (p: unknown) => { const v = (p as { value: number[] }).value[2]; return v ? String(v) : ''; } },
            itemStyle: { borderColor: pal.surface, borderWidth: 2, borderRadius: 2 },
            emphasis: { itemStyle: { borderColor: dark ? '#e8e8e8' : '#0b0b0b', borderWidth: 1 } },
        }],
    }, [data, groups, dark]);
    return <div ref={ref} style={{ height: 44 + Math.max(1, data.rows.length) * 30 }} />;
}

/** ผู้ป่วยตามช่วงอายุ (นับเป็นคน) */
function AgeBars({ data, dark }: { data: Analytics['age_bands']; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const total = data.reduce((a, b) => a + b.patients, 0);
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 40, right: 16, top: 24, bottom: 40 },
        tooltip: {
            trigger: 'axis', axisPointer: { type: 'shadow' },
            formatter: (ps: unknown) => {
                const b = data[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
                return `อายุ ${b.label} ปี<br/><b>${b.patients} คน</b> (${fmtPct(share(b.patients, total))})<br/>ชาย ${b.male} · หญิง ${b.female}`;
            },
        },
        xAxis: { type: 'category', data: data.map(b => b.label), axisTick: { show: false }, axisLine: axisLine(dark), name: 'อายุ (ปี)', nameLocation: 'middle', nameGap: 26 },
        yAxis: { type: 'value', minInterval: 1, splitLine: grid(dark), name: 'คน', nameTextStyle: { align: 'right' } },
        series: [{
            type: 'bar', barMaxWidth: 40,
            data: data.map(b => b.patients),
            itemStyle: { color: pal.one, borderRadius: [4, 4, 0, 0] },
            label: { show: true, position: 'top', color: baseText(dark).color, fontSize: 11, formatter: (p: unknown) => fmtPct(share((p as { value: number }).value, total)) },
        }],
    }, [data, dark]);
    return <div ref={ref} style={{ height: 260 }} />;
}

/** เวลาจากสั่งตรวจถึงยืนยันผลรายเดือน — ช่วงที่ผู้ป่วยยังไม่ได้แยกเพราะยังไม่รู้ผล */
function TatTrend({ data, dark }: { data: Monthly; dark: boolean }) {
    const pal = dark ? PALETTE.dark : PALETTE.light;
    const P50 = 'มัธยฐาน (P50)';
    const P90 = 'รายที่ช้า (P90)';
    const ref = useChart({
        textStyle: baseText(dark),
        grid: { left: 40, right: 16, top: 36, bottom: 32 },
        legend: { top: 0, right: 0, itemWidth: 14, itemHeight: 3, data: [P50, P90] },
        tooltip: {
            trigger: 'axis',
            formatter: (ps: unknown) => {
                const m = data[(ps as { dataIndex: number }[])[0]?.dataIndex ?? 0];
                if (!m) return '';
                return `<b>${monthLabel(m.month)}</b><br/>P50 ${fmtDays(m.tat_p50)} · P90 ${fmtDays(m.tat_p90)}`;
            },
        },
        xAxis: { type: 'category', data: data.map(m => monthLabel(m.month)), axisTick: { show: false }, axisLine: axisLine(dark) },
        yAxis: { type: 'value', name: 'วัน', minInterval: 1, splitLine: grid(dark), nameTextStyle: { align: 'right' } },
        series: [
            {
                name: P90, type: 'line', connectNulls: false, symbolSize: 6,
                lineStyle: { width: 2, color: pal.context }, itemStyle: { color: pal.context },
                data: data.map(m => m.tat_p90),
            },
            {
                name: P50, type: 'line', connectNulls: false, symbolSize: 8,
                lineStyle: { width: 2, color: pal.one },
                itemStyle: { color: pal.one, borderColor: pal.surface, borderWidth: 2 },
                data: data.map(m => m.tat_p50),
            },
        ],
    }, [data, dark]);
    return <div ref={ref} style={{ height: 260 }} />;
}

/* ───────────────────────── ส่วนหลัก ───────────────────────── */

/**
 * วิเคราะห์เชื้อดื้อยาเชิงลึกตามปีงบ ตอบคำถามที่งาน IC ถามกันจริงตามลำดับ
 *   1. ปีนี้มากขึ้นหรือน้อยลง กลุ่มไหนเพิ่ม (รายเดือน + เทียบปีงบก่อน)
 *   2. ติดในโรงพยาบาลเท่าไหร่ เมื่อเทียบกับจำนวนวันนอน (อัตราต่อ 1,000 วันนอน)
 *   3. มีกลุ่มก้อนที่ต้องลงไปสอบสวนไหม หน่วยงานไหน
 *   4. เชื้ออะไร เก็บจากอะไร ผู้ป่วยกลุ่มไหน ผลออกเร็วแค่ไหน
 *
 * ตัวเลขทุกตัวคิดที่เซิร์ฟเวอร์ หน้านี้ไม่ได้รับ HN หรือชื่อผู้ป่วย
 */
export default function IcAnalytics({ fy }: { fy: number }) {
    const router = useRouter();
    const { resolved } = useThemeMode();
    const dark = resolved === 'dark';

    /* เก็บผลพร้อมปีงบที่ขอ แล้วอนุมานว่ากำลังโหลดจากปีที่ไม่ตรงกัน
       ระหว่างเปลี่ยนปี ข้อมูลปีเดิมยังอยู่บนจอแบบจาง ไม่กระพริบว่างทั้งหน้า */
    const [result, setResult] = useState<{ fy: number; data: Analytics | null; error: string } | null>(null);
    const [monthlyView, setMonthlyView] = useState<'chart' | 'table'>('chart');
    const [matrixBy, setMatrixBy] = useState<'organism' | 'specimen'>('organism');

    useEffect(() => {
        let stale = false;
        axios.get('/api/v1/ic/analytics', { headers: getAuthHeaders(), params: { fy } })
            .then(res => { if (!stale) setResult({ fy, data: res.data.data as Analytics, error: '' }); })
            .catch(err => {
                if (stale) return;
                if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/'); return; }
                setResult({ fy, data: null, error: 'โหลดข้อมูลวิเคราะห์ไม่สำเร็จ' });
            });
        return () => { stale = true; };
    }, [fy, router]);

    const loading = result?.fy !== fy;
    const data = result?.data ?? null;
    const error = result?.error ?? '';

    /* กลุ่มที่มีจริงในปีนี้ ตามลำดับคงที่ — สีผูกกับกลุ่ม ไม่ใช่ลำดับ ตัวกรองปีจึงไม่ทำให้สีสลับ */
    const groups = useMemo(() => data?.by_group.map(g => g.group) ?? [], [data]);
    /* กราฟรายเดือนแสดงทั้งปีไว้เทียบเส้นปีก่อน ส่วนเวลาออกผลตัดเดือนที่ยังไม่ถึงทิ้ง
       ต้องคงตัวแปรเดิมไว้ข้ามการ render ไม่งั้นกราฟจะถูกสร้างใหม่ทุกครั้งที่กดสลับมุมมอง */
    const pastMonths = useMemo(() => data?.monthly.filter(m => !m.future) ?? [], [data]);
    /* ปีงบปัจจุบัน เดือนล่าสุดยังไม่จบ (วันสุดท้ายของเดือนถือว่าครบ) */
    const partial = useMemo(() => {
        if (!data || data.fiscal_year !== data.current_fiscal_year) return null;
        const u = data.until_date;
        const lastDay = new Date(Date.UTC(Number(u.slice(0, 4)), Number(u.slice(5, 7)), 0)).getUTCDate();
        return Number(u.slice(8, 10)) < lastDay ? { month: u.slice(0, 7), until: u } : null;
    }, [data]);

    const unitColumns: ColumnsType<Analytics['by_unit'][number]> = useMemo(() => [
        { title: 'หน่วยงานที่ส่งตรวจ', dataIndex: 'unit', key: 'u', fixed: 'left', width: 200 },
        { title: 'ครั้ง', dataIndex: 'isolates', key: 'i', align: 'right', width: 70, sorter: (a, b) => a.isolates - b.isolates, defaultSortOrder: 'descend' },
        { title: 'คน', dataIndex: 'patients', key: 'p', align: 'right', width: 70, sorter: (a, b) => a.patients - b.patients },
        {
            title: <Tooltip title="ผู้ป่วยใน: เก็บสิ่งส่งตรวจระหว่างนอนโรงพยาบาล">ผู้ป่วยใน</Tooltip>,
            key: 'ip', align: 'right', width: 100,
            sorter: (a, b) => (share(a.inpatient_isolates, a.isolates) ?? 0) - (share(b.inpatient_isolates, b.isolates) ?? 0),
            render: (_, r) => <>{r.inpatient_isolates} <span className="text-slate-400 text-xs">{fmtPct(share(r.inpatient_isolates, r.isolates))}</span></>,
        },
        {
            title: <Tooltip title="ติดในโรงพยาบาล: นับคนละครั้งต่อการนอนต่อเชื้อ">ติดใน รพ.</Tooltip>,
            dataIndex: 'ho_events', key: 'ho', align: 'right', width: 90, sorter: (a, b) => a.ho_events - b.ho_events,
        },
        {
            title: <Tooltip title={`กลุ่มที่ต้องแยกผู้ป่วยทันที: ${data?.definitions.critical_groups.join(', ') ?? ''}`}>ต้องแยกทันที</Tooltip>,
            dataIndex: 'critical', key: 'c', align: 'right', width: 100, sorter: (a, b) => a.critical - b.critical,
        },
        {
            title: 'กลุ่มที่พบมากสุด', key: 'g', width: 130,
            render: (_, r) => r.top_group ? <span className="inline-flex items-center gap-1.5"><GroupDot g={r.top_group.name as GroupKey} dark={dark} /><span className="text-slate-400 text-xs">{r.top_group.n}</span></span> : '–',
        },
        {
            title: 'เชื้อที่พบมากสุด', key: 'o', width: 230,
            render: (_, r) => r.top_organism ? <span><i>{r.top_organism.name}</i> <span className="text-slate-400 text-xs">{r.top_organism.n}</span></span> : '–',
        },
    ], [data, dark]);

    const clusterColumns: ColumnsType<Analytics['clusters'][number]> = useMemo(() => [
        {
            title: 'สถานะ', key: 's', width: 100,
            render: (_, c) => c.active
                ? <StatusBadge s={{ ...STATUS.critical, label: 'ยังเกิดอยู่' }} />
                : <span className="text-xs text-slate-500">ผ่านไปแล้ว</span>,
        },
        { title: 'หน่วยงาน', dataIndex: 'unit', key: 'u', width: 170 },
        { title: 'เชื้อ', dataIndex: 'organism', key: 'o', width: 190, render: (v: string) => <i>{v}</i> },
        { title: 'กลุ่ม', dataIndex: 'group', key: 'g', width: 80, render: (g: GroupKey) => <GroupDot g={g} dark={dark} /> },
        { title: 'ผู้ป่วย', dataIndex: 'patients', key: 'p', align: 'right', width: 64 },
        {
            title: 'ช่วงที่พบ', key: 'd', width: 150,
            render: (_, c) => <span className="whitespace-nowrap">{beRange(c.first, c.last)}</span>,
        },
    ], [dark]);

    if (loading && !data) return <DashboardSkeleton kpis={8} charts={6} kpiGrid="grid-cols-2 md:grid-cols-4 xl:grid-cols-8" />;
    if (error && !data) return <Alert type="error" showIcon title={error} />;
    if (!data) return null;

    const s = data.summary;
    const ps = s.prior_same_period;
    const months = data.monthly;
    const def = data.definitions;
    const inpatientIsolates = s.co_isolates + s.ho_isolates;
    /* ป้ายเฉพาะของกลุ่มก้อน: สิ่งที่ต้องทำคือไปสอบสวน ไม่ใช่ "แก้" ตัวเลข */
    const clusterStatus: Status = s.active_clusters > 0 ? { ...STATUS.critical, label: 'สอบสวน' }
        : s.clusters > 0 ? { ...STATUS.warning, label: 'ทบทวน' } : { ...STATUS.good, label: 'ไม่พบ' };
    const priorTxt = `ช่วงเดียวกันของปีงบ ${data.prior.fiscal_year}: ${beDate(data.prior.start_date)} – ${beDate(data.prior.same_until)}`;
    const matrix = matrixBy === 'organism' ? data.organism_matrix : data.specimen_matrix;

    return (
        <div className={`flex flex-col gap-4 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {error && <Alert type="error" showIcon title={error} />}

            {/* ตัวเลขหลักของปีงบที่เลือก เทียบช่วงเดียวกันของปีงบก่อน */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
                <Kpi label="ผลเพาะเชื้อดื้อยา" value={nf.format(s.isolates)} hint={priorTxt}
                    sub={<Delta now={s.isolates} before={ps.isolates} dark={dark} />} />
                <Kpi label="ผู้ป่วย" value={nf.format(s.patients)} hint={priorTxt}
                    sub={<Delta now={s.patients} before={ps.patients} dark={dark} />} />
                <Kpi label={`ต้องแยกทันที (${def.critical_groups.join('/')})`} value={nf.format(s.critical)} hint={priorTxt}
                    sub={<><Delta now={s.critical} before={ps.critical} dark={dark} /> · {s.critical_patients} คน</>} />
                <Kpi label="ติดในโรงพยาบาล" value={nf.format(s.ho_events)}
                    hint={`เก็บสิ่งส่งตรวจตั้งแต่วันนอนที่ ${def.ho_day} · คนเดียวกัน การนอนครั้งเดียวกัน เชื้อเดิม นับครั้งเดียว`}
                    sub={<>{fmtRate(s.ho_rate)} ต่อ 1,000 วันนอน</>} />
                <Kpi label="พบขณะนอนโรงพยาบาล" value={fmtPct(share(inpatientIsolates, s.isolates))}
                    hint="สัดส่วนผลเพาะเชื้อที่เก็บระหว่างนอนโรงพยาบาล ที่เหลือเป็นผู้ป่วยนอกหรือเก็บก่อนรับไว้นอน"
                    sub={`ผู้ป่วยนอก ${nf.format(s.opd_isolates)} · 3 วันแรก ${nf.format(s.co_isolates)} · วันที่ ${def.ho_day}+ ${nf.format(s.ho_isolates)}`} />
                <Kpi label="ผู้ป่วยที่พบซ้ำ" value={nf.format(s.repeat_patients)}
                    hint="ผู้ป่วยที่มีผลเพาะเชื้อดื้อยามากกว่าหนึ่งครั้งในปีงบนี้"
                    sub={`${fmtPct(share(s.repeat_patients, s.patients))} ของผู้ป่วย`} />
                <Kpi label="สั่งตรวจ → ยืนยันผล (P50)" value={fmtDays(s.tat_p50)}
                    hint="ช่วงที่ยังไม่รู้ว่าเป็นเชื้อดื้อยา ผู้ป่วยอาจยังไม่ได้แยก · นับเฉพาะผลที่หาใบสั่งตรวจเจอ"
                    sub={`รายที่ช้า (P90) ${fmtDays(s.tat_p90)}`} />
                <Kpi label="สัญญาณกลุ่มก้อน" value={nf.format(s.clusters)} status={clusterStatus}
                    hint={`ติดในโรงพยาบาลตั้งแต่ ${def.cluster_min_patients} คนขึ้นไป หน่วยงานเดียวกัน เชื้อและกลุ่มดื้อยาเดียวกัน ห่างกันไม่เกิน ${def.cluster_window_days} วัน`}
                    sub={s.active_clusters > 0 ? `ยังเกิดอยู่ ${s.active_clusters} กลุ่ม` : s.clusters > 0 ? 'ผ่านไปแล้วทั้งหมด' : 'ไม่พบ'} />
            </div>

            {s.isolates === 0 ? (
                <Section title="ยังไม่มีข้อมูลในปีงบนี้">
                    <Empty description={`ยังไม่มีผลเพาะเชื้อดื้อยาในปีงบ ${data.fiscal_year} · ปีงบ ${data.prior.fiscal_year} ทั้งปีมี ${nf.format(s.prior_full_year.isolates)} ครั้ง`} />
                </Section>
            ) : (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                        <div className="xl:col-span-3">
                            <Section
                                title="ผลเพาะเชื้อดื้อยารายเดือน แยกกลุ่มการดื้อยา"
                                hint={`เส้นประ = ยอดรวมของปีงบ ${data.prior.fiscal_year} เดือนเดียวกัน · ผลที่มีหลายกลุ่มนับเป็นกลุ่มที่เร่งด่วนที่สุด`
                                    + (partial ? ` · ${monthLabel(partial.month)} ยังไม่ครบเดือน (นับถึง ${beDate(partial.until)})` : '')}
                                extra={<Segmented size="small" value={monthlyView} onChange={v => setMonthlyView(v as 'chart' | 'table')}
                                    options={[{ value: 'chart', label: 'กราฟ' }, { value: 'table', label: 'ตาราง' }]} />}
                            >
                                {monthlyView === 'chart'
                                    ? <MonthlyGroups data={months} groups={groups} priorFy={data.prior.fiscal_year} partial={partial} dark={dark} />
                                    : (
                                        <Table
                                            size="small" rowKey="month" pagination={false} scroll={{ x: 'max-content' }}
                                            dataSource={months}
                                            columns={[
                                                { title: 'เดือน', dataIndex: 'month', fixed: 'left', render: (v: string) => monthLabel(v) },
                                                { title: 'รวม', key: 'n', align: 'right', render: (_: unknown, m: Monthly[number]) => (m.future ? '–' : m.isolates) },
                                                ...groups.map(g => ({
                                                    title: <GroupDot g={g} dark={dark} />, key: g, align: 'right' as const,
                                                    render: (_: unknown, m: Monthly[number]) => (m.future ? '–' : m.groups[g] || ''),
                                                })),
                                                { title: 'คน', key: 'p', align: 'right', render: (_: unknown, m: Monthly[number]) => (m.future ? '–' : m.patients) },
                                                { title: `ปีงบ ${data.prior.fiscal_year}`, dataIndex: 'prior_isolates', align: 'right' },
                                                { title: 'ติดใน รพ.', key: 'ho', align: 'right', render: (_: unknown, m: Monthly[number]) => (m.future ? '–' : m.ho_events) },
                                                { title: 'วันนอน', key: 'pd', align: 'right', render: (_: unknown, m: Monthly[number]) => (m.future ? '–' : nf.format(m.patient_days)) },
                                                { title: 'อัตรา/1,000', key: 'r', align: 'right', render: (_: unknown, m: Monthly[number]) => fmtRate(m.ho_rate) },
                                            ]}
                                        />
                                    )}
                            </Section>
                        </div>
                        <div className="xl:col-span-2">
                            <Section
                                title="อัตราต่อ 1,000 วันนอน"
                                hint={`ทั้งปี: ติดในโรงพยาบาล ${fmtRate(s.ho_rate)} · ผู้ป่วยในทั้งหมด ${fmtRate(s.inpatient_rate)} (${nf.format(s.patient_days)} วันนอน) · เทียบข้ามเดือนและข้ามปีได้แม้จำนวนผู้ป่วยต่างกัน`}
                            >
                                <RateTrend data={months} dark={dark} />
                            </Section>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <Section title="ที่มาของเชื้อ แยกกลุ่มการดื้อยา" hint="กลุ่มที่สีเข้มยาว = เกิดในโรงพยาบาลมาก ควรเน้นการแยกผู้ป่วยและทำความสะอาด · ชี้ที่แท่งเพื่อดูจำนวน">
                            <OnsetByGroup data={data.by_group} dark={dark} />
                        </Section>
                        <Section title="วันนอนที่พบเชื้อครั้งแรก (ผู้ป่วยใน)" hint={`แท่งเทา = 3 วันแรก (ติดมาจากข้างนอก) · แท่งน้ำเงิน = ติดในโรงพยาบาล · หนึ่งรายคือคนละครั้งต่อการนอนต่อเชื้อ`}>
                            <HospDayBars data={data.hosp_days} dark={dark} />
                        </Section>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                        <div className="xl:col-span-3">
                            <Section
                                title="สัญญาณกลุ่มก้อน (ติดในโรงพยาบาล)"
                                hint={`หน่วยงานเดียวกัน เชื้อและกลุ่มดื้อยาเดียวกัน ตั้งแต่ ${def.cluster_min_patients} คน ห่างกันไม่เกิน ${def.cluster_window_days} วัน · เป็นตัวชี้ให้ไปสอบสวน ไม่ใช่คำยืนยันว่ามีการระบาด`}
                            >
                                {data.clusters.length === 0
                                    ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span className="inline-flex items-center gap-1.5"><StatusBadge s={{ ...STATUS.good, label: 'ไม่พบ' }} /> ไม่มีผู้ป่วยติดในโรงพยาบาลด้วยเชื้อเดียวกันในหน่วยงานเดียวกันภายใน {def.cluster_window_days} วัน</span>} />
                                    : <Table size="small" rowKey={c => `${c.unit}|${c.organism}|${c.group}|${c.first}`} pagination={{ pageSize: 8, size: 'small', hideOnSinglePage: true }}
                                        scroll={{ x: 'max-content' }} dataSource={data.clusters} columns={clusterColumns} />}
                            </Section>
                        </div>
                        <div className="xl:col-span-2">
                            <Section title="ผู้ป่วยตามช่วงอายุ" hint="นับเป็นคน ใช้อายุ ณ ผลแรกของปีงบ · ชี้ที่แท่งเพื่อดูเพศ">
                                <AgeBars data={data.age_bands} dark={dark} />
                            </Section>
                        </div>
                    </div>

                    <Section title="รายหน่วยงานที่ส่งตรวจ" hint="กดหัวคอลัมน์เพื่อเรียง · หน่วยงานเดียวกับในกราฟวงกลมและเส้นทางเชื้อดื้อยาด้านล่าง">
                        <Table size="small" rowKey="unit" pagination={{ pageSize: 10, size: 'small', hideOnSinglePage: true }}
                            scroll={{ x: 'max-content' }} dataSource={data.by_unit} columns={unitColumns} />
                    </Section>

                    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                        <div className="xl:col-span-3">
                            <Section
                                title={matrixBy === 'organism' ? 'เชื้อ × กลุ่มการดื้อยา' : 'สิ่งส่งตรวจ × กลุ่มการดื้อยา'}
                                hint={matrix.other_rows > 0
                                    ? `${matrix.rows.length} อันดับแรก · อีก ${matrix.other_rows} รายการรวม ${nf.format(matrix.other_total)} ครั้ง`
                                    : 'ช่องเข้ม = พบมาก · ตัวเลข = จำนวนครั้ง'}
                                extra={<Segmented size="small" value={matrixBy} onChange={v => setMatrixBy(v as 'organism' | 'specimen')}
                                    options={[{ value: 'organism', label: 'เชื้อ' }, { value: 'specimen', label: 'สิ่งส่งตรวจ' }]} />}
                            >
                                <MatrixHeat data={matrix} groups={groups} dark={dark} />
                            </Section>
                        </div>
                        <div className="xl:col-span-2">
                            <Section title="สั่งตรวจ → ยืนยันผล รายเดือน" hint="ยิ่งนาน ผู้ป่วยยิ่งอยู่โดยไม่ได้แยกนาน · นับเฉพาะผลที่หาใบสั่งตรวจเจอ">
                                <TatTrend data={pastMonths} dark={dark} />
                            </Section>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500 flex items-start gap-1.5">
                        <PiInfoBold className="mt-0.5 shrink-0" />
                        <span>
                            นับตามวันที่ยืนยันผล {beDate(data.start_date)} – {beDate(data.until_date)} เหมือนกราฟอื่นในหน้านี้ ·
                            ผู้ป่วยในหาจากทะเบียนนอนที่ครอบวันสั่งตรวจ · ติดในโรงพยาบาล = เก็บสิ่งส่งตรวจตั้งแต่วันนอนที่ {def.ho_day} (วันรับเข้า = วันที่ 1) ·
                            วันนอนนับเป็นคืน · ไม่มีข้อมูลระบุตัวผู้ป่วยในส่วนนี้
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}
