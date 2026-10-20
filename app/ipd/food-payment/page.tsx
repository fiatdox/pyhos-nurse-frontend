'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Button, Table, Tag, DatePicker, Typography, Empty, Alert, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import Navbar from '../../components/Navbar';
import { formatMoney } from '../../lib/money';
import { PiReceiptBold, PiFileXlsBold, PiMagnifyingGlassBold } from 'react-icons/pi';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface PaymentRow {
    ward: string;
    ward_name: string;
    food_type_id: number | null;
    food_type_name: string;
    contract_note: string | null;
    effective_from: string | null;
    effective_to: string | null;
    meals: number;
    /** สั่งแล้วแต่งานโภชนาการยังไม่กดรับ ยังไม่เข้ายอดเงิน */
    pending_meals: number;
    meals_per_day: number | null;
    price_per_day: number | null;
    price_per_meal: number | null;
    full_days: number;
    remainder_meals: number;
    day_amount: number | null;
    remainder_amount: number | null;
    amount: number | null;
    has_price: boolean;
    billable: boolean;
}

interface Summary {
    wards: number;
    meals: number;
    full_days: number;
    remainder_meals: number;
    amount: number;
    npo_meals: number;
    pending_meals: number;
    npo_pending_meals: number;
    unpriced_meals: number;
    unpriced_groups: number;
}

const TYPE_COLOR: Record<string, string> = {
    'สามัญ': 'green',
    'พิเศษ': 'blue',
    'VIP': 'gold',
    'งดอาหาร (NPO)': 'default',
};

const HEADERS = [
    'หอผู้ป่วย', 'ประเภทอาหาร', 'ช่วงสัญญา', 'อ้างอิงสัญญา', 'มื้อที่รับแล้ว', 'รอรับ',
    'วันเต็ม', 'ราคา/วัน', 'เป็นเงิน (วันเต็ม)', 'เศษมื้อ', 'ราคา/มื้อ', 'เป็นเงิน (เศษมื้อ)', 'รวมเป็นเงิน',
];

