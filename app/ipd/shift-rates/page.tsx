'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Typography, Table, Tag, InputNumber, Alert, Spin } from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import Navbar from '../../components/Navbar';
import { VscSave, VscTrash } from 'react-icons/vsc';
import { PiMoneyWavyBold } from 'react-icons/pi';
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

interface Rate {
    staff_position_id: number;
    shift_code: string;
    amount: number;
    updated_at: string | null;
    updated_by: string | null;
}

/** หนึ่งแถวคือหนึ่งรหัสเวร ช่องกรอกอยู่ในคีย์ชื่อเดียวกับ staff_position_id */
interface RateRow {
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

export default function ShiftRatePage() {
    const [positions, setPositions] = useState<StaffPosition[]>([]);
    const [shifts, setShifts] = useState<ShiftType[]>([]);
    const [values, setValues] = useState<Record<string, number | null>>({});
    const [saved, setSaved] = useState<Record<string, number | null>>({});
    const [meta, setMeta] = useState<{ updated_at: string | null; updated_by: string | null } | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const authHeaders = () => {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const cellKey = (positionId: number, shiftCode: string) => `${positionId}|${shiftCode}`;

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/v1/rates/', { headers: authHeaders() });
            const data = res.data?.data ?? {};
            setPositions(data.positions ?? []);
            setShifts(data.shifts ?? []);

            const map: Record<string, number | null> = {};
            let latest: Rate | null = null;
            for (const r of (data.rates ?? []) as Rate[]) {
                map[`${r.staff_position_id}|${r.shift_code}`] = Number(r.amount);
                if (r.updated_at && (!latest?.updated_at || r.updated_at > latest.updated_at)) latest = r;
            }
            setValues(map);
            setSaved(map);
            setMeta(latest ? { updated_at: latest.updated_at, updated_by: latest.updated_by } : null);
        } catch (error) {
            console.error('Error fetching rates:', error);
            Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: 'ไม่สามารถดึงอัตราค่าตอบแทนได้', confirmButtonColor: '#006b5f' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    /*
      เทียบกับค่าที่โหลดมาเพื่อรู้ว่ามีอะไรเปลี่ยนบ้าง
      ส่งเฉพาะช่องที่แก้จริง จะได้ไม่ไปเขียนทับ updated_by ของช่องที่คนอื่นตั้งไว้
    */
    const dirtyKeys = useMemo(
        () => Object.keys({ ...saved, ...values }).filter(k => (values[k] ?? null) !== (saved[k] ?? null)),
        [values, saved]
    );

    const handleSave = async () => {
        if (dirtyKeys.length === 0) return;

        const cleared = dirtyKeys.filter(k => (values[k] ?? null) === null).length;
        const confirm = await Swal.fire({
            title: 'ยืนยันการบันทึกอัตรา',
            text: cleared > 0
                ? `บันทึก ${dirtyKeys.length - cleared} ช่อง และล้างค่า ${cleared} ช่อง`
                : `บันทึกอัตราที่แก้ไข ${dirtyKeys.length} ช่อง`,
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
            await axios.post('/api/v1/rates/', {
                rates: dirtyKeys.map(k => {
                    const [positionId, shiftCode] = k.split('|');
                    return {
                        staff_position_id: Number(positionId),
                        shift_code: shiftCode,
                        amount: values[k] ?? null,
                    };
                }),
            }, { headers: authHeaders() });

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

    const handleClearPosition = async (position: StaffPosition) => {
        const confirm = await Swal.fire({
            title: 'ยืนยันการล้างอัตรา',
            text: `ล้างอัตราค่าตอบแทนทุกเวรของ ${position.position_name}`,
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
            await axios.delete(`/api/v1/rates/clear/${position.staff_position_id}`, { headers: authHeaders() });
            await fetchAll();
            Swal.fire({ icon: 'success', title: 'ล้างอัตราเรียบร้อยแล้ว', timer: 1800, showConfirmButton: false });
        } catch {
            Swal.fire({ icon: 'error', title: 'ล้างอัตราไม่สำเร็จ', confirmButtonColor: '#006b5f' });
        } finally {
            setSaving(false);
        }
    };

    const rows: RateRow[] = shifts.map(s => ({
        key: s.code,
        shift: s,
        values: Object.fromEntries(positions.map(p => [p.staff_position_id, values[cellKey(p.staff_position_id, s.code)] ?? null])),
    }));

    const columns: TableColumnsType<RateRow> = [
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
            render: (_: unknown, row: RateRow) => (
                <InputNumber
                    className="w-full"
                    min={0}
                    step={50}
                    precision={2}
                    placeholder="ยังไม่กำหนด"
                    value={row.values[p.staff_position_id]}
                    // ล้างค่าเป็นว่างได้ ต่างจากใส่ 0 — ว่างคือยังไม่ตั้ง 0 คือขึ้นเวรแล้วไม่ได้เงิน
                    onChange={(v) => setValues(prev => ({
                        ...prev,
                        [cellKey(p.staff_position_id, row.shift.code)]: v === null || v === undefined ? null : Number(v),
                    }))}
                    suffix="บาท"
                />
            ),
        })),
    ];

    const totals = positions.map(p => {
        const filled = shifts.filter(s => values[cellKey(p.staff_position_id, s.code)] != null);
        return {
            position: p,
            filled: filled.length,
            missing: shifts.length - filled.length,
        };
    });

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-7xl mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <Title level={4} className="text-[var(--brand-text)]! mb-1! flex items-center gap-2">
                        <PiMoneyWavyBold className="w-6 h-6" />
                        ตั้งค่าตอบแทนตามเวร
                    </Title>
                    <Text className="text-gray-500 text-sm block mb-6">
                        กำหนดจำนวนเงินต่อหนึ่งเวร แยกตามกลุ่มตำแหน่ง —
                        ระบบจะคิดจากรหัสเวรที่บันทึกไว้ในหน้าตั้งค่าเวรเจ้าหน้าที่โดยตรง
                    </Text>

                    {positions.length === 0 && !loading && (
                        <Alert
                            type="warning"
                            showIcon
                            className="mb-4"
                            title="ยังไม่มีกลุ่มตำแหน่งในระบบ"
                            description="ต้องมีกลุ่มตำแหน่ง (RN / TN / PN) ก่อน จึงจะตั้งอัตราค่าตอบแทนได้"
                        />
                    )}

                    <div className="bg-teal-50 p-6 rounded-xl border border-teal-100">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <div className="flex flex-wrap gap-2">
                                {totals.map(t => (
                                    <Tag
                                        key={t.position.staff_position_id}
                                        color={t.missing === 0 ? 'green' : 'default'}
                                        className="m-0 py-1 px-2"
                                    >
                                        {t.position.code} · ตั้งแล้ว {t.filled}/{shifts.length} เวร
                                    </Tag>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {positions.map(p => (
                                    <Button
                                        key={p.staff_position_id}
                                        size="small"
                                        danger
                                        icon={<VscTrash />}
                                        disabled={saving || totals.find(t => t.position.staff_position_id === p.staff_position_id)?.filled === 0}
                                        onClick={() => handleClearPosition(p)}
                                    >
                                        ล้าง {p.code}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <Spin spinning={loading}>
                            <Table<RateRow>
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
                            ช่องที่เว้นว่างคือยังไม่ได้กำหนดอัตรา ต่างจากใส่เลข 0 ซึ่งแปลว่าขึ้นเวรนั้นแล้วไม่ได้ค่าตอบแทน
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
                    </div>
                </Card>
            </div>
        </div>
    );
}
