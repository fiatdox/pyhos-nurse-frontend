'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs, InputNumber } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave, VscTrash } from 'react-icons/vsc';
import { PiDropBold, PiListBulletsBold, PiChartBarBold } from 'react-icons/pi';

const { Option } = Select;

interface PatientInfo {
  admission_list_id: number;
  hn: string;
  an: string;
  name?: string;
  patient_name?: string;
  ptname?: string;
  bed?: string;
  bedno?: string;
  admitDateTimeIso?: string;
  reg_datetime?: string;
  doctorName?: string;
  incharge_doctor?: string;
  ward?: string;
  wardName?: string;
}

interface IOEntry {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  io_type: 'intake' | 'output';
  category: string;
  item_name: string;
  amount: number;
  unit: string;
  route?: string;
  note?: string;
  nurse_name?: string;
}

// --- Mock Data ---
const mockIOEntries: IOEntry[] = [
  { id: 1, an: '', record_datetime: dayjs().subtract(1, 'day').hour(8).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', io_type: 'intake', category: 'IV Fluid', item_name: '0.9% NSS 1000ml', amount: 500, unit: 'ml', route: 'IV', nurse_name: 'พย.สมหญิง' },
  { id: 2, an: '', record_datetime: dayjs().subtract(1, 'day').hour(8).minute(30).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', io_type: 'intake', category: 'Oral', item_name: 'น้ำดื่ม', amount: 200, unit: 'ml', route: 'Oral', nurse_name: 'พย.สมหญิง' },
  { id: 3, an: '', record_datetime: dayjs().subtract(1, 'day').hour(9).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', io_type: 'intake', category: 'Oral', item_name: 'อาหารเช้า (ข้าวต้ม)', amount: 250, unit: 'ml', route: 'Oral', nurse_name: 'พย.สมหญิง' },
  { id: 4, an: '', record_datetime: dayjs().subtract(1, 'day').hour(10).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', io_type: 'output', category: 'Urine', item_name: 'ปัสสาวะ', amount: 300, unit: 'ml', note: 'สีเหลืองใส', nurse_name: 'พย.สมหญิง' },
  { id: 5, an: '', record_datetime: dayjs().subtract(1, 'day').hour(12).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', io_type: 'intake', category: 'IV Fluid', item_name: '0.9% NSS 1000ml', amount: 300, unit: 'ml', route: 'IV', nurse_name: 'พย.สมหญิง' },
  { id: 6, an: '', record_datetime: dayjs().subtract(1, 'day').hour(12).minute(30).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', io_type: 'intake', category: 'Oral', item_name: 'อาหารกลางวัน + น้ำดื่ม', amount: 350, unit: 'ml', route: 'Oral', nurse_name: 'พย.สมหญิง' },
  { id: 7, an: '', record_datetime: dayjs().subtract(1, 'day').hour(14).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'เช้า', io_type: 'output', category: 'Urine', item_name: 'ปัสสาวะ', amount: 250, unit: 'ml', nurse_name: 'พย.สมหญิง' },
  { id: 8, an: '', record_datetime: dayjs().subtract(1, 'day').hour(16).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'บ่าย', io_type: 'intake', category: 'IV Fluid', item_name: '5% DN/2 1000ml', amount: 400, unit: 'ml', route: 'IV', nurse_name: 'พย.วิภา' },
  { id: 9, an: '', record_datetime: dayjs().subtract(1, 'day').hour(18).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'บ่าย', io_type: 'intake', category: 'Oral', item_name: 'อาหารเย็น + น้ำดื่ม', amount: 400, unit: 'ml', route: 'Oral', nurse_name: 'พย.วิภา' },
  { id: 10, an: '', record_datetime: dayjs().subtract(1, 'day').hour(20).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'บ่าย', io_type: 'output', category: 'Urine', item_name: 'ปัสสาวะ', amount: 400, unit: 'ml', note: 'สีเหลืองใส', nurse_name: 'พย.วิภา' },
  { id: 11, an: '', record_datetime: dayjs().subtract(1, 'day').hour(22).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'บ่าย', io_type: 'output', category: 'Drain', item_name: 'JP drain', amount: 50, unit: 'ml', note: 'สี serosanguinous', nurse_name: 'พย.วิภา' },
  { id: 12, an: '', record_datetime: dayjs().hour(2).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'ดึก', io_type: 'intake', category: 'IV Fluid', item_name: '5% DN/2 1000ml', amount: 300, unit: 'ml', route: 'IV', nurse_name: 'พย.นิดา' },
  { id: 13, an: '', record_datetime: dayjs().hour(4).minute(0).format('YYYY-MM-DD HH:mm:ss'), shift: 'ดึก', io_type: 'output', category: 'Urine', item_name: 'ปัสสาวะ', amount: 350, unit: 'ml', nurse_name: 'พย.นิดา' },
];

const intakeCategories = [
  { value: 'IV Fluid', label: 'IV Fluid (สารน้ำทางหลอดเลือด)' },
  { value: 'Oral', label: 'Oral (ทางปาก)' },
  { value: 'Blood', label: 'Blood Product (เลือด/ส่วนประกอบเลือด)' },
  { value: 'NG', label: 'NG Feed (ทาง NG tube)' },
  { value: 'Other Intake', label: 'อื่นๆ' },
];

const outputCategories = [
  { value: 'Urine', label: 'Urine (ปัสสาวะ)' },
  { value: 'Drain', label: 'Drain (สายระบาย)' },
  { value: 'Vomit', label: 'Vomit (อาเจียน)' },
  { value: 'Stool', label: 'Stool (อุจจาระ)' },
  { value: 'Blood Loss', label: 'Blood Loss (เสียเลือด)' },
  { value: 'NG Aspirate', label: 'NG Aspirate' },
  { value: 'Other Output', label: 'อื่นๆ' },
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

export default function IORecord({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [entries, setEntries] = useState<IOEntry[]>(mockIOEntries);
  const [ioType, setIoType] = useState<'intake' | 'output'>('intake');
  const [rightTab, setRightTab] = useState('summary');

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/io/${an}`, { headers });
      if (res.data?.success) setEntries(res.data.data || []);
    } catch {
      setEntries(mockIOEntries.map(e => ({ ...e, an })));
    }
  }, [an, getHeaders]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = getHeaders();
        const patientRes = await axios.post('/api/v1/patient-by-an', { an }, { headers });
        if (patientRes.data?.success && patientRes.data.data) {
          const p = Array.isArray(patientRes.data.data) ? patientRes.data.data[0] : patientRes.data.data;
          setPatient(p);
        }
        await fetchEntries();
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [an, getHeaders, fetchEntries]);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const headers = getHeaders();
      const payload = {
        an,
        admission_list_id: patient?.admission_list_id,
        ward_code: patient?.ward || getUserProfile()?.ward_code || '',
        ward_name: patient?.wardName || getUserProfile()?.ward_name || '',
        staff_id: getUserProfile()?.staff_id || '',
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        shift: values.shift || null,
        io_type: ioType,
        category: values.category || null,
        item_name: values.item_name || null,
        amount: values.amount || 0,
        unit: values.unit || 'ml',
        route: values.route || null,
        note: values.note || null,
        nurse_name: values.nurse_name || null,
      };
      await axios.post('/api/v1/nursing-records/io', payload, { headers });
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      form.resetFields();
      form.setFieldsValue({ record_datetime: dayjs(), unit: 'ml', nurse_name: getUserProfile()?.fullname || '' });
      await fetchEntries();
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาดในการบันทึก', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/io/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchEntries();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  // Summaries
  const totalIntake = entries.filter(e => e.io_type === 'intake').reduce((s, e) => s + (e.amount || 0), 0);
  const totalOutput = entries.filter(e => e.io_type === 'output').reduce((s, e) => s + (e.amount || 0), 0);
  const balance = totalIntake - totalOutput;

  const shiftSummary = (shift: string) => {
    const shiftEntries = entries.filter(e => e.shift === shift);
    const intake = shiftEntries.filter(e => e.io_type === 'intake').reduce((s, e) => s + (e.amount || 0), 0);
    const output = shiftEntries.filter(e => e.io_type === 'output').reduce((s, e) => s + (e.amount || 0), 0);
    return { intake, output, balance: intake - output };
  };

  const intakeByCat = entries.filter(e => e.io_type === 'intake').reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const outputByCat = entries.filter(e => e.io_type === 'output').reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + (e.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const sortedEntries = [...entries].sort((a, b) => dayjs(b.record_datetime).unix() - dayjs(a.record_datetime).unix());

  const columns: ColumnsType<IOEntry> = [
    {
      title: 'เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 110,
      render: (v) => v ? dayjs(v).format('DD/MM HH:mm') : '-',
    },
    {
      title: 'เวร', dataIndex: 'shift', key: 'shift', width: 60, align: 'center',
      render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0 text-xs">{v}</Tag> : '-',
    },
    {
      title: 'ประเภท', dataIndex: 'io_type', key: 'io_type', width: 80, align: 'center',
      render: (v) => <Tag color={v === 'intake' ? 'cyan' : 'volcano'} className="m-0">{v === 'intake' ? 'IN' : 'OUT'}</Tag>,
    },
    { title: 'หมวด', dataIndex: 'category', key: 'category', width: 100 },
    { title: 'รายการ', dataIndex: 'item_name', key: 'item_name', width: 180 },
    {
      title: 'ปริมาณ', dataIndex: 'amount', key: 'amount', width: 90, align: 'right',
      render: (v, r) => <span className={`font-bold ${r.io_type === 'intake' ? 'text-cyan-600' : 'text-red-500'}`}>{v} {r.unit}</span>,
    },
    { title: 'หมายเหตุ', dataIndex: 'note', key: 'note', ellipsis: true },
    { title: 'พยาบาล', dataIndex: 'nurse_name', key: 'nurse_name', width: 90 },
    {
      title: '', key: 'action', width: 50, align: 'center',
      render: (_, r) => (
        <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(r.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
          <Button type="text" danger size="small" icon={<VscTrash />} />
        </Popconfirm>
      ),
    },
  ];

  const patientName = patient?.ptname || patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-cyan-600 to-blue-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiDropBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">บันทึกการได้รับและขับออกของสารน้ำ (I/O Record)</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-white/90 text-sm font-semibold">{patientName}</span>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">HN: {patient?.hn || '-'}</Tag>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">AN: {an}</Tag>
                <span className="text-white/70 text-xs">เตียง {patient?.bed || patient?.bedno || '-'}</span>
                <span className="text-white/70 text-xs">Admit: {formattedAdmitDate}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Total summary badges */}
            <div className="flex gap-2 text-xs">
              <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                <div className="text-white/60">Total IN</div>
                <div className="text-white font-bold text-sm">{totalIntake.toLocaleString()} ml</div>
              </div>
              <div className="bg-white/15 rounded-lg px-3 py-1.5 text-center">
                <div className="text-white/60">Total OUT</div>
                <div className="text-white font-bold text-sm">{totalOutput.toLocaleString()} ml</div>
              </div>
              <div className={`rounded-lg px-3 py-1.5 text-center ${balance >= 0 ? 'bg-emerald-500/30' : 'bg-red-500/30'}`}>
                <div className="text-white/60">Balance</div>
                <div className="text-white font-bold text-sm">{balance >= 0 ? '+' : ''}{balance.toLocaleString()} ml</div>
              </div>
            </div>
            <Button size="small" onClick={() => window.history.back()} className="border-white/30 text-white bg-white/10 hover:bg-white/20">ย้อนกลับ</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" description="กำลังโหลดข้อมูล..." /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Form - Left 2 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-2"
              title={<span className="text-cyan-600 font-bold text-sm">บันทึก I/O</span>}>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ record_datetime: dayjs(), unit: 'ml', nurse_name: getUserProfile()?.fullname || '' }}
                className="[&_.ant-form-item]:mb-2 [&_.ant-form-item-label]:pb-0 [&_.ant-form-item-label_label]:text-xs [&_.ant-form-item-label_label]:font-semibold [&_.ant-form-item-label_label]:text-gray-600"
              >
                <Row gutter={8}>
                  <Col span={14}>
                    <Form.Item label="วันที่/เวลา" name="record_datetime" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
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

                {/* IO Type Toggle */}
                <div className="flex gap-2 mb-3">
                  <Button
                    type={ioType === 'intake' ? 'primary' : 'default'}
                    onClick={() => { setIoType('intake'); form.setFieldsValue({ category: undefined }); }}
                    className={`flex-1 font-bold ${ioType === 'intake' ? 'bg-cyan-500 hover:bg-cyan-600' : ''}`}
                  >
                    Intake (ได้รับ)
                  </Button>
                  <Button
                    type={ioType === 'output' ? 'primary' : 'default'}
                    onClick={() => { setIoType('output'); form.setFieldsValue({ category: undefined }); }}
                    className={`flex-1 font-bold ${ioType === 'output' ? 'bg-red-500 hover:bg-red-600' : ''}`}
                    danger={ioType === 'output'}
                  >
                    Output (ขับออก)
                  </Button>
                </div>

                <div className={`rounded-lg px-3 pt-2 pb-1 mb-2 border ${ioType === 'intake' ? 'bg-cyan-50 border-cyan-100' : 'bg-red-50 border-red-100'}`}>
                  <div className={`text-xs font-bold mb-1 ${ioType === 'intake' ? 'text-cyan-600' : 'text-red-500'}`}>
                    {ioType === 'intake' ? 'รายละเอียดสารน้ำที่ได้รับ' : 'รายละเอียดสารน้ำที่ขับออก'}
                  </div>
                  <Form.Item label="หมวดหมู่" name="category" rules={[{ required: true, message: 'กรุณาเลือก' }]} className="mb-1!">
                    <Select placeholder="เลือกหมวด">
                      {(ioType === 'intake' ? intakeCategories : outputCategories).map(c => (
                        <Option key={c.value} value={c.value}>{c.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item label="รายการ" name="item_name" rules={[{ required: true, message: 'กรุณาระบุ' }]} className="mb-1!">
                    <Input placeholder={ioType === 'intake' ? 'เช่น 0.9% NSS 1000ml, น้ำดื่ม' : 'เช่น ปัสสาวะ, JP drain'} />
                  </Form.Item>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="ปริมาณ" name="amount" rules={[{ required: true, message: 'กรุณาระบุ' }]} className="mb-1!">
                        <InputNumber min={0} placeholder="0" className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="หน่วย" name="unit" className="mb-1!">
                        <Select>
                          <Option value="ml">ml</Option>
                          <Option value="L">L</Option>
                          <Option value="unit">unit</Option>
                          <Option value="bag">bag</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  {ioType === 'intake' && (
                    <Form.Item label="ทางที่ให้" name="route" className="mb-1!">
                      <Select placeholder="เลือก" allowClear>
                        <Option value="IV">IV</Option>
                        <Option value="Oral">Oral</Option>
                        <Option value="NG">NG tube</Option>
                        <Option value="SC">SC</Option>
                      </Select>
                    </Form.Item>
                  )}
                </div>

                <Form.Item label="หมายเหตุ" name="note">
                  <Input placeholder="เช่น สี ลักษณะ" />
                </Form.Item>

                <Form.Item label="พยาบาลผู้บันทึก" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                  className={`w-full shadow-md font-bold ${ioType === 'intake' ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-red-500 hover:bg-red-600'}`}
                  danger={ioType === 'output'} size="middle">
                  บันทึก {ioType === 'intake' ? 'Intake' : 'Output'}
                </Button>
              </Form>
            </Card>

            {/* Summary + Table - Right 3 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs
                activeKey={rightTab}
                onChange={setRightTab}
                type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-cyan-600! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'summary',
                    label: <span className="flex items-center gap-1.5"><PiChartBarBold /> สรุป I/O</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {/* Shift summaries */}
                        <div className="grid grid-cols-3 gap-3">
                          {['ดึก', 'เช้า', 'บ่าย'].map(shift => {
                            const s = shiftSummary(shift);
                            return (
                              <div key={shift} className="bg-white border border-gray-100 rounded-xl p-3">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Tag color={shiftColor[shift]} className="m-0 text-xs font-bold">{shift}</Tag>
                                </div>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">IN:</span>
                                    <span className="font-bold text-cyan-600">{s.intake.toLocaleString()} ml</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">OUT:</span>
                                    <span className="font-bold text-red-500">{s.output.toLocaleString()} ml</span>
                                  </div>
                                  <div className="border-t pt-1 flex justify-between">
                                    <span className="text-gray-500">Balance:</span>
                                    <span className={`font-bold ${s.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                      {s.balance >= 0 ? '+' : ''}{s.balance.toLocaleString()} ml
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Category breakdown */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3">
                            <div className="text-xs font-bold text-cyan-600 mb-2">Intake แยกตามหมวด</div>
                            {Object.keys(intakeByCat).length === 0 ? (
                              <div className="text-xs text-gray-400">ยังไม่มีข้อมูล</div>
                            ) : Object.entries(intakeByCat).map(([cat, amt]) => (
                              <div key={cat} className="flex justify-between text-sm py-0.5">
                                <span className="text-gray-600">{cat}</span>
                                <span className="font-bold text-cyan-700">{amt.toLocaleString()} ml</span>
                              </div>
                            ))}
                            <div className="border-t border-cyan-200 mt-1 pt-1 flex justify-between font-bold text-sm">
                              <span className="text-cyan-700">รวม</span>
                              <span className="text-cyan-700">{totalIntake.toLocaleString()} ml</span>
                            </div>
                          </div>
                          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                            <div className="text-xs font-bold text-red-500 mb-2">Output แยกตามหมวด</div>
                            {Object.keys(outputByCat).length === 0 ? (
                              <div className="text-xs text-gray-400">ยังไม่มีข้อมูล</div>
                            ) : Object.entries(outputByCat).map(([cat, amt]) => (
                              <div key={cat} className="flex justify-between text-sm py-0.5">
                                <span className="text-gray-600">{cat}</span>
                                <span className="font-bold text-red-600">{amt.toLocaleString()} ml</span>
                              </div>
                            ))}
                            <div className="border-t border-red-200 mt-1 pt-1 flex justify-between font-bold text-sm">
                              <span className="text-red-600">รวม</span>
                              <span className="text-red-600">{totalOutput.toLocaleString()} ml</span>
                            </div>
                          </div>
                        </div>

                        {/* Grand Total */}
                        <div className={`rounded-xl p-4 text-center ${balance >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                          <div className="text-sm text-gray-500 mb-1">Total Fluid Balance (24 hr)</div>
                          <div className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {balance >= 0 ? '+' : ''}{balance.toLocaleString()} ml
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'table',
                    label: <span className="flex items-center gap-1.5"><PiListBulletsBold /> รายการ ({entries.length})</span>,
                    children: (
                      <div className="p-3">
                        <Table
                          columns={columns}
                          dataSource={sortedEntries}
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 15, size: 'small' }}
                          scroll={{ x: 950 }}
                          locale={{ emptyText: 'ยังไม่มีรายการ' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-cyan-50! [&_.ant-table-thead_.ant-table-cell]:text-cyan-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!"
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
