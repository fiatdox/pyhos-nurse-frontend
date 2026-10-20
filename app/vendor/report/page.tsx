'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import {
    Button, Card, DatePicker, Table, Tag, Typography, Alert, Empty, Segmented, Tooltip, Tabs,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { PiFileXlsBold, PiReceiptBold, PiClockCountdownBold, PiWarningBold } from 'react-icons/pi';
import { formatMoney } from '../../lib/money';
import { vendorHeaders, getVendorProfile, clearVendorSession, type VendorProfile } from '../../lib/vendorAuth';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface SummaryRow {
    food_type_id: number;
    food_type_name: string;
    contract_note: string | null;
    effective_from: string | null;
    effective_to: string | null;
    first_date: string;
    last_date: string;
    meals: number;
    pending_meals: number;
    price_per_day: number | null;
    meals_per_day: number | null;
    price_per_meal: number | null;
    full_days: number;
    remainder_meals: number;
    day_amount: number | null;
    remainder_amount: number | null;
    amount: number | null;
    has_price: boolean;
}

interface DailyRow {
    order_date: string;
    food_type_id: number;
    food_type_name: string;
    meal: number;
    meal_name: string;
    meals: number;
    pending_meals: number;
}

interface Contract {
    food_type_id: number;
    food_type_name: string;
    price_per_day: number;
    meals_per_day: number;
    effective_from: string;
    effective_to: string | null;
    contract_note: string | null;
}

type Range = [dayjs.Dayjs, dayjs.Dayjs];

const thDate = (iso: string | null) => (iso ? dayjs(iso).format('DD/MM/BBBB') : '-');

/*
  รอบบิลของบริษัทคือรายเดือนเกือบทั้งหมด การให้กดเลือกวันเองทุกครั้ง
  ทั้งที่จะเลือกเดือนเดิมซ้ำ ๆ คือการเพิ่มโอกาสเลือกช่วงคลาดไปหนึ่งวัน
  แล้วยอดไม่ตรงใบวางบิลโดยไม่มีใครทันสังเกต ปุ่มลัดจึงล็อกขอบเดือนให้
*/
const PRESETS = ['เดือนนี้', 'เดือนที่แล้ว', 'กำหนดเอง'] as const;
type Preset = typeof PRESETS[number];

const rangeOf = (p: Preset, current: Range): Range => {
    if (p === 'เดือนนี้') return [dayjs().startOf('month'), dayjs().endOf('month')];
    if (p === 'เดือนที่แล้ว') {
        const m = dayjs().subtract(1, 'month');
        return [m.startOf('month'), m.endOf('month')];
    }
    return current;
};

