'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Input from 'antd/es/input';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave, VscTrash } from 'react-icons/vsc';
import { PiBrainBold, PiListBulletsBold, PiChartLineUpBold } from 'react-icons/pi';

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

interface GCSRecord {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  eye_opening: number;
  verbal_response: number;
  motor_response: number;
  total_score: number;
  level: string;
  pupil_left?: string;
  pupil_right?: string;
  pupil_reaction_left?: string;
  pupil_reaction_right?: string;
  additional_notes?: string;
  nurse_name?: string;
}

const gcsItems = {
  eye_opening: {
    label: 'E - Eye Opening (การลืมตา)',
    options: [
      { value: 4, label: '4 - ลืมตาเอง (Spontaneous)' },
      { value: 3, label: '3 - ลืมตาเมื่อเรียก (To voice)' },
      { value: 2, label: '2 - ลืมตาเมื่อเจ็บ (To pain)' },
      { value: 1, label: '1 - ไม่ลืมตา (None)' },
    ],
  },
  verbal_response: {
    label: 'V - Verbal Response (การพูด)',
    options: [
      { value: 5, label: '5 - พูดรู้เรื่อง (Oriented)' },
      { value: 4, label: '4 - พูดสับสน (Confused)' },
      { value: 3, label: '3 - พูดไม่เป็นประโยค (Inappropriate words)' },
      { value: 2, label: '2 - ส่งเสียงไม่เป็นคำ (Incomprehensible sounds)' },
      { value: 1, label: '1 - ไม่ส่งเสียง (None)' },
    ],
  },
  motor_response: {
    label: 'M - Motor Response (การเคลื่อนไหว)',
    options: [
      { value: 6, label: '6 - ทำตามคำสั่ง (Obeys commands)' },
      { value: 5, label: '5 - ชี้ตำแหน่งเจ็บ (Localizing pain)' },
      { value: 4, label: '4 - ดึงหนี (Withdrawal)' },
      { value: 3, label: '3 - งอแขนผิดปกติ (Abnormal flexion)' },
      { value: 2, label: '2 - เหยียดแขนผิดปกติ (Extension)' },
      { value: 1, label: '1 - ไม่เคลื่อนไหว (None)' },
    ],
  },
};

const getGCSLevel = (score: number): string => {
  if (score <= 3) return 'coma_deep';
  if (score <= 8) return 'severe';
  if (score <= 12) return 'moderate';
  return 'mild';
};

const gcsLevelConfig: Record<string, { label: string; color: string; bgColor: string; textColor: string; border: string; bg: string }> = {
  coma_deep: {
    label: 'Deep Coma (3)',
    color: 'red',
    bgColor: 'bg-red-50 border-red-200',
    textColor: 'text-red-700',
    border: '#dc2626',
    bg: '#fca5a5',
  },
  severe: {
    label: 'Severe (4-8)',
    color: 'volcano',
    bgColor: 'bg-orange-50 border-orange-200',
    textColor: 'text-orange-700',
    border: '#ea580c',
    bg: '#fdba74',
  },
  moderate: {
    label: 'Moderate (9-12)',
    color: 'orange',
    bgColor: 'bg-amber-50 border-amber-200',
    textColor: 'text-amber-700',
    border: '#d97706',
    bg: '#fde68a',
  },
  mild: {
    label: 'Mild (13-15)',
    color: 'green',
    bgColor: 'bg-green-50 border-green-200',
    textColor: 'text-green-700',
    border: '#16a34a',
    bg: '#86efac',
  },
};

const pupilSizes = ['1 mm', '2 mm', '3 mm', '4 mm', '5 mm', '6 mm', '7 mm', '8 mm', 'Pinpoint'];
const pupilReactions = [
  { value: 'brisk', label: 'ไวปกติ (Brisk)' },
  { value: 'sluggish', label: 'ช้า (Sluggish)' },
  { value: 'fixed', label: 'ไม่หด (Fixed)' },
];

