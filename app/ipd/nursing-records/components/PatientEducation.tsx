'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs, Checkbox } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave, VscTrash, VscEdit } from 'react-icons/vsc';
import { PiBookOpenBold, PiListBulletsBold, PiNotePencilBold } from 'react-icons/pi';

const { TextArea } = Input;
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
  ward?: string;
  wardName?: string;
}

interface EducationRecord {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  topic: string;
  category: string;
  target_audience: string;
  teaching_method?: string;
  content_taught: string;
  materials_used?: string;
  learner_response?: string;
  understanding_level?: string;
  barriers?: string;
  follow_up_plan?: string;
  nurse_name?: string;
}

const educationCategories = [
  { value: 'disease', label: 'ความรู้เรื่องโรค' },
  { value: 'medication', label: 'การใช้ยา' },
  { value: 'diet', label: 'อาหาร/โภชนาการ' },
  { value: 'wound_care', label: 'การดูแลแผล' },
  { value: 'activity', label: 'กิจกรรม/การออกกำลังกาย' },
  { value: 'self_care', label: 'การดูแลตนเอง' },
  { value: 'device', label: 'การใช้อุปกรณ์' },
  { value: 'discharge', label: 'เตรียมจำหน่าย' },
  { value: 'safety', label: 'ความปลอดภัย' },
  { value: 'infection', label: 'การป้องกันการติดเชื้อ' },
  { value: 'other', label: 'อื่นๆ' },
];

const understandingLevels = [
  { value: 'excellent', label: 'เข้าใจดีมาก', color: 'green' },
  { value: 'good', label: 'เข้าใจดี', color: 'blue' },
  { value: 'fair', label: 'เข้าใจพอสมควร', color: 'orange' },
  { value: 'poor', label: 'ไม่ค่อมเข้าใจ', color: 'red' },
  { value: 'unable', label: 'ไม่สามารถประเมินได้', color: 'default' },
];

const teachingMethods = [
  { value: 'verbal', label: 'อธิบาย/บอกเล่า' },
  { value: 'demonstration', label: 'สาธิต/ทำให้ดู' },
  { value: 'return_demo', label: 'ให้สาธิตกลับ' },
  { value: 'pamphlet', label: 'แจกเอกสาร/แผ่นพับ' },
  { value: 'video', label: 'ดูวิดีโอ' },
  { value: 'group', label: 'สอนกลุ่ม' },
  { value: 'other', label: 'อื่นๆ' },
];

