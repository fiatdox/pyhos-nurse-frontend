'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs, Radio, Checkbox } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Input from 'antd/es/input';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave, VscTrash } from 'react-icons/vsc';
import { PiHeartbeatBold, PiListBulletsBold, PiChartLineUpBold } from 'react-icons/pi';

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

interface PainRecord {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  assessment_tool: string;
  pain_score: number;
  pain_level: string;
  location?: string;
  character?: string;
  onset?: string;
  duration?: string;
  aggravating?: string;
  alleviating?: string;
  intervention?: string;
  reassess_score?: number;
  reassess_time?: string;
  nurse_name?: string;
}

const painScaleColors: Record<string, { color: string; bg: string; border: string; text: string }> = {
  no_pain: { color: 'green', bg: '#86efac', border: '#16a34a', text: 'text-green-700' },
  mild: { color: 'gold', bg: '#fde68a', border: '#ca8a04', text: 'text-yellow-700' },
  moderate: { color: 'orange', bg: '#fdba74', border: '#ea580c', text: 'text-orange-700' },
  severe: { color: 'red', bg: '#fca5a5', border: '#dc2626', text: 'text-red-700' },
  worst: { color: 'volcano', bg: '#f87171', border: '#991b1b', text: 'text-red-900' },
};

const getPainLevel = (score: number): string => {
  if (score === 0) return 'no_pain';
  if (score <= 3) return 'mild';
  if (score <= 6) return 'moderate';
  if (score <= 9) return 'severe';
  return 'worst';
};

const painLevelLabel: Record<string, string> = {
  no_pain: 'ไม่ปวด (0)',
  mild: 'ปวดเล็กน้อย (1-3)',
  moderate: 'ปวดปานกลาง (4-6)',
  severe: 'ปวดมาก (7-9)',
  worst: 'ปวดมากที่สุด (10)',
};

const painCharacters = [
  'ปวดแหลม (Sharp)', 'ปวดตุบๆ (Throbbing)', 'ปวดแสบร้อน (Burning)',
  'ปวดบีบรัด (Cramping)', 'ปวดตื้อ (Dull/Aching)', 'ปวดเสียดแทง (Stabbing)',
  'ปวดจี๊ดๆ (Shooting)', 'ปวดหนักๆ (Pressure)', 'อื่นๆ',
];

const painLocations = [
  'ศีรษะ', 'หน้าอก', 'ท้อง', 'หลัง', 'แขนซ้าย', 'แขนขวา',
  'ขาซ้าย', 'ขาขวา', 'ข้อเข่า', 'สะโพก', 'แผลผ่าตัด', 'อื่นๆ',
];

