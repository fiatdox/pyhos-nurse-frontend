'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Card, Button, Typography, Table, Tag, Alert, Spin, Select, Modal, Form, Input, DatePicker, Space,
} from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import Navbar from '../../components/Navbar';
import { VscAdd, VscEdit, VscTrash, VscHistory } from 'react-icons/vsc';
import { PiCalendarXBold } from 'react-icons/pi';
import Swal from 'sweetalert2';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Holiday {
    id: number;
    holiday_date: string;
    name_th: string;
    holiday_type: string;
    note: string | null;
    is_active: boolean;
}

const TYPE_META: Record<string, { label: string; color: string; hint: string }> = {
    public: { label: 'วันหยุดราชการ', color: 'green', hint: 'วันหยุดประจำปีตามปฏิทินราชการ' },
    substitution: { label: 'วันหยุดชดเชย', color: 'blue', hint: 'ชดเชยวันหยุดที่ตรงกับเสาร์–อาทิตย์' },
    special: { label: 'มติ ครม.', color: 'purple', hint: 'วันหยุดพิเศษที่ประกาศเป็นครั้งคราว' },
    organization: { label: 'เฉพาะโรงพยาบาล', color: 'orange', hint: 'วันหยุดที่โรงพยาบาลกำหนดเอง' },
};

