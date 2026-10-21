'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Button, Card, Form, Input, Alert, Typography, Steps } from 'antd';
import { PiForkKnifeBold, PiUserBold, PiLockBold, PiChatCircleTextBold } from 'react-icons/pi';
import { saveVendorSession, type VendorProfile } from '../../lib/vendorAuth';

const { Title, Text, Paragraph } = Typography;

type Step = 'credentials' | 'change_password' | 'otp';

const MIN_PASSWORD = 10;

/** ข้อความเมื่อถูกส่งกลับมาหน้านี้จากหน้าอื่น (ดู VendorShell) */
const REASONS: Record<string, { type: 'warning' | 'info'; text: string }> = {
    replaced: { type: 'warning', text: 'บัญชีนี้เข้าระบบจากเครื่องอื่นแล้ว เครื่องนี้จึงถูกออกจากระบบ หากไม่ใช่คุณ กรุณาแจ้งงานโภชนาการทันที' },
    ended: { type: 'info', text: 'หมดเวลาการใช้งาน กรุณาเข้าระบบใหม่' },
};

const errorText = (err: unknown) => axios.isAxiosError(err)
    ? err.response?.data?.message ?? 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง'
    : 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง';

/**
 * หน้าเข้าระบบสำหรับบริษัทผู้รับจ้างทำอาหาร — บัญชีรายบุคคล ยืนยันตัวตนด้วย OTP ทางหมอพร้อม
 *
 * แยกจากหน้าเข้าระบบของเจ้าหน้าที่คนละหน้าไปเลย ไม่ใช่ปุ่มสลับในหน้าเดียว
 * คนที่เข้ามาเป็นคนนอกโรงพยาบาล ไม่ควรเห็นตราหรือเมนูของระบบภายใน
 *
 * ลำดับขั้นมาจากเซิร์ฟเวอร์ทุกครั้ง (ช่อง next) หน้านี้ไม่ได้ตัดสินเองว่าข้ามขั้นไหนได้
 *   ชื่อผู้ใช้ + รหัสผ่าน → (ครั้งแรก/หลังได้รหัสชั่วคราว) ตั้งรหัสผ่านเอง → OTP จาก LINE หมอพร้อม
 */
