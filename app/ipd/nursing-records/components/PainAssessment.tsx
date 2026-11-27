'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Form, Select, DatePicker, Button, Row, Col, Tag, Table, Popconfirm, Tabs, Segmented, Radio, Alert } from 'antd';
import { FormSkeleton } from '@/app/components/Skeletons';
import type { ColumnsType } from 'antd/es/table';
import Input from 'antd/es/input';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave, VscTrash } from 'react-icons/vsc';
import { PiHeartbeatBold, PiListBulletsBold, PiChartLineUpBold, PiPencilSimpleBold, PiPlusBold } from 'react-icons/pi';

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
  tool_items?: CpotItems | null;
}

interface CpotItems { facial?: number; body?: number; muscle?: number; airway_mode?: 'ventilator' | 'vocal'; airway?: number }

/**
 * CPOT ฉบับภาษาไทย (งานการพยาบาล ศิริราช 2564) — ผู้ป่วยที่บอกคะแนนความปวดเองไม่ได้
 * ประเมินจากพฤติกรรม 4 ด้าน ด้านละ 0-2 รวม 0-8 · 0-2 mild · 3-5 moderate · >5 severe
 * ข้อความแต่ละระดับใช้ตามเอกสาร ไม่แต่งเพิ่ม
 */
const CPOT_ITEMS: { key: 'facial' | 'body' | 'muscle'; title: string; hint?: string; levels: string[] }[] = [
  {
    key: 'facial', title: '1. การแสดงออกทางสีหน้า (Facial expression)', levels: [
      'สีหน้าเรียบเฉย ไม่มีความตึงเครียดที่สังเกตได้บนใบหน้าผู้ป่วย (Relaxed, neutral)',
      'หน้านิ่ว คิ้วขมวด แสดงความเครียด (Tense)',
      'หน้าตาบูดเบี้ยว ปิดตาแน่น (Grimacing)',
    ],
  },
  {
    key: 'body', title: '2. การเคลื่อนไหวร่างกาย (Body movements)', levels: [
      'ผู้ป่วยไม่เคลื่อนไหว หรืออยู่ในท่าทางปกติ (Absence of movements)',
      'ผู้ป่วยจะเคลื่อนไหวช้าและระมัดระวัง พยายามที่จะเอื้อมมือไปสัมผัสตำแหน่งที่รู้สึกเจ็บปวด (Protection)',
      'ผู้ป่วยจะกระสับกระส่าย นอนพักไม่ได้ (Restlessness)',
    ],
  },
  {
    key: 'muscle', title: '3. ความตึงตัวของกล้ามเนื้อ (Muscle tension)', hint: 'ประเมินจากการงอและเหยียดแขนผู้ป่วย', levels: [
      'ไม่มีการต่อต้านในระหว่างการช่วยผู้ป่วยเคลื่อนไหว หรือพลิกตัว (Relaxed)',
      'มีการต่อต้านในระหว่างการเคลื่อนไหว หรือเปลี่ยนท่า (Tense, rigid)',
      'การต่อต้านของผู้ป่วยมีกำลังมากขึ้น ต้านแรงผู้ประเมินมาก (Very tense or rigid)',
    ],
  },
];
const CPOT_AIRWAY = {
  ventilator: {
    title: '4. การยอมตามเครื่องช่วยหายใจ (Compliance with the ventilator)', levels: [
      'ไม่มีสัญญาณเตือนของเครื่องดังขึ้น (Tolerating ventilator)',
      'ผู้ป่วยอาจมีอาการไอหรือสัญญาณเตือนของเครื่องดังขึ้น แต่หยุดเองโดยไม่ต้องเข้าไปแก้ไข (Coughing but tolerating)',
      'ผู้ป่วยจะต่อสู้ในการใช้เครื่องช่วยหายใจ สัญญาณเตือนของเครื่องดังขึ้นไม่หยุด ต้องเข้าไปแก้ไขเพื่อให้ผู้ป่วยสงบ (Fighting ventilator)',
    ],
  },
  vocal: {
    title: '4. การออกเสียง (Vocalization) : ผู้ป่วยที่ไม่ได้ใส่ท่อช่วยหายใจ', levels: [
      'พูดด้วยน้ำเสียงปกติ หรือไม่มีเสียง (Talking in normal tone or no sound)',
      'มีการถอนหายใจ หรือร้องครางเบาๆ (Sighing, moaning)',
      'มีการร้องไห้ หรือร้องโวยวาย (Crying out, sobbing)',
    ],
  },
} as const;
const cpotLevel = (total: number) => (total <= 2 ? 'mild' : total <= 5 ? 'moderate' : 'severe');
const cpotLevelLabel: Record<string, string> = {
  mild: 'ปวดเล็กน้อย (CPOT 0-2 · mild)',
  moderate: 'ปวดปานกลาง (CPOT 3-5 · moderate) ต้องได้รับการจัดการ',
  severe: 'ปวดมาก (CPOT > 5 · severe) ต้องได้รับการจัดการ',
};
/** คะแนนเต็มและเกณฑ์ระดับขึ้นกับเครื่องมือ — CPOT เต็ม 8 ใช้เกณฑ์ของ CPOT */
const maxOf = (tool?: string) => (tool === 'CPOT' ? 8 : 10);

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
const levelOfRecord = (r: { assessment_tool?: string; pain_score: number }) =>
  r.assessment_tool === 'CPOT' ? cpotLevel(r.pain_score) : getPainLevel(r.pain_score);

