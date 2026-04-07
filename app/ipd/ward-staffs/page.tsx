'use client';

import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Typography, message, Transfer, Table } from 'antd';
import type { GetProp, TableColumnsType, TableProps, TransferProps } from 'antd';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import { VscSave, VscOrganization, VscTrash } from 'react-icons/vsc';
import Swal from 'sweetalert2';

const { Title, Text } = Typography;
const { Option } = Select;

type TransferItem = GetProp<TransferProps, 'dataSource'>[number];
type TableRowSelection<T extends object> = TableProps<T>['rowSelection'];

interface Ward {
    ward: number;
    ward_name: string;
    his_code: string;
}

interface Staff {
    staff_id: number;
    fullname: string;
}

interface StaffTransferItem extends TransferItem {
    key: string;
    title: string;
}

interface TableTransferProps extends TransferProps<TransferItem> {
    dataSource: StaffTransferItem[];
    leftColumns: TableColumnsType<StaffTransferItem>;
    rightColumns: TableColumnsType<StaffTransferItem>;
}

const TableTransfer: React.FC<TableTransferProps> = (props) => {
    const { leftColumns, rightColumns, ...restProps } = props;
    return (
        <Transfer style={{ width: '100%' }} {...restProps}>
            {({
                direction,
                filteredItems,
                onItemSelect,
                onItemSelectAll,
                selectedKeys: listSelectedKeys,
                disabled: listDisabled,
            }) => {
                const columns = direction === 'left' ? leftColumns : rightColumns;
                const rowSelection: TableRowSelection<TransferItem> = {
                    getCheckboxProps: () => ({ disabled: listDisabled }),
                    onChange(selectedRowKeys) {
                        onItemSelectAll(selectedRowKeys, 'replace');
                    },
                    selectedRowKeys: listSelectedKeys,
                    selections: [Table.SELECTION_ALL, Table.SELECTION_INVERT, Table.SELECTION_NONE],
                };
                return (
                    <Table
                        rowSelection={rowSelection}
                        columns={columns}
                        dataSource={filteredItems as StaffTransferItem[]}
                        size="small"
                        style={{ pointerEvents: listDisabled ? 'none' : undefined }}
                        pagination={{ pageSize: 7, showSizeChanger: false }}
                        onRow={({ key, disabled: itemDisabled }) => ({
                            onClick: () => {
                                if (itemDisabled || listDisabled) return;
                                onItemSelect(key, !listSelectedKeys.includes(key));
                            },
                        })}
                    />
                );
            }}
        </Transfer>
    );
};

const columns: TableColumnsType<StaffTransferItem> = [
    {
        dataIndex: 'title',
        title: 'ชื่อ-นามสกุล',
    },
];

const filterOption = (input: string, item: StaffTransferItem): boolean =>
    item.title?.includes(input) ?? false;

