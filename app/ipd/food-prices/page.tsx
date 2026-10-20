'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
    Card, Button, Table, Tag, Typography, Modal, InputNumber, DatePicker, Input, Alert, Empty, Tooltip, Form, Select, Spin,
} from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import dynamic from 'next/dynamic';
import Swal from 'sweetalert2';
import Navbar from '../../components/Navbar';
import { formatMoney } from '../../lib/money';
import type { ContractPDFProps } from './ContractPDF';
import { PiMoneyWavyBold, PiPencilSimpleBold, PiTrashBold, PiPlusBold, PiFilePdfBold } from 'react-icons/pi';

// @react-pdf/renderer แตะ API ของเบราว์เซอร์ตั้งแต่ตอน import จึงต้องปิด ssr
const ContractPDFViewer = dynamic(() => import('./PDFViewerClient').then(m => m.ContractPDFViewer), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><Spin size="large" /></div>,
});
const ContractPDFDownloadBtn = dynamic(() => import('./PDFViewerClient').then(m => m.ContractPDFDownloadBtn), { ssr: false });

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface PriceType {
    food_type_id: number;
    food_type_name: string;
    is_active: boolean;
    billable: boolean;
    price_per_day: number | null;
    meals_per_day: number | null;
    price_per_meal: number | null;
    effective_from: string | null;
    effective_to: string | null;
    contract_note: string | null;
}

/** หนึ่งแถวคือหนึ่งสัญญา: ประเภท + ช่วงวันที่ + ราคา */
interface Contract {
    food_type_price_id: number;
    food_type_id: number;
    food_type_name: string;
    price_per_day: number;
    meals_per_day: number;
    effective_from: string;
    effective_to: string | null;
    contract_note: string | null;
    created_at: string;
    created_by_name: string | null;
    /** บริษัทคู่สัญญา null = ยังไม่ระบุ ซึ่งจะไม่ปรากฏในหน้าของบริษัทใดเลย */
    vendor_id: number | null;
    vendor_name: string | null;
}

interface Vendor {
    vendor_id: number;
    vendor_name: string;
}

const TYPE_COLOR: Record<string, string> = {
    'สามัญ': 'green',
    'พิเศษ': 'blue',
    'VIP': 'gold',
};

const baht = formatMoney;
const thDate = (d: string) => dayjs(d).format('DD/MM/BBBB');

