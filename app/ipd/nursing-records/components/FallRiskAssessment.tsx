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
import { PiWarningBold, PiListBulletsBold, PiChartLineUpBold } from 'react-icons/pi';

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

interface FallRiskRecord {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  // Morse Fall Scale items
  history_of_falling: number;       // 0 or 25
  secondary_diagnosis: number;      // 0 or 15
  ambulatory_aid: number;           // 0, 15, or 30
  iv_heparin_lock: number;          // 0 or 20
  gait: number;                     // 0, 10, or 20
  mental_status: number;            // 0 or 15
  total_score: number;
  risk_level: 'low' | 'moderate' | 'high';
  interventions?: string;
  nurse_name?: string;
}

// Morse Fall Scale scoring
const morseItems = {
  history_of_falling: {
    label: '1. ประวัติการหกล้ม (ในช่วง 3 เดือนที่ผ่านมา)',
    options: [
      { value: 0, label: 'ไม่มี', score: 0 },
      { value: 25, label: 'มี', score: 25 },
    ],
  },
  secondary_diagnosis: {
    label: '2. การวินิจฉัยรอง (มากกว่า 1 โรค)',
    options: [
      { value: 0, label: 'ไม่มี', score: 0 },
      { value: 15, label: 'มี', score: 15 },
    ],
  },
  ambulatory_aid: {
    label: '3. การใช้อุปกรณ์ช่วยเดิน',
    options: [
      { value: 0, label: 'ไม่ใช้ / นอนเตียง / มีพยาบาลดูแล', score: 0 },
      { value: 15, label: 'ใช้ไม้เท้า / ไม้ค้ำ / Walker', score: 15 },
      { value: 30, label: 'เกาะเฟอร์นิเจอร์เดิน', score: 30 },
    ],
  },
  iv_heparin_lock: {
    label: '4. มีสาย IV / Heparin lock',
    options: [
      { value: 0, label: 'ไม่มี', score: 0 },
      { value: 20, label: 'มี', score: 20 },
    ],
  },
  gait: {
    label: '5. ลักษณะการเดิน (Gait)',
    options: [
      { value: 0, label: 'ปกติ / นอนเตียง / ใช้ Wheelchair', score: 0 },
      { value: 10, label: 'อ่อนแรง (Weak)', score: 10 },
      { value: 20, label: 'บกพร่อง (Impaired)', score: 20 },
    ],
  },
  mental_status: {
    label: '6. สภาพจิต (Mental Status)',
    options: [
      { value: 0, label: 'รู้ตัวดี / รู้ขีดจำกัดของตนเอง', score: 0 },
      { value: 15, label: 'ลืม/ประเมินความสามารถตนเองไม่ได้', score: 15 },
    ],
  },
};

const getRiskLevel = (score: number): 'low' | 'moderate' | 'high' => {
  if (score <= 24) return 'low';
  if (score <= 44) return 'moderate';
  return 'high';
};

const riskConfig: Record<string, { label: string; color: string; bgColor: string; textColor: string; interventions: string }> = {
  low: {
    label: 'Low Risk (0-24)',
    color: 'green',
    bgColor: 'bg-green-50 border-green-200',
    textColor: 'text-green-700',
    interventions: '• มาตรฐานการป้องกันการพลัดตกหกล้มทั่วไป\n• ให้ความรู้ผู้ป่วยและญาติ\n• ดูแลสิ่งแวดล้อมให้ปลอดภัย',
  },
  moderate: {
    label: 'Moderate Risk (25-44)',
    color: 'orange',
    bgColor: 'bg-orange-50 border-orange-200',
    textColor: 'text-orange-700',
    interventions: '• ติดสัญลักษณ์ Fall Risk ที่เตียง\n• ยกไม้กั้นเตียงขึ้นทั้ง 2 ข้าง\n• ล็อคล้อเตียง\n• ให้สวมรองเท้ากันลื่น\n• วางของใช้ให้อยู่ในระยะเอื้อมถึง\n• สอนใช้ Call bell / ขอความช่วยเหลือ\n• ประเมินซ้ำทุกเวร',
  },
  high: {
    label: 'High Risk (≥45)',
    color: 'red',
    bgColor: 'bg-red-50 border-red-200',
    textColor: 'text-red-700',
    interventions: '• ทุกข้อของ Moderate Risk +\n• จัดเตียงใกล้ Nurse Station\n• ปรับเตียงให้ต่ำสุด\n• เปิดไฟกลางคืน\n• จัดให้มีผู้ดูแลตลอด 24 ชม.\n• พิจารณาใช้ Alarm sensor\n• ปรึกษาแพทย์ทบทวนยาที่มีผลต่อการทรงตัว\n• ประเมินซ้ำทุก 8 ชม.',
  },
};

