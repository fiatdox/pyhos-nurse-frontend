'use client';

import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Typography, Transfer, Table, Tag, Alert } from 'antd';
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

/**
 * บุคลากรที่เลือกได้ มาจาก core_kon.users โดยตรง ไม่ใช่ตาราง staffs ที่พิมพ์ชื่อเข้าไปเอง
 * กรองด้วยตำแหน่งที่จับคู่ไว้ในหน้า /ipd/positions ชื่อจึงตรงกับทะเบียนบุคลากรจริงเสมอ
 */
interface EligibleStaff {
    user_id: number;
    fullname: string;
    position_name: string;
    major_id: number | null;
    major_name: string;
    group_code: string | null;
}

interface Major {
    major_id: number;
    name: string;
    user_count: number;
}

interface StaffTransferItem extends TransferItem {
    key: string;
    title: string;
    groupCode: string | null;
    majorName: string;
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
        render: (title: string, item) => (
            <div className="flex items-center gap-2 min-w-0">
                <span className="truncate">{title}</span>
                {item.groupCode && (
                    <Tag color="cyan" className="m-0 text-[10px] shrink-0">{item.groupCode}</Tag>
                )}
            </div>
        ),
    },
];

const filterOption = (input: string, item: StaffTransferItem): boolean =>
    item.title?.includes(input) ?? false;

