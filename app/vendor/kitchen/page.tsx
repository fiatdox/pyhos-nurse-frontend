'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import dynamic from 'next/dynamic';
import {
    Button, Card, DatePicker, Modal, Segmented, Table, Typography, Alert, Empty,
} from 'antd';
import { BlockSkeleton, tableLoading } from '@/app/components/Skeletons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import { PiFileXlsBold, PiPrinterBold } from 'react-icons/pi';
import { vendorHeaders, getVendorProfile } from '../../lib/vendorAuth';
import type { WardOrderPDFProps } from '../../ipd/nutrition-summary/WardOrderPDF';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/*
  ใช้ใบพิมพ์ตัวเดียวกับที่งานโภชนาการของโรงพยาบาลใช้ ไม่ได้ทำใบใหม่
  ถ้าแยกกันทำ วันหนึ่งสองฝั่งจะพิมพ์คนละหน้าตาแล้วเถียงกันว่าใบไหนถูก
*/
const WardOrderPDFViewer = dynamic(
    () => import('../../ipd/nutrition-summary/PDFViewerClient').then(m => m.WardPDFViewer),
    { ssr: false, loading: () => <BlockSkeleton /> },
);
const WardOrderPDFDownloadBtn = dynamic(
    () => import('../../ipd/nutrition-summary/PDFViewerClient').then(m => m.WardPDFDownloadBtn),
    { ssr: false },
);

interface MenuRow {
    ward: string;
    ward_name: string;
    meal: number;
    meal_name: string;
    food_item_id: number;
    food_name: string;
    food_type_id: number;
    food_type_name: string;
    qty: number;
    received: number;
    with_addon: number;
}

interface AddonRow {
    ward: string;
    ward_name: string;
    meal: number;
    meal_name: string;
    order_date: string;
    bedno: string | null;
    patient_name: string;
    food_name: string;
    addon: string;
}

