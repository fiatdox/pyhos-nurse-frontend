'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, Button, Table, DatePicker, Typography, Empty } from 'antd';
import { tableLoading } from '@/app/components/Skeletons';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import Swal from 'sweetalert2';
import Navbar from '../../components/Navbar';
import { PiBowlFoodBold, PiMagnifyingGlassBold } from 'react-icons/pi';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;

interface SummaryRow {
    ward: string;
    ward_name: string;
    meal: number;
    meal_name: string;
    normal: number;
    special: number;
    vip: number;
    npo: number;
    unspecified: number;
    total: number;
}

interface Totals {
    wards: number;
    normal: number;
    special: number;
    vip: number;
    npo: number;
    unspecified: number;
    total: number;
}

/* สีเดียวกับแดชบอร์ดยอดอาหารตามประเภท คนใช้จะได้อ่านสองหน้าด้วยความเข้าใจชุดเดียวกัน */
const TYPE_COLOR: Record<string, string> = {
    normal: 'text-emerald-600',
    special: 'text-blue-600',
    vip: 'text-amber-600',
};

const num = (v: number, cls?: string) => v > 0
    ? <span className={`font-semibold ${cls ?? ''}`}>{v.toLocaleString('th-TH')}</span>
    : <span className="text-gray-300">-</span>;

