'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Col,
  ConfigProvider,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import type { DescriptionsProps } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import { getUserProfile } from '../../../lib/auth';
import { newRequestId } from '../../../lib/requestId';
import Swal from 'sweetalert2';
import { VscSave, VscCheck } from 'react-icons/vsc';
import {
  PiNotePencilBold,
  PiArrowLeftBold,
  PiClipboardTextBold,
  PiStethoscopeBold,
  PiChatCircleTextBold,
  PiMagnifyingGlassBold,
  PiListChecksBold,
  PiTargetBold,
  PiCheckCircleBold,
  PiClockCounterClockwiseBold,
  PiWarningCircleBold,
  PiSealCheckBold,
  PiPencilSimpleBold,
  PiTrashBold,
  PiLinkBold,
  PiTagBold,
  PiUserBold,
} from 'react-icons/pi';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;

const BRAND = '#006b5f';

// ---------------- ชนิดข้อมูล ----------------

interface PatientInfo {
  hn?: string;
  an?: string;
  ptname?: string;
  bedno?: string;
  ward?: string;
  ward_name?: string;
  doctor_name?: string;
  regdate?: string;
}

interface NursingNote {
  id: number;
  an: string;
  record_datetime: string;
  shift?: string;
  focus?: string;
  note_type?: string;
  author_role?: string;
  care_plan_id?: number | null;
  care_plan_diagnosis?: string | null;
  nanda_code?: string | null;
  nanda_label?: string | null;
  nic_codes?: string | null;
  noc_codes?: string | null;
  subjective?: string;
  objective?: string;
  assessment?: string;
  intervention?: string;
  plan?: string;
  evaluation?: string;
  nurse_name?: string;
  cosigned_by?: string | null;
  cosigned_at?: string | null;
  revision_no?: number;
  is_late_entry?: boolean;
  /** draft = ยังไม่เข้าเวชระเบียน จนกว่าพยาบาลวิชาชีพจะอนุมัติ */
  status?: 'draft' | 'approved';
  is_draft?: boolean;
  by_trainee?: boolean;
  entered_by_trainee?: string | null;
  trainee_institute?: string | null;
  created_at?: string;
}

interface TermItem {
  code: string;
  domain: string;
  label_en: string;
  label_th: string;
}

interface CarePlan {
  id: number;
  nursing_diagnosis: string;
  goal?: string;
  priority?: string;
  status?: string;
}

interface Revision {
  id: number;
  revision_no: number;
  action: string;
  reason: string;
  changed_by: string;
  changed_at: string;
  snapshot: Record<string, unknown>;
}

// ---------------- กรอบการบันทึกมาตรฐาน ----------------

interface FrameworkField {
  /** ชื่อคอลัมน์ที่เก็บจริง คงเดิมทุกกรอบ เพื่อให้ query ข้ามกรอบได้ */
  name: keyof NursingNote;
  letter: string;
  label: string;
  hint: string;
  icon: React.ReactNode;
  rows: number;
}

const F = {
  subjective: {
    name: 'subjective', letter: 'S', label: 'สิ่งที่ผู้ป่วยบอก (Subjective)',
    hint: 'คำพูด ความรู้สึก อาการที่ผู้ป่วยหรือญาติเล่า', icon: <PiChatCircleTextBold />, rows: 2,
  },
  objective: {
    name: 'objective', letter: 'O', label: 'สิ่งที่ตรวจพบ (Objective)',
    hint: 'ค่าที่วัดได้ สิ่งที่สังเกตเห็น ผลตรวจ', icon: <PiStethoscopeBold />, rows: 2,
  },
  assessment: {
    name: 'assessment', letter: 'A', label: 'การวินิจฉัย/วิเคราะห์ (Assessment)',
    hint: 'ข้อวินิจฉัยทางการพยาบาลและเหตุผลที่สรุปเช่นนั้น', icon: <PiMagnifyingGlassBold />, rows: 2,
  },
  plan: {
    name: 'plan', letter: 'P', label: 'แผนการพยาบาล (Plan)',
    hint: 'สิ่งที่วางแผนจะทำต่อ และเป้าหมายที่ต้องการ', icon: <PiTargetBold />, rows: 2,
  },
  intervention: {
    name: 'intervention', letter: 'I', label: 'การปฏิบัติการพยาบาล (Intervention)',
    hint: 'กิจกรรมที่ลงมือทำจริง ระบุขนาดยา เวลา และวิธี', icon: <PiListChecksBold />, rows: 3,
  },
  evaluation: {
    name: 'evaluation', letter: 'E', label: 'ผลการประเมิน (Evaluation)',
    hint: 'ผู้ป่วยตอบสนองอย่างไรหลังการพยาบาล เทียบกับเป้าหมาย', icon: <PiCheckCircleBold />, rows: 2,
  },
} as const satisfies Record<string, FrameworkField>;

interface Framework {
  value: string;
  label: string;
  full: string;
  desc: string;
  color: string;
  fields: FrameworkField[];
  /** ปรับตัวอักษรกำกับให้ตรงศัพท์ของกรอบนั้น เช่น DAR เรียก Intervention ว่า Action */
  rename?: Partial<Record<keyof NursingNote, { letter: string; label: string }>>;
}

