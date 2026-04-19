'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs, InputNumber, Checkbox } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { VscSave, VscTrash, VscEdit } from 'react-icons/vsc';
import { PiPillBold, PiListBulletsBold, PiCalendarCheckBold } from 'react-icons/pi';

const { TextArea } = Input;
const { Option } = Select;

interface PatientInfo {
  admission_list_id: number;
  hn: string;
  an: string;
  name?: string;
  patient_name?: string;
  bed?: string;
  bedno?: string;
  admitDateTimeIso?: string;
  reg_datetime?: string;
  doctorName?: string;
  incharge_doctor?: string;
}

interface MedicationOrder {
  id: number;
  an: string;
  order_datetime: string;
  medication_name: string;
  generic_name?: string;
  dose: string;
  unit: string;
  route: string;
  frequency: string;
  prn?: boolean;
  prn_reason?: string;
  start_date: string;
  end_date?: string;
  status: 'active' | 'discontinued' | 'completed';
  doctor_name?: string;
  note?: string;
}

interface MedicationAdmin {
  id: number;
  order_id: number;
  an: string;
  admin_datetime: string;
  shift?: string;
  medication_name: string;
  dose_given: string;
  route: string;
  site?: string;
  status: 'given' | 'held' | 'refused' | 'omitted';
  held_reason?: string;
  nurse_name?: string;
  note?: string;
}

