'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { useThemeMode } from '../../lib/theme';
import { registerNurseDark, chartThemeName } from '../../lib/echartsTheme';

/*
  สีประจำประเภทห้อง ใช้ชุดเดียวกันทุกกราฟในหน้านี้
  ถ้าปล่อยให้ echarts ไล่สีเอง สีของ "VIP" จะเปลี่ยนไปมาระหว่างกราฟ
  เพราะลำดับใน series ไม่เท่ากัน แล้วคนอ่านต้องกลับไปดู legend ใหม่ทุกครั้ง

  เลือกโทนอิ่มสี ไม่ใช่โทนหม่นของแบรนด์ เพราะกราฟหลายอันบนหน้าเดียว
  ถ้าสีจืดใกล้กันหมดจะแยกไม่ออกว่าแท่งไหนเป็นประเภทไหนโดยไม่จ้อง legend
*/
export const CLASS_COLOR: Record<string, string> = {
    'สามัญ': '#12b886',
    'พิเศษ': '#4c6ef5',
    'VIP': '#f59f00',
    'งดอาหาร (NPO)': '#adb5bd',
    'ไม่ระบุประเภท': '#ced4da',
};

export const colorOfClass = (name: string) => CLASS_COLOR[name] ?? '#868e96';

/** ไล่เฉดของสีเดียวกันจากเข้มลงอ่อน ใช้ทำแท่งให้ดูมีมิติแทนสีทึบแบน */
const gradient = (color: string) => ({
    type: 'linear' as const,
    x: 0, y: 0, x2: 1, y2: 0,
    colorStops: [
        { offset: 0, color },
        { offset: 1, color: color + 'b3' },
    ],
});

const gradientUp = (color: string) => ({
    type: 'linear' as const,
    x: 0, y: 1, x2: 0, y2: 0,
    colorStops: [
        { offset: 0, color: color + 'b3' },
        { offset: 1, color },
    ],
});

/* จานสีสำหรับกราฟชนิดอาหาร ซึ่งไม่มีความหมายตายตัวเหมือนประเภทห้อง */
const DIET_PALETTE = [
    '#12b886', '#4c6ef5', '#f59f00', '#e8590c', '#ae3ec9',
    '#1098ad', '#f03e3e', '#66a80f', '#d6336c', '#7048e8',
    '#0ca678', '#4263eb',
];

const MEAL_LABEL: Record<number, string> = { 1: 'เช้า', 2: 'กลางวัน', 3: 'เย็น' };
const MEAL_COLOR: Record<number, string> = { 1: '#f59f00', 2: '#1098ad', 3: '#7048e8' };

interface Named { name: string; qty: number }
interface ByMeal { meal: number; class: string; qty: number }
interface Daily { date: string; class: string; qty: number }
interface ByWard { ward_name: string; class: string; qty: number }

/** ครอบ echarts ให้สร้างใหม่เมื่อสลับโหมดสี เพราะธีมตั้งได้แค่ตอน init */
const useChart = (option: echarts.EChartsOption, deps: unknown[]) => {
    const ref = useRef<HTMLDivElement>(null);
    const { resolved } = useThemeMode();

    useEffect(() => {
        if (!ref.current) return;
        registerNurseDark(echarts);
        const chart = echarts.init(ref.current, chartThemeName(resolved === 'dark'));
        chart.setOption(option);
        const onResize = () => chart.resize();
        window.addEventListener('resize', onResize);
        return () => {
            chart.dispose();
            window.removeEventListener('resize', onResize);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, resolved]);

    return ref;
};

/** สัดส่วนตามประเภทห้อง — ตัวเลขที่ครัวใช้วางแผนวัตถุดิบ */
export function ClassDonut({ data }: { data: Named[] }) {
    const total = data.reduce((s, d) => s + d.qty, 0);
    const ref = useChart({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ที่ ({d}%)' },
        legend: { bottom: 0, itemWidth: 12, itemHeight: 12 },
        series: [{
            type: 'pie',
            radius: ['45%', '72%'],
            center: ['50%', '45%'],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 8, borderWidth: 3, borderColor: 'transparent' },
            label: { formatter: '{b}\n{c} ที่', fontWeight: 'bold' },
            emphasis: { scaleSize: 8, itemStyle: { shadowBlur: 18, shadowColor: 'rgba(0,0,0,0.25)' } },
            data: data.map(d => ({
                name: d.name,
                value: d.qty,
                itemStyle: { color: gradientUp(colorOfClass(d.name)) },
            })),
        }],
        graphic: total > 0 ? [{
            type: 'text', left: 'center', top: '41%',
            style: { text: String(total), fontSize: 28, fontWeight: 'bold', fill: '#12b886', align: 'center' },
        }, {
            type: 'text', left: 'center', top: '52%',
            style: { text: 'ที่ทั้งหมด', fontSize: 11, fill: '#999', align: 'center' },
        }] : [],
    }, [data]);

    return <div ref={ref} className="w-full h-full" />;
}

