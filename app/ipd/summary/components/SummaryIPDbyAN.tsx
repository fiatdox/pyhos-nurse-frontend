"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Font,
  Image,
  PDFViewer,
} from '@react-pdf/renderer';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import {
  checkRange, REFERENCE_RANGE, TEMP_RANGE, AGE_GROUP_LABEL, type AgeGroup, type Avpu,
} from '../../../lib/news2';
// ใช้คำแปลชุดเดียวกับฟอร์มบันทึก รายงานกับหน้าจอจะได้อ่านตรงกัน
import {
  TEMP_ROUTES, PULSE_SITES, RESP_PATTERNS, O2_DEVICES, GLUCOSE_TIMINGS, AVPU_OPTIONS, labelOf,
} from '../../../lib/vitalOptions';

dayjs.extend(buddhistEra);
dayjs.locale('th');

// 1. ลงทะเบียน Font Sarabun
Font.register({
  family: 'Sarabun',
  fonts: [
    { src: '/fonts/Sarabun/Sarabun-Regular.ttf' },
    { src: '/fonts/Sarabun/Sarabun-Bold.ttf', fontWeight: 'bold' },
  ],
});

/**
 * หัวกระดาษของโรงพยาบาล
 *
 * รวมไว้ที่เดียวเพราะใบนี้พิมพ์ออกไปเก็บในแฟ้มเวชระเบียน ถ้าที่อยู่หรือเบอร์เปลี่ยน
 * ต้องแก้จุดเดียวแล้วทุกหน้าทั้งสิบใบเปลี่ยนตาม ไม่ใช่ไล่แก้ทีละหน้าแล้วตกหล่น
 *
 * !! ที่อยู่กับเบอร์โทรด้านล่างยังไม่ได้ยืนยันกับงานเวชระเบียน !!
 * กรุณาตรวจให้ตรงกับหัวกระดาษของฟอร์มจริงก่อนนำไปใช้ เพราะเอกสารนี้เป็นส่วนหนึ่ง
 * ของเวชระเบียน ข้อมูลติดต่อที่ผิดบนเอกสารที่ส่งต่อให้หน่วยงานอื่นแก้ย้อนหลังไม่ได้
 */
const HOSPITAL = {
    nameTh: 'โรงพยาบาลพะเยา',
    nameEn: 'Phayao Hospital',
    address: '269 หมู่ 11 ถนนพหลโยธิน ตำบลบ้านต๋อม อำเภอเมืองพะเยา จังหวัดพะเยา 56000',
    phone: 'โทร. 0-5440-9300',
    /* ไฟล์อยู่ที่ public/assets/images/ Next เสิร์ฟโฟลเดอร์ public ที่รากของเว็บ
       เขียนตามชื่อไฟล์จริงรวมช่องว่าง เบราว์เซอร์เข้ารหัสให้เองตอนร้องขอ */
    logo: '/assets/images/logo MOPH.png',
};

// 2. Styles
const styles = StyleSheet.create({
  /*
    หัวกับท้ายกระดาษวางแบบ absolute และสั่ง fixed จึงซ้ำทุกหน้ารวมถึงหน้าที่ล้นมาเอง
    ตัวเนื้อหาต้องเว้นที่ด้านบนล่างให้พอ ไม่งั้นบรรทัดแรกจะพิมพ์ทับหัวกระดาษ
  */
  page: {
    paddingTop: 96,
    paddingBottom: 38,
    paddingHorizontal: 28,
    fontFamily: 'Sarabun',
    fontSize: 8,
    lineHeight: 1.4,
  },
  /*
    ระบุความกว้างตรง ๆ ไม่ใช้ left คู่กับ right
    กระดาษ A4 กว้าง 595.28 pt หักขอบซ้ายขวาข้างละ 28 เหลือ 539.28
  */
  formHeader: {
    position: 'absolute',
    top: 22,
    left: 28,
    width: 539.28,
  },
  /*
    ต้องกำหนดความสูงตรง ๆ

    กล่องหัวกระดาษวางแบบ absolute จึงไม่มีความสูงของพ่อแม่มาจำกัด
    แถวข้างในเลยยืดเต็มพื้นที่ที่เหลือของหน้า สูงราวสามพันจุด
    พอสั่ง alignItems center ลูกทุกตัวก็ไปอยู่กึ่งกลางของสามพันจุดนั้น
    คือหลุดใต้กระดาษไปไกล ส่วนเส้นคั่นใต้แถวก็ไปอยู่ที่ก้นกล่องเช่นกัน
    เหลือแต่คอลัมน์ขวาที่กำหนดความกว้างไว้เองเลยยังพอเห็น
    จึงดูเหมือนหัวกระดาษหายไปครึ่งเดียว

    ล็อกความสูงไว้ แถวจึงสูงเท่าโลโก้ ลูกทุกตัวกลับมาอยู่ในกรอบ
  */
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderBottomWidth: 1.5,
    borderBottomColor: '#006b5f',
    borderBottomStyle: 'solid',
    paddingBottom: 4,
  },
  logo: { width: 40, height: 40, marginRight: 9 },
  /* ชื่อไทยกับอังกฤษอยู่บรรทัดเดียวกันด้วย Text ซ้อนใน Text ไม่ต้องเปลืองอีกบรรทัด */
  hospitalTh: { fontSize: 12.5, fontWeight: 'bold', color: '#006b5f', lineHeight: 1.25 },
  hospitalEn: { fontSize: 7.5, fontWeight: 'normal', color: '#6b7a78' },
  hospitalMeta: { fontSize: 6.5, color: '#6b7a78', lineHeight: 1.35 },
  headerRight: { width: 100, alignItems: 'flex-end' },
  docCode: { fontSize: 6.5, color: '#8a9795', lineHeight: 1.4 },
  /*
    ชื่อฟอร์มเป็นแถบชิดซ้าย มีขีดเขียวนำหน้า
    แบบฟอร์มกระดาษของโรงพยาบาลวางชื่อฟอร์มชิดซ้ายเหมือนกัน
    และสายตาที่ไล่จากซ้ายลงมาอ่านบล็อกผู้ป่วยต่อ จะได้ไม่ต้องวิ่งกลับไปกลางหน้า

    ต้องกำหนดความสูงให้ทั้งแถบและขีด ด้วยเหตุผลเดียวกับ formHeaderRow
    กล่อง absolute ไม่มีความสูงของพ่อแม่มาจำกัด ลูกจะยืดจนหลุดกระดาษ
  */
  titleBand: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 17,
    marginTop: 6,
    backgroundColor: '#eef6f5',
  },
  titleBar: { width: 3, height: 17, backgroundColor: '#006b5f', marginRight: 7 },
  titleText: { fontSize: 10.5, fontWeight: 'bold', color: '#00564d' },
  /* ล็อกความสูงด้วยเหตุผลเดียวกับหัวกระดาษ */
  formFooter: {
    position: 'absolute',
    bottom: 18,
    left: 28,
    width: 539.28,
    height: 12,
    flexDirection: 'row',
    fontSize: 6.5,
    color: '#888',
    borderTopWidth: 0.5,
    borderTopColor: '#ccc',
    borderTopStyle: 'solid',
    paddingTop: 3,
  },
  subHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#e9ecef',
    padding: 3,
  },
  text: { fontSize: 8 },
  bold: { fontWeight: 'bold' },
  row: { flexDirection: 'row', marginBottom: 4 },
  col4: { width: '25%' },
  col6: { width: '50%' },
  col12: { width: '100%' },
  
  // Table
  table: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#bfbfbf',
    borderTopStyle: 'solid',
    borderLeftWidth: 1,
    borderLeftColor: '#bfbfbf',
    borderLeftStyle: 'solid',
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableColHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#bfbfbf',
    borderBottomStyle: 'solid',
    borderRightWidth: 1,
    borderRightColor: '#bfbfbf',
    borderRightStyle: 'solid',
    padding: 4,
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCol: {
    borderBottomWidth: 1,
    borderBottomColor: '#bfbfbf',
    borderBottomStyle: 'solid',
    borderRightWidth: 1,
    borderRightColor: '#bfbfbf',
    borderRightStyle: 'solid',
    padding: 4,
  },
  w10: { width: '10%' },
  w15: { width: '15%' },
  w20: { width: '20%' },
  w25: { width: '25%' },
  w30: { width: '30%' },
  w40: { width: '40%' },
  w50: { width: '50%' },
  flex1: { flex: 1 },
});

// 3. ข้อมูลผู้ป่วยจาก HIS
export interface PatientData {
  hn: string;
  an: string;
  name: string;
  age: number | null;
  gender: string;
  rights: string;
  admitDate: string;
  ward: string;
  bed: string;
  doctor: string;
}

/** ข้อมูลดิบจาก /api/v1/patients/patient-by-an */
interface PatientRow {
  hn?: string;
  an?: string;
  ptname?: string;
  birthday?: string;
  sex?: string;
  ward?: string;
  ward_name?: string;
  bedno?: string;
  doctor_name?: string;
  regdate?: string;
  pttype_name?: string;
}

/** บันทึกแรกรับจาก /api/v1/nursing-records/admit/:an — คีย์ตรงกับชื่อคอลัมน์ */
type AdmitRecord = Record<string, unknown>;

