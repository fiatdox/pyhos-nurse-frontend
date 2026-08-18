'use client';

import React, { useState, useCallback } from 'react';
import {
    Card, Button, Table, Tag, DatePicker, Typography, Spin, Empty, Input, Tooltip, Select,
} from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import Navbar from '../../components/Navbar';
import { PiFileXlsBold, PiMagnifyingGlassBold, PiVirusBold } from 'react-icons/pi';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface AmrRow {
    id: number;
    confirm_date: string;
    order_date: string | null;
    lab_no: string;
    hn: string;
    ptname: string | null;
    sex: string | null;
    age: number | null;
    an: string | null;
    ward_name: string | null;
    department: string | null;
    specimen: string | null;
    organism: string;
    resistance: string;
}

interface Summary {
    total: number;
    patients: number;
    organisms: number;
    admitted: number;
    by_resistance: { name: string; count: number }[];
}

/*
  สีตามความเร่งด่วนทางระบาดวิทยา ไม่ใช่ไล่ตามลำดับตัวอักษร
  กลุ่มดื้อ carbapenem กับ VRE ต้องแยกผู้ป่วยทันที จึงใช้โทนแดง
*/
const RESISTANCE_COLOR: { match: RegExp; color: string }[] = [
    { match: /CRE/, color: 'red' },
    { match: /CRAB/, color: 'volcano' },
    { match: /CRPA/, color: 'orange' },
    { match: /VRE/, color: 'magenta' },
    { match: /MRSA/, color: 'purple' },
    { match: /MRCONS|MRSE/, color: 'geekblue' },
    { match: /ESCR/, color: 'gold' },
    { match: /MDR/, color: 'cyan' },
];

const colorOfResistance = (value: string) =>
    RESISTANCE_COLOR.find(r => r.match.test(value))?.color ?? 'default';

const HEADERS = [
    'วันที่รายงานผล', 'วันที่ส่งตรวจ', 'เลขที่ Lab', 'HN', 'ชื่อ-สกุล', 'เพศ', 'อายุ',
    'AN', 'หอผู้ป่วย', 'หน่วยงานที่ส่งตรวจ', 'สิ่งส่งตรวจ', 'เชื้อก่อโรค', 'กลุ่มการดื้อยา',
];

