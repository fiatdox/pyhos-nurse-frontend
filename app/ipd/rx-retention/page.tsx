'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, App, Button, Card, InputNumber, Modal, Segmented, Space, Spin, Statistic, Typography } from 'antd';
import { PiClockCounterClockwiseBold, PiFloppyDiskBold } from 'react-icons/pi';
import Navbar from '../../components/Navbar';
import { RX_RETENTION_ITEM } from '../../lib/menu';
import { useMenuAccess } from '../../lib/useMenuAccess';

const { Text, Title } = Typography;

/**
 * ระยะเวลาจัดเก็บไฟล์ใบสั่งยา (ผู้ดูแลระบบ)
 *
 * ไฟล์ภาพที่หอสแกนส่งห้องยา เก็บไว้ตามจำนวนวันที่ตั้ง ครบแล้วเซิร์ฟเวอร์ลบออกจากดิสก์เอง
 * หน้านี้ต้องบอกให้ชัดก่อนกดบันทึกว่า "จะมีไฟล์หายกี่ไฟล์" เพราะการลบย้อนกลับไม่ได้
 */

interface RetentionInfo {
    days: number;
    min: number;
    max: number;
    default: number;
    updated_at: string | null;
    updated_by: string | null;
    can_manage: boolean;
    preview_days: number;
    due: { files: number; orders: number; bytes: number };
    last_run: { at: string; files: number; skipped: number } | null;
}

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const PRESETS = [90, 120, 180, 365];

