'use client';

import React, { useState, useCallback } from 'react';
import {
    Card, Button, Table, Tag, DatePicker, Radio, Select, Typography, Spin, Empty, Modal, InputNumber, Alert, Tooltip,
} from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';
import Navbar from '../../components/Navbar';
import { PiPrinterBold, PiMagnifyingGlassBold, PiTagBold } from 'react-icons/pi';
import type { TrayLabelPDFProps } from './TrayLabelPDF';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;

const LabelPDFViewer = dynamic(() => import('./LabelPDFClient').then(m => m.LabelPDFViewer), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><Spin size="large" /></div>,
});
const LabelPDFDownloadBtn = dynamic(() => import('./LabelPDFClient').then(m => m.LabelPDFDownloadBtn), { ssr: false });

const MEALS = [
    { value: 1, label: 'เช้า' },
    { value: 2, label: 'กลางวัน' },
    { value: 3, label: 'เย็น' },
];

const ALL_WARDS = '__all__';

/*
  ขนาดม้วนสติกเกอร์ที่ใช้กันทั่วไป ผู้ใช้ตั้งเองได้ด้วยเพราะแต่ละที่ซื้อคนละม้วน
  ถ้าตั้งไม่ตรงกับม้วนจริง ตัวหนังสือจะเลื่อนออกนอกดวงทั้งรีล
*/
const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
    { label: '50 × 25 มม.', w: 50, h: 25 },
    { label: '50 × 30 มม.', w: 50, h: 30 },
    { label: '60 × 40 มม.', w: 60, h: 40 },
    { label: '100 × 50 มม.', w: 100, h: 50 },
];

interface TrayLabel {
    food_order_id: number;
    ward: string;
    ward_name: string;
    bedno: string | null;
    an: string;
    hn: string;
    patient_name: string;
    food_name: string;
    addon: string | null;
    meal_name: string;
}

