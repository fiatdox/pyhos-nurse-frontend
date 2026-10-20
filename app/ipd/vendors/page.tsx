'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
    Button, Card, Form, Input, Modal, Select, Switch, Table, Tag, Typography, Alert, Empty, Space,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    PiBuildingsBold, PiPlusBold, PiPencilSimpleBold, PiKeyBold, PiLockOpenBold, PiUserPlusBold,
} from 'react-icons/pi';
import { getAuthHeaders } from '../../lib/auth';

const { Title, Text } = Typography;

interface VendorAccount {
    vendor_account_id: number;
    username: string;
    display_name: string;
    is_active: boolean;
    locked: boolean;
    locked_until: string | null;
    failed_count: number;
    last_login_at: string | null;
}

interface FoodType {
    food_type_id: number;
    food_type_name: string;
}

interface Vendor {
    vendor_id: number;
    vendor_name: string;
    tax_id: string | null;
    contact_name: string | null;
    contact_tel: string | null;
    is_active: boolean;
    accounts: VendorAccount[];
    food_types: FoodType[];
}

const MIN_PASSWORD = 10;

/**
 * จัดการบริษัทผู้รับจ้างทำอาหารและบัญชีเข้าระบบของบริษัท — เฉพาะผู้ดูแลระบบ
 *
 * เซิร์ฟเวอร์ตรวจสิทธิ์เองอยู่แล้วทุก endpoint หน้านี้แค่ทำให้ใช้งานได้สะดวก
 * ไม่ได้เป็นด่านความปลอดภัย ถ้าหน้านี้พลาดก็ยังทะลุไปทำอะไรไม่ได้
 */
