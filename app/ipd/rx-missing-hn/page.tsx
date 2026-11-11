'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import { Alert, App, Button, Card, Empty, Input, Tag, Typography } from 'antd';
import { PiArrowClockwiseBold, PiIdentificationCardBold } from 'react-icons/pi';
import Navbar from '../../components/Navbar';
import RxFileViewer, { type RxFile } from '../../components/RxFileViewer';
import { FormSkeleton } from '@/app/components/Skeletons';
import { RX_MISSING_HN_ITEM } from '../../lib/menu';
import { useMenuAccess } from '../../lib/useMenuAccess';

dayjs.locale('th');
dayjs.extend(buddhistEra);

const { Text, Title } = Typography;

/**
 * ใส่ HN ให้ใบสั่งยาที่ส่งมาโดยไม่มี HN (แอดมิน)
 *
 * ดูภาพใบ → พิมพ์ HN → ระบบค้นชื่อจาก HIS ให้เทียบกับภาพ → ยืนยัน
 * ต้องเห็นชื่อก่อนถึงกดบันทึกได้ เพราะ HN พิมพ์ผิดหนึ่งหลักมักไปตรงกับผู้ป่วยจริงคนอื่น
 */

interface MissingOrder {
    rx_order_id: number;
    ward: number;
    ward_name: string | null;
    status: string;
    priority: 'routine' | 'discharge' | 'stat';
    note: string | null;
    submitted_by_name: string | null;
    submitted_at_text: string;
    files: RxFile[];
}

type Admission = 'admitted_here' | 'admitted' | 'discharged' | 'none';

interface Lookup {
    hn: string;
    ptname: string;
    an: string | null;
    ward_name: string | null;
    admission: Admission;
    discharged_at: string | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
    submitted: { label: 'รอรับ', color: 'gold' },
    acknowledged: { label: 'รับแล้ว กำลังคีย์', color: 'blue' },
    completed: { label: 'คีย์แล้ว รอจัดยา', color: 'purple' },
    prepared: { label: 'จัดยาเสร็จ รอมารับ', color: 'green' },
    picked_up: { label: 'ตึกรับยาแล้ว', color: 'default' },
    rejected: { label: 'ส่งกลับแล้ว', color: 'red' },
    closed: { label: 'ปิดเรื่องแล้ว', color: 'default' },
};

const PRIORITY: Record<string, { label: string; color: string } | undefined> = {
    stat: { label: 'ด่วน', color: 'red' },
    discharge: { label: 'กลับบ้าน', color: 'cyan' },
};

/* สถานะการนอนเทียบกับหอที่ส่งใบ — เลขที่ไม่ได้นอนอยู่เลยน่าสงสัยว่าพิมพ์ผิด */
const admissionText = (l: Lookup) => {
    if (l.admission === 'admitted_here') return { color: 'green', text: 'นอนหอที่ส่งใบ' };
    if (l.admission === 'admitted') return { color: 'gold', text: `นอน${l.ward_name ? ` ${l.ward_name}` : 'หออื่น'}` };
    if (l.admission === 'discharged') {
        return { color: 'default', text: `จำหน่ายแล้ว${l.discharged_at ? ` ${dayjs(l.discharged_at).format('D MMM')}` : ''}` };
    }
    return { color: 'red', text: 'ไม่ได้นอนอยู่' };
};

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const errMsg = (e: unknown, fallback: string) =>
    (axios.isAxiosError(e) && (e.response?.data as { message?: string } | undefined)?.message) || fallback;

