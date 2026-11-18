'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, App, Button, Card, Radio, Result, Tag, Typography } from 'antd';
import { FormSkeleton } from '@/app/components/Skeletons';
import Navbar from '../../components/Navbar';
import { RX_OCR_ITEM } from '../../lib/menu';
import { useMenuAccess } from '../../lib/useMenuAccess';

const { Text, Title } = Typography;

/**
 * เลือกเครื่องมือ OCR ที่ใช้อ่าน HN จากภาพใบสั่งยา
 *
 * ค่าเก็บที่เซิร์ฟเวอร์ (system_settings) มีผลกับทุกหอทันที ไม่ต้อง restart
 * เซิร์ฟเวอร์ตรวจสิทธิ์แอดมินเอง หน้านี้ซ่อนปุ่มให้แค่ความสะดวก
 */

type Engine = 'tesseract' | 'paddle';

interface OcrSetting {
    engine: Engine;
    updated_at: string | null;
    updated_by: string | null;
    can_manage: boolean;
}

const ENGINES: { value: Engine; title: string; detail: string[] }[] = [
    {
        value: 'tesseract',
        title: 'Tesseract',
        detail: [
            'ตัวเดิมที่ใช้มาตั้งแต่เริ่มระบบ',
            'บังคับให้อ่านเฉพาะตัวเลข',
            'ลายมือหรือภาพเอียงมักได้เลขเกินมาปน',
        ],
    },
    {
        value: 'paddle',
        title: 'PaddleOCR (PP-OCRv6 tiny)',
        detail: [
            'อ่านข้อความทั้งภาพก่อน แล้วค่อยคัดเฉพาะเลข · ภาพทดสอบได้เลขปนน้อยกว่า Tesseract (ยังไม่ได้วัดกับใบจริง)',
            'ครั้งแรกหลังเปิดเซิร์ฟเวอร์ใช้เวลาโหลดราว 1 วินาที ครั้งต่อไปเร็ว',
            'ถ้าใช้ไม่ได้ระบบจะถอยไปใช้ Tesseract เองในคำขอเดียวกัน พยาบาลไม่ต้องทำอะไร',
        ],
    },
];

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const thaiDateTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function RxOcrPage() {
    const { message } = App.useApp();
    const access = useMenuAccess();
    const [setting, setSetting] = useState<OcrSetting | null>(null);
    const [draft, setDraft] = useState<Engine>('tesseract');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get('/api/v1/system/ocr-setting', { headers: authHeaders() })
            .then(res => {
                const d = res.data?.data as OcrSetting;
                setSetting(d);
                setDraft(d.engine);
            })
            .catch(() => message.error('อ่านค่าตั้งไม่สำเร็จ'));
    }, [message]);

    if (!access.ready || !setting) {
        return (<><Navbar /><div className="p-6 max-w-2xl"><FormSkeleton rows={4} /></div></>);
    }
    if (!access.isAdmin) {
        return (<><Navbar /><Result status="403" title="เฉพาะผู้ดูแลระบบ" /></>);
    }

    const save = async () => {
        setSaving(true);
        try {
            const res = await axios.put('/api/v1/system/ocr-setting', { engine: draft }, { headers: authHeaders() });
            setSetting(res.data.data);
            message.success(res.data.message ?? 'บันทึกแล้ว');
        } catch (err) {
            const r = axios.isAxiosError(err) ? err.response : undefined;
            message.error((r?.data as { message?: string } | undefined)?.message ?? 'บันทึกไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Navbar />
            <div className="p-4 flex flex-col gap-4 max-w-3xl mx-auto">
                <Card size="small">
                    <div className="flex flex-wrap items-center gap-3">
                        <Title level={4} className="m-0! flex items-center gap-2">
                            <RX_OCR_ITEM.icon /> {RX_OCR_ITEM.label}
                        </Title>
                        <span className="ml-auto text-sm">
                            ใช้อยู่ตอนนี้ <Tag color="green" className="m-0!">
                                {ENGINES.find(e => e.value === setting.engine)?.title}
                            </Tag>
                        </span>
                    </div>
                </Card>

                <Alert
                    type="info"
                    showIcon
                    title="OCR เป็นทางสุดท้ายของการอ่าน HN"
                    description={
                        <ul className="m-0 pl-4 text-sm list-disc">
                            <li>ระบบอ่านจากข้อความใน PDF และบาร์โค้ดก่อน ใช้ OCR เมื่อสองทางนี้อ่านไม่ได้</li>
                            <li>ทุกเลขที่อ่านได้ยังต้องตรงกับผู้ป่วยที่นอนอยู่ตึกที่เลือก และพยาบาลต้องกดยืนยันเองเสมอ</li>
                            <li>เปลี่ยนแล้วมีผลกับทุกหอทันที ไม่ต้อง restart เซิร์ฟเวอร์</li>
                        </ul>
                    }
                />

                <Card size="small" title="เลือกเครื่องมือ OCR">
                    <Radio.Group value={draft} onChange={e => setDraft(e.target.value)} className="w-full">
                        <div className="flex flex-col gap-3">
                            {ENGINES.map(e => (
                                <label
                                    key={e.value}
                                    className={`rounded border p-3 cursor-pointer transition-colors ${draft === e.value
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-[#162312]'
                                        : 'border-gray-200 dark:border-gray-700'}`}
                                >
                                    <Radio value={e.value} id={`ocr-${e.value}`}>
                                        <span className="font-semibold">{e.title}</span>
                                        {setting.engine === e.value && <Tag className="m-0! ml-2!">ใช้อยู่</Tag>}
                                    </Radio>
                                    <ul className="m-0 mt-1 pl-10 text-xs text-gray-500 list-disc">
                                        {e.detail.map(d => <li key={d}>{d}</li>)}
                                    </ul>
                                </label>
                            ))}
                        </div>
                    </Radio.Group>
                    <div className="flex items-center gap-3 mt-4">
                        <Button type="primary" onClick={save} loading={saving} disabled={draft === setting.engine}>
                            บันทึก
                        </Button>
                        {setting.updated_at && (
                            <Text type="secondary" className="text-xs">
                                แก้ล่าสุด {thaiDateTime(setting.updated_at)}{setting.updated_by ? ` โดย ${setting.updated_by}` : ''}
                            </Text>
                        )}
                    </div>
                </Card>
            </div>
        </>
    );
}
