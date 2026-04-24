'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave, VscTrash, VscEdit } from 'react-icons/vsc';
import { PiShieldCheckBold, PiListBulletsBold, PiNotePencilBold } from 'react-icons/pi';

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

interface SpecialCare {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  care_type: string;
  care_detail: string;
  procedure_done?: string;
  patient_response?: string;
  complications?: string;
  equipment_used?: string;
  next_plan?: string;
  nurse_name?: string;
}

const careTypes = [
  { value: 'suction', label: 'Suction (ดูดเสมหะ)' },
  { value: 'o2therapy', label: 'O2 Therapy (ให้ออกซิเจน)' },
  { value: 'ventilator', label: 'Ventilator Care' },
  { value: 'tracheostomy', label: 'Tracheostomy Care' },
  { value: 'chest_tube', label: 'Chest Tube Care' },
  { value: 'cvc', label: 'CVC / Central Line Care' },
  { value: 'ngt', label: 'NG Tube Care' },
  { value: 'foley', label: 'Foley Catheter Care' },
  { value: 'wound_vac', label: 'Wound VAC' },
  { value: 'dialysis', label: 'Dialysis Care' },
  { value: 'blood_transfusion', label: 'Blood Transfusion' },
  { value: 'isolation', label: 'Isolation Precaution' },
  { value: 'cpr', label: 'CPR / Resuscitation' },
  { value: 'other', label: 'อื่นๆ' },
];

const careTypeColor: Record<string, string> = {
  suction: 'blue', o2therapy: 'cyan', ventilator: 'red', tracheostomy: 'volcano',
  chest_tube: 'orange', cvc: 'purple', ngt: 'green', foley: 'lime',
  wound_vac: 'magenta', dialysis: 'geekblue', blood_transfusion: 'red',
  isolation: 'gold', cpr: 'red', other: 'default',
};