function VendorLogin() {
    const router = useRouter();
    const reason = REASONS[useSearchParams().get('reason') ?? ''];

    const [step, setStep] = useState<Step>('credentials');
    const [pending, setPending] = useState('');
    const [name, setName] = useState('');
    const [firstTime, setFirstTime] = useState(false);
    const [sentTo, setSentTo] = useState<string | null>(null);
    // นับถอยหลังก่อนกดขอรหัสใหม่ได้ ตรงกับที่เซิร์ฟเวอร์บังคับ
    const [resendIn, setResendIn] = useState(0);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [codeForm] = Form.useForm();

    useEffect(() => {
        if (resendIn <= 0) return;
        const t = setTimeout(() => setResendIn(n => n - 1), 1000);
        return () => clearTimeout(t);
    }, [resendIn]);

    const resetToStart = () => {
        setStep('credentials');
        setPending('');
        setSentTo(null);
        setFirstTime(false);
    };

    /** ขอ OTP — ส่งไป LINE OA หมอพร้อม ของเจ้าของเลขบัตรที่ผูกกับบัญชี */
    const sendOtp = async (token: string) => {
        setSending(true);
        setError('');
        try {
            const res = await axios.post('/api/v1/vendor/login/otp/send', { pending_token: token });
            setSentTo(res.data.sent_to ?? null);
            setResendIn(Number(res.data.resend_after ?? 60));
        } catch (err) {
            if (axios.isAxiosError(err)) {
                if (err.response?.data?.code === 'PENDING_EXPIRED') resetToStart();
                if (err.response?.data?.retry_after) setResendIn(Number(err.response.data.retry_after));
            }
            setError(errorText(err));
        } finally {
            setSending(false);
        }
    };

    /** ไปขั้นถัดไปตามที่เซิร์ฟเวอร์บอก ขั้น OTP ส่งรหัสให้ทันทีไม่ต้องกดอีกปุ่ม */
    const goNext = async (next: Step, token: string) => {
        setPending(token);
        setStep(next);
        if (next === 'otp') await sendOtp(token);
    };

    const run = async (fn: () => Promise<void>) => {
        setError('');
        setLoading(true);
        try {
            await fn();
        } catch (err) {
            // ขั้นกลางหมดอายุหรือถูกล็อก ต้องเริ่มจากรหัสผ่านใหม่
            if (axios.isAxiosError(err) && (err.response?.data?.code === 'PENDING_EXPIRED' || err.response?.status === 423)) {
                resetToStart();
            }
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    };

    const submitCredentials = (v: { username: string; password: string }) => run(async () => {
        const res = await axios.post('/api/v1/vendor/login', v);
        setName(res.data.display_name ?? '');
        setFirstTime(res.data.next === 'change_password');
        await goNext(res.data.next, res.data.pending_token);
    });

    const submitNewPassword = (v: { new_password: string }) => run(async () => {
        const res = await axios.post('/api/v1/vendor/login/password', { pending_token: pending, new_password: v.new_password });
        await goNext(res.data.next, res.data.pending_token);
    });

    const submitCode = (v: { code: string }) => run(async () => {
        try {
            const res = await axios.post('/api/v1/vendor/login/otp', { pending_token: pending, code: v.code.trim() });
            saveVendorSession(res.data.token, res.data.data as VendorProfile);
            router.push('/vendor/report');
        } finally {
            codeForm.resetFields();
        }
    });

    const stepIndex = { credentials: 0, change_password: 1, otp: firstTime ? 2 : 1 }[step];

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#141414] px-4 py-8">
            <Card className="w-full max-w-md shadow-lg">
                <div className="text-center mb-5">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#006b5f] text-white mb-3">
                        <PiForkKnifeBold size={28} />
                    </div>
                    <Title level={4} className="mb-1!">ระบบรายงานผู้รับจ้างทำอาหาร</Title>
                    <Text type="secondary" className="text-xs">
                        บัญชีส่วนตัว ใช้ได้เฉพาะเจ้าของบัญชี ห้ามให้ผู้อื่นใช้แทน
                    </Text>
                </div>

                {step !== 'credentials' && (
                    <Steps
                        size="small"
                        className="mb-5!"
                        current={stepIndex}
                        items={firstTime
                            ? [{ title: 'รหัสผ่าน' }, { title: 'ตั้งรหัสใหม่' }, { title: 'OTP หมอพร้อม' }]
                            : [{ title: 'รหัสผ่าน' }, { title: 'OTP หมอพร้อม' }]}
                    />
                )}

                {reason && step === 'credentials' && !error && (
                    <Alert type={reason.type} showIcon className="mb-4" title={reason.text} />
                )}
                {error && <Alert type="error" showIcon className="mb-4" title={error} />}

                {step === 'credentials' && (
                    <Form layout="vertical" onFinish={submitCredentials} requiredMark={false} disabled={loading}>
                        <Form.Item name="username" label="ชื่อผู้ใช้"
                            rules={[{ required: true, message: 'กรุณากรอกชื่อผู้ใช้' }]}>
                            <Input size="large" prefix={<PiUserBold className="text-gray-400" />} autoComplete="username" />
                        </Form.Item>
                        <Form.Item name="password" label="รหัสผ่าน"
                            rules={[{ required: true, message: 'กรุณากรอกรหัสผ่าน' }]}>
                            <Input.Password size="large" prefix={<PiLockBold className="text-gray-400" />} autoComplete="current-password" />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                            ถัดไป
                        </Button>
                    </Form>
                )}

                {step === 'change_password' && (
                    <>
                        <Paragraph className="text-sm">
                            {name && <>สวัสดีคุณ <strong>{name}</strong><br /></>}
                            รหัสที่ได้จากโรงพยาบาลเป็นรหัสชั่วคราว กรุณาตั้งรหัสผ่านของคุณเอง
                            รหัสนี้มีคุณรู้คนเดียว แม้แต่เจ้าหน้าที่โรงพยาบาลก็ไม่รู้
                        </Paragraph>
                        <Form layout="vertical" onFinish={submitNewPassword} requiredMark={false} disabled={loading}>
                            <Form.Item name="new_password" label="รหัสผ่านใหม่"
                                extra={`อย่างน้อย ${MIN_PASSWORD} ตัว มีทั้งตัวอักษรและตัวเลข`}
                                rules={[
                                    { required: true, message: 'กรุณาตั้งรหัสผ่าน' },
                                    { min: MIN_PASSWORD, message: `ต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` },
                                    { pattern: /(?=.*[A-Za-z])(?=.*\d)/, message: 'ต้องมีทั้งตัวอักษรและตัวเลข' },
                                ]}>
                                <Input.Password size="large" autoComplete="new-password" />
                            </Form.Item>
                            <Form.Item name="confirm" label="ยืนยันรหัสผ่านใหม่" dependencies={['new_password']}
                                rules={[
                                    { required: true, message: 'กรุณากรอกอีกครั้ง' },
                                    ({ getFieldValue }) => ({
                                        validator: (_, v) => !v || v === getFieldValue('new_password')
                                            ? Promise.resolve()
                                            : Promise.reject(new Error('รหัสผ่านสองช่องไม่ตรงกัน')),
                                    }),
                                ]}>
                                <Input.Password size="large" autoComplete="new-password" />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                                บันทึกรหัสผ่าน
                            </Button>
                        </Form>
                    </>
                )}

                {step === 'otp' && (
                    <>
                        <Paragraph className="text-sm mb-2!">
                            <PiChatCircleTextBold className="inline -mt-0.5 mr-1 text-[#06c755]" />
                            {sending
                                ? 'กำลังส่งรหัส OTP ไปที่ LINE หมอพร้อม…'
                                : sentTo
                                    ? <>ส่งรหัส OTP ไปที่ <strong>LINE หมอพร้อม</strong> ของเลขบัตร <span className="font-mono whitespace-nowrap">{sentTo}</span> แล้ว</>
                                    : 'ยังส่งรหัสไม่สำเร็จ กดขอรหัสอีกครั้ง'}
                        </Paragraph>
                        <Text type="secondary" className="block text-xs mb-3">
                            เปิดแอป LINE ดูข้อความจาก &quot;หมอพร้อม&quot; รหัสใช้ได้ 5 นาที
                            · ต้องเพิ่มเพื่อน LINE หมอพร้อมและยืนยันตัวตนด้วยเลขบัตรนี้ไว้ก่อน
                        </Text>
                        <Form form={codeForm} layout="vertical" onFinish={submitCode} requiredMark={false} disabled={loading}>
                            <Form.Item name="code"
                                rules={[
                                    { required: true, message: 'กรุณากรอกรหัส OTP 6 หลัก' },
                                    { pattern: /^\d{6}$/, message: 'รหัสเป็นตัวเลข 6 หลัก' },
                                ]}>
                                <Input.OTP size="large" length={6} autoFocus formatter={s => s.replace(/\D/g, '')} />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" size="large" block loading={loading} disabled={!sentTo}>
                                เข้าสู่ระบบ
                            </Button>
                        </Form>
                        <Button type="link" block className="mt-1" loading={sending}
                            disabled={resendIn > 0} onClick={() => sendOtp(pending)}>
                            {resendIn > 0 ? `ขอรหัสใหม่ได้ใน ${resendIn} วินาที` : 'ไม่ได้รับรหัส? ขอรหัสใหม่'}
                        </Button>
                    </>
                )}

                <Text type="secondary" className="block text-center text-[11px] mt-4">
                    กรอกรหัสผิดติดกัน 5 ครั้ง บัญชีจะถูกล็อก 15 นาที · ใช้ได้ทีละเครื่อง
                    <br />
                    ลืมรหัสผ่าน หรือไม่ได้รับ OTP ในหมอพร้อม ติดต่องานโภชนาการของโรงพยาบาล
                </Text>
            </Card>
        </div>
    );
}

/* useSearchParams ต้องอยู่ใต้ Suspense ไม่งั้น next build ฟ้องตอน prerender */
export default function VendorLoginPage() {
    return (
        <Suspense fallback={null}>
            <VendorLogin />
        </Suspense>
    );
}