export default function VendorAdminPage() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
    const [loading, setLoading] = useState(false);
    const [denied, setDenied] = useState(false);

    const [vendorModal, setVendorModal] = useState<Vendor | 'new' | null>(null);
    const [accountModal, setAccountModal] = useState<Vendor | null>(null);
    const [passwordModal, setPasswordModal] = useState<VendorAccount | null>(null);

    const [vendorForm] = Form.useForm();
    const [accountForm] = Form.useForm();
    const [passwordForm] = Form.useForm();

    const headers = useCallback(() => ({ ...getAuthHeaders(), 'Content-Type': 'application/json' }), []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [v, t] = await Promise.all([
                axios.get('/api/v1/vendor-admin/vendors', { headers: headers() }),
                axios.post('/api/v1/nutrition/food-type-prices', {}, { headers: headers() }).catch(() => null),
            ]);
            setVendors(v.data?.data ?? []);

            /*
              เอาเฉพาะประเภทที่คิดเงินได้ ไม่รวมงดอาหาร (NPO)

              งดอาหารไม่มีของออกจากครัวจึงไม่มียอดให้บริษัทดู ถ้าเลือกได้
              จะมีคนเผลอผูกแล้วงงว่าทำไมประเภทนี้ยอดเป็นศูนย์ตลอด
              รวมกับประเภทที่ผูกไว้แล้วด้วย เผื่อวันหนึ่งมีประเภทที่ถูกปิดใช้งาน
              จะได้ยังเห็นว่าบริษัทผูกอะไรอยู่ ไม่ใช่หายไปเงียบๆ จากช่องเลือก
            */
            const billable: FoodType[] = (t?.data?.data?.types ?? [])
                .filter((x: { billable?: boolean }) => x.billable !== false);
            const fromVendors = (v.data?.data ?? []).flatMap((x: Vendor) => x.food_types);
            const merged = new Map<number, string>();
            for (const f of [...billable, ...fromVendors]) merged.set(f.food_type_id, f.food_type_name);
            setFoodTypes([...merged].map(([id, name]) => ({ food_type_id: id, food_type_name: name }))
                .sort((a, b) => a.food_type_id - b.food_type_id));
        } catch (err) {
            if (axios.isAxiosError(err) && (err.response?.status === 403 || err.response?.status === 401)) {
                setDenied(true);
                return;
            }
            Swal.fire({ icon: 'error', title: 'ดึงข้อมูลไม่สำเร็จ', timer: 2500, showConfirmButton: false });
        } finally {
            setLoading(false);
        }
    }, [headers]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const call = async (fn: () => Promise<unknown>, okText: string) => {
        try {
            await fn();
            await fetchAll();
            Swal.fire({ icon: 'success', title: okText, timer: 1600, showConfirmButton: false });
            return true;
        } catch (err) {
            const message = axios.isAxiosError(err)
                ? err.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง'
                : 'กรุณาลองใหม่อีกครั้ง';
            Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: message });
            return false;
        }
    };

    const saveVendor = async () => {
        let values;
        // validateFields ปฏิเสธด้วยอ็อบเจ็กต์ ไม่ใช่ Error ข้อความเตือนขึ้นใต้ช่องอยู่แล้ว
        try { values = await vendorForm.validateFields(); } catch { return; }

        const body = vendorModal === 'new' ? values : { ...values, vendor_id: vendorModal!.vendor_id };
        const ok = await call(() => axios.put('/api/v1/vendor-admin/vendor', body, { headers: headers() }), 'บันทึกแล้ว');
        if (ok) setVendorModal(null);
    };

    const saveFoodTypes = async (vendor: Vendor, ids: number[]) => {
        await call(
            () => axios.put('/api/v1/vendor-admin/food-types',
                { vendor_id: vendor.vendor_id, food_type_ids: ids }, { headers: headers() }),
            'บันทึกประเภทอาหารแล้ว',
        );
    };

    const createAccount = async () => {
        let values;
        try { values = await accountForm.validateFields(); } catch { return; }

        const ok = await call(
            () => axios.post('/api/v1/vendor-admin/account',
                { ...values, vendor_id: accountModal!.vendor_id }, { headers: headers() }),
            'เปิดบัญชีแล้ว',
        );
        if (ok) setAccountModal(null);
    };

    const setPassword = async () => {
        let values;
        try { values = await passwordForm.validateFields(); } catch { return; }

        const ok = await call(
            () => axios.patch('/api/v1/vendor-admin/account',
                { vendor_account_id: passwordModal!.vendor_account_id, password: values.password },
                { headers: headers() }),
            'ตั้งรหัสผ่านใหม่แล้ว',
        );
        if (ok) setPasswordModal(null);
    };

    const patchAccount = (acc: VendorAccount, body: Record<string, unknown>, okText: string) =>
        call(() => axios.patch('/api/v1/vendor-admin/account',
            { vendor_account_id: acc.vendor_account_id, ...body }, { headers: headers() }), okText);

    const accountColumns = (): ColumnsType<VendorAccount> => [
        {
            title: 'ชื่อผู้ใช้', dataIndex: 'username', key: 'u', width: 180,
            render: (v: string, r) => (
                <div className="leading-tight">
                    <span className="font-mono font-semibold">{v}</span>
                    <div className="text-[11px] text-gray-400">{r.display_name}</div>
                </div>
            ),
        },
        {
            title: 'สถานะ', key: 's', width: 160,
            render: (_, r) => (
                <Space size={4} wrap>
                    <Tag color={r.is_active ? 'green' : 'default'}>{r.is_active ? 'เปิดใช้' : 'ปิดใช้'}</Tag>
                    {r.locked && <Tag color="red">ถูกล็อกถึง {r.locked_until}</Tag>}
                    {!r.locked && r.failed_count > 0 && (
                        <Tag color="orange">ผิด {r.failed_count} ครั้ง</Tag>
                    )}
                </Space>
            ),
        },
        {
            title: 'เข้าระบบล่าสุด', dataIndex: 'last_login_at', key: 'l', width: 150,
            render: (v: string | null) => v ?? <span className="text-gray-300">ยังไม่เคยเข้า</span>,
        },
        {
            title: '', key: 'a', width: 260, align: 'right',
            render: (_, r) => (
                <Space size={4} wrap>
                    <Button size="small" icon={<PiKeyBold />} onClick={() => setPasswordModal(r)}>
                        ตั้งรหัสผ่าน
                    </Button>
                    {r.locked && (
                        <Button size="small" icon={<PiLockOpenBold />} onClick={() => patchAccount(r, { unlock: true }, 'ปลดล็อกแล้ว')}>
                            ปลดล็อก
                        </Button>
                    )}
                    <Switch
                        size="small"
                        checked={r.is_active}
                        onChange={checked => patchAccount(r, { is_active: checked }, checked ? 'เปิดใช้บัญชีแล้ว' : 'ปิดใช้บัญชีแล้ว')}
                    />
                </Space>
            ),
        },
    ];

    if (denied) {
        return (
            <div className="p-4 max-w-3xl mx-auto">
                <Alert type="error" showIcon title="เฉพาะผู้ดูแลระบบเท่านั้น"
                    description="การเปิดบัญชีให้บุคคลภายนอกต้องทำโดยผู้ดูแลระบบ หากต้องการเปิดบัญชีให้บริษัท กรุณาติดต่อผู้ดูแลระบบ" />
            </div>
        );
    }

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
                <PiBuildingsBold size={22} className="text-[#006b5f]" />
                <Title level={4} className="m-0! mr-auto">บริษัทผู้รับจ้างทำอาหาร</Title>
                <Button type="primary" icon={<PiPlusBold />}
                    onClick={() => setVendorModal('new')}>
                    เพิ่มบริษัท
                </Button>
            </div>

            <Alert
                type="info"
                showIcon
                className="mb-4"
                title="บัญชีของบริษัทแยกจากบัญชีเจ้าหน้าที่โดยสิ้นเชิง"
                description="บริษัทเข้าระบบที่ /vendor/login และเห็นได้เฉพาะยอดของประเภทอาหารที่ผูกไว้ให้เท่านั้น ไม่เห็นข้อมูลผู้ป่วยหรือเมนูใดๆ ของโรงพยาบาล — ถ้าไม่ผูกประเภทอาหาร บริษัทจะเห็นรายงานเปล่า"
            />

            {vendors.length === 0 && !loading && (
                <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีบริษัทในระบบ" /></Card>
            )}

            {vendors.map(v => (
                <Card key={v.vendor_id} className="mb-4" loading={loading}>
                    <div className="flex flex-wrap items-start gap-3 mb-3">
                        <div className="min-w-0 mr-auto">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-base">{v.vendor_name}</span>
                                {!v.is_active && <Tag color="default">ปิดใช้งาน</Tag>}
                            </div>
                            <Text type="secondary" className="text-xs">
                                {[v.tax_id && `เลขผู้เสียภาษี ${v.tax_id}`, v.contact_name, v.contact_tel]
                                    .filter(Boolean).join(' · ') || 'ยังไม่ได้กรอกข้อมูลติดต่อ'}
                            </Text>
                        </div>
                        <Button size="small" icon={<PiPencilSimpleBold />}
                            onClick={() => setVendorModal(v)}>
                            แก้ไข
                        </Button>
                        <Button size="small" type="primary" ghost icon={<PiUserPlusBold />}
                            onClick={() => setAccountModal(v)}>
                            เปิดบัญชี
                        </Button>
                    </div>

                    <div className="mb-3">
                        <Text className="text-xs text-gray-500 block mb-1">ประเภทอาหารที่รับผิดชอบ</Text>
                        <Select
                            mode="multiple"
                            className="w-full"
                            placeholder="เลือกประเภทอาหาร — ถ้าไม่เลือก บริษัทจะเห็นรายงานเปล่า"
                            value={v.food_types.map(f => f.food_type_id)}
                            options={foodTypes.map(f => ({ value: f.food_type_id, label: f.food_type_name }))}
                            onChange={ids => saveFoodTypes(v, ids)}
                        />
                    </div>

                    <Table
                        rowKey="vendor_account_id"
                        size="small"
                        bordered
                        pagination={false}
                        columns={accountColumns()}
                        dataSource={v.accounts}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีบัญชีเข้าระบบ" /> }}
                    />
                </Card>
            ))}

            <Modal
                open={vendorModal !== null}
                title={vendorModal === 'new' ? 'เพิ่มบริษัท' : 'แก้ไขบริษัท'}
                onCancel={() => setVendorModal(null)}
                onOk={saveVendor}
                okText="บันทึก"
                cancelText="ยกเลิก"
                destroyOnHidden
            >
                {/*
                  ค่าตั้งต้นมาทาง initialValues ไม่ใช่ setFieldsValue เพราะ modal
                  ใช้ destroyOnHidden ฟอร์มจึงเกิดใหม่ทุกครั้งที่เปิด
                  ถ้าสั่ง setFieldsValue ตอนกดปุ่ม ฟอร์มยังไม่ถูก mount antd จะเตือน
                  ว่า useForm ไม่ได้ต่อกับ Form ใด แล้วค่าที่ตั้งก็หายไปเฉยๆ
                */}
                <Form
                    form={vendorForm}
                    layout="vertical"
                    requiredMark={false}
                    initialValues={vendorModal === 'new' || vendorModal === null
                        ? { is_active: true }
                        : vendorModal}
                >
                    <Form.Item name="vendor_name" label="ชื่อบริษัท"
                        rules={[{ required: true, message: 'กรุณากรอกชื่อบริษัท' }]}>
                        <Input maxLength={255} />
                    </Form.Item>
                    <Form.Item name="tax_id" label="เลขประจำตัวผู้เสียภาษี">
                        <Input maxLength={20} />
                    </Form.Item>
                    <Form.Item name="contact_name" label="ผู้ประสานงาน">
                        <Input maxLength={150} />
                    </Form.Item>
                    <Form.Item name="contact_tel" label="โทรศัพท์">
                        <Input maxLength={50} />
                    </Form.Item>
                    {vendorModal !== 'new' && (
                        <Form.Item name="is_active" label="เปิดใช้งาน" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    )}
                </Form>
            </Modal>

            <Modal
                open={accountModal !== null}
                title={`เปิดบัญชีให้ ${accountModal?.vendor_name ?? ''}`}
                onCancel={() => setAccountModal(null)}
                onOk={createAccount}
                okText="เปิดบัญชี"
                cancelText="ยกเลิก"
                destroyOnHidden
            >
                <Alert type="warning" showIcon className="mb-3"
                    title="รหัสผ่านนี้จะดูย้อนหลังไม่ได้"
                    description="ระบบเก็บเฉพาะค่าที่เข้ารหัสแล้ว บันทึกรหัสผ่านไว้ก่อนกดเปิดบัญชี แล้วส่งให้บริษัทด้วยช่องทางที่ปลอดภัย" />
                <Form form={accountForm} layout="vertical" requiredMark={false}>
                    <Form.Item name="username" label="ชื่อผู้ใช้"
                        rules={[
                            { required: true, message: 'กรุณากรอกชื่อผู้ใช้' },
                            { pattern: /^[a-zA-Z0-9._-]{4,64}$/, message: 'ยาว 4-64 ตัว ใช้ได้เฉพาะ a-z 0-9 . _ -' },
                        ]}>
                        <Input autoComplete="off" />
                    </Form.Item>
                    <Form.Item name="display_name" label="ชื่อที่ใช้แสดง"
                        rules={[{ required: true, message: 'กรุณากรอกชื่อที่ใช้แสดง' }]}>
                        <Input maxLength={150} placeholder="เช่น ฝ่ายบัญชี" />
                    </Form.Item>
                    <Form.Item name="password" label="รหัสผ่าน"
                        rules={[
                            { required: true, message: 'กรุณากรอกรหัสผ่าน' },
                            { min: MIN_PASSWORD, message: `ต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` },
                        ]}>
                        <Input.Password autoComplete="new-password" />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                open={passwordModal !== null}
                title={`ตั้งรหัสผ่านใหม่ให้ ${passwordModal?.username ?? ''}`}
                onCancel={() => setPasswordModal(null)}
                onOk={setPassword}
                okText="ตั้งรหัสผ่าน"
                cancelText="ยกเลิก"
                destroyOnHidden
            >
                <Form form={passwordForm} layout="vertical" requiredMark={false}>
                    <Form.Item name="password" label="รหัสผ่านใหม่"
                        rules={[
                            { required: true, message: 'กรุณากรอกรหัสผ่าน' },
                            { min: MIN_PASSWORD, message: `ต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัวอักษร` },
                        ]}>
                        <Input.Password autoComplete="new-password" />
                    </Form.Item>
                    <Text type="secondary" className="text-xs">
                        ตั้งรหัสผ่านใหม่แล้วบัญชีจะถูกปลดล็อกให้อัตโนมัติ
                    </Text>
                </Form>
            </Modal>
        </div>
    );
}
