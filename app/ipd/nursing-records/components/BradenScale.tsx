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
import { PiShieldWarningBold, PiListBulletsBold, PiChartLineUpBold } from 'react-icons/pi';

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

interface BradenRecord {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  sensory_perception: number;
  moisture: number;
  activity: number;
  mobility: number;
  nutrition: number;
  friction_shear: number;
  total_score: number;
  risk_level: string;
  interventions?: string;
  nurse_name?: string;
}

const bradenItems = {
  sensory_perception: {
    label: '1. การรับรู้ความรู้สึก (Sensory Perception)',
    options: [
      { value: 1, label: '1 - จำกัดมาก: ไม่ตอบสนองต่อความเจ็บปวด' },
      { value: 2, label: '2 - จำกัดมาก: ตอบสนองต่อความเจ็บปวดเท่านั้น' },
      { value: 3, label: '3 - จำกัดเล็กน้อย: ตอบสนองต่อคำพูดแต่ไม่สามารถสื่อสารได้เสมอ' },
      { value: 4, label: '4 - ไม่จำกัด: ตอบสนองต่อคำพูดได้ดี' },
    ],
  },
  moisture: {
    label: '2. ความชื้น (Moisture)',
    options: [
      { value: 1, label: '1 - ชื้นตลอดเวลา: ผิวหนังเปียกชื้นตลอด' },
      { value: 2, label: '2 - ชื้นมาก: ต้องเปลี่ยนผ้าปูทุก 8 ชม.' },
      { value: 3, label: '3 - ชื้นบางครั้ง: ต้องเปลี่ยนผ้าปูทุก 12 ชม.' },
      { value: 4, label: '4 - ไม่ค่อยชื้น: ผิวหนังแห้ง เปลี่ยนตามปกติ' },
    ],
  },
  activity: {
    label: '3. กิจกรรม (Activity)',
    options: [
      { value: 1, label: '1 - นอนอยู่บนเตียงตลอดเวลา (Bedfast)' },
      { value: 2, label: '2 - นั่งบนเก้าอี้ (Chairfast)' },
      { value: 3, label: '3 - เดินได้บางครั้ง (Walks Occasionally)' },
      { value: 4, label: '4 - เดินได้บ่อย (Walks Frequently)' },
    ],
  },
  mobility: {
    label: '4. การเคลื่อนไหว (Mobility)',
    options: [
      { value: 1, label: '1 - ไม่เคลื่อนไหวเลย (Completely Immobile)' },
      { value: 2, label: '2 - จำกัดมาก (Very Limited)' },
      { value: 3, label: '3 - จำกัดเล็กน้อย (Slightly Limited)' },
      { value: 4, label: '4 - ไม่จำกัด (No Limitations)' },
    ],
  },
  nutrition: {
    label: '5. โภชนาการ (Nutrition)',
    options: [
      { value: 1, label: '1 - แย่มาก: รับประทานได้น้อยกว่า 1/3 ของอาหาร' },
      { value: 2, label: '2 - ไม่เพียงพอ: รับประทานได้น้อยกว่า 1/2' },
      { value: 3, label: '3 - เพียงพอ: รับประทานได้มากกว่า 1/2' },
      { value: 4, label: '4 - ดีมาก: รับประทานได้ทุกมื้อ' },
    ],
  },
  friction_shear: {
    label: '6. แรงเสียดทาน (Friction & Shear)',
    options: [
      { value: 1, label: '1 - มีปัญหา: ต้องช่วยเหลือมาก เลื่อนตัวบ่อย' },
      { value: 2, label: '2 - มีปัญหาเล็กน้อย: เคลื่อนตัวได้บ้าง ต้องช่วยบ้าง' },
      { value: 3, label: '3 - ไม่มีปัญหา: เคลื่อนตัวได้เอง' },
    ],
  },
};

const getRiskLevel = (score: number): string => {
  if (score <= 9) return 'very_high';
  if (score <= 12) return 'high';
  if (score <= 14) return 'moderate';
  if (score <= 18) return 'mild';
  return 'no_risk';
};

