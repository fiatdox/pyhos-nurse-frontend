'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Affix,
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Skeleton,
  Slider,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import type { DescriptionsProps } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import { getUserProfile } from '../../../lib/auth';
import { VscSave } from 'react-icons/vsc';
import {
  PiClipboardTextBold,
  PiHeartbeatBold,
  PiUserBold,
  PiUsersFourBold,
  PiNotePencilBold,
  PiShieldWarningBold,
  PiArrowLeftBold,
  PiPersonSimpleWalkBold,
  PiWheelchairBold,
  PiBedBold,
  PiAmbulanceBold,
  PiEyeBold,
  PiEyeClosedBold,
  PiMoonBold,
  PiPulseBold,
  PiShieldCheckBold,
  PiWarningBold,
  PiWarningOctagonBold,
  PiCigaretteBold,
  PiCigaretteSlashBold,
  PiThumbsUpBold,
  PiProhibitBold,
  PiBeerSteinBold,
  PiBeerBottleBold,
  PiBowlFoodBold,
  PiWarningCircleBold,
  PiTrendDownBold,
  PiSmileyBold,
  PiSmileyMehBold,
  PiSmileySadBold,
  PiPersonSimpleTaiChiBold,
  PiHandHeartBold,
  PiCheckCircleBold,
  PiSealCheckBold,
  PiWaveSineBold,
  PiWindBold,
  PiDotsThreeOutlineBold,
  PiDropHalfBold,
  PiDropBold,
  PiHandBold,
  PiPersonBold,
  PiEarBold,
  PiEarSlashBold,
  PiHeadphonesBold,
  PiEyeglassesBold,
  PiChatCircleTextBold,
  PiChatCircleDotsBold,
  PiChatCircleSlashBold,
  PiBrainBold,
  PiBabyBold,
  PiStethoscopeBold,
  PiWaveTriangleBold,
  PiWaveSquareBold,
  PiCircleHalfBold,
  PiArrowsInLineVerticalBold,
  PiArrowsOutLineVerticalBold,
  PiArrowDownBold,
  PiHeartBold,
  PiDropSimpleBold,
  PiGenderFemaleBold,
} from 'react-icons/pi';

const { TextArea } = Input;
const { Option } = Select;
const { Text, Title } = Typography;

const BRAND = '#006b5f';

interface PatientInfo {
  admission_list_id: number;
  hn: string;
  an: string;
  name?: string;
  patient_name?: string;
  ptname?: string;
  age?: number;
  gender?: string;
  sex?: string;
  ward?: string;
  wardName?: string;
  ward_name?: string;
  bed?: string;
  bedno?: string;
  admitDateTimeIso?: string;
  reg_datetime?: string;
  spcltyName?: string;
  spclty_name?: string;
  doctorName?: string;
  doctor_name?: string;
  incharge_doctor?: string;
  regdate?: string;
  admission_type_name?: string;
  birth_date?: string;
  before_ward?: string;
}

interface AdmitRecordData {
  id?: number;
  admission_list_id?: number;
  an: string;
  admit_from?: string;
  admit_method?: string;
  admit_reason?: string;
  chief_complaint?: string;
  present_illness?: string;
  past_illness?: string;
  allergies?: string;
  current_medications?: string;
  consciousness?: string;
  vital_t?: string;
  vital_p?: string;
  vital_r?: string;
  vital_bp?: string;
  vital_o2sat?: string;
  weight?: string;
  height?: string;
  bmi?: string;
  pain_score?: number;
  nutrition_screening?: string;
  diagnosis_summary?: string;
  treatment_summary?: string;
  general_appearance?: string;
  skin_condition?: string;
  mobility?: string;
  breathing?: string;
  breathing_other?: string;
  circulation?: string;
  edema?: string;
  edema_site?: string;
  hearing?: string;
  hearing_aid?: string;
  vision?: string;
  eyeglasses?: string;
  speech?: string;
  speech_other?: string;
  caregiver_name?: string;
  caregiver_relation?: string;
  caregiver_phone?: string;
  nursing_diagnosis?: string;
  nursing_plan?: string;
  nurse_name?: string;
  record_datetime?: string;
  smoking?: string;
  alcohol?: string;
  emotional_state?: string;
  emotional_note?: string;
  adl_level?: string;
  isolation_precaution?: string;
  informed_consent?: string;
  patient_identified?: string;
  discharge_plan_topics?: string;
  discharge_plan_note?: string;
  expected_los?: number;
  reviewed_by?: string;
  fall_risk_screen?: string;
  pressure_sore_screen?: string;
  devices?: string;
  valuables?: string;
  orientation_given?: string;
  // แรกรับผู้คลอด (เกณฑ์ตรวจประเมินคุณภาพการบันทึกทางการพยาบาลห้องคลอด ข้อ 1–2)
  is_maternity?: boolean;
  gravida?: number;
  parity?: number;
  abortion?: number;
  living_children?: number;
  lmp?: string;
  edc?: string;
  ga_weeks?: number;
  ga_days?: number;
  anc_place?: string;
  anc_visits?: number;
  previous_delivery?: string;
  risk_factors?: string;
  pregnancy_complication?: string;
  fundal_height?: number;
  fetal_presentation?: string;
  physical_exam_by?: string;
  physical_exam_note?: string;
  labour_assess_datetime?: string;
  uc_interval?: string;
  uc_duration?: number;
  uc_intensity?: string;
  cervical_dilation?: number;
  cervical_effacement?: number;
  membrane_status?: string;
  membrane_rupture_datetime?: string;
  amniotic_fluid?: string;
  fetal_heart_sound?: number;
  fhs_regularity?: string;
  fetal_station?: number;
  labour_complication?: string;
  updated_at?: string;
}

/** ระดับความปวดตามมาตรฐาน Numeric Rating Scale ไล่จากเขียว (ไม่ปวด) ไปแดง (ปวดมากที่สุด) */
const painLabel = (score: number) => {
  if (score === 0) return { text: 'ไม่ปวด', color: 'green', hex: '#22c55e' };
  if (score <= 3) return { text: 'ปวดเล็กน้อย', color: 'lime', hex: '#84cc16' };
  if (score <= 6) return { text: 'ปวดปานกลาง', color: 'gold', hex: '#f59e0b' };
  if (score <= 9) return { text: 'ปวดมาก', color: 'orange', hex: '#f97316' };
  return { text: 'ปวดมากที่สุด', color: 'red', hex: '#ef4444' };
};

/** ป้ายกำกับใต้แถบเลื่อน แสดงเลขคู่เพื่อไม่ให้ตัวเลขเบียดกัน */
const PAIN_MARKS: Record<number, React.ReactNode> = Object.fromEntries(
  [...Array(11)].map((_, i) => [
    i,
    <Text key={i} type="secondary" style={{ fontSize: 10 }}>
      {i % 2 === 0 ? i : ''}
    </Text>,
  ])
);