export default function HolidayPage() {
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [years, setYears] = useState<number[]>([]);
    const [year, setYear] = useState<number>(dayjs().year());
    const [showInactive, setShowInactive] = useState(false);
    const [canManage, setCanManage] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState<Holiday | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm();

    const authHeaders = () => {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const fetchHolidays = useCallback(async (y: number, withInactive: boolean) => {
        setLoading(true);
        try {
            const [listRes, yearRes] = await Promise.all([
                axios.get('/api/v1/holidays/', {
                    headers: authHeaders(),
                    params: { year: y, include_inactive: withInactive ? 'true' : undefined },
                }),
                axios.get('/api/v1/holidays/years', { headers: authHeaders() }).catch(() => ({ data: { data: [] } })),
            ]);
            setHolidays(listRes.data?.data ?? []);
            // เซิร์ฟเวอร์เป็นคนบอกว่าแก้ได้ไหม ไม่ได้เดาจากฝั่งหน้าจอ
            setCanManage(listRes.data?.can_manage === true);
            setYears(yearRes.data?.data ?? []);
        } catch (error) {
            console.error('Error fetching holidays:', error);
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถดึงข้อมูลวันหยุดได้', confirmButtonColor: '#006b5f' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchHolidays(year, showInactive); }, [fetchHolidays, year, showInactive]);

    /*
      ตั้งค่าเริ่มต้นผ่าน initialValues ไม่ใช่ setFieldsValue ตอนกดปุ่ม
      เพราะ Modal ใช้ destroyOnHidden — ตอนกดปุ่ม Form ยังไม่ถูกวาด
      การสั่ง form ตอนนั้นจึงสั่งใส่อากาศ และ antd จะเตือนว่า useForm ไม่ได้ต่อกับ Form ไหน
      พอ Modal ถูกทำลายทุกครั้งที่ปิด Form จึงอ่าน initialValues ใหม่ทุกรอบที่เปิด
    */
    const openCreate = () => {
        setEditing(null);
        setModalOpen(true);
    };

    const openEdit = (row: Holiday) => {
        setEditing(row);
        setModalOpen(true);
    };

    const initialValues = editing
        ? {
            holiday_date: dayjs(editing.holiday_date),
            name_th: editing.name_th,
            holiday_type: editing.holiday_type,
            note: editing.note ?? '',
        }
        : { holiday_type: 'public' };

    const handleSubmit = async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
            const payload = {
                // ส่งเป็นวันที่ล้วน ไม่มีเวลา ไม่งั้นวันจะเลื่อนตาม timezone ตอนแปลง
                holiday_date: dayjs(values.holiday_date).format('YYYY-MM-DD'),
                name_th: values.name_th,
                holiday_type: values.holiday_type,
                note: values.note || null,
            };
            if (editing) {
                await axios.put(`/api/v1/holidays/${editing.id}`, payload, { headers: authHeaders() });
            } else {
                await axios.post('/api/v1/holidays/', payload, { headers: authHeaders() });
            }
            setModalOpen(false);
            await fetchHolidays(dayjs(values.holiday_date).year(), showInactive);
            setYear(dayjs(values.holiday_date).year());
            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1600, showConfirmButton: false });
        } catch (error) {
            const msg = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
            if (msg) Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: msg, confirmButtonColor: '#006b5f' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (row: Holiday) => {
        const confirm = await Swal.fire({
            title: 'ยืนยันการยกเลิกวันหยุด',
            html: `<b>${row.name_th}</b><br/>${dayjs(row.holiday_date).format('D MMMM BBBB')}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'ใช่, ยกเลิกวันหยุดนี้',
            cancelButtonText: 'ไม่',
        });
        if (!confirm.isConfirmed) return;

        try {
            await axios.delete(`/api/v1/holidays/${row.id}`, { headers: authHeaders() });
            await fetchHolidays(year, showInactive);
            Swal.fire({ icon: 'success', title: 'ยกเลิกเรียบร้อยแล้ว', timer: 1600, showConfirmButton: false });
        } catch (error) {
            const msg = (error as { response?: { data?: { message?: string } } }).response?.data?.message
                ?? 'ยกเลิกไม่สำเร็จ';
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: msg, confirmButtonColor: '#006b5f' });
        }
    };

    const handleRestore = async (row: Holiday) => {
        try {
            await axios.put(`/api/v1/holidays/restore/${row.id}`, {}, { headers: authHeaders() });
            await fetchHolidays(year, showInactive);
            Swal.fire({ icon: 'success', title: 'เปิดใช้งานแล้ว', timer: 1600, showConfirmButton: false });
        } catch (error) {
            const msg = (error as { response?: { data?: { message?: string } } }).response?.data?.message
                ?? 'เปิดใช้งานไม่สำเร็จ';
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: msg, confirmButtonColor: '#006b5f' });
        }
    };

    const columns: TableColumnsType<Holiday> = [
        {
            title: 'วันที่',
            dataIndex: 'holiday_date',
            width: 200,
            render: (d: string, row) => (
                <div className={row.is_active ? '' : 'opacity-50 line-through'}>
                    <div className="font-semibold">{dayjs(d).format('D MMMM BBBB')}</div>
                    <div className="text-xs text-gray-400">{dayjs(d).format('dddd')}</div>
                </div>
            ),
        },
        {
            title: 'ชื่อวันหยุด',
            dataIndex: 'name_th',
            render: (n: string, row) => (
                <span className={row.is_active ? '' : 'opacity-50 line-through'}>{n}</span>
            ),
        },
        {
            title: 'ประเภท',
            dataIndex: 'holiday_type',
            width: 170,
            filters: Object.entries(TYPE_META).map(([value, m]) => ({ text: m.label, value })),
            onFilter: (v, row) => row.holiday_type === v,
            render: (t: string) => {
                const m = TYPE_META[t];
                return <Tag color={m?.color ?? 'default'} className="m-0">{m?.label ?? t}</Tag>;
            },
        },
        { title: 'หมายเหตุ', dataIndex: 'note', render: (n: string | null) => n || <span className="text-gray-300">—</span> },
        ...(canManage ? [{
            title: 'จัดการ',
            key: 'actions',
            width: 150,
            align: 'center' as const,
            render: (_: unknown, row: Holiday) => (
                <Space size={4}>
                    <Button size="small" icon={<VscEdit />} onClick={() => openEdit(row)}>แก้ไข</Button>
                    {row.is_active ? (
                        <Button size="small" danger icon={<VscTrash />} onClick={() => handleDeactivate(row)} />
                    ) : (
                        <Button size="small" icon={<VscHistory />} onClick={() => handleRestore(row)} />
                    )}
                </Space>
            ),
        }] : []),
    ];

    // ปีที่เลือกได้ = ปีที่มีข้อมูลแล้ว + ปีนี้และปีหน้า เผื่อกรอกล่วงหน้า
    const yearOptions = Array.from(
        new Set([...years, dayjs().year(), dayjs().year() + 1])
    ).sort((a, b) => b - a);

    const activeCount = holidays.filter(h => h.is_active).length;

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-7xl mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <Title level={4} className="text-[var(--brand-text)]! mb-1! flex items-center gap-2">
                        <PiCalendarXBold className="w-6 h-6" />
                        จัดการวันหยุด
                    </Title>
                    <Text className="text-gray-500 text-sm block mb-6">
                        วันหยุดที่ประกาศเป็นรายวัน ใช้ร่วมกันทั้งองค์กร —
                        ไม่ต้องกรอกวันเสาร์–อาทิตย์ ระบบรู้เองจากปฏิทิน
                    </Text>

                    {!canManage && !loading && (
                        <Alert
                            type="info"
                            showIcon
                            className="mb-4"
                            title="ดูได้อย่างเดียว"
                            description="การเพิ่มหรือแก้ไขวันหยุดทำได้เฉพาะผู้ดูแลระบบ เพราะเป็นข้อมูลกลางที่ระบบอื่นใช้ร่วมกัน"
                        />
                    )}

                    <div className="bg-teal-50 p-6 rounded-xl border border-teal-100">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <Text className="font-semibold text-gray-700">ปี พ.ศ.</Text>
                            <Select
                                size="large"
                                className="w-40"
                                value={year}
                                onChange={setYear}
                                options={yearOptions.map(y => ({ value: y, label: String(y + 543) }))}
                            />
                            <Tag color={activeCount > 0 ? 'green' : 'default'} className="m-0 py-1 px-2">
                                {activeCount} วัน
                            </Tag>
                            <Button
                                type={showInactive ? 'primary' : 'default'}
                                onClick={() => setShowInactive(v => !v)}
                            >
                                {showInactive ? 'ซ่อนรายการที่ยกเลิก' : 'แสดงรายการที่ยกเลิก'}
                            </Button>
                            {canManage && (
                                <Button
                                    type="primary"
                                    icon={<VscAdd />}
                                    className="bg-[#006b5f] ml-auto"
                                    onClick={openCreate}
                                >
                                    เพิ่มวันหยุด
                                </Button>
                            )}
                        </div>

                        <Spin spinning={loading}>
                            <Table<Holiday>
                                columns={columns}
                                dataSource={holidays}
                                size="small"
                                rowKey="id"
                                pagination={false}
                                locale={{ emptyText: `ยังไม่มีวันหยุดของปี ${year + 543}` }}
                                className="
                                    [&_.ant-table]:rounded-xl
                                    [&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]!
                                    [&_.ant-table-thead_.ant-table-cell]:text-white!
                                    [&_.ant-table-thead_.ant-table-cell]:font-semibold!
                                "
                            />
                        </Spin>

                        <p className="text-xs text-gray-400 mt-3 mb-0">
                            วันหยุดทางจันทรคติ (มาฆบูชา วิสาขบูชา อาสาฬหบูชา เข้าพรรษา) เปลี่ยนวันทุกปี
                            ต้องกรอกรายปี คำนวณล่วงหน้าไม่ได้ ·
                            รายการที่ยกเลิกจะไม่ถูกลบทิ้ง เพื่อให้ตารางเวรที่จัดไปแล้วตามรอยได้
                        </p>
                    </div>
                </Card>
            </div>

            <Modal
                title={editing ? 'แก้ไขวันหยุด' : 'เพิ่มวันหยุด'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={handleSubmit}
                okText="บันทึก"
                cancelText="ยกเลิก"
                confirmLoading={saving}
                okButtonProps={{ className: 'bg-[#006b5f]' }}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" className="mt-4" initialValues={initialValues}>
                    <Form.Item
                        label="วันที่"
                        name="holiday_date"
                        rules={[{ required: true, message: 'กรุณาเลือกวันที่' }]}
                    >
                        <DatePicker
                            className="w-full"
                            format="D MMMM BBBB"
                            placeholder="เลือกวันที่"
                            allowClear={false}
                        />
                    </Form.Item>
                    <Form.Item
                        label="ชื่อวันหยุด"
                        name="name_th"
                        rules={[{ required: true, message: 'กรุณาระบุชื่อวันหยุด' }]}
                    >
                        <Input placeholder="เช่น วันขึ้นปีใหม่" maxLength={200} />
                    </Form.Item>
                    <Form.Item
                        label="ประเภท"
                        name="holiday_type"
                        rules={[{ required: true, message: 'กรุณาเลือกประเภท' }]}
                    >
                        <Select
                            options={Object.entries(TYPE_META).map(([value, m]) => ({
                                value,
                                label: `${m.label} — ${m.hint}`,
                            }))}
                        />
                    </Form.Item>
                    <Form.Item label="หมายเหตุ" name="note">
                        <TextArea rows={2} maxLength={300} placeholder="เลขที่ประกาศ หรือรายละเอียดเพิ่มเติม" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