const mockRecords: FallRiskRecord[] = [
  {
    id: 1, an: '', record_datetime: dayjs().subtract(3, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', history_of_falling: 0, secondary_diagnosis: 15, ambulatory_aid: 0,
    iv_heparin_lock: 20, gait: 10, mental_status: 0, total_score: 45, risk_level: 'high',
    interventions: 'ยกไม้กั้นเตียงทั้ง 2 ข้าง ติดป้าย Fall Risk ปรับเตียงต่ำ ให้สวมรองเท้ากันลื่น',
    nurse_name: 'พย.สมหญิง',
  },
  {
    id: 2, an: '', record_datetime: dayjs().subtract(2, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', history_of_falling: 0, secondary_diagnosis: 15, ambulatory_aid: 0,
    iv_heparin_lock: 20, gait: 10, mental_status: 0, total_score: 45, risk_level: 'high',
    interventions: 'คงมาตรการเดิม ผู้ป่วยเข้าใจดี ไม่มีเหตุการณ์พลัดตกหกล้ม',
    nurse_name: 'พย.สมหญิง',
  },
  {
    id: 3, an: '', record_datetime: dayjs().subtract(1, 'day').hour(9).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', history_of_falling: 0, secondary_diagnosis: 15, ambulatory_aid: 0,
    iv_heparin_lock: 20, gait: 0, mental_status: 0, total_score: 35, risk_level: 'moderate',
    interventions: 'ลด risk เนื่องจาก gait ดีขึ้น เดินได้มั่นคง คงมาตรการป้องกัน',
    nurse_name: 'พย.วิภา',
  },
  {
    id: 4, an: '', record_datetime: dayjs().hour(8).minute(30).format('YYYY-MM-DD HH:mm:ss'),
    shift: 'เช้า', history_of_falling: 0, secondary_diagnosis: 15, ambulatory_aid: 0,
    iv_heparin_lock: 0, gait: 0, mental_status: 0, total_score: 15, risk_level: 'low',
    interventions: 'Off IV แล้ว เดินได้ดี ลด risk level เป็น Low สอนการป้องกันก่อนจำหน่าย',
    nurse_name: 'พย.สมหญิง',
  },
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

export default function FallRiskAssessment({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<FallRiskRecord[]>(mockRecords);
  const [rightTab, setRightTab] = useState('trend');
  const [liveScore, setLiveScore] = useState(0);

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/fall-risk/${an}`, { headers });
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
    const score =
      (values.history_of_falling || 0) +
      (values.secondary_diagnosis || 0) +
      (values.ambulatory_aid || 0) +
      (values.iv_heparin_lock || 0) +
      (values.gait || 0) +
      (values.mental_status || 0);
    setLiveScore(score);
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    const totalScore =
      (values.history_of_falling || 0) +
      (values.secondary_diagnosis || 0) +
      (values.ambulatory_aid || 0) +
      (values.iv_heparin_lock || 0) +
      (values.gait || 0) +
      (values.mental_status || 0);
    const riskLevel = getRiskLevel(totalScore);

    try {
      const headers = getHeaders();
      const payload = {
        an, admission_list_id: patient?.admission_list_id,
        ward_code: patient?.ward || getUserProfile()?.ward_code || '',
        ward_name: patient?.wardName || getUserProfile()?.ward_name || '',
        staff_id: getUserProfile()?.staff_id || '',
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        shift: values.shift || null,
        history_of_falling: values.history_of_falling || 0,
        secondary_diagnosis: values.secondary_diagnosis || 0,
        ambulatory_aid: values.ambulatory_aid || 0,
        iv_heparin_lock: values.iv_heparin_lock || 0,
        gait: values.gait || 0,
        mental_status: values.mental_status || 0,
        total_score: totalScore,
        risk_level: riskLevel,
        interventions: values.interventions || null,
        nurse_name: values.nurse_name || null,
      };
      await axios.post('/api/v1/nursing-records/fall-risk', payload, { headers });
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกการประเมินสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      form.resetFields();
      form.setFieldsValue({ record_datetime: dayjs(), history_of_falling: 0, secondary_diagnosis: 0, ambulatory_aid: 0, iv_heparin_lock: 0, gait: 0, mental_status: 0, nurse_name: getUserProfile()?.fullname || '' });
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
      await axios.delete(`/api/v1/nursing-records/fall-risk/${id}`, { headers });
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

  const columns: ColumnsType<FallRiskRecord> = [
    { title: 'วันที่/เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 120, render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-' },
    { title: 'เวร', dataIndex: 'shift', key: 'shift', width: 60, align: 'center', render: (v) => v ? <Tag color={shiftColor[v] || 'default'} className="m-0 text-xs">{v}</Tag> : '-' },
    { title: 'ประวัติล้ม', dataIndex: 'history_of_falling', key: 'history_of_falling', width: 70, align: 'center' },
    { title: 'วินิจฉัยรอง', dataIndex: 'secondary_diagnosis', key: 'secondary_diagnosis', width: 70, align: 'center' },
    { title: 'อุปกรณ์', dataIndex: 'ambulatory_aid', key: 'ambulatory_aid', width: 70, align: 'center' },
    { title: 'IV', dataIndex: 'iv_heparin_lock', key: 'iv_heparin_lock', width: 50, align: 'center' },
    { title: 'Gait', dataIndex: 'gait', key: 'gait', width: 50, align: 'center' },
    { title: 'จิต', dataIndex: 'mental_status', key: 'mental_status', width: 50, align: 'center' },
    {
      title: 'คะแนน', dataIndex: 'total_score', key: 'total_score', width: 70, align: 'center',
      render: (v) => <span className="font-bold text-lg">{v}</span>,
    },
    {
      title: 'ระดับ', dataIndex: 'risk_level', key: 'risk_level', width: 110, align: 'center',
      render: (v) => <Tag color={riskConfig[v]?.color} className="m-0 font-bold">{riskConfig[v]?.label?.split(' ')[0]} {riskConfig[v]?.label?.split(' ')[1]}</Tag>,
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
        <div className="bg-linear-to-r from-yellow-500 to-orange-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiWarningBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">แบบประเมินความเสี่ยงพลัดตกหกล้ม (Morse Fall Scale)</h1>
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
              <div className={`rounded-lg px-4 py-1.5 text-center ${latestRecord.risk_level === 'high' ? 'bg-red-500/30' : latestRecord.risk_level === 'moderate' ? 'bg-orange-400/30' : 'bg-green-500/30'}`}>
                <div className="text-white/70 text-xs">ล่าสุด</div>
                <div className="text-white font-bold text-lg">{latestRecord.total_score} คะแนน</div>
              </div>
            )}
            <Button size="small" onClick={() => window.history.back()} className="border-white/30 text-white bg-white/10 hover:bg-white/20">ย้อนกลับ</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" description="กำลังโหลดข้อมูล..." /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Form - Left 2 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-2"
              title={<span className="text-orange-600 font-bold text-sm">ประเมิน Morse Fall Scale</span>}>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{
                  record_datetime: dayjs(),
                  history_of_falling: 0, secondary_diagnosis: 0, ambulatory_aid: 0,
                  iv_heparin_lock: 0, gait: 0, mental_status: 0,
                  nurse_name: getUserProfile()?.fullname || '',
                }}
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

                {/* Morse Scale Items */}
                <div className="bg-orange-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-orange-100">
                  <div className="text-xs text-orange-600 font-bold mb-2">Morse Fall Scale</div>
                  {Object.entries(morseItems).map(([key, item]) => (
                    <Form.Item key={key} label={item.label} name={key} className="mb-2!">
                      <Radio.Group className="flex flex-col gap-1">
                        {item.options.map(opt => (
                          <Radio key={opt.value} value={opt.value} className="text-xs">
                            {opt.label} <Tag className="m-0 ml-1 text-xs" color={opt.score > 0 ? 'orange' : 'default'}>{opt.score} คะแนน</Tag>
                          </Radio>
                        ))}
                      </Radio.Group>
                    </Form.Item>
                  ))}
                </div>

                {/* Live Score */}
                <div className={`rounded-xl p-3 mb-3 text-center border ${liveRiskCfg.bgColor}`}>
                  <div className="text-sm text-gray-500">คะแนนรวม</div>
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
                  className="bg-orange-500 hover:bg-orange-600 w-full shadow-md" size="middle">
                  บันทึกการประเมิน
                </Button>
              </Form>
            </Card>

            {/* Trend + Table - Right 3 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-orange-500! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'trend',
                    label: <span className="flex items-center gap-1.5"><PiChartLineUpBold /> แนวโน้ม ({records.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {/* Score Trend Visual */}
                        {sortedRecords.length > 0 && (
                          <div className="bg-white border border-gray-100 rounded-xl p-4">
                            <div className="text-xs font-bold text-gray-500 mb-3">แนวโน้มคะแนน Morse Fall Scale</div>
                            <div className="flex items-end gap-1 h-32">
                              {[...sortedRecords].reverse().map((rec, idx) => {
                                const maxScore = 125;
                                const heightPct = Math.max((rec.total_score / maxScore) * 100, 5);
                                const cfg = riskConfig[rec.risk_level];
                                return (
                                  <div key={rec.id} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs font-bold" style={{ color: cfg.color === 'green' ? '#16a34a' : cfg.color === 'orange' ? '#ea580c' : '#dc2626' }}>
                                      {rec.total_score}
                                    </span>
                                    <div
                                      className="w-full rounded-t-lg transition-all"
                                      style={{
                                        height: `${heightPct}%`,
                                        backgroundColor: cfg.color === 'green' ? '#86efac' : cfg.color === 'orange' ? '#fdba74' : '#fca5a5',
                                        border: `2px solid ${cfg.color === 'green' ? '#16a34a' : cfg.color === 'orange' ? '#ea580c' : '#dc2626'}`,
                                      }}
                                    />
                                    <span className="text-xs text-gray-400 whitespace-nowrap">{dayjs(rec.record_datetime).format('DD/MM')}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Risk level zones */}
                            <div className="flex gap-3 mt-3 justify-center">
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-green-200 border border-green-500" /> Low (0-24)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-orange-200 border border-orange-500" /> Moderate (25-44)</div>
                              <div className="flex items-center gap-1 text-xs"><div className="w-3 h-3 rounded bg-red-200 border border-red-500" /> High (≥45)</div>
                            </div>
                          </div>
                        )}

                        {/* Records list */}
                        {sortedRecords.map(rec => {
                          const cfg = riskConfig[rec.risk_level];
                          return (
                            <div key={rec.id} className={`bg-white border-l-4 rounded-xl p-4 border border-gray-100 hover:shadow-md transition-shadow`}
                              style={{ borderLeftColor: cfg.color === 'green' ? '#16a34a' : cfg.color === 'orange' ? '#ea580c' : '#dc2626' }}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Tag color={shiftColor[rec.shift || ''] || 'default'} className="m-0 text-xs">{rec.shift || '-'}</Tag>
                                  <span className="text-xs text-gray-400">{dayjs(rec.record_datetime).format('DD/MM/YYYY HH:mm')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-2xl font-bold ${cfg.textColor}`}>{rec.total_score}</span>
                                  <Tag color={cfg.color} className="m-0 font-bold">{cfg.label}</Tag>
                                </div>
                              </div>

                              {/* Score breakdown */}
                              <div className="flex flex-wrap gap-1 mb-2">
                                {[
                                  { label: 'ประวัติล้ม', val: rec.history_of_falling },
                                  { label: 'วินิจฉัยรอง', val: rec.secondary_diagnosis },
                                  { label: 'อุปกรณ์', val: rec.ambulatory_aid },
                                  { label: 'IV', val: rec.iv_heparin_lock },
                                  { label: 'Gait', val: rec.gait },
                                  { label: 'จิต', val: rec.mental_status },
                                ].map(item => (
                                  <Tag key={item.label} color={item.val > 0 ? 'orange' : 'default'} className="m-0 text-xs">
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
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-orange-50! [&_.ant-table-thead_.ant-table-cell]:text-orange-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!" />
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
