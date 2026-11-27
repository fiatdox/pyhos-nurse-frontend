'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Form, Select, DatePicker, Button, Row, Col, Tag, Table, Popconfirm, Tabs, Radio, Alert } from 'antd';
import { FormSkeleton } from '@/app/components/Skeletons';
import type { ColumnsType } from 'antd/es/table';
import Input from 'antd/es/input';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave, VscTrash } from 'react-icons/vsc';
import { PiWarningBold, PiListBulletsBold, PiChartLineUpBold, PiPencilSimpleBold } from 'react-icons/pi';

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
  regdate?: string;
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
  ward_code?: string;
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

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };
const MORSE_KEYS = ['history_of_falling', 'secondary_diagnosis', 'ambulatory_aid', 'iv_heparin_lock', 'gait', 'mental_status'] as const;
const shiftOfTime = (d: Dayjs) => (d.hour() < 8 ? 'ดึก' : d.hour() < 16 ? 'เช้า' : 'บ่าย');
const defaultNurse = () => (getUserProfile()?.fullname || getUserProfile()?.name) || '';
/**
 * ค่าของทั้งฟอร์มจากรายการเดิม (แก้ไข) หรือค่าตั้งต้น (ลงใหม่) — ระบุครบทุกช่องเสมอ
 * ลงใหม่ไม่เลือกคำตอบไว้ให้ก่อน (กดบันทึกทันทีต้องไม่ได้ "เสี่ยงต่ำ" ทั้งที่ไม่ได้ประเมิน)
 */
const toFormValues = (r: FallRiskRecord | null, at: Dayjs) => ({
  record_datetime: r ? dayjs(r.record_datetime) : at,
  shift: r ? (r.shift ?? shiftOfTime(dayjs(r.record_datetime))) : shiftOfTime(at),
  ...Object.fromEntries(MORSE_KEYS.map(k => [k, r ? r[k] : undefined])),
  interventions: r?.interventions ?? undefined,
  nurse_name: r?.nurse_name || defaultNurse(),
});

/**
 * embedded = เปิดอยู่ในลิ้นชักของฟอร์มปรอท ไม่มี Navbar/หัวหน้า
 * initialAt = วันที่คลิกมาจากฟอร์มปรอท (ประเมินวันละครั้ง) — วันนั้นมีการประเมินแล้ว เปิดรายการนั้นมาให้แก้
 * onSaved = ให้ฟอร์มปรอทโหลดใหม่หลังบันทึก/แก้/ลบ
 */
