'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Select, Button, Typography, Transfer, Table, Tag, Tooltip } from 'antd';
import type { GetProp, TableColumnsType, TableProps, TransferProps } from 'antd';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import { VscSave, VscTrash } from 'react-icons/vsc';
import { PiIdentificationBadgeBold } from 'react-icons/pi';
import Swal from 'sweetalert2';

const { Title, Text } = Typography;
const { Option } = Select;

type TransferItem = GetProp<TransferProps, 'dataSource'>[number];
type TableRowSelection<T extends object> = TableProps<T>['rowSelection'];

interface StaffPosition {
    staff_position_id: number;
    position_name: string;
    code: string;
    mapped_count: number;
}

interface CorePosition {
    user_position_id: number;
    position_name: string;
    user_count: number;
    /** null = ยังไม่ถูกกลุ่มไหนจับคู่ */
    staff_position_id: number | null;
    group_code: string | null;
    group_name: string | null;
}

interface PositionTransferItem extends TransferItem {
    key: string;
    title: string;
    userCount: number;
    /** ถูกกลุ่มอื่นจองไว้แล้ว — ลากมาไม่ได้ */
    takenBy: string | null;
}

interface TableTransferProps extends TransferProps<TransferItem> {
    dataSource: PositionTransferItem[];
    leftColumns: TableColumnsType<PositionTransferItem>;
    rightColumns: TableColumnsType<PositionTransferItem>;
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
                    getCheckboxProps: (item) => ({
                        disabled: listDisabled || (item as PositionTransferItem).takenBy !== null,
                    }),
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
                        dataSource={filteredItems as PositionTransferItem[]}
                        size="small"
                        style={{ pointerEvents: listDisabled ? 'none' : undefined }}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        onRow={(item) => ({
                            onClick: () => {
                                if (listDisabled || item.takenBy) return;
                                onItemSelect(item.key, !listSelectedKeys.includes(item.key));
                            },
                        })}
                    />
                );
            }}
        </Transfer>
    );
};

const filterOption = (input: string, item: PositionTransferItem): boolean =>
    item.title?.includes(input) ?? false;