export default function NutritionWardSummaryPage() {
    const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
    const [rows, setRows] = useState<SummaryRow[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const authHeaders = useCallback((): Record<string, string> => {
        const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }, []);

    const fetchSummary = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.post('/api/v1/nutrition/daily-type-summary',
                { date: date.format('YYYY-MM-DD') }, { headers: authHeaders() });
            if (res.data?.success) {
                setRows(res.data.data.rows ?? []);
                setTotals(res.data.data.summary ?? null);
                setSearched(true);
            }
        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง'
                : 'กรุณาลองใหม่อีกครั้ง';
            Swal.fire({ icon: 'error', title: 'ดึงข้อมูลไม่สำเร็จ', text: message, timer: 3000, showConfirmButton: false });
        } finally {
            setLoading(false);
        }
    }, [date, authHeaders]);

    useEffect(() => { fetchSummary(); }, [fetchSummary]);

    /*
      สองช่องนี้โผล่เฉพาะตอนมีข้อมูลจริง
      ปกติจะไม่มี แต่ถ้ามีแล้วไม่แสดง ผลรวมสามช่องจะไม่เท่ายอดจริง
      แล้วครัวจะเตรียมของขาดโดยไม่มีอะไรบอกว่าขาดตรงไหน
    */
    const showNpo = rows.some(r => r.npo > 0);
    const showUnspecified = rows.some(r => r.unspecified > 0);

    // หาว่าแต่ละหอเริ่มที่แถวไหน เพื่อรวมช่องชื่อหอเป็นช่องเดียวสูงสามมื้อ
    const wardSpan = useMemo(() => {
        const first = new Map<string, number>();
        const count = new Map<string, number>();
        rows.forEach((r, i) => {
            if (!first.has(r.ward)) first.set(r.ward, i);
            count.set(r.ward, (count.get(r.ward) ?? 0) + 1);
        });
        return { first, count };
    }, [rows]);

    const columns: TableColumnsType<SummaryRow> = [
        {
            title: 'หอผู้ป่วย', dataIndex: 'ward_name', key: 'ward_name', width: 220,
            onCell: (r, index) => ({
                rowSpan: wardSpan.first.get(r.ward) === index ? (wardSpan.count.get(r.ward) ?? 1) : 0,
            }),
            render: (v: string) => <span className="font-semibold">{v}</span>,
        },
        { title: 'มื้อ', dataIndex: 'meal_name', key: 'meal_name', width: 110, align: 'center' },
        {
            title: 'สามัญ', dataIndex: 'normal', key: 'normal', width: 110, align: 'right',
            render: (v: number) => num(v, TYPE_COLOR.normal),
        },
        {
            title: 'พิเศษ', dataIndex: 'special', key: 'special', width: 110, align: 'right',
            render: (v: number) => num(v, TYPE_COLOR.special),
        },
        {
            title: 'VIP', dataIndex: 'vip', key: 'vip', width: 110, align: 'right',
            render: (v: number) => num(v, TYPE_COLOR.vip),
        },
        ...(showNpo ? [{
            title: 'งดอาหาร', dataIndex: 'npo', key: 'npo', width: 110, align: 'right' as const,
            render: (v: number) => num(v, 'text-gray-500'),
        }] : []),
        ...(showUnspecified ? [{
            title: 'ไม่ระบุประเภท', dataIndex: 'unspecified', key: 'unspecified', width: 130, align: 'right' as const,
            render: (v: number) => num(v, 'text-rose-600'),
        }] : []),
        {
            title: 'รวม', dataIndex: 'total', key: 'total', width: 110, align: 'right',
            render: (v: number) => v > 0
                ? <span className="font-bold text-[#006b5f]">{v.toLocaleString('th-TH')}</span>
                : <span className="text-gray-300">-</span>,
        },
    ];

    const cell = (v: number, cls?: string) => (
        <Table.Summary.Cell index={0} align="right">
            <span className={`font-bold ${cls ?? ''}`}>{v.toLocaleString('th-TH')}</span>
        </Table.Summary.Cell>
    );

    return (
        <div className="bg-slate-50 dark:bg-[#141414] min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-full mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#006b5f] p-2.5 rounded-xl shadow-md">
                                <PiBowlFoodBold className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <Title level={4} className="m-0!">สรุปยอดการสั่งอาหารรายหอผู้ป่วย</Title>
                                <Text type="secondary" className="text-sm">
                                    แยกตามมื้อและประเภทห้อง สำหรับคิดต้นทุนและจัดสรรวัตถุดิบประจำวัน
                                </Text>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">วันที่</label>
                                <DatePicker
                                    value={date}
                                    onChange={d => d && setDate(d)}
                                    format="DD/MM/BBBB"
                                    allowClear={false}
                                    presets={[
                                        { label: 'วันนี้', value: dayjs() },
                                        { label: 'เมื่อวาน', value: dayjs().subtract(1, 'day') },
                                        { label: 'พรุ่งนี้', value: dayjs().add(1, 'day') },
                                    ]}
                                />
                            </div>
                            <Button
                                type="primary"
                                icon={<PiMagnifyingGlassBold />}
                                loading={loading}
                                onClick={fetchSummary}
                                className="bg-[#006b5f] hover:bg-[#005a50] border-none shadow-md"
                            >
                                แสดงข้อมูล
                            </Button>
                        </div>
                    </div>

                    <Table
                        rowKey={r => `${r.ward}-${r.meal}`}
                        columns={columns}
                        dataSource={rows}
                        {...tableLoading(loading, rows, (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={searched ? 'วันที่เลือกยังไม่มีการสั่งอาหาร' : 'เลือกวันที่แล้วกดแสดงข้อมูล'}
                            />
                        ))}
                        size="small"
                        bordered
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        summary={() => totals && rows.length > 0 ? (
                            <Table.Summary fixed>
                                <Table.Summary.Row className="bg-teal-50 dark:bg-[#113536]">
                                    <Table.Summary.Cell index={0} colSpan={2}>
                                        <span className="font-bold">รวมทุกหอผู้ป่วย ({totals.wards} หอ)</span>
                                    </Table.Summary.Cell>
                                    {cell(totals.normal, TYPE_COLOR.normal)}
                                    {cell(totals.special, TYPE_COLOR.special)}
                                    {cell(totals.vip, TYPE_COLOR.vip)}
                                    {showNpo && cell(totals.npo, 'text-gray-500')}
                                    {showUnspecified && cell(totals.unspecified, 'text-rose-600')}
                                    {cell(totals.total, 'text-[#006b5f]')}
                                </Table.Summary.Row>
                            </Table.Summary>
                        ) : null}
                    />

                    {showUnspecified && (
                        <Text type="secondary" className="block mt-3 text-xs">
                            มีรายการที่เมนูยังไม่ได้ระบุประเภทห้อง ตั้งประเภทได้ที่หน้า จัดการรายการเมนูอาหาร
                        </Text>
                    )}
                </Card>
            </div>
        </div>
    );
}