interface SegItem {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

/**
 * ตัวเลือกของช่องที่ใช้ Segmented
 * label ย่อให้สั้นเพราะป้ายของ Form.Item บอกบริบทอยู่แล้ว ส่วน value คงเดิมตามที่เก็บใน DB
 * ทุกชุดใช้สีเขียว → เหลือง/ฟ้า → ส้ม → แดง ไล่จากสภาพดีไปสภาพที่ต้องเฝ้าระวัง
 */

/** วิธีการมา — ไล่ตามระดับการช่วยเหลือที่ผู้ป่วยต้องการ */
const ADMIT_METHODS: SegItem[] = [
  { label: 'เดินมาเอง', value: 'walk', icon: <PiPersonSimpleWalkBold />, color: '#16a34a' },
  { label: 'Wheelchair', value: 'wheelchair', icon: <PiWheelchairBold />, color: '#0891b2' },
  { label: 'Stretcher', value: 'stretcher', icon: <PiBedBold />, color: '#ea580c' },
  { label: 'รถพยาบาล', value: 'ambulance', icon: <PiAmbulanceBold />, color: '#dc2626' },
];

/** ความรู้สึกตัว — ไล่จากตื่นรู้ตัวดีไปหมดสติ */
const CONSCIOUSNESS_LEVELS: SegItem[] = [
  { label: 'Alert', value: 'alert', icon: <PiEyeBold />, color: '#16a34a' },
  { label: 'Drowsy', value: 'drowsy', icon: <PiMoonBold />, color: '#ca8a04' },
  { label: 'Stupor', value: 'stupor', icon: <PiEyeClosedBold />, color: '#ea580c' },
  { label: 'Coma', value: 'coma', icon: <PiPulseBold />, color: '#dc2626' },
];

/** ระดับความเสี่ยง — ใช้ร่วมกันทั้งพลัดตกหกล้มและแผลกดทับ เพราะเป็นสเกลเดียวกัน */
const RISK_LEVELS: SegItem[] = [
  { label: 'ต่ำ', value: 'low', icon: <PiShieldCheckBold />, color: '#16a34a' },
  { label: 'ปานกลาง', value: 'moderate', icon: <PiWarningBold />, color: '#ea580c' },
  { label: 'สูง', value: 'high', icon: <PiWarningOctagonBold />, color: '#dc2626' },
];

/** สูบบุหรี่ */
const SMOKING_LEVELS: SegItem[] = [
  { label: 'ไม่สูบ', value: 'never', icon: <PiCigaretteSlashBold />, color: '#16a34a' },
  { label: 'เลิกแล้ว', value: 'quit', icon: <PiThumbsUpBold />, color: '#0891b2' },
  { label: 'สูบอยู่', value: 'current', icon: <PiCigaretteBold />, color: '#dc2626' },
];

/** ดื่มสุรา */
const ALCOHOL_LEVELS: SegItem[] = [
  { label: 'ไม่ดื่ม', value: 'never', icon: <PiProhibitBold />, color: '#16a34a' },
  { label: 'เป็นครั้งคราว', value: 'occasional', icon: <PiBeerSteinBold />, color: '#ca8a04' },
  { label: 'ประจำ', value: 'regular', icon: <PiBeerBottleBold />, color: '#dc2626' },
  { label: 'เลิกแล้ว', value: 'quit', icon: <PiThumbsUpBold />, color: '#0891b2' },
];

/** ภาวะโภชนาการ — ไล่จากปกติไปขาดสารอาหาร */
const NUTRITION_LEVELS: SegItem[] = [
  { label: 'ปกติ', value: 'normal', icon: <PiBowlFoodBold />, color: '#16a34a' },
  { label: 'เสี่ยง', value: 'risk', icon: <PiWarningCircleBold />, color: '#ea580c' },
  { label: 'ขาดสารอาหาร', value: 'malnutrition', icon: <PiTrendDownBold />, color: '#dc2626' },
];

/** สภาพจิตใจ / อารมณ์แรกรับ */
const EMOTIONAL_STATES: SegItem[] = [
  { label: 'สงบ', value: 'calm', icon: <PiSmileyBold />, color: '#16a34a' },
  { label: 'วิตกกังวล', value: 'anxious', icon: <PiSmileyMehBold />, color: '#ca8a04' },
  { label: 'ซึมเศร้า', value: 'depressed', icon: <PiSmileySadBold />, color: '#ea580c' },
  { label: 'สับสน/กระวนกระวาย', value: 'agitated', icon: <PiWarningCircleBold />, color: '#dc2626' },
];

/** ความสามารถในการทำกิจวัตรประจำวัน */
const ADL_LEVELS: SegItem[] = [
  { label: 'ช่วยตัวเองได้', value: 'independent', icon: <PiPersonSimpleTaiChiBold />, color: '#16a34a' },
  { label: 'ต้องช่วยบางส่วน', value: 'partial', icon: <PiHandHeartBold />, color: '#ca8a04' },
  { label: 'ต้องช่วยทั้งหมด', value: 'dependent', icon: <PiBedBold />, color: '#dc2626' },
];

/** การหายใจ — ตามแบบฟอร์มบันทึกสภาพร่างกายแรกรับ */
const BREATHING_LEVELS: SegItem[] = [
  { label: 'ปกติ', value: 'normal', icon: <PiWaveSineBold />, color: '#16a34a' },
  { label: 'หายใจหอบ', value: 'tachypnea', icon: <PiWindBold />, color: '#ca8a04' },
  { label: 'หายใจลำบาก', value: 'dyspnea', icon: <PiWarningBold />, color: '#ea580c' },
  { label: 'ไม่หายใจ', value: 'apnea', icon: <PiProhibitBold />, color: '#dc2626' },
  { label: 'อื่นๆ', value: 'other', icon: <PiDotsThreeOutlineBold />, color: '#64748b' },
];

/** การไหลเวียนโลหิต / สีผิว — ไล่จากปกติไปเขียวทั่วตัว */
const CIRCULATION_LEVELS: SegItem[] = [
  { label: 'ปกติ', value: 'normal', icon: <PiHeartbeatBold />, color: '#16a34a' },
  { label: 'ซีด', value: 'pale', icon: <PiDropHalfBold />, color: '#ca8a04' },
  { label: 'ปลายมือปลายเท้าเขียว', value: 'peripheral_cyanosis', icon: <PiHandBold />, color: '#ea580c' },
  { label: 'รอบปากเขียว', value: 'perioral_cyanosis', icon: <PiSmileyMehBold />, color: '#ea580c' },
  { label: 'เขียวทั่วตัว', value: 'central_cyanosis', icon: <PiPersonBold />, color: '#dc2626' },
];

/** อาการบวม */
const EDEMA_STATES: SegItem[] = [
  { label: 'ไม่มี', value: 'none', icon: <PiCheckCircleBold />, color: '#16a34a' },
  { label: 'บวม', value: 'present', icon: <PiDropBold />, color: '#ea580c' },
];

/** การได้ยิน */
const HEARING_LEVELS: SegItem[] = [
  { label: 'ได้ยินชัดเจน', value: 'clear', icon: <PiEarBold />, color: '#16a34a' },
  { label: 'ได้ยินไม่ชัดเจน', value: 'impaired', icon: <PiEarSlashBold />, color: '#ea580c' },
];

/** อุปกรณ์ช่วยฟัง — ไม่ใช่สเกลดี/แย่ ใช้สีกลางกับฝั่ง "ไม่มี" */
const HEARING_AID_STATES: SegItem[] = [
  { label: 'ไม่ใช้', value: 'no', icon: <PiProhibitBold />, color: '#64748b' },
  { label: 'ใช้', value: 'yes', icon: <PiHeadphonesBold />, color: '#0891b2' },
];

/** การมองเห็น */
const VISION_LEVELS: SegItem[] = [
  { label: 'เห็นชัดเจน', value: 'clear', icon: <PiEyeBold />, color: '#16a34a' },
  { label: 'เห็นไม่ชัดเจน', value: 'impaired', icon: <PiEyeClosedBold />, color: '#ea580c' },
];

/** การสวมแว่นตา */
const EYEGLASSES_STATES: SegItem[] = [
  { label: 'ไม่สวม', value: 'no', icon: <PiProhibitBold />, color: '#64748b' },
  { label: 'สวมแว่น', value: 'yes', icon: <PiEyeglassesBold />, color: '#0891b2' },
];

/** การพูด */
const SPEECH_LEVELS: SegItem[] = [
  { label: 'ชัดเจน', value: 'clear', icon: <PiChatCircleTextBold />, color: '#16a34a' },
  { label: 'พูดติดอ่าง', value: 'stutter', icon: <PiChatCircleDotsBold />, color: '#ca8a04' },
  { label: 'เป็นใบ้', value: 'mute', icon: <PiChatCircleSlashBold />, color: '#dc2626' },
  { label: 'อื่นๆ', value: 'other', icon: <PiDotsThreeOutlineBold />, color: '#64748b' },
];

/** ท่าของทารกในครรภ์ — vertex คลอดทางช่องคลอดได้ตามปกติ นอกนั้นต้องเฝ้าระวัง */
const PRESENTATION_LEVELS: SegItem[] = [
  { label: 'ศีรษะ (Vertex)', value: 'vertex', icon: <PiArrowDownBold />, color: '#16a34a' },
  { label: 'ก้น (Breech)', value: 'breech', icon: <PiArrowsOutLineVerticalBold />, color: '#ea580c' },
  { label: 'ขวาง (Transverse)', value: 'transverse', icon: <PiArrowsInLineVerticalBold />, color: '#dc2626' },
  { label: 'อื่นๆ', value: 'other', icon: <PiDotsThreeOutlineBold />, color: '#64748b' },
];

/** ความแรงการหดรัดตัวของมดลูก — เป็นระดับความก้าวหน้า ไม่ใช่ระดับความรุนแรง จึงไล่เฉดน้ำเงิน-ม่วง */
const UC_INTENSITY_LEVELS: SegItem[] = [
  { label: 'เบา (Mild)', value: 'mild', icon: <PiWaveSineBold />, color: '#0891b2' },
  { label: 'ปานกลาง (Moderate)', value: 'moderate', icon: <PiWaveTriangleBold />, color: '#6366f1' },
  { label: 'แรง (Strong)', value: 'strong', icon: <PiWaveSquareBold />, color: '#7c3aed' },
];

/** ถุงน้ำคร่ำ */
const MEMBRANE_STATES: SegItem[] = [
  { label: 'ยังไม่แตก (Intact)', value: 'intact', icon: <PiCircleHalfBold />, color: '#16a34a' },
  { label: 'แตกเอง (SROM)', value: 'srom', icon: <PiDropSimpleBold />, color: '#ca8a04' },
  { label: 'เจาะถุงน้ำ (AROM)', value: 'arom', icon: <PiStethoscopeBold />, color: '#0891b2' },
];

/** สีน้ำคร่ำ — ขี้เทาและเลือดปนบ่งชี้ภาวะเสี่ยงของทารก */
const AMNIOTIC_STATES: SegItem[] = [
  { label: 'ใส', value: 'clear', icon: <PiDropSimpleBold />, color: '#16a34a' },
  { label: 'ขี้เทา (Meconium)', value: 'meconium', icon: <PiWarningBold />, color: '#ea580c' },
  { label: 'มีเลือดปน', value: 'bloody', icon: <PiDropBold />, color: '#dc2626' },
  { label: 'มีกลิ่นเหม็น', value: 'foul', icon: <PiWarningOctagonBold />, color: '#dc2626' },
];

/** จังหวะการเต้นหัวใจทารก */
const FHS_REGULARITY: SegItem[] = [
  { label: 'สม่ำเสมอ', value: 'regular', icon: <PiHeartBold />, color: '#16a34a' },
  { label: 'ไม่สม่ำเสมอ', value: 'irregular', icon: <PiWarningBold />, color: '#dc2626' },
];

/** ช่วงปกติของเสียงหัวใจทารกคือ 110–160 ครั้ง/นาที */
const fhsLabel = (fhs: number) => {
  if (fhs < 110) return { text: 'ช้ากว่าปกติ (Bradycardia)', color: 'red' };
  if (fhs > 160) return { text: 'เร็วกว่าปกติ (Tachycardia)', color: 'red' };
  return { text: 'ปกติ', color: 'green' };
};

/** ป้ายกำกับของแถบเลื่อนปากมดลูกเปิด 0–10 ซม. */
const DILATION_MARKS: Record<number, React.ReactNode> = Object.fromEntries(
  [...Array(11)].map((_, i) => [
    i,
    <Text key={i} type="secondary" style={{ fontSize: 10 }}>
      {i % 2 === 0 ? i : ''}
    </Text>,
  ])
);

/** ระดับส่วนนำเทียบ ischial spine (station) — 0 คือระดับ spine พอดี */
const STATION_MARKS: Record<number, React.ReactNode> = Object.fromEntries(
  [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(i => [
    i,
    <Text key={i} type="secondary" style={{ fontSize: 10 }}>
      {i % 2 === 0 ? (i > 0 ? `+${i}` : i) : ''}
    </Text>,
  ])
);

/** สถานะดำเนินการของหัวข้อที่ต้องตรวจสอบตามมาตรฐาน */
const DONE_STATES: SegItem[] = [
  { label: 'ดำเนินการแล้ว', value: 'done', icon: <PiCheckCircleBold />, color: '#16a34a' },
  { label: 'ยังไม่ได้', value: 'pending', icon: <PiWarningCircleBold />, color: '#dc2626' },
];

/** แปลงเป็น options ของ Segmented — ตัวที่เลือกอยู่จะเน้นสีและตัวหนา */
const segOptions = (items: SegItem[], selected?: string) =>
  items.map(m => {
    const active = selected === m.value;
    return {
      value: m.value,
      label: (
        <Flex align="center" justify="center" gap={6} style={{ padding: '2px 0' }}>
          <span style={{ fontSize: 16, color: m.color, display: 'flex' }}>{m.icon}</span>
          <span style={{ color: active ? m.color : undefined, fontWeight: active ? 600 : 400 }}>
            {m.label}
          </span>
        </Flex>
      ),
    };
  });

/** กรอบของ Segmented เปลี่ยนเป็นสีของตัวเลือกที่เลือกอยู่ */
const segStyle = (items: SegItem[], selected?: string) => {
  const hit = items.find(m => m.value === selected);
  return hit ? { borderColor: hit.color } : undefined;
};

/** เกณฑ์ BMI สำหรับผู้ใหญ่ตามค่าที่ใช้ในเอเชีย */
const bmiLabel = (bmi: number) => {
  if (bmi < 18.5) return { text: 'น้ำหนักน้อย', color: 'blue' };
  if (bmi < 23) return { text: 'ปกติ', color: 'green' };
  if (bmi < 25) return { text: 'ท้วม', color: 'gold' };
  if (bmi < 30) return { text: 'อ้วน', color: 'orange' };
  return { text: 'อ้วนมาก', color: 'red' };
};

/** ช่วงค่าปกติของสัญญาณชีพผู้ใหญ่ ใช้เตือนให้ทวนค่าก่อนบันทึก ไม่ได้บล็อกการบันทึก */
const checkVitals = (v: {
  vital_t?: number | null;
  vital_p?: number | null;
  vital_r?: number | null;
  vital_o2sat?: number | null;
  vital_bp?: string | null;
}): string[] => {
  const w: string[] = [];
  if (v.vital_t != null) {
    if (v.vital_t >= 37.5) w.push(`ไข้สูง ${v.vital_t}°C`);
    else if (v.vital_t < 35.5) w.push(`อุณหภูมิต่ำ ${v.vital_t}°C`);
  }
  if (v.vital_p != null && (v.vital_p > 100 || v.vital_p < 60)) {
    w.push(`ชีพจร${v.vital_p > 100 ? 'เร็ว' : 'ช้า'} ${v.vital_p}`);
  }
  if (v.vital_r != null && (v.vital_r > 24 || v.vital_r < 12)) {
    w.push(`หายใจ${v.vital_r > 24 ? 'เร็ว' : 'ช้า'} ${v.vital_r}`);
  }
  if (v.vital_o2sat != null && v.vital_o2sat < 95) w.push(`O2Sat ต่ำ ${v.vital_o2sat}%`);
  if (v.vital_bp) {
    const m = String(v.vital_bp).match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
    if (m) {
      const sys = Number(m[1]);
      const dia = Number(m[2]);
      if (sys >= 140 || dia >= 90) w.push(`ความดันสูง ${sys}/${dia}`);
      else if (sys < 90 || dia < 60) w.push(`ความดันต่ำ ${sys}/${dia}`);
    }
  }
  return w;
};

/** การ์ดหัวข้อของแต่ละส่วนในแบบบันทึก */
function SectionCard({
  icon,
  title,
  accentColor,
  extra,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accentColor: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card
      size="small"
      variant="outlined"
      styles={{
        header: {
          // ไล่เฉดจากเข้มไปอ่อน ให้แถบหัวข้อเด่นพอที่จะแยกแต่ละส่วนออกจากกันด้วยสายตา
          background: `linear-gradient(90deg, ${accentColor}33, ${accentColor}14)`,
          borderBottom: `1px solid ${accentColor}59`,
        },
      }}
      style={{ borderLeft: `4px solid ${accentColor}` }}
      title={
        <Space size={8}>
          <Avatar size={26} shape="square" style={{ background: accentColor }} icon={icon} />
          <Text strong style={{ color: accentColor }}>
            {title}
          </Text>
        </Space>
      }
      extra={extra}
    >
      {children}
    </Card>
  );
}

function AdmitRecordInner({ an }: { an: string }) {
  const { modal } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [existingRecord, setExistingRecord] = useState<AdmitRecordData | null>(null);

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

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
        try {
          const recordRes = await axios.get(`/api/v1/nursing-records/admit/${an}`, { headers });
          if (recordRes.data?.success && recordRes.data.data) {
            const raw = recordRes.data.data;
            const record = Array.isArray(raw) ? raw[0] : raw;
            if (!record) throw new Error('no record');
            setExistingRecord(record);
          }
        } catch {
          // ไม่มีข้อมูลเดิม — ใช้ค่า default
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [an, getHeaders, form]);

  useEffect(() => {
    if (loading) return;
    if (existingRecord) {
      // คอลัมน์เก็บเป็นข้อความคั่นจุลภาค แต่ช่อง mode="tags" ต้องการ array
      const toTags = (v?: string | null) =>
        v ? v.split(',').map(s => s.trim()).filter(Boolean) : undefined;
      // DatePicker ต้องการ dayjs — ค่าว่างต้องเป็น undefined ไม่ใช่ dayjs(null) ที่จะกลายเป็นวันนี้
      const toDate = (v?: string | null) => (v ? dayjs(v) : undefined);

      form.setFieldsValue({
        ...existingRecord,
        nurse_name: existingRecord.nurse_name || getUserProfile()?.fullname || '',
        pain_score:
          existingRecord.pain_score !== null && existingRecord.pain_score !== undefined
            ? Number(existingRecord.pain_score)
            : undefined,
        record_datetime: existingRecord.record_datetime ? dayjs(existingRecord.record_datetime) : dayjs(),
        devices: toTags(existingRecord.devices),
        skin_condition: toTags(existingRecord.skin_condition),
        orientation_given: toTags(existingRecord.orientation_given),
        isolation_precaution: toTags(existingRecord.isolation_precaution),
        discharge_plan_topics: toTags(existingRecord.discharge_plan_topics),
        risk_factors: toTags(existingRecord.risk_factors),
        lmp: toDate(existingRecord.lmp),
        edc: toDate(existingRecord.edc),
        labour_assess_datetime: toDate(existingRecord.labour_assess_datetime),
        membrane_rupture_datetime: toDate(existingRecord.membrane_rupture_datetime),
      });
    } else {
      form.setFieldsValue({ record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' });
    }
  }, [loading, existingRecord, form]);

  const calculateBMI = () => {
    const weight = parseFloat(form.getFieldValue('weight'));
    const height = parseFloat(form.getFieldValue('height'));
    if (weight > 0 && height > 0) {
      const heightM = height / 100;
      form.setFieldsValue({ bmi: (weight / (heightM * heightM)).toFixed(1) });
    } else {
      form.setFieldsValue({ bmi: undefined });
    }
  };

  /**
   * คำนวณ EDC และอายุครรภ์จาก LMP ตามกฎ Naegele (LMP + 280 วัน)
   * อายุครรภ์นับถึงวันที่รับไว้ ไม่ใช่วันนี้ เพื่อให้ตรงกับที่บันทึกในเวชระเบียน
   */
  const calculateGA = () => {
    const lmp = form.getFieldValue('lmp') as dayjs.Dayjs | undefined;
    if (!lmp?.isValid?.()) {
      form.setFieldsValue({ edc: undefined, ga_weeks: undefined, ga_days: undefined });
      return;
    }
    const ref = (form.getFieldValue('record_datetime') as dayjs.Dayjs | undefined) ?? dayjs();
    const days = ref.startOf('day').diff(lmp.startOf('day'), 'day');
    form.setFieldsValue({
      edc: lmp.add(280, 'day'),
      ga_weeks: days >= 0 ? Math.floor(days / 7) : undefined,
      ga_days: days >= 0 ? days % 7 : undefined,
    });
  };

  // ติดตามค่าที่ใช้แสดงผลทันทีระหว่างพิมพ์
  const watched = Form.useWatch([], form) as Record<string, unknown> | undefined;
  const vitalWarnings = checkVitals({
    vital_t: watched?.vital_t as number,
    vital_p: watched?.vital_p as number,
    vital_r: watched?.vital_r as number,
    vital_o2sat: watched?.vital_o2sat as number,
    vital_bp: watched?.vital_bp as string,
  });
  const bmiValue = Number(watched?.bmi);
  const bmiInfo = bmiValue > 0 ? bmiLabel(bmiValue) : null;

  const painScore = watched?.pain_score as number | undefined;
  const painInfo = painScore != null ? painLabel(painScore) : { text: '', color: 'default', hex: '#d9d9d9' };

  // ── แรกรับผู้คลอด ──
  const isMaternity = !!watched?.is_maternity;
  const membraneRuptured = watched?.membrane_status === 'srom' || watched?.membrane_status === 'arom';
  const dilation = watched?.cervical_dilation as number | undefined;
  const station = watched?.fetal_station as number | undefined;
  const fhs = watched?.fetal_heart_sound as number | undefined;
  const fhsInfo = fhs != null && fhs > 0 ? fhsLabel(fhs) : null;

  /** ปุ่มลัดสำหรับช่องที่พยาบาลกรอกค่าเดิมซ้ำๆ */
  const setField = (field: string, value: string) => form.setFieldValue(field, value);

  const onFinish = async (values: Record<string, unknown>) => {
    setSaving(true);
    try {
      const headers = getHeaders();
      const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v));
      const joinTags = (v: unknown) =>
        Array.isArray(v) ? v.join(', ') || null : (v as string) || null;
      const date = (v: unknown) => (v ? dayjs(v as string).format('YYYY-MM-DD') : null);
      const datetime = (v: unknown) => (v ? dayjs(v as string).format('YYYY-MM-DD HH:mm:ss') : null);

      const payload: Record<string, unknown> = {
        ...values,
        an,
        admission_list_id: patient?.admission_list_id ?? null,
        ward_code: patient?.ward || getUserProfile()?.ward_code || '',
        ward_name: patient?.ward_name || patient?.wardName || getUserProfile()?.ward_name || '',
        id: getUserProfile()?.id || null,
        staff_id: String(getUserProfile()?.id || ''),
        record_datetime: values.record_datetime
          ? dayjs(values.record_datetime as string).format('YYYY-MM-DD HH:mm:ss')
          : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        vital_t: num(values.vital_t),
        vital_p: num(values.vital_p),
        vital_r: num(values.vital_r),
        vital_o2sat: num(String(values.vital_o2sat ?? '').replace('%', '')),
        weight: num(values.weight),
        height: num(values.height),
        bmi: num(values.bmi),
        pain_score: num(values.pain_score),
        // ช่อง mode="tags" คืนค่าเป็น array — เก็บเป็นข้อความคั่นจุลภาคให้ตรงกับชนิดคอลัมน์
        devices: joinTags(values.devices),
        skin_condition: joinTags(values.skin_condition),
        orientation_given: joinTags(values.orientation_given),
        isolation_precaution: joinTags(values.isolation_precaution),
        discharge_plan_topics: joinTags(values.discharge_plan_topics),
        expected_los: num(values.expected_los),
        // ช่องขยายจะซ่อนเมื่อเปลี่ยนตัวเลือก แต่ antd ยังเก็บค่าไว้ จึงล้างให้ตรงกับที่เลือกจริง
        breathing_other: values.breathing === 'other' ? values.breathing_other ?? null : null,
        speech_other: values.speech === 'other' ? values.speech_other ?? null : null,
        edema_site: values.edema === 'present' ? values.edema_site ?? null : null,

        // ── แรกรับผู้คลอด ──
        is_maternity: !!values.is_maternity,
        risk_factors: joinTags(values.risk_factors),
        lmp: date(values.lmp),
        edc: date(values.edc),
        labour_assess_datetime: datetime(values.labour_assess_datetime),
        // เวลาน้ำเดินมีความหมายเฉพาะเมื่อถุงน้ำคร่ำแตกแล้ว
        membrane_rupture_datetime:
          values.membrane_status === 'intact' ? null : datetime(values.membrane_rupture_datetime),
        amniotic_fluid: values.membrane_status === 'intact' ? null : values.amniotic_fluid ?? null,
        gravida: num(values.gravida),
        parity: num(values.parity),
        abortion: num(values.abortion),
        living_children: num(values.living_children),
        ga_weeks: num(values.ga_weeks),
        ga_days: num(values.ga_days),
        anc_visits: num(values.anc_visits),
        fundal_height: num(values.fundal_height),
        uc_duration: num(values.uc_duration),
        cervical_dilation: num(values.cervical_dilation),
        cervical_effacement: num(values.cervical_effacement),
        fetal_heart_sound: num(values.fetal_heart_sound),
        fetal_station: num(values.fetal_station),
      };

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) payload[key] = null;
      });

      const response = await axios.post('/api/v1/nursing-records/admit', payload, { headers });
      if (response.data?.data) setExistingRecord(response.data.data);

      modal.success({
        title: 'บันทึกสำเร็จ',
        content: response.data?.message ?? 'บันทึกข้อมูลการรับผู้ป่วยเรียบร้อยแล้ว',
        okText: 'ตกลง',
        centered: true,
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const detail = axios.isAxiosError(error)
        ? (error.response?.data as { message?: string })?.message
        : undefined;
      modal.error({
        title: `บันทึกไม่สำเร็จ${status ? ` (${status})` : ''}`,
        content: detail ?? 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง',
        okText: 'ตกลง',
        centered: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const patientName = patient?.ptname || patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime || patient?.regdate;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  const headerItems: DescriptionsProps['items'] = [
    { key: 'hn', label: 'HN', children: patient?.hn || '-' },
    { key: 'an', label: 'AN', children: an },
    { key: 'bed', label: 'เตียง', children: patient?.bed || patient?.bedno || '-' },
    { key: 'ward', label: 'หอผู้ป่วย', children: patient?.ward_name || patient?.wardName || patient?.ward || '-' },
    { key: 'doctor', label: 'แพทย์', children: patient?.doctor_name || patient?.doctorName || patient?.incharge_doctor || '-' },
    { key: 'admit', label: 'วันที่รับไว้', children: formattedAdmitDate },
  ];

  return (
    <Form
      form={form}
      className="admit-form"
      layout="vertical"
      onFinish={onFinish}
      requiredMark={false}
    >
      {/*
        antd ไม่มี token สำหรับความหนาของ label จึงกำหนดด้วย CSS
        และจำกัดขอบเขตไว้ที่ฟอร์มนี้ ไม่ให้กระทบฟอร์มอื่นทั้งระบบ
      */}
      <style>{`
        .admit-form .ant-form-item-label > label { font-weight: 600; }
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
            <Avatar size={40} shape="square" style={{ background: 'rgba(255,255,255,.2)' }} icon={<PiClipboardTextBold />} />
            <div>
              <Title level={5} style={{ color: '#fff', margin: 0 }}>
                แบบบันทึกการรับผู้ป่วย
              </Title>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{patientName}</Text>
            </div>
          </Space>
          <Button
            icon={<PiArrowLeftBold />}
            onClick={() => window.history.back()}
            ghost
          >
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
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {/* ── แถวบน: ข้อมูลการรับเข้า คู่กับสัญญาณชีพ ── */}
          <Col xs={24} xl={12}>
            <Flex vertical gap={16}>
              <SectionCard icon={<PiClipboardTextBold />} title="ข้อมูลการรับเข้า" accentColor={BRAND}>
                <Row gutter={12}>
                  <Col xs={24} sm={8}>
                    <Form.Item label="รับจาก" name="admit_from">
                      <Select placeholder="เลือก" allowClear>
                        <Option value="ER">ER</Option>
                        <Option value="OPD">OPD</Option>
                        <Option value="OR">OR</Option>
                        <Option value="ICU">ICU</Option>
                        <Option value="WARD">Ward อื่น</Option>
                        <Option value="REFER">Refer</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={16}>
                    <Form.Item label="วิธีการมา" name="admit_method">
                      <Segmented
                        block
                        options={segOptions(ADMIT_METHODS, watched?.admit_method as string)}
                        style={segStyle(ADMIT_METHODS, watched?.admit_method as string)}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="สาเหตุการรับเข้า" name="admit_reason">
                  <Input placeholder="ระบุสาเหตุ" />
                </Form.Item>
                <Form.Item label="Chief Complaint" name="chief_complaint">
                  <TextArea rows={1} placeholder="อาการสำคัญ" autoSize={{ minRows: 1, maxRows: 4 }} />
                </Form.Item>
                <Form.Item label="Present Illness" name="present_illness">
                  <TextArea rows={2} placeholder="ประวัติเจ็บป่วยปัจจุบัน" autoSize={{ minRows: 2, maxRows: 6 }} />
                </Form.Item>
                <Form.Item label="Past Illness" name="past_illness">
                  <TextArea rows={1} placeholder="โรคประจำตัว / ประวัติผ่าตัด" autoSize={{ minRows: 1, maxRows: 4 }} />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space size={6}>
                          แพ้ยา / อาหาร
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: 'auto', fontSize: 11 }}
                            onClick={() => setField('allergies', 'ปฏิเสธการแพ้ยาและอาหาร')}
                          >
                            ปฏิเสธการแพ้
                          </Button>
                        </Space>
                      }
                      name="allergies"
                    >
                      <Input placeholder="ระบุยา/อาหารที่แพ้" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label={
                        <Space size={6}>
                          ยาที่ใช้ปัจจุบัน
                          <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, height: 'auto', fontSize: 11 }}
                            onClick={() => setField('current_medications', 'ไม่มี')}
                          >
                            ไม่มี
                          </Button>
                        </Space>
                      }
                      name="current_medications"
                    >
                      <Input placeholder="ระบุยาที่ใช้อยู่" />
                    </Form.Item>
                  </Col>
                </Row>
              </SectionCard>
            </Flex>
          </Col>
          <Col xs={24} xl={12}>
            <Flex vertical gap={16}>
              <SectionCard
                icon={<PiHeartbeatBold />}
                title="การประเมินแรกรับ (Initial Assessment)"
                accentColor="#ef4444"
              >
                <Card
                  size="small"
                  type="inner"
                  title={
                    <Text strong style={{ color: '#cf1322', fontSize: 12, letterSpacing: 1 }}>
                      VITAL SIGNS
                    </Text>
                  }
                  style={{ marginBottom: 12 }}
                  styles={{
                    header: {
                      background: 'linear-gradient(90deg, #ffccc7, #fff1f0)',
                      borderBottom: '1px solid #ffa39e',
                      minHeight: 34,
                    },
                  }}
                >
                  <Row gutter={8}>
                    <Col span={5}>
                      <Form.Item label="T (°C)" name="vital_t" style={{ marginBottom: 0 }}>
                        <InputNumber placeholder="36.5" min={30} max={45} step={0.1} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item label="P (bpm)" name="vital_p" style={{ marginBottom: 0 }}>
                        <InputNumber placeholder="80" min={0} max={300} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      <Form.Item label="R (/min)" name="vital_r" style={{ marginBottom: 0 }}>
                        <InputNumber placeholder="20" min={0} max={99} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item label="BP (mmHg)" name="vital_bp" style={{ marginBottom: 0 }}>
                        <Input placeholder="120/80" inputMode="numeric" />
                      </Form.Item>
                    </Col>
                    <Col span={5}>
                      <Form.Item label="O2Sat (%)" name="vital_o2sat" style={{ marginBottom: 0 }}>
                        <InputNumber placeholder="98" min={0} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* เตือนค่าที่อยู่นอกช่วงปกติ ให้ทวนก่อนบันทึก */}
                  {vitalWarnings.length > 0 && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginTop: 12 }}
                      title={
                        <Space size={[4, 4]} wrap>
                          {vitalWarnings.map(w => (
                            <Tag key={w} color="orange" style={{ margin: 0 }}>
                              {w}
                            </Tag>
                          ))}
                        </Space>
                      }
                    />
                  )}
                </Card>

                <Form.Item label="ความรู้สึกตัว" name="consciousness">
                  <Segmented
                    block
                    options={segOptions(CONSCIOUSNESS_LEVELS, watched?.consciousness as string)}
                    style={segStyle(CONSCIOUSNESS_LEVELS, watched?.consciousness as string)}
                  />
                </Form.Item>

                {/* เต็มแถวเพราะ "ขาดสารอาหาร" มีข้อความยาว จะตกหล่นถ้าอยู่ครึ่งแถว */}
                <Form.Item label="Nutrition" name="nutrition_screening">
                  <Segmented
                    block
                    options={segOptions(NUTRITION_LEVELS, watched?.nutrition_screening as string)}
                    style={segStyle(NUTRITION_LEVELS, watched?.nutrition_screening as string)}
                  />
                </Form.Item>

                {/* Pain score ลากเลือกได้ต่อเนื่อง สีแถบไล่ตามระดับความปวด */}
                <Form.Item
                  label={
                    <Space size={6}>
                      Pain Score (0-10)
                      <Tag color={painInfo.color} style={{ margin: 0 }}>
                        {painScore != null ? `${painScore} · ${painInfo.text}` : 'ยังไม่ประเมิน'}
                      </Tag>
                    </Space>
                  }
                  name="pain_score"
                  style={{ marginBottom: 20, paddingInline: 4 }}
                >
                  <Slider
                    min={0}
                    max={10}
                    step={1}
                    marks={PAIN_MARKS}
                    tooltip={{ formatter: v => `${v} · ${painLabel(Number(v)).text}` }}
                    styles={{ track: { backgroundColor: painInfo.hex }, handle: { borderColor: painInfo.hex } }}
                  />
                </Form.Item>

                <Card
                  size="small"
                  type="inner"
                  title={
                    <Text strong style={{ color: '#0958d9', fontSize: 12, letterSpacing: 1 }}>
                      BODY MEASUREMENT
                    </Text>
                  }
                  styles={{
                    header: {
                      background: 'linear-gradient(90deg, #bae0ff, #e6f4ff)',
                      borderBottom: '1px solid #91caff',
                      minHeight: 34,
                    },
                  }}
                >
                  <Row gutter={8}>
                    <Col span={8}>
                      <Form.Item label="น้ำหนัก (kg)" name="weight" style={{ marginBottom: 0 }}>
                        <InputNumber placeholder="60" min={0} max={400} step={0.1} onChange={calculateBMI} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="ส่วนสูง (cm)" name="height" style={{ marginBottom: 0 }}>
                        <InputNumber placeholder="165" min={0} max={250} step={0.5} onChange={calculateBMI} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        label={
                          <Space size={6}>
                            BMI
                            {bmiInfo && (
                              <Tag color={bmiInfo.color} style={{ margin: 0 }}>
                                {bmiInfo.text}
                              </Tag>
                            )}
                          </Space>
                        }
                        name="bmi"
                        style={{ marginBottom: 0 }}
                      >
                        <Input readOnly placeholder="คำนวณอัตโนมัติ" style={{ fontWeight: 700, color: BRAND }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              </SectionCard>
            </Flex>
          </Col>

          {/* ── เต็มความกว้าง: ช่องตัวเลือกเยอะ ต้องการพื้นที่แนวนอน ── */}
          <Col span={24}>
            {/* หัวข้อตามแบบฟอร์ม "สภาพร่างกายผู้ป่วยแรกรับ" — เต็มความกว้างเพราะแต่ละช่องมีตัวเลือกหลายข้อ */}
            <SectionCard icon={<PiUserBold />} title="สภาพร่างกายแรกรับ" accentColor="#7c3aed">
              <Row gutter={12}>
                <Col xs={24} sm={12} xl={5}>
                  <Form.Item label="ลักษณะทั่วไป" name="general_appearance">
                    <Select placeholder="เลือก" allowClear>
                      <Option value="good">ดี</Option>
                      <Option value="fair">พอใช้</Option>
                      <Option value="poor">ไม่ดี</Option>
                      <Option value="critical">วิกฤต</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} xl={5}>
                  <Form.Item label="การเคลื่อนไหว" name="mobility">
                    <Select placeholder="เลือก" allowClear>
                      <Option value="independent">ทำเอง</Option>
                      <Option value="assist">มีผู้ช่วย</Option>
                      <Option value="bedridden">ติดเตียง</Option>
                      <Option value="wheelchair">รถเข็น</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} xl={14}>
                  <Form.Item label="การหายใจ" name="breathing">
                    <Segmented
                      block
                      options={segOptions(BREATHING_LEVELS, watched?.breathing as string)}
                      style={segStyle(BREATHING_LEVELS, watched?.breathing as string)}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* ช่องระบุจะโผล่เฉพาะตอนเลือก "อื่นๆ" เพื่อไม่ให้ฟอร์มรกโดยไม่จำเป็น */}
              {watched?.breathing === 'other' && (
                <Row gutter={12}>
                  <Col xs={24} xl={{ span: 14, offset: 10 }}>
                    <Form.Item label="ระบุลักษณะการหายใจ" name="breathing_other">
                      <Input placeholder="ระบุ" />
                    </Form.Item>
                  </Col>
                </Row>
              )}

              <Row gutter={12}>
                <Col xs={24} xl={16}>
                  <Form.Item label="การไหลเวียนโลหิต / สีผิว" name="circulation">
                    <Segmented
                      block
                      options={segOptions(CIRCULATION_LEVELS, watched?.circulation as string)}
                      style={segStyle(CIRCULATION_LEVELS, watched?.circulation as string)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={watched?.edema === 'present' ? 8 : 24} xl={8}>
                  <Form.Item label="อาการบวม" name="edema">
                    <Segmented
                      block
                      options={segOptions(EDEMA_STATES, watched?.edema as string)}
                      style={segStyle(EDEMA_STATES, watched?.edema as string)}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                {watched?.edema === 'present' && (
                  <Col xs={24} xl={8}>
                    <Form.Item label="บวมบริเวณ" name="edema_site" style={{ marginBottom: 0 }}>
                      <Input placeholder="เช่น ขาทั้งสองข้าง, หน้าท้อง" />
                    </Form.Item>
                  </Col>
                )}
                <Col xs={24} xl={watched?.edema === 'present' ? 16 : 24}>
                  <Form.Item label="ผิวหนัง" name="skin_condition" style={{ marginBottom: 0 }}>
                    <Select mode="tags" placeholder="เลือกได้มากกว่า 1 ข้อ หรือพิมพ์เพิ่ม" allowClear>
                      <Option value="ปกติ">ปกติ</Option>
                      <Option value="หนังแตก">หนังแตก</Option>
                      <Option value="เขียวช้ำ">เขียวช้ำ</Option>
                      <Option value="ผื่นแดง">ผื่นแดง</Option>
                      <Option value="ผื่นคัน">ผื่นคัน</Option>
                      <Option value="เหลือง">เหลือง</Option>
                      <Option value="มีแผล">มีแผล</Option>
                      <Option value="บวม">บวม</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </SectionCard>
          </Col>
          <Col span={24}>
            <SectionCard
              icon={<PiChatCircleTextBold />}
              title="การติดต่อสื่อสาร / สภาพจิตใจแรกรับ"
              accentColor="#db2777"
            >
              {/* หู · ตา อยู่แถวเดียวกันได้เมื่อการ์ดเต็มความกว้าง */}
              <Row gutter={12}>
                <Col xs={24} sm={14} xl={7}>
                  <Form.Item label="หู — การได้ยิน" name="hearing">
                    <Segmented
                      block
                      options={segOptions(HEARING_LEVELS, watched?.hearing as string)}
                      style={segStyle(HEARING_LEVELS, watched?.hearing as string)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={10} xl={5}>
                  <Form.Item label="อุปกรณ์ช่วยฟัง" name="hearing_aid">
                    <Segmented
                      block
                      options={segOptions(HEARING_AID_STATES, watched?.hearing_aid as string)}
                      style={segStyle(HEARING_AID_STATES, watched?.hearing_aid as string)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={14} xl={7}>
                  <Form.Item label="ตา — การมองเห็น" name="vision">
                    <Segmented
                      block
                      options={segOptions(VISION_LEVELS, watched?.vision as string)}
                      style={segStyle(VISION_LEVELS, watched?.vision as string)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={10} xl={5}>
                  <Form.Item label="แว่นตา" name="eyeglasses">
                    <Segmented
                      block
                      options={segOptions(EYEGLASSES_STATES, watched?.eyeglasses as string)}
                      style={segStyle(EYEGLASSES_STATES, watched?.eyeglasses as string)}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col xs={24} xl={watched?.speech === 'other' ? 8 : 12}>
                  <Form.Item label="การพูด" name="speech">
                    <Segmented
                      block
                      options={segOptions(SPEECH_LEVELS, watched?.speech as string)}
                      style={segStyle(SPEECH_LEVELS, watched?.speech as string)}
                    />
                  </Form.Item>
                </Col>
                {watched?.speech === 'other' && (
                  <Col xs={24} xl={4}>
                    <Form.Item label="ระบุลักษณะการพูด" name="speech_other">
                      <Input placeholder="ระบุ" />
                    </Form.Item>
                  </Col>
                )}
                <Col xs={24} xl={12}>
                  <Form.Item label="ความสามารถในการทำกิจวัตรประจำวัน (ADL)" name="adl_level">
                    <Segmented
                      block
                      options={segOptions(ADL_LEVELS, watched?.adl_level as string)}
                      style={segStyle(ADL_LEVELS, watched?.adl_level as string)}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '4px 0 12px' }} titlePlacement="start" plain>
                <Text strong style={{ fontSize: 12, color: '#db2777' }}>
                  <PiBrainBold style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  สภาพจิตใจแรกรับ
                </Text>
              </Divider>

              <Row gutter={12}>
                <Col xs={24} xl={16}>
                  <Form.Item label="อารมณ์ที่แสดงออก" name="emotional_state" style={{ marginBottom: 0 }}>
                    <Segmented
                      block
                      options={segOptions(EMOTIONAL_STATES, watched?.emotional_state as string)}
                      style={segStyle(EMOTIONAL_STATES, watched?.emotional_state as string)}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} xl={8}>
                  <Form.Item
                    label="พฤติกรรมที่แสดงออก / สิ่งที่วิตกกังวล"
                    name="emotional_note"
                    style={{ marginBottom: 0 }}
                  >
                    <TextArea
                      placeholder="บรรยายการแสดงออกทางพฤติกรรม อารมณ์ และสิ่งที่ผู้ป่วยวิตกกังวล"
                      autoSize={{ minRows: 1, maxRows: 5 }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </SectionCard>
          </Col>

          {/*
            เกณฑ์ตรวจประเมินคุณภาพการบันทึกทางการพยาบาลห้องคลอด
            การ์ดนี้ครอบคลุมเฉพาะข้อ 1 (ประวัติ/ANC/ความเสี่ยง/ตรวจร่างกาย)
            และข้อ 2 เฉพาะการประเมินครั้งแรกตอนรับเข้า
            ส่วนข้อ 3–8 เป็นบันทึกระหว่างและหลังคลอด อยู่คนละใบ
          */}
          <Col span={24}>
            <SectionCard
              icon={<PiBabyBold />}
              title="บันทึกข้อมูลแรกรับผู้คลอด"
              accentColor="#e11d48"
              extra={
                <Form.Item name="is_maternity" valuePropName="checked" noStyle>
                  <Switch checkedChildren="ผู้คลอด" unCheckedChildren="ไม่ใช่ผู้คลอด" />
                </Form.Item>
              }
            >
              {!isMaternity ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <PiGenderFemaleBold style={{ verticalAlign: '-2px', marginRight: 4 }} />
                  เปิดสวิตช์มุมขวาบนเมื่อผู้ป่วยรายนี้เป็นผู้คลอด
                  เพื่อบันทึกประวัติทางสูติกรรมและการประเมินระยะรอคลอด
                </Text>
              ) : (
                <>
                  <Divider style={{ margin: '0 0 12px' }} titlePlacement="start" plain>
                    <Text strong style={{ fontSize: 12, color: '#e11d48' }}>
                      <PiGenderFemaleBold style={{ verticalAlign: '-2px', marginRight: 4 }} />
                      ประวัติทางสูติกรรม — G ตั้งครรภ์ / P คลอด / A แท้ง / L บุตรมีชีวิต
                    </Text>
                  </Divider>

                  <Row gutter={12}>
                    <Col xs={6} sm={4} xl={2}>
                      <Form.Item label="G" name="gravida">
                        <InputNumber min={0} max={20} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={6} sm={4} xl={2}>
                      <Form.Item label="P" name="parity">
                        <InputNumber min={0} max={20} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={6} sm={4} xl={2}>
                      <Form.Item label="A" name="abortion">
                        <InputNumber min={0} max={20} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={6} sm={4} xl={2}>
                      <Form.Item label="L" name="living_children">
                        <InputNumber min={0} max={20} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} xl={5}>
                      <Form.Item label="LMP (ประจำเดือนครั้งสุดท้าย)" name="lmp">
                        <DatePicker
                          format="DD/MM/YYYY"
                          style={{ width: '100%' }}
                          onChange={calculateGA}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} xl={5}>
                      <Form.Item label="EDC (กำหนดคลอด)" name="edc">
                        <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={6} xl={3}>
                      <Form.Item label="GA (สัปดาห์)" name="ga_weeks">
                        <InputNumber min={0} max={45} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={6} xl={3}>
                      <Form.Item label="GA (วัน)" name="ga_days">
                        <InputNumber min={0} max={6} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col xs={24} sm={14} xl={8}>
                      <Form.Item label="ฝากครรภ์ที่ (ANC)" name="anc_place">
                        <Input placeholder="ระบุสถานพยาบาล หรือ 'ไม่ได้ฝากครรภ์'" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={10} xl={4}>
                      <Form.Item label="จำนวนครั้งที่ฝากครรภ์" name="anc_visits">
                        <InputNumber min={0} max={40} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} xl={12}>
                      <Form.Item label="ประวัติการคลอดครั้งก่อน" name="previous_delivery">
                        <Select mode="tags" placeholder="เลือกหรือพิมพ์เพิ่ม" allowClear>
                          <Option value="ไม่เคยคลอด">ไม่เคยคลอด</Option>
                          <Option value="คลอดปกติ">คลอดปกติ (Normal labour)</Option>
                          <Option value="ใช้คีม/เครื่องดูดสุญญากาศ">ใช้คีม / เครื่องดูดสุญญากาศ</Option>
                          <Option value="ผ่าตัดคลอด">ผ่าตัดคลอด (C/S)</Option>
                          <Option value="แท้ง">แท้ง</Option>
                          <Option value="ทารกเสียชีวิตในครรภ์">ทารกเสียชีวิตในครรภ์</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label="ความเสี่ยงที่ต้องเฝ้าระวัง (Risk monitoring)"
                    name="risk_factors"
                  >
                    <Select mode="tags" placeholder="เลือกได้มากกว่า 1 ข้อ หรือพิมพ์เพิ่ม" allowClear>
                      <Option value="อายุน้อยกว่า 17 ปี">อายุน้อยกว่า 17 ปี</Option>
                      <Option value="อายุตั้งแต่ 35 ปี">อายุตั้งแต่ 35 ปี</Option>
                      <Option value="ครรภ์แรก">ครรภ์แรก (Primigravida)</Option>
                      <Option value="ครรภ์หลังตั้งแต่ 5">ครรภ์หลังตั้งแต่ 5 (Grand multipara)</Option>
                      <Option value="ครรภ์แฝด">ครรภ์แฝด</Option>
                      <Option value="เคยผ่าตัดคลอด">เคยผ่าตัดคลอด (Previous C/S)</Option>
                      <Option value="ความดันโลหิตสูง/ครรภ์เป็นพิษ">ความดันโลหิตสูง / ครรภ์เป็นพิษ</Option>
                      <Option value="เบาหวานขณะตั้งครรภ์">เบาหวานขณะตั้งครรภ์ (GDM)</Option>
                      <Option value="ภาวะซีด">ภาวะซีด (Anemia)</Option>
                      <Option value="รกเกาะต่ำ">รกเกาะต่ำ (Placenta previa)</Option>
                      <Option value="ทารกท่าผิดปกติ">ทารกท่าผิดปกติ</Option>
                      <Option value="น้ำเดินก่อนเจ็บครรภ์">น้ำเดินก่อนเจ็บครรภ์ (PROM)</Option>
                      <Option value="เจ็บครรภ์ก่อนกำหนด">เจ็บครรภ์ก่อนกำหนด (Preterm)</Option>
                      <Option value="ครรภ์เกินกำหนด">ครรภ์เกินกำหนด (Post-term)</Option>
                      <Option value="ติดเชื้อ HIV/ซิฟิลิส/ไวรัสตับอักเสบบี">
                        ติดเชื้อ HIV / ซิฟิลิส / ไวรัสตับอักเสบบี
                      </Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    label={
                      <Space size={6}>
                        ภาวะแทรกซ้อนขณะตั้งครรภ์ (Complication)
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, height: 'auto', fontSize: 11 }}
                          onClick={() => setField('pregnancy_complication', 'ไม่มี')}
                        >
                          ไม่มี
                        </Button>
                      </Space>
                    }
                    name="pregnancy_complication"
                  >
                    <Input placeholder="ระบุ หรือกด 'ไม่มี' — เกณฑ์กำหนดให้ต้องระบุเสมอ" />
                  </Form.Item>

                  <Divider style={{ margin: '4px 0 12px' }} titlePlacement="start" plain>
                    <Text strong style={{ fontSize: 12, color: '#e11d48' }}>
                      <PiStethoscopeBold style={{ verticalAlign: '-2px', marginRight: 4 }} />
                      การตรวจร่างกายโดยแพทย์หรือพยาบาล
                    </Text>
                  </Divider>

                  <Row gutter={12}>
                    <Col xs={24} sm={8} xl={4}>
                      <Form.Item label="ยอดมดลูก (ซม.)" name="fundal_height">
                        <InputNumber min={0} max={60} step={0.5} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} xl={12}>
                      <Form.Item label="ท่าของทารก (Presentation)" name="fetal_presentation">
                        <Segmented
                          block
                          options={segOptions(PRESENTATION_LEVELS, watched?.fetal_presentation as string)}
                          style={segStyle(PRESENTATION_LEVELS, watched?.fetal_presentation as string)}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={16} xl={8}>
                      <Form.Item
                        label={
                          <Space size={6}>
                            ผู้ตรวจร่างกาย
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: 0, height: 'auto', fontSize: 11 }}
                              onClick={() => setField('physical_exam_by', getUserProfile()?.fullname || '')}
                            >
                              ใช้ชื่อฉัน
                            </Button>
                          </Space>
                        }
                        name="physical_exam_by"
                      >
                        <Input placeholder="ชื่อ-สกุล แพทย์ / พยาบาลผู้ตรวจ" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label="ผลการตรวจร่างกาย" name="physical_exam_note">
                    <TextArea
                      placeholder="บันทึกผลการตรวจร่างกายแรกรับ"
                      autoSize={{ minRows: 2, maxRows: 5 }}
                    />
                  </Form.Item>

                  <Divider style={{ margin: '4px 0 12px' }} titlePlacement="start" plain>
                    <Text strong style={{ fontSize: 12, color: '#e11d48' }}>
                      <PiWaveTriangleBold style={{ verticalAlign: '-2px', marginRight: 4 }} />
                      การประเมินระยะรอคลอด ณ แรกรับ (Progress of labour)
                    </Text>
                  </Divider>

                  <Row gutter={12}>
                    <Col xs={24} sm={12} xl={6}>
                      <Form.Item label="วันเวลาที่ประเมิน" name="labour_assess_datetime">
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={6} xl={4}>
                      <Form.Item label="หดรัดตัวทุก (นาที)" name="uc_interval">
                        <Input placeholder="เช่น 3-4" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={6} xl={4}>
                      <Form.Item label="นาน (วินาที)" name="uc_duration">
                        <InputNumber min={0} max={180} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} xl={10}>
                      <Form.Item label="ความแรงการหดรัดตัว" name="uc_intensity">
                        <Segmented
                          block
                          options={segOptions(UC_INTENSITY_LEVELS, watched?.uc_intensity as string)}
                          style={segStyle(UC_INTENSITY_LEVELS, watched?.uc_intensity as string)}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={12}>
                    <Col xs={24} xl={12}>
                      <Form.Item
                        label={
                          <Space size={6}>
                            ปากมดลูกเปิด (Dilatation)
                            <Tag color="magenta" style={{ margin: 0 }}>
                              {dilation != null ? `${dilation} ซม.` : 'ยังไม่ประเมิน'}
                            </Tag>
                          </Space>
                        }
                        name="cervical_dilation"
                        style={{ paddingInline: 4 }}
                      >
                        <Slider min={0} max={10} step={1} marks={DILATION_MARKS} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8} xl={4}>
                      <Form.Item label="ความบาง (Effacement %)" name="cervical_effacement">
                        <InputNumber min={0} max={100} step={10} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={16} xl={8}>
                      <Form.Item label="ถุงน้ำคร่ำ (Membrane)" name="membrane_status">
                        <Segmented
                          block
                          options={segOptions(MEMBRANE_STATES, watched?.membrane_status as string)}
                          style={segStyle(MEMBRANE_STATES, watched?.membrane_status as string)}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* สีน้ำคร่ำและเวลาน้ำเดินมีความหมายเฉพาะเมื่อถุงน้ำคร่ำแตกแล้ว */}
                  {membraneRuptured && (
                    <Row gutter={12}>
                      <Col xs={24} sm={12} xl={6}>
                        <Form.Item label="เวลาน้ำเดิน" name="membrane_rupture_datetime">
                          <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} xl={18}>
                        <Form.Item label="ลักษณะน้ำคร่ำ" name="amniotic_fluid">
                          <Segmented
                            block
                            options={segOptions(AMNIOTIC_STATES, watched?.amniotic_fluid as string)}
                            style={segStyle(AMNIOTIC_STATES, watched?.amniotic_fluid as string)}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  )}

                  <Row gutter={12}>
                    <Col xs={24} sm={10} xl={5}>
                      <Form.Item
                        label={
                          <Space size={6}>
                            FHS (ครั้ง/นาที)
                            {fhsInfo && (
                              <Tag color={fhsInfo.color} style={{ margin: 0 }}>
                                {fhsInfo.text}
                              </Tag>
                            )}
                          </Space>
                        }
                        name="fetal_heart_sound"
                      >
                        <InputNumber placeholder="140" min={0} max={250} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={14} xl={7}>
                      <Form.Item label="จังหวะการเต้น" name="fhs_regularity">
                        <Segmented
                          block
                          options={segOptions(FHS_REGULARITY, watched?.fhs_regularity as string)}
                          style={segStyle(FHS_REGULARITY, watched?.fhs_regularity as string)}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} xl={12}>
                      <Form.Item
                        label={
                          <Space size={6}>
                            ระดับส่วนนำ (Station)
                            <Tag color="magenta" style={{ margin: 0 }}>
                              {station != null
                                ? station > 0
                                  ? `+${station}`
                                  : String(station)
                                : 'ยังไม่ประเมิน'}
                            </Tag>
                          </Space>
                        }
                        name="fetal_station"
                        style={{ paddingInline: 4 }}
                      >
                        <Slider min={-5} max={5} step={1} marks={STATION_MARKS} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label={
                      <Space size={6}>
                        ภาวะแทรกซ้อนระยะรอคลอด
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, height: 'auto', fontSize: 11 }}
                          onClick={() => setField('labour_complication', 'ไม่มี')}
                        >
                          ไม่มี
                        </Button>
                      </Space>
                    }
                    name="labour_complication"
                    style={{ marginBottom: 0 }}
                  >
                    <Input placeholder="ระบุ หรือกด 'ไม่มี' — เกณฑ์กำหนดให้ต้องระบุเสมอ" />
                  </Form.Item>
                </>
              )}
            </SectionCard>
          </Col>

          {/* ── แถวล่าง ── */}
          <Col xs={24} xl={12}>
            <Flex vertical gap={16}>
              <SectionCard icon={<PiShieldWarningBold />} title="ประเมินความเสี่ยง / อุปกรณ์ติดตัว" accentColor="#0891b2">
                <Row gutter={12}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="ความเสี่ยงพลัดตกหกล้ม" name="fall_risk_screen">
                      <Segmented
                        block
                        options={segOptions(RISK_LEVELS, watched?.fall_risk_screen as string)}
                        style={segStyle(RISK_LEVELS, watched?.fall_risk_screen as string)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="ความเสี่ยงแผลกดทับ" name="pressure_sore_screen">
                      <Segmented
                        block
                        options={segOptions(RISK_LEVELS, watched?.pressure_sore_screen as string)}
                        style={segStyle(RISK_LEVELS, watched?.pressure_sore_screen as string)}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="อุปกรณ์ที่ติดตัวมา" name="devices">
                  <Select mode="tags" placeholder="เลือกหรือพิมพ์เพิ่ม" allowClear>
                    <Option value="IV line">IV line</Option>
                    <Option value="NG tube">NG tube</Option>
                    <Option value="Foley catheter">Foley catheter</Option>
                    <Option value="O2 cannula">O2 cannula</Option>
                    <Option value="ET tube">ET tube</Option>
                    <Option value="Drain">Drain</Option>
                    <Option value="Wound dressing">Wound dressing</Option>
                  </Select>
                </Form.Item>
                {/* แยกคนละบรรทัด เพราะ 4 ตัวเลือกของ "ดื่มสุรา" มีข้อความยาวจนตกหล่นเมื่ออยู่ครึ่งแถว */}
                <Form.Item label="สูบบุหรี่" name="smoking">
                  <Segmented
                    block
                    options={segOptions(SMOKING_LEVELS, watched?.smoking as string)}
                    style={segStyle(SMOKING_LEVELS, watched?.smoking as string)}
                  />
                </Form.Item>
                <Form.Item label="ดื่มสุรา" name="alcohol">
                  <Segmented
                    block
                    options={segOptions(ALCOHOL_LEVELS, watched?.alcohol as string)}
                    style={segStyle(ALCOHOL_LEVELS, watched?.alcohol as string)}
                  />
                </Form.Item>
                <Form.Item label="การปฐมนิเทศแรกรับ" name="orientation_given">
                  <Select mode="tags" placeholder="เลือกหัวข้อที่แนะนำแล้ว" allowClear>
                    <Option value="แนะนำหอผู้ป่วย">แนะนำหอผู้ป่วย</Option>
                    <Option value="แนะนำทีมผู้ดูแล">แนะนำทีมผู้ดูแล</Option>
                    <Option value="สิทธิผู้ป่วย">สิทธิผู้ป่วย</Option>
                    <Option value="การใช้กริ่งเรียก">การใช้กริ่งเรียก</Option>
                    <Option value="ระเบียบการเยี่ยม">ระเบียบการเยี่ยม</Option>
                    <Option value="การป้องกันพลัดตกหกล้ม">การป้องกันพลัดตกหกล้ม</Option>
                  </Select>
                </Form.Item>
                <Form.Item label="ของมีค่าที่นำมา / ฝากไว้" name="valuables">
                  <Input placeholder="ระบุ หรือ 'ไม่มี'" />
                </Form.Item>
              </SectionCard>

              <SectionCard icon={<PiUsersFourBold />} title="ผู้ดูแล / ญาติ" accentColor="#f59e0b">
                <Row gutter={12}>
                  <Col span={8}>
                    <Form.Item label="ชื่อผู้ดูแล" name="caregiver_name">
                      <Input placeholder="ระบุชื่อ" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="ความสัมพันธ์" name="caregiver_relation">
                      <Select placeholder="เลือก" allowClear>
                        <Option value="spouse">คู่สมรส</Option>
                        <Option value="parent">บิดา/มารดา</Option>
                        <Option value="child">บุตร</Option>
                        <Option value="sibling">พี่น้อง</Option>
                        <Option value="relative">ญาติ</Option>
                        <Option value="other">อื่นๆ</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="เบอร์โทร" name="caregiver_phone">
                      <Input placeholder="0xx-xxx-xxxx" inputMode="tel" />
                    </Form.Item>
                  </Col>
                </Row>
              </SectionCard>
            </Flex>
          </Col>
          <Col xs={24} xl={12}>
            <Flex vertical gap={16}>
              <SectionCard
                icon={<PiNotePencilBold />}
                title="การวินิจฉัยและแผนการรักษา/พยาบาล"
                accentColor="#6366f1"
              >
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="สรุปการวินิจฉัยโรค" name="diagnosis_summary">
                      <TextArea placeholder="ระบุสรุปการวินิจฉัยโรคจากแพทย์" autoSize={{ minRows: 2, maxRows: 6 }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="สรุปแผนการรักษา" name="treatment_summary">
                      <TextArea placeholder="ระบุสรุปแผนการรักษาของแพทย์" autoSize={{ minRows: 2, maxRows: 6 }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="ข้อวินิจฉัยทางการพยาบาล" name="nursing_diagnosis">
                      <TextArea placeholder="ระบุข้อวินิจฉัย" autoSize={{ minRows: 2, maxRows: 6 }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="แผนการพยาบาล" name="nursing_plan">
                      <TextArea placeholder="ระบุแผนการพยาบาล" autoSize={{ minRows: 2, maxRows: 6 }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider style={{ margin: '4px 0 12px' }} />

                <Row gutter={12}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="พยาบาลผู้บันทึก" name="nurse_name" style={{ marginBottom: 0 }}>
                      <Input placeholder="ระบุชื่อ" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="วันที่/เวลา" name="record_datetime" style={{ marginBottom: 0 }}>
                      <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </SectionCard>

              {/* หัวข้อบังคับตามเกณฑ์ตรวจประเมินคุณภาพการบันทึกทางการพยาบาล */}
              <SectionCard icon={<PiSealCheckBold />} title="มาตรฐานการบันทึก (Audit)" accentColor="#0d9488">
                <Row gutter={12}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="การระบุตัวผู้ป่วย / ป้ายข้อมือ" name="patient_identified">
                      <Segmented
                        block
                        options={segOptions(DONE_STATES, watched?.patient_identified as string)}
                        style={segStyle(DONE_STATES, watched?.patient_identified as string)}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="แจ้งข้อมูล / ขอความยินยอม" name="informed_consent">
                      <Segmented
                        block
                        options={segOptions(DONE_STATES, watched?.informed_consent as string)}
                        style={segStyle(DONE_STATES, watched?.informed_consent as string)}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="การป้องกันการแพร่กระจายเชื้อ (Isolation precaution)"
                  name="isolation_precaution"
                >
                  <Select mode="tags" placeholder="เลือกหรือพิมพ์เพิ่ม" allowClear>
                    <Option value="Standard">Standard precaution</Option>
                    <Option value="Contact">Contact</Option>
                    <Option value="Droplet">Droplet</Option>
                    <Option value="Airborne">Airborne</Option>
                    <Option value="Protective">Protective (ภูมิคุ้มกันต่ำ)</Option>
                  </Select>
                </Form.Item>

                <Divider style={{ margin: '4px 0 12px' }} titlePlacement="start" plain>
                  <Text strong style={{ fontSize: 12, color: '#0d9488' }}>
                    <PiSealCheckBold style={{ verticalAlign: '-2px', marginRight: 4 }} />
                    การวางแผนจำหน่ายตั้งแต่แรกรับ (D-METHOD)
                  </Text>
                </Divider>

                <Form.Item label="หัวข้อที่วางแผนไว้" name="discharge_plan_topics">
                  <Select mode="multiple" placeholder="เลือกหัวข้อตาม D-METHOD" allowClear>
                    <Option value="D-Diagnosis">D — ความรู้เรื่องโรค</Option>
                    <Option value="M-Medicine">M — การใช้ยา</Option>
                    <Option value="E-Environment">E — สิ่งแวดล้อม/แหล่งช่วยเหลือ</Option>
                    <Option value="T-Treatment">T — การรักษาต่อเนื่อง</Option>
                    <Option value="H-Health">H — การส่งเสริมสุขภาพ</Option>
                    <Option value="O-Outpatient">O — การมาตรวจตามนัด</Option>
                    <Option value="D-Diet">D — อาหาร</Option>
                  </Select>
                </Form.Item>

                <Row gutter={12}>
                  <Col xs={24} sm={8}>
                    <Form.Item label="คาดการณ์วันนอน (วัน)" name="expected_los">
                      <InputNumber placeholder="3" min={0} max={365} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={16}>
                    <Form.Item label="ผู้ทบทวน (หัวหน้าเวร)" name="reviewed_by">
                      <Input placeholder="ระบุชื่อผู้ทบทวนบันทึก" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="บันทึกแผนจำหน่าย" name="discharge_plan_note" style={{ marginBottom: 0 }}>
                  <TextArea placeholder="ระบุรายละเอียดแผนการจำหน่ายและการเตรียมผู้ดูแล" autoSize={{ minRows: 2, maxRows: 6 }} />
                </Form.Item>
              </SectionCard>
            </Flex>
          </Col>
        </Row>
      )}

      {/* ── แถบบันทึกติดขอบล่าง กดได้จากทุกจุดโดยไม่ต้องเลื่อนลงสุด ── */}
      {!loading && (
        <Affix offsetBottom={0}>
          <Card size="small" style={{ marginTop: 16, borderRadius: 0 }} styles={{ body: { padding: '10px 16px' } }}>
            <Flex align="center" justify="space-between" gap={12} wrap>
              <Space size={8} wrap>
                {existingRecord ? (
                  <Tag color="blue" style={{ margin: 0 }}>
                    แก้ไขบันทึกเดิม
                    {existingRecord.updated_at
                      ? ` · แก้ไขล่าสุด ${dayjs(existingRecord.updated_at).format('DD/MM/YYYY HH:mm')}`
                      : ''}
                  </Tag>
                ) : (
                  <Tag color="green" style={{ margin: 0 }}>
                    บันทึกใหม่
                  </Tag>
                )}
                {vitalWarnings.length > 0 && (
                  <Text type="warning" style={{ fontSize: 12 }}>
                    มีค่าสัญญาณชีพผิดปกติ {vitalWarnings.length} รายการ
                  </Text>
                )}
              </Space>

              <Space>
                <Button onClick={() => form.resetFields()}>ล้างฟอร์ม</Button>
                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}>
                  บันทึกข้อมูล
                </Button>
              </Space>
            </Flex>
          </Card>
        </Affix>
      )}
    </Form>
  );
}

export default function AdmitRecord({ an }: { an: string }) {
  return (
    // ธีมและ <App> มาจาก ThemeProvider ที่ layout ระดับราก
    // ถ้าประกาศ ConfigProvider ซ้ำตรงนี้ หน้าจะถูกล็อกไว้ที่โหมดสว่างเสมอ
    <div style={{ background: 'var(--app-bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
            <AdmitRecordInner an={an} />
      </div>
    </div>
  );
}