export default function FallRiskAssessment({ an, embedded = false, onSaved, initialAt }: {
  an: string; embedded?: boolean; onSaved?: () => void; initialAt?: Dayjs;
}) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<FallRiskRecord[]>([]);
  /** รายการที่กำลังแก้ (null = ลงรายการใหม่) */
  const [editing, setEditing] = useState<FallRiskRecord | null>(null);
  const formTop = useRef<HTMLSpanElement>(null);
  const [rightTab, setRightTab] = useState('trend');
  const [liveScore, setLiveScore] = useState(0);
  const [complete, setComplete] = useState(false);

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchRecords = useCallback(async (): Promise<FallRiskRecord[]> => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/fall-risk/${an}`, { headers });
      const rows: FallRiskRecord[] = res.data?.success ? (res.data.data || []) : [];
      setRecords(rows);
      setLoadError(null);
      return rows;
    } catch (error) {
      // ไม่ใส่ข้อมูลตัวอย่างแทน — บันทึกทางการพยาบาลต้องแยกได้ว่าอันไหนของจริง
      setRecords([]);
      const msg = axios.isAxiosError(error) ? (error.response?.data as { message?: string })?.message : undefined;
      setLoadError(msg ?? 'โหลดประวัติการประเมินไม่สำเร็จ');
      return [];
    }
  }, [an, getHeaders]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = getHeaders();
        const patientRes = await axios.post('/api/v1/patients/patient-by-an', { an }, { headers });
        if (patientRes.data?.success && patientRes.data.data) {
          const p = Array.isArray(patientRes.data.data) ? patientRes.data.data[0] : patientRes.data.data;
          setPatient(p);
        }
        const rows = await fetchRecords();
        // เปิดจากฟอร์มปรอท: วันนั้นประเมินแล้ว → เปิดรายการนั้นมาให้ดู/แก้ (ตั้งก่อน setLoading(false) ฟอร์มจึงขึ้นพร้อมค่า)
        if (initialAt) {
          const hit = rows.find(r => dayjs(r.record_datetime).isSame(initialAt, 'day'));
          if (hit) {
            setEditing(hit);
            setComplete(true);
            setLiveScore(hit.total_score);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [an, getHeaders, fetchRecords, initialAt]);

  /** เปิดรายการเดิมมาแก้ */
  const startEdit = (r: FallRiskRecord) => {
    setEditing(r);
    form.resetFields();
    form.setFieldsValue(toFormValues(r, dayjs()));
    setComplete(true);
    setLiveScore(r.total_score);
    formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  /** ลงรายการใหม่ (วันที่คลิกมา หรือเวลาปัจจุบัน) */
  const startNew = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue(toFormValues(null, initialAt ?? dayjs()));
    setComplete(false);
    setLiveScore(0);
  };

  /* คะแนนรวมและระดับความเสี่ยงขึ้นเมื่อตอบครบ 6 ข้อ (คำตอบ 0 คะแนนนับว่าตอบแล้ว) */
  const recalcScore = () => {
    const values = form.getFieldsValue();
    const keys = ['history_of_falling', 'secondary_diagnosis', 'ambulatory_aid', 'iv_heparin_lock', 'gait', 'mental_status'];
    setComplete(keys.every(k => values[k] !== undefined && values[k] !== null));
    setLiveScore(keys.reduce((sum, k) => sum + (values[k] || 0), 0));
  };

  const onFinish = async (values: { record_datetime?: Dayjs; shift?: string; interventions?: string; nurse_name?: string } & Partial<Record<typeof MORSE_KEYS[number], number>>) => {
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
      if (!payload.ward_code && editing?.ward_code) payload.ward_code = editing.ward_code;
      if (editing) await axios.put(`/api/v1/nursing-records/fall-risk/${editing.id}`, payload, { headers });
      else await axios.post('/api/v1/nursing-records/fall-risk', payload, { headers });
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: editing ? 'แก้ไขการประเมินสำเร็จ' : 'บันทึกการประเมินสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      const rows = await fetchRecords();
      // หลังบันทึก: เปิดรายการของวันนั้นค้างไว้ (วันละครั้ง ลงใหม่ซ้ำวันเดิมไม่ได้อยู่แล้ว)
      const day = dayjs(payload.record_datetime);
      const same = rows.find(r => dayjs(r.record_datetime).isSame(day, 'day'));
      if (same) startEdit(same); else startNew();
      onSaved?.();
    } catch (error: unknown) {
      const res = axios.isAxiosError(error) ? error.response : undefined;
      const data = res?.data as { message?: string; existing_id?: number } | undefined;
      if (res?.status === 409 && data?.existing_id) {
        // วันนี้ประเมินแล้ว: เสนอให้เปิดรายการเดิมมาแก้แทน
        const r = await Swal.fire({ icon: 'warning', title: 'วันนี้ประเมินแล้ว', text: data.message, showCancelButton: true,
          confirmButtonText: 'เปิดรายการเดิมมาแก้', cancelButtonText: 'ปิด', confirmButtonColor: '#006b5f' });
        if (r.isConfirmed) {
          const rows = await fetchRecords();
          const hit = rows.find(x => x.id === data.existing_id);
          if (hit) startEdit(hit);
        }
      } else {
        Swal.fire({ icon: 'error', title: `ผิดพลาด (${res?.status ?? 'Network Error'})`, text: data?.message ?? 'เกิดข้อผิดพลาด', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/fall-risk/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      if (editing?.id === id) startNew();
      await fetchRecords();
      onSaved?.();
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
      title: '', key: 'action', width: 80, align: 'center',
      render: (_, r) => (
        <span className="inline-flex">
          <Button type="text" size="small" icon={<PiPencilSimpleBold />} aria-label="แก้ไข" onClick={() => startEdit(r)} />
          <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(r.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
            <Button type="text" danger size="small" icon={<VscTrash />} aria-label="ลบ" />
          </Popconfirm>
        </span>
      ),
    },
  ];

  const patientName = patient?.ptname || patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime || patient?.regdate;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  return (
    <div className={embedded ? 'font-sans @container' : 'bg-slate-50 min-h-screen font-sans'}>
      {!embedded && <Navbar />}
      <div className={embedded ? '' : 'p-4 max-w-7xl mx-auto'}>
        {/* Header (ในลิ้นชักใช้หัวของลิ้นชักแทน) */}
        <div hidden={embedded} className="bg-linear-to-r from-[#004d45] via-[#006b5f] to-[#00796b] rounded-xl shadow-md mb-4 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 shrink-0 bg-white/20 rounded-xl flex items-center justify-center">
              <PiWarningBold className="text-white text-xl" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white m-0 leading-snug">แบบประเมินความเสี่ยงพลัดตกหกล้ม (Morse Fall Scale)</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
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
          </div>
        </div>

        {loading ? (
          <FormSkeleton />
        ) : (
          <div className={embedded ? 'grid grid-cols-1 @3xl:grid-cols-5 gap-4' : 'grid grid-cols-1 lg:grid-cols-5 gap-4'}>
            {/* Form - Left 2 cols */}
            <Card size="small" className={`shadow-sm rounded-xl border border-gray-100 ${embedded ? '@3xl:col-span-2' : 'lg:col-span-2'}`}
              title={<span ref={formTop} className={`font-bold text-sm ${editing ? 'text-blue-700' : 'text-orange-600'}`}>{editing ? 'แก้ไขการประเมิน Morse Fall Scale' : 'ประเมิน Morse Fall Scale'}</span>}>
              {loadError && <Alert type="error" showIcon className="mb-2!" title={loadError} />}
              <div className="text-xs text-gray-500 mb-2">ประเมินวันละ 1 ครั้ง (แสดงในแถว Fall risk ท้ายฟอร์มปรอท) · วันเดิมให้แก้รายการเดิม</div>
              {editing && (
                <Alert type="info" showIcon className="mb-2!"
                  title={<span className="text-sm">กำลังแก้การประเมินวันที่ <b>{dayjs(editing.record_datetime).format('DD/MM/YYYY')}</b> · บันทึกจะทับรายการเดิม</span>}
                  description={<span className="text-xs text-gray-600">ประเมินล่าสุด {dayjs(editing.record_datetime).format('HH:mm')} น. โดย {editing.nurse_name || '-'}</span>}
                  action={!initialAt ? <Button size="small" onClick={startNew}>ลงวันใหม่</Button> : undefined} />
              )}
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                /* ไม่เลือกคำตอบไว้ให้ก่อน เดิมทุกข้อถูกตั้งเป็น "ไม่มี 0 คะแนน" กดบันทึกทันทีก็ได้ "เสี่ยงต่ำ" ทั้งที่ไม่ได้ประเมิน */
                initialValues={toFormValues(editing, initialAt ?? dayjs())}
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
                    <Form.Item key={key} label={item.label} name={key} className="mb-2!" rules={[{ required: true, message: 'กรุณาเลือกข้อนี้' }]}>
                      <Radio.Group className="score-options flex flex-col gap-1">
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
                <div className={`rounded-xl p-3 mb-3 text-center border ${complete ? liveRiskCfg.bgColor : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-sm text-gray-500">คะแนนรวม</div>
                  {complete ? (
                    <>
                      <div className={`text-3xl font-bold ${liveRiskCfg.textColor}`}>{liveScore}</div>
                      <Tag color={liveRiskCfg.color} className="m-0 mt-1 text-sm font-bold px-3 py-0.5">{liveRiskCfg.label}</Tag>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-gray-400">–</div>
                      <div className="text-xs text-gray-500 mt-1">ตอบให้ครบทั้ง 6 ข้อก่อน จึงจะคิดคะแนน</div>
                    </>
                  )}
                </div>

                {/* Suggested interventions — ขึ้นเมื่อตอบครบแล้วเท่านั้น */}
                {complete && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2 border border-gray-200 text-xs">
                    <div className="font-bold text-gray-500 mb-1">แนวทางการดูแล (แนะนำ)</div>
                    <div className="text-gray-600 whitespace-pre-line">{liveRiskCfg.interventions}</div>
                  </div>
                )}

                <Form.Item label="มาตรการที่ดำเนินการ" name="interventions">
                  <TextArea rows={3} placeholder="ระบุมาตรการที่ดำเนินการจริง..." />
                </Form.Item>

                <Form.Item label="พยาบาลผู้ประเมิน" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                {/* ปุ่มบันทึกติดล่างจอ ไม่ต้องเลื่อนหาท้ายฟอร์มยาว (สำคัญบนมือถือ) */}
                <div className="sticky bottom-0 z-10 -mx-3 px-3 pt-2 pb-3 bg-white border-t border-gray-100">
                  <div className="text-xs text-center mb-1.5 font-semibold text-gray-600">{complete ? `${liveScore} คะแนน · ${liveRiskCfg.label}` : 'ยังตอบไม่ครบ — คะแนนจะขึ้นเมื่อตอบครบทุกข้อ'}</div>
                  <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                    className="bg-orange-500 hover:bg-orange-600 w-full shadow-md" size="middle">
                    {editing ? 'บันทึกการแก้ไข' : 'บันทึกการประเมิน'}
                  </Button>
                </div>
              </Form>
            </Card>

            {/* Trend + Table - Right 3 cols */}
            <Card size="small" className={`shadow-sm rounded-xl border border-gray-100 [&_.ant-card-body]:p-0 ${embedded ? '@3xl:col-span-3' : 'lg:col-span-3'}`}>
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-orange-500! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'trend',
                    label: <span className="flex items-center gap-1.5"><PiChartLineUpBold /> แนวโน้ม ({records.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {records.length === 0 && (
                          <div className="py-12 text-center text-sm text-gray-500">
                            ยังไม่มีบันทึกของผู้ป่วยรายนี้
                            <div className="text-xs text-gray-400 mt-1">บันทึกครั้งแรกแล้ว ผลจะแสดงที่นี่</div>
                          </div>
                        )}
                        {/* Score Trend Visual */}
                        {sortedRecords.length > 0 && (
                          <div className="bg-white border border-gray-100 rounded-xl p-4">
                            <div className="text-xs font-bold text-gray-500 mb-3">แนวโน้มคะแนน Morse Fall Scale</div>
                            <div className="flex items-end gap-1 h-32">
                              {[...sortedRecords].reverse().map((rec) => {
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
                            <div key={rec.id} className={`bg-white border-l-4 rounded-xl p-4 border hover:shadow-md transition-shadow ${editing?.id === rec.id ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-100'}`}
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

                              <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between gap-2">
                                <Button size="small" icon={<PiPencilSimpleBold />} onClick={() => startEdit(rec)} disabled={editing?.id === rec.id}>
                                  {editing?.id === rec.id ? 'กำลังแก้' : 'แก้ไข'}
                                </Button>
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
