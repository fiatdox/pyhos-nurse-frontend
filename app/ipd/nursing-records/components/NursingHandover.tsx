'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { VscSave, VscTrash, VscEdit } from 'react-icons/vsc';
import { PiArrowsLeftRightBold, PiListBulletsBold, PiNotePencilBold } from 'react-icons/pi';

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
}

interface HandoverRecord {
  id: number;
  an: string;
  handover_datetime: string;
  shift_from: string;
  shift_to: string;
  nurse_from: string;
  nurse_to?: string;
  // SBAR
  situation: string;
  background?: string;
  assessment?: string;
  recommendation?: string;
  // Additional
  pending_orders?: string;
  pending_labs?: string;
  iv_fluid_status?: string;
  diet?: string;
  activity?: string;
  safety_concerns?: string;
  family_issues?: string;
}

const mockHandovers: HandoverRecord[] = [
  {
    id: 1, an: '', handover_datetime: dayjs().subtract(1, 'day').hour(8).format('YYYY-MM-DD HH:mm:ss'),
    shift_from: 'ดึก', shift_to: 'เช้า', nurse_from: 'พย.นิดา', nurse_to: 'พย.สมหญิง',
    situation: 'ผู้ป่วยชาย อายุ 55 ปี post appendectomy day 2 อาการทั่วไปดี V/S stable T 36.8°C',
    background: 'ผ่าตัด Appendectomy เมื่อ 2 วันก่อน มี DM, HT รับยา Metformin, Amlodipine ประจำ แพ้ยา Penicillin',
    assessment: 'แผลผ่าตัดแห้งดี ไม่มี discharge pain score 2/10 ทานอาหารได้ ถ่ายอุจจาระแล้ว Bowel sound active',
    recommendation: '1. ทำแผล OD\n2. Ceftriaxone 2g IV OD เหลืออีก 3 วัน\n3. F/U DTX ac เช้า\n4. เตรียมสอน wound care ก่อนจำหน่าย',
    pending_orders: 'CBC, BUN, Cr ที่สั่งเมื่อวาน ยังไม่ได้ผล',
    iv_fluid_status: '5%DN/2 1000ml IV rate 80 ml/hr เหลือ ~300 ml (เปลี่ยนขวดเวลา ~10:00)',
    diet: 'Soft diet สำหรับ DM',
    activity: 'Ambulate ได้ ไป toilet เอง',
    safety_concerns: 'Fall Risk: Moderate (Morse 45) - ยกไม้กั้นเตียง',
  },
  {
    id: 2, an: '', handover_datetime: dayjs().subtract(1, 'day').hour(16).format('YYYY-MM-DD HH:mm:ss'),
    shift_from: 'เช้า', shift_to: 'บ่าย', nurse_from: 'พย.สมหญิง', nurse_to: 'พย.วิภา',
    situation: 'ผู้ป่วย post appendectomy day 2 อาการดีขึ้น V/S stable ทำแผลแล้ว แผลแห้งดี DTX ac เช้า 135 mg/dl',
    background: 'ได้ Ceftriaxone 2g IV OD ครบ dose แล้ววันนี้ (เช้า) แพ้ Penicillin',
    assessment: 'Pain score 1/10 ทานอาหารได้ดี ambulate ได้ดี ไม่มี complication\nCBC ผลปกติ BUN/Cr ปกติ',
    recommendation: '1. Monitor V/S routine\n2. สอนผู้ป่วยเรื่อง wound care ที่บ้าน (พย.นิดาจะสอนเวรดึก)\n3. พิจารณา off IV เช้าพรุ่งนี้\n4. DTX ac เย็น',
    pending_labs: 'ไม่มี', iv_fluid_status: '5%DN/2 ขวดใหม่ เริ่ม 10:30 rate 80 ml/hr',
    diet: 'Soft diet สำหรับ DM ทานได้ดี',
    activity: 'Ambulate ได้ดี ไป toilet เอง เดินรอบ ward ได้',
    safety_concerns: 'Fall Risk: Low (ประเมินซ้ำ Morse 30)',
  },
  {
    id: 3, an: '', handover_datetime: dayjs().hour(0).format('YYYY-MM-DD HH:mm:ss'),
    shift_from: 'บ่าย', shift_to: 'ดึก', nurse_from: 'พย.วิภา', nurse_to: 'พย.นิดา',
    situation: 'ผู้ป่วย post appendectomy day 2 เข้าเวรบ่ายอาการดี V/S stable ตลอดเวร DTX ac เย็น 142 mg/dl นอนหลับได้ดี',
    background: 'เตรียมจำหน่ายพรุ่งนี้ ถ้าอาการดี แพทย์จะ round เช้า',
    assessment: 'สภาพทั่วไปดี ไม่มีไข้ แผลดี pain free ทานได้ถ่ายได้ ambulate ดี',
    recommendation: '1. Monitor V/S ทุก shift\n2. ดูแลต่อตามแผน\n3. DTX ac เช้า\n4. เตรียม discharge summary ถ้าแพทย์ allow D/C',
    iv_fluid_status: '5%DN/2 เหลือ ~500 ml rate 80 ml/hr',
    diet: 'Soft diet ทานได้ดี',
    family_issues: 'บุตรสาวจะมารับพรุ่งนี้เช้า สอน wound care แล้ว เข้าใจดี',
  },
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

export default function NursingHandover({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<HandoverRecord[]>(mockHandovers);
  const [editingRecord, setEditingRecord] = useState<HandoverRecord | null>(null);
  const [rightTab, setRightTab] = useState('cards');

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/handover/${an}`, { headers });
      if (res.data?.success) setRecords(res.data.data || []);
    } catch {
      setRecords(mockHandovers.map(r => ({ ...r, an })));
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

  const resetForm = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ handover_datetime: dayjs() });
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const headers = getHeaders();
      const payload = {
        an, admission_list_id: patient?.admission_list_id,
        handover_datetime: values.handover_datetime ? dayjs(values.handover_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        shift_from: values.shift_from, shift_to: values.shift_to,
        nurse_from: values.nurse_from || null, nurse_to: values.nurse_to || null,
        situation: values.situation, background: values.background || null,
        assessment: values.assessment || null, recommendation: values.recommendation || null,
        pending_orders: values.pending_orders || null, pending_labs: values.pending_labs || null,
        iv_fluid_status: values.iv_fluid_status || null, diet: values.diet || null,
        activity: values.activity || null, safety_concerns: values.safety_concerns || null,
        family_issues: values.family_issues || null,
      };
      if (editingRecord?.id) {
        await axios.put(`/api/v1/nursing-records/handover/${editingRecord.id}`, payload, { headers });
      } else {
        await axios.post('/api/v1/nursing-records/handover', payload, { headers });
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

  const handleEdit = (record: HandoverRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({ ...record, handover_datetime: record.handover_datetime ? dayjs(record.handover_datetime) : dayjs() });
    setRightTab('cards');
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/handover/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchRecords();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const sortedRecords = [...records].sort((a, b) => dayjs(b.handover_datetime).unix() - dayjs(a.handover_datetime).unix());

  const columns: ColumnsType<HandoverRecord> = [
    { title: 'วันที่/เวลา', dataIndex: 'handover_datetime', key: 'handover_datetime', width: 120, render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-' },
    {
      title: 'ส่งเวร', key: 'shift', width: 120, align: 'center',
      render: (_, r) => (
        <span className="flex items-center gap-1 justify-center">
          <Tag color={shiftColor[r.shift_from] || 'default'} className="m-0 text-xs">{r.shift_from}</Tag>
          <span className="text-gray-400">→</span>
          <Tag color={shiftColor[r.shift_to] || 'default'} className="m-0 text-xs">{r.shift_to}</Tag>
        </span>
      ),
    },
    { title: 'ผู้ส่ง', dataIndex: 'nurse_from', key: 'nurse_from', width: 100 },
    { title: 'ผู้รับ', dataIndex: 'nurse_to', key: 'nurse_to', width: 100 },
    { title: 'Situation', dataIndex: 'situation', key: 'situation', ellipsis: true },
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

  const patientName = patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        <div className="bg-linear-to-r from-sky-600 to-indigo-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiArrowsLeftRightBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">บันทึกการส่งเวร (Nursing Handover / SBAR)</h1>
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
                  <span className="text-sky-600 font-bold text-sm">{editingRecord ? 'แก้ไขบันทึก' : 'บันทึกการส่งเวร (SBAR)'}</span>
                  {editingRecord && <Button size="small" type="link" onClick={resetForm} className="text-xs p-0">ยกเลิกแก้ไข</Button>}
                </div>
              }>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ handover_datetime: dayjs() }}
                className="[&_.ant-form-item]:mb-2 [&_.ant-form-item-label]:pb-0 [&_.ant-form-item-label_label]:text-xs [&_.ant-form-item-label_label]:font-semibold [&_.ant-form-item-label_label]:text-gray-600"
              >
                <Form.Item label="วันที่/เวลา" name="handover_datetime" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
                  <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
                </Form.Item>

                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item label="เวรที่ส่ง" name="shift_from" rules={[{ required: true, message: 'กรุณาเลือก' }]}>
                      <Select placeholder="เลือก">
                        <Option value="ดึก">ดึก (00-08)</Option>
                        <Option value="เช้า">เช้า (08-16)</Option>
                        <Option value="บ่าย">บ่าย (16-24)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="เวรที่รับ" name="shift_to" rules={[{ required: true, message: 'กรุณาเลือก' }]}>
                      <Select placeholder="เลือก">
                        <Option value="ดึก">ดึก (00-08)</Option>
                        <Option value="เช้า">เช้า (08-16)</Option>
                        <Option value="บ่าย">บ่าย (16-24)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item label="พยาบาลผู้ส่ง" name="nurse_from" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
                      <Input placeholder="ชื่อผู้ส่งเวร" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="พยาบาลผู้รับ" name="nurse_to">
                      <Input placeholder="ชื่อผู้รับเวร" />
                    </Form.Item>
                  </Col>
                </Row>

                {/* SBAR */}
                <div className="bg-sky-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-sky-100">
                  <div className="text-xs text-sky-600 font-bold mb-1">SBAR Communication</div>
                  <Form.Item label={<span><Tag color="red" className="m-0 mr-1 text-xs">S</Tag> Situation (สถานการณ์ปัจจุบัน)</span>}
                    name="situation" rules={[{ required: true, message: 'กรุณาระบุ' }]} className="mb-1!">
                    <TextArea rows={2} placeholder="ผู้ป่วยเป็นใคร อายุ วินิจฉัย สภาพปัจจุบัน V/S" />
                  </Form.Item>
                  <Form.Item label={<span><Tag color="orange" className="m-0 mr-1 text-xs">B</Tag> Background (ประวัติ/ภูมิหลัง)</span>}
                    name="background" className="mb-1!">
                    <TextArea rows={2} placeholder="โรคประจำตัว แพ้ยา ยาที่ได้รับ ประวัติที่เกี่ยวข้อง" />
                  </Form.Item>
                  <Form.Item label={<span><Tag color="blue" className="m-0 mr-1 text-xs">A</Tag> Assessment (การประเมิน)</span>}
                    name="assessment" className="mb-1!">
                    <TextArea rows={2} placeholder="ผลตรวจ แผล ปัญหาที่พบ การเปลี่ยนแปลง" />
                  </Form.Item>
                  <Form.Item label={<span><Tag color="green" className="m-0 mr-1 text-xs">R</Tag> Recommendation (ข้อเสนอแนะ)</span>}
                    name="recommendation" className="mb-1!">
                    <TextArea rows={3} placeholder="1. สิ่งที่ต้องทำต่อ\n2. สิ่งที่ต้องเฝ้าระวัง\n3. แผนการรักษา" />
                  </Form.Item>
                </div>

                {/* Additional info */}
                <div className="bg-gray-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-gray-200">
                  <div className="text-xs text-gray-500 font-bold mb-1">ข้อมูลเพิ่มเติม</div>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="IV Fluid" name="iv_fluid_status" className="mb-1!">
                        <Input placeholder="ชนิด rate เหลือ" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="อาหาร" name="diet" className="mb-1!">
                        <Input placeholder="เช่น Soft diet" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="กิจกรรม" name="activity" className="mb-1!">
                        <Input placeholder="เช่น Bed rest, Ambulate" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="ความปลอดภัย" name="safety_concerns" className="mb-1!">
                        <Input placeholder="เช่น Fall Risk" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="คำสั่งที่ค้างอยู่" name="pending_orders" className="mb-1!">
                    <Input placeholder="เช่น lab ที่รอผล, order ใหม่" />
                  </Form.Item>
                  <Form.Item label="เรื่องญาติ/ครอบครัว" name="family_issues" className="mb-1!">
                    <Input placeholder="เช่น ญาติจะมารับเวลา..." />
                  </Form.Item>
                </div>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                  className="bg-sky-600 hover:bg-sky-700 w-full shadow-md" size="middle">
                  {editingRecord ? 'อัพเดตบันทึก' : 'บันทึกการส่งเวร'}
                </Button>
              </Form>
            </Card>

            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-sky-600! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'cards',
                    label: <span className="flex items-center gap-1.5"><PiNotePencilBold /> บันทึก ({sortedRecords.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {sortedRecords.length === 0 ? (
                          <div className="text-center text-gray-400 py-16">ยังไม่มีบันทึกการส่งเวร</div>
                        ) : sortedRecords.map(rec => (
                          <div key={rec.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow group">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-gray-400">{dayjs(rec.handover_datetime).format('DD/MM/YYYY HH:mm')}</span>
                                <div className="flex items-center gap-1">
                                  <Tag color={shiftColor[rec.shift_from] || 'default'} className="m-0 text-xs">{rec.shift_from}</Tag>
                                  <span className="text-gray-400 text-xs">→</span>
                                  <Tag color={shiftColor[rec.shift_to] || 'default'} className="m-0 text-xs">{rec.shift_to}</Tag>
                                </div>
                                <span className="text-xs text-gray-500">{rec.nurse_from} → {rec.nurse_to || '...'}</span>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button type="text" size="small" icon={<VscEdit />} onClick={() => handleEdit(rec)} className="text-blue-500" />
                                <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(rec.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
                                  <Button type="text" danger size="small" icon={<VscTrash />} />
                                </Popconfirm>
                              </div>
                            </div>

                            {/* SBAR Content */}
                            <div className="space-y-2 text-sm">
                              <div className="bg-red-50 rounded-lg px-3 py-2 border-l-3 border-l-red-400">
                                <span className="font-bold text-red-500 text-xs">S - Situation:</span>
                                <div className="text-gray-700 text-xs mt-0.5">{rec.situation}</div>
                              </div>
                              {rec.background && (
                                <div className="bg-orange-50 rounded-lg px-3 py-2 border-l-3 border-l-orange-400">
                                  <span className="font-bold text-orange-500 text-xs">B - Background:</span>
                                  <div className="text-gray-700 text-xs mt-0.5">{rec.background}</div>
                                </div>
                              )}
                              {rec.assessment && (
                                <div className="bg-blue-50 rounded-lg px-3 py-2 border-l-3 border-l-blue-400">
                                  <span className="font-bold text-blue-500 text-xs">A - Assessment:</span>
                                  <div className="text-gray-700 text-xs mt-0.5">{rec.assessment}</div>
                                </div>
                              )}
                              {rec.recommendation && (
                                <div className="bg-green-50 rounded-lg px-3 py-2 border-l-3 border-l-green-400">
                                  <span className="font-bold text-green-600 text-xs">R - Recommendation:</span>
                                  <div className="text-gray-700 text-xs mt-0.5 whitespace-pre-line">{rec.recommendation}</div>
                                </div>
                              )}
                            </div>

                            {/* Additional info */}
                            {(rec.iv_fluid_status || rec.diet || rec.activity || rec.safety_concerns || rec.pending_orders || rec.family_issues) && (
                              <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-x-4 gap-y-1">
                                {rec.iv_fluid_status && <div className="text-xs"><span className="text-gray-400 font-semibold">IV:</span> <span className="text-gray-600">{rec.iv_fluid_status}</span></div>}
                                {rec.diet && <div className="text-xs"><span className="text-gray-400 font-semibold">อาหาร:</span> <span className="text-gray-600">{rec.diet}</span></div>}
                                {rec.activity && <div className="text-xs"><span className="text-gray-400 font-semibold">กิจกรรม:</span> <span className="text-gray-600">{rec.activity}</span></div>}
                                {rec.safety_concerns && <div className="text-xs"><span className="text-red-400 font-semibold">ความปลอดภัย:</span> <span className="text-gray-600">{rec.safety_concerns}</span></div>}
                                {rec.pending_orders && <div className="text-xs col-span-2"><span className="text-purple-400 font-semibold">คำสั่งค้าง:</span> <span className="text-gray-600">{rec.pending_orders}</span></div>}
                                {rec.family_issues && <div className="text-xs col-span-2"><span className="text-amber-500 font-semibold">ญาติ:</span> <span className="text-gray-600">{rec.family_issues}</span></div>}
                              </div>
                            )}
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
                          pagination={{ pageSize: 10, size: 'small' }} scroll={{ x: 800 }} locale={{ emptyText: 'ยังไม่มีบันทึก' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-sky-50! [&_.ant-table-thead_.ant-table-cell]:text-sky-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!" />
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
