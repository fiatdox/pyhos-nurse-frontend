'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Alert, Empty, Image, Input, Modal, Spin, Tag } from 'antd';
import { PiMagnifyingGlassBold } from 'react-icons/pi';

export interface WardPatient {
    hn: string;
    ptname: string;
    an: string | null;
    ward_name: string | null;
    admission: 'admitted_here' | 'admitted' | 'discharged' | 'none';
    discharged_at: string | null;
    in_ward: boolean;
}

const authHeaders = () => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * เลือกผู้ป่วยจากรายชื่อคนที่นอนอยู่ตึกนี้ แทนการพิมพ์ HN
 *
 * รายการมาจากกฎเดียวกับที่เซิร์ฟเวอร์ใช้รับใบ เลือกจากตรงนี้แล้วส่งผ่านเสมอ
 * แสดงภาพใบสั่งยาไว้ข้าง ๆ ให้เทียบชื่อกับที่เขียนบนใบก่อนกด ไม่ใช่เลือกจากความจำ
 */
export default function RxWardPatientPicker({ open, ward, wardName, thumb, onPick, onClose }: {
    open: boolean;
    ward: number | undefined;
    wardName?: string;
    /** ภาพย่อของใบที่กำลังใส่ HN */
    thumb?: string;
    onPick: (p: WardPatient) => void;
    onClose: () => void;
}) {
    const [list, setList] = useState<WardPatient[]>([]);
    const [loading, setLoading] = useState(false);
    const [hisDown, setHisDown] = useState(false);
    const [q, setQ] = useState('');

    useEffect(() => {
        if (!open || !ward) return;
        let alive = true;
        /* ดึงใหม่ทุกครั้งที่เปิด คนเข้า-ออกตึกตลอดเวร รายการเมื่อชั่วโมงก่อนเชื่อไม่ได้ */
        const load = async () => {
            setLoading(true);
            setHisDown(false);
            try {
                const res = await axios.get('/api/v1/rx/ward-patients', { headers: authHeaders(), params: { ward } });
                if (!alive) return;
                setList(res.data?.data ?? []);
                setHisDown(!!res.data?.his_down);
            } catch {
                if (alive) { setList([]); setHisDown(true); }
            } finally {
                if (alive) setLoading(false);
            }
        };
        void load();
        return () => { alive = false; };
    }, [open, ward]);

    const shown = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return list;
        return list.filter(p => p.ptname.toLowerCase().includes(s) || p.hn.includes(s) || (p.an ?? '').includes(s));
    }, [list, q]);

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={thumb ? 900 : 560}
            centered
            destroyOnHidden
            afterOpenChange={o => { if (!o) setQ(''); }}
            title={`เลือกผู้ป่วย${wardName ? ` · ${wardName}` : ''}`}
        >
            <div className="flex gap-4">
                {thumb && (
                    <div className="hidden md:block w-80 shrink-0">
                        <Image src={thumb} alt="ใบสั่งยา" className="rounded border border-gray-200" />
                        <div className="text-xs text-gray-500 mt-1">เทียบชื่อกับใบก่อนเลือก · คลิกภาพเพื่อขยาย</div>
                    </div>
                )}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <Input
                        id="ward-patient-search"
                        autoFocus
                        allowClear
                        prefix={<PiMagnifyingGlassBold />}
                        placeholder="ค้นชื่อ / HN / AN"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        onPressEnter={() => { if (shown.length === 1) onPick(shown[0]); }}
                    />
                    {hisDown && (
                        <Alert type="warning" showIcon title="ดึงรายชื่อจาก HIS ไม่ได้ตอนนี้"
                            description="ปิดหน้าต่างนี้แล้วพิมพ์ HN เองได้" />
                    )}
                    <div className="max-h-[60vh] overflow-auto flex flex-col gap-1" role="listbox">
                        {loading ? (
                            <div className="py-8 text-center"><Spin /></div>
                        ) : shown.length === 0 ? (
                            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={list.length === 0 ? 'ไม่มีผู้ป่วยในตึกนี้' : 'ไม่พบตามที่ค้น'} />
                        ) : shown.map(p => (
                            <button
                                key={p.hn}
                                type="button"
                                role="option"
                                aria-selected={false}
                                onClick={() => onPick(p)}
                                className="text-left rounded border border-gray-200 dark:border-gray-700 px-3 py-2
                                    hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-[#162312] transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold truncate">{p.ptname || 'ไม่มีชื่อในทะเบียน'}</span>
                                    {p.admission === 'discharged' && (
                                        <Tag color="orange" className="m-0! ml-auto! text-[11px]!">
                                            จำหน่ายแล้ว {p.discharged_at ?? ''}
                                        </Tag>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 tabular-nums">
                                    HN {p.hn}{p.an ? ` · AN ${p.an}` : ''}
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="text-xs text-gray-500">
                        {!loading && list.length > 0 && `${shown.length} / ${list.length} คน · `}
                        ไม่มีชื่อที่ต้องการ? ปิดหน้าต่างแล้วพิมพ์ HN เอง (ต้องเป็นผู้ป่วยของตึกนี้)
                    </div>
                </div>
            </div>
        </Modal>
    );
}
