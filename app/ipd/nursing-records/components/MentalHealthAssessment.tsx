'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Input from 'antd/es/input';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { VscSave, VscTrash } from 'react-icons/vsc';
import { PiSmileySadBold, PiListBulletsBold, PiChartLineUpBold } from 'react-icons/pi';

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

interface MentalHealthRecord {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  assessment_tool: string;
  // ST-5 (Suicidal Tendency 5 questions) or 2Q/9Q
  q1_score: number;
  q2_score: number;
  q3_score: number;
  q4_score: number;
  q5_score: number;
  q6_score?: number;
  q7_score?: number;
  q8_score?: number;
  q9_score?: number;
  total_score: number;
  risk_level: string;
  mood?: string;
  sleep_pattern?: string;
  appetite?: string;
  social_interaction?: string;
  interventions?: string;
  referral?: string;
  nurse_name?: string;
}

// ST-5 Suicidal Tendency screening
const st5Questions = [
  { key: 'q1_score', label: '1. ในช่วง 2 สัปดาห์ที่ผ่านมา รวมทั้งวันนี้ มีปัญหานอนไม่หลับ/นอนหลับยาก', options: [{ value: 0, label: 'ไม่มี' }, { value: 1, label: 'มี' }] },
  { key: 'q2_score', label: '2. ในช่วง 2 สัปดาห์ที่ผ่านมา รวมทั้งวันนี้ มีความรู้สึกหดหู่ เศร้า หรือท้อแท้สิ้นหวัง', options: [{ value: 0, label: 'ไม่มี' }, { value: 1, label: 'มี' }] },
  { key: 'q3_score', label: '3. ในช่วง 2 สัปดาห์ที่ผ่านมา รวมทั้งวันนี้ มีความรู้สึกเบื่อหน่าย ไม่สนุก กับสิ่งที่เคยชอบทำ', options: [{ value: 0, label: 'ไม่มี' }, { value: 1, label: 'มี' }] },
  { key: 'q4_score', label: '4. ในช่วง 2 สัปดาห์ที่ผ่านมา รวมทั้งวันนี้ มีความคิดว่าตนเองไร้ค่า เป็นภาระ', options: [{ value: 0, label: 'ไม่มี' }, { value: 1, label: 'มี' }] },
  { key: 'q5_score', label: '5. ในช่วง 1 เดือนที่ผ่านมา มีความคิดอยากทำร้ายตนเอง หรือคิดอยากตาย', options: [{ value: 0, label: 'ไม่มี' }, { value: 1, label: 'มี' }] },
];

// 2Q Depression screening
const twoQQuestions = [
  { key: 'q1_score', label: '1. ใน 2 สัปดาห์ที่ผ่านมา รวมวันนี้ คุณรู้สึกหดหู่ เศร้า หรือท้อแท้สิ้นหวังหรือไม่', options: [{ value: 0, label: 'ไม่มี' }, { value: 1, label: 'มี' }] },
  { key: 'q2_score', label: '2. ใน 2 สัปดาห์ที่ผ่านมา รวมวันนี้ คุณรู้สึกเบื่อ ทำอะไรก็ไม่เพลิดเพลินหรือไม่', options: [{ value: 0, label: 'ไม่มี' }, { value: 1, label: 'มี' }] },
];

// 9Q PHQ-9
const nineQQuestions = [
  { key: 'q1_score', label: '1. เบื่อ ไม่สนใจอยากทำอะไร' },
  { key: 'q2_score', label: '2. ไม่สบายใจ ซึมเศร้า ท้อแท้' },
  { key: 'q3_score', label: '3. หลับยาก/หลับๆ ตื่นๆ หรือหลับมากไป' },
  { key: 'q4_score', label: '4. เหนื่อยง่าย หรือไม่ค่อยมีแรง' },
  { key: 'q5_score', label: '5. เบื่ออาหาร หรือกินมากเกินไป' },
  { key: 'q6_score', label: '6. รู้สึกไม่ดีกับตัวเอง คิดว่าล้มเหลว' },
  { key: 'q7_score', label: '7. สมาธิไม่ดี เวลาทำอะไร' },
  { key: 'q8_score', label: '8. พูดช้า ทำอะไรช้าลง หรือกระสับกระส่าย' },
  { key: 'q9_score', label: '9. คิดทำร้ายตนเอง หรืออยากตาย' },
];