export default function WardStaffPage() {
    const [wards, setWards] = useState<Ward[]>([]);
    const [staffList, setStaffList] = useState<EligibleStaff[]>([]);
    const [majors, setMajors] = useState<Major[]>([]);
    // กรองด้วยกลุ่มงาน เพราะตำแหน่งพยาบาลวิชาชีพอย่างเดียวมี 429 คน
    // ถ้าไม่กรอง รายการฝั่งซ้ายจะยาวจนหาคนไม่เจอ
    const [selectedMajor, setSelectedMajor] = useState<number | null>(null);
    const [noMapping, setNoMapping] = useState(false);
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

                const [wardRes, majorRes] = await Promise.all([
                    axios.get('/api/v1/system/wardsV1', { headers }).catch(() => ({ data: { data: [] } })),
                    axios.get('/api/v1/positions/majors', { headers }).catch(() => ({ data: { data: [] } })),
                ]);

                const fetchedWards = Array.isArray(wardRes.data) ? wardRes.data : wardRes.data.data || [];
                setWards(fetchedWards);
                setMajors(majorRes.data?.data ?? []);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    /**
     * รายชื่อที่เลือกได้ ดึงใหม่ทุกครั้งที่เปลี่ยนกลุ่มงาน
     * ไม่ดึงมาทั้งหมดแล้วกรองฝั่งเบราว์เซอร์ เพราะทั้งโรงพยาบาลมีบุคลากรพันกว่าคน
     */
    useEffect(() => {
        const fetchEligible = async () => {
            setLoading(true);
            try {
                const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const res = await axios.get('/api/v1/positions/eligible-staff', {
                    headers,
                    params: selectedMajor ? { major_id: String(selectedMajor) } : {},
                });
                setStaffList(res.data?.data ?? []);
                // ยังไม่ได้จับคู่ตำแหน่งไว้เลย ต้องบอกให้ไปตั้งค่าก่อน ไม่ใช่ปล่อยหน้าว่างเฉยๆ
                setNoMapping(Boolean(res.data?.message));
            } catch (error) {
                console.error('Error fetching eligible staff:', error);
                setStaffList([]);
            } finally {
                setLoading(false);
            }
        };
        fetchEligible();
    }, [selectedMajor]);

    const handleSave = async () => {
        if (!selectedWard) {
            Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณาเลือกหอผู้ป่วยก่อนบันทึก', timer: 2000, showConfirmButton: false });
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

            // ส่ง user_id ของ core_kon ให้เซิร์ฟเวอร์ไปสร้าง/อัปเดตแถวใน staffs เอง
            // ชื่อกับกลุ่มตำแหน่งจึงมาจากทะเบียนบุคลากรจริง ไม่ใช่ค่าที่หน้าจอส่งไป
            const payload = (targetKeys ?? []).map(userId => ({
                user_id: Number(userId),
                ward: selectedWard
            }));

            await axios.post('/api/v1/staffs/ward-staffs', payload, { headers });

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
            await axios.delete(`/api/v1/staffs/ward-staffs-clear/${selectedWard}`, { headers });

            setTargetKeys([]);

            Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'นำเจ้าหน้าที่ทั้งหมดออกจากตึกเรียบร้อยแล้ว', timer: 2000, showConfirmButton: false });
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

            const response = await axios.get(`/api/v1/staffs/ward-staffs/${value}`, { headers });
            const resData = Array.isArray(response.data) ? response.data : response.data?.data || [];
            // คีย์เป็น user_id เพราะรายการฝั่งซ้ายมาจาก core_kon.users
            // แถวเก่าที่ยังไม่มี user_id (พิมพ์ชื่อเข้ามาเอง) ติ๊กกลับไม่ได้ ต้องเลือกใหม่
            const assigned = resData.filter((s: any) => s.user_id !== null && s.user_id !== undefined);
            setTargetKeys(assigned.map((s: any) => String(s.user_id)));

            const legacy = resData.length - assigned.length;
            if (legacy > 0) {
                Swal.fire({
                    icon: 'info',
                    title: 'มีรายชื่อแบบเก่า',
                    text: `หอผู้ป่วยนี้มีเจ้าหน้าที่ ${legacy} คนที่บันทึกไว้ก่อนเปลี่ยนมาใช้ทะเบียนบุคลากร จึงยังไม่ผูกกับบัญชีจริง กรุณาเลือกใหม่จากรายการแล้วบันทึกทับ`,
                    confirmButtonColor: '#006b5f',
                });
            }

            // คนที่ถูกเลือกไว้แล้วแต่ไม่อยู่ในกลุ่มงานที่กรองอยู่ ต้องเติมเข้ารายการ
            // ไม่งั้นกดบันทึกแล้วคนกลุ่มงานอื่นจะหลุดออกจากหอผู้ป่วยโดยไม่ตั้งใจ
            const missing = assigned.filter((rs: any) =>
                !staffList.some(s => String(s.user_id) === String(rs.user_id))
            );
            if (missing.length > 0) {
                setStaffList(prev => [...prev, ...missing.map((m: any) => ({
                    user_id: Number(m.user_id),
                    fullname: m.fullname,
                    position_name: m.position_name ?? '',
                    major_id: null,
                    major_name: '',
                    group_code: m.group_code ?? null,
                }))]);
            }
        } catch (error) {
            console.error("Error fetching assigned staff:", error);
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถดึงข้อมูลเจ้าหน้าที่ประจำตึกได้', timer: 2500, showConfirmButton: false });
            setTargetKeys([]);
        } finally {
            setLoading(false);
        }
    };

    const transferDataSource: StaffTransferItem[] = staffList.map(staff => ({
        key: String(staff.user_id),
        title: staff.fullname,
        groupCode: staff.group_code,
        majorName: staff.major_name,
    }));

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-7xl mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <Title level={4} className="text-[var(--brand-text)]! mb-6! flex items-center gap-2">
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

                        {noMapping && (
                            <Alert
                                type="warning"
                                showIcon
                                className="mb-4"
                                message="ยังไม่ได้จับคู่ตำแหน่ง"
                                description={
                                    <span>
                                        รายชื่อเจ้าหน้าที่มาจากตำแหน่งที่จับคู่ไว้ในหน้า{' '}
                                        <a href="/ipd/positions" className="font-semibold underline">จัดการตำแหน่งบุคลากร</a>{' '}
                                        กรุณาจับคู่ตำแหน่งก่อน จึงจะมีรายชื่อให้เลือก
                                    </span>
                                }
                            />
                        )}

                        {selectedWard ? (
                            <div className="mb-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                                    <Text className="font-semibold text-gray-700">2. จัดการรายชื่อเจ้าหน้าที่ประจำตึก</Text>
                                    <div className="sm:ml-auto flex items-center gap-2">
                                        <Text className="text-gray-500 text-sm whitespace-nowrap">กลุ่มงาน:</Text>
                                        <Select
                                            allowClear
                                            showSearch
                                            optionFilterProp="children"
                                            placeholder="ทุกกลุ่มงาน"
                                            style={{ minWidth: 260 }}
                                            value={selectedMajor}
                                            onChange={(v) => setSelectedMajor(v ?? null)}
                                        >
                                            {majors.map(m => (
                                                <Option key={m.major_id} value={m.major_id}>
                                                    {m.name} ({m.user_count})
                                                </Option>
                                            ))}
                                        </Select>
                                    </div>
                                </div>
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
                                        <span key="assigned" className="font-bold text-[var(--brand-text)]">ประจำตึกนี้</span>
                                    ]}
                                    locale={{ searchPlaceholder: 'ค้นหาชื่อ...' }}
                                />
                                <p className="text-xs text-gray-400 mt-2 mb-0">
                                    รายชื่อมาจากทะเบียนบุคลากร เฉพาะตำแหน่งที่จับคู่ไว้ในหน้าจัดการตำแหน่ง
                                    ป้ายหลังชื่อคือกลุ่มที่ใช้อ้างอิงอัตราค่าตอบแทน
                                </p>
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