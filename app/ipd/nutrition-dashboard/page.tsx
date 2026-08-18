'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, Button, DatePicker, Typography, Spin, Empty, Tag, Segmented, Tooltip } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import Swal from 'sweetalert2';
import Navbar from '../../components/Navbar';
import { MdOutlineFastfood } from 'react-icons/md';
import { PiMagnifyingGlassBold } from 'react-icons/pi';
import {
    ClassDonut, DietBar, DailyStack, MealStack, WardStack, MealWardSankey, colorOfClass,
} from '../../components/nutrition/FoodTypeCharts';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface Dashboard {
    start_date: string;
    end_date: string;
    summary: { total: number; days: number; patients: number; wards: number };
    by_class: { name: string; qty: number }[];
    by_diet: { name: string; qty: number }[];
    by_meal: { meal: number; class: string; qty: number }[];
    daily: { date: string; class: string; qty: number }[];
    by_ward: { ward_name: string; class: string; qty: number }[];
    meal_ward_class: { meal: number; ward_name: string; class: string; qty: number }[];
}

/* ช่วงที่ใช้บ่อย กดทีเดียวไม่ต้องเลือกวันเอง */
const PRESETS: Record<string, () => [dayjs.Dayjs, dayjs.Dayjs]> = {
    'วันนี้': () => [dayjs(), dayjs()],
    '7 วัน': () => [dayjs().subtract(6, 'day'), dayjs()],
    'เดือนนี้': () => [dayjs().startOf('month'), dayjs()],
    'เดือนที่แล้ว': () => [
        dayjs().subtract(1, 'month').startOf('month'),
        dayjs().subtract(1, 'month').endOf('month'),
    ],
};