const mb = (bytes: number) => (bytes / 1024 / 1024).toLocaleString('th-TH', { maximumFractionDigits: 1 });
const thaiDateTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function RxRetentionPage() {
    const { message } = App.useApp();
    const access = useMenuAccess();
    const [info, setInfo] = useState<RetentionInfo | null>(null);
    const [draft, setDraft] = useState<number | null>(null);
    const [preview, setPreview] = useState<RetentionInfo['due'] | null>(null);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async (days?: number) => {
        const res = await axios.get('/api/v1/rx/retention', {
            headers: authHeaders(), params: days ? { days } : undefined,
        });
        return res.data?.data as RetentionInfo;
    }, []);

    useEffect(() => {
        load().then(d => { setInfo(d); setDraft(d.days); setPreview(d.due); })
            .catch(() => message.error('อ่านค่าตั้งไม่สำเร็จ'));
    }, [load, message]);

    /*
      นับล่วงหน้าทุกครั้งที่เปลี่ยนตัวเลข (รอให้หยุดพิมพ์ก่อน)
      คนตั้งต้องเห็นผลก่อนกดบันทึก ไม่ใช่รู้ทีหลังว่าไฟล์หายไปเป็นพันไฟล์
    */
    useEffect(() => {
        if (!info || !draft || draft < info.min || draft > info.max) return;
        const t = setTimeout(() => {
            load(draft).then(d => setPreview(d.due)).catch(() => setPreview(null));
        }, 350);
        return () => clearTimeout(t);
    }, [draft, info, load]);

    const valid = !!info && !!draft && Number.isInteger(draft) && draft >= info.min && draft <= info.max;
    const changed = valid && draft !== info?.days;

    const save = async () => {
        if (!info || !draft || !valid) return;
        const commit = async () => {
            setSaving(true);
            try {
                await axios.put('/api/v1/rx/retention', { days: draft }, { headers: authHeaders() });
                message.success(`ตั้งเก็บไฟล์ ${draft} วันแล้ว`);
                const d = await load();
                setInfo(d); setDraft(d.days); setPreview(d.due);
            } catch (e) {
                message.error(axios.isAxiosError(e) ? (e.response?.data?.message ?? 'บันทึกไม่สำเร็จ') : 'บันทึกไม่สำเร็จ');
            } finally {
                setSaving(false);
            }
        };
        /* ตั้งให้สั้นลงแล้วมีไฟล์เข้าเกณฑ์ลบ ต้องยืนยันอีกครั้ง เพราะย้อนกลับไม่ได้ */
        if (preview && preview.files > 0) {
            Modal.confirm({
                title: `ยืนยันตั้งเก็บไฟล์ ${draft} วัน`,
                content: (
                    <div className="text-sm">
                        ไฟล์ภาพ <b>{preview.files.toLocaleString('th-TH')} ไฟล์</b> จาก {preview.orders.toLocaleString('th-TH')} ใบ
                        จะถูกลบในรอบถัดไป (ภายใน 6 ชั่วโมง) และ<b>กู้คืนไม่ได้</b>
                        <div className="text-gray-500 mt-2">ข้อมูลใบ ชื่อผู้ป่วย สถานะ และประวัติยังอยู่ครบ</div>
                    </div>
                ),
                okText: 'ยืนยัน', cancelText: 'ยกเลิก', okButtonProps: { danger: true },
                onOk: commit,
            });
            return;
        }
        await commit();
    };

    if (!access.ready || !info) {
        return (<><Navbar /><div className="p-6 grid place-items-center"><Spin /></div></>);
    }

    return (
        <>
            <Navbar />
            <div className="p-4 flex flex-col gap-4 max-w-3xl mx-auto">
                <Card size="small">
                    <div className="flex flex-wrap items-center gap-3">
                        <Title level={4} className="m-0! flex items-center gap-2">
                            <PiClockCounterClockwiseBold /> {RX_RETENTION_ITEM.label}
                        </Title>
                        {info.updated_at && (
                            <Text type="secondary" className="text-xs">
                                แก้ไขล่าสุด {thaiDateTime(info.updated_at)}{info.updated_by ? ` โดย ${info.updated_by}` : ''}
                            </Text>
                        )}
                    </div>
                </Card>

                <Alert
                    type="info"
                    showIcon
                    title="ลบเฉพาะไฟล์ภาพ ไม่ลบข้อมูลใบ"
                    description={
                        <ul className="m-0 pl-4 text-sm list-disc">
                            <li>ไฟล์ภาพใบสั่งยาที่อัปโหลดมาเกินจำนวนวันที่ตั้ง จะถูกลบออกจากเครื่องเก็บไฟล์อัตโนมัติทุก 6 ชั่วโมง</li>
                            <li>ข้อมูลใบ ชื่อผู้ป่วย สถานะ และประวัติว่าใครทำอะไรเมื่อไร ยังอยู่ครบ ค้นหาได้ตามเดิม</li>
                            <li>เมื่อเปิดใบที่ไฟล์ถูกลบแล้ว ผู้ใช้จะเห็นข้อความบอกว่าลบตามระยะเวลาจัดเก็บ ไม่ใช่ระบบเสีย</li>
                        </ul>
                    }
                />

                <Card size="small" title="จำนวนวันที่เก็บไฟล์">
                    <div className="flex flex-wrap items-center gap-3">
                        <Space.Compact>
                            <InputNumber
                                min={info.min} max={info.max} precision={0}
                                value={draft}
                                onChange={v => setDraft(typeof v === 'number' ? v : null)}
                                disabled={!info.can_manage}
                                status={valid ? undefined : 'error'}
                                className="w-28"
                                aria-label="จำนวนวันที่เก็บไฟล์"
                            />
                            <Space.Addon>วัน</Space.Addon>
                        </Space.Compact>
                        <Segmented
                            value={PRESETS.includes(draft ?? -1) ? draft : undefined}
                            onChange={v => setDraft(Number(v))}
                            options={PRESETS.map(d => ({ label: `${d} วัน`, value: d }))}
                            disabled={!info.can_manage}
                        />
                    </div>
                    <Text type="secondary" className="text-xs block mt-2">
                        ตั้งได้ {info.min}-{info.max} วัน · ค่าเริ่มต้น {info.default} วัน ·
                        ขั้นต่ำ {info.min} วันกันพิมพ์ผิดแล้วไฟล์ทั้งระบบถูกลบในรอบถัดไป
                    </Text>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                        <Statistic
                            title={`ไฟล์ที่จะถูกลบ (ถ้าตั้ง ${valid ? draft : '-'} วัน)`}
                            value={preview?.files ?? '-'}
                            suffix="ไฟล์"
                            styles={preview && preview.files > 0 ? { content: { color: '#cf1322' } } : undefined}
                        />
                        <Statistic title="จากใบสั่งยา" value={preview?.orders ?? '-'} suffix="ใบ" />
                        <Statistic title="พื้นที่ที่ได้คืน" value={preview ? mb(preview.bytes) : '-'} suffix="MB" />
                    </div>

                    {info.can_manage ? (
                        <div className="flex justify-end mt-4">
                            <Button
                                type="primary" icon={<PiFloppyDiskBold />}
                                disabled={!changed} loading={saving} onClick={save}
                            >
                                บันทึก
                            </Button>
                        </div>
                    ) : (
                        <Alert
                            className="mt-4" type="warning" showIcon
                            title="ดูได้อย่างเดียว · เฉพาะผู้ดูแลระบบเท่านั้นที่เปลี่ยนค่านี้ได้"
                        />
                    )}
                </Card>

                <Text type="secondary" className="text-xs">
                    {info.last_run
                        ? `รอบล่าสุด ${thaiDateTime(info.last_run.at)} · ลบ ${info.last_run.files} ไฟล์`
                            + (info.last_run.skipped ? ` · ข้าม ${info.last_run.skipped} ไฟล์ (ดูบันทึกของเซิร์ฟเวอร์)` : '')
                        : 'ยังไม่มีรอบลบตั้งแต่เปิดเซิร์ฟเวอร์ครั้งล่าสุด (รอบแรกเริ่มหลังเปิดเครื่อง 1 นาที)'}
                </Text>
            </div>
        </>
    );
}