export default function PositionMappingPage() {
    const [groups, setGroups] = useState<StaffPosition[]>([]);
    const [corePositions, setCorePositions] = useState<CorePosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
    const [targetKeys, setTargetKeys] = useState<TransferProps['targetKeys']>([]);

    const authHeaders = () => {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const headers = authHeaders();
            const [groupRes, coreRes] = await Promise.all([
                axios.get('/api/v1/positions/', { headers }),
                axios.get('/api/v1/positions/core', { headers }),
            ]);
            setGroups(groupRes.data?.data ?? []);
            setCorePositions(coreRes.data?.data ?? []);
        } catch (error) {
            console.error('Error fetching positions:', error);
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถดึงข้อมูลตำแหน่งได้', confirmButtonColor: '#006b5f' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleGroupChange = async (value: number) => {
        setSelectedGroup(value);
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/positions/mappings/${value}`, { headers: authHeaders() });
            const rows = res.data?.data ?? [];
            setTargetKeys(rows.map((r: { user_position_id: number }) => String(r.user_position_id)));
        } catch (error) {
            console.error('Error fetching mappings:', error);
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถดึงตำแหน่งของกลุ่มนี้ได้', confirmButtonColor: '#006b5f' });
            setTargetKeys([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedGroup) return;

        const group = groups.find(g => g.staff_position_id === selectedGroup);
        const count = targetKeys?.length ?? 0;

        // รายการว่างคือ "เอาออกทั้งหมด" ซึ่งเป็นคำสั่งที่ตั้งใจได้ ไม่ใช่ความผิดพลาด
        // แต่ต้องถามให้ชัด เพราะกระทบการคิดค่าตอบแทนของทุกคนในกลุ่มนั้น
        const confirm = await Swal.fire({
            title: count === 0 ? 'ยืนยันการเอาออกทั้งหมด' : 'ยืนยันการบันทึก',
            text: count === 0
                ? `กลุ่ม ${group?.position_name} จะไม่เหลือตำแหน่งใดเลย และจะคิดค่าตอบแทนตามกลุ่มนี้ไม่ได้`
                : `บันทึก ${count} ตำแหน่ง เข้ากลุ่ม ${group?.position_name}`,
            icon: count === 0 ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonColor: count === 0 ? '#d33' : '#006b5f',
            cancelButtonColor: '#6c757d',
            confirmButtonText: count === 0 ? 'ใช่, เอาออกทั้งหมด' : 'ใช่, บันทึกเลย',
            cancelButtonText: 'ยกเลิก',
        });
        if (!confirm.isConfirmed) return;

        setSaving(true);
        try {
            await axios.post('/api/v1/positions/mappings', {
                staff_position_id: selectedGroup,
                user_position_ids: (targetKeys ?? []).map(Number),
            }, { headers: authHeaders() });

            // โหลดใหม่เพื่อให้ป้าย "จองแล้ว" ของกลุ่มอื่นตรงกับความจริง
            await fetchAll();
            Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1800, showConfirmButton: false });
        } catch (error) {
            const msg = (error as { response?: { data?: { message?: string } } }).response?.data?.message
                ?? 'ไม่สามารถบันทึกข้อมูลได้ โปรดลองอีกครั้ง';
            Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: msg, confirmButtonColor: '#006b5f' });
        } finally {
            setSaving(false);
        }
    };

    const handleClear = async () => {
        if (!selectedGroup) return;
        const group = groups.find(g => g.staff_position_id === selectedGroup);

        const confirm = await Swal.fire({
            title: 'ยืนยันการนำออก',
            text: `นำตำแหน่งทั้งหมดออกจากกลุ่ม ${group?.position_name}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'ใช่, นำออกทั้งหมด',
            cancelButtonText: 'ยกเลิก',
        });
        if (!confirm.isConfirmed) return;

        setSaving(true);
        try {
            await axios.delete(`/api/v1/positions/mappings-clear/${selectedGroup}`, { headers: authHeaders() });
            setTargetKeys([]);
            await fetchAll();
            Swal.fire({ icon: 'success', title: 'นำออกเรียบร้อยแล้ว', timer: 1800, showConfirmButton: false });
        } catch {
            Swal.fire({ icon: 'error', title: 'นำออกไม่สำเร็จ', confirmButtonColor: '#006b5f' });
        } finally {
            setSaving(false);
        }
    };

    /*
      ตำแหน่งที่กลุ่มอื่นจับคู่ไว้แล้วต้องเห็นได้แต่เลือกไม่ได้
      ตารางกลางกำหนดให้ตำแหน่งหนึ่งอยู่ได้กลุ่มเดียว เพราะถ้าอยู่สองกลุ่ม
      ระบบจะไม่รู้ว่าต้องใช้อัตราค่าตอบแทนของกลุ่มไหน
      ถ้าซ่อนไปเลยผู้ใช้จะงงว่าตำแหน่งหายไปไหน จึงแสดงพร้อมป้ายบอกว่าใครถืออยู่
    */
    const transferDataSource: PositionTransferItem[] = corePositions.map(p => ({
        key: String(p.user_position_id),
        title: p.position_name,
        userCount: p.user_count,
        takenBy:
            p.staff_position_id !== null && p.staff_position_id !== selectedGroup
                ? p.group_name
                : null,
    }));

    const columns: TableColumnsType<PositionTransferItem> = [
        {
            dataIndex: 'title',
            title: 'ตำแหน่ง',
            render: (title: string, item) => (
                <div className="flex items-center gap-2">
                    <span className={item.takenBy ? 'text-gray-400' : ''}>{title}</span>
                    {item.takenBy && (
                        <Tooltip title={`จับคู่ไว้กับกลุ่ม ${item.takenBy} แล้ว — ต้องเอาออกจากกลุ่มนั้นก่อน`}>
                            <Tag color="default" className="m-0 text-[10px]">{item.takenBy}</Tag>
                        </Tooltip>
                    )}
                </div>
            ),
        },
        {
            dataIndex: 'userCount',
            title: 'จำนวนคน',
            width: 90,
            align: 'right',
            sorter: (a, b) => a.userCount - b.userCount,
            render: (n: number) => (
                <span className={n === 0 ? 'text-gray-300' : 'font-medium text-gray-600'}>{n}</span>
            ),
        },
    ];

    const currentGroup = groups.find(g => g.staff_position_id === selectedGroup);

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-7xl mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <Title level={4} className="text-[var(--brand-text)]! mb-1! flex items-center gap-2">
                        <PiIdentificationBadgeBold className="w-6 h-6" />
                        จัดการตำแหน่งบุคลากร
                    </Title>
                    <Text className="text-gray-500 text-sm block mb-6">
                        จับคู่ตำแหน่งจากระบบบุคลากรเข้ากับกลุ่มของงานพยาบาล
                        เพื่อใช้อ้างอิงอัตราค่าตอบแทนตามเวรที่ขึ้น
                    </Text>

                    <div className="bg-teal-50 p-6 rounded-xl border border-teal-100">
                        <div className="mb-6">
                            <Text className="font-semibold text-gray-700 block mb-2">1. เลือกกลุ่มตำแหน่ง</Text>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Select
                                    size="large"
                                    placeholder="ระบุกลุ่มตำแหน่ง"
                                    className="w-full sm:w-1/2"
                                    loading={loading}
                                    value={selectedGroup}
                                    onChange={handleGroupChange}
                                >
                                    {groups.map(g => (
                                        <Option key={g.staff_position_id} value={g.staff_position_id}>
                                            {g.position_name} ({g.code}) — {g.mapped_count} ตำแหน่ง
                                        </Option>
                                    ))}
                                </Select>
                                {selectedGroup && (
                                    <Button size="large" danger icon={<VscTrash />} onClick={handleClear} loading={saving}>
                                        นำตำแหน่งทั้งหมดออกจากกลุ่มนี้
                                    </Button>
                                )}
                            </div>
                        </div>

                        {selectedGroup ? (
                            <div className="mb-4">
                                <Text className="font-semibold text-gray-700 block mb-2">
                                    2. เลือกตำแหน่งที่นับเป็น{currentGroup?.position_name}
                                </Text>
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
                                        <span key="all" className="font-semibold text-gray-600">ตำแหน่งในระบบบุคลากร</span>,
                                        <span key="mapped" className="font-bold text-[var(--brand-text)]">
                                            นับเป็น {currentGroup?.code}
                                        </span>,
                                    ]}
                                    locale={{ searchPlaceholder: 'ค้นหาตำแหน่ง...' }}
                                />
                                <p className="text-xs text-gray-400 mt-2 mb-0">
                                    ตำแหน่งที่มีป้ายกำกับถูกกลุ่มอื่นจับคู่ไว้แล้ว เลือกไม่ได้ —
                                    ตำแหน่งหนึ่งอยู่ได้กลุ่มเดียว ไม่งั้นระบบจะไม่รู้ว่าต้องใช้อัตราค่าตอบแทนของกลุ่มไหน
                                </p>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                                กรุณาเลือกกลุ่มตำแหน่งด้านบน เพื่อเริ่มจับคู่ตำแหน่ง
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
                                disabled={!selectedGroup}
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