/**
 * แผนการพยาบาลจาก /api/v1/nursing-records/focus/:an
 *
 * รูปร่างของฟอร์มไม่ได้อยู่ในโค้ด แต่อยู่ใน structure ของแต่ละบันทึก
 * เพราะแต่ละหอใช้แม่แบบของตัวเอง และแม่แบบถูกคัดลอกติดไปกับบันทึกตอนบันทึก
 * รายงานย้อนหลังจึงต้องวาดตามแม่แบบรุ่นที่ใช้ตอนนั้น ไม่ใช่รุ่นล่าสุดในระบบ
 */
type PlanAnswer = boolean | number | string;

interface PlanEval {
  id: string;
  kind: 'check' | 'choice' | 'number' | 'text' | 'time';
  label: string;
  unit?: string | null;
  options?: string[];
  allow_other?: boolean;
}

interface PlanSection {
  id: string;
  title: string;
  activities: string[];
  evaluations: PlanEval[];
}

interface FocusRecord {
  id: number;
  template_code: string;
  template_title: string;
  template_version: number;
  structure: { sections: PlanSection[] } | null;
  answers: Record<string, PlanAnswer> | null;
  record_datetime: string;
  shift?: string | null;
  status: 'draft' | 'final' | 'cancelled';
  nurse_name?: string | null;
  nurse_major?: string | null;
  note?: string | null;
  is_late_entry?: boolean;
  entered_at?: string | null;
  late_entry_reason?: string | null;
  cancel_reason?: string | null;
  cancelled_by_name?: string | null;
}

/**
 * สัญญาณชีพจาก /api/v1/nursing-records/vital/:an
 * ประกาศเป็น type ไม่ใช่ interface เพื่อให้ส่งเข้าตัวช่วยที่รับ Record<string, unknown> ได้
 */
type VitalRow = {
  id: number;
  record_datetime: string;
  entered_at?: string;
  shift?: string;
  is_late_entry?: boolean;
  late_entry_reason?: string;
  device_id?: string;
  vital_t?: string | number;
  temp_route?: string;
  vital_p?: number;
  pulse_rhythm?: string;
  pulse_site?: string;
  vital_r?: number;
  resp_pattern?: string;
  vital_bp_s?: number;
  vital_bp_d?: number;
  map_value?: string | number;
  pulse_pressure?: number;
  vital_o2sat?: number;
  o2_therapy?: string;
  o2_device?: string;
  o2_flow?: string | number;
  pain_score?: number;
  avpu?: Avpu;
  gcs_total?: number;
  blood_glucose?: string | number;
  glucose_timing?: string;
  urine_output_ml?: number;
  news2_score?: number;
  news2_risk?: string;
  news2_scale?: number;
  monitor_freq?: string;
  nurse_name?: string;
};

type VitalMeta = {
  age_group: AgeGroup | null;
  age_known: boolean;
  news2_applicable: boolean;
};

const RISK_TH: Record<string, string> = {
  low: 'ความเสี่ยงต่ำ',
  low_medium: 'ความเสี่ยงต่ำ–ปานกลาง',
  medium: 'ความเสี่ยงปานกลาง',
  high: 'ความเสี่ยงสูง',
};

const SEX_LABEL: Record<string, string> = { '1': 'ชาย', '2': 'หญิง' };

const toPatientData = (row: PatientRow | null, an: string): PatientData => ({
  hn: row?.hn ?? '-',
  an: row?.an ?? an,
  name: row?.ptname ?? '-',
  age: row?.birthday ? dayjs().diff(dayjs(row.birthday), 'year') : null,
  gender: SEX_LABEL[String(row?.sex ?? '')] ?? '-',
  rights: row?.pttype_name ?? '-',
  admitDate: row?.regdate ? dayjs(row.regdate).format('D MMMM BBBB HH:mm น.') : '-',
  ward: row?.ward_name ?? row?.ward ?? '-',
  bed: row?.bedno ?? '-',
  doctor: row?.doctor_name ?? '-',
});

// ---------- ตัวช่วยแปลงค่าที่เก็บเป็นรหัสให้เป็นข้อความไทย ----------

const LABELS: Record<string, Record<string, string>> = {
  admit_from: { ER: 'ห้องฉุกเฉิน (ER)', OPD: 'ผู้ป่วยนอก (OPD)', OR: 'ห้องผ่าตัด (OR)', ICU: 'ICU', WARD: 'หอผู้ป่วยอื่น', REFER: 'ส่งต่อจากสถานพยาบาลอื่น (Refer)' },
  admit_method: { walk: 'เดินมาเอง', wheelchair: 'รถเข็นนั่ง (Wheelchair)', stretcher: 'รถนอน (Stretcher)', ambulance: 'รถพยาบาล' },
  general_appearance: { good: 'ดี', fair: 'พอใช้', poor: 'ไม่ดี', critical: 'วิกฤต' },
  mobility: { independent: 'ทำเองได้', assist: 'ต้องมีผู้ช่วย', bedridden: 'ติดเตียง', wheelchair: 'ใช้รถเข็น' },
  breathing: { normal: 'ปกติ', tachypnea: 'หายใจหอบ', dyspnea: 'หายใจลำบาก', apnea: 'ไม่หายใจ', other: 'อื่นๆ' },
  circulation: { normal: 'ปกติ', pale: 'ซีด', peripheral_cyanosis: 'ปลายมือปลายเท้าเขียว', perioral_cyanosis: 'รอบปากเขียว', central_cyanosis: 'เขียวทั่วตัว' },
  edema: { none: 'ไม่มี', present: 'บวม' },
  hearing: { clear: 'ได้ยินชัดเจน', impaired: 'ได้ยินไม่ชัดเจน' },
  hearing_aid: { yes: 'ใช้อุปกรณ์ช่วยฟัง', no: 'ไม่ใช้อุปกรณ์ช่วยฟัง' },
  vision: { clear: 'เห็นชัดเจน', impaired: 'เห็นไม่ชัดเจน' },
  eyeglasses: { yes: 'สวมแว่นตา', no: 'ไม่สวมแว่นตา' },
  speech: { clear: 'ชัดเจน', stutter: 'พูดติดอ่าง', mute: 'เป็นใบ้', other: 'อื่นๆ' },
  emotional_state: { calm: 'สงบ', anxious: 'วิตกกังวล', depressed: 'ซึมเศร้า', agitated: 'สับสน/กระวนกระวาย' },
  adl_level: { independent: 'ช่วยตัวเองได้', partial: 'ต้องช่วยบางส่วน', dependent: 'ต้องช่วยทั้งหมด' },
  consciousness: { alert: 'รู้สึกตัวดี (Alert)', drowsy: 'ซึม (Drowsy)', stupor: 'สับสน/ปลุกตื่นยาก (Stupor)', coma: 'ไม่รู้สึกตัว (Coma)' },
  nutrition_screening: { normal: 'ปกติ', risk: 'เสี่ยงต่อภาวะทุพโภชนาการ', malnutrition: 'ขาดสารอาหาร' },
  smoking: { never: 'ไม่สูบ', quit: 'เลิกแล้ว', current: 'สูบอยู่' },
  alcohol: { never: 'ไม่ดื่ม', occasional: 'เป็นครั้งคราว', regular: 'ดื่มประจำ', quit: 'เลิกแล้ว' },
  risk: { low: 'ต่ำ', moderate: 'ปานกลาง', high: 'สูง' },
  done: { done: 'ดำเนินการแล้ว', pending: 'ยังไม่ได้ดำเนินการ' },
  caregiver_relation: { spouse: 'คู่สมรส', parent: 'บิดา/มารดา', child: 'บุตร', sibling: 'พี่น้อง', relative: 'ญาติ', other: 'อื่นๆ' },
  fetal_presentation: { vertex: 'ศีรษะ (Vertex)', breech: 'ก้น (Breech)', transverse: 'ขวาง (Transverse)', other: 'อื่นๆ' },
  uc_intensity: { mild: 'เบา (Mild)', moderate: 'ปานกลาง (Moderate)', strong: 'แรง (Strong)' },
  membrane_status: { intact: 'ยังไม่แตก (Intact)', srom: 'แตกเอง (SROM)', arom: 'เจาะถุงน้ำ (AROM)' },
  amniotic_fluid: { clear: 'ใส', meconium: 'มีขี้เทาปน (Meconium)', bloody: 'มีเลือดปน', foul: 'มีกลิ่นเหม็น' },
  fhs_regularity: { regular: 'สม่ำเสมอ', irregular: 'ไม่สม่ำเสมอ' },
  // ใบบันทึกการรวบรวมข้อมูลแรกรับ (SD-IM-003.019)
  presence: { none: 'ไม่มี', present: 'มี' },
  ever: { none: 'ไม่เคย', present: 'เคย' },
  yesno: { yes: 'ใช่', no: 'ไม่ใช่' },
  social_role: { head: 'หัวหน้าครอบครัว', member: 'เป็นสมาชิกในครอบครัว', other: 'อื่นๆ' },
  family_housing: { settled: 'มีบ้านอยู่เป็นหลักแหล่ง', homeless: 'ไม่มีบ้านอยู่เป็นหลักแหล่ง' },
  caregiver_status: { has: 'มีผู้ดูแล', none: 'ไม่มีผู้ดูแล' },
};

const BLANK = '-';

/** อ่านค่าดิบ คืน '-' เมื่อไม่มีข้อมูล เพื่อให้เห็นชัดว่ายังไม่ได้บันทึก */
const val = (r: AdmitRecord, key: string): string => {
  const v = r[key];
  if (v === null || v === undefined || v === '') return BLANK;
  return String(v);
};

