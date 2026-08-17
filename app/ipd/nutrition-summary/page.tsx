'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Card, Button, Typography, Table, Tag, Alert, Spin, DatePicker, Radio, Empty, Tooltip, Modal, Select, App,
} from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import dynamic from 'next/dynamic';
import Navbar from '../../components/Navbar';
import type { WardOrderPDFProps } from './WardOrderPDF';
import { MdOutlineFastfood } from 'react-icons/md';
import { PiCheckCircleBold, PiArrowUUpLeftBold, PiNoteBold, PiPrinterBold } from 'react-icons/pi';
import Swal from 'sweetalert2';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;

/*
  ค่าแทน "ดูรวมทุกหอ" ในช่องเลือกหอผู้ป่วย
  ใช้ค่าที่เป็นไปไม่ได้ในรหัสหอจริง (his_code เป็นตัวเลขล้วน) จะได้ไม่ชนกัน
  และเก็บ state จริงเป็น null เพื่อให้เงื่อนไขกรองอ่านง่ายว่า "ไม่ได้เลือกหอ"
*/
const ALL_WARDS = '__all__';

// @react-pdf/renderer แตะ API ของเบราว์เซอร์ตั้งแต่ตอน import จึงต้องปิด ssr
const WardPDFViewer = dynamic(() => import('./PDFViewerClient').then(m => m.WardPDFViewer), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><Spin size="large" /></div>,
});
const WardPDFDownloadBtn = dynamic(() => import('./PDFViewerClient').then(m => m.WardPDFDownloadBtn), { ssr: false });

const MEALS = [
    { value: 1, label: 'เช้า', color: 'blue' },
    { value: 2, label: 'กลางวัน', color: 'orange' },
    { value: 3, label: 'เย็น', color: 'purple' },
];

interface SummaryRow {
    meal: number;
    ward: string;
    ward_name: string;
    food_item_id: number;
    food_name: string;
    qty: number;
    received: number;
    with_addon: number;
}

interface AddonRow {
    meal: number;
    ward: string;
    an: string;
    bedno: string | null;
    patient_name: string | null;
    food_name: string;
    addon: string;
}

interface WardStatus {
    meal: number;
    ward: string;
    ward_name: string;
    total: number;
    received: number;
    pending: number;
    reciever_name: string | null;
    received_at: string | null;
}

interface SummaryData {
    date: string;
    rows: SummaryRow[];
    addons: AddonRow[];
    wards: WardStatus[];
}

/* แถวของตาราง "แยกตามหอผู้ป่วย" — รวมเมนูของหอนั้นไว้ในแถวเดียว */
interface WardCardRow extends WardStatus {
    menus: { food_name: string; qty: number }[];
}