export default function VendorReportPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<VendorProfile | null>(null);
    const [preset, setPreset] = useState<Preset>('เดือนนี้');
    const [range, setRange] = useState<Range>([dayjs().startOf('month'), dayjs().endOf('month')]);
    const [rows, setRows] = useState<SummaryRow[]>([]);
    const [daily, setDaily] = useState<DailyRow[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [totals, setTotals] = useState({ amount: 0, meals: 0, pending: 0, unpriced: 0 });
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [view, setView] = useState('สรุป');

    const signOut = useCallback(() => {
        clearVendorSession();
        router.replace('/vendor/login');
    }, [router]);

    /*
      รับช่วงวันที่เข้ามาได้ เพราะปุ่มลัดต้องยิงทันทีในจังหวะเดียวกับที่ตั้งค่า
      ถ้าอ่านจาก state อย่างเดียวจะได้ช่วงของรอบก่อนหน้าไปหนึ่งครั้งเสมอ
    */
    const fetchAll = useCallback(async (r?: Range) => {
        const [d1, d2] = r ?? range;
        setLoading(true);
        try {
            const body = { date1: d1.format('YYYY-MM-DD'), date2: d2.format('YYYY-MM-DD') };
            const headers = vendorHeaders();
            const [sum, day, ct] = await Promise.all([
                axios.post('/api/v1/vendor/summary', body, { headers }),
                axios.post('/api/v1/vendor/daily', body, { headers }),
                axios.get('/api/v1/vendor/contracts', { headers }),
            ]);

            setRows(sum.data?.data?.rows ?? []);
            setTotals({
                amount: sum.data?.data?.total_amount ?? 0,
                meals: sum.data?.data?.total_meals ?? 0,
                pending: sum.data?.data?.pending_meals ?? 0,
                unpriced: sum.data?.data?.unpriced_meals ?? 0,
            });
            setDaily(day.data?.data?.rows ?? []);
            setContracts(ct.data?.data ?? []);
            setSearched(true);
        } catch (err) {
            // token หมดอายุหรือถูกปิดบัญชี ต้องเด้งกลับไปเข้าระบบใหม่ ไม่ใช่ค้างหน้าเปล่า
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                signOut();
                return;
            }
            setSearched(true);
        } finally {
            setLoading(false);
        }
    }, [range, signOut]);

    const applyPreset = (p: Preset) => {
        setPreset(p);
        if (p === 'กำหนดเอง') return;
        const next = rangeOf(p, range);
        setRange(next);
        fetchAll(next);
    };

    useEffect(() => {
        // VendorShell เป็นคนตรวจและเด้งกลับหน้าเข้าระบบ ตรงนี้อ่านไว้ใส่หัวไฟล์ Excel เท่านั้น
        setProfile(getVendorProfile());
        fetchAll();
        // ตั้งใจให้ยิงครั้งเดียวตอนเปิดหน้า การเปลี่ยนช่วงวันที่ผู้ใช้กดปุ่มเอง
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** วันที่ที่มีข้อมูล ใช้ทำคอลัมน์ของตารางรายวัน */
    const dailyPivot = useMemo(() => {
        const dates = [...new Set(daily.map(d => d.order_date))].sort();
        const types = [...new Map(daily.map(d => [d.food_type_id, d.food_type_name])).entries()]
            .sort((a, b) => a[0] - b[0]);
        const byKey = new Map<string, { meals: number; pending: number }>();
        for (const d of daily) {
            const k = `${d.order_date}|${d.food_type_id}`;
            const cur = byKey.get(k) ?? { meals: 0, pending: 0 };
            cur.meals += d.meals;
            cur.pending += d.pending_meals;
            byKey.set(k, cur);
        }
        return {
            types,
            data: dates.map(date => {
                const cells = types.map(([id]) => byKey.get(`${date}|${id}`) ?? { meals: 0, pending: 0 });
                return {
                    key: date,
                    date,
                    cells,
                    total: cells.reduce((s, c) => s + c.meals, 0),
                    totalPending: cells.reduce((s, c) => s + c.pending, 0),
                };
            }),
        };
    }, [daily]);

    const summaryColumns: ColumnsType<SummaryRow> = [
        {
            title: 'ประเภทอาหาร', dataIndex: 'food_type_name', key: 'type', width: 170, fixed: 'left',
            render: (v: string, r) => (
                <div className="leading-tight">
                    <span className="font-semibold">{v}</span>
                    {r.contract_note && <div className="text-[11px] text-gray-400">{r.contract_note}</div>}
                </div>
            ),
        },
        {
            title: 'ช่วงสัญญา', key: 'period', width: 190,
            render: (_, r) => r.has_price
                ? <span className="text-xs">{thDate(r.effective_from)} – {r.effective_to ? thDate(r.effective_to) : 'ไม่กำหนด'}</span>
                : <Tag color="red">ยังไม่ตั้งราคา</Tag>,
        },
        {
            title: 'มื้อที่รับแล้ว', dataIndex: 'meals', key: 'meals', width: 110, align: 'right',
            render: (v: number, r) => (
                <div className="leading-tight">
                    <div className="font-semibold">{v.toLocaleString('th-TH')}</div>
                    {r.pending_meals > 0 && (
                        <Tooltip title="โรงพยาบาลยังไม่ได้กดรับ จึงยังไม่เข้ายอดเงิน">
                            <div className="text-xs text-orange-500">รอรับ {r.pending_meals.toLocaleString('th-TH')}</div>
                        </Tooltip>
                    )}
                </div>
            ),
        },
        {
            title: 'วันเต็ม × ราคา/วัน', key: 'full', width: 180, align: 'right',
            render: (_, r) => !r.has_price ? <span className="text-gray-300">-</span> : (
                <span className="text-xs">
                    {r.full_days.toLocaleString('th-TH')} × {formatMoney(r.price_per_day)}
                    {' = '}<span className="font-semibold text-sm">{formatMoney(r.day_amount)}</span>
                </span>
            ),
        },
        {
            title: 'เศษมื้อ × ราคา/มื้อ', key: 'remainder', width: 180, align: 'right',
            render: (_, r) => !r.has_price || r.remainder_meals === 0 ? <span className="text-gray-300">-</span> : (
                <span className="text-xs">
                    {r.remainder_meals} × {formatMoney(r.price_per_meal)}
                    {' = '}<span className="font-semibold text-sm">{formatMoney(r.remainder_amount)}</span>
                </span>
            ),
        },
        {
            title: 'รวมเป็นเงิน', dataIndex: 'amount', key: 'amount', width: 140, align: 'right',
            render: (v: number | null) => v === null
                ? <span className="text-gray-300">-</span>
                : <span className="text-base font-bold text-[#006b5f] dark:text-teal-300">{formatMoney(v)}</span>,
        },
    ];

    const exportExcel = () => {
        const head = ['ประเภทอาหาร', 'ช่วงสัญญา', 'อ้างอิงสัญญา', 'มื้อที่รับแล้ว', 'รอรับ',
            'วันเต็ม', 'ราคา/วัน', 'เป็นเงิน (วันเต็ม)', 'เศษมื้อ', 'ราคา/มื้อ', 'เป็นเงิน (เศษมื้อ)', 'รวมเป็นเงิน'];
        const pad = (n: number) => Array(head.length - n).fill('');

        const sheet = [
            [`ยอดค่าอาหาร — ${profile?.vendor_name ?? ''}`, ...pad(1)],
            [`ช่วงวันที่ ${range[0].format('DD/MM/BBBB')} - ${range[1].format('DD/MM/BBBB')}`, ...pad(1)],
            ['เกณฑ์: นับเฉพาะมื้อที่งานโภชนาการของโรงพยาบาลกดรับแล้ว · ครบ 3 มื้อ = 1 วันเต็ม · เศษมื้อคิดตามสัดส่วน', ...pad(1)],
            [`ออกรายงานเมื่อ ${dayjs().format('DD/MM/BBBB HH:mm')} น.`, ...pad(1)],
            [],
            head,
            ...rows.map(r => [
                r.food_type_name,
                r.has_price ? `${thDate(r.effective_from)} - ${r.effective_to ? thDate(r.effective_to) : 'ไม่กำหนด'}` : 'ยังไม่ตั้งราคา',
                r.contract_note ?? '',
                r.meals, r.pending_meals, r.full_days,
                r.price_per_day ?? '', r.day_amount ?? '',
                r.remainder_meals, r.price_per_meal ?? '', r.remainder_amount ?? '',
                r.amount ?? '',
            ]),
            [],
            ['รวมทั้งสิ้น', '', '', totals.meals, totals.pending, '', '', '', '', '', '', totals.amount],
        ];

        const ws = XLSX.utils.aoa_to_sheet(sheet);
        ws['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 20 }, { wch: 13 }, { wch: 9 }, { wch: 9 },
            { wch: 11 }, { wch: 17 }, { wch: 9 }, { wch: 11 }, { wch: 17 }, { wch: 15 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ยอดค่าอาหาร');
        XLSX.writeFile(wb, `ยอดค่าอาหาร_${range[0].format('YYYY-MM-DD')}_ถึง_${range[1].format('YYYY-MM-DD')}.xlsx`);
    };

    const summaryTable = (
        <Table
            rowKey={r => `${r.food_type_id}-${r.effective_from ?? 'none'}`}
            columns={summaryColumns}
            dataSource={rows}
            loading={loading}
            size="small"
            bordered
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{
                emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={searched ? 'ช่วงที่เลือกไม่มีรายการอาหาร' : 'เลือกช่วงวันที่แล้วกดดูรายงาน'} />,
            }}
            summary={() => rows.length === 0 ? null : (
                <Table.Summary fixed>
                    <Table.Summary.Row className="bg-teal-50 dark:bg-[#113536]">
                        <Table.Summary.Cell index={0} colSpan={2}>
                            <span className="font-bold">รวมทั้งสิ้น</span>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                            <div className="leading-tight">
                                <div className="font-bold">{totals.meals.toLocaleString('th-TH')}</div>
                                {totals.pending > 0 && (
                                    <div className="text-xs text-orange-500">รอรับ {totals.pending.toLocaleString('th-TH')}</div>
                                )}
                            </div>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} colSpan={2} />
                        <Table.Summary.Cell index={5} align="right">
                            <span className="text-lg font-bold text-[#006b5f] dark:text-teal-300">{formatMoney(totals.amount)}</span>
                        </Table.Summary.Cell>
                    </Table.Summary.Row>
                </Table.Summary>
            )}
        />
    );

    const dailyTable = (
        <div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-100 dark:bg-[#262626] text-xs">
                            <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left">วันที่</th>
                            {dailyPivot.types.map(([id, name]) => (
                                <th key={id} className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-right">{name}</th>
                            ))}
                            <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-right">รวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dailyPivot.data.map(row => (
                            <tr key={row.key}>
                                <td className="border border-gray-200 dark:border-gray-700 px-3 py-1.5">{thDate(row.date)}</td>
                                {row.cells.map((c, i) => (
                                    <td key={i} className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-right">
                                        {c.meals > 0 ? c.meals.toLocaleString('th-TH') : <span className="text-gray-300">0</span>}
                                        {c.pending > 0 && <span className="block text-[11px] text-orange-500">รอรับ {c.pending}</span>}
                                    </td>
                                ))}
                                <td className="border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-right font-semibold">
                                    {row.total.toLocaleString('th-TH')}
                                    {row.totalPending > 0 && <span className="block text-[11px] font-normal text-orange-500">รอรับ {row.totalPending}</span>}
                                </td>
                            </tr>
                        ))}
                        {dailyPivot.data.length === 0 && (
                            <tr>
                                <td colSpan={dailyPivot.types.length + 2} className="py-8">
                                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูลในช่วงที่เลือก" />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <Text type="secondary" className="block mt-2 text-xs">
                ตารางนี้เป็นจำนวนมื้อ ไม่มียอดเงินรายวัน เพราะเงินคิดแบบครบสามมื้อเป็นหนึ่งวันเต็ม
                ถ้าคิดเงินแยกรายวันแล้วนำมาบวกกัน ผลรวมจะไม่ตรงกับยอดในหน้าสรุป
            </Text>
        </div>
    );

    const contractTable = (
        <Table
            rowKey={c => `${c.food_type_id}-${c.effective_from}`}
            size="small"
            bordered
            pagination={false}
            dataSource={contracts}
            scroll={{ x: 'max-content' }}
            columns={[
                { title: 'ประเภทอาหาร', dataIndex: 'food_type_name', key: 'n', width: 160 },
                {
                    title: 'ราคา/วัน', dataIndex: 'price_per_day', key: 'p', width: 120, align: 'right',
                    render: (v: number) => <span className="font-semibold">{formatMoney(v)}</span>,
                },
                { title: 'มื้อ/วัน', dataIndex: 'meals_per_day', key: 'm', width: 90, align: 'center' },
                {
                    title: 'ช่วงที่มีผล', key: 'period', width: 220,
                    render: (_, c: Contract) => `${thDate(c.effective_from)} – ${c.effective_to ? thDate(c.effective_to) : 'ไม่กำหนด'}`,
                },
                { title: 'อ้างอิงสัญญา', dataIndex: 'contract_note', key: 'c', render: (v: string | null) => v ?? '-' },
            ]}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีราคาตามสัญญาในระบบ" /> }}
        />
    );

    return (
        <>
            {/* แถบเลือกรอบบิล แยกออกมาจากตาราง เพราะเป็นสิ่งที่ต้องกดก่อนเสมอ */}
            <Card size="small" className="mb-4">
                <div className="flex flex-wrap items-center gap-3">
                    <Segmented
                        value={preset}
                        onChange={v => applyPreset(v as Preset)}
                        options={[...PRESETS]}
                    />
                    <RangePicker
                        value={range}
                        onChange={v => {
                            if (!v?.[0] || !v?.[1]) return;
                            setRange([v[0], v[1]]);
                            setPreset('กำหนดเอง');
                        }}
                        format="DD/MM/BBBB"
                        allowClear={false}
                    />
                    <Button type="primary" onClick={() => fetchAll()} loading={loading}>ดูรายงาน</Button>
                    <Button icon={<PiFileXlsBold />} onClick={exportExcel} disabled={rows.length === 0}>
                        ส่งออก Excel
                    </Button>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {/*
                  ใบสรุปยอด จัดเป็นก้อนเดียวแทนกล่องสี่กล่องเท่ากัน
                  เพราะสิ่งที่บริษัทเปิดหน้านี้มาดูคือ "รอบนี้ได้เท่าไหร่" หนึ่งตัวเลข
                  ที่เหลือคือของประกอบไว้ตรวจว่าตัวเลขนั้นมาจากอะไร
                */}
                <div className="lg:col-span-2 rounded-2xl bg-linear-to-br from-teal-600 to-teal-800 text-white p-5 shadow-md">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-white/80 text-xs">
                                <PiReceiptBold size={16} />
                                <span>ยอดที่คิดเงินได้ในรอบนี้</span>
                            </div>
                            <p className="m-0 mt-2 font-bold leading-none text-4xl">
                                {formatMoney(totals.amount)}
                                <span className="text-base font-normal ml-2">บาท</span>
                            </p>
                            <div className="text-white/70 text-xs mt-2 truncate">
                                {profile?.vendor_name ?? ''} · {range[0].format('DD/MM/BBBB')} – {range[1].format('DD/MM/BBBB')}
                            </div>
                        </div>
                        <Tag className="shrink-0" color={totals.pending > 0 ? 'orange' : 'green'}>
                            {totals.pending > 0 ? 'ยังไม่ปิดรอบ' : 'รับครบแล้ว'}
                        </Tag>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/20">
                        <MiniStat label="มื้อที่รับแล้ว" value={totals.meals.toLocaleString('th-TH')} unit="มื้อ" />
                        <MiniStat label="รอโรงพยาบาลรับ" value={totals.pending.toLocaleString('th-TH')} unit="มื้อ"
                            tone={totals.pending > 0 ? 'text-orange-200' : undefined} />
                        <MiniStat label="คิดเงินไม่ได้" value={totals.unpriced.toLocaleString('th-TH')} unit="มื้อ"
                            tone={totals.unpriced > 0 ? 'text-red-200' : undefined} />
                    </div>
                </div>

                {/*
                  เกณฑ์ต้องอยู่บนหน้าจอที่บริษัทเห็น ไม่ใช่แค่ฝั่งโรงพยาบาล
                  เวลายอดไม่ตรงกับใบวางบิล จะได้ชี้ได้ทันทีว่าคิดด้วยกติกาอะไร
                  ย้ายจากแถบเตือนยาว ๆ มาเป็นรายการสั้น ๆ ข้างยอด จะได้อ่านคู่กับตัวเลขได้เลย
                */}
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1f1f1f] p-4">
                    <div className="font-semibold text-sm mb-3">เกณฑ์การคิดเงิน</div>
                    <ol className="m-0 pl-4 text-xs text-gray-600 dark:text-gray-400 space-y-2 list-decimal">
                        <li>นับเฉพาะมื้อที่งานโภชนาการของโรงพยาบาล<span className="font-semibold">กดรับแล้ว</span></li>
                        <li>ครบ <span className="font-semibold">3 มื้อ = 1 วันเต็ม</span> จ่ายเต็มราคาต่อวัน</li>
                        <li>มื้อที่เหลือไม่ครบวัน คิดตามสัดส่วน (ราคาต่อวัน ÷ 3)</li>
                        <li>ราคาใช้ตามสัญญาของบริษัท ช่วงที่คาบเกี่ยวสองสัญญาจะแยกบรรทัดคิดคนละราคา</li>
                    </ol>
                </div>
            </div>

            {/* รวมคำเตือนไว้ที่เดียว ไม่ให้แถบสีซ้อนกันสามชั้นจนตารางถูกดันหาย */}
            {searched && (totals.pending > 0 || totals.unpriced > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {totals.pending > 0 && (
                        <Alert
                            type={totals.meals === 0 ? 'error' : 'warning'}
                            icon={<PiClockCountdownBold />}
                            showIcon
                            title={totals.meals === 0
                                ? `ทั้ง ${totals.pending.toLocaleString('th-TH')} มื้อยังรอรับ ยอดจึงเป็น 0 บาท`
                                : `มี ${totals.pending.toLocaleString('th-TH')} มื้อที่ยังรอโรงพยาบาลกดรับ`}
                            description="มื้อที่ยังไม่ถูกกดรับจะยังไม่เข้ายอดเงิน หากเห็นว่าส่งของครบแล้ว กรุณาติดต่องานโภชนาการของโรงพยาบาล"
                        />
                    )}
                    {totals.unpriced > 0 && (
                        <Alert
                            type="error"
                            icon={<PiWarningBold />}
                            showIcon
                            title={`มี ${totals.unpriced.toLocaleString('th-TH')} มื้อที่ยังคิดเงินไม่ได้`}
                            description="ประเภทอาหารนั้นยังไม่มีราคาตามสัญญาในระบบ หรือวันดังกล่าวไม่มีสัญญาครอบคลุม — ยอดรวมยังไม่รวมส่วนนี้"
                        />
                    )}
                </div>
            )}

            <Card size="small">
                <Tabs
                    activeKey={view}
                    onChange={setView}
                    items={[
                        {
                            key: 'สรุป',
                            label: <span className="flex items-center gap-2">สรุปยอดเงิน{rows.length > 0 && <Tag className="m-0!">{rows.length}</Tag>}</span>,
                            children: summaryTable,
                        },
                        { key: 'รายวัน', label: 'จำนวนมื้อรายวัน', children: dailyTable },
                        {
                            key: 'สัญญา',
                            label: <span className="flex items-center gap-2">สัญญาของบริษัท{contracts.length > 0 && <Tag className="m-0!">{contracts.length}</Tag>}</span>,
                            children: contractTable,
                        },
                    ]}
                />
            </Card>
        </>
    );
}

function MiniStat({ label, value, unit, tone }: { label: string; value: string; unit: string; tone?: string }) {
    return (
        <div className="min-w-0">
            <div className="text-white/70 text-[11px] leading-tight truncate">{label}</div>
            <div className={`font-bold text-lg leading-tight ${tone ?? ''}`}>
                {value}<span className="text-[11px] font-normal ml-1">{unit}</span>
            </div>
        </div>
    );
}
