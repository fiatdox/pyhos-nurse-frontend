'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Button, Card, Form, Input, Alert, Typography } from 'antd';
import { PiForkKnifeBold, PiUserBold, PiLockBold } from 'react-icons/pi';
import { saveVendorSession, type VendorProfile } from '../../lib/vendorAuth';

const { Title, Text } = Typography;

/**
 * หน้าเข้าระบบสำหรับบริษัทผู้รับจ้างทำอาหาร
 *
 * แยกจากหน้าเข้าระบบของเจ้าหน้าที่คนละหน้าไปเลย ไม่ใช่ปุ่มสลับในหน้าเดียว
 * คนที่เข้ามาเป็นคนนอกโรงพยาบาล ไม่ควรเห็นตราหรือเมนูของระบบภายใน
 * และไม่ควรมีช่องทางให้เผลอกรอกบัญชีเจ้าหน้าที่ลงในฟอร์มที่ยิงไปคนละ endpoint
 */
export default function VendorLoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (values: { username: string; password: string }) => {
        setError('');
        setLoading(true);
        try {
            const res = await axios.post('/api/v1/vendor/login', values);
            if (res.data?.success) {
                saveVendorSession(res.data.token, res.data.data as VendorProfile);
                router.push('/vendor/report');
                return;
            }
            setError('เข้าระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        } catch (err) {
            /*
              แสดงข้อความจากเซิร์ฟเวอร์ตรงๆ เพราะฝั่งนั้นตั้งใจเลือกคำไว้แล้ว
              ทั้งกรณีรหัสผ่านผิด (ไม่บอกว่าผิดที่ช่องไหน) และกรณีบัญชีถูกล็อก
            */
            const message = axios.isAxiosError(err)
                ? err.response?.data?.message ?? 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง'
                : 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่อีกครั้ง';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#141414] px-4">
            <Card className="w-full max-w-md shadow-lg">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#006b5f] text-white mb-3">
                        <PiForkKnifeBold size={28} />
                    </div>
                    <Title level={4} className="mb-1!">ระบบรายงานผู้รับจ้างทำอาหาร</Title>
                    <Text type="secondary" className="text-xs">
                        สำหรับบริษัทคู่สัญญา ใช้บัญชีที่โรงพยาบาลออกให้เท่านั้น
                    </Text>
                </div>

                {error && <Alert type="error" showIcon className="mb-4" title={error} />}

                <Form layout="vertical" onFinish={handleSubmit} requiredMark={false} disabled={loading}>
                    <Form.Item
                        name="username"
                        label="ชื่อผู้ใช้"
                        rules={[{ required: true, message: 'กรุณากรอกชื่อผู้ใช้' }]}
                    >
                        <Input size="large" prefix={<PiUserBold className="text-gray-400" />} autoComplete="username" />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="รหัสผ่าน"
                        rules={[{ required: true, message: 'กรุณากรอกรหัสผ่าน' }]}
                    >
                        <Input.Password size="large" prefix={<PiLockBold className="text-gray-400" />} autoComplete="current-password" />
                    </Form.Item>

                    <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                        เข้าสู่ระบบ
                    </Button>
                </Form>

                <Text type="secondary" className="block text-center text-[11px] mt-4">
                    กรอกรหัสผ่านผิดติดกัน 5 ครั้ง บัญชีจะถูกล็อก 15 นาที
                    <br />
                    ลืมรหัสผ่านหรือบัญชีถูกล็อก ติดต่องานโภชนาการของโรงพยาบาล
                </Text>
            </Card>
        </div>
    );
}