// --- Mock Orders ---
const mockOrders: MedicationOrder[] = [
  {
    id: 1, an: '', order_datetime: dayjs().subtract(3, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    medication_name: 'Ceftriaxone', generic_name: 'Ceftriaxone sodium',
    dose: '2', unit: 'g', route: 'IV', frequency: 'OD (09:00)',
    start_date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'), status: 'active',
    doctor_name: 'นพ.สมชาย', note: 'ให้ครบ 5 วัน',
  },
  {
    id: 2, an: '', order_datetime: dayjs().subtract(3, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    medication_name: 'Paracetamol 500mg', generic_name: 'Paracetamol',
    dose: '2', unit: 'tab', route: 'Oral', frequency: 'q 6 hr prn',
    prn: true, prn_reason: 'ไข้ ≥ 38°C หรือปวด',
    start_date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'), status: 'active',
    doctor_name: 'นพ.สมชาย',
  },
  {
    id: 3, an: '', order_datetime: dayjs().subtract(3, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    medication_name: 'Omeprazole 40mg', generic_name: 'Omeprazole',
    dose: '1', unit: 'cap', route: 'Oral', frequency: 'OD ac เช้า',
    start_date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'), status: 'active',
    doctor_name: 'นพ.สมชาย',
  },
  {
    id: 4, an: '', order_datetime: dayjs().subtract(2, 'day').hour(14).format('YYYY-MM-DD HH:mm:ss'),
    medication_name: 'Morphine 3mg', generic_name: 'Morphine sulfate',
    dose: '3', unit: 'mg', route: 'IV', frequency: 'q 4 hr prn',
    prn: true, prn_reason: 'pain score ≥ 5',
    start_date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
    end_date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), status: 'discontinued',
    doctor_name: 'นพ.สมชาย', note: 'D/C เปลี่ยนเป็น oral analgesic',
  },
  {
    id: 5, an: '', order_datetime: dayjs().subtract(1, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    medication_name: 'Tramadol 50mg', generic_name: 'Tramadol HCl',
    dose: '1', unit: 'cap', route: 'Oral', frequency: 'q 8 hr prn',
    prn: true, prn_reason: 'pain score ≥ 4',
    start_date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), status: 'active',
    doctor_name: 'นพ.สมชาย',
  },
];

// --- Mock Administrations ---
const mockAdmins: MedicationAdmin[] = [
  { id: 1, order_id: 1, an: '', admin_datetime: dayjs().subtract(2, 'day').hour(9).minute(10).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', medication_name: 'Ceftriaxone 2g', dose_given: '2g', route: 'IV', site: 'Lt. hand', status: 'given', nurse_name: 'พย.สมหญิง' },
  { id: 2, order_id: 3, an: '', admin_datetime: dayjs().subtract(2, 'day').hour(7).minute(30).format('YYYY-MM-DD HH:mm:ss'), shift: 'ดึก', medication_name: 'Omeprazole 40mg', dose_given: '1 cap', route: 'Oral', status: 'given', nurse_name: 'พย.นิดา' },
  { id: 3, order_id: 2, an: '', admin_datetime: dayjs().subtract(2, 'day').hour(14).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', medication_name: 'Paracetamol 500mg x2', dose_given: '2 tab', route: 'Oral', status: 'given', nurse_name: 'พย.สมหญิง', note: 'T 38.2°C' },
  { id: 4, order_id: 4, an: '', admin_datetime: dayjs().subtract(2, 'day').hour(16).minute(30).format('YYYY-MM-DD HH:mm:ss'), shift: 'บ่าย', medication_name: 'Morphine 3mg', dose_given: '3mg', route: 'IV', site: 'Rt. hand', status: 'given', nurse_name: 'พย.วิภา', note: 'pain 6/10 → 2/10 หลังให้ยา 30 นาที' },
  { id: 5, order_id: 1, an: '', admin_datetime: dayjs().subtract(1, 'day').hour(9).minute(5).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', medication_name: 'Ceftriaxone 2g', dose_given: '2g', route: 'IV', site: 'Lt. hand', status: 'given', nurse_name: 'พย.สมหญิง' },
  { id: 6, order_id: 3, an: '', admin_datetime: dayjs().subtract(1, 'day').hour(7).minute(30).format('YYYY-MM-DD HH:mm:ss'), shift: 'ดึก', medication_name: 'Omeprazole 40mg', dose_given: '1 cap', route: 'Oral', status: 'given', nurse_name: 'พย.นิดา' },
  { id: 7, order_id: 5, an: '', admin_datetime: dayjs().subtract(1, 'day').hour(20).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'บ่าย', medication_name: 'Tramadol 50mg', dose_given: '1 cap', route: 'Oral', status: 'given', nurse_name: 'พย.วิภา', note: 'pain 4/10' },
  { id: 8, order_id: 1, an: '', admin_datetime: dayjs().hour(9).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', medication_name: 'Ceftriaxone 2g', dose_given: '2g', route: 'IV', site: 'Lt. hand', status: 'given', nurse_name: 'พย.สมหญิง' },
  { id: 9, order_id: 3, an: '', admin_datetime: dayjs().hour(7).minute(30).format('YYYY-MM-DD HH:mm:ss'), shift: 'ดึก', medication_name: 'Omeprazole 40mg', dose_given: '1 cap', route: 'Oral', status: 'given', nurse_name: 'พย.นิดา' },
  { id: 10, order_id: 2, an: '', admin_datetime: dayjs().hour(10).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', medication_name: 'Paracetamol 500mg x2', dose_given: '2 tab', route: 'Oral', status: 'refused', held_reason: 'ผู้ป่วยปฏิเสธ ไม่มีไข้', nurse_name: 'พย.สมหญิง' },
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

const adminStatusConfig: Record<string, { label: string; color: string }> = {
  given: { label: 'ให้แล้ว', color: 'green' },
  held: { label: 'ระงับ', color: 'orange' },
  refused: { label: 'ปฏิเสธ', color: 'red' },
  omitted: { label: 'งดให้', color: 'default' },
};

const orderStatusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'green' },
  discontinued: { label: 'D/C', color: 'red' },
  completed: { label: 'เสร็จสิ้น', color: 'default' },
};

export default function MedicationRecord({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [orders, setOrders] = useState<MedicationOrder[]>(mockOrders);
  const [admins, setAdmins] = useState<MedicationAdmin[]>(mockAdmins);
  const [selectedOrder, setSelectedOrder] = useState<MedicationOrder | null>(null);
  const [rightTab, setRightTab] = useState('orders');

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const headers = getHeaders();
      const [ordersRes, adminsRes] = await Promise.all([
        axios.get(`/api/v1/nursing-records/mar/orders/${an}`, { headers }).catch(() => null),
        axios.get(`/api/v1/nursing-records/mar/admins/${an}`, { headers }).catch(() => null),
      ]);
      if (ordersRes?.data?.success) setOrders(ordersRes.data.data || []);
      else setOrders(mockOrders.map(o => ({ ...o, an })));
      if (adminsRes?.data?.success) setAdmins(adminsRes.data.data || []);
      else setAdmins(mockAdmins.map(a => ({ ...a, an })));
    } catch {
      setOrders(mockOrders.map(o => ({ ...o, an })));
      setAdmins(mockAdmins.map(a => ({ ...a, an })));
    }
  }, [an, getHeaders]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const headers = getHeaders();
        const patientRes = await axios.get(`/api/v1/view-patient-by-an/${an}`, { headers });
        if (patientRes.data?.success && patientRes.data.data) {
          const p = Array.isArray(patientRes.data.data) ? patientRes.data.data[0] : patientRes.data.data;
          setPatient(p);
        }
        await fetchData();
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [an, getHeaders, fetchData]);

  const onAdminFinish = async (values: any) => {
    if (!selectedOrder) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเลือกคำสั่งยา', text: 'เลือกยาจากรายการทางขวาก่อนบันทึก', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      return;
    }
    setSaving(true);
    try {
      const headers = getHeaders();
      const payload = {
        order_id: selectedOrder.id,
        an,
        admission_list_id: patient?.admission_list_id,
        admin_datetime: values.admin_datetime ? dayjs(values.admin_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        shift: values.shift || null,
        medication_name: selectedOrder.medication_name,
        dose_given: values.dose_given || `${selectedOrder.dose} ${selectedOrder.unit}`,
        route: selectedOrder.route,
        site: values.site || null,
        status: values.status || 'given',
        held_reason: values.held_reason || null,
        nurse_name: values.nurse_name || null,
        note: values.note || null,
      };
      await axios.post('/api/v1/nursing-records/mar/admin', payload, { headers });
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกการให้ยาสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      form.resetFields();
      form.setFieldsValue({ admin_datetime: dayjs(), status: 'given' });
      setSelectedOrder(null);
      await fetchData();
    } catch (error: any) {
      const st = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${st ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาด', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdmin = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/mar/admin/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchData();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const selectOrder = (order: MedicationOrder) => {
    setSelectedOrder(order);
    form.setFieldsValue({
      dose_given: `${order.dose} ${order.unit}`,
    });
  };

  const adminStatus = Form.useWatch('status', form);

  const activeOrders = orders.filter(o => o.status === 'active');
  const inactiveOrders = orders.filter(o => o.status !== 'active');

  const sortedAdmins = [...admins].sort((a, b) => dayjs(b.admin_datetime).unix() - dayjs(a.admin_datetime).unix());

  const adminColumns: ColumnsType<MedicationAdmin> = [
    {
      title: 'วันที่/เวลา', dataIndex: 'admin_datetime', key: 'admin_datetime', width: 120,
      render: (v) => v ? dayjs(v).format('DD/MM HH:mm') : '-',
    },
    {
      title: 'เวร', dataIndex: 'shift', key: 'shift', width: 60, align: 'center',
      render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0 text-xs">{v}</Tag> : '-',
    },
    { title: 'ยา', dataIndex: 'medication_name', key: 'medication_name', width: 160, render: (v) => <span className="font-semibold text-violet-700">{v}</span> },
    { title: 'ขนาด', dataIndex: 'dose_given', key: 'dose_given', width: 80 },
    { title: 'ทาง', dataIndex: 'route', key: 'route', width: 60 },
    { title: 'ตำแหน่ง', dataIndex: 'site', key: 'site', width: 80 },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 80, align: 'center',
      render: (v) => {
        const cfg = adminStatusConfig[v] || { label: v, color: 'default' };
        return <Tag color={cfg.color} className="m-0 text-xs">{cfg.label}</Tag>;
      },
    },
    { title: 'หมายเหตุ', dataIndex: 'note', key: 'note', ellipsis: true },
    { title: 'พยาบาล', dataIndex: 'nurse_name', key: 'nurse_name', width: 90 },
    {
      title: '', key: 'action', width: 50, align: 'center',
      render: (_, r) => (
        <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDeleteAdmin(r.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
          <Button type="text" danger size="small" icon={<VscTrash />} />
        </Popconfirm>
      ),
    },
  ];

  const patientName = patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-violet-600 to-purple-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiPillBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">บันทึกการให้ยา (Medication Administration Record)</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-white/90 text-sm font-semibold">{patientName}</span>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">HN: {patient?.hn || '-'}</Tag>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">AN: {an}</Tag>
                <span className="text-white/70 text-xs">เตียง {patient?.bed || patient?.bedno || '-'}</span>
                <span className="text-white/70 text-xs">Admit: {formattedAdmitDate}</span>
              </div>
            </div>
          </div>
          <Button size="small" onClick={() => window.history.back()} className="border-white/30 text-white bg-white/10 hover:bg-white/20">ย้อนกลับ</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" description="กำลังโหลดข้อมูล..." /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Form - Left 2 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-2"
              title={<span className="text-violet-600 font-bold text-sm">บันทึกการให้ยา</span>}>

              {/* Selected order display */}
              {selectedOrder ? (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-violet-600">ยาที่เลือก</span>
                    <Button type="link" size="small" onClick={() => setSelectedOrder(null)} className="text-xs p-0 text-gray-400">เปลี่ยน</Button>
                  </div>
                  <div className="font-bold text-violet-800">{selectedOrder.medication_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {selectedOrder.dose} {selectedOrder.unit} {selectedOrder.route} {selectedOrder.frequency}
                    {selectedOrder.prn && <Tag color="orange" className="m-0 ml-1 text-xs">PRN</Tag>}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-4 mb-3 text-center">
                  <span className="text-gray-400 text-sm">กรุณาเลือกคำสั่งยาจากรายการทางขวา</span>
                </div>
              )}

              <Form form={form} layout="vertical" onFinish={onAdminFinish} size="small"
                initialValues={{ admin_datetime: dayjs(), status: 'given' }}
                className="[&_.ant-form-item]:mb-2 [&_.ant-form-item-label]:pb-0 [&_.ant-form-item-label_label]:text-xs [&_.ant-form-item-label_label]:font-semibold [&_.ant-form-item-label_label]:text-gray-600"
              >
                <Row gutter={8}>
                  <Col span={14}>
                    <Form.Item label="วันที่/เวลาที่ให้" name="admin_datetime" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
                      <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item label="เวร" name="shift">
                      <Select placeholder="เลือกเวร">
                        <Option value="ดึก">ดึก (00-08)</Option>
                        <Option value="เช้า">เช้า (08-16)</Option>
                        <Option value="บ่าย">บ่าย (16-24)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <div className="bg-violet-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-violet-100">
                  <div className="text-xs text-violet-600 font-bold mb-1">รายละเอียดการให้ยา</div>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="ขนาดที่ให้" name="dose_given" className="mb-1!">
                        <Input placeholder="เช่น 2g, 1 tab" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="ตำแหน่งที่ให้" name="site" className="mb-1!">
                        <Select placeholder="เลือก" allowClear>
                          <Option value="Lt. hand">มือซ้าย</Option>
                          <Option value="Rt. hand">มือขวา</Option>
                          <Option value="Lt. arm">แขนซ้าย</Option>
                          <Option value="Rt. arm">แขนขวา</Option>
                          <Option value="Lt. deltoid">ไหล่ซ้าย</Option>
                          <Option value="Rt. deltoid">ไหล่ขวา</Option>
                          <Option value="Abdomen">หน้าท้อง</Option>
                          <Option value="Lt. thigh">ต้นขาซ้าย</Option>
                          <Option value="Rt. thigh">ต้นขาขวา</Option>
                          <Option value="Buttock">สะโพก</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="สถานะ" name="status" className="mb-1!">
                    <Select>
                      <Option value="given">ให้แล้ว (Given)</Option>
                      <Option value="held">ระงับ (Held)</Option>
                      <Option value="refused">ปฏิเสธ (Refused)</Option>
                      <Option value="omitted">งดให้ (Omitted)</Option>
                    </Select>
                  </Form.Item>
                  {adminStatus && adminStatus !== 'given' && (
                    <Form.Item label="เหตุผล" name="held_reason" className="mb-1!">
                      <Input placeholder="ระบุเหตุผล" />
                    </Form.Item>
                  )}
                </div>

                <Form.Item label="หมายเหตุ" name="note">
                  <Input placeholder="เช่น pain score, อาการหลังให้ยา" />
                </Form.Item>

                <Form.Item label="พยาบาลผู้ให้ยา" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                  className="bg-violet-600 hover:bg-violet-700 w-full shadow-md" size="middle"
                  disabled={!selectedOrder}>
                  บันทึกการให้ยา
                </Button>
              </Form>
            </Card>

            {/* Orders + Admin History - Right 3 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs
                activeKey={rightTab}
                onChange={setRightTab}
                type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-violet-600! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'orders',
                    label: <span className="flex items-center gap-1.5"><PiPillBold /> คำสั่งยา ({orders.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {/* Active Orders */}
                        {activeOrders.length > 0 && (
                          <div>
                            <div className="text-xs font-bold text-green-600 mb-2 flex items-center gap-1.5">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              คำสั่งยาปัจจุบัน ({activeOrders.length})
                            </div>
                            <div className="space-y-2">
                              {activeOrders.map(order => (
                                <div key={order.id}
                                  onClick={() => selectOrder(order)}
                                  className={`bg-white border rounded-xl p-3 cursor-pointer transition-all hover:shadow-md ${selectedOrder?.id === order.id ? 'border-violet-400 ring-2 ring-violet-200 bg-violet-50/50' : 'border-gray-100'}`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-violet-700">{order.medication_name}</span>
                                        {order.prn && <Tag color="orange" className="m-0 text-xs">PRN</Tag>}
                                        <Tag color="green" className="m-0 text-xs">Active</Tag>
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        <span className="font-semibold">{order.dose} {order.unit}</span>
                                        <span className="mx-1">•</span>
                                        <span>{order.route}</span>
                                        <span className="mx-1">•</span>
                                        <span>{order.frequency}</span>
                                      </div>
                                      {order.prn_reason && (
                                        <div className="text-xs text-orange-500 mt-0.5">PRN เมื่อ: {order.prn_reason}</div>
                                      )}
                                      <div className="text-xs text-gray-400 mt-1">
                                        สั่งโดย: {order.doctor_name || '-'} | เริ่ม: {dayjs(order.start_date).format('DD/MM/YY')}
                                        {order.note && <span className="ml-2 text-gray-500">({order.note})</span>}
                                      </div>
                                    </div>
                                    <Button type="primary" size="small" ghost className="border-violet-400 text-violet-600"
                                      onClick={(e) => { e.stopPropagation(); selectOrder(order); }}>
                                      เลือก
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Inactive Orders */}
                        {inactiveOrders.length > 0 && (
                          <div>
                            <div className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1.5">
                              <div className="w-2 h-2 bg-gray-300 rounded-full" />
                              คำสั่งยาที่หยุดแล้ว ({inactiveOrders.length})
                            </div>
                            <div className="space-y-2">
                              {inactiveOrders.map(order => (
                                <div key={order.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 opacity-60">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-gray-600 line-through">{order.medication_name}</span>
                                    <Tag color={orderStatusConfig[order.status]?.color} className="m-0 text-xs">{orderStatusConfig[order.status]?.label}</Tag>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {order.dose} {order.unit} {order.route} {order.frequency}
                                    {order.end_date && <span> | หยุด: {dayjs(order.end_date).format('DD/MM/YY')}</span>}
                                    {order.note && <span className="ml-1">({order.note})</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'history',
                    label: <span className="flex items-center gap-1.5"><PiCalendarCheckBold /> ประวัติการให้ยา ({admins.length})</span>,
                    children: (
                      <div className="p-3">
                        <Table
                          columns={adminColumns}
                          dataSource={sortedAdmins}
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 15, size: 'small' }}
                          scroll={{ x: 950 }}
                          locale={{ emptyText: 'ยังไม่มีรายการ' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-violet-50! [&_.ant-table-thead_.ant-table-cell]:text-violet-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!"
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