const FRAMEWORKS: Framework[] = [
  {
    value: 'DAR', label: 'DAR', full: 'Focus Charting (DAR)',
    desc: 'Data → Action → Response เหมาะกับการบันทึกประจำเวร กระชับและค้นหาง่าย',
    color: '#0891b2',
    fields: [F.subjective, F.objective, F.intervention, F.evaluation],
    rename: {
      subjective: { letter: 'D', label: 'ข้อมูล — สิ่งที่ผู้ป่วยบอก (Data: Subjective)' },
      objective: { letter: 'D', label: 'ข้อมูล — สิ่งที่ตรวจพบ (Data: Objective)' },
      intervention: { letter: 'A', label: 'การปฏิบัติการพยาบาล (Action)' },
      evaluation: { letter: 'R', label: 'การตอบสนองของผู้ป่วย (Response)' },
    },
  },
  {
    value: 'SOAPIE', label: 'SOAPIE', full: 'SOAPIE',
    desc: 'ครบทั้ง 6 ขั้น เหมาะกับผู้ป่วยซับซ้อนและการทำงานร่วมกับแพทย์',
    color: '#7c3aed',
    fields: [F.subjective, F.objective, F.assessment, F.plan, F.intervention, F.evaluation],
  },
  {
    value: 'SOAP', label: 'SOAP', full: 'SOAP',
    desc: 'ใช้ร่วมกับทีมสหวิชาชีพ ไม่แยกการปฏิบัติและผลลัพธ์ออกมา',
    color: '#2563eb',
    fields: [F.subjective, F.objective, F.assessment, F.plan],
  },
  {
    value: 'PIE', label: 'PIE', full: 'PIE',
    desc: 'Problem → Intervention → Evaluation ลดการเขียนซ้ำกับแผนการพยาบาล',
    color: '#ea580c',
    fields: [F.assessment, F.intervention, F.evaluation],
    rename: {
      assessment: { letter: 'P', label: 'ปัญหาทางการพยาบาล (Problem)' },
    },
  },
];

const frameworkOf = (v?: string) => FRAMEWORKS.find(f => f.value === v) ?? FRAMEWORKS[0];

/** ชื่อช่องเนื้อหาของแต่ละกรอบ ใช้นับว่ากรอกไปกี่ช่องตอนขึ้นกล่องยืนยัน */
const FRAMEWORK_BY_TYPE: Record<string, string[]> = Object.fromEntries(
  FRAMEWORKS.map(fw => [fw.value, fw.fields.map(f => f.name)])
);

/** ปิดปุ่มบันทึกกี่วินาทีหลังบันทึกสำเร็จ กันกดซ้ำเพราะไม่แน่ใจว่าเข้าไปแล้วหรือยัง */
const SAVE_COOLDOWN_SECONDS = 3;

/**
 * การแสดงข้อความที่พยาบาลพิมพ์เอง
 * pre-wrap คงบรรทัดใหม่ที่พิมพ์ไว้ (บันทึกทางการพยาบาลมักเขียนเป็นข้อๆ ถ้ายุบเป็นบรรทัดเดียวจะอ่านยาก)
 * overflowWrap: anywhere กันคำยาวไม่มีเว้นวรรค เช่น รหัสยาหรือข้อความที่วางมา ทะลุกรอบการ์ด
 */
const WRAP: React.CSSProperties = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };

/**
 * บทบาทมาจากตำแหน่งจริงใน core_kon ไม่ใช่ที่ผู้ใช้เลือก
 * ต้องให้ผลตรงกับ roleClassOf ฝั่ง backend (src/utils/nursingRecord.ts)
 */
const AUTHOR_ROLES = [
  { value: 'professional_nurse', label: 'พยาบาลวิชาชีพ', color: '#16a34a' },
  { value: 'practical_nurse', label: 'พยาบาลเทคนิค', color: '#0891b2' },
  { value: 'assistant', label: 'ผู้ช่วยพยาบาล', color: '#ca8a04' },
  { value: 'other', label: 'ตำแหน่งอื่น', color: '#64748b' },
];
const roleOf = (v?: string | null) => AUTHOR_ROLES.find(r => r.value === v);

const ROLE_BY_POSITION: Record<string, string> = {
  'พยาบาลวิชาชีพ': 'professional_nurse',
  'พยาบาลเทคนิค': 'practical_nurse',
  'ผู้ช่วยพยาบาล': 'assistant',
  'พนักงานช่วยการพยาบาล': 'assistant',
  'พนักงานช่วยเหลือคนไข้': 'assistant',
};
const roleClassOf = (position?: string) => ROLE_BY_POSITION[String(position ?? '').trim()] ?? 'other';

const SHIFTS = [
  { value: 'ดึก', label: 'ดึก 00-08', color: 'purple' },
  { value: 'เช้า', label: 'เช้า 08-16', color: 'blue' },
  { value: 'บ่าย', label: 'บ่าย 16-24', color: 'orange' },
];
const shiftColor = (v?: string) => SHIFTS.find(s => s.value === v)?.color ?? 'default';

/** เวรจากเวลา ต้องให้ผลตรงกับ shiftOfTime ฝั่ง backend (src/utils/nursingRecord.ts) */
const shiftOfTime = (d: dayjs.Dayjs): string => {
  const h = d.hour();
  return h < 8 ? 'ดึก' : h < 16 ? 'เช้า' : 'บ่าย';
};

/** รวมรหัสหลายตัวที่เก็บเป็นข้อความคั่นจุลภาค กลับเป็น array ของ Select */
const toCodes = (v?: string | null) =>
  v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined;
const joinCodes = (v: unknown) =>
  Array.isArray(v) ? v.join(', ') || null : (v as string) || null;

/** จัดกลุ่มตาม domain ให้ Select แสดงเป็นหมวด ค้นหาง่ายกว่ารายการยาว 45 บรรทัด */
const groupByDomain = (items: TermItem[]) => {
  const map = new Map<string, TermItem[]>();
  for (const it of items) {
    if (!map.has(it.domain)) map.set(it.domain, []);
    map.get(it.domain)!.push(it);
  }
  return [...map.entries()].map(([domain, options]) => ({
    label: domain,
    title: domain,
    options: options.map(o => ({
      value: o.code,
      label: `${o.code} · ${o.label_th}`,
      // ให้ค้นได้ทั้งรหัส ไทย และอังกฤษ
      search: `${o.code} ${o.label_th} ${o.label_en}`,
    })),
  }));
};

// ---------------- ส่วนประกอบย่อย ----------------

