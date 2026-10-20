'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, App, Card, InputNumber, Segmented, Space, Spin, Statistic, Typography } from 'antd';
import { PiClockCounterClockwiseBold } from 'react-icons/pi';
import Navbar from '../../components/Navbar';
import { RX_RETENTION_ITEM } from '../../lib/menu';
import { useMenuAccess } from '../../lib/useMenuAccess';

const { Text, Title } = Typography;

/**
 * ระยะเวลาจัดเก็บไฟล์ใบสั่งยา
 *
 * ค่าจริงตั้งใน .env ของเซิร์ฟเวอร์ (RX_FILE_RETENTION_DAYS) ไม่ได้ตั้งจากหน้านี้
 * หน้านี้มีไว้ดูว่าใช้ค่าอะไรอยู่ และลองนับว่าถ้าเปลี่ยนเป็นกี่วันจะมีไฟล์ถูกลบเท่าไร
 * ก่อนไปแก้ .env จริง เพราะการลบย้อนกลับไม่ได้
 */

interface RetentionInfo {
    days: number;
    min: number;
    max: number;
    default: number;
    env_key: string;
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

    const load = useCallback(async (days?: number) => {
        const res = await axios.get('/api/v1/rx/retention', {
            headers: authHeaders(), params: days ? { days } : undefined,
        });
        return res.data?.data as RetentionInfo;
    }, []);

    useEffect(() => {
        load().then(d => { setInfo(d); setDraft(d.days); setPreview(d.due); })
            .catch(() => message.error('อ่านค่าไม่สำเร็จ'));
    }, [load, message]);

    /* นับล่วงหน้าทุกครั้งที่เปลี่ยนตัวเลข (รอให้หยุดพิมพ์ก่อน) */
    useEffect(() => {
        if (!info || !draft || draft < info.min || draft > info.max) return;
        const t = setTimeout(() => {
            load(draft).then(d => setPreview(d.due)).catch(() => setPreview(null));
        }, 350);
        return () => clearTimeout(t);
    }, [draft, info, load]);

    const valid = !!info && !!draft && Number.isInteger(draft) && draft >= info.min && draft <= info.max;

    if (!access.ready || !info) {
        return (<><Navbar /><div className="p-6 grid place-items-center"><Spin /></div></>);
    }

    const trying = valid && draft !== info.days;

    return (
        <>
            <Navbar />
            <div className="p-4 flex flex-col gap-4 max-w-3xl mx-auto">
                <Card size="small">
                    <div className="flex flex-wrap items-center gap-3">
                        <Title level={4} className="m-0! flex items-center gap-2">
                            <PiClockCounterClockwiseBold /> {RX_RETENTION_ITEM.label}
                        </Title>
                        <span className="ml-auto text-sm">
                            ใช้อยู่ตอนนี้ <b className="text-lg">{info.days}</b> วัน
                        </span>
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

                <Card size="small" title="วิธีเปลี่ยนจำนวนวัน">
                    <div className="text-sm flex flex-col gap-2">
                        <span>แก้ในไฟล์ <code>.env</code> ของเซิร์ฟเวอร์ (backend) แล้ว restart เซิร์ฟเวอร์</span>
                        <pre className="m-0 px-3 py-2 rounded bg-gray-100 text-sm overflow-x-auto">{`${info.env_key}=${info.days}`}</pre>
                        <Text type="secondary" className="text-xs">
                            ตั้งได้ {info.min}-{info.max} วัน · ไม่ตั้งหรือค่าผิด = {info.default} วัน
                            (ค่าที่ผิดจะไม่ถูกใช้ตรง ๆ เพราะพิมพ์ผิดเป็น 1 แปลว่าไฟล์ทั้งระบบหายในรอบถัดไป)
                        </Text>
                    </div>
                </Card>

                <Card size="small" title="ลองนับก่อนแก้ .env">
                    <div className="flex flex-wrap items-center gap-3">
                        <Space.Compact>
                            <InputNumber
                                min={info.min} max={info.max} precision={0}
                                value={draft}
                                onChange={v => setDraft(typeof v === 'number' ? v : null)}
                                status={valid ? undefined : 'error'}
                                className="w-28"
                                aria-label="จำนวนวันที่ต้องการลองนับ"
                            />
                            <Space.Addon>วัน</Space.Addon>
                        </Space.Compact>
                        <Segmented
                            value={PRESETS.includes(draft ?? -1) ? draft : undefined}
                            onChange={v => setDraft(Number(v))}
                            options={PRESETS.map(d => ({ label: `${d} วัน`, value: d }))}
                        />
                    </div>
                    <Text type="secondary" className="text-xs block mt-2">
                        {trying
                            ? `ตัวเลขด้านล่างคือผลถ้าเปลี่ยนเป็น ${draft} วัน ยังไม่มีอะไรเปลี่ยน จนกว่าจะแก้ .env และ restart`
                            : 'ตัวเลขด้านล่างคือไฟล์ที่จะถูกลบในรอบถัดไปตามค่าที่ใช้อยู่'}
                    </Text>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                        <Statistic
                            title={`ไฟล์ที่จะถูกลบ (ที่ ${valid ? draft : '-'} วัน)`}
                            value={preview?.files ?? '-'}
                            suffix="ไฟล์"
                            styles={preview && preview.files > 0 ? { content: { color: '#cf1322' } } : undefined}
                        />
                        <Statistic title="จากใบสั่งยา" value={preview?.orders ?? '-'} suffix="ใบ" />
                        <Statistic title="พื้นที่ที่ได้คืน" value={preview ? mb(preview.bytes) : '-'} suffix="MB" />
                    </div>
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
