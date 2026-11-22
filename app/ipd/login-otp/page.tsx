'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, App, Card, Result, Switch, Tag, Typography } from 'antd';
import { FormSkeleton } from '@/app/components/Skeletons';
import Navbar from '../../components/Navbar';
import { LOGIN_OTP_ITEM } from '../../lib/menu';
import { useMenuAccess } from '../../lib/useMenuAccess';

const { Text, Title } = Typography;

/**
 * เปิด/ปิดโหมด OTP (MFA ทาง LINE OA หมอพร้อม) ตอนเข้าระบบของเจ้าหน้าที่
 *
 * เซิร์ฟเวอร์ตรวจสิทธิ์แอดมินและความพร้อมของช่องทางส่ง OTP เอง หน้านี้แค่แสดงและส่งคำขอ
 * เปิดไม่ได้เมื่อยังส่ง OTP ไม่ได้จริง ไม่งั้นทุกคนจะเข้าระบบไม่ได้ทันที
 */

interface OtpSetting {
    enabled: boolean;
    force_off: boolean;
    effective: boolean;
    transport: string;
    ready_problem: string | null;
    users_without_cid: number | null;
    updated_at: string | null;
    updated_by: string | null;
    can_manage: boolean;
}

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const thaiDateTime = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

const TRANSPORT_LABEL: Record<string, { text: string; color: string }> = {
    mophprompt: { text: 'LINE OA หมอพร้อม', color: 'green' },
    console: { text: 'console (ทดสอบ · พิมพ์ลง log เซิร์ฟเวอร์)', color: 'orange' },
};