/** ชนิดอาหาร (ธรรมดา / โจ๊ก / จืด ...) เรียงจากมากไปน้อย */
export function DietBar({ data }: { data: Named[] }) {
    const top = data.slice(0, 12).reverse();
    const ref = useChart({
        grid: { left: 8, right: 40, top: 10, bottom: 10, containLabel: true },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c} ที่' },
        xAxis: { type: 'value', minInterval: 1 },
        yAxis: { type: 'category', data: top.map(d => d.name), axisLabel: { fontSize: 11 } },
        series: [{
            type: 'bar',
            // ไล่สีตามลำดับ ไม่ใช่สีเดียวทั้งกราฟ เพราะแท่งแนวนอนหลายแท่งสีเดียวกันอ่านยาก
            data: top.map((d, i) => ({
                value: d.qty,
                itemStyle: { color: gradient(DIET_PALETTE[(top.length - 1 - i) % DIET_PALETTE.length]) },
            })),
            barMaxWidth: 24,
            itemStyle: { borderRadius: [0, 6, 6, 0] },
            label: { show: true, position: 'right', formatter: '{c}', fontWeight: 'bold', color: '#495057' },
        }],
    }, [data]);

    return <div ref={ref} className="w-full h-full" />;
}

/** แนวโน้มรายวัน ซ้อนตามประเภทห้อง */
export function DailyStack({ data }: { data: Daily[] }) {
    const dates = [...new Set(data.map(d => d.date))].sort();
    const classes = [...new Set(data.map(d => d.class))];
    const lookup = new Map(data.map(d => [`${d.date}|${d.class}`, d.qty]));

    const ref = useChart({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { bottom: 0, itemWidth: 12, itemHeight: 12 },
        grid: { left: 8, right: 16, top: 16, bottom: 40, containLabel: true },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: { rotate: dates.length > 12 ? 45 : 0, fontSize: 10, formatter: (v: string) => v.slice(5) },
        },
        yAxis: { type: 'value', minInterval: 1 },
        series: classes.map(c => ({
            name: c,
            type: 'bar' as const,
            stack: 'total',
            barMaxWidth: 38,
            itemStyle: { color: gradientUp(colorOfClass(c)) },
            data: dates.map(d => lookup.get(`${d}|${c}`) ?? 0),
        })),
    }, [data]);

    return <div ref={ref} className="w-full h-full" />;
}

/** รายมื้อ ซ้อนตามประเภทห้อง */
export function MealStack({ data }: { data: ByMeal[] }) {
    const meals = [1, 2, 3];
    const classes = [...new Set(data.map(d => d.class))];
    const lookup = new Map(data.map(d => [`${d.meal}|${d.class}`, d.qty]));

    const ref = useChart({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { bottom: 0, itemWidth: 12, itemHeight: 12 },
        grid: { left: 8, right: 16, top: 16, bottom: 40, containLabel: true },
        xAxis: { type: 'category', data: meals.map(m => MEAL_LABEL[m]) },
        yAxis: { type: 'value', minInterval: 1 },
        series: classes.map(c => ({
            name: c,
            type: 'bar' as const,
            stack: 'total',
            barMaxWidth: 60,
            itemStyle: { color: gradientUp(colorOfClass(c)), borderRadius: [6, 6, 0, 0] },
            // ซ่อนเลข 0 ไม่ให้รกบนแท่งที่ไม่มียอด
            label: { show: true, formatter: (p: { value?: unknown }) => (p.value ? String(p.value) : '') },
            data: meals.map(m => lookup.get(`${m}|${c}`) ?? 0),
        })),
    }, [data]);

    return <div ref={ref} className="w-full h-full" />;
}