const riskConfig: Record<string, { label: string; color: string; bgColor: string; textColor: string; interventions: string }> = {
  very_high: {
    label: 'Very High Risk (≤9)',
    color: 'red',
    bgColor: 'bg-red-50 border-red-200',
    textColor: 'text-red-700',
    interventions: '• พลิกตัวทุก 1-2 ชม.\n• ใช้ที่นอนลม/ที่นอนลดแรงกด\n• ดูแลผิวหนังให้สะอาดแห้ง\n• ประเมินโภชนาการและเสริมอาหาร\n• ปรึกษา Wound Care Nurse\n• ประเมินซ้ำทุกเวร',
  },
  high: {
    label: 'High Risk (10-12)',
    color: 'volcano',
    bgColor: 'bg-orange-50 border-orange-200',
    textColor: 'text-orange-700',
    interventions: '• พลิกตัวทุก 2 ชม.\n• ใช้ที่นอนลดแรงกด\n• ทาครีมบำรุงผิวหนัง\n• ดูแลโภชนาการ\n• ประเมินซ้ำทุกเวร',
  },
  moderate: {
    label: 'Moderate Risk (13-14)',
    color: 'orange',
    bgColor: 'bg-amber-50 border-amber-200',
    textColor: 'text-amber-700',
    interventions: '• พลิกตัวทุก 2-3 ชม.\n• ใช้หมอนรองจุดกดทับ\n• ดูแลผิวหนังให้ชุ่มชื้น\n• ส่งเสริมโภชนาการ\n• ประเมินซ้ำทุกวัน',
  },
  mild: {
    label: 'Mild Risk (15-18)',
    color: 'gold',
    bgColor: 'bg-yellow-50 border-yellow-200',
    textColor: 'text-yellow-700',
    interventions: '• พลิกตัวทุก 3-4 ชม.\n• ดูแลผิวหนังทั่วไป\n• ประเมินซ้ำทุกวัน',
  },
  no_risk: {
    label: 'No Risk (19-23)',
    color: 'green',
    bgColor: 'bg-green-50 border-green-200',
    textColor: 'text-green-700',
    interventions: '• มาตรฐานการดูแลผิวหนังทั่วไป\n• ประเมินซ้ำทุกสัปดาห์หรือเมื่อสภาพเปลี่ยน',
  },
};

const riskColorMap: Record<string, string> = {
  very_high: '#dc2626', high: '#ea580c', moderate: '#d97706', mild: '#ca8a04', no_risk: '#16a34a',
};
const riskBgMap: Record<string, string> = {
  very_high: '#fca5a5', high: '#fdba74', moderate: '#fcd34d', mild: '#fde68a', no_risk: '#86efac',
};