function NutritionSummaryContent() {
    // Modal แบบ static (Modal.confirm) อ่าน context ของธีมไม่ได้ กล่องยืนยันจะไม่ตามโหมดมืด
    // ต้องเรียกผ่าน App.useApp() ซึ่งบังคับให้หน้านี้อยู่ใต้ <App> ตามที่ประกอบไว้ข้างล่าง
    const { modal } = App.useApp();

    const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
    const [meal, setMeal] = useState<number>(2);
    const [data, setData] = useState<SummaryData | null>(null);
    const [loading, setLoading] = useState(false);
    const [canReceive, setCanReceive] = useState<boolean | null>(null);
    const [working, setWorking] = useState<string | null>(null);
    const [addonModalWard, setAddonModalWard] = useState<WardStatus | null>(null);
    const [printWard, setPrintWard] = useState<WardCardRow | null>(null);
    // null = ดูรวมทุกหอ ซึ่งเป็นค่าเริ่มต้นเพราะครัวเริ่มจากยอดรวมก่อนเสมอ
    const [selectedWard, setSelectedWard] = useState<string | null>(null);
    const [wardOptions, setWardOptions] = useState<{ label: string; value: string }[]>([]);

    const authHeaders = useCallback((): Record<string, string> => {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const res = await axios.get('/api/v1/nutrition/access', { headers: authHeaders() });
                setCanReceive(res.data?.data?.can_receive === true);
            } catch {
                setCanReceive(false);
            }
        })();
    }, [authHeaders]);

    // ดึงทะเบียนหอผู้ป่วยทั้งหมด ไม่ใช่เฉพาะหอที่มีรายการในวันนั้น
    // เพราะต้องเลือกดูได้ว่าหอไหน "ยังไม่ได้สั่ง" ซึ่งเป็นข้อมูลที่ครัวต้องรู้พอๆ กัน
    useEffect(() => {
        (async () => {
            try {
                const res = await axios.get('/api/v1/system/wardsV1', { headers: authHeaders() });
                const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
                setWardOptions(list.map((w: { ward_name: string; his_code: string }) => ({
                    label: w.ward_name,
                    value: w.his_code,
                })));
            } catch (error) {
                console.error('Error fetching wards:', error);
            }
        })();
    }, [authHeaders]);

    const fetchSummary = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.post('/api/v1/nutrition/daily-summary',
                { date: date.format('YYYY-MM-DD') },
                { headers: { ...authHeaders(), 'Content-Type': 'application/json' } });
            setData(res.data?.data ?? null);
        } catch (error) {
            console.error('Error fetching daily summary:', error);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [date, authHeaders]);

    useEffect(() => { fetchSummary(); }, [fetchSummary]);

    // กรองหอผู้ป่วยฝั่งหน้าจอ ข้อมูลทั้งวันถูกดึงมาแล้วในครั้งเดียว
    // สลับหอไปมาจึงไม่ต้องรอโหลดใหม่ทุกครั้ง
    const inWard = <T extends { ward: string }>(r: T) => !selectedWard || r.ward === selectedWard;
    const mealRows = (data?.rows ?? []).filter(r => r.meal === meal && inWard(r));
    const mealAddons = (data?.addons ?? []).filter(a => a.meal === meal && inWard(a));
    const mealWards = (data?.wards ?? []).filter(w => w.meal === meal && inWard(w));
    const selectedWardName = wardOptions.find(w => w.value === selectedWard)?.label ?? '';

    /*
      ยอดรวมทั้งโรงพยาบาลคือตัวเลขที่ครัวใช้ตั้งหม้อ ส่วนยอดรายหอใช้ตอนจัดใส่รถเข็น
      รวมจากชุดข้อมูลเดียวกันฝั่งหน้าจอ จะได้ไม่มีทางที่สองตัวเลขนี้ไม่ตรงกัน
    */
    const totalByMenu = Object.values(
        mealRows.reduce((acc, r) => {
            acc[r.food_name] = acc[r.food_name] ?? { food_name: r.food_name, qty: 0, with_addon: 0 };
            acc[r.food_name].qty += r.qty;
            acc[r.food_name].with_addon += r.with_addon;
            return acc;
        }, {} as Record<string, { food_name: string; qty: number; with_addon: number }>)
    ).sort((a, b) => b.qty - a.qty || a.food_name.localeCompare(b.food_name, 'th'));

    const grandTotal = totalByMenu.reduce((s, r) => s + r.qty, 0);

    const wardCards: WardCardRow[] = mealWards.map(w => ({
        ...w,
        menus: mealRows
            .filter(r => r.ward === w.ward)
            .map(r => ({ food_name: r.food_name, qty: r.qty }))
            .sort((a, b) => b.qty - a.qty),
    }));

    const handleReceive = async (ward: WardStatus, undo: boolean) => {
        const key = `${ward.ward}-${ward.meal}`;
        setWorking(key);
        try {
            const res = await axios.post('/api/v1/nutrition/receive-orders', {
                ward: ward.ward, date: date.format('YYYY-MM-DD'), meal, undo,
            }, { headers: { ...authHeaders(), 'Content-Type': 'application/json' } });

            if (res.data?.success) {
                await fetchSummary();
                Swal.fire({ icon: 'success', title: undo ? 'ถอนการรับแล้ว' : 'รับรายการแล้ว', text: res.data.message, timer: 2000, showConfirmButton: false });
            }
        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง'
                : 'กรุณาลองใหม่อีกครั้ง';
            Swal.fire({ icon: 'error', title: 'ทำรายการไม่สำเร็จ', text: message, timer: 3000, showConfirmButton: false });
        } finally {
            setWorking(null);
        }
    };

    const confirmReceive = (ward: WardCardRow, undo: boolean) => {
        modal.confirm({
            title: undo ? 'ถอนการรับรายการ' : 'รับรายการอาหาร',
            width: 520,
            okText: undo ? 'ถอนการรับ' : 'รับรายการ',
            cancelText: 'ไม่ใช่ตอนนี้',
            okButtonProps: undo ? { danger: true } : { style: { backgroundColor: '#006b5f', borderColor: '#006b5f' } },
            content: (
                <div className="space-y-2 pt-1">
                    <p className="mb-0">
                        <span className="font-semibold">{ward.ward_name}</span> · มื้อ{MEALS.find(m => m.value === meal)?.label}{' '}
                        วันที่ {date.format('DD/MM/YYYY')} จำนวน{' '}
                        <span className="font-semibold">{undo ? ward.received : ward.pending}</span> รายการ
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {ward.menus.map(m => (
                            <Tag key={m.food_name} color="green" className="m-0">{m.food_name} × {m.qty}</Tag>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mb-0">
                        {undo
                            ? 'เมื่อถอนการรับแล้ว หอผู้ป่วยจะกลับมาแก้ไขและยกเลิกรายการได้เอง'
                            : 'เมื่อรับแล้ว หอผู้ป่วยจะยกเลิกรายการเองไม่ได้ ต้องแจ้งงานโภชนาการให้ถอนการรับก่อน'}
                    </p>
                </div>
            ),
            onOk: () => handleReceive(ward, undo),
        });
    };

    // แปลงแถวของหอผู้ป่วยหนึ่งให้อยู่ในรูปที่เอกสาร PDF ต้องการ
    const buildPdfProps = (row: WardCardRow): WardOrderPDFProps => ({
        wardName: row.ward_name,
        dateLabel: date.format('DD/MM/YYYY'),
        mealLabel: `มื้อ${MEALS.find(m => m.value === row.meal)?.label ?? ''}`,
        printedAt: dayjs().format('DD/MM/YYYY HH:mm'),
        menus: row.menus,
        addons: mealAddons
            .filter(a => a.ward === row.ward)
            .map(a => ({ bedno: a.bedno, patient_name: a.patient_name, food_name: a.food_name, addon: a.addon })),
        status: {
            total: row.total,
            received: row.received,
            pending: row.pending,
            reciever_name: row.reciever_name,
            received_at: row.received_at,
        },
    });

    const totalColumns: TableColumnsType<{ food_name: string; qty: number; with_addon: number }> = [
        {
            title: 'รายการอาหาร', dataIndex: 'food_name', key: 'food_name',
            render: (t: string) => <span className="font-medium">{t}</span>,
        },
        {
            title: 'มีหมายเหตุ', dataIndex: 'with_addon', key: 'with_addon', width: 110, align: 'center',
            render: (n: number) => n > 0
                ? <Tag color="gold" className="m-0">{n} ราย</Tag>
                : <span className="text-gray-300">-</span>,
        },
        {
            title: 'จำนวน (ที่)', dataIndex: 'qty', key: 'qty', width: 110, align: 'center',
            render: (n: number) => <span className="text-lg font-bold text-[var(--brand-text)]">{n}</span>,
        },
    ];

    const wardColumns: TableColumnsType<WardCardRow> = [
        {
            title: 'หอผู้ป่วย', dataIndex: 'ward_name', key: 'ward_name', width: 170,
            render: (name: string, row) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-[var(--brand-text)]">{name}</span>
                    <span className="text-[11px] text-gray-400">รหัส {row.ward}</span>
                </div>
            ),
        },
        {
            title: 'รายการอาหาร', key: 'menus',
            render: (_, row) => (
                <div className="flex flex-wrap gap-1">
                    {row.menus.map(m => (
                        <Tag key={m.food_name} color="green" className="m-0 whitespace-normal h-auto py-0.5">
                            {m.food_name} <span className="font-bold">× {m.qty}</span>
                        </Tag>
                    ))}
                </div>
            ),
        },
        {
            title: 'รวม', dataIndex: 'total', key: 'total', width: 80, align: 'center',
            render: (n: number) => <span className="text-lg font-bold">{n}</span>,
        },
        {
            title: 'สถานะ', key: 'status', width: 210,
            render: (_, row) => {
                if (row.received === 0) return <Tag color="default">ยังไม่ได้รับรายการ</Tag>;
                const partial = row.pending > 0;
                return (
                    <div className="flex flex-col gap-0.5">
                        <Tag color={partial ? 'gold' : 'green'} className="m-0 w-fit">
                            {partial ? `รับแล้วบางส่วน ${row.received}/${row.total}` : 'รับรายการแล้ว'}
                        </Tag>
                        <span className="text-[11px] text-gray-500">
                            {row.reciever_name || 'ไม่ทราบผู้รับ'} · {row.received_at} น.
                        </span>
                    </div>
                );
            },
        },
        {
            title: 'ดำเนินการ', key: 'action', width: 230, align: 'center',
            render: (_, row) => {
                const busy = working === `${row.ward}-${row.meal}`;
                const hasAddon = mealAddons.some(a => a.ward === row.ward);
                return (
                    <div className="flex items-center justify-center gap-1">
                        <Tooltip title="พิมพ์ใบรายการอาหารของหอนี้">
                            <Button size="small" icon={<PiPrinterBold />} onClick={() => setPrintWard(row)} />
                        </Tooltip>
                        {hasAddon && (
                            <Tooltip title="ดูหมายเหตุพิเศษของหอนี้">
                                <Button size="small" icon={<PiNoteBold />} onClick={() => setAddonModalWard(row)} />
                            </Tooltip>
                        )}
                        {canReceive && row.pending > 0 && (
                            <Button
                                size="small" type="primary" loading={busy} icon={<PiCheckCircleBold />}
                                className="bg-[#006b5f] hover:bg-[#005a50]"
                                onClick={() => confirmReceive(row, false)}
                            >
                                รับรายการ
                            </Button>
                        )}
                        {canReceive && row.received > 0 && (
                            <Tooltip title="ถอนการรับ เพื่อให้หอผู้ป่วยกลับไปแก้ไขได้">
                                <Button size="small" danger loading={busy} icon={<PiArrowUUpLeftBold />}
                                    onClick={() => confirmReceive(row, true)} />
                            </Tooltip>
                        )}
                    </div>
                );
            },
        },
    ];

    const addonColumns: TableColumnsType<AddonRow> = [
        { title: 'เตียง', dataIndex: 'bedno', key: 'bedno', width: 70, align: 'center' },
        { title: 'ชื่อ-สกุล', dataIndex: 'patient_name', key: 'patient_name', width: 180 },
        {
            title: 'อาหาร', dataIndex: 'food_name', key: 'food_name', width: 180,
            render: (t: string) => <Tag color="green" className="whitespace-normal h-auto py-0.5">{t}</Tag>,
        },
        {
            title: 'หมายเหตุ', dataIndex: 'addon', key: 'addon',
            render: (t: string) => <span className="text-amber-700 font-medium">{t}</span>,
        },
    ];

    const mealMeta = MEALS.find(m => m.value === meal)!;
    const headClass = `
        [&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]!
        [&_.ant-table-thead_.ant-table-cell]:text-white!
        [&_.ant-table-thead_.ant-table-cell]:font-semibold!
    `;

    return (
        <>
        <div className="p-6 max-w-full mx-auto space-y-4">
                <Card className="shadow-xl rounded-2xl border-none">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#006b5f] p-2.5 rounded-xl shadow-md">
                                <MdOutlineFastfood className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <Title level={4} className="m-0! text-[var(--brand-text)]!">สรุปรายการอาหารประจำวัน</Title>
                                <Text type="secondary" className="text-sm">
                                    ยอดที่ต้องเตรียมทั้งโรงพยาบาล และยอดแยกรายหอผู้ป่วยสำหรับจัดส่ง
                                </Text>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <DatePicker
                                value={date}
                                onChange={(d) => d && setDate(d)}
                                format="DD/MM/YYYY"
                                allowClear={false}
                            />
                            <Select
                                value={selectedWard ?? ALL_WARDS}
                                onChange={(v) => setSelectedWard(v === ALL_WARDS ? null : v)}
                                style={{ width: 220 }}
                                showSearch
                                optionFilterProp="label"
                                options={[
                                    { label: 'หอผู้ป่วยทั้งหมด', value: ALL_WARDS },
                                    ...wardOptions,
                                ]}
                            />
                            <Radio.Group
                                value={meal}
                                onChange={e => setMeal(e.target.value)}
                                optionType="button"
                                buttonStyle="solid"
                            >
                                {MEALS.map(m => (
                                    <Radio.Button key={m.value} value={m.value} className="w-24 text-center">
                                        {m.label}
                                    </Radio.Button>
                                ))}
                            </Radio.Group>
                        </div>
                    </div>

                    {canReceive === false && (
                        <Alert
                            type="info"
                            showIcon
                            className="mb-4"
                            title="เปิดดูได้อย่างเดียว"
                            description="การรับรายการอาหารสงวนไว้ให้เจ้าหน้าที่กลุ่มงานโภชนศาสตร์ หากต้องใช้สิทธิ์นี้กรุณาแจ้งผู้ดูแลระบบ"
                        />
                    )}

                    {loading ? (
                        <div className="flex justify-center py-16"><Spin size="large" /></div>
                    ) : grandTotal === 0 ? (
                        <Empty description={
                            `ยังไม่มีรายการอาหารมื้อ${mealMeta.label} ของวันที่ ${date.format('DD/MM/YYYY')}` +
                            (selectedWard ? ` ในหอผู้ป่วย${selectedWardName}` : '')
                        } />
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
                            <div>
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="font-semibold text-gray-700">
                                        {selectedWard ? `ยอดรวมของ${selectedWardName}` : 'ยอดรวมทั้งโรงพยาบาล'}
                                    </span>
                                    <Tag color={mealMeta.color} className="m-0">มื้อ{mealMeta.label}</Tag>
                                </div>
                                <Table
                                    columns={totalColumns}
                                    dataSource={totalByMenu}
                                    rowKey="food_name"
                                    size="small"
                                    pagination={false}
                                    bordered
                                    className={headClass}
                                    summary={() => (
                                        <Table.Summary.Row className="bg-teal-50 font-bold">
                                            <Table.Summary.Cell index={0}>รวมทั้งหมด</Table.Summary.Cell>
                                            <Table.Summary.Cell index={1} align="center">
                                                {totalByMenu.reduce((s, r) => s + r.with_addon, 0)} ราย
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={2} align="center">
                                                <span className="text-lg text-[var(--brand-text)]">{grandTotal}</span>
                                            </Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    )}
                                />
                            </div>

                            <div>
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="font-semibold text-gray-700">แยกตามหอผู้ป่วย</span>
                                    <Tag color="cyan" className="m-0">{wardCards.length} หอ</Tag>
                                </div>
                                <Table
                                    columns={wardColumns}
                                    dataSource={wardCards}
                                    rowKey={r => `${r.ward}-${r.meal}`}
                                    size="small"
                                    pagination={false}
                                    bordered
                                    scroll={{ x: 'max-content' }}
                                    className={headClass}
                                />
                            </div>
                        </div>
                    )}
                </Card>

                {/* หมายเหตุพิเศษของทั้งมื้อ ครัวต้องอ่านทีละบรรทัด รวมยอดแทนกันไม่ได้ */}
                {!loading && mealAddons.length > 0 && (
                    <Card className="shadow-xl rounded-2xl border-none">
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="font-semibold text-gray-700">หมายเหตุพิเศษรายผู้ป่วย</span>
                            <Tag color="gold" className="m-0">{mealAddons.length} ราย</Tag>
                        </div>
                        <Table
                            columns={[
                                {
                                    title: 'หอผู้ป่วย', dataIndex: 'ward', key: 'ward', width: 150,
                                    render: (w: string) => data?.wards.find(x => x.ward === w)?.ward_name ?? w,
                                },
                                ...addonColumns,
                            ]}
                            dataSource={mealAddons}
                            rowKey={r => `${r.an}-${r.meal}`}
                            size="small"
                            pagination={false}
                            bordered
                            className={headClass}
                        />
                    </Card>
                )}
            </div>

            {/*
              เปิด PDF ในกล่องแทนการเปิดหน้าใหม่ ครัวจะได้ไม่หลุดจากรายการที่กำลังไล่รับอยู่
              destroyOnHidden เพราะ PDFViewer สร้าง blob ใหม่ทุกครั้ง ถ้าค้างไว้จะกินหน่วยความจำสะสม
            */}
            <Modal
                open={printWard !== null}
                onCancel={() => setPrintWard(null)}
                width="90%"
                style={{ top: 24 }}
                styles={{ body: { height: 'calc(100vh - 200px)', padding: 0 } }}
                destroyOnHidden
                title={
                    <span className="font-semibold text-[var(--brand-text)]">
                        ใบรายการอาหาร · {printWard?.ward_name} มื้อ{mealMeta.label} วันที่ {date.format('DD/MM/YYYY')}
                    </span>
                }
                footer={printWard ? [
                    <Button key="close" onClick={() => setPrintWard(null)}>ปิด</Button>,
                    <WardPDFDownloadBtn
                        key="download"
                        {...buildPdfProps(printWard)}
                        fileName={`ใบรายการอาหาร_${printWard.ward_name}_${date.format('YYYY-MM-DD')}_${mealMeta.label}.pdf`}
                    />,
                ] : null}
            >
                {printWard && <WardPDFViewer {...buildPdfProps(printWard)} />}
            </Modal>

            <Modal
                open={addonModalWard !== null}
                onCancel={() => setAddonModalWard(null)}
                footer={null}
                width={640}
                title={
                    <span className="font-semibold text-[var(--brand-text)]">
                        หมายเหตุพิเศษ · {addonModalWard?.ward_name} มื้อ{mealMeta.label}
                    </span>
                }
            >
                <Table
                    columns={addonColumns}
                    dataSource={mealAddons.filter(a => a.ward === addonModalWard?.ward)}
                    rowKey={r => `${r.an}-${r.meal}`}
                    size="small"
                    pagination={false}
                    bordered
                    className={headClass}
                />
            </Modal>
        </>
    );
}

export default function NutritionSummaryPage() {
    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <App>
                <NutritionSummaryContent />
            </App>
        </div>
    );
}