const painLevelLabel: Record<string, string> = {
  no_pain: 'ไม่ปวด (0)',
  mild: 'ปวดเล็กน้อย (1-3)',
  moderate: 'ปวดปานกลาง (4-6)',
  severe: 'ปวดมาก (7-9)',
  worst: 'ปวดมากที่สุด (10)',
};

/**
 * ตัวเลือกคะแนน 0–10 ของ Segmented
 * ตัวเลขที่เลือกอยู่จะเปลี่ยนเป็นสีตามระดับความปวด ให้เห็นความรุนแรงทันทีโดยไม่ต้องอ่านป้าย
 */
const painScoreOptions = (selected: number) =>
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => {
    const cfg = painScaleColors[getPainLevel(score)];
    const active = selected === score;
    return {
      value: score,
      label: (
        <span
          className="font-bold"
          // ตัวที่ยังไม่เลือกใช้สีจางของระดับตัวเอง ทำให้เห็นการไล่เขียว→แดงตลอดแถบ
          style={{ color: active ? '#fff' : cfg.border, fontSize: active ? 16 : 13 }}
        >
          {score}
        </span>
      ),
    };
  });

const painCharacters = [
  'ปวดแหลม (Sharp)', 'ปวดตุบๆ (Throbbing)', 'ปวดแสบร้อน (Burning)',
  'ปวดบีบรัด (Cramping)', 'ปวดตื้อ (Dull/Aching)', 'ปวดเสียดแทง (Stabbing)',
  'ปวดจี๊ดๆ (Shooting)', 'ปวดหนักๆ (Pressure)', 'อื่นๆ',
];

const painLocations = [
  'ศีรษะ', 'หน้าอก', 'ท้อง', 'หลัง', 'แขนซ้าย', 'แขนขวา',
  'ขาซ้าย', 'ขาขวา', 'ข้อเข่า', 'สะโพก', 'แผลผ่าตัด', 'อื่นๆ',
];

const shiftColor: Record<string, string> = { 'ดึก': 'purple', 'เช้า': 'blue', 'บ่าย': 'orange' };

/** ค่าที่ Form ส่งกลับมาตอน submit */
interface PainFormValues {
  record_datetime?: dayjs.Dayjs;
  shift?: string;
  assessment_tool?: string;
  pain_score?: number;
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
  cpot?: CpotItems;
}

const shiftOfTime = (d: Dayjs) => (d.hour() < 8 ? 'ดึก' : d.hour() < 16 ? 'เช้า' : 'บ่าย');
const defaultNurse = () => (getUserProfile()?.fullname || getUserProfile()?.name) || '';
/** ช่องเวลาของฟอร์มปรอท (ช่องละ 4 ชม.) — ใช้หารายการที่อยู่ช่องเดียวกับที่คลิก */
const sameSlot = (a: Dayjs, b: Dayjs) => a.isSame(b, 'day') && Math.floor(a.hour() / 4) === Math.floor(b.hour() / 4);
/**
 * ค่าของทั้งฟอร์มจากรายการเดิม (แก้ไข) หรือค่าตั้งต้น (ลงใหม่) — ระบุครบทุกช่องเสมอ
 * ไม่งั้นค่าจากรายการที่เปิดแก้ก่อนหน้าจะค้างในช่องที่ไม่ได้ระบุ
 */
