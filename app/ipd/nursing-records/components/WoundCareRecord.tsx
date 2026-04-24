'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Input from 'antd/es/input';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave, VscTrash, VscEdit } from 'react-icons/vsc';
import { PiBandaidsBold, PiListBulletsBold, PiCardsBold } from 'react-icons/pi';

const { Option } = Select;
const { TextArea } = Input;

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
  ward?: string;
  wardName?: string;
}

interface WoundRecord {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  wound_type: string;
  wound_location: string;
  wound_size?: string;
  wound_stage?: string;
  wound_appearance: string;
  exudate_type?: string;
  exudate_amount?: string;
  surrounding_skin?: string;
  odor?: string;
  pain_score?: number;
  cleansing_solution: string;
  dressing_type: string;
  procedure_detail?: string;
  wound_status: string;
  next_dressing?: string;
  nurse_name?: string;
}

const woundTypes = [
  'แผลผ่าตัด (Surgical wound)', 'แผลกดทับ (Pressure ulcer)', 'แผลเบาหวาน (Diabetic wound)',
  'แผลไฟไหม้/น้ำร้อนลวก (Burn)', 'แผลฉีกขาด (Laceration)', 'แผลถลอก (Abrasion)',
  'แผลเจาะคอ (Tracheostomy)', 'แผล Drain site', 'แผล IV site', 'อื่นๆ',
];

const woundLocations = [
  'ศีรษะ', 'หน้าผาก', 'หน้าอก', 'ท้อง', 'หลัง', 'ก้นกบ (Sacrum)', 'สะโพก',
  'แขนซ้าย', 'แขนขวา', 'มือซ้าย', 'มือขวา', 'ขาซ้าย', 'ขาขวา', 'เท้าซ้าย', 'เท้าขวา', 'อื่นๆ',
];

const woundAppearances = [
  { value: 'clean', label: 'สะอาด (Clean)', color: 'green' },
  { value: 'granulation', label: 'Granulation tissue (แดง)', color: 'red' },
  { value: 'slough', label: 'Slough (เหลือง)', color: 'gold' },
  { value: 'necrotic', label: 'Necrotic tissue (ดำ)', color: 'default' },
  { value: 'epithelializing', label: 'Epithelializing (ชมพู)', color: 'pink' },
  { value: 'infected', label: 'ติดเชื้อ (Infected)', color: 'volcano' },
  { value: 'mixed', label: 'แบบผสม (Mixed)', color: 'orange' },
];

const woundStages = [
  'Stage I - ผิวหนังแดง ไม่มีแผลเปิด',
  'Stage II - แผลตื้น มีถลอก/พอง',
  'Stage III - แผลลึกถึงชั้นไขมัน',
  'Stage IV - แผลลึกถึงกล้ามเนื้อ/กระดูก',
  'Unstageable',
  'DTI (Deep Tissue Injury)',
];

const cleansingSolutions = [
  'NSS (Normal Saline)', 'Betadine', 'Chlorhexidine', 'H2O2 (Hydrogen Peroxide)',
  'Acetic acid', 'น้ำประปาสะอาด', 'อื่นๆ',
];

const dressingTypes = [
  'Dry dressing', 'Wet dressing', 'Foam dressing', 'Hydrocolloid', 'Hydrogel',
  'Alginate', 'Silver dressing', 'Film dressing', 'Gauze packing', 'VAC dressing', 'อื่นๆ',
];

const woundStatuses = [
  { value: 'improving', label: 'ดีขึ้น (Improving)', color: 'green' },
  { value: 'stable', label: 'คงที่ (Stable)', color: 'blue' },
  { value: 'worsening', label: 'แย่ลง (Worsening)', color: 'red' },
  { value: 'healed', label: 'หายแล้ว (Healed)', color: 'cyan' },
];