const mockRecords: PainRecord[] = [
  {
    id: 1, an: '', record_datetime: dayjs().subtract(2, 'day').hour(10).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', assessment_tool: 'NRS', pain_score: 7, pain_level: 'severe',
    location: 'แผลผ่าตัด', character: 'ปวดแหลม (Sharp)', onset: 'หลังผ่าตัด',
    duration: 'ตลอดเวลา', intervention: 'ให้ยา Morphine 3 mg IV ตามแผนการรักษา',
    reassess_score: 3, reassess_time: '30 นาที', nurse_name: 'พย.สมหญิง',
  },
  {
    id: 2, an: '', record_datetime: dayjs().subtract(1, 'day').hour(14).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'บ่าย', assessment_tool: 'NRS', pain_score: 5, pain_level: 'moderate',
    location: 'แผลผ่าตัด', character: 'ปวดตื้อ (Dull/Aching)', onset: 'เมื่อเคลื่อนไหว',
    duration: 'ไม่ต่อเนื่อง', intervention: 'ให้ยา Paracetamol 500 mg oral + ประคบเย็น',
    reassess_score: 2, reassess_time: '1 ชม.', nurse_name: 'พย.วิภา',
  },
  {
    id: 3, an: '', record_datetime: dayjs().subtract(1, 'day').hour(22).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'ดึก', assessment_tool: 'NRS', pain_score: 3, pain_level: 'mild',
    location: 'แผลผ่าตัด', character: 'ปวดตื้อ (Dull/Aching)',
    intervention: 'จัดท่าให้สุขสบาย ทำสมาธิ relaxation', reassess_score: 1,
    nurse_name: 'พย.กนก',
  },
  {
    id: 4, an: '', record_datetime: dayjs().hour(8).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', assessment_tool: 'NRS', pain_score: 2, pain_level: 'mild',
    location: 'แผลผ่าตัด', character: 'ปวดตื้อ (Dull/Aching)',
    intervention: 'ให้ยา Paracetamol 500 mg oral ก่อนทำแผล', reassess_score: 0,
    nurse_name: 'พย.สมหญิง',
  },
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

export default function PainAssessment({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<PainRecord[]>(mockRecords);
  const [rightTab, setRightTab] = useState('trend');
  const [liveScore, setLiveScore] = useState(0);

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/pain/${an}`, { headers });
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
    const painLevel = getPainLevel(values.pain_score || 0);

    try {
      const headers = getHeaders();
      const payload = {
        an, admission_list_id: patient?.admission_list_id,
        ward_code: patient?.ward || getUserProfile()?.ward_code || '',
        ward_name: patient?.wardName || getUserProfile()?.ward_name || '',
        staff_id: getUserProfile()?.staff_id || '',
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        shift: values.shift || null,
        assessment_tool: values.assessment_tool || 'NRS',
        pain_score: values.pain_score ?? 0,
        pain_level: painLevel,
        location: values.location || null,
        character: values.character || null,
        onset: values.onset || null,
        duration: values.duration || null,
        aggravating: values.aggravating || null,
        alleviating: values.alleviating || null,
        intervention: values.intervention || null,
        reassess_score: values.reassess_score ?? null,
        reassess_time: values.reassess_time || null,
        nurse_name: values.nurse_name || null,
      };
      await axios.post('/api/v1/nursing-records/pain', payload, { headers });
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกการประเมินสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      form.resetFields();
      form.setFieldsValue({ record_datetime: dayjs(), assessment_tool: 'NRS', pain_score: 0, nurse_name: getUserProfile()?.fullname || '' });
      setLiveScore(0);
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
      await axios.delete(`/api/v1/nursing-records/pain/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchRecords();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const livePainLevel = getPainLevel(liveScore);
  const livePainCfg = painScaleColors[livePainLevel];

  const sortedRecords = [...records].sort((a, b) => dayjs(b.record_datetime).unix() - dayjs(a.record_datetime).unix());
  const latestRecord = sortedRecords[0];

  const columns: ColumnsType<PainRecord> = [
    { title: 'วันที่/เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 120, render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-' },
    { title: 'เวร', dataIndex: 'shift', key: 'shift', width: 60, align: 'center', render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0 text-xs">{v}</Tag> : '-' },
    { title: 'เครื่องมือ', dataIndex: 'assessment_tool', key: 'assessment_tool', width: 70, align: 'center' },
    {
      title: 'คะแนน', dataIndex: 'pain_score', key: 'pain_score', width: 70, align: 'center',
      render: (v) => {
        const level = getPainLevel(v);
        return <Tag color={painScaleColors[level]?.color} className="m-0 font-bold text-lg">{v}</Tag>;
      },
    },
    { title: 'ตำแหน่ง', dataIndex: 'location', key: 'location', width: 100 },
    { title: 'ลักษณะ', dataIndex: 'character', key: 'character', width: 120, ellipsis: true },
    { title: 'การจัดการ', dataIndex: 'intervention', key: 'intervention', width: 150, ellipsis: true },
    {
      title: 'Reassess', dataIndex: 'reassess_score', key: 'reassess_score', width: 80, align: 'center',
      render: (v, r) => v !== null && v !== undefined ? <span className="font-bold">{v} <span className="text-gray-400 text-xs">({r.reassess_time || '-'})</span></span> : '-',
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
        <div className="bg-linear-to-r from-rose-500 to-red-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiHeartbeatBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">แบบประเมินความปวด (Pain Assessment)</h1>
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
              <div className={`rounded-lg px-4 py-1.5 text-center ${latestRecord.pain_score >= 7 ? 'bg-red-500/30' : latestRecord.pain_score >= 4 ? 'bg-orange-400/30' : 'bg-green-500/30'}`}>
                <div className="text-white/70 text-xs">ล่าสุด</div>
                <div className="text-white font-bold text-lg">{latestRecord.pain_score}/10</div>
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
              title={<span className="text-rose-600 font-bold text-sm">ประเมินความปวด</span>}>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ record_datetime: dayjs(), assessment_tool: 'NRS', pain_score: 0, nurse_name: getUserProfile()?.fullname || '' }}
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

                <Form.Item label="เครื่องมือประเมิน" name="assessment_tool" rules={[{ required: true }]}>
                  <Select>
                    <Option value="NRS">Numeric Rating Scale (NRS 0-10)</Option>
                    <Option value="VAS">Visual Analog Scale (VAS)</Option>
                    <Option value="Wong-Baker">Wong-Baker FACES</Option>
                    <Option value="FLACC">FLACC (เด็กเล็ก)</Option>
                    <Option value="BPS">BPS (ผู้ป่วยใส่ท่อช่วยหายใจ)</Option>
                  </Select>
                </Form.Item>

                {/* Pain Score Visual Selector */}
                <div className="bg-rose-50 rounded-lg px-3 pt-2 pb-2 mb-2 border border-rose-100">
                  <div className="text-xs text-rose-600 font-bold mb-2">ระดับความปวด (Pain Score)</div>
                  <Form.Item name="pain_score" className="mb-0!">
                    <Radio.Group className="flex flex-wrap gap-1 justify-center" onChange={(e) => setLiveScore(e.target.value)}>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => {
                        const level = getPainLevel(score);
                        const cfg = painScaleColors[level];
                        return (
                          <Radio.Button key={score} value={score}
                            className="w-10 h-10 flex items-center justify-center font-bold text-sm"
                            style={{ borderColor: liveScore === score ? cfg.border : undefined, color: liveScore === score ? cfg.border : undefined }}>
                            {score}
                          </Radio.Button>
                        );
                      })}
                    </Radio.Group>
                  </Form.Item>
                  <div className={`text-center mt-2 font-bold text-sm ${livePainCfg.text}`}>
                    {painLevelLabel[livePainLevel]}
                  </div>
                </div>

                <Form.Item label="ตำแหน่งที่ปวด" name="location">
                  <Select placeholder="เลือกตำแหน่ง" allowClear>
                    {painLocations.map(loc => <Option key={loc} value={loc}>{loc}</Option>)}
                  </Select>
                </Form.Item>

                <Form.Item label="ลักษณะความปวด" name="character">
                  <Select placeholder="เลือกลักษณะ" allowClear>
                    {painCharacters.map(ch => <Option key={ch} value={ch}>{ch}</Option>)}
                  </Select>
                </Form.Item>

                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item label="เวลาเริ่มปวด" name="onset">
                      <Input placeholder="เช่น หลังผ่าตัด" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="ระยะเวลา" name="duration">
                      <Input placeholder="เช่น ตลอดเวลา" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="สิ่งที่ทำให้ปวดมากขึ้น" name="aggravating">
                  <Input placeholder="เช่น เคลื่อนไหว ไอ" />
                </Form.Item>

                <Form.Item label="สิ่งที่ทำให้ปวดน้อยลง" name="alleviating">
                  <Input placeholder="เช่น พัก นอนนิ่ง" />
                </Form.Item>

                {/* Intervention section */}
                <div className="bg-blue-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-blue-100">
                  <div className="text-xs text-blue-600 font-bold mb-2">การจัดการความปวด</div>
                  <Form.Item label="การจัดการ/การพยาบาล" name="intervention">
                    <TextArea rows={2} placeholder="เช่น ให้ยาแก้ปวด จัดท่า ประคบเย็น" />
                  </Form.Item>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="คะแนนหลัง Reassess" name="reassess_score">
                        <Select placeholder="คะแนน" allowClear>
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => <Option key={s} value={s}>{s}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Reassess เวลา" name="reassess_time">
                        <Input placeholder="เช่น 30 นาที" />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>

                <Form.Item label="พยาบาลผู้ประเมิน" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                  className="bg-rose-500 hover:bg-rose-600 w-full shadow-md" size="middle">
                  บันทึกการประเมิน
                </Button>
              </Form>
            </Card>

            {/* Trend + Table - Right 3 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-rose-500! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'trend',
                    label: <span className="flex items-center gap-1.5"><PiChartLineUpBold /> แนวโน้ม ({records.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {sortedRecords.length > 0 && (
                          <div className="bg-white border border-gray-100 rounded-xl p-4">
                            <div className="text-xs font-bold text-gray-500 mb-3">แนวโน้ม Pain Score</div>
                            <div className="flex items-end gap-1 h-32">
                              {[...sortedRecords].reverse().map((rec) => {
                                const heightPct = Math.max((rec.pain_score / 10) * 100, 5);
                                const level = getPainLevel(rec.pain_score);
                                const cfg = painScaleColors[level];
                                return (
                                  <div key={rec.id} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs font-bold" style={{ color: cfg.border }}>{rec.pain_score}</span>
                                    <div className="w-full rounded-t-lg" style={{ height: `${heightPct}%`, backgroundColor: cfg.bg, border: `2px solid ${cfg.border}` }} />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{dayjs(rec.record_datetime).format('DD/MM')}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex gap-2 mt-3 justify-center flex-wrap">
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-green-200 border border-green-500" /> ไม่ปวด (0)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-yellow-200 border border-yellow-500" /> เล็กน้อย (1-3)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-orange-200 border border-orange-500" /> ปานกลาง (4-6)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-red-200 border border-red-500" /> มาก-มากที่สุด (7-10)</div>
                            </div>
                          </div>
                        )}

                        {sortedRecords.map(rec => {
                          const level = getPainLevel(rec.pain_score);
                          const cfg = painScaleColors[level];
                          return (
                            <div key={rec.id} className="bg-white border-l-4 rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow"
                              style={{ borderLeftColor: cfg.border }}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Tag color={shiftColor[rec.shift || ''] || 'default'} className="m-0 text-xs">{rec.shift || '-'}</Tag>
                                  <span className="text-xs text-gray-400">{dayjs(rec.record_datetime).format('DD/MM/YYYY HH:mm')}</span>
                                  <Tag className="m-0 text-xs">{rec.assessment_tool}</Tag>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-3xl font-bold ${cfg.text}`}>{rec.pain_score}</span>
                                  <span className="text-gray-400">/10</span>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-2">
                                {rec.location && <Tag color="blue" className="m-0 text-xs">{rec.location}</Tag>}
                                {rec.character && <Tag color="purple" className="m-0 text-xs">{rec.character}</Tag>}
                                {rec.onset && <Tag className="m-0 text-xs">เริ่ม: {rec.onset}</Tag>}
                              </div>

                              {rec.intervention && (
                                <div className="bg-blue-50 rounded-lg px-3 py-1.5 text-xs text-blue-700 mb-1">
                                  <span className="font-bold">การจัดการ:</span> {rec.intervention}
                                </div>
                              )}

                              {rec.reassess_score !== null && rec.reassess_score !== undefined && (
                                <div className="bg-green-50 rounded-lg px-3 py-1.5 text-xs text-green-700">
                                  <span className="font-bold">Reassess:</span> {rec.reassess_score}/10 {rec.reassess_time ? `(${rec.reassess_time})` : ''}
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
                          pagination={{ pageSize: 10, size: 'small' }} scroll={{ x: 1100 }} locale={{ emptyText: 'ยังไม่มีการประเมิน' }}
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
