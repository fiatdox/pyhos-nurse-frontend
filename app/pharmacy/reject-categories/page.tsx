'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import { Alert, App, Button, Card, Checkbox, Input, Modal, Result, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PiArrowDownBold, PiArrowUpBold, PiArrowUUpLeftBold, PiPencilSimpleBold, PiPlusBold } from 'react-icons/pi';
import { FormSkeleton } from '@/app/components/Skeletons';
import { REJECT_CATEGORIES_API, type RejectCategory } from '../../lib/rxReject';

dayjs.extend(buddhistEra);

const { Text, Title } = Typography;

/**
 * ตั้งค่ากลุ่มเหตุผลที่ห้องยาส่งใบสั่งยากลับให้หอแก้ (ใช้ทำสถิติในหน้าวิเคราะห์)
 *
 * เพิ่ม · แก้ชื่อ · เรียงลำดับ · เปิด/ปิด · บังคับพิมพ์รายละเอียด
 * ไม่มีการลบ กลุ่มที่เลิกใช้ให้ปิด สถิติย้อนหลังยังอ่านชื่อได้
 * เซิร์ฟเวอร์ให้แก้เฉพาะกลุ่มงานเภสัชกรรมและแอดมิน คนอื่นเปิดดูได้อย่างเดียว
 */

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const errMsg = (err: unknown, fallback: string) => {
    const r = axios.isAxiosError(err) ? err.response : undefined;
    return (r?.data as { message?: string } | undefined)?.message ?? fallback;
};