export default function NutritionLabelsPage() {
    const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
    const [meal, setMeal] = useState<number>(1);
    const [ward, setWard] = useState<string>(ALL_WARDS);
    const [wardOptions, setWardOptions] = useState<{ label: string; value: string }[]>([]);
    const [rows, setRows] = useState<TrayLabel[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [size, setSize] = useState<{ w: number; h: number }>({ w: 50, h: 30 });
    /*
      เก็บเป็น "ชุดที่จะพิมพ์" ไม่ใช่ boolean เปิด/ปิด
      เพราะปุ่มบนแถบบนพิมพ์ทั้งชุด ส่วนปุ่มท้ายแถวพิมพ์ดวงเดียว
      ใช้กล่องพรีวิวตัวเดียวกันทั้งสองทาง จะได้ไม่ต้องดูแลสองที่
    */
    const [printTargets, setPrintTargets] = useState<TrayLabel[] | null>(null);

    const authHeaders = useCallback((): Record<string, string> => {
        const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }, []);

    React.useEffect(() => {
        (async () => {
            try {
                const res = await axios.get('/api/v1/system/wardsV1', { headers: authHeaders() });
                const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
                setWardOptions(list.map((w: { ward_name: string; his_code: string }) => ({ label: w.ward_name, value: w.his_code })));
            } catch (error) {
                console.error('Error fetching wards:', error);
            }
        })();
    }, [authHeaders]);

    const fetchLabels = async () => {
        setLoading(true);
        try {
            const res = await axios.post('/api/v1/nutrition/tray-labels', {
                date: date.format('YYYY-MM-DD'),
                meal,
                ward: ward === ALL_WARDS ? null : ward,
            }, { headers: authHeaders() });
            if (res.data?.success) {
                setRows(res.data.data ?? []);
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
    };

    const mealLabel = MEALS.find(m => m.value === meal)?.label ?? '';

    const targets = printTargets ?? rows;

    const pdfProps: TrayLabelPDFProps = {
        labels: targets.map(r => ({
            food_order_id: r.food_order_id,
            ward_name: r.ward_name,
            bedno: r.bedno,
            patient_name: r.patient_name,
            food_name: r.food_name,
            addon: r.addon,
            meal_name: `มื้อ${mealLabel}`,
        })),
        dateLabel: date.format('DD/MM/BBBB'),
        mealLabel: `มื้อ${mealLabel}`,
        widthMm: size.w,
        heightMm: size.h,
    };

    const columns: TableColumnsType<TrayLabel> = [
        { title: 'หอผู้ป่วย', dataIndex: 'ward_name', key: 'ward_name', width: 150 },
        {
            title: 'เตียง', dataIndex: 'bedno', key: 'bedno', width: 80, align: 'center',
            render: (v: string) => <span className="font-bold">{v || '-'}</span>,
        },
        { title: 'ชื่อ-สกุล', dataIndex: 'patient_name', key: 'patient_name', width: 200 },
        {
            title: 'ชื่ออาหาร', dataIndex: 'food_name', key: 'food_name',
            render: (v: string) => <Tag color="green" className="whitespace-normal h-auto py-0.5">{v}</Tag>,
        },
        {
            title: 'หมายเหตุ', dataIndex: 'addon', key: 'addon', width: 180,
            render: (v: string) => v
                ? <span className="text-amber-700 font-medium">{v}</span>
                : <span className="text-gray-300">-</span>,
        },
        {
            // พิมพ์ทีละดวงไว้ใช้ตอนฉลากหาย ติดผิด หรือมีการเปลี่ยนเมนูเฉพาะราย
            // จะได้ไม่ต้องพิมพ์ใหม่ทั้งชุดแล้วทิ้งที่เหลือ
            title: 'พิมพ์', key: 'print', width: 70, align: 'center', fixed: 'right',
            render: (_, r) => (
                <Tooltip title={`พิมพ์ฉลากเฉพาะเตียง ${r.bedno || '-'}`}>
                    <Button size="small" icon={<PiPrinterBold />} onClick={() => setPrintTargets([r])} />
                </Tooltip>
            ),
        },
    ];

    const wardCount = new Set(rows.map(r => r.ward)).size;

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-full mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#006b5f] p-2.5 rounded-xl shadow-md">
                                <PiTagBold className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <Title level={4} className="m-0!">พิมพ์ฉลากติดถาดอาหาร</Title>
                                <Text type="secondary" className="text-sm">
                                    หนึ่งดวงต่อหนึ่งถาด เรียงตามหอผู้ป่วยและเตียง สำหรับเครื่องพิมพ์สติกเกอร์ม้วน
                                </Text>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-gray-200 mb-4 flex flex-wrap items-end gap-5">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">วันที่</label>
                            <DatePicker
                                value={date}
                                onChange={(d) => d && setDate(d)}
                                format="DD/MM/BBBB"
                                allowClear={false}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">มื้ออาหาร</label>
                            <Radio.Group value={meal} onChange={e => setMeal(e.target.value)} optionType="button" buttonStyle="solid">
                                {MEALS.map(m => (
                                    <Radio.Button key={m.value} value={m.value} className="w-24 text-center">{m.label}</Radio.Button>
                                ))}
                            </Radio.Group>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">หอผู้ป่วย</label>
                            <Select
                                value={ward}
                                onChange={setWard}
                                style={{ width: 220 }}
                                showSearch
                                optionFilterProp="label"
                                options={[{ label: 'หอผู้ป่วยทั้งหมด', value: ALL_WARDS }, ...wardOptions]}
                            />
                        </div>
                        <Button
                            type="primary"
                            icon={<PiMagnifyingGlassBold />}
                            loading={loading}
                            onClick={fetchLabels}
                            className="bg-[#006b5f] hover:bg-[#005a50]"
                        >
                            ดึงรายการ
                        </Button>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                        <div className="flex flex-wrap items-end gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">ขนาดดวงสติกเกอร์</label>
                                <Select
                                    style={{ width: 170 }}
                                    value={SIZE_PRESETS.find(p => p.w === size.w && p.h === size.h)?.label ?? 'กำหนดเอง'}
                                    onChange={(label) => {
                                        const p = SIZE_PRESETS.find(x => x.label === label);
                                        if (p) setSize({ w: p.w, h: p.h });
                                    }}
                                    options={[...SIZE_PRESETS.map(p => ({ label: p.label, value: p.label })),
                                        { label: 'กำหนดเอง', value: 'กำหนดเอง', disabled: true }]}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">กว้าง (มม.)</label>
                                <InputNumber min={25} max={150} value={size.w} onChange={v => setSize(s => ({ ...s, w: v ?? 50 }))} style={{ width: 100 }} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">สูง (มม.)</label>
                                <InputNumber min={15} max={100} value={size.h} onChange={v => setSize(s => ({ ...s, h: v ?? 30 }))} style={{ width: 100 }} />
                            </div>
                            <Tooltip title={rows.length === 0 ? 'ยังไม่มีรายการให้พิมพ์' : `พิมพ์ ${rows.length} ดวง`}>
                                <Button
                                    icon={<PiPrinterBold className="text-lg" />}
                                    disabled={rows.length === 0}
                                    onClick={() => setPrintTargets(rows)}
                                    className="text-blue-600 border-blue-500 hover:bg-blue-50"
                                >
                                    ดูตัวอย่างและพิมพ์
                                </Button>
                            </Tooltip>
                            <span className="text-xs text-gray-500 max-w-md">
                                ขนาดต้องตรงกับม้วนจริง ตัวอักษรย่อ-ขยายตามความสูงที่ตั้งไว้
                                ลองพิมพ์หนึ่งดวงก่อนพิมพ์ทั้งชุดทุกครั้งที่เปลี่ยนม้วน
                            </span>
                        </div>
                    </div>

                    {searched && rows.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <Tag color="green" className="m-0 px-3">{rows.length} ดวง</Tag>
                            <Tag color="blue" className="m-0 px-3">{wardCount} หอผู้ป่วย</Tag>
                            <Tag color="gold" className="m-0 px-3">
                                มีหมายเหตุ {rows.filter(r => r.addon).length} ดวง
                            </Tag>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center py-16"><Spin size="large" /></div>
                    ) : !searched ? (
                        <Empty description="เลือกวันที่ มื้อ และหอผู้ป่วย แล้วกดดึงรายการ" />
                    ) : rows.length === 0 ? (
                        <Alert
                            type="info"
                            showIcon
                            title="ไม่มีรายการอาหาร"
                            description={`ยังไม่มีการสั่งอาหารมื้อ${mealLabel} ของวันที่ ${date.format('DD/MM/BBBB')} หรือผู้ป่วยถูกจำหน่ายไปแล้ว`}
                        />
                    ) : (
                        <Table
                            columns={columns}
                            dataSource={rows}
                            rowKey="food_order_id"
                            size="small"
                            bordered
                            // คอลัมน์พิมพ์ตรึงขวา ต้องมี scroll.x ไม่งั้น antd จะวางตำแหน่งเพี้ยน
                            scroll={{ x: 'max-content' }}
                            pagination={{ pageSize: 50, showTotal: (t) => `ทั้งหมด ${t} ดวง` }}
                            className="
                                [&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]!
                                [&_.ant-table-thead_.ant-table-cell]:text-white!
                                [&_.ant-table-thead_.ant-table-cell]:font-semibold!
                            "
                        />
                    )}
                </Card>
            </div>

            <Modal
                open={printTargets !== null}
                onCancel={() => setPrintTargets(null)}
                width="80%"
                style={{ top: 24 }}
                styles={{ body: { height: 'calc(100vh - 200px)', padding: 0 } }}
                destroyOnHidden
                title={
                    <span className="font-semibold text-[var(--brand-text)]">
                        ฉลากติดถาดอาหาร · มื้อ{mealLabel} {date.format('DD/MM/BBBB')} · {targets.length} ดวง ({size.w}×{size.h} มม.)
                    </span>
                }
                footer={[
                    <Button key="close" onClick={() => setPrintTargets(null)}>ปิด</Button>,
                    <LabelPDFDownloadBtn
                        key="dl"
                        {...pdfProps}
                        fileName={targets.length === 1
                            ? `ฉลากอาหาร_เตียง${targets[0].bedno || '-'}_${date.format('YYYY-MM-DD')}.pdf`
                            : `ฉลากอาหาร_${date.format('YYYY-MM-DD')}_มื้อ${mealLabel}.pdf`}
                    />,
                ]}
            >
                {printTargets !== null && <LabelPDFViewer {...pdfProps} />}
            </Modal>
        </div>
    );
}
