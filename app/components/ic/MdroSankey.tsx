'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as echarts from 'echarts';
import axios from 'axios';
import { Spin, Empty, Tag } from 'antd';
import { useThemeMode } from '../../lib/theme';
import { registerNurseDark, chartThemeName } from '../../lib/echartsTheme';

interface SankeyNode {
    name: string;
    depth: number;
    value: number;
}

interface SankeyLink {
    source: string;
    target: string;
    value: number;
}

interface SankeyData {
    fiscal_year: number;
    start_date: string;
    end_date: string;
    total: number;
    department_count: number;
    organism_count: number;
    nodes: SankeyNode[];
    links: SankeyLink[];
}

/*
  สีตามกลุ่มการดื้อยา ไม่ได้ไล่ตามลำดับ node
  กลุ่มที่ต้องรีบจัดการ (carbapenem-resistant, VRE) ใช้โทนแดง-ส้ม
  กลุ่มที่พบบ่อยแต่รับมือได้ (ESBL) ใช้โทนเหลือง ส่วนที่เหลือเป็นโทนกลาง
  คนอ่านจะกวาดตาหาปัญหาเจอก่อนอ่านตัวเลข
*/
const RESISTANCE_COLOR: { match: RegExp; color: string }[] = [
    { match: /CRE/, color: '#c0392b' },
    { match: /CRAB/, color: '#e74c3c' },
    { match: /CRPA/, color: '#e67e22' },
    { match: /VRE/, color: '#d35400' },
    { match: /MRSA/, color: '#8e44ad' },
    { match: /MRCONS|MRSE/, color: '#9b59b6' },
    { match: /ESCR/, color: '#f39c12' },
    { match: /MDR/, color: '#16a085' },
];

const DEPTH_COLOR = ['#006b5f', '#2980b9'];

const colorOf = (node: SankeyNode) => {
    if (node.depth < 2) return DEPTH_COLOR[node.depth];
    return RESISTANCE_COLOR.find(r => r.match.test(node.name))?.color ?? '#7f8c8d';
};

const MdroSankey = () => {
    const chartRef = useRef<HTMLDivElement>(null);
    const [data, setData] = useState<SankeyData | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    // ธีมของ echarts ตั้งได้แค่ตอน init กราฟจึงต้องสร้างใหม่ทุกครั้งที่สลับโหมด
    const { resolved } = useThemeMode();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
                if (!token) {
                    router.push('/');
                    return;
                }
                const res = await axios.get('/api/v1/ic/mdro-sankey-fiscal-year', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.data?.success) setData(res.data.data);
            } catch (error) {
                console.error('Error fetching MDRO sankey:', error);
                if (axios.isAxiosError(error) && error.response?.status === 401) router.push('/');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [router]);

    useEffect(() => {
        if (!chartRef.current || !data || data.nodes.length === 0) return;

        registerNurseDark(echarts);
        const chart = echarts.init(chartRef.current, chartThemeName(resolved === 'dark'));

        const labelColor = resolved === 'dark' ? '#d9d9d9' : '#374151';

        chart.setOption({
            tooltip: {
                trigger: 'item',
                triggerOn: 'mousemove',
                confine: true,
                formatter: (p: { dataType: string; name: string; value: number; data: { source?: string; target?: string } }) => {
                    const pct = (n: number) => ((n / data.total) * 100).toFixed(1);
                    if (p.dataType === 'edge') {
                        return `${p.data.source} → ${p.data.target}<br/><b>${p.value}</b> ครั้ง (${pct(p.value)}%)`;
                    }
                    return `<b>${p.name}</b><br/>${p.value} ครั้ง (${pct(p.value)}%)`;
                },
            },
            series: [
                {
                    type: 'sankey',
                    left: 8,
                    right: 130,
                    top: 10,
                    bottom: 10,
                    nodeWidth: 14,
                    nodeGap: 9,
                    // จัดเรียง node เองตามยอด ไม่ปล่อยให้สลับที่ทุกครั้งที่ข้อมูลขยับ
                    nodeAlign: 'justify',
                    layoutIterations: 24,
                    emphasis: { focus: 'adjacency' },
                    data: data.nodes.map(n => ({
                        name: n.name,
                        depth: n.depth,
                        itemStyle: { color: colorOf(n), borderWidth: 0 },
                    })),
                    links: data.links,
                    label: {
                        color: labelColor,
                        fontSize: 11,
                        formatter: '{b}',
                    },
                    lineStyle: { color: 'gradient', curveness: 0.5, opacity: 0.38 },
                },
            ],
        });

        const handleResize = () => chart.resize();
        window.addEventListener('resize', handleResize);
        return () => {
            chart.dispose();
            window.removeEventListener('resize', handleResize);
        };
    }, [data, resolved]);

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Spin size="large" /></div>;
    }

    if (!data || data.nodes.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <Empty description="ยังไม่มีผลเพาะเชื้อดื้อยาในปีงบประมาณนี้" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
                <Tag color="green" className="m-0">ปีงบประมาณ {data.fiscal_year}</Tag>
                <span className="text-gray-500">
                    {data.start_date.split('-').reverse().join('/')} ถึงวันนี้
                </span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">
                    <b className="text-[var(--brand-text)]">{data.total.toLocaleString()}</b> ครั้งที่พบเชื้อดื้อยา
                    จาก {data.department_count} หน่วยงาน {data.organism_count} ชนิดเชื้อ
                </span>
            </div>
            <div ref={chartRef} className="flex-1" style={{ minHeight: 480 }} />
            <p className="text-[11px] text-gray-400 mt-1 mb-0">
                หน่วยงานที่ส่งตรวจ → เชื้อก่อโรค → กลุ่มการดื้อยา ·
                นับตามผลเพาะเชื้อที่รายงานแล้ว หน่วยงานและเชื้อที่พบน้อยถูกยุบเป็น “อื่นๆ”
            </p>
        </div>
    );
};

export default MdroSankey;