export default function AmrReportPage() {
    const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf('month'),
        dayjs(),
    ]);
    const [rows, setRows] = useState<AmrRow[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [groupFilter, setGroupFilter] = useState<string | null>(null);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
            const res = await axios.post('/api/v1/ic/amr-patient-report', {
                date1: range[0].format('YYYY-MM-DD'),
                date2: range[1].format('YYYY-MM-DD'),
            }, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' } });

            if (res.data?.success) {
                setRows(res.data.data ?? []);
                setSummary(res.data.summary ?? null);
                setSearched(true);
            }
        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง'
                : 'กรุณาลองใหม่อีกครั้ง';
            Swal.fire({ icon: 'error', title: 'ดึงรายงานไม่สำเร็จ', text: message, timer: 3000, showConfirmButton: false });
        } finally {
            setLoading(false);
        }
    }, [range]);

    // กรองฝั่งหน้าจอ ข้อมูลถูกดึงมาครบแล้ว พิมพ์ค้นหาจึงไม่ต้องรอเซิร์ฟเวอร์
    const filtered = rows.filter(r => {
        if (groupFilter && r.resistance !== groupFilter) return false;
        if (!keyword.trim()) return true;
        const k = keyword.trim().toLowerCase();
        return [r.hn, r.an, r.ptname, r.organism, r.ward_name, r.department, r.lab_no]
            .some(v => String(v ?? '').toLowerCase().includes(k));
    });

    const toRow = (r: AmrRow) => [
        r.confirm_date, r.order_date ?? '', r.lab_no, r.hn, r.ptname ?? '', r.sex ?? '',
        r.age ?? '', r.an ?? '', r.ward_name ?? '', r.department ?? '', r.specimen ?? '',
        r.organism, r.resistance,
    ];

    const exportExcel = () => {
        if (filtered.length === 0) {
            Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูลให้ส่งออก', timer: 2000, showConfirmButton: false });
            return;
        }

        const period = `${range[0].format('DD/MM/BBBB')} - ${range[1].format('DD/MM/BBBB')}`;
        const blank = Array(HEADERS.length).fill('');
        const titleRows = [
            ['รายงานผู้ป่วยที่ตรวจพบเชื้อดื้อยา (AMR)', ...Array(HEADERS.length - 1).fill('')],
            [`ช่วงวันที่ ${period}`, ...Array(HEADERS.length - 1).fill('')],
            [
                `รวม ${filtered.length} ผลเพาะเชื้อ`,
                `ผู้ป่วย ${new Set(filtered.map(r => r.hn)).size} ราย`,
                ...Array(HEADERS.length - 2).fill(''),
            ],
            [`ออกรายงานเมื่อ ${dayjs().format('DD/MM/BBBB HH:mm')} น.`, ...Array(HEADERS.length - 1).fill('')],
            blank,
        ];

        // สรุปตามกลุ่มดื้อยาต่อท้ายไว้ในชีตเดียวกัน คนรับไฟล์จะได้ไม่ต้องมานั่งทำ pivot เอง
        const groupCount = new Map<string, number>();
        for (const r of filtered) groupCount.set(r.resistance, (groupCount.get(r.resistance) ?? 0) + 1);
        const summaryRows = [
            blank,
            ['--- สรุปตามกลุ่มการดื้อยา ---', ...Array(HEADERS.length - 1).fill('')],
            ...[...groupCount.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => [name, count, ...Array(HEADERS.length - 2).fill('')]),
        ];

        const ws = XLSX.utils.aoa_to_sheet([
            ...titleRows,
            HEADERS,
            ...filtered.map(toRow),
            ...summaryRows,
        ]);
        ws['!cols'] = [
            { wch: 14 }, { wch: 13 }, { wch: 12 }, { wch: 10 }, { wch: 26 }, { wch: 6 }, { wch: 6 },
            { wch: 12 }, { wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 28 }, { wch: 14 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'AMR');
        XLSX.writeFile(wb, `รายงานผู้ป่วยเชื้อดื้อยา_${range[0].format('YYYY-MM-DD')}_ถึง_${range[1].format('YYYY-MM-DD')}.xlsx`);
    };

    const columns: TableColumnsType<AmrRow> = [
        {
            title: 'วันที่รายงานผล', dataIndex: 'confirm_date', key: 'confirm_date', width: 120, fixed: 'left',
            render: (d: string) => dayjs(d).format('DD/MM/BBBB'),
        },
        {
            title: 'HN / AN', key: 'hn_an', width: 120, fixed: 'left',
            render: (_, r) => (
                <div className="flex flex-col text-xs">
                    <span className="text-blue-600 font-semibold">{r.hn}</span>
                    <span className="text-gray-500">{r.an || 'ผู้ป่วยนอก'}</span>
                </div>
            ),
        },
        {
            title: 'ชื่อ-สกุล', dataIndex: 'ptname', key: 'ptname', width: 190,
            render: (name: string | null, r) => (
                <div className="flex flex-col">
                    <span className="font-medium">{name || '-'}</span>
                    <span className="text-[11px] text-gray-400">
                        {[r.sex, r.age !== null ? `${r.age} ปี` : null].filter(Boolean).join(' · ')}
                    </span>
                </div>
            ),
        },
        { title: 'หอผู้ป่วย', dataIndex: 'ward_name', key: 'ward_name', width: 140, render: (v: string) => v || <span className="text-gray-300">-</span> },
        { title: 'หน่วยงานที่ส่งตรวจ', dataIndex: 'department', key: 'department', width: 180, render: (v: string) => v || <span className="text-gray-300">-</span> },
        {
            title: 'สิ่งส่งตรวจ', dataIndex: 'specimen', key: 'specimen', width: 110, align: 'center',
            render: (v: string) => v ? <Tag className="m-0">{v}</Tag> : <span className="text-gray-300">-</span>,
        },
        {
            title: 'เชื้อก่อโรค', dataIndex: 'organism', key: 'organism', width: 220,
            render: (v: string) => <span className="italic">{v}</span>,
        },
        {
            title: 'กลุ่มการดื้อยา', dataIndex: 'resistance', key: 'resistance', width: 140, align: 'center',
            render: (v: string) => <Tag color={colorOfResistance(v)} className="m-0 font-semibold">{v}</Tag>,
        },
        { title: 'เลขที่ Lab', dataIndex: 'lab_no', key: 'lab_no', width: 110, align: 'center' },
    ];

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-full mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-rose-700 p-2.5 rounded-xl shadow-md">
                                <PiVirusBold className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <Title level={4} className="m-0!">รายงานผู้ป่วยที่ตรวจพบเชื้อดื้อยา (AMR)</Title>
                                <Text type="secondary" className="text-sm">
                                    หนึ่งบรรทัดคือหนึ่งผลเพาะเชื้อ ผู้ป่วยรายเดียวที่พบหลายครั้งจะแสดงแยกบรรทัด
                                </Text>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <RangePicker
                                value={range}
                                onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
                                format="DD/MM/BBBB"
                                allowClear={false}
                                // ผลเพาะเชื้อยังไม่ออกล่วงหน้า เลือกวันในอนาคตได้ก็ได้แต่ลิสต์ว่างเปล่า
                                maxDate={dayjs()}
                            />
                            <Button
                                type="primary"
                                icon={<PiMagnifyingGlassBold />}
                                loading={loading}
                                onClick={fetchReport}
                                className="bg-[#006b5f] hover:bg-[#005a50]"
                            >
                                ดึงข้อมูล
                            </Button>
                            <Tooltip title={filtered.length === 0 ? 'ยังไม่มีข้อมูลให้ส่งออก' : `ส่งออก ${filtered.length} บรรทัดตามที่กรองอยู่`}>
                                <Button
                                    icon={<PiFileXlsBold className="text-lg" />}
                                    onClick={exportExcel}
                                    disabled={filtered.length === 0}
                                    className="text-green-700 border-green-600 hover:bg-green-50"
                                >
                                    ส่งออก Excel
                                </Button>
                            </Tooltip>
                        </div>
                    </div>

                    {summary && searched && (
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <Tag color="red" className="m-0 px-3 py-0.5">พบเชื้อดื้อยา {summary.total} ครั้ง</Tag>
                            <Tag color="blue" className="m-0 px-3 py-0.5">ผู้ป่วย {summary.patients} ราย</Tag>
                            <Tag color="cyan" className="m-0 px-3 py-0.5">เชื้อ {summary.organisms} ชนิด</Tag>
                            <Tag color="purple" className="m-0 px-3 py-0.5">อยู่ระหว่างนอนโรงพยาบาล {summary.admitted} ครั้ง</Tag>
                            <span className="text-gray-300">|</span>
                            {/* กดที่กลุ่มเพื่อกรอง เป็นทางที่คนใช้จริงเข้าถึงเร็วกว่าไปหาในตัวกรอง */}
                            {summary.by_resistance.map(g => (
                                <Tag
                                    key={g.name}
                                    color={groupFilter === g.name ? colorOfResistance(g.name) : 'default'}
                                    className="m-0 cursor-pointer px-2"
                                    onClick={() => setGroupFilter(groupFilter === g.name ? null : g.name)}
                                >
                                    {g.name} {g.count}
                                </Tag>
                            ))}
                        </div>
                    )}

                    {searched && rows.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <Input
                                placeholder="ค้นหา HN / AN / ชื่อ / เชื้อ / หอผู้ป่วย"
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                                allowClear
                                style={{ width: 300 }}
                                prefix={<PiMagnifyingGlassBold className="text-gray-400" />}
                            />
                            <Select
                                value={groupFilter}
                                onChange={v => setGroupFilter(v ?? null)}
                                placeholder="ทุกกลุ่มการดื้อยา"
                                allowClear
                                style={{ width: 200 }}
                                options={(summary?.by_resistance ?? []).map(g => ({
                                    label: `${g.name} (${g.count})`,
                                    value: g.name,
                                }))}
                            />
                            {(keyword || groupFilter) && (
                                <span className="text-sm text-gray-500">
                                    แสดง {filtered.length} จาก {rows.length} บรรทัด
                                </span>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center py-16"><Spin size="large" /></div>
                    ) : !searched ? (
                        <Empty description="เลือกช่วงวันที่แล้วกดดึงข้อมูล" />
                    ) : rows.length === 0 ? (
                        <Empty description={`ไม่พบผู้ป่วยที่ตรวจพบเชื้อดื้อยาในช่วง ${range[0].format('DD/MM/BBBB')} - ${range[1].format('DD/MM/BBBB')}`} />
                    ) : (
                        <Table
                            columns={columns}
                            dataSource={filtered}
                            rowKey="id"
                            size="small"
                            bordered
                            scroll={{ x: 'max-content' }}
                            pagination={{ pageSize: 50, showSizeChanger: true, showTotal: (t) => `ทั้งหมด ${t} บรรทัด` }}
                            className="
                                [&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]!
                                [&_.ant-table-thead_.ant-table-cell]:text-white!
                                [&_.ant-table-thead_.ant-table-cell]:font-semibold!
                            "
                        />
                    )}
                </Card>
            </div>
        </div>
    );
}