/** แปลงรหัสเป็นข้อความไทยตามชุด label ที่กำหนด */
const label = (r: AdmitRecord, key: string, set = key): string => {
  const v = r[key];
  if (v === null || v === undefined || v === '') return BLANK;
  return LABELS[set]?.[String(v)] ?? String(v);
};

const num = (r: AdmitRecord, key: string, unit = ''): string => {
  const v = r[key];
  if (v === null || v === undefined || v === '') return BLANK;
  return `${v}${unit ? ' ' + unit : ''}`;
};

const date = (r: AdmitRecord, key: string, fmt = 'D MMM BBBB'): string => {
  const v = r[key];
  if (!v) return BLANK;
  const d = dayjs(String(v));
  return d.isValid() ? d.format(fmt) : BLANK;
};

/** ต่อค่าหลายตัวเป็นบรรทัดเดียว ข้ามตัวที่ไม่มีข้อมูล */
const join = (parts: (string | null | undefined)[], sep = ' · ') =>
  parts.filter(p => p && p !== BLANK).join(sep) || BLANK;

// ---------- ชิ้นส่วนสำหรับวางข้อมูลใน PDF ----------

// paddingRight กันข้อความของคอลัมน์ที่ยาวจนขึ้นบรรทัดใหม่ไปชนคอลัมน์ถัดไป
const Field = ({ label: l, value, width }: { label: string; value: string; width?: string }) => (
  <Text style={width ? { width, paddingRight: 8 } : { ...styles.flex1, paddingRight: 8 }}>
    <Text style={styles.bold}>{l}: </Text>
    {value}
  </Text>
);

const Line = ({ label: l, value }: { label: string; value: string }) => (
  <Text style={{ marginBottom: 2 }}>
    <Text style={styles.bold}>{l}: </Text>
    {value}
  </Text>
);

/**
 * หัวกระดาษมาตรฐานของโรงพยาบาล ใช้ทุกหน้าของรายงานนี้
 *
 * สั่ง fixed เพื่อให้ซ้ำในหน้าที่ล้นออกไปเองด้วย เช่น ตารางสัญญาณชีพที่ยาวหลายหน้า
 * ถ้าไม่ซ้ำ หน้าที่สองของตารางจะเป็นกระดาษเปล่าไม่มีชื่อโรงพยาบาล
 * ซึ่งใช้เป็นเอกสารในแฟ้มเวชระเบียนไม่ได้ เพราะแผ่นที่หลุดออกมาจะไม่รู้ว่าของที่ไหน
 */
const FormHeader = ({ title, docCode }: { title: string; docCode?: string }) => (
  <View style={styles.formHeader} fixed>
    <View style={styles.formHeaderRow}>
      {/* Image ตัวนี้ของ @react-pdf ไม่ใช่ <img> ของ HTML จึงไม่มี prop alt ให้ใส่ */}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={HOSPITAL.logo} style={styles.logo} />
      <View style={styles.flex1}>
        <Text style={styles.hospitalTh}>
          {HOSPITAL.nameTh}
          <Text style={styles.hospitalEn}>  ·  {HOSPITAL.nameEn}</Text>
        </Text>
        <Text style={styles.hospitalMeta}>{HOSPITAL.address}</Text>
        <Text style={styles.hospitalMeta}>{HOSPITAL.phone}</Text>
      </View>
      <View style={styles.headerRight}>
        {!!docCode && <Text style={styles.docCode}>{docCode}</Text>}
        {/* เลขหน้าอยู่บนหัวกระดาษด้วย เวลาแฟ้มกระจายจะเรียงกลับได้โดยไม่ต้องพลิกดูท้ายแผ่น */}
        <Text
          style={styles.docCode}
          render={({ pageNumber, totalPages }) => `หน้า ${pageNumber} / ${totalPages}`}
        />
      </View>
    </View>
    <View style={styles.titleBand}>
      <View style={styles.titleBar} />
      <Text style={styles.titleText}>{title}</Text>
    </View>
  </View>
);

/*
  เวลาที่พิมพ์ต้องอยู่บนกระดาษ เพราะข้อมูลในระบบเปลี่ยนได้ตลอด
  ใบที่ถืออยู่ในมือจึงต้องบอกได้ว่าเป็นภาพของข้อมูล ณ เวลาไหน

  คิดเวลาเองตอนวาด ไม่ส่งผ่าน prop ลงไปทีละหน้า ทั้งสิบหน้าวาดในจังหวะเดียวกัน
  พอตัดที่หน่วยนาทีจึงได้ค่าเท่ากันหมด และไม่ต้องร้อย prop ผ่านทุกคอมโพเนนต์
*/
const FormFooter = () => (
  <View style={styles.formFooter} fixed>
    <Text style={styles.flex1}>{HOSPITAL.nameTh} · สรุปเวชระเบียนผู้ป่วยใน</Text>
    <Text style={{ textAlign: 'right' }}>พิมพ์เมื่อ {dayjs().format('D MMM BBBB HH:mm')} น.</Text>
  </View>
);

// 4. Component ส่วนหัวกระดาษที่ใช้ซ้ำทุกหน้า
const PatientHeader = ({ patientData }: { patientData: PatientData }) => (
  <View style={{ marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#ccc', borderBottomStyle: 'solid' }}>
    <View style={styles.row}>
      <Text style={styles.col6}><Text style={styles.bold}>ชื่อ-สกุล: </Text>{patientData.name}</Text>
      <Text style={styles.col6}><Text style={styles.bold}>HN: </Text>{patientData.hn}  <Text style={styles.bold}>AN: </Text>{patientData.an}</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.col4}><Text style={styles.bold}>อายุ: </Text>{patientData.age !== null ? `${patientData.age} ปี` : '-'}</Text>
      <Text style={styles.col4}><Text style={styles.bold}>เพศ: </Text>{patientData.gender}</Text>
      <Text style={styles.col6}><Text style={styles.bold}>สิทธิ: </Text>{patientData.rights}</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.col4}><Text style={styles.bold}>หอผู้ป่วย: </Text>{patientData.ward}</Text>
      <Text style={styles.col4}><Text style={styles.bold}>เตียง: </Text>{patientData.bed}</Text>
      <Text style={styles.col6}><Text style={styles.bold}>วันที่ Admit: </Text>{patientData.admitDate}</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.col12}><Text style={styles.bold}>แพทย์ผู้ดูแล: </Text>{patientData.doctor}</Text>
    </View>
  </View>
);

