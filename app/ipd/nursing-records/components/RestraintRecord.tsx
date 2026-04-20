'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs, Checkbox } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Input from 'antd/es/input';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { VscSave, VscTrash, VscEdit } from 'react-icons/vsc';
import { PiHandGrabbingBold, PiListBulletsBold, PiCardsBold } from 'react-icons/pi';

const { Option } = Select;
const { TextArea } = Input;

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
}

interface RestraintRec {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  restraint_type: string;
  restraint_site: string[];
  indication: string;
  physician_order: boolean;
  start_time: string;
  release_time?: string;
  duration?: string;
  circulation_check: boolean;
  skin_check: boolean;
  rom_exercise: boolean;
  repositioning: boolean;
  nutrition_hydration: boolean;
  toileting: boolean;
  patient_response?: string;
  complications?: string;
  status: 'active' | 'released' | 'discontinued';
  nurse_name?: string;
}

const restraintTypes = [
  'สายรัดข้อมือ (Wrist restraint)',
  'สายรัดข้อเท้า (Ankle restraint)',
  'เสื้อผูกยึด (Vest/Jacket restraint)',
  'ถุงมือป้องกัน (Mitt restraint)',
  'ที่กั้นเตียง (Side rails)',
  'อื่นๆ',
];

const restraintSites = [
  'ข้อมือซ้าย', 'ข้อมือขวา', 'ข้อเท้าซ้าย', 'ข้อเท้าขวา',
  'ลำตัว', 'มือซ้าย', 'มือขวา', 'ทั้ง 4 extremities',
];

const indications = [
  'ป้องกันดึงท่อช่วยหายใจ (ETT)',
  'ป้องกันดึงสาย IV / สายต่างๆ',
  'ป้องกันทำร้ายตนเอง',
  'ป้องกันทำร้ายผู้อื่น',
  'สับสน กระสับกระส่าย (Agitation/Delirium)',
  'ป้องกันพลัดตกจากเตียง',
  'อื่นๆ',
];

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'กำลังผูกยึด', color: 'red' },
  released: { label: 'ปลดชั่วคราว', color: 'orange' },
  discontinued: { label: 'หยุดผูกยึด', color: 'green' },
};

