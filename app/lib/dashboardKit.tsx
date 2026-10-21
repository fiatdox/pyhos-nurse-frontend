'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Card, Tooltip } from 'antd';
import { PiCheckCircleBold, PiWarningBold, PiWarningOctagonBold } from 'react-icons/pi';
import { useThemeMode } from './theme';
import { registerNurseDark, chartThemeName } from './echartsTheme';

/*
  ชิ้นส่วนที่ใช้ร่วมกันของหน้าวิเคราะห์ (ห้องยา, IC)
  ให้ทุกหน้าวิเคราะห์อ่านเหมือนกัน: ไทล์ตัวเลข การ์ดหัวข้อ ป้ายสถานะ สีเส้นตาราง
*/

/* สถานะดี/เตือน/วิกฤต ใช้กับตัวเลขที่มีเกณฑ์เท่านั้น และมาพร้อมไอคอนกับคำเสมอ ไม่ใช้สีอย่างเดียว */
export const STATUS = {
    good: { color: '#0ca30c', icon: PiCheckCircleBold, label: 'ดี' },
    warning: { color: '#c98500', icon: PiWarningBold, label: 'ควรดู' },
    critical: { color: '#d03b3b', icon: PiWarningOctagonBold, label: 'ต้องแก้' },
};

export type Status = (typeof STATUS)[keyof typeof STATUS];

export const StatusBadge = ({ s }: { s: Status | null }) => s && (
    <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap" style={{ color: s.color }}>
        <s.icon size={14} /> {s.label}
    </span>
);

export const nf = new Intl.NumberFormat('th-TH');
export const fmtPct = (r: number | null | undefined) => (r === null || r === undefined ? '–' : `${Math.round(r * 100)}%`);
export const share = (n: number, d: number) => (d > 0 ? n / d : null);

/** echarts สร้างใหม่ทุกครั้งที่สลับโหมดสี เพราะธีมตั้งได้แค่ตอน init (แบบเดียวกับ FoodTypeCharts) */
export const useChart = (option: echarts.EChartsOption | null, deps: unknown[]) => {
    const ref = useRef<HTMLDivElement>(null);
    const { resolved } = useThemeMode();

    useEffect(() => {
        if (!ref.current || !option) return;
        registerNurseDark(echarts);
        const chart = echarts.init(ref.current, chartThemeName(resolved === 'dark'));
        chart.setOption(option);
        const ro = new ResizeObserver(() => chart.resize());
        ro.observe(ref.current);
        return () => { ro.disconnect(); chart.dispose(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, resolved]);

    return ref;
};

export const baseText = (dark: boolean) => ({
    fontFamily: 'inherit',
    color: dark ? '#a6a6a6' : '#52514e',
});

/* เส้นตารางจาง เส้นทึบบาง ไม่ใช้เส้นประ */
export const grid = (dark: boolean) => ({ lineStyle: { color: dark ? '#303030' : '#ecebe8', width: 1, type: 'solid' as const } });

export const axisLine = (dark: boolean) => ({ lineStyle: { color: dark ? '#434343' : '#d9d8d4' } });

export function Kpi({ label, value, sub, status, hint }: {
    label: string; value: string; sub?: React.ReactNode;
    status?: Status | null; hint?: string;
}) {
    const body = (
        <div className="rounded-xl border border-slate-200 bg-white p-3 h-full">
            <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-slate-500 leading-tight">{label}</span>
                {status && <StatusBadge s={status} />}
            </div>
            <div className="text-2xl font-semibold text-slate-900 mt-1 leading-tight">{value}</div>
            {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
    );
    return hint ? <Tooltip title={hint}>{body}</Tooltip> : body;
}

export function Section({ title, hint, extra, children }: {
    title: string; hint?: string; extra?: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <Card
            size="small"
            title={
                <div className="flex flex-col py-1">
                    <span className="font-semibold">{title}</span>
                    {hint && <span className="text-xs font-normal text-slate-500 whitespace-normal">{hint}</span>}
                </div>
            }
            extra={extra}
            className="h-full"
        >
            {children}
        </Card>
    );
}