// ===================== Page 1 =====================
const AdmissionPage = ({ patientData, admit }: { patientData: PatientData; admit: AdmitRecord | null }) => (
  <Page size="A4" style={styles.page} wrap>
    {/* ชื่อตรงกับฟอร์มกระดาษ SD-IM-003.019 เพื่อให้เทียบกับแฟ้มเวชระเบียนได้ */}
    <FormHeader title="1. ใบบันทึกการรวบรวมข้อมูลแรกรับ (Admission Record)" docCode="SD-IM-003.019" />
    <FormFooter />
    <PatientHeader patientData={patientData} />

    {!admit ? (
      <Text style={{ marginTop: 20, textAlign: 'center', color: '#999' }}>
        ยังไม่มีการบันทึกแบบบันทึกการรับผู้ป่วยของ AN นี้
      </Text>
    ) : (
      <>
        <Text style={styles.subHeader}>ข้อมูลการรับเข้า</Text>
        <View style={styles.row}>
          <Field label="รับจาก" value={label(admit, 'admit_from')} width="33%" />
          <Field label="วิธีการมา" value={label(admit, 'admit_method')} width="33%" />
          <Field label="วันเวลาที่บันทึก" value={date(admit, 'record_datetime', 'D MMM BBBB HH:mm น.')} width="34%" />
        </View>
        <View style={styles.row}>
          <Field
            label="รับเข้าภายหลังจำหน่าย 28 วันด้วยโรคเดิม"
            value={label(admit, 'readmit_28_days', 'yesno')}
            width="50%"
          />
          {/* ต้นทางที่ส่งตัวมาแสดงเฉพาะเคสที่ Refer มา ไม่งั้นจะเป็นบรรทัดขีดเปล่าๆ ทุกใบ */}
          {admit.admit_from === 'REFER' && (
            <Field label="Refer จาก" value={val(admit, 'refer_from')} width="50%" />
          )}
        </View>
        <Line label="สาเหตุการรับเข้า" value={val(admit, 'admit_reason')} />
        {/* CC และ PI เป็นข้อความบรรยายยาว จึงคงเต็มความกว้างไว้ */}
        <Line label="อาการสำคัญที่มาโรงพยาบาล (CC)" value={val(admit, 'chief_complaint')} />
        <Line label="ประวัติการเจ็บป่วย (PI)" value={val(admit, 'present_illness')} />
        <Line label="อาการแรกรับ" value={val(admit, 'initial_symptoms')} />
        <Line label="ยาที่ใช้ปัจจุบัน" value={val(admit, 'current_medications')} />

        <Text style={styles.subHeader}>การประเมินแรกรับ (Initial Assessment)</Text>
        <View style={styles.row}>
          <Field label="อุณหภูมิ (T)" value={num(admit, 'vital_t', '°C')} width="20%" />
          <Field label="ชีพจร (PR)" value={num(admit, 'vital_p', '/min')} width="20%" />
          <Field label="หายใจ (RR)" value={num(admit, 'vital_r', '/min')} width="20%" />
          <Field label="ความดัน (BP)" value={val(admit, 'vital_bp')} width="22%" />
          <Field label="O2 Sat" value={num(admit, 'vital_o2sat', '%')} width="18%" />
        </View>
        <View style={styles.row}>
          <Field label="น้ำหนัก" value={num(admit, 'weight', 'kg')} width="20%" />
          <Field label="ส่วนสูง" value={num(admit, 'height', 'cm')} width="20%" />
          <Field label="BMI" value={num(admit, 'bmi')} width="20%" />
          <Field label="ความปวด (0-10)" value={num(admit, 'pain_score')} width="40%" />
        </View>
        <View style={styles.row}>
          <Field label="ระดับความรู้สึกตัว" value={label(admit, 'consciousness')} width="50%" />
          <Field label="ภาวะโภชนาการ" value={label(admit, 'nutrition_screening')} width="50%" />
        </View>

        {/* เรียงตามใบบันทึกการรวบรวมข้อมูลแรกรับ — ประวัติในอดีตอยู่ถัดจากสัญญาณชีพ
            ทุกข้อพิมพ์คำตอบ "ไม่มี" ออกมาด้วย เพราะไม่มีกับยังไม่ได้ถามต้องแยกกันให้ออก */}
        <Text style={styles.subHeader}>ประวัติการเจ็บป่วยในอดีต</Text>
        <Line
          label="ประวัติการแพ้ยา / อาหาร"
          value={join([
            label(admit, 'allergy_status', 'presence'),
            admit.allergy_status === 'present' ? val(admit, 'allergies') : null,
          ], ' — ')}
        />
        <Line
          label="ประวัติการผ่าตัด"
          value={join([
            label(admit, 'surgery_status', 'ever'),
            admit.surgery_status === 'present' ? val(admit, 'surgery_detail') : null,
          ], ' — ')}
        />
        <Line
          label="ประวัติการติดยา / สารเสพติด"
          value={join([
            label(admit, 'substance_status', 'presence'),
            admit.substance_status === 'present' ? val(admit, 'substance_detail') : null,
          ], ' — ')}
        />
        <Line
          label="โรคประจำตัว"
          value={join([
            label(admit, 'chronic_status', 'presence'),
            admit.chronic_status === 'present' ? val(admit, 'chronic_diseases') : null,
            admit.chronic_status === 'present' && admit.chronic_other
              ? `อื่นๆ ${val(admit, 'chronic_other')}` : null,
          ], ' — ')}
        />
        <Line
          label="ประวัติการรักษา"
          value={join([
            label(admit, 'treatment_status', 'presence'),
            admit.treatment_status === 'present' ? val(admit, 'treatment_detail') : null,
          ], ' — ')}
        />
        <Line label="บันทึกเพิ่มเติม (โรคประจำตัว / ประวัติผ่าตัด)" value={val(admit, 'past_illness')} />

        <Text style={styles.subHeader}>ข้อมูลทั่วไป / สถานภาพทางสังคม</Text>
        <View style={styles.row}>
          <Field
            label="สถานภาพทางสังคม"
            value={join([
              label(admit, 'social_role'),
              admit.social_role === 'head' && admit.dependents_count !== null && admit.dependents_count !== undefined
                ? `รับผิดชอบสมาชิก ${admit.dependents_count} คน` : null,
              admit.social_role === 'other' ? val(admit, 'social_other') : null,
            ], ' — ')}
            width="50%"
          />
          <Field
            label="ลักษณะครอบครัว"
            value={join([label(admit, 'family_housing'), label(admit, 'caregiver_status')])}
            width="50%"
          />
        </View>
        <Line
          label="ความพิการที่พบ"
          value={join([
            label(admit, 'disability_status', 'presence'),
            admit.disability_status === 'present' ? val(admit, 'disability_detail') : null,
          ], ' — ')}
        />
        <Line
          label="สภาพแวดล้อมที่มีผลต่อการเจ็บป่วยครั้งนี้"
          value={join([
            label(admit, 'environment_status', 'presence'),
            admit.environment_status === 'present' ? val(admit, 'environment_detail') : null,
          ], ' — ')}
        />
        <Line
          label="ปัญหาทางด้านเศรษฐกิจ"
          value={join([
            label(admit, 'economic_status', 'presence'),
            admit.economic_status === 'present' ? val(admit, 'economic_detail') : null,
          ], ' — ')}
        />
        <Line label="จิตวิญญาณ / ความเชื่อ / สิ่งยึดเหนี่ยวจิตใจ" value={val(admit, 'spiritual_belief')} />
        <View style={styles.row}>
          <Field label="ที่อยู่ที่ติดต่อได้" value={val(admit, 'contact_address')} width="70%" />
          <Field label="โทรศัพท์" value={val(admit, 'contact_phone')} width="30%" />
        </View>

        <Text style={styles.subHeader}>สภาพร่างกายแรกรับ</Text>
        <View style={styles.row}>
          <Field label="ลักษณะทั่วไป" value={label(admit, 'general_appearance')} width="33%" />
          <Field label="การเคลื่อนไหว" value={label(admit, 'mobility')} width="33%" />
          <Field label="ADL" value={label(admit, 'adl_level')} width="34%" />
        </View>
        <View style={styles.row}>
          <Field
            label="การหายใจ"
            value={join([label(admit, 'breathing'), admit.breathing === 'other' ? val(admit, 'breathing_other') : null], ' — ')}
            width="50%"
          />
          <Field label="การไหลเวียนโลหิต / สีผิว" value={label(admit, 'circulation')} width="50%" />
        </View>
        <View style={styles.row}>
          <Field
            label="อาการบวม"
            value={join([label(admit, 'edema'), admit.edema === 'present' ? `บริเวณ ${val(admit, 'edema_site')}` : null], ' — ')}
            width="50%"
          />
          <Field label="ผิวหนัง" value={val(admit, 'skin_condition')} width="50%" />
        </View>

        <Text style={styles.subHeader}>การติดต่อสื่อสาร / สภาพจิตใจแรกรับ</Text>
        <View style={styles.row}>
          <Field label="หู" value={join([label(admit, 'hearing'), label(admit, 'hearing_aid')])} width="50%" />
          <Field label="ตา" value={join([label(admit, 'vision'), label(admit, 'eyeglasses')])} width="50%" />
        </View>
        <View style={styles.row}>
          <Field
            label="การพูด"
            value={join([label(admit, 'speech'), admit.speech === 'other' ? val(admit, 'speech_other') : null], ' — ')}
            width="50%"
          />
          <Field label="อารมณ์ที่แสดงออก" value={label(admit, 'emotional_state')} width="50%" />
        </View>
        <Line label="พฤติกรรม / สิ่งที่วิตกกังวล" value={val(admit, 'emotional_note')} />

        <Text style={styles.subHeader}>การประเมินความเสี่ยงและอุปกรณ์ติดตัว</Text>
        <View style={styles.row}>
          <Field label="ความเสี่ยงพลัดตกหกล้ม" value={label(admit, 'fall_risk_screen', 'risk')} width="50%" />
          <Field label="ความเสี่ยงแผลกดทับ" value={label(admit, 'pressure_sore_screen', 'risk')} width="50%" />
        </View>
        <View style={styles.row}>
          <Field label="สูบบุหรี่" value={label(admit, 'smoking')} width="50%" />
          <Field label="ดื่มสุรา" value={label(admit, 'alcohol')} width="50%" />
        </View>
        <View style={styles.row}>
          <Field label="อุปกรณ์ที่ติดตัวมา" value={val(admit, 'devices')} width="50%" />
          <Field label="ของมีค่าที่นำมา / ฝากไว้" value={val(admit, 'valuables')} width="50%" />
        </View>
        {/* รายการปฐมนิเทศมีได้หลายหัวข้อ จึงให้เต็มความกว้าง */}
        <Line label="การปฐมนิเทศแรกรับ" value={val(admit, 'orientation_given')} />
        <Text style={{ fontSize: 7, color: '#888', marginTop: 2 }}>
          หมายเหตุ: เป็นการคัดกรองแรกรับ ผลประเมินเต็มรูปแบบดูที่แบบประเมิน Morse Fall Scale และ Braden Scale
        </Text>

        <Text style={styles.subHeader}>การวินิจฉัยและแผนการรักษา/พยาบาล</Text>
        {/* จับคู่แบบเดียวกับที่ฟอร์มวางไว้ — วินิจฉัยคู่กับแผน อ่านเทียบกันได้ */}
        <View style={styles.row}>
          <Field label="สรุปการวินิจฉัยโรค" value={val(admit, 'diagnosis_summary')} width="50%" />
          <Field label="แผนการรักษา" value={val(admit, 'treatment_summary')} width="50%" />
        </View>
        <View style={styles.row}>
          <Field label="ข้อวินิจฉัยทางการพยาบาล" value={val(admit, 'nursing_diagnosis')} width="50%" />
          <Field label="แผนการพยาบาล" value={val(admit, 'nursing_plan')} width="50%" />
        </View>

        <Text style={styles.subHeader}>ผู้ดูแล / ญาติ</Text>
        <View style={styles.row}>
          <Field label="ชื่อผู้ดูแล" value={val(admit, 'caregiver_name')} width="40%" />
          <Field label="ความสัมพันธ์" value={label(admit, 'caregiver_relation')} width="30%" />
          <Field label="เบอร์โทร" value={val(admit, 'caregiver_phone')} width="30%" />
        </View>

        {/* แสดงเฉพาะผู้คลอด ตามเกณฑ์ตรวจประเมินคุณภาพการบันทึกห้องคลอด ข้อ 1-2 */}
        {admit.is_maternity === true && (
          <>
            <Text style={styles.subHeader}>บันทึกแรกรับผู้คลอด — ประวัติทางสูติกรรม</Text>
            <View style={styles.row}>
              <Field
                label="G / P / A / L"
                value={join([val(admit, 'gravida'), val(admit, 'parity'), val(admit, 'abortion'), val(admit, 'living_children')], ' / ')}
                width="25%"
              />
              <Field label="LMP" value={date(admit, 'lmp')} width="25%" />
              <Field label="EDC" value={date(admit, 'edc')} width="25%" />
              <Field
                label="อายุครรภ์"
                value={
                  admit.ga_weeks !== null && admit.ga_weeks !== undefined
                    ? `${admit.ga_weeks} สัปดาห์ ${admit.ga_days ?? 0} วัน`
                    : BLANK
                }
                width="25%"
              />
            </View>
            <View style={styles.row}>
              <Field label="ฝากครรภ์ที่" value={val(admit, 'anc_place')} width="60%" />
              <Field label="จำนวนครั้งที่ฝากครรภ์" value={num(admit, 'anc_visits', 'ครั้ง')} width="40%" />
            </View>
            <View style={styles.row}>
              <Field label="ประวัติการคลอดครั้งก่อน" value={val(admit, 'previous_delivery')} width="50%" />
              <Field label="ภาวะแทรกซ้อนขณะตั้งครรภ์" value={val(admit, 'pregnancy_complication')} width="50%" />
            </View>
            {/* เลือกได้หลายข้อ มักยาวเกินครึ่งบรรทัด */}
            <Line label="ความเสี่ยงที่ต้องเฝ้าระวัง" value={val(admit, 'risk_factors')} />

            <Text style={styles.subHeader}>การตรวจร่างกายโดยแพทย์หรือพยาบาล</Text>
            <View style={styles.row}>
              <Field label="ยอดมดลูก" value={num(admit, 'fundal_height', 'ซม.')} width="30%" />
              <Field label="ท่าของทารก" value={label(admit, 'fetal_presentation')} width="35%" />
              <Field label="ผู้ตรวจ" value={val(admit, 'physical_exam_by')} width="35%" />
            </View>
            <Line label="ผลการตรวจร่างกาย" value={val(admit, 'physical_exam_note')} />

            <Text style={styles.subHeader}>การประเมินระยะรอคลอด ณ แรกรับ</Text>
            <View style={styles.row}>
              <Field label="วันเวลาที่ประเมิน" value={date(admit, 'labour_assess_datetime', 'D MMM BBBB HH:mm น.')} width="40%" />
              <Field
                label="การหดรัดตัวมดลูก"
                value={join(
                  [
                    admit.uc_interval ? `ทุก ${admit.uc_interval} นาที` : null,
                    admit.uc_duration ? `นาน ${admit.uc_duration} วินาที` : null,
                    label(admit, 'uc_intensity'),
                  ],
                  ' '
                )}
                width="60%"
              />
            </View>
            <View style={styles.row}>
              <Field label="ปากมดลูกเปิด" value={num(admit, 'cervical_dilation', 'ซม.')} width="25%" />
              <Field label="ความบาง" value={num(admit, 'cervical_effacement', '%')} width="25%" />
              <Field label="ระดับส่วนนำ (Station)" value={num(admit, 'fetal_station')} width="25%" />
              <Field
                label="FHS"
                value={join([num(admit, 'fetal_heart_sound', 'ครั้ง/นาที'), label(admit, 'fhs_regularity')])}
                width="25%"
              />
            </View>
            <View style={styles.row}>
              <Field
                label="ถุงน้ำคร่ำ"
                value={join(
                  [
                    label(admit, 'membrane_status'),
                    admit.membrane_status !== 'intact' ? date(admit, 'membrane_rupture_datetime', 'D MMM BBBB HH:mm น.') : null,
                    admit.membrane_status !== 'intact' ? label(admit, 'amniotic_fluid') : null,
                  ],
                  ' — '
                )}
                width="50%"
              />
              <Field label="ภาวะแทรกซ้อนระยะรอคลอด" value={val(admit, 'labour_complication')} width="50%" />
            </View>
          </>
        )}

        <Text style={styles.subHeader}>มาตรฐานการบันทึก (Audit)</Text>
        <View style={styles.row}>
          <Field label="การระบุตัวผู้ป่วย" value={label(admit, 'patient_identified', 'done')} width="35%" />
          <Field label="แจ้งข้อมูล/ขอความยินยอม" value={label(admit, 'informed_consent', 'done')} width="35%" />
          <Field label="คาดการณ์วันนอน" value={num(admit, 'expected_los', 'วัน')} width="30%" />
        </View>
        <View style={styles.row}>
          <Field label="การป้องกันการแพร่กระจายเชื้อ" value={val(admit, 'isolation_precaution')} width="50%" />
          <Field label="แผนจำหน่าย (D-METHOD)" value={val(admit, 'discharge_plan_topics')} width="50%" />
        </View>
        <Line label="บันทึกแผนจำหน่าย" value={val(admit, 'discharge_plan_note')} />

        <View style={{ marginTop: 12, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#ccc', borderTopStyle: 'solid' }}>
          <View style={styles.row}>
            <Field label="ผู้บันทึก" value={val(admit, 'nurse_name')} width="50%" />
            <Field
              label="ผู้ทบทวน"
              value={join([val(admit, 'reviewed_by'), admit.reviewed_at ? date(admit, 'reviewed_at', 'D MMM BBBB HH:mm น.') : null])}
              width="50%"
            />
          </View>
        </View>
      </>
    )}
  </Page>
);

// ===================== Page 2 =====================

/** ค่าที่หลุดช่วงปกติของกลุ่มอายุ ทำเครื่องหมายไว้ให้ผู้ตรวจสอบเห็นทันที */
const mark = (v: number | null | undefined, range?: [number, number]) => {
  const verdict = checkRange(v ?? null, range);
  return verdict === 'high' ? '▲' : verdict === 'low' ? '▼' : '';
};

const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/** ย่อวิธีวัดอุณหภูมิให้พอใส่ในช่องแคบ */
const ROUTE_ABBR: Record<string, string> = {
  axillary: 'รักแร้', oral: 'ปาก', tympanic: 'หู', rectal: 'ทวาร', temporal: 'ผาก',
};

const VitalSignsPage = ({ patientData, vitals, vitalMeta }: {
  patientData: PatientData;
  vitals: VitalRow[];
  vitalMeta: VitalMeta;
}) => {
  // เรียงเก่าไปใหม่ อ่านรายงานย้อนหลังตามลำดับเวลาที่เกิดจริง
  const rows = [...vitals].sort(
    (a, b) => dayjs(a.record_datetime).unix() - dayjs(b.record_datetime).unix()
  );
  const latest = rows[rows.length - 1];
  const range = REFERENCE_RANGE[vitalMeta.age_group ?? 'adult'];
  const groupName = vitalMeta.age_group ? AGE_GROUP_LABEL[vitalMeta.age_group] : 'ผู้ใหญ่';

  // แถวที่มีข้อมูลเสริม ยกไปไว้ท้ายหน้าเพื่อไม่ให้ตารางหลักกว้างจนอ่านไม่ออก
  const extras = rows.filter(r =>
    r.blood_glucose != null || r.urine_output_ml != null || r.is_late_entry || r.device_id);

  return (
    <Page size="A4" style={styles.page} wrap>
      <FormHeader title="2. แบบบันทึกสัญญาณชีพ (Vital Signs Record)" />
    <FormFooter />
      <PatientHeader patientData={patientData} />

      {rows.length === 0 ? (
        <Text style={{ marginTop: 12, color: '#8a8a8a' }}>
          ยังไม่มีการบันทึกสัญญาณชีพของ AN นี้
        </Text>
      ) : (
        <>
          <Text style={styles.subHeader}>
            สรุปค่าล่าสุด — {dayjs(latest!.record_datetime).format('D MMM BBBB HH:mm น.')}
          </Text>
          <View style={styles.row}>
            <Field label="อุณหภูมิ" value={join([num(latest!, 'vital_t', '°C'),
              latest!.temp_route ? `ทาง${labelOf(TEMP_ROUTES, latest!.temp_route)}` : null])} width="34%" />
            <Field label="ชีพจร" value={join([num(latest!, 'vital_p', '/นาที'),
              latest!.pulse_rhythm === 'irregular' ? 'ไม่สม่ำเสมอ' : null,
              latest!.pulse_site ? labelOf(PULSE_SITES, latest!.pulse_site) : null])} width="33%" />
            <Field label="หายใจ" value={join([num(latest!, 'vital_r', '/นาที'),
              latest!.resp_pattern ? labelOf(RESP_PATTERNS, latest!.resp_pattern) : null])} width="33%" />
          </View>
          <View style={styles.row}>
            <Field label="ความดัน" value={
              latest!.vital_bp_s && latest!.vital_bp_d
                ? `${latest!.vital_bp_s}/${latest!.vital_bp_d} mmHg (MAP ${latest!.map_value ?? '-'} · PP ${latest!.pulse_pressure ?? '-'})`
                : BLANK} width="34%" />
            <Field label="SpO₂" value={join([num(latest!, 'vital_o2sat', '%'),
              latest!.o2_therapy === 'on_oxygen'
                ? `${labelOf(O2_DEVICES, latest!.o2_device)}${latest!.o2_flow ? ` ${latest!.o2_flow} LPM` : ''}`
                : 'room air'])} width="33%" />
            <Field label="รู้สึกตัว" value={join([
              latest!.avpu ? `${latest!.avpu} (${AVPU_OPTIONS.find(o => o.value === latest!.avpu)?.hint ?? ''})` : null,
              latest!.gcs_total ? `GCS ${latest!.gcs_total}` : null])} width="33%" />
          </View>

          {latest!.news2_score != null && (
            <View style={{
              marginTop: 4, marginBottom: 6, padding: 4,
              borderWidth: 1, borderStyle: 'solid',
              borderColor: latest!.news2_risk === 'high' ? '#b91c1c'
                : latest!.news2_risk === 'medium' ? '#c2410c' : '#bfbfbf',
            }}>
              <Text>
                <Text style={styles.bold}>NEWS2 (Scale {latest!.news2_scale ?? 1}): </Text>
                {latest!.news2_score} คะแนน — {RISK_TH[latest!.news2_risk ?? ''] ?? '-'}
                {latest!.monitor_freq ? ` · วัดซ้ำ ${latest!.monitor_freq}` : ''}
              </Text>
            </View>
          )}

          <Text style={styles.subHeader}>บันทึกสัญญาณชีพทั้งหมด ({rows.length} ครั้ง)</Text>
          <View style={styles.table}>
            <View style={styles.tableRow} fixed>
              <View style={[styles.tableColHeader, { width: '13%' }]}><Text>วันที่/เวลา</Text></View>
              <View style={[styles.tableColHeader, { width: '9%' }]}><Text>T (°C)</Text></View>
              <View style={[styles.tableColHeader, { width: '8%' }]}><Text>ชีพจร</Text></View>
              <View style={[styles.tableColHeader, { width: '7%' }]}><Text>RR</Text></View>
              <View style={[styles.tableColHeader, { width: '15%' }]}><Text>BP / MAP</Text></View>
              <View style={[styles.tableColHeader, { width: '14%' }]}><Text>SpO₂</Text></View>
              <View style={[styles.tableColHeader, { width: '6%' }]}><Text>ปวด</Text></View>
              <View style={[styles.tableColHeader, { width: '9%' }]}><Text>รู้สึกตัว</Text></View>
              <View style={[styles.tableColHeader, { width: '7%' }]}><Text>NEWS2</Text></View>
              <View style={[styles.tableColHeader, { width: '12%' }]}><Text>ผู้บันทึก</Text></View>
            </View>
            {rows.map(r => (
              <View style={styles.tableRow} key={r.id} wrap={false}>
                <View style={[styles.tableCol, { width: '13%' }]}>
                  <Text>{dayjs(r.record_datetime).format('DD/MM/BB HH:mm')}</Text>
                  <Text style={{ fontSize: 6, color: '#8a8a8a' }}>
                    เวร{r.shift ?? '-'}{r.is_late_entry ? ' · ย้อนหลัง' : ''}
                  </Text>
                </View>
                <View style={[styles.tableCol, { width: '9%' }]}>
                  <Text>{n(r.vital_t) ?? BLANK}{mark(n(r.vital_t), TEMP_RANGE[r.temp_route ?? 'axillary'])}</Text>
                  <Text style={{ fontSize: 6, color: '#8a8a8a' }}>{ROUTE_ABBR[r.temp_route ?? ''] ?? ''}</Text>
                </View>
                <View style={[styles.tableCol, { width: '8%' }]}>
                  <Text>
                    {r.vital_p ?? BLANK}{mark(r.vital_p, range.pulse)}
                    {r.pulse_rhythm === 'irregular' ? ' irr' : ''}
                  </Text>
                </View>
                <View style={[styles.tableCol, { width: '7%' }]}>
                  <Text>{r.vital_r ?? BLANK}{mark(r.vital_r, range.resp)}</Text>
                </View>
                <View style={[styles.tableCol, { width: '15%' }]}>
                  <Text>
                    {r.vital_bp_s && r.vital_bp_d ? `${r.vital_bp_s}/${r.vital_bp_d}` : BLANK}
                    {mark(r.vital_bp_s, range.sbp)}
                  </Text>
                  <Text style={{ fontSize: 6, color: '#8a8a8a' }}>
                    {r.map_value ? `MAP ${r.map_value} · PP ${r.pulse_pressure ?? '-'}` : ''}
                  </Text>
                </View>
                <View style={[styles.tableCol, { width: '14%' }]}>
                  <Text>{r.vital_o2sat != null ? `${r.vital_o2sat}%` : BLANK}{mark(r.vital_o2sat, range.spo2)}</Text>
                  <Text style={{ fontSize: 6, color: '#8a8a8a' }}>
                    {r.o2_therapy === 'on_oxygen'
                      ? `${labelOf(O2_DEVICES, r.o2_device)}${r.o2_flow ? ` ${r.o2_flow}L` : ''}`
                      : r.o2_therapy === 'room_air' ? 'room air' : ''}
                  </Text>
                </View>
                <View style={[styles.tableCol, { width: '6%' }]}>
                  <Text>{r.pain_score ?? BLANK}</Text>
                </View>
                <View style={[styles.tableCol, { width: '9%' }]}>
                  <Text>{r.avpu ?? BLANK}</Text>
                  <Text style={{ fontSize: 6, color: '#8a8a8a' }}>{r.gcs_total ? `GCS ${r.gcs_total}` : ''}</Text>
                </View>
                <View style={[styles.tableCol, { width: '7%' }]}>
                  <Text style={r.news2_risk === 'high' || r.news2_risk === 'medium' ? styles.bold : undefined}>
                    {r.news2_score ?? BLANK}
                  </Text>
                </View>
                <View style={[styles.tableCol, { width: '12%' }]}>
                  <Text style={{ fontSize: 7 }}>{r.nurse_name ?? BLANK}</Text>
                </View>
              </View>
            ))}
          </View>

          {extras.length > 0 && (
            <>
              <Text style={styles.subHeader}>รายละเอียดเพิ่มเติม</Text>
              {extras.map(r => (
                <Text key={r.id} style={{ marginBottom: 2 }}>
                  <Text style={styles.bold}>{dayjs(r.record_datetime).format('DD/MM/BB HH:mm')}: </Text>
                  {join([
                    r.blood_glucose != null
                      ? `DTX ${r.blood_glucose} mg/dL${r.glucose_timing ? ` (${labelOf(GLUCOSE_TIMINGS, r.glucose_timing)})` : ''}`
                      : null,
                    r.urine_output_ml != null ? `ปัสสาวะ ${r.urine_output_ml} ml` : null,
                    r.device_id ? `รับค่าจากเครื่อง ${r.device_id}` : null,
                    r.is_late_entry
                      ? `บันทึกเข้าระบบ ${dayjs(r.entered_at).format('DD/MM/BB HH:mm')}`
                        + (r.late_entry_reason ? ` — ${r.late_entry_reason}` : '')
                      : null,
                  ])}
                </Text>
              ))}
            </>
          )}

          <Text style={{ marginTop: 8, fontSize: 7, color: '#8a8a8a' }}>
            หมายเหตุ: {'▲'} สูงกว่าเกณฑ์ · {'▼'} ต่ำกว่าเกณฑ์ เทียบกับช่วงปกติของกลุ่ม{groupName}
            {' '}(ชีพจร {range.pulse[0]}–{range.pulse[1]} · หายใจ {range.resp[0]}–{range.resp[1]} ·
            {' '}ความดันตัวบน {range.sbp[0]}–{range.sbp[1]} · SpO₂ {range.spo2[0]}–{range.spo2[1]}%)
            {!vitalMeta.age_known && ' — ไม่มีวันเกิดใน HIS จึงใช้ช่วงค่าผู้ใหญ่'}
            {'\n'}ค่าปกติของอุณหภูมิอ้างอิงตามวิธีวัดของแต่ละครั้ง · MAP และ PP คำนวณจากความดันโดยระบบ
            {vitalMeta.news2_applicable
              ? ' · NEWS2 คำนวณจากค่าที่บันทึกครบทั้ง 7 พารามิเตอร์เท่านั้น'
              : ` · ไม่คำนวณ NEWS2 เนื่องจาก${vitalMeta.age_known ? 'ผู้ป่วยอายุต่ำกว่า 16 ปี ให้ใช้ PEWS แทน' : 'ไม่ทราบอายุผู้ป่วย'}`}
          </Text>
        </>
      )}
    </Page>
  );
};

// ===================== Page 3 =====================
const ProgressNotesPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <FormHeader title="3. บันทึกทางการพยาบาล (Nursing Progress Notes)" />
    <FormFooter />
    <PatientHeader patientData={patientData} />
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w15]}><Text>วัน/เวลา</Text></View>
        <View style={[styles.tableColHeader, styles.flex1]}><Text>Focus Charting / SOAPIE</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w15]}>
          <Text>26/10/66</Text>
          <Text>10:00 น.</Text>
        </View>
        <View style={[styles.tableCol, styles.flex1]}>
          <Text style={styles.bold}>Focus: หอบเหนื่อย มีไข้</Text>
          <Text><Text style={styles.bold}>D (Data):</Text> ผู้ป่วยบ่นเหนื่อย หายใจเร็ว 24 ครั้ง/นาที, O2 Sat 95% (Room air), มีไข้ 38.5 °C ไอมีเสมหะเหลืองขุ่น</Text>
          <Text><Text style={styles.bold}>A (Action):</Text> 1. ดูแลให้ O2 cannula 3 LPM ตามแผนการรักษา 2. จัดท่านอนศีรษะสูง 3. เช็ดตัวลดไข้ 4. ให้ยา Paracetamol (500) 1 tab oral</Text>
          <Text><Text style={styles.bold}>R (Response):</Text> 11:00 น. ผู้ป่วยบอกว่าเหนื่อยน้อยลง หายใจ 20 ครั้ง/นาที O2 Sat 98% (O2 cannula 3 LPM) ไข้ลดลงเหลือ 37.5 °C</Text>
        </View>
      </View>
    </View>
  </Page>
);