/** หอผู้ป่วย ซ้อนตามประเภทห้อง เรียงจากยอดมากไปน้อย */
export function WardStack({ data }: { data: ByWard[] }) {
    const totalOf = new Map<string, number>();
    for (const d of data) totalOf.set(d.ward_name, (totalOf.get(d.ward_name) ?? 0) + d.qty);
    const wards = [...totalOf.entries()].sort((a, b) => a[1] - b[1]).slice(-12).map(([w]) => w);
    const classes = [...new Set(data.map(d => d.class))];
    const lookup = new Map(data.map(d => [`${d.ward_name}|${d.class}`, d.qty]));

    const ref = useChart({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { bottom: 0, itemWidth: 12, itemHeight: 12 },
        grid: { left: 8, right: 30, top: 16, bottom: 40, containLabel: true },
        xAxis: { type: 'value', minInterval: 1 },
        yAxis: { type: 'category', data: wards, axisLabel: { fontSize: 11 } },
        series: classes.map(c => ({
            name: c,
            type: 'bar' as const,
            stack: 'total',
            barMaxWidth: 24,
            itemStyle: { color: gradient(colorOfClass(c)) },
            data: wards.map(w => lookup.get(`${w}|${c}`) ?? 0),
        })),
    }, [data]);

    return <div ref={ref} className="w-full h-full" />;
}

interface MealWardClass { meal: number; ward_name: string; class: string; qty: number }

interface SankeyTooltipParam {
    dataType?: string;
    name?: string;
    value?: number;
    data?: { source?: string; target?: string };
}

/**
 * เส้นทางยอดอาหาร มื้อ → หอผู้ป่วย → ประเภทห้อง
 *
 * ตอบคำถามว่ายอดหนักไปตกที่มื้อไหนของตึกไหน ซึ่งกราฟแท่งแยกกันสองอันตอบไม่ได้
 * เพราะแท่งรายมื้อบอกแค่ยอดรวมของมื้อ ไม่ได้บอกว่ามาจากตึกใด
 */
export function MealWardSankey({ data }: { data: MealWardClass[] }) {
    /*
      ชื่อ node ต้องไม่ซ้ำกันข้ามคอลัมน์ เพราะ echarts ใช้ชื่อเป็นคีย์เชื่อมเส้น
      ชื่อหอผู้ป่วยกับชื่อประเภทห้องมาจากคนละที่ ถ้าบังเอิญตั้งชื่อชนกันเมื่อไหร่
      เส้นจะวิ่งผิดที่โดยไม่มีอะไรฟ้อง จึงเติมเครื่องหมายกำกับคอลัมน์ไว้
    */
    const mealNode = (m: number) => `มื้อ${MEAL_LABEL[m] ?? m}`;
    const wardNode = (w: string) => `🏥 ${w}`;
    const classNode = (c: string) => `◆ ${c}`;

    const nodeTotal = new Map<string, number>();
    const linkTotal = new Map<string, number>();
    const colorOf = new Map<string, string>();
    const SEP = '|::|';

    for (const d of data) {
        const m = mealNode(d.meal), w = wardNode(d.ward_name), c = classNode(d.class);
        colorOf.set(m, MEAL_COLOR[d.meal] ?? '#868e96');
        colorOf.set(w, '#4c6ef5');
        colorOf.set(c, colorOfClass(d.class));
        for (const n of [m, w, c]) nodeTotal.set(n, (nodeTotal.get(n) ?? 0) + d.qty);
        for (const k of [m + SEP + w, w + SEP + c]) linkTotal.set(k, (linkTotal.get(k) ?? 0) + d.qty);
    }

    const total = data.reduce((s, d) => s + d.qty, 0);

    const ref = useChart({
        tooltip: {
            trigger: 'item',
            confine: true,
            // ชนิดที่ echarts ประกาศไว้ครอบทุกกราฟจนกว้างเกินใช้งาน
            // ตรงนี้รู้แน่ว่าเป็น sankey จึงระบุรูปร่างที่ใช้จริงเอง
            formatter: ((p: SankeyTooltipParam) => {
                const pct = total > 0 ? (((p.value ?? 0) / total) * 100).toFixed(1) : '0';
                if (p.dataType === 'edge') {
                    return `${p.data?.source} → ${p.data?.target}<br/><b>${p.value}</b> ที่ (${pct}%)`;
                }
                return `<b>${p.name}</b><br/>${p.value} ที่ (${pct}%)`;
            }) as unknown as echarts.TooltipComponentOption['formatter'],
        },
        series: [{
            type: 'sankey',
            left: 8, right: 130, top: 12, bottom: 12,
            nodeWidth: 16,
            nodeGap: 12,
            nodeAlign: 'justify',
            layoutIterations: 24,
            emphasis: { focus: 'adjacency' },
            data: [...nodeTotal.keys()].map(name => ({
                name,
                itemStyle: { color: colorOf.get(name) ?? '#868e96', borderWidth: 0 },
            })),
            links: [...linkTotal.entries()].map(([k, value]) => {
                const [source, target] = k.split(SEP);
                return { source, target, value };
            }),
            label: { fontSize: 12, fontWeight: 'bold' },
            lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.5 },
        }],
    }, [data]);

    return <div ref={ref} className="w-full h-full" />;
}
