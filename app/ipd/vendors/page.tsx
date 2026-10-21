'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
    Button, Card, Form, Input, Modal, Select, Switch, Table, Tag, Typography, Alert, Empty, Space,
    Checkbox, Tabs, Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    PiBuildingsBold, PiPlusBold, PiPencilSimpleBold, PiKeyBold, PiLockOpenBold, PiUserPlusBold,
    PiIdentificationCardBold, PiClockCounterClockwiseBold, PiPlugsBold, PiCopyBold,
} from 'react-icons/pi';
import { getAuthHeaders } from '../../lib/auth';

const { Title, Text, Paragraph } = Typography;

interface VendorAccount {
    vendor_account_id: number;
    username: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    job_title: string | null;
    phone: string | null;
    /** เซิร์ฟเวอร์ไม่ส่งเลขบัตรเต็มมาเลย มีแค่สี่ตัวท้ายแบบปิดบัง */
    national_id_masked: string | null;
    identity_verified: boolean;
    identity_verified_at: string | null;
    identity_verified_by_name: string | null;
    must_change_password: boolean;
    temp_password_expires_at: string | null;
    temp_expired: boolean;
    has_session: boolean;
    session_started_at: string | null;
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

/** รหัสชั่วคราวที่เพิ่งออก แสดงครั้งเดียว ปิดหน้าต่างแล้วดูอีกไม่ได้ */
interface IssuedTemp {
    username: string;
    temp_password: string;
    temp_password_expires_at: string;
    title: string;
}

interface HistoryEvent { event: string; detail: string | null; ip: string | null; user_agent: string | null; actor_name: string | null; at: string }
interface HistoryAccess { method: string; path: string; ip: string | null; session: string | null; at: string }

/** ชื่อเหตุการณ์ในประวัติ — ตรงกับค่า event ที่ vendorAuthController / vendorAdminController บันทึก */
const EVENT_LABEL: Record<string, { text: string; color?: string }> = {
    account_created: { text: 'เปิดบัญชี', color: 'blue' },
    identity_verified: { text: 'ยืนยันตัวตน/แก้ข้อมูลบุคคล', color: 'blue' },
    identity_owner_changed: { text: 'เปลี่ยนเจ้าของบัญชี (เลขบัตรใหม่)', color: 'magenta' },
    reset_password: { text: 'ออกรหัสชั่วคราว', color: 'gold' },
    account_enabled: { text: 'เปิดใช้บัญชี', color: 'green' },
    account_disabled: { text: 'ปิดใช้บัญชี', color: 'default' },
    unlocked: { text: 'ปลดล็อก', color: 'green' },
    session_revoked: { text: 'เจ้าหน้าที่ตัดการเข้าใช้', color: 'orange' },
    password_ok: { text: 'รหัสผ่านถูก' },
    password_fail: { text: 'รหัสผ่านผิด', color: 'orange' },
    password_fail_locked: { text: 'รหัสผ่านผิด → ล็อก', color: 'red' },
    password_changed: { text: 'ตั้งรหัสผ่านเอง', color: 'cyan' },
    otp_sent: { text: 'ส่ง OTP ไปหมอพร้อม', color: 'cyan' },
    otp_send_failed: { text: 'ส่ง OTP ไม่สำเร็จ', color: 'red' },
    otp_fail: { text: 'OTP ผิด', color: 'orange' },
    otp_fail_locked: { text: 'OTP ผิด → ล็อก', color: 'red' },
    login_ok: { text: 'เข้าระบบสำเร็จ', color: 'green' },
    session_replaced: { text: 'เข้าจากเครื่องใหม่ เครื่องเดิมหลุด', color: 'purple' },
    logout: { text: 'ออกจากระบบ' },
    login_locked: { text: 'พยายามเข้าขณะถูกล็อก', color: 'red' },
    login_unverified: { text: 'เข้าไม่ได้ ยังไม่ยืนยันตัวตน', color: 'red' },
    temp_password_expired: { text: 'รหัสชั่วคราวหมดอายุ', color: 'red' },
};

/** ตรวจหลักสุดท้ายของเลขบัตร ให้รู้ตั้งแต่ในฟอร์มว่าพิมพ์ผิด ไม่ต้องรอเซิร์ฟเวอร์ */
const validThaiId = (raw: string) => {
    const id = raw.replace(/[\s-]/g, '');
    if (!/^\d{13}$/.test(id)) return false;
    const sum = [...id.slice(0, 12)].reduce((a, d, i) => a + Number(d) * (13 - i), 0);
    return (11 - (sum % 11)) % 10 === Number(id[12]);
};

const personName = (a: VendorAccount) =>
    [a.first_name, a.last_name].filter(Boolean).join(' ') || a.display_name;

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
    const [identityModal, setIdentityModal] = useState<VendorAccount | null>(null);
    const [resetModal, setResetModal] = useState<VendorAccount | null>(null);
    const [issued, setIssued] = useState<IssuedTemp | null>(null);
    const [history, setHistory] = useState<{ account: VendorAccount; events: HistoryEvent[]; access: HistoryAccess[] } | null>(null);