const mockRecords: RestraintRec[] = [
  {
    id: 1, an: '', record_datetime: dayjs().subtract(1, 'day').hour(2).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'ดึก', restraint_type: 'สายรัดข้อมือ (Wrist restraint)',
    restraint_site: ['ข้อมือซ้าย', 'ข้อมือขวา'],
    indication: 'ป้องกันดึงท่อช่วยหายใจ (ETT)', physician_order: true,
    start_time: dayjs().subtract(1, 'day').hour(1).format('YYYY-MM-DD HH:mm:ss'),
    circulation_check: true, skin_check: true, rom_exercise: true,
    repositioning: true, nutrition_hydration: true, toileting: true,
    patient_response: 'พยายามดึงมือออก กระสับกระส่ายเป็นพักๆ',
    status: 'active', nurse_name: 'พย.กนก',
  },
  {
    id: 2, an: '', record_datetime: dayjs().subtract(1, 'day').hour(10).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', restraint_type: 'สายรัดข้อมือ (Wrist restraint)',
    restraint_site: ['ข้อมือซ้าย', 'ข้อมือขวา'],
    indication: 'ป้องกันดึงท่อช่วยหายใจ (ETT)', physician_order: true,
    start_time: dayjs().subtract(1, 'day').hour(1).format('YYYY-MM-DD HH:mm:ss'),
    release_time: dayjs().subtract(1, 'day').hour(10).format('YYYY-MM-DD HH:mm:ss'),
    duration: '30 นาที',
    circulation_check: true, skin_check: true, rom_exercise: true,
    repositioning: true, nutrition_hydration: true, toileting: true,
    patient_response: 'สงบขึ้น ปลดชั่วคราวเพื่อ ROM exercise',
    status: 'released', nurse_name: 'พย.สมหญิง',
  },
  {
    id: 3, an: '', record_datetime: dayjs().hour(9).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', restraint_type: 'สายรัดข้อมือ (Wrist restraint)',
    restraint_site: ['ข้อมือซ้าย', 'ข้อมือขวา'],
    indication: 'ป้องกันดึงท่อช่วยหายใจ (ETT)', physician_order: true,
    start_time: dayjs().subtract(1, 'day').hour(1).format('YYYY-MM-DD HH:mm:ss'),
    release_time: dayjs().hour(9).format('YYYY-MM-DD HH:mm:ss'),
    circulation_check: true, skin_check: true, rom_exercise: true,
    repositioning: true, nutrition_hydration: true, toileting: true,
    patient_response: 'Extubation แล้ว สงบดี หยุดผูกยึด',
    complications: 'ไม่พบภาวะแทรกซ้อน ผิวหนังบริเวณข้อมือปกติ',
    status: 'discontinued', nurse_name: 'พย.วิภา',
  },
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

export default function RestraintRecord({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<RestraintRec[]>(mockRecords);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [rightTab, setRightTab] = useState('cards');

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/restraint/${an}`, { headers });
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
        const patientRes = await axios.get(`/api/v1/view-patient-by-an/${an}`, { headers });
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
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        shift: values.shift || null,
        restraint_type: values.restraint_type,
        restraint_site: values.restraint_site || [],
        indication: values.indication,
        physician_order: values.physician_order || false,
        start_time: values.start_time ? dayjs(values.start_time).format('YYYY-MM-DD HH:mm:ss') : null,
        release_time: values.release_time ? dayjs(values.release_time).format('YYYY-MM-DD HH:mm:ss') : null,
        duration: values.duration || null,
        circulation_check: values.monitoring?.includes('circulation') || false,
        skin_check: values.monitoring?.includes('skin') || false,
        rom_exercise: values.monitoring?.includes('rom') || false,
        repositioning: values.monitoring?.includes('repositioning') || false,
        nutrition_hydration: values.monitoring?.includes('nutrition') || false,
        toileting: values.monitoring?.includes('toileting') || false,
        patient_response: values.patient_response || null,
        complications: values.complications || null,
        status: values.status || 'active',
        nurse_name: values.nurse_name || null,
      };

      if (editingId) {
        await axios.put(`/api/v1/nursing-records/restraint/${editingId}`, payload, { headers });
      } else {
        await axios.post('/api/v1/nursing-records/restraint', payload, { headers });
      }
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: editingId ? 'แก้ไขสำเร็จ' : 'บันทึกสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      form.resetFields();
      form.setFieldsValue({ record_datetime: dayjs() });
      setEditingId(null);
      await fetchRecords();
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาด', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: RestraintRec) => {
    setEditingId(record.id);
    const monitoring: string[] = [];
    if (record.circulation_check) monitoring.push('circulation');
    if (record.skin_check) monitoring.push('skin');
    if (record.rom_exercise) monitoring.push('rom');
    if (record.repositioning) monitoring.push('repositioning');
    if (record.nutrition_hydration) monitoring.push('nutrition');
    if (record.toileting) monitoring.push('toileting');
    form.setFieldsValue({
      ...record,
      record_datetime: dayjs(record.record_datetime),
      start_time: record.start_time ? dayjs(record.start_time) : undefined,
      release_time: record.release_time ? dayjs(record.release_time) : undefined,
      monitoring,
    });
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/restraint/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchRecords();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const sortedRecords = [...records].sort((a, b) => dayjs(b.record_datetime).unix() - dayjs(a.record_datetime).unix());
  const activeCount = records.filter(r => r.status === 'active').length;

  const columns: ColumnsType<RestraintRec> = [
    { title: 'วันที่/เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 120, render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-' },
    { title: 'เวร', dataIndex: 'shift', key: 'shift', width: 60, align: 'center', render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0 text-xs">{v}</Tag> : '-' },
    { title: 'ชนิด', dataIndex: 'restraint_type', key: 'restraint_type', width: 150, ellipsis: true },
    { title: 'ตำแหน่ง', dataIndex: 'restraint_site', key: 'restraint_site', width: 120, render: (v: string[]) => v?.join(', ') || '-' },
    { title: 'ข้อบ่งชี้', dataIndex: 'indication', key: 'indication', width: 150, ellipsis: true },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 100, align: 'center',
      render: (v) => <Tag color={statusConfig[v]?.color} className="m-0 text-xs font-bold">{statusConfig[v]?.label}</Tag>,
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

  const patientName = patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-red-500 to-rose-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiHandGrabbingBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">บันทึกการผูกยึด (Restraint Record)</h1>
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
            {activeCount > 0 && (
              <div className="rounded-lg px-4 py-1.5 text-center bg-red-500/30">
                <div className="text-white/70 text-xs">Active</div>
                <div className="text-white font-bold text-lg">{activeCount}</div>
              </div>
            )}
            <Button size="small" onClick={() => window.history.back()} className="border-white/30 text-white bg-white/10 hover:bg-white/20">ย้อนกลับ</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Form - Left 2 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-2"
              title={<span className="text-red-600 font-bold text-sm">{editingId ? 'แก้ไขบันทึก' : 'บันทึกการผูกยึด'}</span>}
              extra={editingId && <Button size="small" onClick={() => { setEditingId(null); form.resetFields(); form.setFieldsValue({ record_datetime: dayjs() }); }}>ยกเลิกแก้ไข</Button>}>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ record_datetime: dayjs(), status: 'active' }}
                className="[&_.ant-form-item]:mb-2 [&_.ant-form-item-label]:pb-0 [&_.ant-form-item-label_label]:text-xs [&_.ant-form-item-label_label]:font-semibold [&_.ant-form-item-label_label]:text-gray-600"
              >
                <Row gutter={8}>
                  <Col span={14}>
                    <Form.Item label="วันที่/เวลาบันทึก" name="record_datetime" rules={[{ required: true }]}>
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

                {/* Restraint Info */}
                <div className="bg-red-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-red-100">
                  <div className="text-xs text-red-600 font-bold mb-2">ข้อมูลการผูกยึด</div>
                  <Form.Item label="ชนิดอุปกรณ์" name="restraint_type" rules={[{ required: true }]}>
                    <Select placeholder="เลือกชนิด">
                      {restraintTypes.map(t => <Option key={t} value={t}>{t}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item label="ตำแหน่งที่ผูกยึด" name="restraint_site" rules={[{ required: true }]}>
                    <Checkbox.Group className="flex flex-wrap gap-1">
                      {restraintSites.map(s => <Checkbox key={s} value={s} className="text-xs">{s}</Checkbox>)}
                    </Checkbox.Group>
                  </Form.Item>
                  <Form.Item label="ข้อบ่งชี้" name="indication" rules={[{ required: true }]}>
                    <Select placeholder="เลือกข้อบ่งชี้">
                      {indications.map(i => <Option key={i} value={i}>{i}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item name="physician_order" valuePropName="checked">
                    <Checkbox className="text-xs font-semibold text-red-600">มีคำสั่งแพทย์ (Physician Order)</Checkbox>
                  </Form.Item>
                </div>

                {/* Timing */}
                <div className="bg-orange-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-orange-100">
                  <div className="text-xs text-orange-600 font-bold mb-2">เวลา</div>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="เวลาเริ่มผูก" name="start_time">
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="เวลาปลด" name="release_time">
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="ระยะเวลาปลด" name="duration">
                    <Input placeholder="เช่น 30 นาที" />
                  </Form.Item>
                </div>

                {/* Monitoring checklist */}
                <div className="bg-blue-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-blue-100">
                  <div className="text-xs text-blue-600 font-bold mb-2">การติดตามดูแล (ทุก 1-2 ชม.)</div>
                  <Form.Item name="monitoring">
                    <Checkbox.Group className="flex flex-col gap-1">
                      <Checkbox value="circulation" className="text-xs">ตรวจการไหลเวียน (Circulation check)</Checkbox>
                      <Checkbox value="skin" className="text-xs">ตรวจผิวหนัง (Skin integrity)</Checkbox>
                      <Checkbox value="rom" className="text-xs">ROM exercise</Checkbox>
                      <Checkbox value="repositioning" className="text-xs">จัดท่า (Repositioning)</Checkbox>
                      <Checkbox value="nutrition" className="text-xs">อาหาร/น้ำ (Nutrition/Hydration)</Checkbox>
                      <Checkbox value="toileting" className="text-xs">ขับถ่าย (Toileting)</Checkbox>
                    </Checkbox.Group>
                  </Form.Item>
                </div>

                <Form.Item label="การตอบสนองของผู้ป่วย" name="patient_response">
                  <TextArea rows={2} placeholder="เช่น สงบ กระสับกระส่าย พยายามดึงออก" />
                </Form.Item>

                <Form.Item label="ภาวะแทรกซ้อน" name="complications">
                  <TextArea rows={2} placeholder="เช่น ผิวหนังแดง บวม" />
                </Form.Item>

                <Form.Item label="สถานะ" name="status" rules={[{ required: true }]}>
                  <Select>
                    <Option value="active">กำลังผูกยึด (Active)</Option>
                    <Option value="released">ปลดชั่วคราว (Released)</Option>
                    <Option value="discontinued">หยุดผูกยึด (Discontinued)</Option>
                  </Select>
                </Form.Item>

                <Form.Item label="พยาบาลผู้บันทึก" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                  className="bg-red-500 hover:bg-red-600 w-full shadow-md" size="middle">
                  {editingId ? 'แก้ไขบันทึก' : 'บันทึกการผูกยึด'}
                </Button>
              </Form>
            </Card>

            {/* Cards + Table - Right 3 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-red-500! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'cards',
                    label: <span className="flex items-center gap-1.5"><PiCardsBold /> บันทึก ({records.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {sortedRecords.map(rec => {
                          const stCfg = statusConfig[rec.status];
                          return (
                            <div key={rec.id} className={`bg-white border-l-4 rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow`}
                              style={{ borderLeftColor: stCfg.color === 'red' ? '#dc2626' : stCfg.color === 'orange' ? '#ea580c' : '#16a34a' }}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Tag color={shiftColor[rec.shift || ''] || 'default'} className="m-0 text-xs">{rec.shift || '-'}</Tag>
                                  <span className="text-xs text-gray-400">{dayjs(rec.record_datetime).format('DD/MM/YYYY HH:mm')}</span>
                                </div>
                                <Tag color={stCfg.color} className="m-0 text-xs font-bold">{stCfg.label}</Tag>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-2">
                                <Tag color="red" className="m-0 text-xs font-bold">{rec.restraint_type}</Tag>
                                {rec.restraint_site.map(s => <Tag key={s} className="m-0 text-xs">{s}</Tag>)}
                                {rec.physician_order && <Tag color="blue" className="m-0 text-xs">มีคำสั่งแพทย์</Tag>}
                              </div>

                              <div className="bg-red-50 rounded-lg px-3 py-1.5 text-xs text-red-700 mb-1">
                                <span className="font-bold">ข้อบ่งชี้:</span> {rec.indication}
                              </div>

                              {rec.start_time && (
                                <div className="flex gap-3 text-xs text-gray-600 mb-1">
                                  <span>เริ่ม: {dayjs(rec.start_time).format('DD/MM HH:mm')}</span>
                                  {rec.release_time && <span>ปลด: {dayjs(rec.release_time).format('DD/MM HH:mm')}</span>}
                                  {rec.duration && <span>ระยะเวลาปลด: {rec.duration}</span>}
                                </div>
                              )}

                              {/* Monitoring badges */}
                              <div className="flex flex-wrap gap-1 mb-1">
                                {rec.circulation_check && <Tag color="green" className="m-0 text-xs">Circulation OK</Tag>}
                                {rec.skin_check && <Tag color="green" className="m-0 text-xs">Skin OK</Tag>}
                                {rec.rom_exercise && <Tag color="blue" className="m-0 text-xs">ROM</Tag>}
                                {rec.repositioning && <Tag color="blue" className="m-0 text-xs">Reposition</Tag>}
                                {rec.nutrition_hydration && <Tag color="cyan" className="m-0 text-xs">Nutrition</Tag>}
                                {rec.toileting && <Tag color="cyan" className="m-0 text-xs">Toileting</Tag>}
                              </div>

                              {rec.patient_response && (
                                <div className="bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-600 mb-1">
                                  <span className="font-bold text-gray-500">การตอบสนอง:</span> {rec.patient_response}
                                </div>
                              )}

                              {rec.complications && (
                                <div className="bg-orange-50 rounded-lg px-3 py-1.5 text-xs text-orange-700">
                                  <span className="font-bold">ภาวะแทรกซ้อน:</span> {rec.complications}
                                </div>
                              )}

                              <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
                                <div className="flex gap-1">
                                  <Button size="small" type="text" icon={<VscEdit />} onClick={() => handleEdit(rec)} className="text-blue-500 text-xs" />
                                  <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(rec.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
                                    <Button size="small" type="text" danger icon={<VscTrash />} className="text-xs" />
                                  </Popconfirm>
                                </div>
                                <span className="text-xs text-gray-400">บันทึกโดย: <span className="font-semibold text-gray-600">{rec.nurse_name || '-'}</span></span>
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
                          pagination={{ pageSize: 10, size: 'small' }} scroll={{ x: 1000 }} locale={{ emptyText: 'ยังไม่มีบันทึก' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-red-50! [&_.ant-table-thead_.ant-table-cell]:text-red-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!" />
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
