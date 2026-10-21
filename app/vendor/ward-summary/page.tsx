'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import { Button, Card, DatePicker, Segmented, Table, Typography, Empty, Alert } from 'antd';
import { tableLoading } from '@/app/components/Skeletons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { PiFileXlsBold } from 'react-icons/pi';
import { vendorHeaders, getVendorProfile } from '../../lib/vendorAuth';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface FoodType {
    food_type_id: number;
    food_type_name: string;
}

interface WardRow {
    ward: string;
    ward_name: string;
    meal: number;
    meal_name: string;
    qty_by_type: Record<number, number>;
    total: number;
}

export default function VendorWardSummaryPage() {
    const [mode, setMode] = useState<'รายวัน' | 'ช่วงวันที่'>('รายวัน');
    const [day, setDay] = useState<dayjs.Dayjs>(dayjs());
    const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf('month'),
        dayjs().endOf('month'),
    ]);
    const [types, setTypes] = useState<FoodType[]>([]);
    const [rows, setRows] = useState<WardRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const period = useMemo(() => mode === 'รายวัน'
        ? { date1: day.format('YYYY-MM-DD'), date2: day.format('YYYY-MM-DD') }
        : { date1: range[0].format('YYYY-MM-DD'), date2: range[1].format('YYYY-MM-DD') },
        [mode, day, range]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.post('/api/v1/vendor/ward-summary', period, { headers: vendorHeaders() });
            setTypes(res.data?.data?.food_types ?? []);
            setRows(res.data?.data?.rows ?? []);
            setSearched(true);
        } catch {
            setTypes([]);
            setRows([]);
            setSearched(true);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* รวมท้ายตาราง คิดที่หน้าจอได้เพราะเป็นการบวกจำนวนนับล้วน ไม่ใช่สูตรถ่วงน้ำหนัก */
    const totals = useMemo(() => ({
        byType: Object.fromEntries(types.map(t =>
            [t.food_type_id, rows.reduce((s, r) => s + (r.qty_by_type[t.food_type_id] ?? 0), 0)])),
        total: rows.reduce((s, r) => s + r.total, 0),
        wards: new Set(rows.map(r => r.ward)).size,
    }), [rows, types]);

    const columns: ColumnsType<WardRow> = [
        {
            title: 'หอผู้ป่วย', dataIndex: 'ward_name', key: 'w', width: 180, fixed: 'left',
            /*
              ชื่อหอกินพื้นที่แถวเดียวของแต่ละหอ เพราะหนึ่งหอมีสามมื้อเสมอ
              ถ้าพิมพ์ชื่อซ้ำทุกแถว ตาจะไล่ยากว่าบล็อกไหนเป็นของหอไหน
            */
            onCell: (r, index) => {
                const first = rows.findIndex(x => x.ward === r.ward);
                return { rowSpan: first === index ? rows.filter(x => x.ward === r.ward).length : 0 };
            },
            render: (v: string) => <span className="font-semibold">{v}</span>,
        },
        { title: 'มื้อ', dataIndex: 'meal_name', key: 'm', width: 110 },
        ...types.map(t => ({
            title: t.food_type_name,
            key: `t${t.food_type_id}`,
            width: 110,
            align: 'right' as const,
            render: (_: unknown, r: WardRow) => {
                const v = r.qty_by_type[t.food_type_id] ?? 0;
                return v > 0 ? <span className="font-semibold">{v.toLocaleString('th-TH')}</span>
                    : <span className="text-gray-300">0</span>;
            },
        })),
        {
            title: 'รวม', dataIndex: 'total', key: 'total', width: 100, align: 'right',
            render: (v: number) => v > 0
                ? <span className="font-bold text-[#006b5f]">{v.toLocaleString('th-TH')}</span>
                : <span className="text-gray-300">0</span>,
        },
    ];

    const exportExcel = () => {
        const head = ['หอผู้ป่วย', 'มื้อ', ...types.map(t => t.food_type_name), 'รวม'];
        const pad = (t: string) => [t, ...Array(head.length - 1).fill('')];
        const profile = getVendorProfile();

        const sheet: (string | number)[][] = [
            pad(`ยอดสั่งอาหารตามหอผู้ป่วย — ${profile?.vendor_name ?? ''}`),
            pad(mode === 'รายวัน'
                ? `ประจำวันที่ ${day.format('DD/MM/BBBB')}`
                : `ช่วงวันที่ ${range[0].format('DD/MM/BBBB')} - ${range[1].format('DD/MM/BBBB')}`),
            pad('นับเฉพาะรายการที่งานโภชนาการอนุมัติแล้ว ตามยอดที่สั่ง ไม่ใช่ยอดที่รับมอบ'),
            pad(`ออกรายงานเมื่อ ${dayjs().format('DD/MM/BBBB HH:mm')} น.`),
            [],
            head,
            ...rows.map(r => [r.ward_name, r.meal_name,
                ...types.map(t => r.qty_by_type[t.food_type_id] ?? 0), r.total]),
            [],
            ['รวมทั้งสิ้น', '', ...types.map(t => totals.byType[t.food_type_id] ?? 0), totals.total],
        ];

        const ws = XLSX.utils.aoa_to_sheet(sheet);
        ws['!cols'] = head.map((_, i) => ({ wch: i === 0 ? 22 : 14 }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ยอดตามตึก');
        XLSX.writeFile(wb, `ยอดตามตึก_${period.date1}_ถึง_${period.date2}.xlsx`);
    };

    return (
        <>
            <Card>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Title level={5} className="m-0! mr-auto">ยอดสั่งอาหารตามหอผู้ป่วย</Title>
                    <Segmented value={mode} onChange={v => setMode(v as typeof mode)} options={['รายวัน', 'ช่วงวันที่']} />
                    {mode === 'รายวัน'
                        ? <DatePicker value={day} onChange={d => d && setDay(d)} format="DD/MM/BBBB" allowClear={false} />
                        : <RangePicker
                            value={range}
                            onChange={v => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
                            format="DD/MM/BBBB"
                            allowClear={false}
                        />}
                    <Button type="primary" onClick={fetchData} loading={loading}>ดูยอด</Button>
                    <Button icon={<PiFileXlsBold />} onClick={exportExcel} disabled={rows.length === 0}>
                        ส่งออก Excel
                    </Button>
                </div>

                <Alert
                    type="info"
                    showIcon
                    className="mb-4"
                    title="ใช้เป็นใบส่งของ บอกว่าต้องส่งไปหอไหนกี่ที่ แยกตามประเภทอาหาร"
                    description="นับเฉพาะรายการที่งานโภชนาการอนุมัติแล้ว · มื้อที่ไม่มีคนสั่งจะแสดงเป็นศูนย์ ไม่ใช่หายไปจากตาราง เพื่อให้แยกออกว่า “ไม่มี” กับ “ตกหล่น”"
                />

                {searched && rows.length === 0 && (
                    <Alert
                        type="warning"
                        showIcon
                        className="mb-4"
                        title="ยังไม่มีรายการที่อนุมัติในช่วงที่เลือก"
                        description="งานโภชนาการอาจยังไม่ได้กดอนุมัติส่งบริษัท หรือช่วงนั้นไม่มีการสั่งอาหารประเภทที่บริษัทรับผิดชอบ"
                    />
                )}

                {rows.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        <Chip label="หอผู้ป่วย" value={`${totals.wards}`} unit="หอ" />
                        {types.map(t => (
                            <Chip key={t.food_type_id} label={t.food_type_name}
                                value={(totals.byType[t.food_type_id] ?? 0).toLocaleString('th-TH')} unit="ที่" />
                        ))}
                        <Chip label="รวมทั้งสิ้น" value={totals.total.toLocaleString('th-TH')} unit="ที่" strong />
                    </div>
                )}

                <Table
                    rowKey={r => `${r.ward}-${r.meal}`}
                    columns={columns}
                    dataSource={rows}
                    {...tableLoading(loading, rows, (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={searched ? 'ช่วงที่เลือกไม่มีรายการอาหารของบริษัท' : 'เลือกวันที่แล้วกดดูยอด'} />
                    ))}
                    size="small"
                    bordered
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    summary={() => rows.length === 0 ? null : (
                        <Table.Summary fixed>
                            <Table.Summary.Row className="bg-teal-50 dark:bg-[#113536]">
                                <Table.Summary.Cell index={0} colSpan={2}>
                                    <span className="font-bold">รวมทั้งสิ้น</span>
                                </Table.Summary.Cell>
                                {types.map((t, i) => (
                                    <Table.Summary.Cell key={t.food_type_id} index={2 + i} align="right">
                                        <span className="font-bold">{(totals.byType[t.food_type_id] ?? 0).toLocaleString('th-TH')}</span>
                                    </Table.Summary.Cell>
                                ))}
                                <Table.Summary.Cell index={2 + types.length} align="right">
                                    <span className="text-lg font-bold text-[#006b5f]">{totals.total.toLocaleString('th-TH')}</span>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                        </Table.Summary>
                    )}
                />
            </Card>
        </>
    );
}

function Chip({ label, value, unit, strong }: { label: string; value: string; unit: string; strong?: boolean }) {
    return (
        <div className={`border rounded-lg px-3 py-2 ${strong
            ? 'border-[#006b5f] bg-teal-50 dark:bg-[#113536]'
            : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="text-xs text-gray-500">{label}</div>
            <div className={`font-bold ${strong ? 'text-[#006b5f] text-lg' : ''}`}>
                {value} <span className="text-xs font-normal text-gray-400">{unit}</span>
            </div>
        </div>
    );
}