const mockRecords: BradenRecord[] = [
  {
    id: 1, an: '', record_datetime: dayjs().subtract(3, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', sensory_perception: 2, moisture: 2, activity: 1, mobility: 2, nutrition: 2, friction_shear: 1,
    total_score: 10, risk_level: 'high',
    interventions: 'พลิกตัวทุก 2 ชม. ใช้ที่นอนลม ทาครีมบำรุงผิว', nurse_name: 'พย.สมหญิง',
  },
  {
    id: 2, an: '', record_datetime: dayjs().subtract(2, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', sensory_perception: 3, moisture: 2, activity: 1, mobility: 2, nutrition: 3, friction_shear: 1,
    total_score: 12, risk_level: 'high',
    interventions: 'คงมาตรการเดิม ผิวหนังบริเวณก้นกบเริ่มแดง ทา barrier cream', nurse_name: 'พย.วิภา',
  },
  {
    id: 3, an: '', record_datetime: dayjs().subtract(1, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', sensory_perception: 3, moisture: 3, activity: 2, mobility: 2, nutrition: 3, friction_shear: 2,
    total_score: 15, risk_level: 'mild',
    interventions: 'นั่งเก้าอี้ได้ โภชนาการดีขึ้น ผิวหนังไม่แดง', nurse_name: 'พย.สมหญิง',
  },
  {
    id: 4, an: '', record_datetime: dayjs().hour(8).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', sensory_perception: 4, moisture: 3, activity: 3, mobility: 3, nutrition: 3, friction_shear: 3,
    total_score: 19, risk_level: 'no_risk',
    interventions: 'เดินได้ดี ผิวหนังปกติ ลด risk level', nurse_name: 'พย.วิภา',
  },
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

export default function BradenScale({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<BradenRecord[]>(mockRecords);
  const [rightTab, setRightTab] = useState('trend');
  const [liveScore, setLiveScore] = useState(23);

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/braden/${an}`, { headers });
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
    const score =
      (values.sensory_perception || 4) +
      (values.moisture || 4) +
      (values.activity || 4) +
      (values.mobility || 4) +
      (values.nutrition || 4) +
      (values.friction_shear || 3);
    setLiveScore(score);
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    const totalScore =
      (values.sensory_perception || 4) +
      (values.moisture || 4) +
      (values.activity || 4) +
      (values.mobility || 4) +
      (values.nutrition || 4) +
      (values.friction_shear || 3);
    const riskLevel = getRiskLevel(totalScore);

    try {
      const headers = getHeaders();
      const payload = {
        an, admission_list_id: patient?.admission_list_id,
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        shift: values.shift || null,
        sensory_perception: values.sensory_perception || 4,
        moisture: values.moisture || 4,
        activity: values.activity || 4,
        mobility: values.mobility || 4,
        nutrition: values.nutrition || 4,
        friction_shear: values.friction_shear || 3,
        total_score: totalScore,
        risk_level: riskLevel,
        interventions: values.interventions || null,
        nurse_name: values.nurse_name || null,
      };
      await axios.post('/api/v1/nursing-records/braden', payload, { headers });
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกการประเมินสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      form.resetFields();
      form.setFieldsValue({ record_datetime: dayjs() });
      setLiveScore(23);
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
      await axios.delete(`/api/v1/nursing-records/braden/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchRecords();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const liveRisk = getRiskLevel(liveScore);
  const liveRiskCfg = riskConfig[liveRisk];

  const sortedRecords = [...records].sort((a, b) => dayjs(b.record_datetime).unix() - dayjs(a.record_datetime).unix());
  const latestRecord = sortedRecords[0];

  const columns: ColumnsType<BradenRecord> = [
    { title: 'วันที่/เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 120, render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-' },
    { title: 'เวร', dataIndex: 'shift', key: 'shift', width: 60, align: 'center', render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0 text-xs">{v}</Tag> : '-' },
    { title: 'รับรู้', dataIndex: 'sensory_perception', key: 'sensory_perception', width: 50, align: 'center' },
    { title: 'ชื้น', dataIndex: 'moisture', key: 'moisture', width: 50, align: 'center' },
    { title: 'กิจกรรม', dataIndex: 'activity', key: 'activity', width: 60, align: 'center' },
    { title: 'เคลื่อนไหว', dataIndex: 'mobility', key: 'mobility', width: 70, align: 'center' },
    { title: 'โภชนา', dataIndex: 'nutrition', key: 'nutrition', width: 60, align: 'center' },
    { title: 'เสียดทาน', dataIndex: 'friction_shear', key: 'friction_shear', width: 60, align: 'center' },
    {
      title: 'คะแนน', dataIndex: 'total_score', key: 'total_score', width: 70, align: 'center',
      render: (v) => <span className="font-bold text-lg">{v}</span>,
    },
    {
      title: 'ระดับ', dataIndex: 'risk_level', key: 'risk_level', width: 130, align: 'center',
      render: (v) => <Tag color={riskConfig[v]?.color} className="m-0 font-bold text-xs">{riskConfig[v]?.label?.split('(')[0]}</Tag>,
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

  const patientName = patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-purple-500 to-fuchsia-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiShieldWarningBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">แบบประเมินแผลกดทับ (Braden Scale)</h1>
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
              <div className={`rounded-lg px-4 py-1.5 text-center ${latestRecord.risk_level === 'very_high' || latestRecord.risk_level === 'high' ? 'bg-red-500/30' : latestRecord.risk_level === 'moderate' ? 'bg-orange-400/30' : 'bg-green-500/30'}`}>
                <div className="text-white/70 text-xs">ล่าสุด</div>
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
              title={<span className="text-purple-600 font-bold text-sm">ประเมิน Braden Scale</span>}>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ record_datetime: dayjs() }}
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

                {/* Braden Scale Items */}
                <div className="bg-purple-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-purple-100">
                  <div className="text-xs text-purple-600 font-bold mb-2">Braden Scale (คะแนนต่ำ = ความเสี่ยงสูง)</div>
                  {Object.entries(bradenItems).map(([key, item]) => (
                    <Form.Item key={key} label={item.label} name={key} className="mb-2!">
                      <Radio.Group className="flex flex-col gap-1">
                        {item.options.map(opt => (
                          <Radio key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </Radio>
                        ))}
                      </Radio.Group>
                    </Form.Item>
                  ))}
                </div>

                {/* Live Score */}
                <div className={`rounded-xl p-3 mb-3 text-center border ${liveRiskCfg.bgColor}`}>
                  <div className="text-sm text-gray-500">คะแนนรวม (Braden)</div>
                  <div className={`text-3xl font-bold ${liveRiskCfg.textColor}`}>{liveScore}</div>
                  <Tag color={liveRiskCfg.color} className="m-0 mt-1 text-sm font-bold px-3 py-0.5">{liveRiskCfg.label}</Tag>
                </div>

                {/* Suggested interventions */}
                <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2 border border-gray-200 text-xs">
                  <div className="font-bold text-gray-500 mb-1">แนวทางการดูแล (แนะนำ)</div>
                  <div className="text-gray-600 whitespace-pre-line">{liveRiskCfg.interventions}</div>
                </div>

                <Form.Item label="มาตรการที่ดำเนินการ" name="interventions">
                  <TextArea rows={3} placeholder="ระบุมาตรการที่ดำเนินการจริง..." />
                </Form.Item>

                <Form.Item label="พยาบาลผู้ประเมิน" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                  className="bg-purple-500 hover:bg-purple-600 w-full shadow-md" size="middle">
                  บันทึกการประเมิน
                </Button>
              </Form>
            </Card>

            {/* Trend + Table - Right 3 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-purple-500! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'trend',
                    label: <span className="flex items-center gap-1.5"><PiChartLineUpBold /> แนวโน้ม ({records.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {/* Score Trend Visual */}
                        {sortedRecords.length > 0 && (
                          <div className="bg-white border border-gray-100 rounded-xl p-4">
                            <div className="text-xs font-bold text-gray-500 mb-3">แนวโน้มคะแนน Braden Scale (คะแนนสูง = ดี)</div>
                            <div className="flex items-end gap-1 h-32">
                              {[...sortedRecords].reverse().map((rec) => {
                                const maxScore = 23;
                                const heightPct = Math.max((rec.total_score / maxScore) * 100, 5);
                                return (
                                  <div key={rec.id} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs font-bold" style={{ color: riskColorMap[rec.risk_level] || '#666' }}>
                                      {rec.total_score}
                                    </span>
                                    <div
                                      className="w-full rounded-t-lg transition-all"
                                      style={{
                                        height: `${heightPct}%`,
                                        backgroundColor: riskBgMap[rec.risk_level] || '#ddd',
                                        border: `2px solid ${riskColorMap[rec.risk_level] || '#999'}`,
                                      }}
                                    />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{dayjs(rec.record_datetime).format('DD/MM')}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex gap-2 mt-3 justify-center flex-wrap">
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-red-200 border border-red-500" /> Very High (≤9)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-orange-200 border border-orange-500" /> High (10-12)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-amber-200 border border-amber-500" /> Moderate (13-14)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-yellow-200 border border-yellow-500" /> Mild (15-18)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-green-200 border border-green-500" /> No Risk (19-23)</div>
                            </div>
                          </div>
                        )}

                        {sortedRecords.map(rec => {
                          const cfg = riskConfig[rec.risk_level];
                          return (
                            <div key={rec.id} className="bg-white border-l-4 rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow"
                              style={{ borderLeftColor: riskColorMap[rec.risk_level] || '#999' }}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Tag color={shiftColor[rec.shift || ''] || 'default'} className="m-0 text-xs">{rec.shift || '-'}</Tag>
                                  <span className="text-xs text-gray-400">{dayjs(rec.record_datetime).format('DD/MM/YYYY HH:mm')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold ${cfg?.textColor || ''}`}>{rec.total_score}</span>
                                  <Tag color={cfg?.color} className="m-0 font-bold">{cfg?.label}</Tag>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1 mb-2">
                                {[
                                  { label: 'รับรู้', val: rec.sensory_perception },
                                  { label: 'ชื้น', val: rec.moisture },
                                  { label: 'กิจกรรม', val: rec.activity },
                                  { label: 'เคลื่อนไหว', val: rec.mobility },
                                  { label: 'โภชนา', val: rec.nutrition },
                                  { label: 'เสียดทาน', val: rec.friction_shear },
                                ].map(item => (
                                  <Tag key={item.label} color={item.val <= 2 ? 'red' : item.val === 3 ? 'orange' : 'green'} className="m-0 text-xs">
                                    {item.label}: {item.val}
                                  </Tag>
                                ))}
                              </div>

                              {rec.interventions && (
                                <div className="bg-gray-50 rounded-lg px-3 py-1.5 text-xs text-gray-600">
                                  <span className="font-bold text-gray-500">มาตรการ:</span> {rec.interventions}
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
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-purple-50! [&_.ant-table-thead_.ant-table-cell]:text-purple-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!" />
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
