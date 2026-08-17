'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Typography, Table, Tag, InputNumber, Alert, Spin, Select } from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import { VscSave, VscTrash } from 'react-icons/vsc';
import { LiaHospital } from 'react-icons/lia';
import Swal from 'sweetalert2';

const { Title, Text } = Typography;

interface StaffPosition {
    staff_position_id: number;
    position_name: string;
    code: string;
}

interface ShiftType {
    code: string;
    name: string;
    shift_group_id: number;
    shift_group_name: string;
    display_order: number;
}

interface Ward {
    ward: number;
    ward_name: string;
}

interface Quota {
    staff_position_id: number;
    shift_code: string;
    quota: number;
    updated_at: string | null;
    updated_by: string | null;
}

/** หนึ่งแถวคือหนึ่งรหัสเวร ค่าของแต่ละกลุ่มตำแหน่งอยู่ในคีย์ตาม staff_position_id */
interface QuotaRow {
    key: string;
    shift: ShiftType;
    values: Record<number, number | null>;
}

/*
  แถบสีแยกชุดเวร ใช้สีกลางแบบโปร่งแสงแทนเฉดอ่อน (-50)
  เฉด -50 ถูกพลิกเป็นสีเข้มจัดในโหมดมืดแล้วออกมาขุ่น ส่วนสีโปร่งแสง
  จะผสมกับพื้นหลังของโหมดนั้นๆ เอง จึงจางพอดีทั้งสองโหมดโดยไม่ต้องแยกโค้ด
*/
const groupStyle: Record<number, { bg: string; text: string; label: string }> = {
    1: { bg: 'bg-indigo-500/[0.06]', text: 'text-indigo-600', label: 'เวรดึก' },
    2: { bg: 'bg-amber-500/[0.06]', text: 'text-amber-600', label: 'เวรเช้า' },
    3: { bg: 'bg-rose-500/[0.06]', text: 'text-rose-600', label: 'เวรบ่าย' },
};

/** ป้ายบอกชนิดเวรจากรหัส — รหัสลงท้าย _OT คือโอที 8 ชม. _OT4 คือ 4 ชม. */
const shiftKind = (code: string) => {
    if (code.endsWith('_OT4')) return { label: 'OT 4 ชม.', color: 'orange' };
    if (code.endsWith('_OT')) return { label: 'OT 8 ชม.', color: 'gold' };
    return { label: 'เวรปกติ', color: 'green' };
};