export default function LoginOtpPage() {
    const { message, modal } = App.useApp();
    const access = useMenuAccess();
    const [setting, setSetting] = useState<OtpSetting | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        axios.get('/api/v1/system/login-otp-setting', { headers: authHeaders() })
            .then(res => setSetting(res.data?.data as OtpSetting))
            .catch(() => message.error('อ่านค่าตั้งไม่สำเร็จ'));
    }, [message]);

    if (!access.ready || !setting) {
        return (<><Navbar /><div className="p-6 max-w-2xl"><FormSkeleton rows={4} /></div></>);
    }
    if (!access.isAdmin) {
        return (<><Navbar /><Result status="403" title="เฉพาะผู้ดูแลระบบ" /></>);
    }

    const save = async (enabled: boolean) => {
        setSaving(true);
        try {
            const res = await axios.put('/api/v1/system/login-otp-setting', { enabled }, { headers: authHeaders() });
            setSetting(res.data.data);
            message.success(res.data.message ?? 'บันทึกแล้ว');
        } catch (err) {
            const r = axios.isAxiosError(err) ? err.response : undefined;
            message.error((r?.data as { message?: string } | undefined)?.message ?? 'บันทึกไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    /* เปิด = กระทบทุกคนทันที ถามยืนยันก่อน ปิดไม่ต้องถาม */
    const toggle = (next: boolean) => {
        if (!next) { void save(false); return; }
        modal.confirm({
            title: 'เปิดโหมด OTP ตอนเข้าระบบ?',
            content: (
                <div className="text-sm">
                    ผู้ใช้ทุกคนต้องกรอก OTP จาก LINE หมอพร้อมตอนเข้าระบบครั้งถัดไป
                    {setting.users_without_cid ? (
                        <div className="mt-2 text-red-600 dark:text-red-400 font-semibold">
                            มี {setting.users_without_cid} บัญชีที่ไม่มีเลขบัตรประชาชนที่ถูกต้อง บัญชีเหล่านี้จะเข้าระบบไม่ได้
                        </div>
                    ) : null}
                    <div className="mt-2 text-gray-500">คนที่เข้าระบบอยู่แล้วใช้งานต่อได้จนกว่า token จะหมดอายุ (8 ชั่วโมง)</div>
                </div>
            ),
            okText: 'เปิดโหมด OTP',
            cancelText: 'ยกเลิก',
            onOk: () => save(true),
        });
    };

    const transport = TRANSPORT_LABEL[setting.transport] ?? { text: setting.transport, color: 'default' };
    const blocked = !setting.enabled && !!setting.ready_problem;

    return (
        <>
            <Navbar />
            <div className="p-4 flex flex-col gap-4 max-w-3xl mx-auto">
                <Card size="small">
                    <div className="flex flex-wrap items-center gap-3">
                        <Title level={4} className="m-0! flex items-center gap-2">
                            <LOGIN_OTP_ITEM.icon /> {LOGIN_OTP_ITEM.label}
                        </Title>
                        <span className="ml-auto text-sm">
                            ตอนนี้ {setting.effective
                                ? <Tag color="green" className="m-0!">บังคับ OTP</Tag>
                                : <Tag className="m-0!">ไม่บังคับ OTP</Tag>}
                        </span>
                    </div>
                </Card>

                <Alert
                    type="info"
                    showIcon
                    title="ยืนยันตัวตนสองขั้น (MFA) ด้วย OTP ทาง LINE OA หมอพร้อม"
                    description={
                        <ul className="m-0 pl-4 text-sm list-disc">
                            <li>ใส่ชื่อผู้ใช้และรหัสผ่านถูกแล้ว ระบบส่งรหัส 6 หลักไปที่ LINE หมอพร้อมของเจ้าของเลขบัตรประชาชนในบัญชี</li>
                            <li>รหัสใช้ได้ 5 นาที ผิดได้ 3 ครั้งต่อรหัส ขอใหม่ได้ทุก 60 วินาที</li>
                            <li>ผู้ใช้ต้องเพิ่มเพื่อน LINE หมอพร้อมและยืนยันตัวตนไว้แล้ว ไม่งั้นจะไม่ได้รับรหัส</li>
                            <li>ใช้กับบัญชีเจ้าหน้าที่ บัญชีบริษัทผู้รับจ้างบังคับ OTP อยู่แล้วแยกต่างหาก</li>
                        </ul>
                    }
                />

                {setting.force_off && (
                    <Alert
                        type="warning" showIcon
                        title="สวิตช์ฉุกเฉินปิดโหมด OTP อยู่"
                        description="ใน .env ของเซิร์ฟเวอร์ตั้ง STAFF_OTP_FORCE_OFF=true ไว้ ค่าในหน้านี้จึงยังไม่มีผล จนกว่าจะเอาบรรทัดนั้นออกแล้ว restart"
                    />
                )}

                {blocked && (
                    <Alert type="error" showIcon title="ยังเปิดโหมด OTP ไม่ได้" description={setting.ready_problem} />
                )}

                <Card size="small" title="โหมด OTP ตอนเข้าระบบ">
                    <div className="flex items-center gap-3">
                        <Switch
                            id="login-otp-switch"
                            checked={setting.enabled}
                            loading={saving}
                            disabled={blocked}
                            onChange={toggle}
                        />
                        <span className="font-semibold">{setting.enabled ? 'เปิด' : 'ปิด'}</span>
                        <Text type="secondary" className="text-xs">
                            {setting.enabled ? 'ทุกคนต้องยืนยัน OTP ตอนเข้าระบบ' : 'เข้าระบบด้วยชื่อผู้ใช้และรหัสผ่านอย่างเดียว'}
                        </Text>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div>
                            <Text type="secondary" className="text-xs block">ช่องทางส่ง OTP</Text>
                            <Tag color={transport.color} className="m-0!">{transport.text}</Tag>
                        </div>
                        <div>
                            <Text type="secondary" className="text-xs block">บัญชีที่ไม่มีเลขบัตรประชาชนที่ถูกต้อง</Text>
                            {setting.users_without_cid === null ? '-' : (
                                <span className={setting.users_without_cid > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                                    {setting.users_without_cid} บัญชี
                                    {setting.users_without_cid > 0 && <span className="font-normal text-gray-500"> (จะเข้าระบบไม่ได้เมื่อเปิด)</span>}
                                </span>
                            )}
                        </div>
                    </div>

                    {setting.updated_at && (
                        <Text type="secondary" className="text-xs block mt-4">
                            แก้ล่าสุด {thaiDateTime(setting.updated_at)}{setting.updated_by ? ` โดย ${setting.updated_by}` : ''}
                        </Text>
                    )}
                </Card>

                <Alert
                    type="warning"
                    showIcon
                    title="ถ้าเปิดแล้วไม่มีใครเข้าระบบได้ (เช่น หมอพร้อมล่ม)"
                    description={<span className="text-sm">ตั้ง <code>STAFF_OTP_FORCE_OFF=true</code> ใน .env ของ backend แล้ว restart — ปิดโหมด OTP ทับค่าในหน้านี้ทันที</span>}
                />
            </div>
        </>
    );
}