// ===================== Page 4 =====================

const PLAN_STATUS: Record<string, string> = {
  draft: 'ฉบับร่าง',
  final: 'ยืนยันแล้ว',
  cancelled: 'ยกเลิกแล้ว',
};

/**
 * แปลงคำตอบหนึ่งข้อให้เป็นข้อความบนกระดาษ
 * ชนิดของช่องมาจากแม่แบบ ไม่ได้เดาจากค่าที่เก็บไว้ — true ของ check คือ "ปฏิบัติแล้ว"
 * แต่ true ที่หลุดมาในช่องชนิดอื่นไม่ได้แปลว่าอย่างนั้น
 */
const answerText = (item: PlanEval, raw: PlanAnswer | undefined): string => {
  if (raw === undefined || raw === null || raw === '') return BLANK;
  switch (item.kind) {
    case 'check':
      return raw === true ? 'ปฏิบัติแล้ว' : BLANK;
    case 'number':
      return `${raw}${item.unit ? ` ${item.unit}` : ''}`;
    case 'time':
      return `${raw} น.`;
    case 'choice':
      /* ค่าที่ไม่อยู่ในตัวเลือกคือค่าที่พยาบาลพิมพ์เองในช่อง "อื่นๆ (ระบุ)" ต้องบอกให้รู้ */
      return (item.options ?? []).includes(String(raw)) ? String(raw) : `${raw} (ระบุเอง)`;
    default:
      return String(raw);
  }
};