const nineQOptions = [
  { value: 0, label: 'ไม่เลย' },
  { value: 1, label: 'เป็นบางวัน (1-7 วัน)' },
  { value: 2, label: 'เป็นบ่อย (>7 วัน)' },
  { value: 3, label: 'เป็นทุกวัน' },
];

const getSTRiskLevel = (score: number, tool: string): string => {
  if (tool === 'ST-5') {
    if (score === 0) return 'no_risk';
    if (score <= 2) return 'low';
    if (score <= 4) return 'moderate';
    return 'high';
  }
  if (tool === '2Q') {
    return score >= 1 ? 'positive' : 'negative';
  }
  // 9Q (PHQ-9)
  if (score <= 6) return 'no_depression';
  if (score <= 12) return 'mild';
  if (score <= 18) return 'moderate';
  return 'severe';
};

const riskConfig: Record<string, { label: string; color: string; bgColor: string; textColor: string; border: string; bg: string }> = {
  no_risk: { label: 'ไม่มีความเสี่ยง', color: 'green', bgColor: 'bg-green-50 border-green-200', textColor: 'text-green-700', border: '#16a34a', bg: '#86efac' },
  low: { label: 'ความเสี่ยงต่ำ', color: 'gold', bgColor: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-700', border: '#ca8a04', bg: '#fde68a' },
  moderate: { label: 'ความเสี่ยงปานกลาง', color: 'orange', bgColor: 'bg-orange-50 border-orange-200', textColor: 'text-orange-700', border: '#ea580c', bg: '#fdba74' },
  high: { label: 'ความเสี่ยงสูง', color: 'red', bgColor: 'bg-red-50 border-red-200', textColor: 'text-red-700', border: '#dc2626', bg: '#fca5a5' },
  negative: { label: 'ผลลบ (Negative)', color: 'green', bgColor: 'bg-green-50 border-green-200', textColor: 'text-green-700', border: '#16a34a', bg: '#86efac' },
  positive: { label: 'ผลบวก (Positive)', color: 'red', bgColor: 'bg-red-50 border-red-200', textColor: 'text-red-700', border: '#dc2626', bg: '#fca5a5' },
  no_depression: { label: 'ไม่มีอาการ (0-6)', color: 'green', bgColor: 'bg-green-50 border-green-200', textColor: 'text-green-700', border: '#16a34a', bg: '#86efac' },
  mild: { label: 'เล็กน้อย (7-12)', color: 'gold', bgColor: 'bg-yellow-50 border-yellow-200', textColor: 'text-yellow-700', border: '#ca8a04', bg: '#fde68a' },
  severe: { label: 'รุนแรง (19-27)', color: 'red', bgColor: 'bg-red-50 border-red-200', textColor: 'text-red-700', border: '#dc2626', bg: '#fca5a5' },
};

const moodOptions = ['สงบ ปกติ', 'วิตกกังวล', 'เศร้า หดหู่', 'โกรธ หงุดหงิด', 'กลัว', 'สับสน', 'เฉยเมย ไม่สนใจ', 'อื่นๆ'];

const mockRecords: MentalHealthRecord[] = [
  {
    id: 1, an: '', record_datetime: dayjs().subtract(2, 'day').hour(10).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', assessment_tool: 'ST-5',
    q1_score: 1, q2_score: 1, q3_score: 1, q4_score: 0, q5_score: 0,
    total_score: 3, risk_level: 'moderate',
    mood: 'เศร้า หดหู่', sleep_pattern: 'นอนไม่หลับ ตื่นกลางดึกบ่อย',
    appetite: 'เบื่ออาหาร รับประทานได้น้อย',
    interventions: 'รับฟัง ให้กำลังใจ ประเมินซ้ำ เฝ้าระวังใกล้ชิด',
    nurse_name: 'พย.สมหญิง',
  },
  {
    id: 2, an: '', record_datetime: dayjs().subtract(1, 'day').hour(10).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', assessment_tool: 'ST-5',
    q1_score: 1, q2_score: 1, q3_score: 0, q4_score: 0, q5_score: 0,
    total_score: 2, risk_level: 'low',
    mood: 'วิตกกังวล', sleep_pattern: 'หลับได้บ้าง 4-5 ชม.',
    appetite: 'รับประทานได้ดีขึ้น',
    interventions: 'คุยเรื่องแผนการรักษา ลดความวิตกกังวล ญาติมาเยี่ยม',
    nurse_name: 'พย.วิภา',
  },
  {
    id: 3, an: '', record_datetime: dayjs().hour(9).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', assessment_tool: 'ST-5',
    q1_score: 0, q2_score: 0, q3_score: 0, q4_score: 0, q5_score: 0,
    total_score: 0, risk_level: 'no_risk',
    mood: 'สงบ ปกติ', sleep_pattern: 'หลับได้ดี 6-7 ชม.',
    appetite: 'รับประทานได้ปกติ', social_interaction: 'คุยกับเพื่อนร่วมห้อง ยิ้มแย้ม',
    interventions: 'ชมเชยให้กำลังใจ สอนวิธีจัดการความเครียด',
    nurse_name: 'พย.สมหญิง',
  },
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

export default function MentalHealthAssessment({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<MentalHealthRecord[]>(mockRecords);
  const [rightTab, setRightTab] = useState('trend');
  const [liveScore, setLiveScore] = useState(0);
  const [selectedTool, setSelectedTool] = useState('ST-5');

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/mental-health/${an}`, { headers });
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

  const recalcScore = () => {
    const values = form.getFieldsValue();
    let score = 0;
    const keys = selectedTool === '9Q' ? ['q1_score', 'q2_score', 'q3_score', 'q4_score', 'q5_score', 'q6_score', 'q7_score', 'q8_score', 'q9_score'] :
      selectedTool === '2Q' ? ['q1_score', 'q2_score'] :
        ['q1_score', 'q2_score', 'q3_score', 'q4_score', 'q5_score'];
    keys.forEach(k => { score += (values[k] || 0); });
    setLiveScore(score);
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    const keys = selectedTool === '9Q' ? ['q1_score', 'q2_score', 'q3_score', 'q4_score', 'q5_score', 'q6_score', 'q7_score', 'q8_score', 'q9_score'] :
      selectedTool === '2Q' ? ['q1_score', 'q2_score'] :
        ['q1_score', 'q2_score', 'q3_score', 'q4_score', 'q5_score'];
    let totalScore = 0;
    keys.forEach(k => { totalScore += (values[k] || 0); });
    const riskLevel = getSTRiskLevel(totalScore, selectedTool);

    try {
      const headers = getHeaders();
      const payload = {
        an, admission_list_id: patient?.admission_list_id,
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        shift: values.shift || null,
        assessment_tool: selectedTool,
        q1_score: values.q1_score || 0,
        q2_score: values.q2_score || 0,
        q3_score: values.q3_score || 0,
        q4_score: values.q4_score || 0,
        q5_score: values.q5_score || 0,
        q6_score: values.q6_score || 0,
        q7_score: values.q7_score || 0,
        q8_score: values.q8_score || 0,
        q9_score: values.q9_score || 0,
        total_score: totalScore,
        risk_level: riskLevel,
        mood: values.mood || null,
        sleep_pattern: values.sleep_pattern || null,
        appetite: values.appetite || null,
        social_interaction: values.social_interaction || null,
        interventions: values.interventions || null,
        referral: values.referral || null,
        nurse_name: values.nurse_name || null,
      };
      await axios.post('/api/v1/nursing-records/mental-health', payload, { headers });
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกการประเมินสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      form.resetFields();
      form.setFieldsValue({ record_datetime: dayjs(), assessment_tool: selectedTool });
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
      await axios.delete(`/api/v1/nursing-records/mental-health/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchRecords();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const liveLevel = getSTRiskLevel(liveScore, selectedTool);
  const liveCfg = riskConfig[liveLevel] || riskConfig['no_risk'];

  const sortedRecords = [...records].sort((a, b) => dayjs(b.record_datetime).unix() - dayjs(a.record_datetime).unix());
  const latestRecord = sortedRecords[0];

  const getQuestions = () => {
    if (selectedTool === 'ST-5') return st5Questions;
    if (selectedTool === '2Q') return twoQQuestions;
    return nineQQuestions;
  };

  const columns: ColumnsType<MentalHealthRecord> = [
    { title: 'วันที่/เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 120, render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-' },
    { title: 'เวร', dataIndex: 'shift', key: 'shift', width: 60, align: 'center', render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0 text-xs">{v}</Tag> : '-' },
    { title: 'เครื่องมือ', dataIndex: 'assessment_tool', key: 'assessment_tool', width: 70, align: 'center' },
    {
      title: 'คะแนน', dataIndex: 'total_score', key: 'total_score', width: 70, align: 'center',
      render: (v) => <span className="font-bold text-lg">{v}</span>,
    },
    {
      title: 'ระดับ', dataIndex: 'risk_level', key: 'risk_level', width: 130, align: 'center',
      render: (v) => <Tag color={riskConfig[v]?.color || 'default'} className="m-0 font-bold text-xs">{riskConfig[v]?.label || v}</Tag>,
    },
    { title: 'อารมณ์', dataIndex: 'mood', key: 'mood', width: 100 },
    { title: 'การจัดการ', dataIndex: 'interventions', key: 'interventions', width: 180, ellipsis: true },
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

  const patientName = patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-violet-500 to-purple-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiSmileySadBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">แบบประเมินสุขภาพจิต/ความวิตกกังวล</h1>
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
              <div className={`rounded-lg px-4 py-1.5 text-center ${latestRecord.risk_level === 'high' || latestRecord.risk_level === 'severe' || latestRecord.risk_level === 'positive' ? 'bg-red-500/30' : latestRecord.risk_level === 'moderate' ? 'bg-orange-400/30' : 'bg-green-500/30'}`}>
                <div className="text-white/70 text-xs">ล่าสุด ({latestRecord.assessment_tool})</div>
                <div className="text-white font-bold text-lg">{latestRecord.total_score} คะแนน</div>
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
              title={<span className="text-violet-600 font-bold text-sm">ประเมินสุขภาพจิต</span>}>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ record_datetime: dayjs(), assessment_tool: 'ST-5' }}
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

                <Form.Item label="เครื่องมือประเมิน" name="assessment_tool">
                  <Select onChange={(v) => { setSelectedTool(v); setLiveScore(0); form.resetFields(['q1_score', 'q2_score', 'q3_score', 'q4_score', 'q5_score', 'q6_score', 'q7_score', 'q8_score', 'q9_score']); }}>
                    <Option value="ST-5">ST-5 (Suicidal Tendency)</Option>
                    <Option value="2Q">2Q Depression Screening</Option>
                    <Option value="9Q">9Q (PHQ-9) Depression</Option>
                  </Select>
                </Form.Item>

                {/* Questions */}
                <div className="bg-violet-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-violet-100">
                  <div className="text-xs text-violet-600 font-bold mb-2">{selectedTool}</div>
                  {selectedTool === '9Q' ? (
                    nineQQuestions.map(q => (
                      <Form.Item key={q.key} label={q.label} name={q.key} className="mb-2!">
                        <Radio.Group className="flex flex-col gap-0.5">
                          {nineQOptions.map(opt => (
                            <Radio key={opt.value} value={opt.value} className="text-xs">{opt.label} ({opt.value})</Radio>
                          ))}
                        </Radio.Group>
                      </Form.Item>
                    ))
                  ) : (
                    getQuestions().map(q => (
                      <Form.Item key={q.key} label={q.label} name={q.key} className="mb-2!">
                        <Radio.Group className="flex gap-4">
                          {q.options!.map(opt => (
                            <Radio key={opt.value} value={opt.value} className="text-xs">{opt.label}</Radio>
                          ))}
                        </Radio.Group>
                      </Form.Item>
                    ))
                  )}
                </div>

                {/* Live Score */}
                <div className={`rounded-xl p-3 mb-3 text-center border ${liveCfg.bgColor}`}>
                  <div className="text-sm text-gray-500">คะแนนรวม ({selectedTool})</div>
                  <div className={`text-3xl font-bold ${liveCfg.textColor}`}>{liveScore}</div>
                  <Tag color={liveCfg.color} className="m-0 mt-1 text-sm font-bold px-3 py-0.5">{liveCfg.label}</Tag>
                </div>

                {/* Additional assessment */}
                <div className="bg-blue-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-blue-100">
                  <div className="text-xs text-blue-600 font-bold mb-2">ข้อมูลเพิ่มเติม</div>
                  <Form.Item label="อารมณ์ (Mood)" name="mood">
                    <Select placeholder="เลือก" allowClear>
                      {moodOptions.map(m => <Option key={m} value={m}>{m}</Option>)}
                    </Select>
                  </Form.Item>
                  <Form.Item label="การนอนหลับ" name="sleep_pattern">
                    <Input placeholder="เช่น นอนหลับได้ 6-7 ชม." />
                  </Form.Item>
                  <Form.Item label="ความอยากอาหาร" name="appetite">
                    <Input placeholder="เช่น รับประทานได้ปกติ" />
                  </Form.Item>
                  <Form.Item label="ปฏิสัมพันธ์สังคม" name="social_interaction">
                    <Input placeholder="เช่น คุยกับญาติ เข้ากลุ่มได้" />
                  </Form.Item>
                </div>

                <Form.Item label="การจัดการ/การพยาบาล" name="interventions">
                  <TextArea rows={2} placeholder="เช่น รับฟัง ให้กำลังใจ ส่งต่อจิตแพทย์" />
                </Form.Item>

                <Form.Item label="การส่งต่อ (Referral)" name="referral">
                  <Input placeholder="เช่น ส่งต่อจิตแพทย์ นักจิตวิทยา" />
                </Form.Item>

                <Form.Item label="พยาบาลผู้ประเมิน" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                  className="bg-violet-500 hover:bg-violet-600 w-full shadow-md" size="middle">
                  บันทึกการประเมิน
                </Button>
              </Form>
            </Card>

            {/* Trend + Table - Right 3 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-violet-500! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'trend',
                    label: <span className="flex items-center gap-1.5"><PiChartLineUpBold /> แนวโน้ม ({records.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {sortedRecords.length > 0 && (
                          <div className="bg-white border border-gray-100 rounded-xl p-4">
                            <div className="text-xs font-bold text-gray-500 mb-3">แนวโน้มคะแนน</div>
                            <div className="flex items-end gap-1 h-32">
                              {[...sortedRecords].reverse().map((rec) => {
                                const maxScore = rec.assessment_tool === '9Q' ? 27 : rec.assessment_tool === '2Q' ? 2 : 5;
                                const heightPct = Math.max((rec.total_score / maxScore) * 100, 5);
                                const cfg = riskConfig[rec.risk_level] || riskConfig['no_risk'];
                                return (
                                  <div key={rec.id} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs font-bold" style={{ color: cfg.border }}>{rec.total_score}</span>
                                    <div className="w-full rounded-t-lg" style={{ height: `${heightPct}%`, backgroundColor: cfg.bg, border: `2px solid ${cfg.border}` }} />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{dayjs(rec.record_datetime).format('DD/MM')}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {sortedRecords.map(rec => {
                          const cfg = riskConfig[rec.risk_level] || riskConfig['no_risk'];
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
                                  <span className={`text-2xl font-bold ${cfg.textColor}`}>{rec.total_score}</span>
                                  <Tag color={cfg.color} className="m-0 font-bold">{cfg.label}</Tag>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-2">
                                {rec.mood && <Tag color="purple" className="m-0 text-xs">อารมณ์: {rec.mood}</Tag>}
                                {rec.sleep_pattern && <Tag className="m-0 text-xs">นอน: {rec.sleep_pattern}</Tag>}
                                {rec.appetite && <Tag className="m-0 text-xs">อาหาร: {rec.appetite}</Tag>}
                              </div>

                              {rec.interventions && (
                                <div className="bg-blue-50 rounded-lg px-3 py-1.5 text-xs text-blue-700 mb-1">
                                  <span className="font-bold">การจัดการ:</span> {rec.interventions}
                                </div>
                              )}

                              {rec.referral && (
                                <div className="bg-amber-50 rounded-lg px-3 py-1.5 text-xs text-amber-700">
                                  <span className="font-bold">ส่งต่อ:</span> {rec.referral}
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
                          pagination={{ pageSize: 10, size: 'small' }} scroll={{ x: 1000 }} locale={{ emptyText: 'ยังไม่มีการประเมิน' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-violet-50! [&_.ant-table-thead_.ant-table-cell]:text-violet-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!" />
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