const mockSpecialCares: SpecialCare[] = [
  {
    id: 1, an: '', record_datetime: dayjs().subtract(2, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', care_type: 'suction', care_detail: 'ดูดเสมหะทาง oral & nasal',
    procedure_done: 'Suction oral & nasal ด้วย catheter No.12 ใช้ pressure -100 mmHg ได้เสมหะสีขาวข้น ปริมาณปานกลาง',
    patient_response: 'ผู้ป่วยไอได้ดีขึ้น SpO2 เพิ่มจาก 94% เป็น 98% หายใจสะดวกขึ้น',
    equipment_used: 'Suction catheter No.12, Suction machine', next_plan: 'Suction prn ทุก 4-6 ชม. หรือเมื่อมี secretion',
    nurse_name: 'พย.สมหญิง',
  },
  {
    id: 2, an: '', record_datetime: dayjs().subtract(2, 'day').hour(10).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', care_type: 'o2therapy', care_detail: 'ให้ O2 cannula 3 LPM',
    procedure_done: 'ให้ O2 cannula 3 LPM ตามแผนการรักษา monitor SpO2 ทุก 2 ชม.',
    patient_response: 'SpO2 97-99% หายใจปกติ ไม่เหนื่อย RR 18/min',
    equipment_used: 'O2 cannula, Flow meter, Pulse oximeter',
    next_plan: 'คง O2 3 LPM ประเมิน SpO2 ทุก shift ถ้า SpO2 > 95% off room air พิจารณาลด O2',
    nurse_name: 'พย.สมหญิง',
  },
  {
    id: 3, an: '', record_datetime: dayjs().subtract(1, 'day').hour(14).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', care_type: 'blood_transfusion', care_detail: 'ให้ PRC 1 unit',
    procedure_done: 'เริ่มให้ PRC 1 unit (unit No.BT2024-5678) ตรวจสอบ crossmatch ถูกต้อง เริ่ม rate 20 ml/hr x 15 นาที แล้วเพิ่มเป็น 60 ml/hr',
    patient_response: 'ไม่มีอาการแพ้เลือด T 36.8°C ไม่มีผื่น ไม่หนาวสั่น monitor V/S ทุก 15 นาที x 1 ชม. แล้วทุก 30 นาที',
    complications: 'ไม่มี', equipment_used: 'Blood set, PRC 1 unit',
    next_plan: 'F/U CBC หลังให้เลือดครบ เฝ้าระวังอาการแพ้เลือดต่อ 24 ชม.',
    nurse_name: 'พย.วิภา',
  },
  {
    id: 4, an: '', record_datetime: dayjs().hour(8).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', care_type: 'foley', care_detail: 'ดูแล Foley catheter ประจำวัน',
    procedure_done: 'ดูแลทำความสะอาด perineal area ตรวจสอบ catheter fixation ไม่มี kink ตรวจปริมาณ urine สีเหลืองใส',
    patient_response: 'ไม่มีอาการปวดแสบ ไม่มี discharge ผิดปกติ Urine output 50-60 ml/hr',
    equipment_used: 'NSS, sterile gauze', next_plan: 'ดูแลต่อเนื่อง ประเมินความจำเป็นในการคา catheter ทุกวัน พิจารณาถอดเมื่อ off bed rest',
    nurse_name: 'พย.สมหญิง',
  },
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

export default function SpecialCareRecord({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<SpecialCare[]>(mockSpecialCares);
  const [editingRecord, setEditingRecord] = useState<SpecialCare | null>(null);
  const [rightTab, setRightTab] = useState('cards');

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/special/${an}`, { headers });
      if (res.data?.success) setRecords(res.data.data || []);
    } catch {
      setRecords(mockSpecialCares.map(r => ({ ...r, an })));
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
        shift: values.shift || null, care_type: values.care_type, care_detail: values.care_detail || null,
        procedure_done: values.procedure_done || null, patient_response: values.patient_response || null,
        complications: values.complications || null, equipment_used: values.equipment_used || null,
        next_plan: values.next_plan || null, nurse_name: values.nurse_name || null,
      };
      if (editingRecord?.id) {
        await axios.put(`/api/v1/nursing-records/special/${editingRecord.id}`, payload, { headers });
      } else {
        await axios.post('/api/v1/nursing-records/special', payload, { headers });
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

  const handleEdit = (record: SpecialCare) => {
    setEditingRecord(record);
    form.setFieldsValue({ ...record, record_datetime: record.record_datetime ? dayjs(record.record_datetime) : dayjs() });
    setRightTab('cards');
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/special/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchRecords();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const sortedRecords = [...records].sort((a, b) => dayjs(b.record_datetime).unix() - dayjs(a.record_datetime).unix());

  const columns: ColumnsType<SpecialCare> = [
    { title: 'วันที่/เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 120, render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-' },
    { title: 'เวร', dataIndex: 'shift', key: 'shift', width: 60, align: 'center', render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0 text-xs">{v}</Tag> : '-' },
    { title: 'ประเภท', dataIndex: 'care_type', key: 'care_type', width: 140, render: (v) => <Tag color={careTypeColor[v] || 'default'} className="m-0">{careTypes.find(c => c.value === v)?.label || v}</Tag> },
    { title: 'รายละเอียด', dataIndex: 'care_detail', key: 'care_detail', ellipsis: true },
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
        <div className="bg-linear-to-r from-rose-600 to-pink-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiShieldCheckBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">บันทึกการดูแลพิเศษ (Special Care Records)</h1>
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
                  <span className="text-rose-600 font-bold text-sm">{editingRecord ? 'แก้ไขบันทึก' : 'เพิ่มบันทึกการดูแลพิเศษ'}</span>
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

                <Form.Item label="ประเภทการดูแล" name="care_type" rules={[{ required: true, message: 'กรุณาเลือก' }]}>
                  <Select placeholder="เลือกประเภท" showSearch optionFilterProp="label"
                    options={careTypes.map(c => ({ value: c.value, label: c.label }))} />
                </Form.Item>

                <Form.Item label="รายละเอียด" name="care_detail" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
                  <Input placeholder="สรุปสั้นๆ" />
                </Form.Item>

                <div className="bg-rose-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-rose-100">
                  <div className="text-xs text-rose-600 font-bold mb-1">รายละเอียดการดูแล</div>
                  <Form.Item label="Procedure / สิ่งที่ทำ" name="procedure_done" className="mb-1!">
                    <TextArea rows={3} placeholder="ขั้นตอนที่ทำ..." />
                  </Form.Item>
                  <Form.Item label="การตอบสนองของผู้ป่วย" name="patient_response" className="mb-1!">
                    <TextArea rows={2} placeholder="ผู้ป่วยตอบสนองอย่างไร..." />
                  </Form.Item>
                  <Form.Item label="ภาวะแทรกซ้อน" name="complications" className="mb-1!">
                    <Input placeholder="ระบุ หรือ 'ไม่มี'" />
                  </Form.Item>
                </div>

                <Form.Item label="อุปกรณ์ที่ใช้" name="equipment_used">
                  <Input placeholder="เช่น Suction catheter No.12" />
                </Form.Item>
                <Form.Item label="แผนต่อไป" name="next_plan">
                  <TextArea rows={2} placeholder="แผนการดูแลต่อเนื่อง..." />
                </Form.Item>
                <Form.Item label="พยาบาลผู้บันทึก" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                  className="bg-rose-600 hover:bg-rose-700 w-full shadow-md" size="middle">
                  {editingRecord ? 'อัพเดตบันทึก' : 'บันทึก'}
                </Button>
              </Form>
            </Card>

            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-rose-600! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
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
                                <Tag color={careTypeColor[rec.care_type] || 'default'} className="m-0 text-xs font-semibold">
                                  {careTypes.find(c => c.value === rec.care_type)?.label || rec.care_type}
                                </Tag>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button type="text" size="small" icon={<VscEdit />} onClick={() => handleEdit(rec)} className="text-blue-500" />
                                <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(rec.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
                                  <Button type="text" danger size="small" icon={<VscTrash />} />
                                </Popconfirm>
                              </div>
                            </div>
                            <div className="font-semibold text-rose-700 text-sm mb-2">{rec.care_detail}</div>
                            <div className="space-y-1 text-sm">
                              {rec.procedure_done && (
                                <div><span className="text-rose-500 font-bold text-xs">Procedure:</span><span className="text-gray-700 ml-1 text-xs">{rec.procedure_done}</span></div>
                              )}
                              {rec.patient_response && (
                                <div className="bg-blue-50 rounded-lg px-2 py-1"><span className="text-blue-500 font-bold text-xs">Response:</span><span className="text-gray-700 ml-1 text-xs">{rec.patient_response}</span></div>
                              )}
                              {rec.complications && (
                                <div><span className="text-red-500 font-bold text-xs">ภาวะแทรกซ้อน:</span><span className="text-gray-700 ml-1 text-xs">{rec.complications}</span></div>
                              )}
                              {rec.next_plan && (
                                <div className="bg-amber-50 rounded-lg px-2 py-1"><span className="text-amber-600 font-bold text-xs">แผนต่อไป:</span><span className="text-gray-700 ml-1 text-xs">{rec.next_plan}</span></div>
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
                          pagination={{ pageSize: 10, size: 'small' }} scroll={{ x: 900 }} locale={{ emptyText: 'ยังไม่มีบันทึก' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-rose-50! [&_.ant-table-thead_.ant-table-cell]:text-rose-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!" />
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
