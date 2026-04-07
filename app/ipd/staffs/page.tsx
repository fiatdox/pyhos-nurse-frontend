'use client';

import { useState, useEffect } from 'react';
import {
    Card, Table, Button, Typography, Modal, Form, Input, Select, Tag, Space, Tooltip, Switch
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import Navbar from '@/app/components/Navbar';
import Swal from 'sweetalert2';
import { VscAdd, VscEdit, VscOrganization } from 'react-icons/vsc';
import { MdPersonOff, MdPersonAddAlt1 } from 'react-icons/md';

const { Title, Text } = Typography;

interface StaffPosition {
    staff_position_id: number;
    name: string;
}

interface Staff {
    staff_id: number;
    fullname: string;
    staff_position_id: number;
    position_name?: string;
    is_active: string;
}

const getToken = () =>
    document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];

const authHeaders = () => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function StaffsPage() {
    const [staffs, setStaffs] = useState<Staff[]>([]);
    const [positions, setPositions] = useState<StaffPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form] = Form.useForm();

    const fetchStaffs = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/v1/nurse/staffs', { headers: authHeaders() });
            const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
            setStaffs(data);
        } catch (error) {
            console.error('Error fetching staffs:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPositions = async () => {
        try {
            const res = await axios.get('/api/v1/nurse/staff-positions', { headers: authHeaders() });
            const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
            setPositions(data);
        } catch {
            // positions not critical, leave empty
        }
    };

    useEffect(() => {
        fetchStaffs();
        fetchPositions();
    }, []);

    const openAddModal = () => {
        setEditingStaff(null);
        form.resetFields();
        setModalOpen(true);
    };

    const openEditModal = (staff: Staff) => {
        setEditingStaff(staff);
        form.setFieldsValue({
            fullname: staff.fullname,
            staff_position_id: staff.staff_position_id,
        });
        setModalOpen(true);
    };

    const handleSubmit = async () => {
        const values = await form.validateFields();
        setSubmitting(true);
        try {
            if (editingStaff) {
                await axios.put(`/api/v1/nurse/staffs/${editingStaff.staff_id}`, values, {
                    headers: authHeaders(),
                });
                Swal.fire({
                    icon: 'success',
                    title: 'แก้ไขข้อมูลสำเร็จ',
                    confirmButtonColor: '#006b5f',
                    confirmButtonText: 'ตกลง',
                    timer: 1500,
                    showConfirmButton: false,
                });
            } else {
                await axios.post('/api/v1/nurse/staffs', values, { headers: authHeaders() });
                Swal.fire({
                    icon: 'success',
                    title: 'เพิ่มเจ้าหน้าที่สำเร็จ',
                    confirmButtonColor: '#006b5f',
                    confirmButtonText: 'ตกลง',
                    timer: 1500,
                    showConfirmButton: false,
                });
            }
            setModalOpen(false);
            fetchStaffs();
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.response?.data?.error || 'เกิดข้อผิดพลาด โปรดลองอีกครั้ง';
            Swal.fire({
                icon: 'error',
                title: 'ไม่สำเร็จ',
                text: msg,
                confirmButtonColor: '#006b5f',
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (staff: Staff) => {
        const isActive = staff.is_active === '1' || staff.is_active === 'true';
        const action = isActive ? 'deactivate' : 'activate';
        const label = isActive ? 'ระงับการใช้งาน' : 'เปิดใช้งาน';

        const confirm = await Swal.fire({
            title: `ยืนยันการ${label}`,
            text: `คุณต้องการ${label} "${staff.fullname}" ใช่หรือไม่?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: isActive ? '#d33' : '#006b5f',
            cancelButtonColor: '#6c757d',
            confirmButtonText: `ใช่, ${label}`,
            cancelButtonText: 'ยกเลิก',
        });
        if (!confirm.isConfirmed) return;

        try {
            await axios.patch(`/api/v1/nurse/staffs/${staff.staff_id}/${action}`, {}, {
                headers: authHeaders(),
            });
            fetchStaffs();
        } catch (error: any) {
            const msg = error?.response?.data?.message || 'เกิดข้อผิดพลาด โปรดลองอีกครั้ง';
            Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: msg, confirmButtonColor: '#006b5f' });
        }
    };

    const columns: ColumnsType<Staff> = [
        {
            title: '#',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_, __, index) => <Text className="text-gray-400">{index + 1}</Text>,
        },
        {
            title: 'ชื่อ-นามสกุล',
            dataIndex: 'fullname',
            key: 'fullname',
            render: (name: string) => <Text className="font-medium">{name}</Text>,
        },
        {
            title: 'ตำแหน่ง',
            key: 'position',
            render: (_, record) => {
                const pos = positions.find(p => p.staff_position_id === record.staff_position_id);
                return <Text className="text-gray-600">{pos?.name || record.position_name || `ID: ${record.staff_position_id}`}</Text>;
            },
        },
        {
            title: 'สถานะ',
            key: 'is_active',
            align: 'center',
            width: 120,
            render: (_, record) => {
                const active = record.is_active === '1' || record.is_active === 'true';
                return (
                    <Tag color={active ? 'green' : 'default'} className="rounded-full px-3">
                        {active ? 'ใช้งาน' : 'ระงับแล้ว'}
                    </Tag>
                );
            },
        },
        {
            title: 'จัดการ',
            key: 'action',
            align: 'center',
            width: 140,
            render: (_, record) => {
                const active = record.is_active === '1' || record.is_active === 'true';
                return (
                    <Space>
                        <Tooltip title="แก้ไขข้อมูล">
                            <Button
                                size="small"
                                icon={<VscEdit />}
                                onClick={() => openEditModal(record)}
                                className="border-teal-600 text-teal-700 hover:bg-teal-50"
                            />
                        </Tooltip>
                        <Switch
                            checked={active}
                            checkedChildren={<span className="flex items-center gap-1"><MdPersonAddAlt1 /> ใช้งาน</span>}
                            unCheckedChildren={<span className="flex items-center gap-1"><MdPersonOff /> ระงับ</span>}
                            onChange={() => handleToggleActive(record)}
                            style={{ backgroundColor: active ? '#006b5f' : undefined }}
                        />
                    </Space>
                );
            },
        },
    ];

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-5xl mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <div className="flex items-center justify-between mb-6">
                        <Title level={4} className="text-[#006b5f]! mb-0! flex items-center gap-2">
                            <VscOrganization className="w-6 h-6" />
                            จัดการเจ้าหน้าที่
                        </Title>
                        <Button
                            type="primary"
                            icon={<VscAdd />}
                            onClick={openAddModal}
                            className="bg-[#006b5f] border-none"
                            size="large"
                        >
                            เพิ่มเจ้าหน้าที่
                        </Button>
                    </div>

                    <Table
                        columns={columns}
                        dataSource={staffs}
                        rowKey="staff_id"
                        loading={loading}
                        pagination={{ pageSize: 15, showSizeChanger: false }}
                        className="[&_.ant-table-thead_th]:bg-teal-50 [&_.ant-table-thead_th]:text-gray-700"
                        rowClassName={(record) =>
                            record.is_active === '0' || record.is_active === 'false'
                                ? 'opacity-50'
                                : ''
                        }
                    />
                </Card>
            </div>

            <Modal
                title={
                    <span className="text-[#006b5f] font-semibold flex items-center gap-2">
                        <VscOrganization />
                        {editingStaff ? 'แก้ไขข้อมูลเจ้าหน้าที่' : 'เพิ่มเจ้าหน้าที่ใหม่'}
                    </span>
                }
                open={modalOpen}
                onCancel={() => { setModalOpen(false); form.resetFields(); }}
                onOk={handleSubmit}
                okText={editingStaff ? 'บันทึกการแก้ไข' : 'เพิ่มเจ้าหน้าที่'}
                cancelText="ยกเลิก"
                confirmLoading={submitting}
                okButtonProps={{ className: 'bg-[#006b5f] border-none' }}

            >
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item
                        name="fullname"
                        label="ชื่อ-นามสกุล"
                        rules={[{ required: true, message: 'กรุณากรอกชื่อ-นามสกุล' }]}
                    >
                        <Input placeholder="เช่น นางสาวสมหญิง ใจดี" size="large" />
                    </Form.Item>
                    <Form.Item
                        name="staff_position_id"
                        label="ตำแหน่ง"
                        rules={[{ required: true, message: 'กรุณาเลือกตำแหน่ง' }]}
                    >
                        <Select
                            placeholder="เลือกตำแหน่ง"
                            size="large"
                            showSearch
                            optionFilterProp="label"
                            options={positions.map(p => ({
                                value: p.staff_position_id,
                                label: p.name,
                            }))}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