const toFormValues = (rec: PainRecord | null, at: Dayjs, withShift: boolean, tool = 'NRS'): PainFormValues => ({
  record_datetime: rec ? dayjs(rec.record_datetime) : at,
  shift: rec ? (rec.shift ?? shiftOfTime(dayjs(rec.record_datetime))) : (withShift ? shiftOfTime(at) : undefined),
  assessment_tool: rec?.assessment_tool ?? tool,
  pain_score: rec && rec.assessment_tool !== 'CPOT' ? rec.pain_score : 0,
  cpot: {
    airway_mode: rec?.tool_items?.airway_mode ?? 'ventilator',
    facial: rec?.tool_items?.facial, body: rec?.tool_items?.body, muscle: rec?.tool_items?.muscle, airway: rec?.tool_items?.airway,
  },
  location: rec?.location ?? undefined,
  character: rec?.character ?? undefined,
  onset: rec?.onset ?? undefined,
  duration: rec?.duration ?? undefined,
  aggravating: rec?.aggravating ?? undefined,
  alleviating: rec?.alleviating ?? undefined,
  intervention: rec?.intervention ?? undefined,
  reassess_score: rec?.reassess_score ?? undefined,
  reassess_time: rec?.reassess_time ?? undefined,
  nurse_name: rec?.nurse_name || defaultNurse(),
});

/**
 * embedded = เปิดอยู่ในลิ้นชักของหน้าอื่น (เช่น ฟอร์มปรอท) ไม่มี Navbar/หัวหน้า และจัดสองคอลัมน์ตามความกว้างลิ้นชัก ไม่ใช่ความกว้างจอ
 * onSaved = แจ้งหน้าที่เปิดลิ้นชักให้โหลดใหม่หลังบันทึก/ลบ (กราฟความปวดในใบปรอทขึ้นทันที)
 * initialAt = เวลาเริ่มต้นของฟอร์ม (คลิกช่องเวลาในใบปรอท) ไม่ส่ง = เวลาปัจจุบัน · เวรคิดจากเวลานี้ให้ด้วย
 *   ถ้าช่องนั้นมีการประเมินอยู่แล้ว เปิดรายการล่าสุดของช่องมาให้แก้ทันที (ลงใหม่ได้จากปุ่ม "ลงรายการใหม่")
 */