    const [vendorForm] = Form.useForm();
    const [accountForm] = Form.useForm();
    const [identityForm] = Form.useForm();

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

    /** เรียก API ที่คืนรหัสชั่วคราว แล้วเปิดหน้าต่างแสดงรหัสครั้งเดียว */
    const issue = async (fn: () => Promise<{ data: { data: Omit<IssuedTemp, 'title'> & { temp_password: string | null } } }>, title: string) => {
        try {
            const res = await fn();
            await fetchAll();
            const d = res.data.data;
            if (d.temp_password) setIssued({ ...d, temp_password: d.temp_password, title });
            else Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1600, showConfirmButton: false });
            return true;
        } catch (err) {
            const message = axios.isAxiosError(err)
                ? err.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง'
                : 'กรุณาลองใหม่อีกครั้ง';
            Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: message });
            return false;
        }
    };

    const createAccount = async () => {
        let values;
        try { values = await accountForm.validateFields(); } catch { return; }

        const ok = await issue(
            () => axios.post('/api/v1/vendor-admin/account',
                { ...values, vendor_id: accountModal!.vendor_id }, { headers: headers() }),
            'เปิดบัญชีแล้ว',
        );
        if (ok) setAccountModal(null);
    };

    const saveIdentity = async () => {
        let values;
        try { values = await identityForm.validateFields(); } catch { return; }

        const body = { ...values, vendor_account_id: identityModal!.vendor_account_id };
        if (!body.national_id) delete body.national_id;
        const ok = await issue(
            () => axios.put('/api/v1/vendor-admin/account/identity', body, { headers: headers() }),
            'เปลี่ยนเจ้าของบัญชีแล้ว — ต้องให้รหัสชั่วคราวใหม่กับเจ้าของคนใหม่',
        );
        if (ok) setIdentityModal(null);
    };

    const resetCredentials = async () => {
        const ok = await issue(
            () => axios.post('/api/v1/vendor-admin/account/reset',
                { vendor_account_id: resetModal!.vendor_account_id }, { headers: headers() }),
            'ออกรหัสชั่วคราวแล้ว',
        );
        if (ok) setResetModal(null);
    };

    const openHistory = async (acc: VendorAccount) => {
        try {
            const res = await axios.get('/api/v1/vendor-admin/account/history',
                { params: { vendor_account_id: acc.vendor_account_id }, headers: headers() });
            setHistory({ account: acc, events: res.data?.data?.events ?? [], access: res.data?.data?.access ?? [] });
        } catch {
            Swal.fire({ icon: 'error', title: 'ดึงประวัติไม่สำเร็จ', timer: 2000, showConfirmButton: false });
        }
    };

    const patchAccount = (acc: VendorAccount, body: Record<string, unknown>, okText: string) =>
        call(() => axios.patch('/api/v1/vendor-admin/account',
            { vendor_account_id: acc.vendor_account_id, ...body }, { headers: headers() }), okText);

    const accountColumns = (): ColumnsType<VendorAccount> => [
        {
            title: 'บุคคล', key: 'p', width: 230,
            render: (_, r) => (
                <div className="leading-tight">
                    <div className="font-semibold">{personName(r)}</div>
                    <div className="text-[11px] text-gray-500">
                        {[r.job_title, r.phone].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono">
                        <span className="font-sans">ชื่อผู้ใช้</span> {r.username}
                    </div>
                </div>
            ),
        },
        {
            title: 'ยืนยันตัวตน', key: 'id', width: 210,
            render: (_, r) => r.identity_verified ? (
                <div className="leading-tight text-[11px]">
                    <Tag color="green" className="mb-0.5!">ตรวจบัตรแล้ว</Tag>
                    <div className="font-mono text-gray-500">{r.national_id_masked}</div>
                    <div className="text-gray-400">{r.identity_verified_by_name ?? '-'} · {r.identity_verified_at}</div>
                </div>
            ) : (
                <Tooltip title="บัญชีเดิมก่อนระบบรายบุคคล หรือยังไม่ได้ตรวจบัตร — เข้าระบบไม่ได้จนกว่าจะกรอกข้อมูลและยืนยัน">
                    <Tag color="red">ยังไม่ยืนยัน · เข้าไม่ได้</Tag>
                </Tooltip>
            ),
        },
        {
            title: 'สถานะ', key: 's', width: 220,
            render: (_, r) => (
                <Space size={4} wrap>
                    <Tag color={r.is_active ? 'green' : 'default'}>{r.is_active ? 'เปิดใช้' : 'ปิดใช้'}</Tag>
                    {/* บัญชีที่ยังไม่ยืนยันตัวตนเข้าไม่ได้อยู่แล้ว สถานะรหัสผ่านไม่มีความหมาย */}
                    {r.identity_verified && r.must_change_password && (r.temp_expired
                        ? <Tag color="red">รหัสชั่วคราวหมดอายุ</Tag>
                        : <Tooltip title={`ต้องเข้าครั้งแรกและตั้งรหัสเองภายใน ${r.temp_password_expires_at ?? '-'}`}>
                            <Tag color="gold">รอเข้าครั้งแรก</Tag>
                        </Tooltip>)}
                    {r.has_session && (
                        <Tooltip title={`เข้าระบบอยู่ตั้งแต่ ${r.session_started_at}`}><Tag color="purple">กำลังใช้งาน</Tag></Tooltip>
                    )}
                    {r.locked && <Tag color="red">ถูกล็อกถึง {r.locked_until}</Tag>}
                    {!r.locked && r.failed_count > 0 && <Tag color="orange">ผิด {r.failed_count} ครั้ง</Tag>}
                </Space>
            ),
        },
        {
            title: 'เข้าระบบล่าสุด', dataIndex: 'last_login_at', key: 'l', width: 130,
            render: (v: string | null) => v ?? <span className="text-gray-300">ยังไม่เคยเข้า</span>,
        },
        {
            title: '', key: 'a', width: 250, align: 'right',
            render: (_, r) => (
                <Space size={4} wrap className="justify-end">
                    <Button size="small" icon={<PiIdentificationCardBold />} onClick={() => setIdentityModal(r)}>
                        {r.identity_verified ? 'ข้อมูลบุคคล' : 'ยืนยันตัวตน'}
                    </Button>
                    <Tooltip title="ลืมรหัสผ่าน — ออกรหัสชั่วคราวใหม่">
                        <Button size="small" icon={<PiKeyBold />} onClick={() => setResetModal(r)}>
                            ออกรหัสใหม่
                        </Button>
                    </Tooltip>
                    <Tooltip title="ประวัติการเข้าระบบและการเปิดดู">
                        <Button size="small" icon={<PiClockCounterClockwiseBold />} onClick={() => openHistory(r)} />
                    </Tooltip>
                    {r.has_session && (
                        <Tooltip title="ตัดการเข้าใช้ที่ค้างอยู่ ต้องเข้าระบบใหม่">
                            <Button size="small" icon={<PiPlugsBold />}
                                onClick={() => patchAccount(r, { revoke_session: true }, 'ตัดการเข้าใช้แล้ว')} />
                        </Tooltip>
                    )}
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
                title="บัญชีรายบุคคล — หนึ่งคนหนึ่งบัญชี ห้ามใช้ร่วมกัน"
                description={<>
                    เปิดบัญชีให้พนักงานบริษัททีละคน โดยตรวจบัตรประชาชนตัวจริงก่อนทุกครั้ง เลขบัตรหนึ่งเลขมีได้บัญชีเดียว
                    · ระบบออกรหัสชั่วคราวให้ เจ้าของบัญชีต้องตั้งรหัสเองตอนเข้าครั้งแรก และทุกครั้งที่เข้าต้องกรอก OTP ที่ส่งไป LINE หมอพร้อม ของเจ้าของเลขบัตร
                    (เจ้าของบัญชีต้องเพิ่มเพื่อน LINE หมอพร้อมและยืนยันตัวตนไว้ก่อน)
                    · ใช้ได้ทีละเครื่อง และทุกการเข้าระบบและการเปิดดูถูกบันทึกรายคน
                    <br />บริษัทเข้าระบบที่ /vendor/login และเห็นเฉพาะยอดของประเภทอาหารที่ผูกไว้ — ถ้าไม่ผูกประเภทอาหาร บริษัทจะเห็นรายงานเปล่า
                </>}
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
                title={`เปิดบัญชีให้พนักงาน ${accountModal?.vendor_name ?? ''}`}
                onCancel={() => setAccountModal(null)}
                onOk={createAccount}
                okText="เปิดบัญชี"
                cancelText="ยกเลิก"
                destroyOnHidden
                width={560}
            >
                <Alert type="info" showIcon className="mb-3"
                    title="ให้เจ้าของบัญชีมาแสดงบัตรประชาชนตัวจริง"
                    description="หนึ่งคนมีได้บัญชีเดียว ระบบจะออกรหัสชั่วคราว (ใช้ได้ 72 ชม.) ให้ส่งถึงเจ้าของบัญชีโดยตรง ผู้ดูแลจะไม่รู้รหัสจริงของใคร" />
                <Form form={accountForm} layout="vertical" requiredMark={false}>
                    <div className="grid grid-cols-2 gap-x-3">
                        <Form.Item name="first_name" label="ชื่อ (ตามบัตร)"
                            rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}>
                            <Input maxLength={100} />
                        </Form.Item>
                        <Form.Item name="last_name" label="นามสกุล (ตามบัตร)"
                            rules={[{ required: true, message: 'กรุณากรอกนามสกุล' }]}>
                            <Input maxLength={100} />
                        </Form.Item>
                        <Form.Item name="job_title" label="ตำแหน่งในบริษัท">
                            <Input maxLength={100} placeholder="เช่น หัวหน้าครัว" />
                        </Form.Item>
                        <Form.Item name="phone" label="เบอร์โทรศัพท์"
                            rules={[{ required: true, pattern: /^[0-9+\-\s]{9,}$/, message: 'กรุณากรอกเบอร์ที่ติดต่อได้' }]}>
                            <Input maxLength={30} inputMode="tel" />
                        </Form.Item>
                    </div>
                    <Form.Item name="national_id" label="เลขบัตรประชาชน 13 หลัก"
                        extra="เก็บแบบเข้ารหัส หลังบันทึกจะแสดงเพียงสี่ตัวท้าย"
                        rules={[
                            { required: true, message: 'กรุณากรอกเลขบัตรประชาชน' },
                            { validator: (_, v) => !v || validThaiId(v) ? Promise.resolve() : Promise.reject(new Error('เลขบัตรไม่ถูกต้อง')) },
                        ]}>
                        <Input maxLength={17} inputMode="numeric" autoComplete="off" />
                    </Form.Item>
                    <Form.Item name="username" label="ชื่อผู้ใช้ (ภาษาอังกฤษ)"
                        rules={[
                            { required: true, message: 'กรุณากรอกชื่อผู้ใช้' },
                            { pattern: /^[a-zA-Z0-9._-]{4,64}$/, message: 'ยาว 4-64 ตัว ใช้ได้เฉพาะ a-z 0-9 . _ -' },
                        ]}>
                        <Input autoComplete="off" placeholder="เช่น somchai.k" />
                    </Form.Item>
                    <Form.Item name="identity_checked" valuePropName="checked" className="mb-0!"
                        rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject(new Error('ต้องตรวจบัตรตัวจริงก่อน')) }]}>
                        <Checkbox>
                            ข้าพเจ้าได้ตรวจบัตรประชาชน<strong>ตัวจริง</strong>ของบุคคลนี้แล้ว ชื่อและเลขบัตรตรงกับที่กรอก
                        </Checkbox>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                open={identityModal !== null}
                title={`ข้อมูลบุคคล — ${identityModal ? identityModal.username : ''}`}
                onCancel={() => setIdentityModal(null)}
                onOk={saveIdentity}
                okText="บันทึกและยืนยันตัวตน"
                cancelText="ยกเลิก"
                destroyOnHidden
                width={560}
            >
                {identityModal && !identityModal.identity_verified && (
                    <Alert type="warning" showIcon className="mb-3"
                        title="บัญชีนี้ยังไม่ผูกกับบุคคล จึงเข้าระบบไม่ได้"
                        description="ถ้าเป็นบัญชีที่บริษัทเคยใช้ร่วมกันหลายคน แนะนำให้ปิดบัญชีนี้แล้วเปิดบัญชีใหม่ให้ทีละคนแทน" />
                )}
                <Form form={identityForm} layout="vertical" requiredMark={false}
                    initialValues={identityModal ? {
                        first_name: identityModal.first_name ?? '',
                        last_name: identityModal.last_name ?? '',
                        job_title: identityModal.job_title ?? '',
                        phone: identityModal.phone ?? '',
                    } : undefined}>
                    <div className="grid grid-cols-2 gap-x-3">
                        <Form.Item name="first_name" label="ชื่อ (ตามบัตร)"
                            rules={[{ required: true, message: 'กรุณากรอกชื่อ' }]}>
                            <Input maxLength={100} />
                        </Form.Item>
                        <Form.Item name="last_name" label="นามสกุล (ตามบัตร)"
                            rules={[{ required: true, message: 'กรุณากรอกนามสกุล' }]}>
                            <Input maxLength={100} />
                        </Form.Item>
                        <Form.Item name="job_title" label="ตำแหน่งในบริษัท">
                            <Input maxLength={100} placeholder="เช่น หัวหน้าครัว" />
                        </Form.Item>
                        <Form.Item name="phone" label="เบอร์โทรศัพท์"
                            rules={[{ required: true, pattern: /^[0-9+\-\s]{9,}$/, message: 'กรุณากรอกเบอร์ที่ติดต่อได้' }]}>
                            <Input maxLength={30} inputMode="tel" />
                        </Form.Item>
                    </div>
                    <Form.Item name="national_id"
                        label={identityModal?.identity_verified
                            ? `เลขบัตรประชาชน — ปัจจุบัน ${identityModal.national_id_masked ?? '-'} (เว้นว่าง = ไม่เปลี่ยน)`
                            : 'เลขบัตรประชาชน 13 หลัก'}
                        extra={identityModal?.identity_verified
                            ? 'เปลี่ยนเลขบัตร = เปลี่ยนเจ้าของบัญชี OTP จะไปที่หมอพร้อมของเลขบัตรใหม่ ระบบตัดการเข้าใช้เดิมและออกรหัสชั่วคราวใหม่'
                            : undefined}
                        rules={[
                            { required: !identityModal?.identity_verified, message: 'กรุณากรอกเลขบัตรประชาชน' },
                            { validator: (_, v) => !v || validThaiId(v) ? Promise.resolve() : Promise.reject(new Error('เลขบัตรไม่ถูกต้อง')) },
                        ]}>
                        <Input maxLength={17} inputMode="numeric" autoComplete="off" />
                    </Form.Item>
                    <Form.Item name="identity_checked" valuePropName="checked" className="mb-0!"
                        rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject(new Error('ต้องตรวจบัตรตัวจริงก่อน')) }]}>
                        <Checkbox>
                            ข้าพเจ้าได้ตรวจบัตรประชาชน<strong>ตัวจริง</strong>ของบุคคลนี้แล้ว ชื่อและเลขบัตรตรงกับที่กรอก
                        </Checkbox>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                open={resetModal !== null}
                title={`ลืมรหัสผ่าน — ${resetModal ? personName(resetModal) : ''}`}
                onCancel={() => setResetModal(null)}
                onOk={resetCredentials}
                okText="ออกรหัสชั่วคราว"
                cancelText="ยกเลิก"
                destroyOnHidden
            >
                <Paragraph className="text-sm">
                    ระบบจะออกรหัสผ่านชั่วคราวใหม่ (ใช้ได้ 72 ชม.) รหัสเดิมใช้ไม่ได้ทันที
                    และเครื่องที่เข้าระบบค้างอยู่จะหลุด เจ้าของบัญชีต้องตั้งรหัสเองเมื่อเข้าครั้งถัดไป
                </Paragraph>
                <Alert type="warning" showIcon
                    title="ยืนยันว่าเป็นเจ้าของบัญชีก่อนออกรหัส"
                    description="ให้เจ้าของบัญชีแสดงบัตรประชาชน หรือโทรกลับไปที่เบอร์ที่บันทึกไว้ ห้ามออกรหัสให้คนที่ขอแทน" />
            </Modal>

            <Modal
                open={issued !== null}
                title={issued?.title}
                onCancel={() => setIssued(null)}
                footer={<Button type="primary" onClick={() => setIssued(null)}>ส่งรหัสให้เจ้าของบัญชีแล้ว ปิด</Button>}
                maskClosable={false}
                destroyOnHidden
            >
                <Alert type="warning" showIcon className="mb-3"
                    title="รหัสนี้แสดงครั้งเดียว ปิดหน้าต่างแล้วดูอีกไม่ได้"
                    description="ส่งให้เจ้าของบัญชีโดยตรง (ยื่นให้ต่อหน้า หรือส่งถึงเบอร์ของเจ้าตัว) ห้ามส่งผ่านกลุ่มแชตของบริษัท" />
                {issued && (
                    <div className="rounded-lg border border-dashed p-3 text-sm space-y-1">
                        <div>ชื่อผู้ใช้: <span className="font-mono font-semibold">{issued.username}</span></div>
                        <div className="flex items-center gap-2">
                            รหัสชั่วคราว: <span className="font-mono font-semibold text-lg tracking-wider select-all">{issued.temp_password}</span>
                            <Button size="small" icon={<PiCopyBold />}
                                onClick={() => navigator.clipboard?.writeText(issued.temp_password)} />
                        </div>
                        <div className="text-gray-500">ใช้ได้ถึง {issued.temp_password_expires_at} · เข้าที่ /vendor/login</div>
                    </div>
                )}
            </Modal>

            <Modal
                open={history !== null}
                title={history ? `ประวัติ — ${personName(history.account)} (${history.account.username})` : ''}
                onCancel={() => setHistory(null)}
                footer={null}
                width={900}
                destroyOnHidden
            >
                <Tabs items={[
                    {
                        key: 'e', label: `การเข้าระบบและการจัดการบัญชี (${history?.events.length ?? 0})`,
                        children: (
                            <Table<HistoryEvent>
                                rowKey={(r, i) => `${r.at}-${i}`}
                                size="small" pagination={{ pageSize: 15 }} scroll={{ x: 'max-content' }}
                                dataSource={history?.events ?? []}
                                columns={[
                                    { title: 'เวลา', dataIndex: 'at', width: 150 },
                                    {
                                        title: 'เหตุการณ์', dataIndex: 'event', width: 220,
                                        render: (v: string) => <Tag color={EVENT_LABEL[v]?.color}>{EVENT_LABEL[v]?.text ?? v}</Tag>,
                                    },
                                    { title: 'โดยเจ้าหน้าที่', dataIndex: 'actor_name', width: 160, render: (v: string | null) => v ?? '' },
                                    { title: 'IP', dataIndex: 'ip', width: 120 },
                                    {
                                        title: 'อุปกรณ์', dataIndex: 'user_agent',
                                        render: (v: string | null) => <span className="text-[11px] text-gray-500 line-clamp-1 max-w-72 block" title={v ?? ''}>{v}</span>,
                                    },
                                ]}
                            />
                        ),
                    },
                    {
                        key: 'a', label: `การเปิดดู (${history?.access.length ?? 0})`,
                        children: (
                            <Table<HistoryAccess>
                                rowKey={(r, i) => `${r.at}-${i}`}
                                size="small" pagination={{ pageSize: 15 }} scroll={{ x: 'max-content' }}
                                dataSource={history?.access ?? []}
                                columns={[
                                    { title: 'เวลา', dataIndex: 'at', width: 150 },
                                    { title: '', dataIndex: 'method', width: 60 },
                                    { title: 'รายการ', dataIndex: 'path', render: (v: string) => <span className="font-mono text-[11px]">{v.replace('/api/v1/vendor', '')}</span> },
                                    { title: 'IP', dataIndex: 'ip', width: 120 },
                                    { title: 'session', dataIndex: 'session', width: 90, render: (v: string | null) => <span className="font-mono text-[11px]">{v}</span> },
                                ]}
                            />
                        ),
                    },
                ]} />
            </Modal>
        </div>
    );
}