export default function RejectCategoriesPage() {
    const { message } = App.useApp();
    const [rows, setRows] = useState<RejectCategory[] | null>(null);
    const [canManage, setCanManage] = useState(false);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);

    const [newLabel, setNewLabel] = useState('');
    const [newNote, setNewNote] = useState(false);
    const [editing, setEditing] = useState<{ code: string; label: string } | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await axios.get(REJECT_CATEGORIES_API, { params: { all: '1' }, headers: authHeaders() });
            setRows((res.data?.data ?? []) as RejectCategory[]);
            setCanManage(Boolean(res.data?.can_manage));
        } catch {
            setFailed(true);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- โหลดครั้งแรก setState เกิดหลัง await
        void load();
    }, [load]);

    const patch = async (code: string, body: Partial<Pick<RejectCategory, 'label' | 'active' | 'require_note'>>) => {
        setBusy(code);
        try {
            await axios.patch(`${REJECT_CATEGORIES_API}/${code}`, body, { headers: authHeaders() });
            message.success('บันทึกแล้ว');
            await load();
            return true;
        } catch (err) {
            message.error(errMsg(err, 'บันทึกไม่สำเร็จ'));
            return false;
        } finally {
            setBusy(null);
        }
    };

    const add = async () => {
        setBusy('new');
        try {
            await axios.post(REJECT_CATEGORIES_API, { label: newLabel.trim(), require_note: newNote }, { headers: authHeaders() });
            message.success('เพิ่มกลุ่มแล้ว');
            setNewLabel('');
            setNewNote(false);
            await load();
        } catch (err) {
            message.error(errMsg(err, 'เพิ่มไม่สำเร็จ'));
        } finally {
            setBusy(null);
        }
    };

    const move = async (index: number, dir: -1 | 1) => {
        if (!rows) return;
        const next = [...rows];
        const j = index + dir;
        if (j < 0 || j >= next.length) return;
        [next[index], next[j]] = [next[j], next[index]];
        setRows(next);
        setBusy('order');
        try {
            await axios.post(`${REJECT_CATEGORIES_API}/reorder`, { codes: next.map(r => r.code) }, { headers: authHeaders() });
        } catch (err) {
            message.error(errMsg(err, 'เรียงลำดับไม่สำเร็จ'));
            await load();
        } finally {
            setBusy(null);
        }
    };

    if (failed) return (<><Result status="error" title="โหลดกลุ่มเหตุผลไม่สำเร็จ" /></>);
    if (!rows) return (<><div className="p-6 max-w-3xl"><FormSkeleton rows={5} /></div></>);

    const columns: ColumnsType<RejectCategory> = [
        {
            title: 'ลำดับ', key: 'order', width: 84, align: 'center',
            render: (_, r, i) => (
                <span className="inline-flex gap-1">
                    <Button size="small" icon={<PiArrowUpBold />} aria-label="เลื่อนขึ้น"
                        disabled={!canManage || i === 0 || busy !== null} onClick={() => move(i, -1)} />
                    <Button size="small" icon={<PiArrowDownBold />} aria-label="เลื่อนลง"
                        disabled={!canManage || i === rows.length - 1 || busy !== null} onClick={() => move(i, 1)} />
                </span>
            ),
        },
        {
            title: <Tooltip title="ห้องยาเห็นเป็นปุ่มตอนส่งกลับ · หอเห็นเป็น [ชื่อกลุ่ม] หน้าเหตุผล">ชื่อกลุ่ม</Tooltip>, key: 'label',
            render: (_, r) => (
                <span className={`inline-flex items-center gap-2 ${r.active ? '' : 'text-gray-500 line-through'}`}>
                    {r.label}
                    {canManage && (
                        <Tooltip title="แก้ชื่อ">
                            <Button size="small" type="text" icon={<PiPencilSimpleBold />} aria-label="แก้ชื่อ"
                                onClick={() => setEditing({ code: r.code, label: r.label })} />
                        </Tooltip>
                    )}
                </span>
            ),
        },
        {
            title: <Tooltip title="ต้องพิมพ์รายละเอียดเพิ่มตอนเลือกกลุ่มนี้">บังคับพิมพ์</Tooltip>,
            key: 'note', width: 110, align: 'center',
            render: (_, r) => (
                <Switch size="small" checked={r.require_note} disabled={!canManage} loading={busy === r.code}
                    onChange={v => patch(r.code, { require_note: v })} />
            ),
        },
        {
            title: 'เปิดใช้', key: 'active', width: 90, align: 'center',
            render: (_, r) => (
                <Switch size="small" checked={r.active} disabled={!canManage} loading={busy === r.code}
                    onChange={v => patch(r.code, { active: v })} />
            ),
        },
        {
            title: 'ใช้ไปแล้ว', dataIndex: 'used', key: 'used', width: 90, align: 'right',
            render: (v: number | undefined) => <span className="tabular-nums">{v ?? 0} ใบ</span>,
        },
        {
            title: 'แก้ล่าสุด', key: 'upd', width: 190,
            render: (_, r) => r.updated_at
                ? <span className="text-xs text-gray-500 whitespace-nowrap">{dayjs(r.updated_at).locale('th').format('D MMM BB HH:mm')}{r.updated_by ? ` · ${r.updated_by}` : ''}</span>
                : '-',
        },
    ];

    return (
        <>
            <div className="p-4 flex flex-col gap-4 max-w-4xl mx-auto">
                <Card size="small">
                    <Title level={4} className="m-0! flex items-center gap-2">
                        <PiArrowUUpLeftBold /> ตั้งค่ากลุ่มเหตุผลส่งกลับ
                    </Title>
                    <Text type="secondary" className="text-sm">
                        กลุ่มที่ห้องยาเลือกตอนกด &quot;ส่งกลับให้หอแก้&quot; ใช้นับสถิติในหน้าวิเคราะห์การรับส่งใบสั่งยา
                    </Text>
                </Card>

                {!canManage && (
                    <Alert type="info" showIcon title="ดูได้อย่างเดียว" description="แก้ไขได้เฉพาะกลุ่มงานเภสัชกรรมและผู้ดูแลระบบ" />
                )}

                {canManage && (
                    <Card size="small" title="เพิ่มกลุ่มใหม่">
                        <div className="flex flex-wrap items-center gap-3">
                            <Input className="flex-1 min-w-60" placeholder="เช่น ยาไม่มีในบัญชีโรงพยาบาล" maxLength={100}
                                value={newLabel} onChange={e => setNewLabel(e.target.value)} onPressEnter={() => newLabel.trim().length >= 2 && add()} />
                            <Checkbox checked={newNote} onChange={e => setNewNote(e.target.checked)}>บังคับพิมพ์รายละเอียด</Checkbox>
                            <Button type="primary" icon={<PiPlusBold />} loading={busy === 'new'}
                                disabled={newLabel.trim().length < 2} onClick={add}>
                                เพิ่ม
                            </Button>
                        </div>
                    </Card>
                )}

                <Card size="small" title={<span>กลุ่มทั้งหมด <Tag className="m-0! ml-1">{rows.filter(r => r.active).length} เปิดใช้</Tag></span>}>
                    <Table size="small" rowKey="code" pagination={false} dataSource={rows} columns={columns}
                        scroll={{ x: 'max-content' }} />
                    <Text type="secondary" className="text-xs block mt-2">
                        ไม่มีปุ่มลบ: กลุ่มที่เลิกใช้ให้ปิด จะไม่ขึ้นให้เลือกตอนส่งกลับ แต่สถิติย้อนหลังยังแสดงชื่อเดิม ·
                        แก้ชื่อกลุ่มแล้ว ใบเก่าที่ใช้กลุ่มนั้นจะแสดงชื่อใหม่ด้วย
                    </Text>
                </Card>
            </div>

            <Modal open={!!editing} title="แก้ชื่อกลุ่ม" okText="บันทึก" cancelText="ยกเลิก" destroyOnHidden
                okButtonProps={{ disabled: !editing || editing.label.trim().length < 2, loading: busy === editing?.code }}
                onCancel={() => setEditing(null)}
                onOk={async () => {
                    if (!editing) return;
                    if (await patch(editing.code, { label: editing.label.trim() })) setEditing(null);
                }}>
                <Input maxLength={100} value={editing?.label ?? ''} autoFocus
                    onChange={e => setEditing(ed => ed && { ...ed, label: e.target.value })} />
            </Modal>
        </>
    );
}