export default function PainAssessment({ an, embedded = false, onSaved, initialAt }: { an: string; embedded?: boolean; onSaved?: () => void; initialAt?: Dayjs }) {
  const startAt = initialAt ?? dayjs();
  const [form] = Form.useForm();
  /** รายการที่กำลังแก้ (null = ลงรายการใหม่) */
  const [editing, setEditing] = useState<PainRecord | null>(null);
  const formTop = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<PainRecord[]>([]);
  const [rightTab, setRightTab] = useState('trend');
  const [liveScore, setLiveScore] = useState(0);
  const tool = Form.useWatch('assessment_tool', form) as string | undefined;
  const cpotVals = Form.useWatch('cpot', form) as CpotItems | undefined;
  const isCpot = tool === 'CPOT';
  const airwayMode = cpotVals?.airway_mode ?? 'ventilator';
  const cpotFilled = (['facial', 'body', 'muscle', 'airway'] as const).filter(k => typeof cpotVals?.[k] === 'number').length;
  const cpotTotal = (cpotVals?.facial ?? 0) + (cpotVals?.body ?? 0) + (cpotVals?.muscle ?? 0) + (cpotVals?.airway ?? 0);
  const cpotLv = cpotLevel(cpotTotal);
  const needsManagement = isCpot && cpotFilled === 4 && cpotTotal >= 3;

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/pain/${an}`, { headers });
      const rows: PainRecord[] = res.data?.success ? (res.data.data || []) : [];
      setRecords(rows);
      return rows;
    } catch (error) {
      // ไม่ใส่ข้อมูลตัวอย่างแทน เพราะบันทึกทางการพยาบาลต้องแยกออกว่าอันไหนของจริง
      console.error('Error fetching pain records:', error);
      setRecords([]);
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
        // เปิดจากช่องเวลาในใบปรอท: ช่องนั้นมีการประเมินแล้ว → เปิดรายการล่าสุดของช่องมาให้ดู/แก้
        // (ตั้งก่อน setLoading(false) ใน tick เดียวกัน ฟอร์มจึงขึ้นมาพร้อมค่าของรายการนั้นเลย)
        if (initialAt) {
          const hit = rows.filter(r => sameSlot(dayjs(r.record_datetime), initialAt))
            .sort((a, b) => dayjs(b.record_datetime).valueOf() - dayjs(a.record_datetime).valueOf())[0];
          if (hit) {
            setEditing(hit);
            setLiveScore(hit.assessment_tool === 'CPOT' ? 0 : hit.pain_score);
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

  /** เปิดรายการเดิมมาแก้ (จากช่องในใบปรอท การ์ดแนวโน้ม หรือตาราง) */
  const startEdit = (rec: PainRecord) => {
    setEditing(rec);
    form.resetFields();
    form.setFieldsValue(toFormValues(rec, startAt, true));
    setLiveScore(rec.assessment_tool === 'CPOT' ? 0 : rec.pain_score);
    formTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  /** กลับเป็นลงรายการใหม่ (คงเครื่องมือเดิมไว้ เวลาเป็นช่องที่คลิกหรือเวลาปัจจุบัน) */
  const startNew = (tool?: string) => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue(toFormValues(null, initialAt ?? dayjs(), !!initialAt, tool));
    setLiveScore(0);
  };
  const slotRecords = initialAt
    ? records.filter(r => sameSlot(dayjs(r.record_datetime), initialAt)).sort((a, b) => dayjs(a.record_datetime).valueOf() - dayjs(b.record_datetime).valueOf())
    : [];

  const onFinish = async (raw: unknown) => {
    setSaving(true);
    const values = raw as PainFormValues;
    const cpot = values.assessment_tool === 'CPOT' ? values.cpot : undefined;
    const score = cpot ? (cpot.facial ?? 0) + (cpot.body ?? 0) + (cpot.muscle ?? 0) + (cpot.airway ?? 0) : (values.pain_score ?? 0);
    const painLevel = cpot ? cpotLevel(score) : getPainLevel(score);

    try {
      const headers = getHeaders();
      const payload = {
        an, admission_list_id: patient?.admission_list_id,
        ward_code: patient?.ward || getUserProfile()?.ward_code || '',
        ward_name: patient?.wardName || getUserProfile()?.ward_name || '',
        staff_id: String(getUserProfile()?.staff_id || ''),
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        shift: values.shift || null,
        assessment_tool: values.assessment_tool || 'NRS',
        pain_score: score,
        pain_level: painLevel,
        tool_items: cpot ?? null,
        location: values.location || null,
        character: values.character || null,
        onset: values.onset || null,
        duration: values.duration || null,
        aggravating: values.aggravating || null,
        alleviating: values.alleviating || null,
        intervention: values.intervention || null,
        reassess_score: values.reassess_score ?? null,
        reassess_time: values.reassess_time || null,
        // คอลัมน์นี้เป็น NOT NULL — ถ้าผู้ใช้ลบชื่อออก ให้ย้อนกลับไปใช้ชื่อผู้ที่ล็อกอินอยู่
        nurse_name: values.nurse_name || (getUserProfile()?.fullname || getUserProfile()?.name) || '',
      };
      if (editing) await axios.put(`/api/v1/nursing-records/pain/${editing.id}`, payload, { headers });
      else await axios.post('/api/v1/nursing-records/pain', payload, { headers });
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: editing ? 'แก้ไขการประเมินสำเร็จ' : 'บันทึกการประเมินสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      startNew(values.assessment_tool || 'NRS');
      await fetchRecords();
      onSaved?.();
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      // แสดงเหตุผลจริงจาก server เพื่อให้แก้ที่ต้นเหตุได้ ไม่ใช่บอกแค่ว่าผิดพลาด
      const detail = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message
        : undefined;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: detail ?? 'เกิดข้อผิดพลาด', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/pain/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      if (editing?.id === id) startNew();
      await fetchRecords();
      onSaved?.();
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
      render: (v, r) => {
        const level = levelOfRecord(r);
        return <Tag color={painScaleColors[level]?.color} className="m-0 font-bold text-lg">{v}<span className="text-xs font-normal">/{maxOf(r.assessment_tool)}</span></Tag>;
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
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  return (
    <div className={embedded ? 'font-sans @container' : 'bg-slate-50 min-h-screen font-sans'}>
      {/*
        antd ไม่มี token สำหรับสีของแถบที่เลือกใน Segmented แบบรายตัวเลือก
        จึงกำหนดด้วย CSS โดยรับสีจากตัวแปร --pain-color ที่ตั้งไว้ที่ตัว Segmented
        จำกัดขอบเขตด้วย .pain-seg ไม่ให้กระทบ Segmented ตัวอื่นในระบบ
      */}
      <style>{`
        .pain-seg .ant-segmented-item-selected,
        .pain-seg .ant-segmented-thumb {
          background: var(--pain-color);
        }
        .pain-seg .ant-segmented-item { padding: 0; }
        .pain-seg .ant-segmented-item-label { padding-inline: 0; text-overflow: clip; }
      `}</style>
      {!embedded && <Navbar />}
      <div className={embedded ? '' : 'p-4 max-w-7xl mx-auto'}>
        {/* Header (ในลิ้นชักใช้หัวของลิ้นชักแทน) */}
        <div hidden={embedded} className="bg-linear-to-r from-[#004d45] via-[#006b5f] to-[#00796b] rounded-xl shadow-md mb-4 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 shrink-0 bg-white/20 rounded-xl flex items-center justify-center">
              <PiHeartbeatBold className="text-white text-xl" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white m-0 leading-snug">แบบประเมินความปวด (Pain Assessment)</h1>
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
              <div className={`rounded-lg px-4 py-1.5 text-center ${['severe', 'worst'].includes(levelOfRecord(latestRecord)) ? 'bg-red-500/30' : levelOfRecord(latestRecord) === 'moderate' ? 'bg-orange-400/30' : 'bg-green-500/30'}`}>
                <div className="text-white/70 text-xs">ล่าสุด</div>
                <div className="text-white font-bold text-lg">{latestRecord.pain_score}/{maxOf(latestRecord.assessment_tool)}{latestRecord.assessment_tool === 'CPOT' ? ' CPOT' : ''}</div>
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
              title={<span ref={formTop} className={`font-bold text-sm ${editing ? 'text-blue-700' : 'text-rose-600'}`}>{editing ? 'แก้ไขการประเมินความปวด' : 'ประเมินความปวด'}</span>}>
              {/* รายการในช่องเวลาที่คลิกมาจากใบปรอท — กดเพื่อเปิดดู/แก้ */}
              {slotRecords.length > 0 && (
                <div className="mb-2 rounded-md border border-gray-200 bg-gray-50 p-2">
                  <div className="text-xs font-semibold text-gray-600 mb-1">
                    ช่อง {String(Math.floor(initialAt!.hour() / 4) * 4).padStart(2, '0')}:00–{String(Math.floor(initialAt!.hour() / 4) * 4 + 3).padStart(2, '0')}:59 น. มี {slotRecords.length} รายการ (กดเพื่อดู/แก้)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {slotRecords.map(r => (
                      <Button key={r.id} size="small" type={editing?.id === r.id ? 'primary' : 'default'} onClick={() => startEdit(r)}>
                        {dayjs(r.record_datetime).format('HH:mm')} · {r.assessment_tool === 'CPOT' ? `CPOT ${r.pain_score}/8` : `${r.pain_score}/10`}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {editing && (
                <Alert type="info" showIcon className="mb-2!"
                  title={<span className="text-sm">กำลังแก้รายการ <b>{dayjs(editing.record_datetime).format('DD/MM HH:mm')} น.</b> · บันทึกจะทับรายการเดิม</span>}
                  description={<span className="text-xs text-gray-600">ประเมินครั้งใหม่ (เช่น ประเมินซ้ำรอบถัดไป) ให้กด ลงรายการใหม่</span>}
                  action={<Button size="small" icon={<PiPlusBold />} onClick={() => startNew(form.getFieldValue('assessment_tool'))}>ลงรายการใหม่</Button>} />
              )}
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={toFormValues(editing, startAt, !!initialAt)}
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

                <Form.Item label="เครื่องมือประเมิน" name="assessment_tool" rules={[{ required: true }]}
                  extra="บอกคะแนนเองได้ ใช้ self report (เชื่อถือได้มากกว่า) · บอกเองไม่ได้ ใช้ CPOT">
                  <Select>
                    <Select.OptGroup label="ผู้ป่วยบอกคะแนนความปวดได้ด้วยตัวเอง (Self report)">
                      <Option value="NRS">Numeric Rating Scale (NRS 0-10)</Option>
                      <Option value="Wong-Baker">Face scale (Wong-Baker FACES)</Option>
                      <Option value="VAS">Visual Analog Scale (VAS)</Option>
                    </Select.OptGroup>
                    <Select.OptGroup label="ผู้ป่วยบอกคะแนนเองไม่ได้ (สังเกตพฤติกรรม)">
                      <Option value="CPOT">CPOT (Critical-Care Pain Observation Tool 0-8)</Option>
                      <Option value="BPS">BPS (Behavioral Pain Scale)</Option>
                      <Option value="FLACC">FLACC (เด็กเล็ก)</Option>
                    </Select.OptGroup>
                  </Select>
                </Form.Item>

                {/* CPOT: 4 ด้าน ด้านละ 0-2 · ฟิลด์อยู่ในฟอร์มตลอด (hidden) ค่าไม่หายเมื่อสลับเครื่องมือไปมา */}
                <div hidden={!isCpot} className="bg-rose-50 rounded-lg px-3 pt-2 pb-2 mb-2 border border-rose-100 [&_.ant-form-item-label_label]:h-auto! [&_.ant-form-item-label_label]:whitespace-normal! [&_.ant-form-item-label_label]:leading-snug!">
                  <div className="text-xs text-rose-600 font-bold mb-1">CPOT · ประเมินจากพฤติกรรม 4 ด้าน ด้านละ 0-2</div>
                  {CPOT_ITEMS.map(it => (
                    <Form.Item key={it.key} name={['cpot', it.key]} label={it.title} extra={it.hint}
                      rules={isCpot ? [{ required: true, message: 'กรุณาให้คะแนนด้านนี้' }] : []}>
                      <Radio.Group className="score-options flex! flex-col gap-1">
                        {it.levels.map((t, i) => <Radio key={i} value={i}><b className="mr-1">{i}</b>{t}</Radio>)}
                      </Radio.Group>
                    </Form.Item>
                  ))}
                  <Form.Item name={['cpot', 'airway_mode']} label="ผู้ป่วยใส่ท่อช่วยหายใจหรือไม่ (เลือกหัวข้อของด้านที่ 4)">
                    <Segmented block options={[{ value: 'ventilator', label: 'ใส่ท่อช่วยหายใจ' }, { value: 'vocal', label: 'ไม่ได้ใส่ท่อ' }]} />
                  </Form.Item>
                  <Form.Item name={['cpot', 'airway']} label={CPOT_AIRWAY[airwayMode].title}
                    rules={isCpot ? [{ required: true, message: 'กรุณาให้คะแนนด้านนี้' }] : []}>
                    <Radio.Group className="score-options flex! flex-col gap-1">
                      {CPOT_AIRWAY[airwayMode].levels.map((t, i) => <Radio key={i} value={i}><b className="mr-1">{i}</b>{t}</Radio>)}
                    </Radio.Group>
                  </Form.Item>
                  <div className={`text-center mt-1 font-bold text-sm ${cpotFilled === 4 ? painScaleColors[cpotLv].text : 'text-gray-500'}`}>
                    {cpotFilled === 4 ? <>CPOT {cpotTotal}/8 · {cpotLevelLabel[cpotLv]}</> : <>ให้คะแนนแล้ว {cpotFilled}/4 ด้าน</>}
                  </div>
                </div>

                <div hidden={isCpot}>
                  {/* Pain Score Visual Selector */}
                  <div className="bg-rose-50 rounded-lg px-3 pt-2 pb-2 mb-2 border border-rose-100">
                    <div className="text-xs text-rose-600 font-bold mb-2">ระดับความปวด (Pain Score)</div>
                    <Form.Item name="pain_score" className="mb-0!">
                      <Segmented
                        block
                        size="large"
                        className="pain-seg"
                        options={painScoreOptions(liveScore)}
                        onChange={(v) => setLiveScore(Number(v))}
                        // ตัวเลื่อนที่เลือกอยู่เปลี่ยนสีตามระดับความปวด ผ่านตัวแปร CSS ด้านล่าง
                        style={{ '--pain-color': livePainCfg.border } as React.CSSProperties}
                      />
                    </Form.Item>
                    <div className={`text-center mt-2 font-bold text-sm ${livePainCfg.text}`}>
                      {painLevelLabel[livePainLevel]}
                    </div>
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
                  {needsManagement && (
                    <Alert type="warning" showIcon className="mb-2!" title="ความปวดระดับ moderate / severe ต้องได้รับการจัดการ แล้วประเมินซ้ำ" />
                  )}
                  <Form.Item label="การจัดการ/การพยาบาล" name="intervention"
                    rules={needsManagement ? [{ required: true, message: 'CPOT ตั้งแต่ 3 ต้องระบุการจัดการความปวด' }] : []}>
                    <TextArea rows={2} placeholder="เช่น ให้ยาแก้ปวด จัดท่า ประคบเย็น" />
                  </Form.Item>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="คะแนนหลัง Reassess" name="reassess_score">
                        <Select placeholder="คะแนน" allowClear>
                          {Array.from({ length: maxOf(tool) + 1 }, (_, s) => <Option key={s} value={s}>{s}</Option>)}
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

                {/* ปุ่มบันทึกติดล่างจอ ไม่ต้องเลื่อนหาท้ายฟอร์มยาว (สำคัญบนมือถือ) */}
                <div className="sticky bottom-0 z-10 -mx-3 px-3 pt-2 pb-3 bg-white border-t border-gray-100">
                  <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                    className="bg-rose-500 hover:bg-rose-600 w-full shadow-md" size="middle">
                    {editing ? 'บันทึกการแก้ไข' : 'บันทึกการประเมิน'}
                  </Button>
                </div>
              </Form>
            </Card>

            {/* Trend + Table - Right 3 cols */}
            <Card size="small" className={`shadow-sm rounded-xl border border-gray-100 [&_.ant-card-body]:p-0 ${embedded ? '@3xl:col-span-3' : 'lg:col-span-3'}`}>
              <Tabs activeKey={rightTab} onChange={setRightTab} type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-rose-500! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
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
                        {sortedRecords.length > 0 && (
                          <div className="bg-white border border-gray-100 rounded-xl p-4">
                            <div className="text-xs font-bold text-gray-500 mb-3">แนวโน้ม Pain Score</div>
                            <div className="flex items-end gap-1 h-32">
                              {[...sortedRecords].reverse().map((rec) => {
                                const heightPct = Math.max((rec.pain_score / maxOf(rec.assessment_tool)) * 100, 5);
                                const level = levelOfRecord(rec);
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
                          const level = levelOfRecord(rec);
                          const cfg = painScaleColors[level];
                          return (
                            <div key={rec.id} className={`bg-white border-l-4 rounded-xl p-4 border hover:shadow-md transition-shadow ${editing?.id === rec.id ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-100'}`}
                              style={{ borderLeftColor: cfg.border }}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Tag color={shiftColor[rec.shift || ''] || 'default'} className="m-0 text-xs">{rec.shift || '-'}</Tag>
                                  <span className="text-xs text-gray-400">{dayjs(rec.record_datetime).format('DD/MM/YYYY HH:mm')}</span>
                                  <Tag className="m-0 text-xs">{rec.assessment_tool}</Tag>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-3xl font-bold ${cfg.text}`}>{rec.pain_score}</span>
                                  <span className="text-gray-400">/{maxOf(rec.assessment_tool)}</span>
                                </div>
                              </div>

                              {rec.assessment_tool === 'CPOT' && rec.tool_items && (
                                <div className="text-xs text-gray-500 mb-2">
                                  สีหน้า {rec.tool_items.facial ?? '-'} · การเคลื่อนไหว {rec.tool_items.body ?? '-'} · กล้ามเนื้อ {rec.tool_items.muscle ?? '-'} · {rec.tool_items.airway_mode === 'vocal' ? 'การออกเสียง' : 'การยอมตามเครื่องช่วยหายใจ'} {rec.tool_items.airway ?? '-'}
                                </div>
                              )}
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
                                  <span className="font-bold">Reassess:</span> {rec.reassess_score}/{maxOf(rec.assessment_tool)} {rec.reassess_time ? `(${rec.reassess_time})` : ''}
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
