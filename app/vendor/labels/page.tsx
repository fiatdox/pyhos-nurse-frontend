'use client';

import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import dynamic from 'next/dynamic';
import {
    Button, Card, DatePicker, InputNumber, Modal, Radio, Select, Spin, Table, Typography, Alert, Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PiPrinterBold } from 'react-icons/pi';
import { vendorHeaders } from '../../lib/vendorAuth';
import type { TrayLabel } from '../../ipd/nutrition-labels/TrayLabelPDF';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;

/* ใช้ใบพิมพ์ตัวเดียวกับที่งานโภชนาการใช้ ฉลากจะได้หน้าตาเดียวกันทั้งสองฝั่ง */
const LabelPDFViewer = dynamic(
    () => import('../../ipd/nutrition-labels/LabelPDFClient').then(m => m.LabelPDFViewer),
    { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><Spin /></div> },
);
const LabelPDFDownloadBtn = dynamic(
    () => import('../../ipd/nutrition-labels/LabelPDFClient').then(m => m.LabelPDFDownloadBtn),
    { ssr: false },
);

const MEALS = [
    { label: 'เช้า', value: 1 },
    { label: 'กลางวัน', value: 2 },
    { label: 'เย็น', value: 3 },
];

const ALL_WARDS = '__all__';

interface VendorLabel extends TrayLabel {
    ward: string;
}