export default function VendorKitchenPage() {
    const [mode, setMode] = useState<'รายวัน' | 'ช่วงวันที่'>('รายวัน');
    const [day, setDay] = useState<dayjs.Dayjs>(dayjs());
    const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf('month'),
        dayjs().endOf('month'),
    ]);
    const [menus, setMenus] = useState<MenuRow[]>([]);
    const [addons, setAddons] = useState<AddonRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    /** ใบที่กำลังเปิดดูก่อนพิมพ์ — null คือยังไม่ได้กดพิมพ์ */
    const [printing, setPrinting] = useState<{ ward: string; meal: number } | null>(null);

    const period = useMemo(() => mode === 'รายวัน'
        ? { date1: day.format('YYYY-MM-DD'), date2: day.format('YYYY-MM-DD') }
        : { date1: range[0].format('YYYY-MM-DD'), date2: range[1].format('YYYY-MM-DD') },
        [mode, day, range]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.post('/api/v1/vendor/food-summary', period, { headers: vendorHeaders() });
            setMenus(res.data?.data?.menus ?? []);
            setAddons(res.data?.data?.addons ?? []);
            setSearched(true);
        } catch {
            setMenus([]);
            setAddons([]);
            setSearched(true);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchData();
        // ยิงครั้งเดียวตอนเปิดหน้า เปลี่ยนช่วงวันที่แล้วผู้ใช้กดปุ่มเอง
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** ยุบเป็นหนึ่งแถวต่อ หอ x มื้อ ซึ่งเป็นหน่วยที่พิมพ์ใบหนึ่งใบ */
    const sheets = useMemo(() => {
        const byKey = new Map<string, { ward: string; ward_name: string; meal: number; meal_name: string; qty: number; addons: number }>();
        for (const m of menus) {
            const key = `${m.ward}|${m.meal}`;
            const cur = byKey.get(key) ?? {
                ward: m.ward, ward_name: m.ward_name, meal: m.meal, meal_name: m.meal_name, qty: 0, addons: 0,
            };
            cur.qty += m.qty;
            cur.addons += m.with_addon;
            byKey.set(key, cur);
        }
        return [...byKey.values()].sort((a, b) =>
            a.ward_name.localeCompare(b.ward_name, 'th') || a.meal - b.meal);
    }, [menus]);

    /*
      ใบพิมพ์ต้องการ "ยอดที่สั่ง" ไม่ใช่ยอดที่โรงพยาบาลรับแล้ว
      บริษัทเอาใบนี้ไปตั้งหม้อก่อนถึงเวลารับมอบ ยอดที่รับจึงยังเป็นศูนย์เสมอตอนพิมพ์
    */
    const pdfProps: WardOrderPDFProps | null = useMemo(() => {
        if (!printing) return null;
        const mine = menus.filter(m => m.ward === printing.ward && m.meal === printing.meal);
        if (mine.length === 0) return null;

        const mealName = mine[0].meal_name;
        const received = mine.reduce((s, m) => s + m.received, 0);
        const total = mine.reduce((s, m) => s + m.qty, 0);

        return {
            wardName: mine[0].ward_name,
            dateLabel: mode === 'รายวัน'
                ? day.format('DD/MM/BBBB')
                : `${range[0].format('DD/MM/BBBB')} - ${range[1].format('DD/MM/BBBB')}`,
            mealLabel: `มื้อ${mealName}`,
            printedAt: dayjs().format('DD/MM/BBBB HH:mm'),
            menus: mine.map(m => ({ food_name: m.food_name, qty: m.qty })),
            addons: addons
                .filter(a => a.ward === printing.ward && a.meal === printing.meal)
                .map(a => ({
                    bedno: a.bedno,
                    patient_name: a.patient_name,
                    food_name: a.food_name,
                    addon: a.addon,
                })),
            status: { total, received, pending: total - received, reciever_name: null, received_at: null },
        };
    }, [printing, menus, addons, mode, day, range]);

    const columns: ColumnsType<MenuRow> = [
        { title: 'หอผู้ป่วย', dataIndex: 'ward_name', key: 'w', width: 170 },
        { title: 'มื้อ', dataIndex: 'meal_name', key: 'm', width: 90 },
        { title: 'ประเภท', dataIndex: 'food_type_name', key: 't', width: 110 },
        { title: 'เมนู', dataIndex: 'food_name', key: 'f' },
        {
            title: 'จำนวน', dataIndex: 'qty', key: 'q', width: 90, align: 'right',
            render: (v: number) => <span className="font-semibold">{v.toLocaleString('th-TH')}</span>,
        },
        {
            title: 'มีของเพิ่ม', dataIndex: 'with_addon', key: 'a', width: 100, align: 'right',
            render: (v: number) => v > 0
                ? <span className="text-orange-500 font-semibold">{v}</span>
                : <span className="text-gray-300">-</span>,
        },
    ];

    const exportExcel = () => {
        const head = ['หอผู้ป่วย', 'มื้อ', 'ประเภท', 'เมนู', 'จำนวน', 'มีของเพิ่ม'];
        const pad = (t: string) => [t, ...Array(head.length - 1).fill('')];
        const profile = getVendorProfile();

        const sheet: (string | number)[][] = [
            pad(`สรุปยอดอาหาร — ${profile?.vendor_name ?? ''}`),
            pad(mode === 'รายวัน'
                ? `ประจำวันที่ ${day.format('DD/MM/BBBB')}`
                : `ช่วงวันที่ ${range[0].format('DD/MM/BBBB')} - ${range[1].format('DD/MM/BBBB')}`),
            pad('นับเฉพาะรายการที่งานโภชนาการอนุมัติแล้ว ตามยอดที่สั่ง ไม่ใช่ยอดที่รับมอบ'),
            pad(`ออกรายงานเมื่อ ${dayjs().format('DD/MM/BBBB HH:mm')} น.`),
            [],
            head,
            ...menus.map(m => [m.ward_name, m.meal_name, m.food_type_name, m.food_name, m.qty, m.with_addon]),
            [],
            [`รวม ${menus.reduce((s, m) => s + m.qty, 0)} ที่`, ...Array(head.length - 1).fill('')],
        ];

        if (addons.length > 0) {
            sheet.push([], pad('--- รายการของเพิ่ม ---'),
                ['หอผู้ป่วย', 'มื้อ', 'วันที่', 'เตียง', 'ผู้ป่วย', 'เมนู', 'ของเพิ่ม'],
                ...addons.map(a => [a.ward_name, a.meal_name, dayjs(a.order_date).format('DD/MM/BBBB'),
                    a.bedno ?? '', a.patient_name, a.food_name, a.addon]));
        }

        const ws = XLSX.utils.aoa_to_sheet(sheet);
        ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 24 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'สรุปยอดอาหาร');
        XLSX.writeFile(wb, `สรุปยอดอาหาร_${period.date1}_ถึง_${period.date2}.xlsx`);
    };

    return (
        <>
            <Card>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Title level={5} className="m-0! mr-auto">ใบรายการอาหาร</Title>
                    <Segmented
                        value={mode}
                        onChange={v => setMode(v as typeof mode)}
                        options={['รายวัน', 'ช่วงวันที่']}
                    />
                    {mode === 'รายวัน'
                        ? <DatePicker value={day} onChange={d => d && setDay(d)} format="DD/MM/BBBB" allowClear={false} />
                        : <RangePicker
                            value={range}
                            onChange={v => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
                            format="DD/MM/BBBB"
                            allowClear={false}
                        />}
                    <Button type="primary" onClick={fetchData} loading={loading}>ดูรายการ</Button>
                    <Button icon={<PiFileXlsBold />} onClick={exportExcel} disabled={menus.length === 0}>
                        ส่งออก Excel
                    </Button>
                </div>

                <Alert
                    type="info"
                    showIcon
                    className="mb-4"
                    title="แสดงเฉพาะรายการที่งานโภชนาการอนุมัติแล้ว"
                    description="รายการที่หอผู้ป่วยเพิ่งสั่งจะยังไม่ขึ้นที่นี่จนกว่างานโภชนาการจะตรวจและกดอนุมัติ · จำนวนที่เห็นคือยอดที่สั่ง ไม่ใช่ยอดที่รับมอบแล้ว ใช้เตรียมของและจัดถาด ส่วนยอดที่ใช้คิดเงินดูที่หน้ายอดเงิน"
                />

                {searched && menus.length === 0 && (
                    <Alert
                        type="warning"
                        showIcon
                        className="mb-4"
                        title="ยังไม่มีรายการที่อนุมัติในช่วงที่เลือก"
                        description="อาจเป็นเพราะงานโภชนาการยังไม่ได้กดอนุมัติส่งบริษัท หรือช่วงนั้นไม่มีการสั่งอาหารประเภทที่บริษัทรับผิดชอบ — หากถึงเวลาแล้วยังไม่ขึ้น กรุณาติดต่องานโภชนาการ"
                    />
                )}

                {sheets.length > 0 && (
                    <div className="mb-4">
                        <Text className="text-xs text-gray-500 block mb-2">
                            กดพิมพ์แยกเป็นใบต่อหนึ่งหอหนึ่งมื้อ รูปแบบเดียวกับใบที่งานโภชนาการใช้
                        </Text>
                        <div className="flex flex-wrap gap-2">
                            {sheets.map(s => (
                                <Button
                                    key={`${s.ward}-${s.meal}`}
                                    size="small"
                                    icon={<PiPrinterBold />}
                                    onClick={() => setPrinting({ ward: s.ward, meal: s.meal })}
                                >
                                    {s.ward_name} · {s.meal_name} ({s.qty})
                                    {s.addons > 0 && <span className="text-orange-500"> +{s.addons}</span>}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                <Table
                    rowKey={r => `${r.ward}-${r.meal}-${r.food_item_id}`}
                    columns={columns}
                    dataSource={menus}
                    {...tableLoading(loading, menus, (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={searched ? 'ช่วงที่เลือกไม่มีรายการอาหารของบริษัท' : 'เลือกวันที่แล้วกดดูรายการ'} />
                    ))}
                    size="small"
                    bordered
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    summary={() => menus.length === 0 ? null : (
                        <Table.Summary fixed>
                            <Table.Summary.Row className="bg-teal-50 dark:bg-[#113536]">
                                <Table.Summary.Cell index={0} colSpan={4}>
                                    <span className="font-bold">รวมทั้งสิ้น</span>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={4} align="right">
                                    <span className="font-bold">{menus.reduce((s, m) => s + m.qty, 0).toLocaleString('th-TH')}</span>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={5} align="right">
                                    <span className="font-bold text-orange-500">
                                        {menus.reduce((s, m) => s + m.with_addon, 0) || '-'}
                                    </span>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                        </Table.Summary>
                    )}
                />
            </Card>

            <Modal
                open={printing !== null && pdfProps !== null}
                onCancel={() => setPrinting(null)}
                footer={null}
                width="90%"
                destroyOnHidden
                title={
                    <div className="flex items-center gap-3 flex-wrap">
                        <span>{pdfProps?.wardName} · {pdfProps?.mealLabel}</span>
                        {pdfProps && (
                            <WardOrderPDFDownloadBtn
                                {...pdfProps}
                                fileName={`ใบรายการอาหาร_${pdfProps.wardName}_${pdfProps.mealLabel}_${period.date1}.pdf`}
                            />
                        )}
                    </div>
                }
                styles={{ body: { height: 'calc(100vh - 200px)', padding: 0 } }}
            >
                {pdfProps && <WardOrderPDFViewer {...pdfProps} />}
            </Modal>
        </>
    );
}