/**
 * แผนการพยาบาลตามแม่แบบของหอ
 *
 * ไม่ตั้งหัวตารางเป็น ข้อวินิจฉัย / เป้าหมาย / กิจกรรม / ประเมินผล ตามฟอร์มกระดาษทั่วไป
 * เพราะแม่แบบที่หอใช้เก็บแค่ "กิจกรรมการพยาบาล" กับ "ผลการประเมิน"
 * ถ้าตั้งสี่คอลัมน์ไว้ จะมีสองคอลัมน์ที่ไม่มีข้อมูลมาเติมได้เลย เหลือเป็นช่องว่างถาวร
 */
const CarePlanPage = ({ patientData, plans }: { patientData: PatientData; plans: FocusRecord[] }) => {
  // เรียงเก่าไปใหม่ ให้อ่านตามลำดับเวลาที่ดูแลจริง เหมือนหน้าสัญญาณชีพ
  const rows = [...plans].sort(
    (a, b) => dayjs(a.record_datetime).unix() - dayjs(b.record_datetime).unix()
  );

  return (
    <Page size="A4" style={styles.page} wrap>
      <FormHeader title="4. แผนการพยาบาล (Nursing Care Plan)" />
      <FormFooter />
      <PatientHeader patientData={patientData} />

      {rows.length === 0 ? (
        <Text style={{ marginTop: 12, color: '#8a8a8a' }}>
          ยังไม่มีการบันทึกแผนการพยาบาลของ AN นี้
        </Text>
      ) : rows.map(r => {
        const sections = r.structure?.sections ?? [];
        const answers = r.answers ?? {};

        return (
          <View key={r.id} style={{ marginBottom: 10 }}>
            <Text style={styles.subHeader}>
              {dayjs(r.record_datetime).format('D MMM BBBB HH:mm น.')}
              {r.shift ? ` · เวร${r.shift}` : ''} · {r.template_title}
            </Text>
            <Text style={{ fontSize: 7, color: '#8a8a8a', marginBottom: 3 }}>
              {join([
                `ผู้บันทึก ${r.nurse_name ?? BLANK}`,
                r.nurse_major,
                `แม่แบบ ${r.template_code} v${r.template_version}`,
                PLAN_STATUS[r.status] ?? r.status,
                r.is_late_entry && r.entered_at
                  ? `บันทึกเข้าระบบ ${dayjs(r.entered_at).format('DD/MM/BB HH:mm')}`
                    + (r.late_entry_reason ? ` — ${r.late_entry_reason}` : '')
                  : null,
              ])}
            </Text>

            {/* ร่างยังแก้ได้และยังไม่มีใครยืนยัน ต้องเห็นบนกระดาษว่าอ่านเป็นข้อมูลสุดท้ายไม่ได้ */}
            {r.status === 'draft' && (
              <Text style={{ fontSize: 7.5, color: '#b42318', marginBottom: 3 }}>
                ฉบับร่าง — ยังไม่ได้ยืนยัน เนื้อหายังแก้ไขได้ ไม่ใช้อ้างอิง
              </Text>
            )}

            {r.status === 'cancelled' ? (
              /* ยกเลิกแล้วแต่ยังพิมพ์ออกมา เพราะบันทึกที่เคยมีอยู่ต้องตรวจสอบย้อนหลังได้ */
              <Text style={{ fontSize: 7.5, color: '#b42318' }}>
                ยกเลิกแล้ว{r.cancelled_by_name ? ` โดย ${r.cancelled_by_name}` : ''}
                {r.cancel_reason ? ` — ${r.cancel_reason}` : ''} · คงไว้เพื่อการตรวจสอบย้อนหลัง
              </Text>
            ) : (
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <View style={[styles.tableColHeader, styles.w40]}><Text>กิจกรรมการพยาบาล</Text></View>
                  <View style={[styles.tableColHeader, styles.flex1]}><Text>ผลการประเมิน</Text></View>
                </View>

                {sections.map(sec => (
                  <View key={sec.id}>
                    <View style={styles.tableRow}>
                      <View style={[styles.tableCol, styles.flex1, { backgroundColor: '#f2f6f5' }]}>
                        <Text style={styles.bold}>{sec.title}</Text>
                      </View>
                    </View>
                    <View style={styles.tableRow}>
                      <View style={[styles.tableCol, styles.w40]}>
                        {sec.activities.length === 0
                          ? <Text style={{ color: '#8a8a8a' }}>{BLANK}</Text>
                          : sec.activities.map((act, i) => (
                            <Text key={`${sec.id}-a${i}`} style={{ marginBottom: 1 }}>{i + 1}. {act}</Text>
                          ))}
                      </View>
                      <View style={[styles.tableCol, styles.flex1]}>
                        {sec.evaluations.length === 0
                          ? <Text style={{ color: '#8a8a8a' }}>{BLANK}</Text>
                          : sec.evaluations.map(ev => (
                            <Text key={ev.id} style={{ marginBottom: 1 }}>
                              <Text style={styles.bold}>{ev.label}: </Text>
                              {answerText(ev, answers[ev.id])}
                            </Text>
                          ))}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {r.note && (
              <Text style={{ marginTop: 2 }}>
                <Text style={styles.bold}>หมายเหตุ: </Text>{r.note}
              </Text>
            )}
          </View>
        );
      })}
    </Page>
  );
};

// ===================== Page 5 =====================
const IORecordPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <FormHeader title="5. บันทึกการได้รับและขับออกของสารน้ำ (I/O Record)" />
    <FormFooter />
    <PatientHeader patientData={patientData} />
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w15]}><Text>เวลา</Text></View>
        <View style={[styles.tableColHeader, styles.w30]}><Text>Intake (รับเข้า)</Text></View>
        <View style={[styles.tableColHeader, styles.w10]}><Text>ปริมาณ (ml)</Text></View>
        <View style={[styles.tableColHeader, styles.w30]}><Text>Output (ขับออก)</Text></View>
        <View style={[styles.tableColHeader, styles.w15]}><Text>ปริมาณ (ml)</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w15]}><Text>12:00</Text></View>
        <View style={[styles.tableCol, styles.w30]}><Text>น้ำดื่ม</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>200</Text></View>
        <View style={[styles.tableCol, styles.w30]}><Text>Urine</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>300</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w15]}><Text>16:00</Text></View>
        <View style={[styles.tableCol, styles.w30]}><Text>IV Fluid (5%D/N/2)</Text></View>
        <View style={[styles.tableCol, styles.w10]}><Text>400</Text></View>
        <View style={[styles.tableCol, styles.w30]}><Text>-</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>-</Text></View>
      </View>
    </View>
  </Page>
);