export default function VendorLabelsPage() {
    const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
    const [meal, setMeal] = useState<number>(1);
    const [ward, setWard] = useState<string>(ALL_WARDS);
    const [rows, setRows] = useState<VendorLabel[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    /* ขนาดดวงสติกเกอร์ ตั้งเองได้เพราะแต่ละที่ใช้ม้วนคนละขนาด */
    const [size, setSize] = useState<{ w: number; h: number }>({ w: 50, h: 30 });
    const [printing, setPrinting] = useState(false);

    const mealLabel = MEALS.find(m => m.value === meal)?.label ?? '';

    const fetchLabels = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.post('/api/v1/vendor/tray-labels', {
                date: date.format('YYYY-MM-DD'),
                meal,
                ward: ward === ALL_WARDS ? null : ward,
            }, { headers: vendorHeaders() });
            setRows(res.data?.data ?? []);
            setSearched(true);
        } catch {
            setRows([]);
            setSearched(true);
        } finally {
            setLoading(false);
        }
    }, [date, meal, ward]);

    /* ตัวเลือกหอสร้างจากผลลัพธ์ที่ได้จริง ไม่ใช่ทะเบียนหอทั้งโรงพยาบาล */
    const wardOptions = useMemo(() => [
        { label: 'ทุกหอผู้ป่วย', value: ALL_WARDS },
        ...[...new Map(rows.map(r => [r.ward, r.ward_name])).entries()]
            .map(([value, label]) => ({ label, value })),
    ], [rows]);

    const pdfProps = useMemo(() => ({
        labels: rows,
        dateLabel: date.format('DD/MM/BBBB'),
        mealLabel: `มื้อ${mealLabel}`,
        widthMm: size.w,
        heightMm: size.h,
    }), [rows, date, mealLabel, size]);

    const columns: ColumnsType<VendorLabel> = [
        { title: 'หอผู้ป่วย', dataIndex: 'ward_name', key: 'w', width: 170 },
        {
            title: 'เตียง', dataIndex: 'bedno', key: 'b', width: 80,
            render: (v: string | null) => v || <span className="text-gray-300">-</span>,
        },
        { title: 'ผู้ป่วย', dataIndex: 'patient_name', key: 'p', width: 200 },
        { title: 'เมนู', dataIndex: 'food_name', key: 'f' },
        {
            title: 'ของเพิ่ม', dataIndex: 'addon', key: 'a', width: 180,
            render: (v: string | null) => v
                ? <span className="text-orange-500 font-semibold">{v}</span>
                : <span className="text-gray-300">-</span>,
        },
    ];

    return (
        <>
            <Card>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Title level={5} className="m-0! mr-auto">ฉลากติดถาดอาหาร</Title>
                    <DatePicker value={date} onChange={d => d && setDate(d)} format="DD/MM/BBBB" allowClear={false} />
                    <Radio.Group value={meal} onChange={e => setMeal(e.target.value)} optionType="button" buttonStyle="solid">
                        {MEALS.map(m => <Radio.Button key={m.value} value={m.value}>{m.label}</Radio.Button>)}
                    </Radio.Group>
                    <Button type="primary" onClick={fetchLabels} loading={loading}>ดึงรายการ</Button>
                </div>

                <Alert
                    type="warning"
                    showIcon
                    className="mb-4"
                    title="ฉลากนี้มีชื่อผู้ป่วยและเตียง · ออกได้เฉพาะรายการที่อนุมัติแล้ว"
                    description="เป็นข้อมูลของผู้ป่วยในโรงพยาบาล ใช้เพื่อจัดถาดและส่งให้ถูกเตียงเท่านั้น ห้ามนำไปใช้หรือเผยแพร่นอกเหนือจากนี้ — ใบที่พิมพ์แล้วควรทำลายเมื่อเก็บถาดกลับ"
                />

                {rows.length > 0 && (
                    <div className="flex flex-wrap items-end gap-3 mb-4">
                        <div>
                            <Text className="text-xs text-gray-500 block mb-1">กรองเฉพาะหอ</Text>
                            <Select value={ward} onChange={setWard} options={wardOptions} className="w-56" />
                        </div>
                        <div>
                            <Text className="text-xs text-gray-500 block mb-1">ขนาดดวง (มม.)</Text>
                            <div className="flex items-center gap-1">
                                <InputNumber min={20} max={120} value={size.w}
                                    onChange={v => setSize(s => ({ ...s, w: Number(v) || s.w }))} className="w-20" />
                                <span className="text-gray-400">×</span>
                                <InputNumber min={15} max={120} value={size.h}
                                    onChange={v => setSize(s => ({ ...s, h: Number(v) || s.h }))} className="w-20" />
                            </div>
                        </div>
                        <Button type="primary" icon={<PiPrinterBold />} onClick={() => setPrinting(true)}>
                            พิมพ์ฉลาก {rows.length} ดวง
                        </Button>
                    </div>
                )}

                <Table
                    rowKey="food_order_id"
                    columns={columns}
                    dataSource={ward === ALL_WARDS ? rows : rows.filter(r => r.ward === ward)}
                    loading={loading}
                    size="small"
                    bordered
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    locale={{
                        emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={searched
                                ? `ไม่มีรายการที่อนุมัติแล้ว มื้อ${mealLabel} วันที่ ${date.format('DD/MM/BBBB')} — งานโภชนาการอาจยังไม่ได้กดอนุมัติส่งบริษัท`
                                : 'เลือกวันที่กับมื้อแล้วกดดึงรายการ'} />,
                    }}
                />
            </Card>

            <Modal
                open={printing}
                onCancel={() => setPrinting(false)}
                footer={null}
                width="90%"
                destroyOnHidden
                title={
                    <div className="flex items-center gap-3 flex-wrap">
                        <span>ฉลากติดถาด · มื้อ{mealLabel} {date.format('DD/MM/BBBB')} · {rows.length} ดวง ({size.w}×{size.h} มม.)</span>
                        <LabelPDFDownloadBtn
                            {...pdfProps}
                            fileName={`ฉลากอาหาร_${date.format('YYYY-MM-DD')}_มื้อ${mealLabel}.pdf`}
                        />
                    </div>
                }
                styles={{ body: { height: 'calc(100vh - 200px)', padding: 0 } }}
            >
                <LabelPDFViewer {...pdfProps} />
            </Modal>
        </>
    );
}