const mockEducations: EducationRecord[] = [
  {
    id: 1, an: '', record_datetime: dayjs().subtract(2, 'day').hour(10).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', topic: 'การดูแลแผลผ่าตัดที่บ้าน', category: 'wound_care', target_audience: 'ผู้ป่วยและบุตรสาว',
    teaching_method: 'demonstration', content_taught: '1. วิธีทำแผลด้วย clean technique\n2. สังเกตอาการผิดปกติ: บวม แดง มีหนอง มีไข้\n3. ระยะเวลาหายของแผล\n4. กิจกรรมที่ควรหลีกเลี่ยง',
    materials_used: 'ชุดทำแผล, แผ่นพับการดูแลแผลที่บ้าน',
    learner_response: 'ผู้ป่วยและบุตรสาวตั้งใจฟัง ถามคำถามเพิ่มเติม สาธิตการทำแผลได้ถูกต้อง',
    understanding_level: 'good', follow_up_plan: 'ให้สาธิตซ้ำก่อนจำหน่าย',
    nurse_name: 'พย.สมหญิง',
  },
  {
    id: 2, an: '', record_datetime: dayjs().subtract(1, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', topic: 'การใช้ยาหลังจำหน่าย', category: 'medication', target_audience: 'ผู้ป่วย',
    teaching_method: 'verbal', content_taught: '1. ชื่อยา ขนาด วิธีรับประทาน เวลา\n2. อาการข้างเคียงที่ต้องเฝ้าระวัง\n3. ยาที่ต้องระวัง (anticoagulant)\n4. การเก็บรักษายา',
    materials_used: 'ตารางยา, สติกเกอร์สีติดซองยา',
    learner_response: 'ผู้ป่วยสามารถบอกชื่อยา เวลารับประทานได้ถูกต้อง',
    understanding_level: 'good', nurse_name: 'พย.นิดา',
  },
  {
    id: 3, an: '', record_datetime: dayjs().subtract(1, 'day').hour(14).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', topic: 'อาหารที่เหมาะสมหลังผ่าตัด', category: 'diet', target_audience: 'ผู้ป่วยและภรรยา',
    teaching_method: 'verbal', content_taught: '1. อาหารอ่อน ย่อยง่าย ในช่วง 1-2 สัปดาห์แรก\n2. อาหารที่ควรหลีกเลี่ยง: ของทอด ของหมักดอง เผ็ดจัด\n3. โปรตีนสูงเพื่อช่วยการหายของแผล\n4. ดื่มน้ำให้เพียงพอ',
    materials_used: 'แผ่นพับโภชนาการ',
    learner_response: 'ภรรยาจดบันทึกไว้ สามารถบอกเมนูอาหารที่จะทำได้',
    understanding_level: 'excellent', nurse_name: 'พย.วิภา',
  },
  {
    id: 4, an: '', record_datetime: dayjs().hour(9).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', topic: 'อาการผิดปกติที่ต้องมาพบแพทย์', category: 'discharge', target_audience: 'ผู้ป่วยและญาติ',
    teaching_method: 'verbal',
    content_taught: '1. ไข้สูง > 38.5°C ไม่ลดลงหลังรับประทานยา\n2. แผลบวม แดง มีหนอง มีกลิ่น\n3. ปวดมากขึ้นจนทนไม่ได้\n4. คลื่นไส้ อาเจียนมาก รับประทานอาหารไม่ได้\n5. หายใจลำบาก',
    learner_response: 'ผู้ป่วยและญาติเข้าใจ สามารถทบทวนอาการที่ต้องมาพบแพทย์ได้',
    understanding_level: 'good', follow_up_plan: 'นัด F/U 1 สัปดาห์ ที่ OPD ศัลยกรรม',
    nurse_name: 'พย.สมหญิง',
  },
];

const catColor: Record<string, string> = {
  disease: 'blue', medication: 'purple', diet: 'green', wound_care: 'volcano',
  activity: 'cyan', self_care: 'geekblue', device: 'magenta', discharge: 'orange',
  safety: 'red', infection: 'lime', other: 'default',
};
const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

export default function PatientEducation({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<EducationRecord[]>(mockEducations);
  const [editingRecord, setEditingRecord] = useState<EducationRecord | null>(null);
  const [rightTab, setRightTab] = useState('cards');

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/education/${an}`, { headers });
      if (res.data?.success) setRecords(res.data.data || []);
    } catch {
      setRecords(mockEducations.map(r => ({ ...r, an })));
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

  const resetForm = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' });
  };

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
        shift: values.shift || null, topic: values.topic, category: values.category,
        target_audience: values.target_audience || null, teaching_method: values.teaching_method || null,
        content_taught: values.content_taught || null, materials_used: values.materials_used || null,
        learner_response: values.learner_response || null, understanding_level: values.understanding_level || null,
        barriers: values.barriers || null, follow_up_plan: values.follow_up_plan || null,
        nurse_name: values.nurse_name || null,
      };
      if (editingRecord?.id) {
        await axios.put(`/api/v1/nursing-records/education/${editingRecord.id}`, payload, { headers });
      } else {
        await axios.post('/api/v1/nursing-records/education', payload, { headers });
      }
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      resetForm();
      await fetchRecords();
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาด', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: EducationRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({ ...record, record_datetime: record.record_datetime ? dayjs(record.record_datetime) : dayjs() });
    setRightTab('cards');
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/education/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchRecords();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const sortedRecords = [...records].sort((a, b) => dayjs(b.record_datetime).unix() - dayjs(a.record_datetime).unix());

  const columns: ColumnsType<EducationRecord> = [
    { title: 'วันที่/เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 120, render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-' },
    { title: 'เวร', dataIndex: 'shift', key: 'shift', width: 60, align: 'center', render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0 text-xs">{v}</Tag> : '-' },
    { title: 'หมวด', dataIndex: 'category', key: 'category', width: 120, render: (v) => <Tag color={catColor[v] || 'default'} className="m-0 text-xs">{educationCategories.find(c => c.value === v)?.label || v}</Tag> },
    { title: 'หัวข้อ', dataIndex: 'topic', key: 'topic', width: 200, render: (v) => <span className="font-semibold text-amber-700">{v}</span> },
    { title: 'ผู้เรียน', dataIndex: 'target_audience', key: 'target_audience', width: 120 },
    {
      title: 'ความเข้าใจ', dataIndex: 'understanding_level', key: 'understanding_level', width: 110, align: 'center',
      render: (v) => { const lv = understandingLevels.find(l => l.value === v); return lv ? <Tag color={lv.color} className="m-0 text-xs">{lv.label}</Tag> : '-'; },
    },
    { title: 'พยาบาล', dataIndex: 'nurse_name', key: 'nurse_name', width: 100 },
    {
      title: '', key: 'action', width: 80, align: 'center',
      render: (_, r) => (
        <div className="flex gap-1 justify-center">
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
        <div className="bg-linear-to-r from-amber-500 to-yellow-400 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiBookOpenBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">บันทึกการให้ความรู้ (Patient Education)</h1>
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
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-2"
              title={
                <div className="flex items-center justify-between">
                  <span className="text-amber-600 font-bold text-sm">{editingRecord ? 'แก้ไขบันทึก' : 'เพิ่มบันทึกการให้ความรู้'}</span>
                  {editingRecord && <Button size="small" type="link" onClick={resetForm} className="text-xs p-0">ยกเลิกแก้ไข</Button>}
                </div>
              }>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' }}
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

                <Form.Item label="หมวดหมู่" name="category" rules={[{ required: true, message: 'กรุณาเลือก' }]}>
                  <Select placeholder="เลือกหมวด" options={educationCategories.map(c => ({ value: c.value, label: c.label }))} />
                </Form.Item>

                <Form.Item label="หัวข้อ" name="topic" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
                  <Input placeholder="เช่น การดูแลแผลผ่าตัดที่บ้าน" />
                </Form.Item>

                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item label="ผู้เรียน" name="target_audience">
                      <Input placeholder="เช่น ผู้ป่วย, ญาติ" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="วิธีการสอน" name="teaching_method">
                      <Select placeholder="เลือก" options={teachingMethods.map(m => ({ value: m.value, label: m.label }))} />
                    </Form.Item>
                  </Col>
                </Row>

                <div className="bg-amber-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-amber-100">
                  <div className="text-xs text-amber-600 font-bold mb-1">เนื้อหาและการประเมิน</div>
                  <Form.Item label="เนื้อหาที่สอน" name="content_taught" rules={[{ required: true, message: 'กรุณาระบุ' }]} className="mb-1!">
                    <TextArea rows={4} placeholder="1. ...\n2. ...\n3. ..." />
                  </Form.Item>
                  <Form.Item label="สื่อ/อุปกรณ์ที่ใช้" name="materials_used" className="mb-1!">
                    <Input placeholder="เช่น แผ่นพับ, วิดีโอ, ชุดทำแผล" />
                  </Form.Item>
                  <Form.Item label="การตอบสนองของผู้เรียน" name="learner_response" className="mb-1!">
                    <TextArea rows={2} placeholder="ผู้เรียนตอบสนองอย่างไร..." />
                  </Form.Item>
                  <Form.Item label="ระดับความเข้าใจ" name="understanding_level" className="mb-1!">
                    <Select placeholder="เลือก" options={understandingLevels.map(l => ({ value: l.value, label: l.label }))} />
                  </Form.Item>
                </div>

                <Form.Item label="อุปสรรค/ข้อจำกัด" name="barriers">
                  <Input placeholder="เช่น ภาษา, การได้ยิน" />
                </Form.Item>
                <Form.Item label="แผนติดตาม" name="follow_up_plan">
                  <Input placeholder="เช่น ให้สาธิตซ้ำก่อนจำหน่าย" />
                </Form.Item>
                <Form.Item label="พยาบาลผู้บันทึก" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                  className="bg-amber-500 hover:bg-amber-600 w-full shadow-md" size="middle">
                  {editingRecord ? 'อัพเดตบันทึก' : 'บันทึก'}
                </Button>
              </Form>
            </Card>

            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-amber-500! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'cards',
                    label: <span className="flex items-center gap-1.5"><PiNotePencilBold /> บันทึก ({sortedRecords.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {sortedRecords.length === 0 ? (
                          <div className="text-center text-gray-400 py-16">ยังไม่มีบันทึก</div>
                        ) : sortedRecords.map(rec => (
                          <div key={rec.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow group">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Tag color={shiftColor[rec.shift || ''] || 'default'} className="m-0 text-xs">{rec.shift || '-'}</Tag>
                                <span className="text-xs text-gray-400">{dayjs(rec.record_datetime).format('DD/MM/YYYY HH:mm')}</span>
                                <Tag color={catColor[rec.category] || 'default'} className="m-0 text-xs">{educationCategories.find(c => c.value === rec.category)?.label || rec.category}</Tag>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button type="text" size="small" icon={<VscEdit />} onClick={() => handleEdit(rec)} className="text-blue-500" />
                                <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(rec.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
                                  <Button type="text" danger size="small" icon={<VscTrash />} />
                                </Popconfirm>
                              </div>
                            </div>
                            <div className="font-bold text-amber-700 text-sm mb-1">{rec.topic}</div>
                            <div className="text-xs text-gray-500 mb-2">ผู้เรียน: {rec.target_audience || '-'} | วิธี: {teachingMethods.find(m => m.value === rec.teaching_method)?.label || rec.teaching_method || '-'}</div>
                            <div className="space-y-1 text-sm">
                              {rec.content_taught && (
                                <div className="bg-amber-50 rounded-lg px-3 py-1.5">
                                  <span className="text-amber-600 font-bold text-xs">เนื้อหา:</span>
                                  <div className="text-gray-700 text-xs whitespace-pre-line mt-0.5">{rec.content_taught}</div>
                                </div>
                              )}
                              {rec.learner_response && (
                                <div className="bg-blue-50 rounded-lg px-3 py-1.5">
                                  <span className="text-blue-500 font-bold text-xs">การตอบสนอง:</span>
                                  <span className="text-gray-700 ml-1 text-xs">{rec.learner_response}</span>
                                </div>
                              )}
                              {rec.understanding_level && (
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-500 text-xs">ความเข้าใจ:</span>
                                  <Tag color={understandingLevels.find(l => l.value === rec.understanding_level)?.color} className="m-0 text-xs">
                                    {understandingLevels.find(l => l.value === rec.understanding_level)?.label}
                                  </Tag>
                                </div>
                              )}
                              {rec.follow_up_plan && (
                                <div><span className="text-purple-500 font-bold text-xs">แผนติดตาม:</span><span className="text-gray-700 ml-1 text-xs">{rec.follow_up_plan}</span></div>
                              )}
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-50 flex justify-end">
                              <span className="text-xs text-gray-400">บันทึกโดย: <span className="font-semibold text-gray-600">{rec.nurse_name || '-'}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: 'table',
                    label: <span className="flex items-center gap-1.5"><PiListBulletsBold /> ตาราง</span>,
                    children: (
                      <div className="p-3">
                        <Table columns={columns} dataSource={sortedRecords} rowKey="id" size="small"
                          pagination={{ pageSize: 10, size: 'small' }} scroll={{ x: 1000 }} locale={{ emptyText: 'ยังไม่มีบันทึก' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-amber-50! [&_.ant-table-thead_.ant-table-cell]:text-amber-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!" />
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