function SectionCard({
  icon, title, accentColor, extra, children,
}: {
  icon: React.ReactNode; title: string; accentColor: string;
  extra?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card
      size="small"
      variant="outlined"
      styles={{
        header: {
          background: `linear-gradient(90deg, ${accentColor}33, ${accentColor}14)`,
          borderBottom: `1px solid ${accentColor}59`,
        },
      }}
      style={{ borderLeft: `4px solid ${accentColor}` }}
      title={
        <Space size={8}>
          <Avatar size={26} shape="square" style={{ background: accentColor }} icon={icon} />
          <Text strong style={{ color: accentColor }}>{title}</Text>
        </Space>
      }
      extra={extra}
    >
      {children}
    </Card>
  );
}

/** ป้ายบอกสถานะเชิงคุณภาพของบันทึกหนึ่งฉบับ */
function NoteBadges({ note }: { note: NursingNote }) {
  const role = roleOf(note.author_role);
  return (
    <Space size={[4, 4]} wrap>
      <Tag color={shiftColor(note.shift)} style={{ margin: 0 }}>{note.shift ?? '-'}</Tag>
      <Tag color={frameworkOf(note.note_type).color} style={{ margin: 0, color: '#fff', border: 'none' }}>
        {note.note_type}
      </Tag>
      {role && <Tag style={{ margin: 0, borderColor: role.color, color: role.color }}>{role.label}</Tag>}
      {note.is_late_entry && (
        <Tooltip title="บันทึกหลังเวลาเกิดเหตุการณ์เกิน 24 ชั่วโมง">
          <Tag icon={<PiClockCounterClockwiseBold />} color="warning" style={{ margin: 0 }}>
            บันทึกย้อนหลัง
          </Tag>
        </Tooltip>
      )}
      {(note.revision_no ?? 0) > 0 && (
        <Tag icon={<PiPencilSimpleBold />} color="processing" style={{ margin: 0 }}>
          แก้ไข {note.revision_no} ครั้ง
        </Tag>
      )}
      {note.is_draft && (
        <Tag icon={<PiWarningCircleBold />} color="error" style={{ margin: 0 }}>
          ร่าง · ยังไม่เข้าเวชระเบียน
        </Tag>
      )}
      {note.entered_by_trainee && (
        <Tooltip title={note.trainee_institute ?? undefined}>
          <Tag color="orange" style={{ margin: 0 }}>
            นศ. {note.entered_by_trainee} กรอก
          </Tag>
        </Tooltip>
      )}
      {note.cosigned_at && (
        <Tooltip title={`ลงนามเมื่อ ${dayjs(note.cosigned_at).format('DD/MM/YYYY HH:mm')}`}>
          <Tag icon={<PiSealCheckBold />} color="success" style={{ margin: 0 }}>
            {note.cosigned_by}
          </Tag>
        </Tooltip>
      )}
    </Space>
  );
}

// ---------------- หน้าหลัก ----------------

