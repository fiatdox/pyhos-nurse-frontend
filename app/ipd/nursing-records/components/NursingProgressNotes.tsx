'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Radio, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave, VscTrash, VscEdit } from 'react-icons/vsc';
import { PiNotePencilBold, PiListBulletsBold } from 'react-icons/pi';

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
  spcltyName?: string;
  spclty_name?: string;
  doctorName?: string;
  incharge_doctor?: string;
  ward?: string;
  wardName?: string;
}

interface NursingNote {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  focus?: string;
  note_type?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  intervention?: string;
  evaluation?: string;
  nurse_name?: string;
}

// --- Mock Data ---
const mockNotes: NursingNote[] = [
  {
    id: 1, an: '', record_datetime: dayjs().subtract(2, 'day').hour(8).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', focus: 'ไข้สูง', note_type: 'DAR',
    subjective: 'ผู้ป่วยบอกรู้สึกร้อน ปวดศีรษะ', objective: 'T 38.5°C, P 102/min, หน้าแดง เหงื่อออก',
    assessment: 'มีภาวะไข้สูง เสี่ยงต่อภาวะขาดน้ำ', plan: 'เช็ดตัวลดไข้ ให้สารน้ำ monitor V/S q 4 hr',
    intervention: 'เช็ดตัวด้วยน้ำอุ่น ให้ paracetamol 500mg 2 tab oral, เปิด IV 0.9%NSS 1000ml rate 80 ml/hr',
    evaluation: 'หลังเช็ดตัว 1 ชม. T ลดลงเป็น 37.8°C ผู้ป่วยรู้สึกสบายตัวขึ้น',
    nurse_name: 'พย.สมหญิง',
  },
  {
    id: 2, an: '', record_datetime: dayjs().subtract(2, 'day').hour(16).minute(0).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'บ่าย', focus: 'ปวดแผลผ่าตัด', note_type: 'DAR',
    subjective: 'ผู้ป่วยบอกปวดแผลมาก pain score 6/10', objective: 'แผลผ่าตัดหน้าท้อง ไม่มี discharge ผ้าก๊อซแห้งดี',
    assessment: 'มีความปวดเฉียบพลันจากแผลผ่าตัด', plan: 'ให้ยาแก้ปวดตามแผนการรักษา จัดท่าสบาย',
    intervention: 'ให้ Morphine 3mg IV, จัดท่า semi-fowler, สอนการ splinting เวลาไอ',
    evaluation: 'หลังให้ยา 30 นาที pain score ลดเป็น 2/10 ผู้ป่วยพักผ่อนได้',
    nurse_name: 'พย.วิภา',
  },
  {
    id: 3, an: '', record_datetime: dayjs().subtract(1, 'day').hour(9).minute(0).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', focus: 'เสี่ยงต่อการพลัดตกหกล้ม', note_type: 'DAR',
    subjective: 'ผู้ป่วยบอกมึนศีรษะเวลาลุกนั่ง', objective: 'Morse Fall Scale = 55 (High Risk), BP นอน 120/80 นั่ง 100/70',
    assessment: 'เสี่ยงต่อการพลัดตกหกล้มจาก orthostatic hypotension', plan: 'ยกไม้กั้นเตียง สอนเปลี่ยนท่าช้าๆ ติดป้ายเสี่ยง',
    intervention: 'ยกไม้กั้นเตียงทั้ง 2 ข้าง ติดสัญลักษณ์ Fall Risk ที่เตียง สอนผู้ป่วยและญาติเรื่องการป้องกัน',
    evaluation: 'ผู้ป่วยและญาติเข้าใจ สามารถบอกวิธีป้องกันได้ ไม่มีเหตุการณ์พลัดตกหกล้ม',
    nurse_name: 'พย.สมหญิง',
  },
  {
    id: 4, an: '', record_datetime: dayjs().hour(8).minute(15).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', focus: 'ติดตามอาการ', note_type: 'DAR',
    subjective: 'ผู้ป่วยบอกรู้สึกดีขึ้น นอนหลับได้ดี ไม่ปวดแผล', objective: 'T 36.6°C, V/S ปกติ แผลแห้งดี ไม่บวมแดง',
    assessment: 'อาการดีขึ้นตามลำดับ', plan: 'เตรียมวางแผนจำหน่าย สอน wound care ที่บ้าน',
    intervention: 'ทำแผลด้วย normal technique แผลแห้งดี เริ่มสอนผู้ป่วยเรื่อง self care ที่บ้าน',
    evaluation: 'ผู้ป่วยสามารถบอกวิธีดูแลแผลที่บ้านได้ถูกต้อง',
    nurse_name: 'พย.นิดา',
  },
];