export default function NutritionDashboardPage() {
    const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);
    const [preset, setPreset] = useState<string | null>('เดือนนี้');
    const [data, setData] = useState<Dashboard | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchData = useCallback(async (r: [dayjs.Dayjs, dayjs.Dayjs]) => {
        setLoading(true);
        try {
            const token = document.cookie.split('; ').find(x => x.startsWith('token='))?.split('=')[1];
            const res = await axios.post('/api/v1/nutrition/food-type-dashboard', {
                date1: r[0].format('YYYY-MM-DD'),
                date2: r[1].format('YYYY-MM-DD'),
            }, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' } });
            if (res.data?.success) setData(res.data.data);
        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง'
                : 'กรุณาลองใหม่อีกครั้ง';
            Swal.fire({ icon: 'error', title: 'ดึงข้อมูลไม่สำเร็จ', text: message, timer: 3000, showConfirmButton: false });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(range); }, [fetchData, range]);

    const s = data?.summary;
    const perDay = s && s.days > 0 ? Math.round(s.total / s.days) : 0;

    const chartCard = (title: string, hint: string, height: number, body: React.ReactNode) => (
        <Card className="shadow-lg rounded-2xl border-none" styles={{ body: { padding: 16 } }}>
            <div className="flex items-baseline gap-2 mb-1">
                <span className="font-semibold text-gray-700">{title}</span>
                <span className="text-[11px] text-gray-400">{hint}</span>
            </div>
            <div style={{ height }}>{body}</div>
        </Card>
    );

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-full mx-auto space-y-4">
                <Card className="shadow-xl rounded-2xl border-none">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#006b5f] p-2.5 rounded-xl shadow-md">
                                <MdOutlineFastfood className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <Title level={4} className="m-0!">ยอดอาหารตามประเภท Dashboard</Title>
                                <Text type="secondary" className="text-sm">
                                    สรุปยอดที่สั่งจริง แยกตามประเภทห้อง ชนิดอาหาร มื้อ และหอผู้ป่วย
                                </Text>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Segmented
                                value={preset ?? ''}
                                options={Object.keys(PRESETS)}
                                onChange={(v) => {
                                    const key = String(v);
                                    setPreset(key);
                                    setRange(PRESETS[key]());
                                }}
                            />
                            <RangePicker
                                value={range}
                                onChange={(v) => {
                                    if (v?.[0] && v?.[1]) { setPreset(null); setRange([v[0], v[1]]); }
                                }}
                                format="DD/MM/BBBB"
                                allowClear={false}
                                maxDate={dayjs()}
                            />
                            <Tooltip title="ดึงข้อมูลใหม่">
                                <Button
                                    icon={<PiMagnifyingGlassBold />}
                                    loading={loading}
                                    onClick={() => fetchData(range)}
                                />
                            </Tooltip>
                        </div>
                    </div>

                    {s && !loading && (
                        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mt-4">
                            {[
                                { label: 'ยอดอาหารทั้งหมด', value: s.total.toLocaleString(), unit: 'ที่', tone: '#12b886' },
                                { label: 'เฉลี่ยต่อวัน', value: perDay.toLocaleString(), unit: 'ที่/วัน', tone: '#4c6ef5' },
                                { label: 'จำนวนวันที่มีการสั่ง', value: s.days, unit: 'วัน', tone: '#f59f00' },
                                { label: 'ผู้ป่วยที่ได้รับอาหาร', value: s.patients, unit: 'ราย', tone: '#ae3ec9' },
                                { label: 'หอผู้ป่วย', value: s.wards, unit: 'หอ', tone: '#1098ad' },
                            ].map(x => (
                                /* แถบสีซ้ายกับพื้นอ่อนของสีเดียวกัน ทำให้ตัวเลขแต่ละตัวแยกออกจากกันได้ในพริบตา */
                                <div
                                    key={x.label}
                                    className="rounded-xl px-3 py-2 border-l-4"
                                    style={{ borderLeftColor: x.tone, backgroundColor: x.tone + '14' }}
                                >
                                    <div className="text-[11px] text-gray-500 leading-tight">{x.label}</div>
                                    <div className="text-xl font-bold leading-tight" style={{ color: x.tone }}>
                                        {x.value} <span className="text-[11px] font-normal text-gray-400">{x.unit}</span>
                                    </div>
                                </div>
                            ))}
                            {/* ยอดรายประเภทวางต่อจากตัวเลขรวม เพราะเป็นสิ่งที่ถูกถามถึงบ่อยที่สุด */}
                            <div className="col-span-2 md:col-span-4 xl:col-span-1 flex flex-wrap items-center gap-1">
                                {data.by_class.map(c => (
                                    <Tag
                                        key={c.name}
                                        className="m-0 px-2 py-0.5 border-none text-white font-semibold"
                                        style={{ backgroundColor: colorOfClass(c.name) }}
                                    >
                                        {c.name} {c.qty}
                                    </Tag>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                {loading ? (
                    <Card className="shadow-xl rounded-2xl border-none">
                        <div className="flex justify-center py-24"><Spin size="large" /></div>
                    </Card>
                ) : !data || data.summary.total === 0 ? (
                    <Card className="shadow-xl rounded-2xl border-none">
                        <Empty description={`ไม่มีรายการอาหารในช่วง ${range[0].format('DD/MM/BBBB')} - ${range[1].format('DD/MM/BBBB')}`} />
                    </Card>
                ) : (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {chartCard('สัดส่วนตามประเภทห้อง', 'สามัญ · พิเศษ · VIP', 320,
                                <ClassDonut data={data.by_class} />)}
                            {chartCard('ยอดตามชนิดอาหาร', 'ตัดวงเล็บประเภทห้องออกแล้ว', 320,
                                <DietBar data={data.by_diet} />)}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2">
                                {chartCard('แนวโน้มรายวัน', 'ซ้อนตามประเภทห้อง', 300,
                                    <DailyStack data={data.daily} />)}
                            </div>
                            {chartCard('ยอดตามมื้อ', 'เช้า · กลางวัน · เย็น', 300,
                                <MealStack data={data.by_meal} />)}
                        </div>

                        {chartCard('เส้นทางยอดอาหาร', 'มื้อ → หอผู้ป่วย → ประเภทห้อง · ชี้ที่เส้นเพื่อดูยอด', 420,
                            <MealWardSankey data={data.meal_ward_class} />)}

                        {chartCard('ยอดตามหอผู้ป่วย', 'แสดง 12 หอที่ยอดสูงสุด', 340,
                            <WardStack data={data.by_ward} />)}
                    </>
                )}
            </div>
        </div>
    );
}