function ProgressNotesInner({ an }: { an: string }) {
  const { modal, message } = App.useApp();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // อ่านครั้งเดียว ใช้แค่แสดงผล ฝั่ง server ยึดตาม token เสมอ
  const profile = useMemo(() => getUserProfile(), []);
  const requestId = useRef(newRequestId());
  const [byTrainee, setByTrainee] = useState(false);
  const myRole = roleOf(roleClassOf(profile?.position_name));
  const canApprove = myRole?.value === 'professional_nurse';
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [notes, setNotes] = useState<NursingNote[]>([]);
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [terms, setTerms] = useState<{ nanda: TermItem[]; nic: TermItem[]; noc: TermItem[] }>({
    nanda: [], nic: [], noc: [],
  });
  const [editing, setEditing] = useState<NursingNote | null>(null);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [revisionOf, setRevisionOf] = useState<NursingNote | null>(null);

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await axios.get(`/api/v1/nursing-records/nursing/${an}`, { headers: getHeaders() });
      if (res.data?.success) setNotes(res.data.data ?? []);
    } catch (error) {
      // ไม่ใส่ข้อมูลตัวอย่างแทน เพราะบันทึกทางการพยาบาลต้องแยกออกว่าอันไหนของจริง
      console.error('Error fetching progress notes:', error);
      setNotes([]);
    }
  }, [an, getHeaders]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const headers = getHeaders();

      try {
        const res = await axios.post('/api/v1/patients/patient-by-an', { an }, { headers });
        const raw = res.data?.data;
        setPatient((Array.isArray(raw) ? raw[0] : raw) ?? null);
      } catch (error) {
        console.error('Error fetching patient:', error);
      }

      try {
        const res = await axios.get('/api/v1/nursing-records/terminology', { headers });
        if (res.data?.success) setTerms(res.data.data);
      } catch (error) {
        console.error('Error fetching terminology:', error);
      }

      try {
        const res = await axios.get(`/api/v1/nursing-records/care-plans/${an}`, { headers });
        if (res.data?.success) setCarePlans(res.data.data ?? []);
      } catch {
        setCarePlans([]);
      }

      await fetchNotes();
      setLoading(false);
    };
    fetchAll();
  }, [an, getHeaders, fetchNotes]);

  // นับถอยหลัง cooldown ทีละวินาที เคลียร์เองเมื่อออกจากหน้า
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resetForm = useCallback(() => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      record_datetime: dayjs(),
      note_type: 'DAR',
    });
    setByTrainee(false);
  }, [form]);

  useEffect(() => {
    if (!loading) resetForm();
  }, [loading, resetForm]);

  const watched = Form.useWatch([], form) as Record<string, unknown> | undefined;
  const framework = frameworkOf(watched?.note_type as string);
  // บันทึกจะเป็นร่างเมื่อนักศึกษากรอก หรือผู้บันทึกไม่ใช่พยาบาลวิชาชีพ/เทคนิค
  const willBeDraft =
    byTrainee || myRole?.value === 'assistant' || myRole?.value === 'other';
  const derivedShift = shiftOfTime(
    watched?.record_datetime ? dayjs(watched.record_datetime as string) : dayjs()
  );

  const nandaOptions = useMemo(() => groupByDomain(terms.nanda), [terms.nanda]);
  const nicOptions = useMemo(() => groupByDomain(terms.nic), [terms.nic]);
  const nocOptions = useMemo(() => groupByDomain(terms.noc), [terms.noc]);

  /** เลือกข้อวินิจฉัยแล้วเติมชื่อไทยให้อัตโนมัติ จะได้อ่านรายงานย้อนหลังได้แม้รหัสถูกปิดใช้งาน */
  const onNandaChange = (code?: string) => {
    const hit = terms.nanda.find(n => n.code === code);
    form.setFieldValue('nanda_label', hit?.label_th ?? null);
  };

  const startEdit = (note: NursingNote) => {
    setEditing(note);
    form.setFieldsValue({
      ...note,
      record_datetime: note.record_datetime ? dayjs(note.record_datetime) : dayjs(),
      nic_codes: toCodes(note.nic_codes),
      noc_codes: toCodes(note.noc_codes),
      amend_reason: undefined,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ไม่ส่ง nurse_name / staff_id — server ดึงจาก token เอง
  const buildPayload = (values: Record<string, unknown>) => ({
    ...values,
    an,
    ward_code: patient?.ward || profile?.ward_code || '',
    ward_name: patient?.ward_name || profile?.ward_name || '',
    request_id: requestId.current,
    entered_by_trainee: byTrainee ? values.entered_by_trainee : null,
    trainee_institute: byTrainee ? values.trainee_institute : null,
    record_datetime: values.record_datetime
      ? dayjs(values.record_datetime as string).format('YYYY-MM-DD HH:mm:ss')
      : dayjs().format('YYYY-MM-DD HH:mm:ss'),
    nic_codes: joinCodes(values.nic_codes),
    noc_codes: joinCodes(values.noc_codes),
  });

  /** สรุปสิ่งที่กำลังจะบันทึกให้ทวนก่อน — เวชระเบียนแก้แล้วต้องมีเหตุผลกำกับตลอดไป */
  const confirmBeforeSave = async (values: Record<string, unknown>): Promise<boolean> => {
    const noteType = String(values.note_type ?? 'DAR');
    const filled = (FRAMEWORK_BY_TYPE[noteType] ?? [])
      .filter(f => String(values[f] ?? '').trim() !== '').length;
    const at = values.record_datetime
      ? dayjs(values.record_datetime as string).format('DD/MM/YYYY HH:mm')
      : dayjs().format('DD/MM/YYYY HH:mm');

    const res = await Swal.fire({
      icon: 'question',
      title: editing ? 'ยืนยันการแก้ไขบันทึก' : 'ยืนยันการบันทึก',
      html: `<div style="font-size:14px;text-align:left;line-height:1.8">
        <b>กรอบ:</b> ${noteType} · กรอกแล้ว ${filled} ช่อง<br/>
        <b>เวลาเหตุการณ์:</b> ${at}<br/>
        <b>ผู้บันทึก:</b> ${profile?.name ?? '-'}
        ${editing ? '<br/><span style="color:#b45309">ระบบจะเก็บข้อความฉบับเดิมไว้ในประวัติการแก้ไข</span>' : ''}
      </div>`,
      showCancelButton: true,
      confirmButtonText: editing ? 'ยืนยันแก้ไข' : 'ยืนยันบันทึก',
      cancelButtonText: 'กลับไปแก้ไข',
      confirmButtonColor: BRAND,
      reverseButtons: true,
    });
    return res.isConfirmed;
  };

  const onFinish = async (raw: unknown) => {
    if (saving || cooldown > 0) return;   // กันกดซ้ำก่อนปุ่มเข้าสถานะ loading
    const values = raw as Record<string, unknown>;

    if (!(await confirmBeforeSave(values))) return;

    setSaving(true);
    try {
      const headers = getHeaders();
      const payload = buildPayload(values);

      const res = editing
        ? await axios.put(`/api/v1/nursing-records/nursing/${editing.id}`, payload, { headers })
        : await axios.post('/api/v1/nursing-records/nursing', payload, { headers });

      setCooldown(SAVE_COOLDOWN_SECONDS);
      message[res.data?.duplicate ? 'info' : 'success'](res.data?.message ?? 'บันทึกเรียบร้อยแล้ว');
      // ขึ้นใบใหม่ การกรอกครั้งถัดไปคือคนละรายการ
      requestId.current = newRequestId();
      resetForm();
      await fetchNotes();
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const detail = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message
        : undefined;
      modal.error({
        title: `บันทึกไม่สำเร็จ${status ? ` (${status})` : ''}`,
        content: detail ?? 'เกิดข้อผิดพลาดในการบันทึก',
        okText: 'ตกลง',
        centered: true,
      });
    } finally {
      setSaving(false);
    }
  };

  /** ยกเลิกบันทึก — เวชระเบียนต้องมีเหตุผลกำกับเสมอ */
  const askCancelNote = (note: NursingNote) => {
    let reason = '';
    modal.confirm({
      title: 'ยกเลิกบันทึกฉบับนี้',
      centered: true,
      okText: 'ยืนยันยกเลิกบันทึก',
      okButtonProps: { danger: true },
      cancelText: 'ไม่ยกเลิก',
      content: (
        <div>
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            ระบบจะไม่ลบข้อมูลทิ้ง แต่เก็บไว้ในประวัติการแก้ไขพร้อมเหตุผล ตามหลักการของเวชระเบียน
          </Paragraph>
          <TextArea
            rows={3}
            placeholder="เหตุผลในการยกเลิก เช่น บันทึกซ้ำกับฉบับเวรเช้า (อย่างน้อย 5 ตัวอักษร)"
            onChange={e => { reason = e.target.value; }}
          />
        </div>
      ),
      onOk: async () => {
        try {
          const res = await axios.delete(
            `/api/v1/nursing-records/nursing/${note.id}?reason=${encodeURIComponent(reason)}`,
            { headers: getHeaders() }
          );
          message.success(res.data?.message ?? 'ยกเลิกเรียบร้อยแล้ว');
          await fetchNotes();
        } catch (error) {
          const detail = axios.isAxiosError(error)
            ? (error.response?.data as { message?: string })?.message
            : undefined;
          message.error(detail ?? 'ยกเลิกไม่สำเร็จ');
          throw error;
        }
      },
    });
  };

  const askApprove = (note: NursingNote) => {
    modal.confirm({
      title: 'อนุมัติบันทึกเข้าเวชระเบียน',
      centered: true,
      okText: 'อนุมัติ',
      cancelText: 'ยกเลิก',
      content: (
        <div>
          <Paragraph type="secondary" style={{ fontSize: 12 }}>
            บันทึกนี้ยังเป็นร่าง อนุมัติแล้วจะเข้าเวชระเบียนและแก้ไขต้องมีเหตุผลกำกับ
          </Paragraph>
          {/* ลายเซ็นต้องเป็นของคนที่เซ็นจริง จึงใช้ชื่อจากบัญชีที่ล็อกอิน พิมพ์แทนกันไม่ได้ */}
          <Flex align="center" gap={8} style={{
            padding: '8px 12px', borderRadius: 6,
            background: '#f8fafc', border: '1px solid #e2e8f0',
          }}>
            <PiSealCheckBold style={{ color: BRAND, flexShrink: 0 }} />
            <Text strong>{profile?.name ?? 'ไม่พบบัญชีผู้ใช้'}</Text>
            {profile?.position_name && (
              <Text type="secondary" style={{ fontSize: 12 }}>· {profile.position_name}</Text>
            )}
          </Flex>
          <Paragraph type="secondary" style={{ fontSize: 11, marginTop: 8, marginBottom: 0 }}>
            ระบบจะบันทึกชื่อนี้เป็นผู้ลงนามพร้อมวันเวลา
          </Paragraph>
        </div>
      ),
      onOk: async () => {
        try {
          await axios.post(
            `/api/v1/nursing-records/nursing-approve/${note.id}`,
            {},
            { headers: getHeaders() }
          );
          message.success('อนุมัติเรียบร้อยแล้ว');
          await fetchNotes();
        } catch (error) {
          const detail = axios.isAxiosError(error)
            ? (error.response?.data as { message?: string })?.message
            : undefined;
          message.error(detail ?? 'อนุมัติไม่สำเร็จ');
          throw error;
        }
      },
    });
  };

  const openRevisions = async (note: NursingNote) => {
    setRevisionOf(note);
    setRevisions(null);
    try {
      const res = await axios.get(`/api/v1/nursing-records/nursing-revisions/${note.id}`, {
        headers: getHeaders(),
      });
      setRevisions(res.data?.data ?? []);
    } catch {
      setRevisions([]);
    }
  };

  const patientName = patient?.ptname ?? '-';
  const headerItems: DescriptionsProps['items'] = [
    { key: 'hn', label: 'HN', children: patient?.hn ?? '-' },
    { key: 'an', label: 'AN', children: an },
    { key: 'bed', label: 'เตียง', children: patient?.bedno ?? '-' },
    { key: 'ward', label: 'หอผู้ป่วย', children: patient?.ward_name ?? patient?.ward ?? '-' },
    { key: 'doctor', label: 'แพทย์', children: patient?.doctor_name ?? '-' },
    {
      key: 'admit', label: 'วันที่รับไว้',
      children: patient?.regdate ? dayjs(patient.regdate).format('DD/MM/YYYY HH:mm') : '-',
    },
  ];

  const pendingApproval = notes.filter(n => n.is_draft).length;

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} className="note-form">
      <style>{`
        .note-form .ant-form-item-label > label { font-weight: 600; }
      `}</style>

      {/* ── หัวเรื่อง + ข้อมูลผู้ป่วย ── */}
      <Card
        size="small"
        variant="borderless"
        style={{ background: `linear-gradient(90deg, ${BRAND}, #00897b)`, marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Flex align="center" justify="space-between" gap={16} wrap>
          <Space size={12} align="center">
            <Avatar size={40} shape="square" style={{ background: 'rgba(255,255,255,.2)' }} icon={<PiNotePencilBold />} />
            <div>
              <Title level={5} style={{ color: '#fff', margin: 0 }}>
                บันทึกทางการพยาบาล (Nursing Progress Notes)
              </Title>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{patientName}</Text>
            </div>
          </Space>
          <Button icon={<PiArrowLeftBold />} onClick={() => window.history.back()} ghost>
            ย้อนกลับ
          </Button>
        </Flex>

        <Divider style={{ margin: '10px 0', borderColor: 'rgba(255,255,255,.25)' }} />

        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2, md: 3, lg: 6 }}
          items={headerItems}
          styles={{
            label: { color: 'rgba(255,255,255,.65)', fontSize: 12 },
            content: { color: '#fff', fontSize: 12, fontWeight: 500 },
          }}
        />
      </Card>

      {loading ? (
        <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
      ) : (
        <Row gutter={[16, 16]}>
          {/* ── ฟอร์มบันทึก ── */}
          <Col xs={24} xl={14}>
            <Flex vertical gap={16}>
              {editing && (
                <Alert
                  type="warning"
                  showIcon
                  title={`กำลังแก้ไขบันทึกของวันที่ ${dayjs(editing.record_datetime).format('DD/MM/YYYY HH:mm')}`}
                  description="ระบบจะเก็บข้อความฉบับก่อนแก้ไว้ในประวัติ และต้องระบุเหตุผลก่อนบันทึก"
                  action={<Button size="small" onClick={resetForm}>ยกเลิกการแก้ไข</Button>}
                />
              )}

              <SectionCard
                icon={<PiClipboardTextBold />}
                title="กรอบการบันทึกและผู้บันทึก"
                accentColor={framework.color}
                extra={<Text type="secondary" style={{ fontSize: 12 }}>{framework.full}</Text>}
              >
                <Form.Item name="note_type" style={{ marginBottom: 8 }}>
                  <Segmented
                    block
                    options={FRAMEWORKS.map(f => ({
                      value: f.value,
                      label: (
                        <span style={{
                          fontWeight: watched?.note_type === f.value ? 700 : 500,
                          color: watched?.note_type === f.value ? f.color : undefined,
                        }}>
                          {f.label}
                        </span>
                      ),
                    }))}
                    style={{ borderColor: framework.color }}
                  />
                </Form.Item>
                <Text type="secondary" style={{ fontSize: 12 }}>{framework.desc}</Text>

                {/* เวลา ผู้บันทึก และระดับผู้บันทึก คือข้อมูลกำกับของบันทึกฉบับนี้
                    อยู่การ์ดเดียวกันจะเห็นพร้อมกันว่า "ใคร บันทึกเมื่อไร ในฐานะอะไร" */}
                <Row gutter={12} style={{ marginTop: 12 }}>
                  <Col xs={24} sm={9}>
                    {/* ไม่มีช่องเลือกเวรแล้ว เวรเป็นผลของเวลาที่กรอก ให้เลือกเองมีแต่จะขัดกันเอง
                        ระบบคำนวณให้และแสดงกำกับไว้ข้างล่างให้เห็นว่าจะบันทึกเป็นเวรอะไร */}
                    <Form.Item
                      label="วันเวลาที่เกิดเหตุการณ์"
                      name="record_datetime"
                      rules={[{ required: true, message: 'กรุณาระบุ' }]}
                      extra={
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          บันทึกเป็น{' '}
                          <Text strong style={{ fontSize: 11 }}>เวร{derivedShift}</Text>
                        </Text>
                      }
                    >
                      <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={9}>
                    {/* ผู้บันทึกมาจากบัญชีที่เข้าสู่ระบบ แก้ไม่ได้ ฝั่ง server ก็ยึดตาม token
                        ไม่ใช่ค่าที่ส่งมาจากหน้าจอ เพราะเป็นข้อมูลที่ใช้อ้างอิงว่าใครลงบันทึก */}
                    <Form.Item
                      label="ผู้บันทึก"
                      colon={false}
                      extra={
                        <Text type="secondary" style={{ fontSize: 11 }}>จากบัญชีที่เข้าสู่ระบบ</Text>
                      }
                    >
                      <Flex align="center" gap={6} style={{
                        height: 32, padding: '0 11px', borderRadius: 6,
                        background: '#f8fafc', border: '1px solid #e2e8f0',
                      }}>
                        <PiUserBold style={{ color: '#94a3b8', flexShrink: 0 }} />
                        <Text strong style={{ fontSize: 13, ...WRAP }} ellipsis={{ tooltip: profile?.name }}>
                          {profile?.name ?? 'ไม่พบบัญชีผู้ใช้'}
                        </Text>
                      </Flex>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={6}>
                    {/* บทบาทมาจากตำแหน่งจริงในระบบบุคลากร เลือกเองไม่ได้
                        ไม่งั้นผู้ช่วยพยาบาลเลือกเป็นวิชาชีพแล้วเลี่ยงการตรวจสอบได้ */}
                    <Form.Item label="ในฐานะ" colon={false}>
                      <Flex align="center" style={{ height: 32 }}>
                        <Tag color={myRole?.color} style={{ margin: 0, color: '#fff', border: 'none' }}>
                          {myRole?.label ?? profile?.position_name ?? '-'}
                        </Tag>
                      </Flex>
                    </Form.Item>
                  </Col>
                </Row>

                {/* นักศึกษาไม่มีบัญชีของตัวเอง จึงกรอกผ่านบัญชีพยาบาลที่ควบคุมอยู่
                    ติ๊กช่องนี้แล้วบันทึกจะเป็น "ร่าง" จนกว่าพยาบาลวิชาชีพจะอ่านทวนแล้วอนุมัติ */}
                <Form.Item style={{ marginBottom: byTrainee ? 8 : 0 }}>
                  <Flex align="center" gap={8}>
                    <Switch size="small" checked={byTrainee} onChange={setByTrainee} />
                    <Text style={{ fontSize: 13 }}>นักศึกษาพยาบาลเป็นผู้กรอกข้อมูลนี้</Text>
                    {byTrainee && <Tag color="orange" style={{ margin: 0 }}>บันทึกเป็นร่าง รออนุมัติ</Tag>}
                  </Flex>
                </Form.Item>
                {byTrainee && (
                  <Row gutter={12}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label="ชื่อนักศึกษาผู้กรอก"
                        name="entered_by_trainee"
                        rules={[{ required: true, min: 3, message: 'กรุณาระบุชื่อ-สกุลนักศึกษา' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="ชื่อ-สกุล" maxLength={100} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="สถาบัน" name="trainee_institute" style={{ marginBottom: 0 }}>
                        <Input placeholder="เช่น วิทยาลัยพยาบาลบรมราชชนนี" maxLength={150} />
                      </Form.Item>
                    </Col>
                  </Row>
                )}

                {editing && (
                  <Form.Item
                    label="เหตุผลในการแก้ไข"
                    name="amend_reason"
                    rules={[{ required: true, min: 5, message: 'ระบุเหตุผลอย่างน้อย 5 ตัวอักษร' }]}
                    extra={<Text type="secondary" style={{ fontSize: 11 }}>
                      เทียบเท่าการขีดฆ่าแล้วเซ็นกำกับในเวชระเบียนกระดาษ ข้อความเดิมจะถูกเก็บไว้
                    </Text>}
                    style={{ marginBottom: 0 }}
                  >
                    <TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="เช่น พิมพ์คะแนนความปวดผิด ที่ถูกคือ 8/10" />
                  </Form.Item>
                )}

                {willBeDraft && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 4 }}
                    title="บันทึกนี้จะเป็นร่าง ยังไม่เข้าเวชระเบียน"
                    description={
                      <span style={{ fontSize: 12 }}>
                        {byTrainee
                          ? 'พยาบาลวิชาชีพต้องอ่านทวนสิ่งที่นักศึกษากรอกแล้วกดอนุมัติ จึงจะนับเป็นเวชระเบียน'
                          : 'ตำแหน่งของบัญชีนี้ต้องมีพยาบาลวิชาชีพอนุมัติก่อน จึงจะนับเป็นเวชระเบียน'}
                      </span>
                    }
                  />
                )}
              </SectionCard>

              {/* ── เชื่อมกับแผนการพยาบาลและภาษามาตรฐาน ── */}
              <SectionCard icon={<PiLinkBold />} title="เชื่อมกับแผนการพยาบาลและรหัสมาตรฐาน" accentColor="#0d9488">
                <Form.Item
                  label="แผนการพยาบาลที่เกี่ยวข้อง"
                  name="care_plan_id"
                  tooltip="ผูกบันทึกกลับไปที่ข้อวินิจฉัยเดิม ทำให้ตามรอย ADPIE ได้ครบวง"
                >
                  <Select
                    allowClear
                    placeholder={carePlans.length ? 'เลือกข้อวินิจฉัยที่กำลังดูแล' : 'ยังไม่มีแผนการพยาบาลของผู้ป่วยรายนี้'}
                    disabled={carePlans.length === 0}
                    options={carePlans.map(c => ({
                      value: c.id,
                      label: `#${c.id} ${c.nursing_diagnosis}${c.goal ? ` — เป้าหมาย: ${c.goal}` : ''}`,
                    }))}
                  />
                </Form.Item>

                <Row gutter={12}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="ข้อวินิจฉัยทางการพยาบาล (NANDA-I)" name="nanda_code">
                      <Select
                        allowClear
                        showSearch
                        placeholder="ค้นด้วยรหัส ภาษาไทย หรืออังกฤษ"
                        options={nandaOptions}
                        optionFilterProp="search"
                        onChange={onNandaChange}
                      />
                    </Form.Item>
                    <Form.Item name="nanda_label" hidden><Input /></Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="ผลลัพธ์ที่คาดหวัง (NOC)" name="noc_codes">
                      <Select
                        mode="multiple"
                        allowClear
                        showSearch
                        maxTagCount="responsive"
                        placeholder="เลือกได้มากกว่า 1"
                        options={nocOptions}
                        optionFilterProp="search"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="กิจกรรมการพยาบาล (NIC)" name="nic_codes" style={{ marginBottom: 0 }}>
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    maxTagCount="responsive"
                    placeholder="เลือกได้มากกว่า 1"
                    options={nicOptions}
                    optionFilterProp="search"
                  />
                </Form.Item>
              </SectionCard>

              {/* ── เนื้อหาตามกรอบที่เลือก ── */}
              <SectionCard icon={<PiTagBold />} title={`เนื้อหาตามกรอบ ${framework.label}`} accentColor={framework.color}>
                <Form.Item label="Focus / หัวข้อของบันทึกนี้" name="focus" rules={[{ required: true, message: 'กรุณาระบุหัวข้อ' }]}>
                  <Input placeholder="เช่น ปวดแผลผ่าตัด, ไข้สูง, ติดตามอาการหลังให้ยา" />
                </Form.Item>

                {framework.fields.map(f => {
                  const renamed = framework.rename?.[f.name];
                  return (
                    <Form.Item
                      key={String(f.name)}
                      name={f.name as string}
                      label={
                        <Space size={6}>
                          <Avatar
                            size={18}
                            style={{ background: framework.color, fontSize: 11, fontWeight: 700 }}
                          >
                            {renamed?.letter ?? f.letter}
                          </Avatar>
                          {renamed?.label ?? f.label}
                        </Space>
                      }
                      extra={<Text type="secondary" style={{ fontSize: 11 }}>{f.hint}</Text>}
                    >
                      <TextArea autoSize={{ minRows: f.rows, maxRows: 8 }} placeholder={f.hint} />
                    </Form.Item>
                  );
                })}
              </SectionCard>

              <Flex gap={8}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={cooldown > 0 ? <VscCheck /> : <VscSave />}
                  loading={saving}
                  disabled={cooldown > 0}
                  size="large"
                  block
                  style={cooldown > 0 ? undefined : { background: editing ? '#d97706' : BRAND }}
                >
                  {saving
                    ? 'กำลังบันทึก...'
                    : cooldown > 0
                      ? `บันทึกแล้ว · รออีก ${cooldown} วินาที`
                      : editing ? 'บันทึกการแก้ไข' : 'บันทึกทางการพยาบาล'}
                </Button>
                {editing && <Button size="large" onClick={resetForm}>ยกเลิก</Button>}
              </Flex>
            </Flex>
          </Col>

          {/* ── ไทม์ไลน์ ── */}
          <Col xs={24} xl={10}>
            <SectionCard
              icon={<PiClockCounterClockwiseBold />}
              title={`ประวัติการบันทึก (${notes.length})`}
              accentColor="#6366f1"
              extra={
                pendingApproval > 0 ? (
                  <Tag color="error" style={{ margin: 0 }}>รออนุมัติ {pendingApproval}</Tag>
                ) : undefined
              }
            >
              {notes.length === 0 ? (
                <Empty description="ยังไม่มีบันทึกทางการพยาบาลของผู้ป่วยรายนี้" />
              ) : (
                <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', paddingRight: 4 }}>
                  <Timeline
                    items={notes.map(note => {
                      const fw = frameworkOf(note.note_type);
                      return {
                        color: fw.color,
                        content: (
                          <Card size="small" variant="outlined" style={{ marginBottom: 4 }}>
                            <Flex justify="space-between" align="flex-start" gap={8} wrap>
                              <div>
                                <Text strong style={WRAP}>{note.focus ?? '(ไม่ระบุหัวข้อ)'}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {dayjs(note.record_datetime).format('DD/MM/YYYY HH:mm')} · {note.nurse_name}
                                </Text>
                              </div>
                              <Space size={2}>
                                {note.is_draft && canApprove && (
                                  <Tooltip title="อนุมัติเข้าเวชระเบียน">
                                    <Button type="text" size="small" style={{ color: BRAND }}
                                      icon={<PiSealCheckBold />} onClick={() => askApprove(note)} />
                                  </Tooltip>
                                )}
                                {(note.revision_no ?? 0) > 0 && (
                                  <Tooltip title="ดูประวัติการแก้ไข">
                                    <Button type="text" size="small" icon={<PiClockCounterClockwiseBold />} onClick={() => openRevisions(note)} />
                                  </Tooltip>
                                )}
                                <Tooltip title="แก้ไข">
                                  <Button type="text" size="small" icon={<PiPencilSimpleBold />} onClick={() => startEdit(note)} />
                                </Tooltip>
                                <Tooltip title="ยกเลิกบันทึก">
                                  <Button type="text" size="small" danger icon={<PiTrashBold />} onClick={() => askCancelNote(note)} />
                                </Tooltip>
                              </Space>
                            </Flex>

                            <div style={{ margin: '6px 0' }}><NoteBadges note={note} /></div>

                            {(note.nanda_label || note.care_plan_diagnosis) && (
                              <Space size={[4, 4]} wrap style={{ marginBottom: 6 }}>
                                {note.nanda_label && (
                                  <Tag color="geekblue" style={{ margin: 0, whiteSpace: 'normal', ...WRAP }}>
                                    NANDA {note.nanda_code} · {note.nanda_label}
                                  </Tag>
                                )}
                                {note.care_plan_diagnosis && (
                                  <Tag icon={<PiLinkBold />} color="cyan" style={{ margin: 0, whiteSpace: 'normal', ...WRAP }}>
                                    {note.care_plan_diagnosis}
                                  </Tag>
                                )}
                              </Space>
                            )}

                            {fw.fields.map(f => {
                              const value = note[f.name] as string | undefined;
                              if (!value) return null;
                              const renamed = fw.rename?.[f.name];
                              return (
                                <div key={String(f.name)} style={{ marginBottom: 4 }}>
                                  <Text strong style={{ fontSize: 12, color: fw.color }}>
                                    {renamed?.letter ?? f.letter} ·{' '}
                                  </Text>
                                  <Text style={{ fontSize: 12, ...WRAP }}>{value}</Text>
                                </div>
                              );
                            })}

                            {(note.nic_codes || note.noc_codes) && (
                              <Text type="secondary" style={{ fontSize: 11, ...WRAP }}>
                                {note.nic_codes && <>NIC: {note.nic_codes} </>}
                                {note.noc_codes && <>· NOC: {note.noc_codes}</>}
                              </Text>
                            )}
                          </Card>
                        ),
                      };
                    })}
                  />
                </div>
              )}
            </SectionCard>
          </Col>
        </Row>
      )}

      {/* ── ประวัติการแก้ไข ── */}
      <Modal
        open={revisionOf !== null}
        onCancel={() => setRevisionOf(null)}
        footer={null}
        centered
        width={720}
        title={`ประวัติการแก้ไข — ${revisionOf?.focus ?? ''}`}
      >
        {revisions === null ? (
          <Skeleton active />
        ) : revisions.length === 0 ? (
          <Empty description="ยังไม่มีการแก้ไข" />
        ) : (
          <Timeline
            items={revisions.map(rev => ({
              color: rev.action === 'delete' ? 'red' : 'blue',
              content: (
                <Card size="small" variant="outlined">
                  <Space size={6} wrap>
                    <Tag color={rev.action === 'delete' ? 'error' : 'processing'} style={{ margin: 0 }}>
                      {rev.action === 'delete' ? 'ยกเลิกบันทึก' : `แก้ไขครั้งที่ ${rev.revision_no}`}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(rev.changed_at).format('DD/MM/YYYY HH:mm')} · โดย {rev.changed_by ?? '-'}
                    </Text>
                  </Space>
                  <Paragraph style={{ margin: '6px 0 4px' }}>
                    <Text strong style={{ fontSize: 12 }}>เหตุผล: </Text>
                    <Text style={{ fontSize: 12, ...WRAP }}>{rev.reason}</Text>
                  </Paragraph>
                  <Divider style={{ margin: '6px 0' }} titlePlacement="start" plain>
                    <Text type="secondary" style={{ fontSize: 11 }}>ข้อความก่อนการเปลี่ยนแปลง</Text>
                  </Divider>
                  {frameworkOf(String(rev.snapshot.note_type ?? '')).fields.map(f => {
                    const value = rev.snapshot[f.name as string] as string | undefined;
                    if (!value) return null;
                    return (
                      <div key={String(f.name)} style={{ marginBottom: 2 }}>
                        <Text strong style={{ fontSize: 12 }}>{f.letter} · </Text>
                        <Text style={{ fontSize: 12, ...WRAP }} delete>{value}</Text>
                      </div>
                    );
                  })}
                </Card>
              ),
            }))}
          />
        )}
      </Modal>
    </Form>
  );
}

export default function NursingProgressNotes({ an }: { an: string }) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorPrimary: BRAND, borderRadius: 8 },
        components: { Card: { headerHeight: 40 } },
      }}
    >
      <App>
        <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
          <Navbar />
          <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
            <ProgressNotesInner an={an} />
          </div>
        </div>
      </App>
    </ConfigProvider>
  );
}