export default function RxMissingHnPage() {
    const { message } = App.useApp();
    const access = useMenuAccess();
    const [orders, setOrders] = useState<MissingOrder[] | null>(null);
    const [retentionDays, setRetentionDays] = useState<number | null>(null);
    const [loadError, setLoadError] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const [hn, setHn] = useState('');
    const [note, setNote] = useState('');
    const [lookup, setLookup] = useState<Lookup | null>(null);
    const [lookupNote, setLookupNote] = useState('');
    const [looking, setLooking] = useState(false);
    const [saving, setSaving] = useState(false);

    const resetForm = () => { setHn(''); setNote(''); setLookup(null); setLookupNote(''); };

    /* ดึงกับนำผลไปใช้แยกกัน ผลที่มาช้าหลังออกจากหน้าแล้วจะได้ไม่ถูกเอาไปตั้งค่า */
    const fetchList = () => axios.get('/api/v1/rx/admin/missing-hn', { headers: authHeaders() })
        .then(res => ({ list: (res.data?.data ?? []) as MissingOrder[], days: (res.data?.file_retention_days ?? null) as number | null, error: '' }))
        .catch(e => ({ list: [] as MissingOrder[], days: null, error: errMsg(e, 'ดึงรายการไม่สำเร็จ') }));

    const apply = useCallback((r: Awaited<ReturnType<typeof fetchList>>) => {
        setLoadError(r.error);
        setOrders(r.list);
        setRetentionDays(r.days);
        setSelectedId(prev => (prev && r.list.some(o => o.rx_order_id === prev) ? prev : r.list[0]?.rx_order_id ?? null));
    }, []);

    const load = () => { fetchList().then(apply); };

    useEffect(() => {
        if (!access.ready || !access.isAdmin) return;
        let stale = false;
        fetchList().then(r => { if (!stale) apply(r); });
        return () => { stale = true; };
    }, [access.ready, access.isAdmin, apply]);

    const selected = orders?.find(o => o.rx_order_id === selectedId) ?? null;

    const select = (id: number) => { setSelectedId(id); resetForm(); };

    const doLookup = async () => {
        if (!selected || !hn) return;
        setLooking(true);
        setLookup(null);
        setLookupNote('');
        try {
            const res = await axios.get('/api/v1/rx/patient-lookup', {
                headers: authHeaders(), params: { hn, ward: selected.ward },
            });
            if (res.data?.his_down) setLookupNote('ค้นชื่อจาก HIS ไม่ได้ตอนนี้ กรุณาลองใหม่ภายหลัง');
            else if (!res.data?.found) setLookupNote(`ไม่พบ HN ${hn} ใน HIS`);
            else {
                setLookup(res.data.data as Lookup);
                setHn(String(res.data.data.hn));
            }
        } catch (e) {
            setLookupNote(errMsg(e, 'ค้นไม่สำเร็จ'));
        } finally {
            setLooking(false);
        }
    };

    const save = async () => {
        if (!selected || !lookup) return;
        setSaving(true);
        try {
            const res = await axios.post(`/api/v1/rx/orders/${selected.rx_order_id}/hn`,
                { hn: lookup.hn, note: note.trim() || undefined }, { headers: authHeaders() });
            message.success(`ใส่ HN ${res.data.data.hn} ให้ใบ #${selected.rx_order_id} แล้ว`);
            /* ไปใบถัดไปเลย งานนี้ทำต่อกันทีละหลายใบ */
            const rest = (orders ?? []).filter(o => o.rx_order_id !== selected.rx_order_id);
            const idx = (orders ?? []).findIndex(o => o.rx_order_id === selected.rx_order_id);
            setOrders(rest);
            setSelectedId(rest[Math.min(idx, rest.length - 1)]?.rx_order_id ?? null);
            resetForm();
        } catch (e) {
            message.error(errMsg(e, 'บันทึกไม่สำเร็จ'));
            /* อีกเครื่องใส่ไปก่อนแล้ว รายการที่เห็นอยู่ล้าสมัย */
            if (axios.isAxiosError(e) && e.response?.status === 409) load();
        } finally {
            setSaving(false);
        }
    };

    if (!access.ready) {
        return (<><Navbar /><div className="p-6 max-w-2xl"><FormSkeleton rows={4} /></div></>);
    }
    if (!access.isAdmin) {
        return (
            <>
                <Navbar />
                <div className="p-6 max-w-2xl mx-auto">
                    <Alert type="warning" showIcon title="หน้านี้สำหรับผู้ดูแลระบบเท่านั้น" />
                </div>
            </>
        );
    }

    const tag = lookup ? admissionText(lookup) : null;

    return (
        <>
            <Navbar />
            <div className="p-4 flex flex-col gap-4 max-w-7xl mx-auto">
                <Card size="small">
                    <div className="flex flex-wrap items-center gap-3">
                        <Title level={4} className="m-0! flex items-center gap-2">
                            <PiIdentificationCardBold /> {RX_MISSING_HN_ITEM.label}
                        </Title>
                        <span className="text-sm">
                            {orders ? <>ค้างอยู่ <b className="text-lg">{orders.length}</b> ใบ</> : null}
                        </span>
                        <Button className="ml-auto" icon={<PiArrowClockwiseBold />} onClick={load}>โหลดใหม่</Button>
                    </div>
                    <Text type="secondary" className="text-xs block mt-1">
                        ดูภาพใบสั่งยา พิมพ์ HN แล้วกดค้น ตรวจชื่อที่ขึ้นมากับภาพให้ตรงก่อนบันทึก · ใส่ได้เฉพาะใบที่ยังไม่มี HN
                    </Text>
                </Card>

                {loadError && <Alert type="error" showIcon title={loadError} />}
                {orders === null && <FormSkeleton rows={6} />}
                {orders?.length === 0 && !loadError && (
                    <Card><Empty description="ไม่มีใบที่ขาด HN" /></Card>
                )}

                {orders && orders.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
                        <div className="flex flex-col gap-2 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
                            {orders.map(o => {
                                const st = STATUS[o.status];
                                const pr = PRIORITY[o.priority];
                                const active = o.rx_order_id === selectedId;
                                return (
                                    <button
                                        key={o.rx_order_id}
                                        type="button"
                                        onClick={() => select(o.rx_order_id)}
                                        aria-pressed={active}
                                        className={`text-left rounded-lg border px-3 py-2 transition-colors
                                            focus-visible:outline-2 focus-visible:outline-emerald-600
                                            ${active ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 bg-white hover:border-emerald-300'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <b>#{o.rx_order_id}</b>
                                            <span className="truncate">{o.ward_name ?? `หอ ${o.ward}`}</span>
                                            {pr && <Tag color={pr.color} className="m-0! ml-auto">{pr.label}</Tag>}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {dayjs(o.submitted_at_text).format('D MMM BB HH:mm')}
                                            {o.submitted_by_name ? ` · ${o.submitted_by_name}` : ''}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Tag color={st?.color} className="m-0!">{st?.label ?? o.status}</Tag>
                                            <span className="text-xs text-gray-500">{o.files.length} ไฟล์</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {selected && (
                            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
                                <Card size="small" title={`ภาพใบสั่งยา #${selected.rx_order_id}`} styles={{ body: { padding: 8 } }}>
                                    <RxFileViewer
                                        key={selected.rx_order_id}
                                        orderId={String(selected.rx_order_id)}
                                        files={selected.files}
                                        retentionDays={retentionDays}
                                        className="h-[70vh]"
                                    />
                                </Card>

                                <Card size="small" title="ใส่ HN">
                                    <div className="flex flex-col gap-3">
                                        {selected.note && (
                                            <div className="text-sm"><Text type="secondary">หมายเหตุจากหอ: </Text>{selected.note}</div>
                                        )}
                                        <div>
                                            <label htmlFor="hn-input" className="text-sm font-medium block mb-1">HN</label>
                                            <Input.Search
                                                id="hn-input"
                                                value={hn}
                                                inputMode="numeric"
                                                maxLength={9}
                                                placeholder="พิมพ์ HN ตามภาพ"
                                                enterButton="ค้น"
                                                loading={looking}
                                                onChange={e => { setHn(e.target.value.replace(/\D/g, '').slice(0, 9)); setLookup(null); setLookupNote(''); }}
                                                onSearch={doLookup}
                                            />
                                        </div>

                                        {lookupNote && <Alert type="warning" showIcon title={lookupNote} />}

                                        {lookup && tag && (
                                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                                <div className="text-xs text-gray-500">ชื่อจาก HIS — ตรวจให้ตรงกับภาพ</div>
                                                <div className="text-base font-semibold mt-0.5">{lookup.ptname || '(ไม่มีชื่อ)'}</div>
                                                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
                                                    <span className="tabular-nums">HN {lookup.hn}</span>
                                                    {lookup.an && <span className="tabular-nums">· AN {lookup.an}</span>}
                                                    <Tag color={tag.color} className="m-0!">{tag.text}</Tag>
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label htmlFor="hn-note" className="text-sm font-medium block mb-1">
                                                หมายเหตุ <Text type="secondary" className="font-normal">(ไม่บังคับ)</Text>
                                            </label>
                                            <Input
                                                id="hn-note"
                                                value={note}
                                                maxLength={300}
                                                onChange={e => setNote(e.target.value)}
                                                placeholder="เช่น ยืนยันกับหอทางโทรศัพท์"
                                            />
                                        </div>

                                        <Button type="primary" block disabled={!lookup} loading={saving} onClick={save}>
                                            {lookup ? `บันทึก HN ${lookup.hn}` : 'ค้น HN และตรวจชื่อก่อนบันทึก'}
                                        </Button>
                                        <Text type="secondary" className="text-xs">
                                            ระบบจะใส่ AN ของการนอนในวันที่ส่งใบให้ด้วย ถ้ามี และบันทึกในประวัติของใบว่าใครใส่ HN
                                        </Text>
                                    </div>
                                </Card>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