export default function FoodPaymentPage() {
    const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf('month'),
        dayjs().endOf('month'),
    ]);
    const [rows, setRows] = useState<PaymentRow[]>([]);
    const [byType, setByType] = useState<{ name: string; meals: number; pending_meals: number; amount: number; has_price: boolean }[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const authHeaders = useCallback((): Record<string, string> => {
        const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }, []);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.post('/api/v1/nutrition/food-payment', {
                date1: range[0].format('YYYY-MM-DD'),
                date2: range[1].format('YYYY-MM-DD'),
            }, { headers: authHeaders() });

            if (res.data?.success) {
                setRows(res.data.data.rows ?? []);
                setByType(res.data.data.by_type ?? []);
                setSummary(res.data.data.summary ?? null);
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
    }, [range, authHeaders]);

    const periodText = (r: { effective_from: string | null; effective_to: string | null }) =>
        !r.effective_from
            ? 'ไม่มีสัญญา'
            : `${dayjs(r.effective_from).format('DD/MM/BB')} - ${r.effective_to ? dayjs(r.effective_to).format('DD/MM/BB') : 'ไม่กำหนด'}`;

    const exportExcel = () => {
        if (rows.length === 0) {
            Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูลให้ส่งออก', timer: 2000, showConfirmButton: false });
            return;
        }

        const blank = Array(HEADERS.length).fill('');
        const pad = (n: number) => Array(HEADERS.length - n).fill('');
        const titleRows = [
            ['ยอดเงินค่าอาหารที่ต้องจ่ายบริษัทผู้รับจ้าง', ...pad(1)],
            [`ช่วงวันที่ ${range[0].format('DD/MM/BBBB')} - ${range[1].format('DD/MM/BBBB')}`, ...pad(1)],
            [`เกณฑ์: นับเฉพาะมื้อที่งานโภชนาการรับแล้ว · ครบ 3 มื้อ = 1 วันเต็ม จ่ายเต็มราคา · มื้อที่เหลือคิดตามสัดส่วน (ราคาต่อวัน ÷ 3)`, ...pad(1)],
            [`มื้อที่ยังรอรับแสดงไว้เพื่อการตรวจสอบ ไม่นำมาคิดเงิน`, ...pad(1)],
            [`ออกรายงานเมื่อ ${dayjs().format('DD/MM/BBBB HH:mm')} น.`, ...pad(1)],
            blank,
        ];

        const body = rows.map(r => [
            r.ward_name, r.food_type_name, periodText(r), r.contract_note ?? '',
            r.meals, r.pending_meals, r.full_days, r.price_per_day ?? '', r.day_amount ?? '',
            r.remainder_meals, r.price_per_meal ?? '', r.remainder_amount ?? '',
            !r.billable ? 'ไม่คิดเงิน' : (r.amount ?? 'ยังไม่ตั้งราคา'),
        ]);

        const totalRows = [
            blank,
            ['รวมทั้งสิ้น', '', '', '', summary?.meals ?? 0, summary?.pending_meals ?? 0, summary?.full_days ?? 0, '', '',
                summary?.remainder_meals ?? 0, '', '', summary?.amount ?? 0],
            blank,
            ['--- สรุปตามประเภทอาหาร ---', ...pad(1)],
            ...byType.map(t => [t.name, '', '', '', t.meals, t.pending_meals, '', '', '', '', '', '', t.amount]),
        ];

        const ws = XLSX.utils.aoa_to_sheet([...titleRows, HEADERS, ...body, ...totalRows]);
        ws['!cols'] = [
            { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 13 }, { wch: 9 },
            { wch: 9 }, { wch: 11 }, { wch: 17 }, { wch: 9 }, { wch: 11 }, { wch: 17 }, { wch: 15 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ยอดจ่ายค่าอาหาร');
        XLSX.writeFile(wb, `ยอดจ่ายค่าอาหาร_${range[0].format('YYYY-MM-DD')}_ถึง_${range[1].format('YYYY-MM-DD')}.xlsx`);
    };

    // รวมช่องหอผู้ป่วยที่ซ้ำกันเป็นช่องเดียว หอหนึ่งมักมีหลายประเภทและหลายสัญญา
    const wardSpan = useMemo(() => {
        const first = new Map<string, number>();
        const count = new Map<string, number>();
        rows.forEach((r, i) => {
            if (!first.has(r.ward)) first.set(r.ward, i);
            count.set(r.ward, (count.get(r.ward) ?? 0) + 1);
        });
        return { first, count };
    }, [rows]);

    const columns: TableColumnsType<PaymentRow> = [
        {
            title: 'หอผู้ป่วย', dataIndex: 'ward_name', key: 'ward_name', width: 180, fixed: 'left',
            onCell: (r, index) => ({
                rowSpan: wardSpan.first.get(r.ward) === index ? (wardSpan.count.get(r.ward) ?? 1) : 0,
            }),
            render: (v: string) => <span className="font-semibold">{v}</span>,
        },
        {
            title: 'ประเภท', dataIndex: 'food_type_name', key: 'food_type_name', width: 120,
            render: (v: string) => <Tag color={TYPE_COLOR[v] ?? 'default'}>{v}</Tag>,
        },
        {
            title: 'สัญญา', key: 'contract', width: 190,
            render: (_, r) => !r.billable
                ? <Tag color="default">ไม่คิดเงิน</Tag>
                : r.has_price
                    ? (
                        <div className="leading-tight text-xs">
                            <div>{periodText(r)}</div>
                            {r.contract_note && <div className="text-gray-400">{r.contract_note}</div>}
                        </div>
                    )
                    : <Tag color="red">ยังไม่ตั้งราคา</Tag>,
        },
        {
            /*
              มื้อที่รอรับแสดงใต้ยอดที่คิดเงิน ไม่แยกเป็นอีกคอลัมน์
              เพราะตารางนี้กว้างอยู่แล้วและสองตัวเลขนี้ต้องอ่านคู่กันเสมอ
            */
            title: 'มื้อ (รับแล้ว)', dataIndex: 'meals', key: 'meals', width: 100, align: 'right',
            sorter: (a, b) => a.meals - b.meals,
            render: (v: number, r) => (
                <div className="leading-tight">
                    <div className="font-semibold">{v.toLocaleString('th-TH')}</div>
                    {r.pending_meals > 0 && (
                        <div className="text-xs text-orange-500">รอรับ {r.pending_meals.toLocaleString('th-TH')}</div>
                    )}
                </div>
            ),
        },
        {
            title: 'วันเต็ม × ราคา/วัน', key: 'full', width: 190, align: 'right',
            render: (_, r) => !r.has_price ? <span className="text-gray-300">-</span> : (
                <span className="text-xs">
                    {r.full_days.toLocaleString('th-TH')} × {formatMoney(r.price_per_day)}
                    {' = '}<span className="font-semibold text-sm">{formatMoney(r.day_amount)}</span>
                </span>
            ),
        },
        {
            title: 'เศษมื้อ × ราคา/มื้อ', key: 'remainder', width: 190, align: 'right',
            render: (_, r) => !r.has_price ? <span className="text-gray-300">-</span> : (
                r.remainder_meals === 0
                    ? <span className="text-gray-300">-</span>
                    : (
                        <span className="text-xs">
                            {r.remainder_meals} × {formatMoney(r.price_per_meal)}
                            {' = '}<span className="font-semibold text-sm text-amber-700">{formatMoney(r.remainder_amount)}</span>
                        </span>
                    )
            ),
        },
        {
            title: 'รวมเป็นเงิน', dataIndex: 'amount', key: 'amount', width: 140, align: 'right', fixed: 'right',
            sorter: (a, b) => (a.amount ?? 0) - (b.amount ?? 0),
            render: (v: number | null, r) => !r.billable
                ? <Tooltip title="สั่งไว้เพื่อให้รู้ว่างดอาหาร ไม่มีอาหารส่งจริงจึงไม่คิดเงิน"><span className="text-gray-400">ไม่คิดเงิน</span></Tooltip>
                : v === null
                    ? <Tooltip title="ยังไม่ได้ตั้งราคา หรือช่วงนี้ไม่มีสัญญา"><Tag color="red">คิดไม่ได้</Tag></Tooltip>
                    : <span className="text-base font-bold text-[#006b5f]">{formatMoney(v)}</span>,
        },
    ];

    return (
        <div className="bg-slate-50 dark:bg-[#141414] min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-full mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#006b5f] p-2.5 rounded-xl shadow-md">
                                <PiReceiptBold className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <Title level={4} className="m-0!">ยอดเงินค่าอาหารที่ต้องจ่ายบริษัท</Title>
                                <Text type="secondary" className="text-sm">
                                    คิดตามราคาในสัญญาที่มีผล ณ วันที่สั่งอาหาร
                                </Text>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">ช่วงวันที่</label>
                                <RangePicker
                                    value={range}
                                    onChange={d => d?.[0] && d?.[1] && setRange([d[0], d[1]])}
                                    format="DD/MM/BBBB"
                                    allowClear={false}
                                    presets={[
                                        { label: 'เดือนนี้', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                                        { label: 'เดือนที่แล้ว', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                                        { label: '3 เดือนล่าสุด', value: [dayjs().subtract(2, 'month').startOf('month'), dayjs().endOf('month')] },
                                    ]}
                                />
                            </div>
                            <Button
                                type="primary"
                                icon={<PiMagnifyingGlassBold />}
                                loading={loading}
                                onClick={fetchReport}
                                className="bg-[#006b5f] hover:bg-[#005a50] border-none shadow-md"
                            >
                                คำนวณ
                            </Button>
                            <Button icon={<PiFileXlsBold />} onClick={exportExcel} disabled={rows.length === 0}>
                                ส่งออก Excel
                            </Button>
                        </div>
                    </div>

                    {/*
                      เขียนสูตรไว้บนหน้าจอ เพราะใบนี้เอาไปใช้เบิกจ่ายจริง
                      ถ้าบริษัททักว่ายอดไม่ตรง ต้องชี้ได้ทันทีว่าคิดด้วยเกณฑ์อะไร
                    */}
                    <Alert
                        type="info"
                        showIcon
                        className="mb-4"
                        title="เกณฑ์การคิดเงิน: นับเฉพาะมื้อที่งานโภชนาการกดรับแล้ว · ครบ 3 มื้อ = 1 วันเต็ม จ่ายเต็มราคาต่อวัน · มื้อที่เหลือไม่ครบวัน คิดตามสัดส่วน (ราคาต่อวัน ÷ 3)"
                        description="มื้อที่หอผู้ป่วยสั่งแต่ยังไม่มีใครกดรับ ถือว่ายังไม่ได้รับมอบของ จึงยังไม่เข้ายอดเงิน · ตัวอย่าง 5 มื้อ ราคา 140 บาท/วัน = 140 + (2 × 46.67) = 233.34 บาท · จำนวนเงินปัดเศษขึ้นทศนิยม 2 ตำแหน่ง · รายการงดอาหาร (NPO) แสดงไว้ให้เห็นว่ามีการสั่ง แต่ไม่นำมาคิดเงิน"
                    />

                    {summary && searched && (
                        <>
                            {/*
                              มื้อที่ยังไม่มีใครกดรับต้องเตือนก่อนใบเบิก ไม่ใช่ให้ไปสังเกตเอาเองในตาราง
                              ถ้ายังไม่รับเลยสักมื้อ ยอดจะเป็นศูนย์ซึ่งดูเหมือนระบบพัง
                              จึงต้องบอกตรงๆ ว่าต้องไปกดรับที่หน้าไหน
                            */}
                            {summary.pending_meals > 0 && (
                                <Alert
                                    type={summary.meals === 0 ? 'error' : 'warning'}
                                    showIcon
                                    className="mb-4"
                                    title={summary.meals === 0
                                        ? `ยังไม่มีการรับยอดเลยในช่วงนี้ — ทั้ง ${summary.pending_meals.toLocaleString('th-TH')} มื้อยังรอรับ ยอดที่ต้องจ่ายจึงเป็น 0 บาท`
                                        : `มี ${summary.pending_meals.toLocaleString('th-TH')} มื้อที่สั่งแล้วแต่งานโภชนาการยังไม่กดรับ`}
                                    description="โรงพยาบาลจ่ายเงินตามมื้อที่รับมอบแล้วเท่านั้น มื้อที่รอรับยังไม่เข้ายอดด้านล่าง — ให้งานโภชนาการกดรับที่หน้ารับยอดอาหารให้ครบก่อนนำใบนี้ไปเบิก"
                                />
                            )}

                            {summary.unpriced_groups > 0 && (
                                <Alert
                                    type="error"
                                    showIcon
                                    className="mb-4"
                                    title={`มี ${summary.unpriced_meals.toLocaleString('th-TH')} มื้อที่คิดเงินไม่ได้ (${summary.unpriced_groups} รายการ)`}
                                    description="ประเภทอาหารนั้นยังไม่ได้ตั้งราคา หรือวันดังกล่าวไม่มีสัญญาครอบคลุม — ยอดรวมด้านล่างยังไม่รวมส่วนนี้ ตั้งราคาให้ครบก่อนนำไปเบิก"
                                />
                            )}

                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                                <StatBox label="ยอดที่ต้องจ่าย" value={formatMoney(summary.amount)} unit="บาท" tone="teal" big />
                                <StatBox label="มื้อที่รับแล้ว (คิดเงิน)" value={summary.meals.toLocaleString('th-TH')} unit="มื้อ" tone="blue" />
                                <StatBox label="รอรับ (ยังไม่คิดเงิน)" value={summary.pending_meals.toLocaleString('th-TH')} unit="มื้อ" tone="orange" />
                                <StatBox label="วันเต็ม" value={summary.full_days.toLocaleString('th-TH')} unit="วัน" tone="violet" />
                                {/* งดอาหารแสดงไว้ให้เห็นว่ามีการสั่ง แต่ไม่เข้ายอดเงิน */}
                                <StatBox
                                    label={summary.npo_meals > 0 ? 'งดอาหาร (ไม่คิดเงิน)' : 'หอผู้ป่วย'}
                                    value={summary.npo_meals > 0 ? summary.npo_meals.toLocaleString('th-TH') : summary.wards.toLocaleString('th-TH')}
                                    unit={summary.npo_meals > 0 ? 'มื้อ' : 'หอ'}
                                    tone="slate"
                                />
                            </div>

                            {byType.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {byType.map(t => (
                                        <div key={t.name} className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                                            <div className="text-xs text-gray-500">{t.name}</div>
                                            <div className="font-bold text-[#006b5f]">
                                                {formatMoney(t.amount)} <span className="text-xs font-normal text-gray-400">บาท</span>
                                            </div>
                                            <div className="text-[11px] text-gray-400">
                                                {t.meals.toLocaleString('th-TH')} มื้อ
                                                {t.pending_meals > 0 && (
                                                    <span className="text-orange-500"> · รอรับ {t.pending_meals.toLocaleString('th-TH')}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    <Table
                        rowKey={r => `${r.ward}-${r.food_type_id}-${r.effective_from ?? 'none'}`}
                        columns={columns}
                        dataSource={rows}
                        loading={loading}
                        size="small"
                        bordered
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        locale={{
                            emptyText: (
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description={searched ? 'ช่วงที่เลือกไม่มีการสั่งอาหาร' : 'เลือกช่วงวันที่แล้วกดคำนวณ'}
                                />
                            ),
                        }}
                        summary={() => summary && rows.length > 0 ? (
                            <Table.Summary fixed>
                                <Table.Summary.Row className="bg-teal-50 dark:bg-[#113536]">
                                    <Table.Summary.Cell index={0} colSpan={3}>
                                        <span className="font-bold">รวมทั้งสิ้น</span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={3} align="right">
                                        <div className="leading-tight">
                                            <div className="font-bold">{summary.meals.toLocaleString('th-TH')}</div>
                                            {summary.pending_meals > 0 && (
                                                <div className="text-xs text-orange-500">รอรับ {summary.pending_meals.toLocaleString('th-TH')}</div>
                                            )}
                                        </div>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={4} align="right">
                                        <span className="text-xs">{summary.full_days.toLocaleString('th-TH')} วันเต็ม</span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={5} align="right">
                                        <span className="text-xs">{summary.remainder_meals.toLocaleString('th-TH')} มื้อ</span>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={6} align="right">
                                        <span className="text-lg font-bold text-[#006b5f]">{formatMoney(summary.amount)}</span>
                                    </Table.Summary.Cell>
                                </Table.Summary.Row>
                            </Table.Summary>
                        ) : null}
                    />

                    {rows.length > 0 && (
                        <Text type="secondary" className="block mt-3 text-xs">
                            แยกแถวตามสัญญา ช่วงที่คาบเกี่ยวสองสัญญาจะคิดคนละราคาตามวันที่สั่งจริง
                            ยอดรวมคือผลบวกของทุกแถว ตรวจย้อนได้ทีละบรรทัด
                        </Text>
                    )}
                </Card>
            </div>
        </div>
    );
}

const TONE: Record<string, string> = {
    teal: 'from-teal-500 to-emerald-600',
    blue: 'from-blue-500 to-indigo-600',
    violet: 'from-violet-500 to-purple-600',
    orange: 'from-amber-500 to-orange-600',
    slate: 'from-slate-500 to-slate-700',
};

function StatBox({ label, value, unit, tone, big }: {
    label: string; value: string; unit: string; tone: string; big?: boolean;
}) {
    return (
        <div className={`bg-linear-to-br ${TONE[tone]} rounded-xl p-3 text-white shadow-md`}>
            <p className="text-white/75 text-[11px] font-medium mb-1 leading-tight">{label}</p>
            <p className={`m-0 font-bold leading-none ${big ? 'text-2xl' : 'text-xl'}`}>
                {value}
                <span className="text-xs font-normal ml-1">{unit}</span>
            </p>
        </div>
    );
}