const mockRecords: WoundRecord[] = [
  {
    id: 1, an: '', record_datetime: dayjs().subtract(3, 'day').hour(10).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', wound_type: 'แผลผ่าตัด (Surgical wound)', wound_location: 'ท้อง',
    wound_size: '10x3 cm', wound_appearance: 'clean', exudate_type: 'Serous', exudate_amount: 'เล็กน้อย',
    surrounding_skin: 'ปกติ', odor: 'ไม่มี', pain_score: 5,
    cleansing_solution: 'NSS (Normal Saline)', dressing_type: 'Dry dressing',
    procedure_detail: 'ล้างแผลด้วย NSS เช็ดรอบแผลด้วย Betadine ปิดด้วย Gauze',
    wound_status: 'stable', next_dressing: 'ทำแผลซ้ำพรุ่งนี้เช้า', nurse_name: 'พย.สมหญิง',
  },
  {
    id: 2, an: '', record_datetime: dayjs().subtract(2, 'day').hour(10).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', wound_type: 'แผลผ่าตัด (Surgical wound)', wound_location: 'ท้อง',
    wound_size: '10x3 cm', wound_appearance: 'granulation', exudate_type: 'Serous', exudate_amount: 'น้อยลง',
    surrounding_skin: 'ปกติ', odor: 'ไม่มี', pain_score: 3,
    cleansing_solution: 'NSS (Normal Saline)', dressing_type: 'Foam dressing',
    procedure_detail: 'ล้าง NSS ปิด Foam dressing แผลมี granulation tissue ดี',
    wound_status: 'improving', next_dressing: 'เปลี่ยน dressing ทุก 2 วัน', nurse_name: 'พย.วิภา',
  },
  {
    id: 3, an: '', record_datetime: dayjs().hour(9).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', wound_type: 'แผลกดทับ (Pressure ulcer)', wound_location: 'ก้นกบ (Sacrum)',
    wound_size: '3x3 cm', wound_stage: 'Stage II - แผลตื้น มีถลอก/พอง', wound_appearance: 'slough',
    exudate_type: 'Serous', exudate_amount: 'ปานกลาง', surrounding_skin: 'แดง', pain_score: 4,
    cleansing_solution: 'NSS (Normal Saline)', dressing_type: 'Hydrocolloid',
    procedure_detail: 'ล้างด้วย NSS กำจัด slough บางส่วน ปิด Hydrocolloid',
    wound_status: 'stable', next_dressing: 'เปลี่ยนทุก 3 วัน หรือเมื่อรั่ว', nurse_name: 'พย.สมหญิง',
  },
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

export default function WoundCareRecord({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<WoundRecord[]>(mockRecords);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [rightTab, setRightTab] = useState('cards');

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/wound-care/${an}`, { headers });
      if (res.data?.success) setRecords(res.data.data || []);
    } catch {
      setRecords(mockRecords.map(r => ({ ...r, an })));
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
        await fetchRecords();
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [an, getHeaders, fetchRecords]);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const headers = getHeaders();
      const payload = {
        an, admission_list_id: patient?.admission_list_id,
        ward_code: patient?.ward || getUserProfile()?.ward_code || '',
        ward_name: patient?.wardName || getUserProfile()?.ward_name || '',
        staff_id: getUserProfile()?.staff_id || '',
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        shift: values.shift || null,
        wound_type: values.wound_type,
        wound_location: values.wound_location,
        wound_size: values.wound_size || null,
        wound_stage: values.wound_stage || null,
        wound_appearance: values.wound_appearance,
        exudate_type: values.exudate_type || null,
        exudate_amount: values.exudate_amount || null,
        surrounding_skin: values.surrounding_skin || null,
        odor: values.odor || null,
        pain_score: values.pain_score ?? null,
        cleansing_solution: values.cleansing_solution,
        dressing_type: values.dressing_type,
        procedure_detail: values.procedure_detail || null,
        wound_status: values.wound_status,
        next_dressing: values.next_dressing || null,
        nurse_name: values.nurse_name || null,
      };

      if (editingId) {
        await axios.put(`/api/v1/nursing-records/wound-care/${editingId}`, payload, { headers });
      } else {
        await axios.post('/api/v1/nursing-records/wound-care', payload, { headers });
      }
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: editingId ? 'แก้ไขสำเร็จ' : 'บันทึกสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      form.resetFields();
      form.setFieldsValue({ record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' });
      setEditingId(null);
      await fetchRecords();
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาด', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: WoundRecord) => {
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      record_datetime: dayjs(record.record_datetime),
    });
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/wound-care/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchRecords();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const sortedRecords = [...records].sort((a, b) => dayjs(b.record_datetime).unix() - dayjs(a.record_datetime).unix());

  const columns: ColumnsType<WoundRecord> = [
    { title: 'วันที่/เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 120, render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-' },
    { title: 'เวร', dataIndex: 'shift', key: 'shift', width: 60, align: 'center', render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0 text-xs">{v}</Tag> : '-' },
    { title: 'ชนิดแผล', dataIndex: 'wound_type', key: 'wound_type', width: 150, ellipsis: true },
    { title: 'ตำแหน่ง', dataIndex: 'wound_location', key: 'wound_location', width: 100 },
    { title: 'ขนาด', dataIndex: 'wound_size', key: 'wound_size', width: 80 },
    {
      title: 'ลักษณะ', dataIndex: 'wound_appearance', key: 'wound_appearance', width: 100,
      render: (v) => {
        const app = woundAppearances.find(a => a.value === v);
        return app ? <Tag color={app.color} className="m-0 text-xs">{app.label}</Tag> : v;
      },
    },
    {
      title: 'สถานะ', dataIndex: 'wound_status', key: 'wound_status', width: 100,
      render: (v) => {
        const st = woundStatuses.find(s => s.value === v);
        return st ? <Tag color={st.color} className="m-0 text-xs font-bold">{st.label}</Tag> : v;
      },
    },
    { title: 'พยาบาล', dataIndex: 'nurse_name', key: 'nurse_name', width: 100 },
    {
      title: '', key: 'action', width: 80, align: 'center',
      render: (_, r) => (
        <div className="flex gap-1">
          <Button type="text" size="small" icon={<VscEdit />} onClick={() => handleEdit(r)} className="text-blue-500" />
          <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(r.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
            <Button type="text" danger size="small" icon={<VscTrash />} />
          </Popconfirm>
        </div>
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
        <div className="bg-linear-to-r from-teal-500 to-emerald-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiBandaidsBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">บันทึกการทำแผล (Wound Care Record)</h1>
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
            <div className="rounded-lg px-4 py-1.5 text-center bg-white/20">
              <div className="text-white/70 text-xs">จำนวนแผล</div>
              <div className="text-white font-bold text-lg">{new Set(records.map(r => `${r.wound_type}-${r.wound_location}`)).size}</div>
            </div>
            <Button size="small" onClick={() => window.history.back()} className="border-white/30 text-white bg-white/10 hover:bg-white/20">ย้อนกลับ</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Form - Left 2 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-2"
              title={<span className="text-teal-600 font-bold text-sm">{editingId ? 'แก้ไขบันทึก' : 'บันทึกการทำแผล'}</span>}
              extra={editingId && <Button size="small" onClick={() => { setEditingId(null); form.resetFields(); form.setFieldsValue({ record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' }); }}>ยกเลิกแก้ไข</Button>}>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' }}
                className="[&_.ant-form-item]:mb-2 [&_.ant-form-item-label]:pb-0 [&_.ant-form-item-label_label]:text-xs [&_.ant-form-item-label_label]:font-semibold [&_.ant-form-item-label_label]:text-gray-600"
              >
                <Row gutter={8}>
                  <Col span={14}>
                    <Form.Item label="วันที่/เวลา" name="record_datetime" rules={[{ required: true }]}>
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

                {/* Wound Info */}
                <div className="bg-teal-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-teal-100">
                  <div className="text-xs text-teal-600 font-bold mb-2">ข้อมูลแผล</div>
                  <Form.Item label="ชนิดแผล" name="wound_type" rules={[{ required: true, message: 'กรุณาเลือกชนิดแผล' }]}>
                    <Select placeholder="เลือกชนิดแผล">
                      {woundTypes.map(t => <Option key={t} value={t}>{t}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item label="ตำแหน่ง" name="wound_location" rules={[{ required: true, message: 'กรุณาเลือกตำแหน่ง' }]}>
                    <Select placeholder="เลือกตำแหน่ง">
                      {woundLocations.map(l => <Option key={l} value={l}>{l}</Option>)}
                    </Select>
                  </Form.Item>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="ขนาด (LxW cm)" name="wound_size">
                        <Input placeholder="เช่น 3x2 cm" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Stage (แผลกดทับ)" name="wound_stage">
                        <Select placeholder="เลือก" allowClear>
                          {woundStages.map(s => <Option key={s} value={s}>{s}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="ลักษณะแผล" name="wound_appearance" rules={[{ required: true }]}>
                    <Select placeholder="เลือกลักษณะ">
                      {woundAppearances.map(a => <Option key={a.value} value={a.value}>{a.label}</Option>)}
                    </Select>
                  </Form.Item>
                  <Row gutter={8}>
                    <Col span={8}>
                      <Form.Item label="Exudate" name="exudate_type">
                        <Select placeholder="ชนิด" allowClear>
                          <Option value="Serous">Serous</Option>
                          <Option value="Sanguineous">Sanguineous</Option>
                          <Option value="Serosanguineous">Serosanguineous</Option>
                          <Option value="Purulent">Purulent</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="ปริมาณ" name="exudate_amount">
                        <Select placeholder="เลือก" allowClear>
                          <Option value="ไม่มี">ไม่มี</Option>
                          <Option value="เล็กน้อย">เล็กน้อย</Option>
                          <Option value="ปานกลาง">ปานกลาง</Option>
                          <Option value="มาก">มาก</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="กลิ่น" name="odor">
                        <Select placeholder="เลือก" allowClear>
                          <Option value="ไม่มี">ไม่มี</Option>
                          <Option value="มีกลิ่นเล็กน้อย">เล็กน้อย</Option>
                          <Option value="มีกลิ่นมาก">มาก</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="ผิวหนังรอบแผล" name="surrounding_skin">
                    <Input placeholder="เช่น ปกติ, แดง, บวม" />
                  </Form.Item>
                </div>

                {/* Procedure */}
                <div className="bg-blue-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-blue-100">
                  <div className="text-xs text-blue-600 font-bold mb-2">การทำแผล</div>
                  <Form.Item label="น้ำยาล้างแผล" name="cleansing_solution" rules={[{ required: true }]}>
                    <Select placeholder="เลือก">
                      {cleansingSolutions.map(s => <Option key={s} value={s}>{s}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item label="ชนิดวัสดุปิดแผล" name="dressing_type" rules={[{ required: true }]}>
                    <Select placeholder="เลือก">
                      {dressingTypes.map(d => <Option key={d} value={d}>{d}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item label="รายละเอียดการทำแผล" name="procedure_detail">
                    <TextArea rows={2} placeholder="ระบุขั้นตอนการทำแผล..." />
                  </Form.Item>
                </div>

                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item label="สถานะแผล" name="wound_status" rules={[{ required: true }]}>
                      <Select placeholder="เลือก">
                        {woundStatuses.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Pain Score" name="pain_score">
                      <Select placeholder="คะแนน" allowClear>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => <Option key={s} value={s}>{s}</Option>)}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="แผนการทำแผลครั้งถัดไป" name="next_dressing">
                  <Input placeholder="เช่น ทำแผลซ้ำพรุ่งนี้เช้า" />
                </Form.Item>

                <Form.Item label="พยาบาลผู้ทำแผล" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                  className="bg-teal-500 hover:bg-teal-600 w-full shadow-md" size="middle">
                  {editingId ? 'แก้ไขบันทึก' : 'บันทึกการทำแผล'}
                </Button>
              </Form>
            </Card>

            {/* Cards + Table - Right 3 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-teal-500! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'cards',
                    label: <span className="flex items-center gap-1.5"><PiCardsBold /> บันทึก ({records.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {sortedRecords.map(rec => {
                          const app = woundAppearances.find(a => a.value === rec.wound_appearance);
                          const st = woundStatuses.find(s => s.value === rec.wound_status);
                          return (
                            <div key={rec.id} className="bg-white border-l-4 rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow"
                              style={{ borderLeftColor: st?.color === 'green' ? '#16a34a' : st?.color === 'blue' ? '#2563eb' : st?.color === 'red' ? '#dc2626' : '#06b6d4' }}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Tag color={shiftColor[rec.shift || ''] || 'default'} className="m-0 text-xs">{rec.shift || '-'}</Tag>
                                  <span className="text-xs text-gray-400">{dayjs(rec.record_datetime).format('DD/MM/YYYY HH:mm')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {app && <Tag color={app.color} className="m-0 text-xs">{app.label}</Tag>}
                                  {st && <Tag color={st.color} className="m-0 text-xs font-bold">{st.label}</Tag>}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-2">
                                <Tag color="cyan" className="m-0 text-xs font-bold">{rec.wound_type}</Tag>
                                <Tag color="blue" className="m-0 text-xs">{rec.wound_location}</Tag>
                                {rec.wound_size && <Tag className="m-0 text-xs">ขนาด: {rec.wound_size}</Tag>}
                                {rec.wound_stage && <Tag color="orange" className="m-0 text-xs">{rec.wound_stage.split(' - ')[0]}</Tag>}
                              </div>

                              <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                                {rec.exudate_type && <div><span className="text-gray-400">Exudate:</span> {rec.exudate_type} ({rec.exudate_amount})</div>}
                                {rec.odor && <div><span className="text-gray-400">กลิ่น:</span> {rec.odor}</div>}
                                {rec.surrounding_skin && <div><span className="text-gray-400">ผิวรอบแผล:</span> {rec.surrounding_skin}</div>}
                              </div>

                              <div className="bg-blue-50 rounded-lg px-3 py-1.5 text-xs text-blue-700 mb-1">
                                <span className="font-bold">ล้าง:</span> {rec.cleansing_solution} | <span className="font-bold">ปิด:</span> {rec.dressing_type}
                              </div>

                              {rec.procedure_detail && (
                                <div className="bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-600 mb-1">
                                  <span className="font-bold text-gray-500">รายละเอียด:</span> {rec.procedure_detail}
                                </div>
                              )}

                              {rec.next_dressing && (
                                <div className="bg-amber-50 rounded-lg px-3 py-1.5 text-xs text-amber-700">
                                  <span className="font-bold">แผนครั้งถัดไป:</span> {rec.next_dressing}
                                </div>
                              )}

                              <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
                                <div className="flex gap-1">
                                  <Button size="small" type="text" icon={<VscEdit />} onClick={() => handleEdit(rec)} className="text-blue-500 text-xs" />
                                  <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(rec.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
                                    <Button size="small" type="text" danger icon={<VscTrash />} className="text-xs" />
                                  </Popconfirm>
                                </div>
                                <span className="text-xs text-gray-400">ทำแผลโดย: <span className="font-semibold text-gray-600">{rec.nurse_name || '-'}</span></span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ),
                  },
                  {
                    key: 'table',
                    label: <span className="flex items-center gap-1.5"><PiListBulletsBold /> ตาราง</span>,
                    children: (
                      <div className="p-3">
                        <Table columns={columns} dataSource={sortedRecords} rowKey="id" size="small"
                          pagination={{ pageSize: 10, size: 'small' }} scroll={{ x: 1100 }} locale={{ emptyText: 'ยังไม่มีบันทึก' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-teal-50! [&_.ant-table-thead_.ant-table-cell]:text-teal-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!" />
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