// ===================== Page 6 =====================
const MARPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <FormHeader title="6. บันทึกการให้ยา (MAR)" />
    <FormFooter />
    <PatientHeader patientData={patientData} />
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w30]}><Text>ชื่อยา / ขนาด / วิธีให้</Text></View>
        <View style={[styles.tableColHeader, styles.w15]}><Text>ความถี่</Text></View>
        <View style={[styles.tableColHeader, styles.w15]}><Text>วันที่</Text></View>
        <View style={[styles.tableColHeader, styles.w40]}><Text>เวลา (ลงนามผู้ให้)</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w30]}><Text>Ceftriaxone 1g IV</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>OD</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>26/10/66</Text></View>
        <View style={[styles.tableCol, styles.w40]}><Text>10:00 (พยบ. สมใจ)</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w30]}><Text>Paracetamol (500) 1 tab oral</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>PRN for fever</Text></View>
        <View style={[styles.tableCol, styles.w15]}><Text>26/10/66</Text></View>
        <View style={[styles.tableCol, styles.w40]}><Text>10:30 (พยบ. สมใจ)</Text></View>
      </View>
    </View>
  </Page>
);

// ===================== Page 7 =====================
const SpecialCarePage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <FormHeader title="7. บันทึกการดูแลพิเศษ (Special Care Records)" />
    <FormFooter />
    <PatientHeader patientData={patientData} />
    
    <Text style={styles.subHeader}>Pain Assessment & Management</Text>
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w20]}><Text>เวลา</Text></View>
        <View style={[styles.tableColHeader, styles.w20]}><Text>Pain Score</Text></View>
        <View style={[styles.tableColHeader, styles.w40]}><Text>การจัดการ (Intervention)</Text></View>
        <View style={[styles.tableColHeader, styles.w20]}><Text>ผู้บันทึก</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w20]}><Text>10:00</Text></View>
        <View style={[styles.tableCol, styles.w20]}><Text>2/10</Text></View>
        <View style={[styles.tableCol, styles.w40]}><Text>จัดท่าสุขสบาย ไม่ต้องให้ยาแก้ปวด</Text></View>
        <View style={[styles.tableCol, styles.w20]}><Text>พยบ. สมใจ</Text></View>
      </View>
    </View>
  </Page>
);