export default function FoodPricesPage() {
    const [types, setTypes] = useState<PriceType[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [canManage, setCanManage] = useState(false);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    /** null = ปิดอยู่ · 'new' = เพิ่มฉบับใหม่ · Contract = แก้ไขฉบับนั้น */
    const [editing, setEditing] = useState<Contract | 'new' | null>(null);
    const [printing, setPrinting] = useState(false);
    const [form] = Form.useForm();

    const authHeaders = useCallback((): Record<string, string> => {
        const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }, []);

    const errorText = (error: unknown) => axios.isAxiosError(error)
        ? error.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง'
        : 'กรุณาลองใหม่อีกครั้ง';

    const fetchPrices = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.post('/api/v1/nutrition/food-type-prices', {}, { headers: authHeaders() });
            if (res.data?.success) {
                setTypes(res.data.data.types ?? []);
                setContracts(res.data.data.history ?? []);
                setVendors(res.data.data.vendors ?? []);
                setCanManage(res.data.data.can_manage === true);
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'ดึงข้อมูลสัญญาไม่สำเร็จ', text: errorText(error), timer: 3000, showConfirmButton: false });
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

    useEffect(() => { fetchPrices(); }, [fetchPrices]);

    const billableTypes = types.filter(t => t.billable && t.is_active);

    /*
      ตั้งค่าเริ่มต้นผ่าน initialValues ไม่ใช่ setFieldsValue ตอนกดปุ่ม
      เพราะ Modal ใช้ destroyOnHidden — ตอนกดปุ่ม Form ยังไม่ถูกวาด
      การสั่ง form ตอนนั้นจึงสั่งใส่อากาศ และ antd จะเตือนว่า useForm ไม่ได้ต่อกับ Form ไหน
    */
    const row = editing === 'new' ? null : editing;
    const initialValues = {
        food_type_id: row?.food_type_id ?? billableTypes[0]?.food_type_id,
        price_per_day: row?.price_per_day ?? undefined,
        meals_per_day: row?.meals_per_day ?? 3,
        period: row
            ? [dayjs(row.effective_from), row.effective_to ? dayjs(row.effective_to) : null]
            : [dayjs(), null],
        contract_note: row?.contract_note ?? '',
        // บริษัทเดียวในระบบก็เลือกให้เลย จะได้ไม่ต้องกดซ้ำทุกครั้งที่เพิ่มสัญญา
        vendor_id: row?.vendor_id ?? (vendors.length === 1 ? vendors[0].vendor_id : undefined),
    };

    const handleSave = async () => {
        /*
          validateFields ปฏิเสธด้วยอ็อบเจ็กต์ {values, errorFields} ไม่ใช่ Error
          ถ้าปล่อยหลุดออกไป antd จะ console.error ตัวนั้น แล้วหน้าจอ dev ของ Next
          จะขึ้นว่า [object Object] ซึ่งไม่ได้บอกอะไรเลย
          ที่จริงไม่ต้องบอกอะไรอยู่แล้ว เพราะข้อความเตือนขึ้นใต้ช่องที่กรอกไม่ครบให้เห็นแล้ว
        */
        let values;
        try {
            values = await form.validateFields();
        } catch {
            return;
        }
        const [from, to] = values.period ?? [];

        setSaving(true);
        try {
            const res = await axios.put('/api/v1/nutrition/food-type-prices', {
                food_type_price_id: row?.food_type_price_id ?? null,
                food_type_id: Number(values.food_type_id),
                price_per_day: Number(values.price_per_day),
                meals_per_day: Number(values.meals_per_day),
                effective_from: dayjs(from).format('YYYY-MM-DD'),
                effective_to: to ? dayjs(to).format('YYYY-MM-DD') : null,
                contract_note: values.contract_note?.trim() || null,
                vendor_id: Number(values.vendor_id),
            }, { headers: authHeaders() });

            if (res.data?.success) {
                Swal.fire({ icon: 'success', title: res.data.message, timer: 2500, showConfirmButton: false });
                setEditing(null);
                await fetchPrices();
            }
        } catch (error) {
            // ช่วงซ้อนกันตอบ 409 พร้อมบอกว่าชนกับฉบับไหน ต้องโชว์ให้ครบ ไม่ใช่แค่ว่าบันทึกไม่ได้
            Swal.fire({ icon: 'error', title: 'บันทึกสัญญาไม่สำเร็จ', text: errorText(error) });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (c: Contract) => {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: 'ลบสัญญาฉบับนี้?',
            html: `<div style="text-align:left">
                    <b>${c.food_type_name}</b> ${baht(c.price_per_day)} บาท/วัน<br/>
                    ${thDate(c.effective_from)} ถึง ${c.effective_to ? thDate(c.effective_to) : 'ไม่กำหนด'}<br/><br/>
                    ใช้เมื่อบันทึกผิดเท่านั้น — สัญญาที่เคยใช้คิดยอดไปแล้วไม่ควรลบ
                    เพราะรายงานย้อนหลังจะคิดราคาไม่ได้
                   </div>`,
            showCancelButton: true,
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc2626',
        });
        if (!confirm.isConfirmed) return;

        try {
            const res = await axios.delete('/api/v1/nutrition/food-type-prices', {
                headers: authHeaders(),
                data: { food_type_price_id: c.food_type_price_id },
            });
            if (res.data?.success) {
                Swal.fire({ icon: 'success', title: 'ลบสัญญาแล้ว', timer: 2000, showConfirmButton: false });
                await fetchPrices();
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: errorText(error) });
        }
    };

    const today = dayjs().format('YYYY-MM-DD');
    const statusOf = (c: Contract) => {
        if (c.effective_from > today) return { text: 'ยังไม่เริ่ม', color: 'blue' };
        if (c.effective_to && c.effective_to < today) return { text: 'หมดอายุ', color: 'default' };
        return { text: 'ใช้อยู่', color: 'green' };
    };

    /*
      ส่งสถานะที่หน้าจอคิดไว้แล้วเข้าไปใน PDF ไม่ให้เอกสารคิดเอง
      ไม่งั้นถ้ากติกาสถานะเปลี่ยน จะต้องไล่แก้สองที่แล้วกระดาษกับจอจะไม่ตรงกัน
    */
    const pdfProps: ContractPDFProps = {
        asOfLabel: dayjs().format('DD/MM/BBBB'),
        printedAt: dayjs().format('DD/MM/BBBB HH:mm'),
        formatDate: thDate,
        current: billableTypes.map(t => ({
            food_type_name: t.food_type_name,
            price_per_day: t.price_per_day,
            meals_per_day: t.meals_per_day,
            price_per_meal: t.price_per_meal,
            effective_to: t.effective_to,
        })),
        contracts: contracts.map(c => ({ ...c, status: statusOf(c).text })),
    };

    const columns: TableColumnsType<Contract> = [
        {
            title: 'ประเภทอาหาร', dataIndex: 'food_type_name', key: 'food_type_name', width: 130,
            render: (v: string) => <Tag color={TYPE_COLOR[v] ?? 'default'} className="font-semibold">{v}</Tag>,
        },
        {
            title: 'ตั้งแต่วันที่', dataIndex: 'effective_from', key: 'effective_from', width: 130, align: 'center',
            defaultSortOrder: 'descend',
            sorter: (a, b) => a.effective_from.localeCompare(b.effective_from),
            render: (v: string) => thDate(v),
        },
        {
            title: 'ถึงวันที่', dataIndex: 'effective_to', key: 'effective_to', width: 130, align: 'center',
            render: (v: string | null) => v
                ? thDate(v)
                : <Tooltip title="ใช้ไปจนกว่าจะมีสัญญาใหม่"><span className="text-gray-400">ไม่กำหนด</span></Tooltip>,
        },
        {
            title: 'ราคา/วัน', dataIndex: 'price_per_day', key: 'price_per_day', width: 120, align: 'right',
            render: (v: number) => <span className="text-base font-bold text-[#006b5f]">{baht(v)}</span>,
        },
        {
            title: 'มื้อ/วัน', dataIndex: 'meals_per_day', key: 'meals_per_day', width: 80, align: 'center',
            render: (v: number) => `${v} มื้อ`,
        },
        {
            title: 'สถานะ', key: 'status', width: 100, align: 'center',
            render: (_, c) => {
                const s = statusOf(c);
                return <Tag color={s.color}>{s.text}</Tag>;
            },
        },
        {
            /*
              สัญญาที่ไม่มีบริษัทจะไม่ปรากฏในหน้าของบริษัทใดเลย มื้อในช่วงนั้นจะกลายเป็น
              "ยังไม่มีราคา" ทั้งที่ตั้งราคาไว้แล้ว ต้องเห็นเป็นสีแดงทันที ไม่ใช่ขีดเฉยๆ
            */
            title: 'บริษัทคู่สัญญา', dataIndex: 'vendor_name', key: 'vendor_name', width: 180,
            render: (v: string | null) => v
                ? <span className="font-medium">{v}</span>
                : <Tooltip title="บริษัทจะมองไม่เห็นสัญญาฉบับนี้ และยอดในช่วงนี้จะคิดเงินไม่ได้">
                    <Tag color="red">ยังไม่ระบุบริษัท</Tag>
                </Tooltip>,
        },
        {
            title: 'เลขที่สัญญา', dataIndex: 'contract_note', key: 'contract_note',
            render: (v: string | null) => v || <span className="text-gray-300">-</span>,
        },
        {
            title: 'บันทึกโดย', key: 'created', width: 180,
            render: (_, c) => (
                <div className="text-xs leading-tight">
                    <div>{c.created_by_name || '-'}</div>
                    <div className="text-gray-400">{c.created_at}</div>
                </div>
            ),
        },
        ...(canManage ? [{
            title: 'จัดการ', key: 'action', width: 110, align: 'center' as const, fixed: 'right' as const,
            render: (_: unknown, c: Contract) => (
                <div className="flex items-center justify-center gap-1">
                    <Tooltip title="แก้ไขสัญญาฉบับนี้">
                        <Button size="small" icon={<PiPencilSimpleBold />} onClick={() => setEditing(c)} />
                    </Tooltip>
                    <Tooltip title="ลบ (ใช้เมื่อบันทึกผิด)">
                        <Button size="small" danger type="text" icon={<PiTrashBold />} onClick={() => handleDelete(c)} />
                    </Tooltip>
                </div>
            ),
        }] : []),
    ];

    const unpriced = billableTypes.filter(t => t.price_per_day === null);

    return (
        <div className="bg-slate-50 dark:bg-[#141414] min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-full mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#006b5f] p-2.5 rounded-xl shadow-md">
                                <PiMoneyWavyBold className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <Title level={4} className="m-0!">สัญญาราคาอาหาร</Title>
                                <Text type="secondary" className="text-sm">
                                    หนึ่งฉบับ = ประเภทอาหาร + ช่วงวันที่ + ราคา · ช่วงวันที่ของประเภทเดียวกันซ้อนกันไม่ได้
                                </Text>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Tooltip title="รายงานทะเบียนสัญญาแบบ PDF พร้อมพิมพ์">
                                <Button
                                    icon={<PiFilePdfBold />}
                                    onClick={() => setPrinting(true)}
                                    disabled={contracts.length === 0}
                                >
                                    รายงาน PDF
                                </Button>
                            </Tooltip>
                            {canManage && (
                                <Button
                                    type="primary"
                                    icon={<PiPlusBold />}
                                    onClick={() => setEditing('new')}
                                    className="bg-[#006b5f] hover:bg-[#005a50] border-none shadow-md"
                                >
                                    เพิ่มสัญญา
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* ราคาที่ใช้อยู่วันนี้ ดูแยกจากรายการสัญญา เพราะเป็นคนละคำถาม */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        {billableTypes.map(t => (
                            <div key={t.food_type_id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <Tag color={TYPE_COLOR[t.food_type_name] ?? 'default'} className="m-0">{t.food_type_name}</Tag>
                                    <span className="text-[11px] text-gray-400">ราคาวันนี้</span>
                                </div>
                                {t.price_per_day === null ? (
                                    <div className="text-sm text-rose-600 font-medium">ยังไม่มีสัญญาที่ใช้ได้</div>
                                ) : (
                                    <>
                                        <div className="text-2xl font-bold text-[#006b5f] leading-none">
                                            {baht(t.price_per_day)}
                                            <span className="text-xs font-normal text-gray-400 ml-1">บาท/วัน</span>
                                        </div>
                                        <div className="text-[11px] text-gray-400 mt-1">
                                            เฉลี่ยมื้อละ {baht(t.price_per_meal)} · ถึง {t.effective_to ? thDate(t.effective_to) : 'ไม่กำหนด'}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    <Alert
                        type="info"
                        showIcon
                        className="mb-4"
                        title="ราคาที่กรอกคือราคาต่อผู้ป่วยหนึ่งคนหนึ่งวัน ไม่ใช่ต่อมื้อ"
                        description="รายงานจะเลือกราคาตามวันที่สั่งอาหารแต่ละมื้อ การเพิ่มสัญญาใหม่จึงไม่กระทบยอดของช่วงที่ผ่านมา"
                    />

                    {!canManage && (
                        <Alert type="warning" showIcon className="mb-4"
                            title="คุณดูได้อย่างเดียว การเพิ่มหรือแก้ไขสัญญาจำกัดเฉพาะผู้ดูแลระบบ" />
                    )}

                    {unpriced.length > 0 && (
                        <Alert type="warning" showIcon className="mb-4"
                            title={`วันนี้ยังไม่มีสัญญาที่ใช้ได้ ${unpriced.length} ประเภท: ${unpriced.map(t => t.food_type_name).join(', ')}`}
                            description="ถาดของประเภทนี้จะคิดเงินไม่ได้จนกว่าจะมีสัญญาครอบคลุมวันที่สั่ง" />
                    )}

                    <Table
                        rowKey="food_type_price_id"
                        columns={columns}
                        dataSource={contracts}
                        loading={loading}
                        size="small"
                        bordered
                        scroll={{ x: 'max-content' }}
                        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `ทั้งหมด ${t} ฉบับ` }}
                        locale={{ emptyText: <Empty description="ยังไม่มีสัญญาในระบบ" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                    />

                    <Text type="secondary" className="block mt-3 text-xs">
                        สัญญาเก่าไม่ถูกลบเมื่อเพิ่มฉบับใหม่ เพื่อให้คิดยอดย้อนหลังได้ตรงกับราคาที่ใช้อยู่ในตอนนั้น
                        ช่วงที่ไม่มีสัญญาครอบคลุมจะขึ้นว่าคิดเงินไม่ได้ ไม่ใช่ใช้ราคาเก่าต่อ
                    </Text>
                </Card>
            </div>

            {/*
              เปิด PDF ในกล่องแทนหน้าใหม่ จะได้กลับมาที่รายการสัญญาได้ทันที
              destroyOnHidden เพราะ PDFViewer สร้าง blob ใหม่ทุกครั้ง ถ้าค้างไว้จะกินหน่วยความจำสะสม
            */}
            <Modal
                open={printing}
                onCancel={() => setPrinting(false)}
                width="90%"
                style={{ top: 24 }}
                styles={{ body: { height: 'calc(100vh - 200px)', padding: 0 } }}
                destroyOnHidden
                title={<span className="font-semibold text-[var(--brand-text)]">ทะเบียนสัญญาราคาอาหาร · ณ วันที่ {pdfProps.asOfLabel}</span>}
                footer={[
                    <Button key="close" onClick={() => setPrinting(false)}>ปิด</Button>,
                    <ContractPDFDownloadBtn
                        key="download"
                        {...pdfProps}
                        fileName={`ทะเบียนสัญญาราคาอาหาร_${dayjs().format('YYYY-MM-DD')}.pdf`}
                    />,
                ]}
            >
                {printing && <ContractPDFViewer {...pdfProps} />}
            </Modal>

            <Modal
                title={row ? `แก้ไขสัญญา — ${row.food_type_name}` : 'เพิ่มสัญญาราคาอาหาร'}
                open={editing !== null}
                onCancel={() => setEditing(null)}
                onOk={handleSave}
                confirmLoading={saving}
                okText={row ? 'บันทึกการแก้ไข' : 'เพิ่มสัญญา'}
                cancelText="ยกเลิก"
                destroyOnHidden
            >
                <Form form={form} layout="vertical" className="mt-4" initialValues={initialValues}>
                    <Form.Item
                        label="ประเภทอาหาร"
                        name="food_type_id"
                        rules={[{ required: true, message: 'กรุณาเลือกประเภท' }]}
                    >
                        <Select
                            options={billableTypes.map(t => ({ label: t.food_type_name, value: t.food_type_id }))}
                            placeholder="เลือกประเภทอาหาร"
                        />
                    </Form.Item>

                    <Form.Item
                        label="ช่วงสัญญา"
                        name="period"
                        rules={[{
                            validator: (_, v) => v?.[0]
                                ? Promise.resolve()
                                : Promise.reject(new Error('กรุณาเลือกวันที่เริ่มสัญญา')),
                        }]}
                        extra="เว้นวันสิ้นสุดไว้ได้ถ้ายังไม่กำหนด — แต่จะเพิ่มสัญญาถัดไปไม่ได้จนกว่าจะระบุ"
                    >
                        <RangePicker
                            format="DD/MM/BBBB"
                            className="w-full"
                            allowEmpty={[false, true]}
                            placeholder={['ตั้งแต่วันที่', 'ถึงวันที่ (ถ้ามี)']}
                        />
                    </Form.Item>

                    <Form.Item
                        label="ราคาต่อวัน (บาท)"
                        name="price_per_day"
                        rules={[{ required: true, message: 'กรุณากรอกราคา' }]}
                    >
                        {/* หน่วยใช้ suffix ไม่ใช่ addonAfter เพราะ antd v6 เลิกใช้ addon แล้ว */}
                        <InputNumber min={0} max={100000} step={1} precision={2} className="w-full!" suffix="บาท/วัน" />
                    </Form.Item>

                    <Form.Item
                        label="จำนวนมื้อที่ถือว่าครบหนึ่งวัน"
                        name="meals_per_day"
                        rules={[{ required: true, message: 'กรุณากรอกจำนวนมื้อ' }]}
                    >
                        <InputNumber min={1} max={6} className="w-full!" suffix="มื้อ" />
                    </Form.Item>

                    {/*
                      สัญญาต้องมีเจ้าของเสมอ ถ้าไม่ระบุ แถวนั้นจะไม่ปรากฏในหน้าของบริษัทใดเลย
                      แล้วมื้อในช่วงนั้นจะกลายเป็น "ยังไม่มีราคา" ทั้งที่ตั้งราคาไว้แล้ว
                    */}
                    <Form.Item
                        label="บริษัทคู่สัญญา"
                        name="vendor_id"
                        rules={[{ required: true, message: 'กรุณาเลือกบริษัทคู่สัญญา' }]}
                        extra={vendors.length === 0
                            ? 'ยังไม่มีบริษัทในระบบ เพิ่มได้ที่เมนูผู้ดูแลระบบ → บัญชีบริษัทผู้รับจ้างทำอาหาร'
                            : undefined}
                    >
                        <Select
                            placeholder="เลือกบริษัท"
                            options={vendors.map(v => ({ label: v.vendor_name, value: v.vendor_id }))}
                            disabled={vendors.length === 0}
                        />
                    </Form.Item>

                    <Form.Item label="เลขที่สัญญา / ประกวดราคา" name="contract_note">
                        <Input maxLength={255} placeholder="เช่น สัญญาเลขที่ 12/2569" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