export default function WardQuotaPage() {
    const [positions, setPositions] = useState<StaffPosition[]>([]);
    const [shifts, setShifts] = useState<ShiftType[]>([]);
    const [wards, setWards] = useState<Ward[]>([]);
    const [selectedWard, setSelectedWard] = useState<number | null>(null);
    const [values, setValues] = useState<Record<string, number | null>>({});
    const [saved, setSaved] = useState<Record<string, number | null>>({});
    const [meta, setMeta] = useState<{ updated_by: string | null } | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const authHeaders = () => {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const cellKey = (positionId: number, shiftCode: string) => `${positionId}|${shiftCode}`;

    const fetchOptions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/v1/ward-quotas/options', { headers: authHeaders() });
            const data = res.data?.data ?? {};
            setPositions(data.positions ?? []);
            setShifts(data.shifts ?? []);
            setWards(data.wards ?? []);
        } catch (error) {
            console.error('Error fetching quota options:', error);
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถดึงข้อมูลตั้งต้นได้', confirmButtonColor: '#006b5f' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchOptions(); }, [fetchOptions]);

    const fetchQuotas = useCallback(async (ward: number) => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/ward-quotas/${ward}`, { headers: authHeaders() });
            const map: Record<string, number | null> = {};
            let latest: Quota | null = null;
            for (const q of (res.data?.data ?? []) as Quota[]) {
                map[`${q.staff_position_id}|${q.shift_code}`] = Number(q.quota);
                if (q.updated_at && (!latest?.updated_at || q.updated_at > latest.updated_at)) latest = q;
            }
            setValues(map);
            setSaved(map);
            setMeta(latest ? { updated_by: latest.updated_by } : null);
        } catch (error) {
            console.error('Error fetching quotas:', error);
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถดึงอัตรากำลังของหอผู้ป่วยนี้ได้', confirmButtonColor: '#006b5f' });
            setValues({});
            setSaved({});
        } finally {
            setLoading(false);
        }
    }, []);

    const handleWardChange = (ward: number) => {
        setSelectedWard(ward);
        fetchQuotas(ward);
    };

    // ส่งเฉพาะช่องที่แก้จริง จะได้ไม่ไปเขียนทับผู้แก้ไขล่าสุดของช่องที่ไม่ได้แตะ
    const dirtyKeys = useMemo(
        () => Object.keys({ ...saved, ...values }).filter(k => (values[k] ?? null) !== (saved[k] ?? null)),
        [values, saved]
    );

    const handleSave = async () => {
        // เทียบกับ null ตรงๆ เพราะมีหอผู้ป่วยที่ his_code เป็น '00' → รหัส 0 ซึ่งเป็นค่าเท็จใน JS
        if (selectedWard === null || dirtyKeys.length === 0) return;

        const cleared = dirtyKeys.filter(k => (values[k] ?? null) === null).length;
        const confirm = await Swal.fire({
            title: 'ยืนยันการบันทึกอัตรากำลัง',
            text: cleared > 0
                ? `บันทึก ${dirtyKeys.length - cleared} ช่อง และล้างค่า ${cleared} ช่อง`
                : `บันทึกอัตรากำลังที่แก้ไข ${dirtyKeys.length} ช่อง`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#006b5f',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'ใช่, บันทึกเลย',
            cancelButtonText: 'ยกเลิก',
        });
        if (!confirm.isConfirmed) return;

        setSaving(true);
        try {
            await axios.post('/api/v1/ward-quotas/', {
                ward: selectedWard,
                quotas: dirtyKeys.map(k => {
                    const [positionId, shiftCode] = k.split('|');
                    return {
                        staff_position_id: Number(positionId),
                        shift_code: shiftCode,
                        quota: values[k] ?? null,
                    };
                }),
            }, { headers: authHeaders() });

            await fetchQuotas(selectedWard);
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
        if (selectedWard === null) return;
        const ward = wards.find(w => w.ward === selectedWard);

        const confirm = await Swal.fire({
            title: 'ยืนยันการล้างอัตรากำลัง',
            text: `ล้างอัตรากำลังทุกเวรทุกตำแหน่งของ ${ward?.ward_name}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'ใช่, ล้างทั้งหมด',
            cancelButtonText: 'ยกเลิก',
        });
        if (!confirm.isConfirmed) return;

        setSaving(true);
        try {
            await axios.delete(`/api/v1/ward-quotas/clear/${selectedWard}`, { headers: authHeaders() });
            await fetchQuotas(selectedWard);
            Swal.fire({ icon: 'success', title: 'ล้างอัตรากำลังเรียบร้อยแล้ว', timer: 1800, showConfirmButton: false });
        } catch {
            Swal.fire({ icon: 'error', title: 'ล้างอัตรากำลังไม่สำเร็จ', confirmButtonColor: '#006b5f' });
        } finally {
            setSaving(false);
        }
    };

    const rows: QuotaRow[] = shifts.map(s => ({
        key: s.code,
        shift: s,
        values: Object.fromEntries(
            positions.map(p => [p.staff_position_id, values[cellKey(p.staff_position_id, s.code)] ?? null])
        ),
    }));

    const columns: TableColumnsType<QuotaRow> = [
        {
            title: 'เวร',
            dataIndex: 'shift',
            width: 200,
            render: (_: unknown, row) => {
                const g = groupStyle[row.shift.shift_group_id];
                const kind = shiftKind(row.shift.code);
                return (
                    <div className="flex items-center gap-2">
                        <span className={`font-semibold ${g?.text ?? 'text-gray-600'}`}>
                            {g?.label ?? row.shift.shift_group_name}
                        </span>
                        <Tag color={kind.color} className="m-0 text-[11px]">{kind.label}</Tag>
                    </div>
                );
            },
        },
        {
            title: 'รหัส',
            dataIndex: ['shift', 'code'],
            width: 90,
            align: 'center',
            render: (code: string) => <code className="text-xs text-gray-500">{code}</code>,
        },
        ...positions.map(p => ({
            title: (
                <div className="flex flex-col items-center leading-tight">
                    <span>{p.position_name}</span>
                    <span className="text-[11px] font-normal opacity-80">({p.code})</span>
                </div>
            ),
            key: `pos-${p.staff_position_id}`,
            align: 'center' as const,
            width: 170,
            render: (_: unknown, row: QuotaRow) => (
                <InputNumber
                    className="w-full"
                    min={0}
                    max={999}
                    precision={0}
                    placeholder="ยังไม่กำหนด"
                    value={row.values[p.staff_position_id]}
                    // ว่างคือยังไม่กำหนด ต่างจาก 0 ซึ่งแปลว่าตั้งใจไม่ให้ขึ้นเวรนี้เลย
                    onChange={(v) => setValues(prev => ({
                        ...prev,
                        [cellKey(p.staff_position_id, row.shift.code)]: v === null || v === undefined ? null : Number(v),
                    }))}
                    suffix="คน"
                />
            ),
        })),
        {
            title: 'รวมต่อเวร',
            key: 'total',
            align: 'center',
            width: 110,
            render: (_: unknown, row: QuotaRow) => {
                const filled = positions
                    .map(p => row.values[p.staff_position_id])
                    .filter((v): v is number => v !== null);
                if (filled.length === 0) return <span className="text-gray-300">—</span>;
                return <span className="font-semibold">{filled.reduce((s, v) => s + v, 0)} คน</span>;
            },
        },
    ];

    const filledCount = shifts.reduce(
        (n, s) => n + positions.filter(p => values[cellKey(p.staff_position_id, s.code)] != null).length,
        0
    );
    const totalCells = shifts.length * positions.length;

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-7xl mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <Title level={4} className="text-[var(--brand-text)]! mb-1! flex items-center gap-2">
                        <LiaHospital className="w-6 h-6" />
                        ตั้งค่าหอผู้ป่วย — อัตรากำลังต่อเวร
                    </Title>
                    <Text className="text-gray-500 text-sm block mb-6">
                        กำหนดว่าหอผู้ป่วยแต่ละแห่ง เวรแต่ละประเภท กลุ่มตำแหน่งใด ขึ้นเวรได้กี่คน
                    </Text>

                    <div className="bg-teal-50 p-6 rounded-xl border border-teal-100">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <Text className="font-semibold text-gray-700">เลือกหอผู้ป่วย</Text>
                            <Select
                                size="large"
                                placeholder="ระบุหอผู้ป่วย"
                                className="w-full sm:w-96"
                                loading={loading}
                                value={selectedWard}
                                onChange={handleWardChange}
                                showSearch
                                optionFilterProp="label"
                                options={wards.map(w => ({ value: w.ward, label: w.ward_name }))}
                            />
                            {selectedWard !== null && (
                                <>
                                    <Tag color={filledCount === totalCells ? 'green' : 'default'} className="m-0 py-1 px-2">
                                        ตั้งแล้ว {filledCount}/{totalCells} ช่อง
                                    </Tag>
                                    <Button
                                        danger
                                        icon={<VscTrash />}
                                        onClick={handleClear}
                                        loading={saving}
                                        disabled={filledCount === 0}
                                    >
                                        ล้างอัตรากำลังของหอนี้
                                    </Button>
                                </>
                            )}
                        </div>

                        {positions.length === 0 && !loading && (
                            <Alert
                                type="warning"
                                showIcon
                                className="mb-4"
                                title="ยังไม่มีกลุ่มตำแหน่งในระบบ"
                                description="ต้องมีกลุ่มตำแหน่ง (RN / TN / PN) ก่อน จึงจะกำหนดอัตรากำลังได้"
                            />
                        )}

                        {selectedWard === null ? (
                            <div className="text-center py-12 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
                                กรุณาเลือกหอผู้ป่วยด้านบน เพื่อกำหนดอัตรากำลังต่อเวร
                            </div>
                        ) : (
                            <>
                                <Spin spinning={loading}>
                                    <Table<QuotaRow>
                                        columns={columns}
                                        dataSource={rows}
                                        size="small"
                                        pagination={false}
                                        rowKey="key"
                                        // แถบสีช่วยแยกว่าเวรไหนเป็นชุดเดียวกัน (ปกติ + OT8 + OT4)
                                        rowClassName={(row) => groupStyle[row.shift.shift_group_id]?.bg ?? ''}
                                        className="
                                            [&_.ant-table]:rounded-xl
                                            [&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]!
                                            [&_.ant-table-thead_.ant-table-cell]:text-white!
                                            [&_.ant-table-thead_.ant-table-cell]:font-semibold!
                                        "
                                    />
                                </Spin>

                                <p className="text-xs text-gray-400 mt-3 mb-0">
                                    ช่องที่เว้นว่างคือยังไม่ได้กำหนดอัตรากำลัง ต่างจากใส่เลข 0 ซึ่งแปลว่าตั้งใจไม่ให้ขึ้นเวรนั้นเลย
                                    {meta?.updated_by && ` · แก้ไขล่าสุดโดย ${meta.updated_by}`}
                                </p>

                                <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-teal-200">
                                    {dirtyKeys.length > 0 && (
                                        <span className="text-xs text-amber-600">แก้ไขค้างไว้ {dirtyKeys.length} ช่อง</span>
                                    )}
                                    <Button
                                        size="large"
                                        type="primary"
                                        onClick={handleSave}
                                        className="bg-[#006b5f]"
                                        icon={<VscSave />}
                                        loading={saving}
                                        disabled={dirtyKeys.length === 0}
                                    >
                                        บันทึกข้อมูล
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