// ===================== Page 8 =====================
const EducationPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <FormHeader title="8. บันทึกการศึกษาและให้ความรู้ (Patient Education)" />
    <FormFooter />
    <PatientHeader patientData={patientData} />
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={[styles.tableColHeader, styles.w15]}><Text>วันที่</Text></View>
        <View style={[styles.tableColHeader, styles.w40]}><Text>เนื้อหาที่ให้ความรู้</Text></View>
        <View style={[styles.tableColHeader, styles.w25]}><Text>การตอบสนอง/ความเข้าใจ</Text></View>
        <View style={[styles.tableColHeader, styles.w20]}><Text>ผู้สอน</Text></View>
      </View>
      <View style={styles.tableRow}>
        <View style={[styles.tableCol, styles.w15]}><Text>26/10/66</Text></View>
        <View style={[styles.tableCol, styles.w40]}><Text>สอนการไออย่างถูกวิธี (Effective Coughing)</Text></View>
        <View style={[styles.tableCol, styles.w25]}><Text>เข้าใจและทำตามได้ถูกต้อง</Text></View>
        <View style={[styles.tableCol, styles.w20]}><Text>พยบ. สมใจ</Text></View>
      </View>
    </View>
  </Page>
);

// ===================== Page 9 =====================
const HandoverPage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <FormHeader title="9. บันทึกการส่งเวร (Nursing Handover / SBAR)" />
    <FormFooter />
    <PatientHeader patientData={patientData} />
    <Text style={styles.subHeader}>เวรเช้า ส่งต่อ เวรบ่าย (วันที่ 26/10/66)</Text>
    <View style={[styles.table, { borderTopWidth: 0, borderLeftWidth: 0 }]}>
      <View style={styles.row}>
        <Text style={[styles.bold, styles.w15]}>S (Situation):</Text>
        <Text style={styles.flex1}>ผู้ป่วยชาย 45 ปี Dx. Pneumonia มีไข้ หอบเหนื่อย ได้รับ O2 cannula 3 LPM</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.bold, styles.w15]}>B (Background):</Text>
        <Text style={styles.flex1}>Admit วันแรก มีโรคประจำตัว HT ปฏิเสธแพ้ยา</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.bold, styles.w15]}>A (Assessment):</Text>
        <Text style={styles.flex1}>รู้สึกตัวดี V/S ล่าสุด T 37.5, PR 98, RR 20, BP 120/75, O2 Sat 98% ไอมีเสมหะ</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.bold, styles.w15]}>R (Recommendation):</Text>
        <Text style={styles.flex1}>ติดตามไข้และอาการหอบเหนื่อย, O2 Sat คอยกระตุ้นให้จิบน้ำบ่อยๆ และไอระบายเสมหะ</Text>
      </View>
    </View>
  </Page>
);

// ===================== Page 10 =====================
const DischargePage = ({ patientData }: { patientData: PatientData }) => (
  <Page size="A4" style={styles.page}>
    <FormHeader title="10. บันทึกการจำหน่าย (Discharge Record)" />
    <FormFooter />
    <PatientHeader patientData={patientData} />
    
    <Text style={styles.subHeader}>ข้อมูลการจำหน่ายผู้ป่วย</Text>
    <View style={styles.row}>
      <Text style={styles.col6}><Text style={styles.bold}>วันที่จำหน่าย: </Text>29/10/66</Text>
      <Text style={styles.col6}><Text style={styles.bold}>ประเภทการจำหน่าย: </Text>แพทย์อนุญาตให้กลับ (Improved)</Text>
    </View>
    
    <Text style={styles.subHeader}>สภาพผู้ป่วยเมื่อจำหน่าย</Text>
    <Text>ผู้ป่วยรู้สึกตัวดี ไม่มีไข้ หายใจปกติไม่ต้องใช้ O2 ทานอาหารได้ปกติ เดินได้เอง</Text>
    
    <Text style={styles.subHeader}>คำแนะนำการดูแลตนเองที่บ้าน (D-METHOD)</Text>
    <Text><Text style={styles.bold}>D (Disease): </Text>ให้ความรู้เรื่องปอดอักเสบ การป้องกันการติดเชื้อซ้ำ</Text>
    <Text><Text style={styles.bold}>M (Medication): </Text>อธิบายสรรพคุณยาและให้รับประทานยาปฏิชีวนะจนหมด</Text>
    <Text><Text style={styles.bold}>E (Environment): </Text>จัดสิ่งแวดล้อมให้อากาศถ่ายเทสะดวก พักผ่อนให้เพียงพอ</Text>
    
    <Text style={styles.subHeader}>การนัดหมายติดตามอาการ</Text>
    <Text>คลินิกอายุรกรรม วันที่ 5/11/66 เวลา 09:00 น.</Text>
  </Page>
);

// ===================== Main Document =====================
const FullMedicalReport = ({ patientData, admit, vitals, vitalMeta, plans }: {
  patientData: PatientData;
  admit: AdmitRecord | null;
  vitals: VitalRow[];
  vitalMeta: VitalMeta;
  plans: FocusRecord[];
}) => (
  <Document>
    <AdmissionPage patientData={patientData} admit={admit} />
    <VitalSignsPage patientData={patientData} vitals={vitals} vitalMeta={vitalMeta} />
    <ProgressNotesPage patientData={patientData} />
    <CarePlanPage patientData={patientData} plans={plans} />
    <IORecordPage patientData={patientData} />
    <MARPage patientData={patientData} />
    <SpecialCarePage patientData={patientData} />
    <EducationPage patientData={patientData} />
    <HandoverPage patientData={patientData} />
    <DischargePage patientData={patientData} />
  </Document>
);

const SummaryIPDbyAN = ({ an }: { an: string }) => {
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<PatientData>(() => toPatientData(null, an));
  const [admit, setAdmit] = useState<AdmitRecord | null>(null);
  const [vitals, setVitals] = useState<VitalRow[]>([]);
  const [plans, setPlans] = useState<FocusRecord[]>([]);
  const [vitalMeta, setVitalMeta] = useState<VitalMeta>({
    age_group: null, age_known: true, news2_applicable: true,
  });

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const headers = getHeaders();

      try {
        const res = await axios.post('/api/v1/patients/patient-by-an', { an }, { headers });
        const raw = res.data?.data;
        const row = Array.isArray(raw) ? raw[0] : raw;
        setPatientData(toPatientData(row ?? null, an));
      } catch (error) {
        console.error('Error fetching patient:', error);
        setPatientData(toPatientData(null, an));
      }

      try {
        const res = await axios.get(`/api/v1/nursing-records/admit/${an}`, { headers });
        const raw = res.data?.data;
        setAdmit((Array.isArray(raw) ? raw[0] : raw) ?? null);
      } catch {
        // 404 = ยังไม่ได้บันทึกแบบแรกรับ ไม่ใช่ข้อผิดพลาด หน้ารายงานจะขึ้นหมายเหตุแทน
        setAdmit(null);
      }

      try {
        const res = await axios.get(`/api/v1/nursing-records/vital/${an}`, { headers });
        setVitals(res.data?.data ?? []);
        if (res.data?.patient) setVitalMeta(res.data.patient);
      } catch (error) {
        console.error('Error fetching vital records:', error);
        setVitals([]);
      }

      try {
        const res = await axios.get(`/api/v1/nursing-records/focus/${an}`, { headers });
        setPlans(res.data?.data ?? []);
      } catch (error) {
        console.error('Error fetching care plan records:', error);
        setPlans([]);
      }

      setLoading(false);
    };
    fetchData();
  }, [an, getHeaders]);

  // รอให้ข้อมูลมาครบก่อนค่อยสร้าง PDF ไม่งั้นผู้ใช้จะเห็นรายงานเปล่าวาบหนึ่งก่อนข้อมูลจะขึ้น
  if (loading) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#006b5f' }}>
        กำลังโหลดข้อมูลผู้ป่วย...
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <PDFViewer style={{ width: '100%', height: '100%', border: 'none' }}>
        <FullMedicalReport
          patientData={patientData} admit={admit}
          vitals={vitals} vitalMeta={vitalMeta} plans={plans}
        />
      </PDFViewer>
    </div>
  );
};

export default SummaryIPDbyAN;