export default function WardStaffPage() {
    const [wards, setWards] = useState<Ward[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedWard, setSelectedWard] = useState<string | null>(null);
    const [targetKeys, setTargetKeys] = useState<TransferProps['targetKeys']>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                const [wardRes, staffRes] = await Promise.all([
                    axios.get('/api/v1/wardsV1', { headers }).catch(() => ({ data: { data: [] } })),
                    axios.get('/api/v1/staffs', { headers }).catch(() => ({ data: { data: [] } }))
                ]);

                const fetchedWards = Array.isArray(wardRes.data) ? wardRes.data : wardRes.data.data || [];
                setWards(fetchedWards);

                const fetchedStaff = Array.isArray(staffRes.data) ? staffRes.data : staffRes.data.data || [];
                if (fetchedStaff.length > 0) {
                    setStaffList(fetchedStaff);
                } else {
                    mockStaffData();
                }
            } catch (error) {
                console.error("Error fetching data:", error);
                mockStaffData();
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const mockStaffData = () => {
        setStaffList([
            { staff_id: 1, fullname: 'นางสาวสมหญิง จริงใจ' },
            { staff_id: 2, fullname: 'นายใจดี รักษา' },
            { staff_id: 3, fullname: 'นางสาวพยาบาล ทำงานดี' },
            { staff_id: 4, fullname: 'นายสมชาย มั่นคง' },
        ]);
    };

    const handleSave = async () => {
        if (!selectedWard) {
            message.warning('กรุณาเลือกหอผู้ป่วยก่อนบันทึก');
            return;
        }

        // เงื่อนไข: ถ้าไม่มีรายชื่อในฝั่งขวาเลย ให้แจ้งเตือนและยกเลิกการบันทึก
        if (!targetKeys || targetKeys.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'ไม่พบข้อมูล',
                text: 'ไม่พบข้อมูลเจ้าหน้าที่ในรายการ หากต้องการลบทั้งหมดให้ใช้ปุ่ม "นำเจ้าหน้าที่ทั้งหมดออกตึกนี้" แทน',
                confirmButtonColor: '#006b5f',
                confirmButtonText: 'ตกลง'
            });
            return;
        }

        const confirmResult = await Swal.fire({
            title: 'ยืนยันการบันทึก',
            text: 'คุณต้องการบันทึกข้อมูลเจ้าหน้าที่ประจำตึกใช่หรือไม่?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#006b5f',
            cancelButtonColor: '#d33',
            confirmButtonText: 'ใช่, บันทึกเลย',
            cancelButtonText: 'ยกเลิก'
        });

        if (!confirmResult.isConfirmed) return;

        setSaving(true);
        try {
            const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const payload = (targetKeys ?? []).map(staffId => ({
                staff_id: Number(staffId),
                ward: selectedWard
            }));

            await axios.post('/api/v1/ward-staffs', payload, { headers });

            Swal.fire({
                icon: 'success',
                title: 'บันทึกข้อมูลสำเร็จ',
                text: 'ระบบได้อัปเดตรายชื่อเจ้าหน้าที่ประจำตึกเรียบร้อยแล้ว',
                confirmButtonColor: '#006b5f',
                confirmButtonText: 'ตกลง'
            });
        } catch (error) {
            console.error("Error saving data:", error);

            // ดึงข้อความแจ้งเตือนจาก Backend เพื่อให้รู้สาเหตุที่แท้จริง
            const backendErrorMsg = (error as any).response?.data?.message || (error as any).response?.data?.error || 'ไม่สามารถบันทึกข้อมูลได้ โปรดลองอีกครั้ง';

            Swal.fire({
                icon: 'error',
                title: `บันทึกไม่สำเร็จ (${(error as any).response?.status || 'Error'})`,
                text: backendErrorMsg,
                confirmButtonColor: '#006b5f',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleClearAllStaff = async () => {
        if (!selectedWard) return;

        const confirmResult = await Swal.fire({
            title: 'ยืนยันการลบข้อมูล',
            text: 'คุณกำลังจะเอาเจ้าหน้าที่ทั้งหมดออกจากหอผู้ป่วยนี้ ยืนยันหรือไม่?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'ใช่, เอาออกทั้งหมด',
            cancelButtonText: 'ยกเลิก'
        });

        if (!confirmResult.isConfirmed) return;

        setSaving(true);
        try {
            const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            // เรียก API DELETE เพื่อลบข้อมูลเจ้าหน้าที่ทั้งหมดของตึกนี้
            await axios.delete(`/api/v1/ward-staffs-clear/${selectedWard}`, { headers });

            setTargetKeys([]); // ล้างรายการบน UI

            message.success('นำเจ้าหน้าที่ทั้งหมดออกจากตึกเรียบร้อยแล้ว');
        } catch (error) {
            console.error("Error clearing data:", error);

            const backendErrorMsg = (error as any).response?.data?.message || (error as any).response?.data?.error || 'ไม่สามารถลบข้อมูลได้ โปรดลองอีกครั้ง';

            Swal.fire({
                icon: 'error',
                title: `ลบข้อมูลไม่สำเร็จ (${(error as any).response?.status || 'Error'})`,
                text: backendErrorMsg,
                confirmButtonColor: '#006b5f',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleWardChange = async (value: string) => {
        setSelectedWard(value);
        setLoading(true);
        try {
            const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
            const headers = token ? { Authorization: `Bearer ${token}` } : {};

            const response = await axios.get(`/api/v1/ward-staffs/${value}`, { headers });
            const resData = Array.isArray(response.data) ? response.data : response.data?.data || [];
            const assignedStaffIds = resData.map((staff: any) => String(staff.staff_id));
            setTargetKeys(assignedStaffIds);

            const missingStaffs = resData.filter((rs: any) =>
                !staffList.some((s: any) => String(s.staff_id) === String(rs.staff_id))
            );
            if (missingStaffs.length > 0) {
                setStaffList(prev => [...prev, ...missingStaffs]);
            }
        } catch (error) {
            console.error("Error fetching assigned staff:", error);
            message.error('ไม่สามารถดึงข้อมูลเจ้าหน้าที่ประจำตึกได้');
            setTargetKeys([]);
        } finally {
            setLoading(false);
        }
    };

    const transferDataSource: StaffTransferItem[] = staffList.map(staff => ({
        key: String(staff.staff_id),
        title: staff.fullname,
    }));

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-7xl mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <Title level={4} className="text-[#006b5f]! mb-6! flex items-center gap-2">
                        <VscOrganization className="w-6 h-6" />
                        ตั้งค่าเจ้าหน้าที่ประจำหอผู้ป่วย
                    </Title>

                    <div className="bg-teal-50 p-6 rounded-xl border border-teal-100">
                        <div className="mb-6">
                            <Text className="font-semibold text-gray-700 block mb-2">1. เลือกหอผู้ป่วย (Ward)</Text>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Select
                                    size="large"
                                    placeholder="ระบุหอผู้ป่วย"
                                    className="w-full sm:w-1/2"
                                    showSearch
                                    optionFilterProp="children"
                                    loading={loading}
                                    value={selectedWard}
                                    onChange={handleWardChange}
                                >
                                    {wards.map(w => <Option key={w.his_code} value={w.his_code}>{w.ward_name}</Option>)}
                                </Select>
                                {selectedWard && (
                                    <Button 
                                        size="large" 
                                        danger 
                                        icon={<VscTrash />} 
                                        onClick={handleClearAllStaff}
                                        loading={saving}
                                    >
                                        นำเจ้าหน้าที่ทั้งหมดออกตึกนี้
                                    </Button>
                                )}
                            </div>
                        </div>

                        {selectedWard ? (
                            <div className="mb-4">
                                <Text className="font-semibold text-gray-700 block mb-2">2. จัดการรายชื่อเจ้าหน้าที่ประจำตึก</Text>
                                <TableTransfer
                                    dataSource={transferDataSource}
                                    targetKeys={targetKeys}
                                    showSearch
                                    showSelectAll={false}
                                    onChange={(nextTargetKeys) => setTargetKeys(nextTargetKeys)}
                                    filterOption={filterOption}
                                    leftColumns={columns}
                                    rightColumns={columns}
                                    styles={{ list: { flex: 1, minHeight: '450px' } }}
                                    className="
                                        [&_.ant-transfer-list]:bg-white 
                                        [&_.ant-transfer-list]:border-teal-100 
                                        [&_.ant-transfer-list]:rounded-2xl 
                                        [&_.ant-transfer-list-header]:bg-teal-50/40 
                                        [&_.ant-transfer-operation_.ant-btn-primary]:bg-[#006b5f] 
                                        [&_.ant-transfer-operation_.ant-btn-primary]:border-none 
                                        hover:[&_.ant-transfer-operation_.ant-btn-primary]:bg-[#004e45]
                                    "
                                    titles={[
                                        <span key="all" className="font-semibold text-gray-600">รายชื่อทั้งหมด</span>,
                                        <span key="assigned" className="font-bold text-[#006b5f]">ประจำตึกนี้</span>
                                    ]}
                                    locale={{ searchPlaceholder: 'ค้นหาชื่อ...' }}
                                />
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                                กรุณาเลือกหอผู้ป่วยด้านบน เพื่อเริ่มจัดการรายชื่อเจ้าหน้าที่
                            </div>
                        )}

                        <div className="flex justify-end mt-8 pt-6 border-t border-teal-200">
                            <Button
                                size="large"
                                type="primary"
                                onClick={handleSave}
                                className="bg-[#006b5f]"
                                icon={<VscSave />}
                                loading={saving}
                                disabled={!selectedWard}
                            >
                                บันทึกข้อมูล
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}