export default function NursingProgressNotes({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [notes, setNotes] = useState<NursingNote[]>(mockNotes);
  const [editingNote, setEditingNote] = useState<NursingNote | null>(null);
  const [rightTab, setRightTab] = useState('timeline');

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchNotes = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/nursing/${an}`, { headers });
      if (res.data?.success) setNotes(res.data.data || []);
    } catch {
      setNotes(mockNotes.map(n => ({ ...n, an })));
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
        await fetchNotes();
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [an, getHeaders, fetchNotes]);

  const resetForm = () => {
    setEditingNote(null);
    form.resetFields();
    form.setFieldsValue({ record_datetime: dayjs(), note_type: 'DAR', nurse_name: getUserProfile()?.fullname || '' });
  };

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
        focus: values.focus || null,
        note_type: values.note_type || 'DAR',
        subjective: values.subjective || null,
        objective: values.objective || null,
        assessment: values.assessment || null,
        plan: values.plan || null,
        intervention: values.intervention || null,
        evaluation: values.evaluation || null,
        nurse_name: values.nurse_name || null,
      };

      if (editingNote?.id) {
        await axios.put(`/api/v1/nursing-records/nursing/${editingNote.id}`, payload, { headers });
      } else {
        await axios.post('/api/v1/nursing-records/nursing', payload, { headers });
      }
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      resetForm();
      await fetchNotes();
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาดในการบันทึก', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: NursingNote) => {
    setEditingNote(record);
    form.setFieldsValue({
      ...record,
      record_datetime: record.record_datetime ? dayjs(record.record_datetime) : dayjs(),
    });
    setRightTab('timeline');
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/nursing/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchNotes();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

  const sortedNotes = [...notes].sort((a, b) => dayjs(b.record_datetime).unix() - dayjs(a.record_datetime).unix());

  const columns: ColumnsType<NursingNote> = [
    {
      title: 'วันที่/เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 130,
      render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-',
    },
    {
      title: 'เวร', dataIndex: 'shift', key: 'shift', width: 70, align: 'center',
      render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0">{v}</Tag> : '-',
    },
    { title: 'Focus', dataIndex: 'focus', key: 'focus', width: 150, render: (v) => v ? <span className="font-semibold text-blue-700">{v}</span> : '-' },
    { title: 'S', dataIndex: 'subjective', key: 'subjective', ellipsis: true },
    { title: 'O', dataIndex: 'objective', key: 'objective', ellipsis: true },
    { title: 'A', dataIndex: 'assessment', key: 'assessment', ellipsis: true },
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
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiNotePencilBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">บันทึกทางการพยาบาล (Nursing Progress Notes)</h1>
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
              title={
                <div className="flex items-center justify-between">
                  <span className="text-blue-600 font-bold text-sm">{editingNote ? 'แก้ไขบันทึก' : 'เขียนบันทึกใหม่'}</span>
                  {editingNote && <Button size="small" type="link" onClick={resetForm} className="text-xs p-0">ยกเลิกแก้ไข</Button>}
                </div>
              }>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ record_datetime: dayjs(), note_type: 'DAR', nurse_name: getUserProfile()?.fullname || '' }}
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

                <Form.Item label="Focus / ปัญหา" name="focus" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
                  <Input placeholder="เช่น ไข้สูง, ปวดแผล, เสี่ยง Fall" />
                </Form.Item>

                <div className="bg-blue-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-blue-100">
                  <div className="text-xs text-blue-500 font-bold mb-1">DAR (Data - Action - Response)</div>
                  <Form.Item label="D - Data (S: subjective)" name="subjective" className="mb-1!">
                    <TextArea rows={2} placeholder="ผู้ป่วยบอกว่า... อาการ..." />
                  </Form.Item>
                  <Form.Item label="D - Data (O: objective)" name="objective" className="mb-1!">
                    <TextArea rows={2} placeholder="สิ่งที่ตรวจพบ V/S ผลตรวจ..." />
                  </Form.Item>
                  <Form.Item label="A - Assessment" name="assessment" className="mb-1!">
                    <TextArea rows={2} placeholder="การประเมิน/ข้อวินิจฉัย..." />
                  </Form.Item>
                  <Form.Item label="A - Action / Intervention" name="intervention" className="mb-1!">
                    <TextArea rows={2} placeholder="สิ่งที่ทำ การพยาบาลที่ให้..." />
                  </Form.Item>
                  <Form.Item label="P - Plan" name="plan" className="mb-1!">
                    <TextArea rows={1} placeholder="แผนต่อไป..." />
                  </Form.Item>
                  <Form.Item label="R - Response / Evaluation" name="evaluation" className="mb-1!">
                    <TextArea rows={2} placeholder="ผลลัพธ์ ผู้ป่วยตอบสนอง..." />
                  </Form.Item>
                </div>

                <Form.Item label="พยาบาลผู้บันทึก" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving} className="bg-blue-600 hover:bg-blue-700 w-full shadow-md" size="middle">
                  {editingNote ? 'อัพเดตบันทึก' : 'บันทึก'}
                </Button>
              </Form>
            </Card>

            {/* Timeline + Table - Right 3 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs
                activeKey={rightTab}
                onChange={setRightTab}
                type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-blue-600! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'timeline',
                    label: <span className="flex items-center gap-1.5"><PiNotePencilBold /> บันทึก ({sortedNotes.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {sortedNotes.length === 0 ? (
                          <div className="text-center text-gray-400 py-16">ยังไม่มีบันทึก</div>
                        ) : sortedNotes.map((note) => (
                          <div key={note.id} className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow relative group">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Tag color={shiftColor[note.shift || ''] || 'default'} className="m-0 text-xs">{note.shift || '-'}</Tag>
                                <span className="text-xs text-gray-400">{dayjs(note.record_datetime).format('DD/MM/YYYY HH:mm')}</span>
                                <span className="font-bold text-blue-700 text-sm">{note.focus}</span>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button type="text" size="small" icon={<VscEdit />} onClick={() => handleEdit(note)} className="text-blue-500" />
                                <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(note.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
                                  <Button type="text" danger size="small" icon={<VscTrash />} />
                                </Popconfirm>
                              </div>
                            </div>

                            {/* Content */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              {note.subjective && (
                                <div className="col-span-2">
                                  <span className="text-red-500 font-bold text-xs">S:</span>
                                  <span className="text-gray-700 ml-1">{note.subjective}</span>
                                </div>
                              )}
                              {note.objective && (
                                <div className="col-span-2">
                                  <span className="text-blue-500 font-bold text-xs">O:</span>
                                  <span className="text-gray-700 ml-1">{note.objective}</span>
                                </div>
                              )}
                              {note.assessment && (
                                <div className="col-span-2">
                                  <span className="text-amber-600 font-bold text-xs">A:</span>
                                  <span className="text-gray-700 ml-1">{note.assessment}</span>
                                </div>
                              )}
                              {note.intervention && (
                                <div className="col-span-2">
                                  <span className="text-green-600 font-bold text-xs">I:</span>
                                  <span className="text-gray-700 ml-1">{note.intervention}</span>
                                </div>
                              )}
                              {note.plan && (
                                <div className="col-span-2">
                                  <span className="text-purple-600 font-bold text-xs">P:</span>
                                  <span className="text-gray-700 ml-1">{note.plan}</span>
                                </div>
                              )}
                              {note.evaluation && (
                                <div className="col-span-2">
                                  <span className="text-teal-600 font-bold text-xs">E:</span>
                                  <span className="text-gray-700 ml-1">{note.evaluation}</span>
                                </div>
                              )}
                            </div>

                            {/* Footer */}
                            <div className="mt-2 pt-2 border-t border-gray-50 flex justify-end">
                              <span className="text-xs text-gray-400">บันทึกโดย: <span className="font-semibold text-gray-600">{note.nurse_name || '-'}</span></span>
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
                        <Table
                          columns={columns}
                          dataSource={sortedNotes}
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 10, size: 'small' }}
                          scroll={{ x: 1000 }}
                          locale={{ emptyText: 'ยังไม่มีบันทึก' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-blue-50! [&_.ant-table-thead_.ant-table-cell]:text-blue-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!"
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