const mockRecords: GCSRecord[] = [
  {
    id: 1, an: '', record_datetime: dayjs().subtract(2, 'day').hour(8).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', eye_opening: 2, verbal_response: 2, motor_response: 4,
    total_score: 8, level: 'severe',
    pupil_left: '3 mm', pupil_right: '3 mm', pupil_reaction_left: 'sluggish', pupil_reaction_right: 'sluggish',
    additional_notes: 'Post op craniotomy Day 1', nurse_name: 'พย.สมหญิง',
  },
  {
    id: 2, an: '', record_datetime: dayjs().subtract(1, 'day').hour(8).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', eye_opening: 3, verbal_response: 3, motor_response: 5,
    total_score: 11, level: 'moderate',
    pupil_left: '3 mm', pupil_right: '3 mm', pupil_reaction_left: 'brisk', pupil_reaction_right: 'brisk',
    additional_notes: 'ลืมตาเมื่อเรียก พูดไม่เป็นประโยค ชี้ตำแหน่งเจ็บได้', nurse_name: 'พย.วิภา',
  },
  {
    id: 3, an: '', record_datetime: dayjs().subtract(1, 'day').hour(16).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'บ่าย', eye_opening: 3, verbal_response: 4, motor_response: 5,
    total_score: 12, level: 'moderate',
    pupil_left: '3 mm', pupil_right: '3 mm', pupil_reaction_left: 'brisk', pupil_reaction_right: 'brisk',
    nurse_name: 'พย.กนก',
  },
  {
    id: 4, an: '', record_datetime: dayjs().hour(8).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', eye_opening: 4, verbal_response: 5, motor_response: 6,
    total_score: 15, level: 'mild',
    pupil_left: '3 mm', pupil_right: '3 mm', pupil_reaction_left: 'brisk', pupil_reaction_right: 'brisk',
    additional_notes: 'รู้สึกตัวดี พูดคุยรู้เรื่อง ทำตามคำสั่งได้', nurse_name: 'พย.สมหญิง',
  },
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

export default function GCSAssessment({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<GCSRecord[]>(mockRecords);
  const [rightTab, setRightTab] = useState('trend');
  const [liveScore, setLiveScore] = useState(15);

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/gcs/${an}`, { headers });
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

  const recalcScore = () => {
    const values = form.getFieldsValue();
    const score = (values.eye_opening || 4) + (values.verbal_response || 5) + (values.motor_response || 6);
    setLiveScore(score);
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    const totalScore = (values.eye_opening || 4) + (values.verbal_response || 5) + (values.motor_response || 6);
    const level = getGCSLevel(totalScore);

    try {
      const headers = getHeaders();
      const payload = {
        an, admission_list_id: patient?.admission_list_id,
        ward_code: patient?.ward || getUserProfile()?.ward_code || '',
        ward_name: patient?.wardName || getUserProfile()?.ward_name || '',
        staff_id: getUserProfile()?.staff_id || '',
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        shift: values.shift || null,
        eye_opening: values.eye_opening || 4,
        verbal_response: values.verbal_response || 5,
        motor_response: values.motor_response || 6,
        total_score: totalScore,
        level,
        pupil_left: values.pupil_left || null,
        pupil_right: values.pupil_right || null,
        pupil_reaction_left: values.pupil_reaction_left || null,
        pupil_reaction_right: values.pupil_reaction_right || null,
        additional_notes: values.additional_notes || null,
        nurse_name: values.nurse_name || null,
      };
      await axios.post('/api/v1/nursing-records/gcs', payload, { headers });
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกการประเมินสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      form.resetFields();
      form.setFieldsValue({ record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' });
      setLiveScore(15);
      await fetchRecords();
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาด', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/gcs/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchRecords();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const liveLevel = getGCSLevel(liveScore);
  const liveCfg = gcsLevelConfig[liveLevel];

  const sortedRecords = [...records].sort((a, b) => dayjs(b.record_datetime).unix() - dayjs(a.record_datetime).unix());
  const latestRecord = sortedRecords[0];

  const columns: ColumnsType<GCSRecord> = [
    { title: 'วันที่/เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 120, render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-' },
    { title: 'เวร', dataIndex: 'shift', key: 'shift', width: 60, align: 'center', render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0 text-xs">{v}</Tag> : '-' },
    { title: 'E', dataIndex: 'eye_opening', key: 'eye_opening', width: 40, align: 'center' },
    { title: 'V', dataIndex: 'verbal_response', key: 'verbal_response', width: 40, align: 'center' },
    { title: 'M', dataIndex: 'motor_response', key: 'motor_response', width: 40, align: 'center' },
    {
      title: 'GCS', dataIndex: 'total_score', key: 'total_score', width: 60, align: 'center',
      render: (v) => <span className="font-bold text-lg">{v}</span>,
    },
    {
      title: 'ระดับ', dataIndex: 'level', key: 'level', width: 110, align: 'center',
      render: (v) => <Tag color={gcsLevelConfig[v]?.color} className="m-0 font-bold text-xs">{gcsLevelConfig[v]?.label}</Tag>,
    },
    {
      title: 'Pupil L/R', key: 'pupils', width: 100, align: 'center',
      render: (_, r) => r.pupil_left ? `${r.pupil_left}/${r.pupil_right || '-'}` : '-',
    },
    { title: 'พยาบาล', dataIndex: 'nurse_name', key: 'nurse_name', width: 100 },
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
        <div className="bg-linear-to-r from-indigo-500 to-blue-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiBrainBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">แบบประเมินระดับความรู้สึกตัว (Glasgow Coma Scale)</h1>
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
            {latestRecord && (
              <div className={`rounded-lg px-4 py-1.5 text-center ${latestRecord.total_score <= 8 ? 'bg-red-500/30' : latestRecord.total_score <= 12 ? 'bg-orange-400/30' : 'bg-green-500/30'}`}>
                <div className="text-white/70 text-xs">ล่าสุด</div>
                <div className="text-white font-bold text-lg">E{latestRecord.eye_opening}V{latestRecord.verbal_response}M{latestRecord.motor_response} = {latestRecord.total_score}</div>
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
              title={<span className="text-indigo-600 font-bold text-sm">ประเมิน Glasgow Coma Scale</span>}>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' }}
                onValuesChange={recalcScore}
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

                {/* GCS Items */}
                {Object.entries(gcsItems).map(([key, item], idx) => {
                  const colors = ['indigo', 'blue', 'sky'];
                  const c = colors[idx];
                  return (
                    <div key={key} className={`bg-${c}-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-${c}-100`}>
                      <div className={`text-xs text-${c}-600 font-bold mb-2`}>{item.label}</div>
                      <Form.Item name={key} className="mb-1!">
                        <Radio.Group className="flex flex-col gap-1">
                          {item.options.map(opt => (
                            <Radio key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </Radio>
                          ))}
                        </Radio.Group>
                      </Form.Item>
                    </div>
                  );
                })}

                {/* Live Score */}
                <div className={`rounded-xl p-3 mb-3 text-center border ${liveCfg.bgColor}`}>
                  <div className="text-sm text-gray-500">GCS Score</div>
                  <div className={`text-3xl font-bold ${liveCfg.textColor}`}>
                    E{form.getFieldValue('eye_opening') || '?'}V{form.getFieldValue('verbal_response') || '?'}M{form.getFieldValue('motor_response') || '?'} = {liveScore}
                  </div>
                  <Tag color={liveCfg.color} className="m-0 mt-1 text-sm font-bold px-3 py-0.5">{liveCfg.label}</Tag>
                </div>

                {/* Pupil Assessment */}
                <div className="bg-gray-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-gray-200">
                  <div className="text-xs text-gray-600 font-bold mb-2">Pupil Assessment</div>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="Pupil ซ้าย" name="pupil_left">
                        <Select placeholder="ขนาด" allowClear>
                          {pupilSizes.map(s => <Option key={s} value={s}>{s}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Pupil ขวา" name="pupil_right">
                        <Select placeholder="ขนาด" allowClear>
                          {pupilSizes.map(s => <Option key={s} value={s}>{s}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="Reaction ซ้าย" name="pupil_reaction_left">
                        <Select placeholder="เลือก" allowClear>
                          {pupilReactions.map(r => <Option key={r.value} value={r.value}>{r.label}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Reaction ขวา" name="pupil_reaction_right">
                        <Select placeholder="เลือก" allowClear>
                          {pupilReactions.map(r => <Option key={r.value} value={r.value}>{r.label}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </div>

                <Form.Item label="หมายเหตุเพิ่มเติม" name="additional_notes">
                  <TextArea rows={2} placeholder="ระบุรายละเอียดเพิ่มเติม..." />
                </Form.Item>

                <Form.Item label="พยาบาลผู้ประเมิน" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                  className="bg-indigo-500 hover:bg-indigo-600 w-full shadow-md" size="middle">
                  บันทึกการประเมิน
                </Button>
              </Form>
            </Card>

            {/* Trend + Table - Right 3 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-indigo-500! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'trend',
                    label: <span className="flex items-center gap-1.5"><PiChartLineUpBold /> แนวโน้ม ({records.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {sortedRecords.length > 0 && (
                          <div className="bg-white border border-gray-100 rounded-xl p-4">
                            <div className="text-xs font-bold text-gray-500 mb-3">แนวโน้ม GCS Score</div>
                            <div className="flex items-end gap-1 h-32">
                              {[...sortedRecords].reverse().map((rec) => {
                                const heightPct = Math.max((rec.total_score / 15) * 100, 5);
                                const cfg = gcsLevelConfig[rec.level];
                                return (
                                  <div key={rec.id} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs font-bold" style={{ color: cfg.border }}>{rec.total_score}</span>
                                    <div className="w-full rounded-t-lg" style={{ height: `${heightPct}%`, backgroundColor: cfg.bg, border: `2px solid ${cfg.border}` }} />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{dayjs(rec.record_datetime).format('DD/MM')}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex gap-2 mt-3 justify-center flex-wrap">
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-red-200 border border-red-500" /> Deep Coma (3)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-orange-200 border border-orange-500" /> Severe (4-8)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-amber-200 border border-amber-500" /> Moderate (9-12)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-green-200 border border-green-500" /> Mild (13-15)</div>
                            </div>
                          </div>
                        )}

                        {sortedRecords.map(rec => {
                          const cfg = gcsLevelConfig[rec.level];
                          return (
                            <div key={rec.id} className="bg-white border-l-4 rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow"
                              style={{ borderLeftColor: cfg.border }}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Tag color={shiftColor[rec.shift || ''] || 'default'} className="m-0 text-xs">{rec.shift || '-'}</Tag>
                                  <span className="text-xs text-gray-400">{dayjs(rec.record_datetime).format('DD/MM/YYYY HH:mm')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold ${cfg.textColor}`}>
                                    E{rec.eye_opening}V{rec.verbal_response}M{rec.motor_response} = {rec.total_score}
                                  </span>
                                  <Tag color={cfg.color} className="m-0 font-bold">{cfg.label}</Tag>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-2">
                                <Tag color="indigo" className="m-0 text-xs">E: {rec.eye_opening} - {gcsItems.eye_opening.options.find(o => o.value === rec.eye_opening)?.label.split(' - ')[1]}</Tag>
                                <Tag color="blue" className="m-0 text-xs">V: {rec.verbal_response} - {gcsItems.verbal_response.options.find(o => o.value === rec.verbal_response)?.label.split(' - ')[1]}</Tag>
                                <Tag color="cyan" className="m-0 text-xs">M: {rec.motor_response} - {gcsItems.motor_response.options.find(o => o.value === rec.motor_response)?.label.split(' - ')[1]}</Tag>
                              </div>

                              {(rec.pupil_left || rec.pupil_right) && (
                                <div className="bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-600 mb-1">
                                  <span className="font-bold text-gray-500">Pupils:</span>{' '}
                                  L: {rec.pupil_left || '-'} ({rec.pupil_reaction_left || '-'}) | R: {rec.pupil_right || '-'} ({rec.pupil_reaction_right || '-'})
                                </div>
                              )}

                              {rec.additional_notes && (
                                <div className="bg-blue-50 rounded-lg px-3 py-1.5 text-xs text-blue-700">
                                  <span className="font-bold">หมายเหตุ:</span> {rec.additional_notes}
                                </div>
                              )}

                              <div className="mt-2 pt-2 border-t border-gray-50 flex justify-end">
                                <span className="text-xs text-gray-400">ประเมินโดย: <span className="font-semibold text-gray-600">{rec.nurse_name || '-'}</span></span>
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
                          pagination={{ pageSize: 10, size: 'small' }} scroll={{ x: 900 }} locale={{ emptyText: 'ยังไม่มีการประเมิน' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-indigo-50! [&_.ant-table-thead_.ant-table-cell]:text-indigo-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!" />
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
