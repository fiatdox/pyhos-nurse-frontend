/**
 * ตัวเลือกและคำแปลของแบบบันทึกสัญญาณชีพ
 *
 * ใช้ร่วมกันระหว่างฟอร์มบันทึก (VitalSignsRecord) กับรายงานสรุป (SummaryIPDbyAN)
 * ถ้าแยกกันคนละไฟล์ วันหนึ่งจะแปลรหัสเดียวกันเป็นคนละข้อความ อ่านแล้วสับสนว่าคนละเรื่องกัน
 * ค่าใน value ต้องตรงกับ CHECK constraint ของ nursing_vital_records
 */

import type { Avpu } from './news2';

export const TEMP_ROUTES = [
  { value: 'axillary', label: 'รักแร้' },
  { value: 'oral', label: 'ปาก' },
  { value: 'tympanic', label: 'หู' },
  { value: 'rectal', label: 'ทวาร' },
  { value: 'temporal', label: 'หน้าผาก' },
];
export const PULSE_SITES = [
  { value: 'radial', label: 'Radial' },
  { value: 'apical', label: 'Apical' },
  { value: 'carotid', label: 'Carotid' },
  { value: 'brachial', label: 'Brachial' },
  { value: 'monitor', label: 'Monitor' },
];
export const RESP_PATTERNS = [
  { value: 'regular', label: 'สม่ำเสมอ' },
  { value: 'shallow', label: 'ตื้น' },
  { value: 'labored', label: 'หอบเหนื่อย' },
  { value: 'apnea', label: 'หยุดหายใจเป็นพัก' },
  { value: 'cheyne_stokes', label: 'Cheyne-Stokes' },
  { value: 'kussmaul', label: 'Kussmaul' },
];
export const BP_POSITIONS = [
  { value: 'supine', label: 'นอน' },
  { value: 'sitting', label: 'นั่ง' },
  { value: 'standing', label: 'ยืน' },
];
export const BP_SITES = [
  { value: 'left_arm', label: 'แขนซ้าย' },
  { value: 'right_arm', label: 'แขนขวา' },
  { value: 'left_leg', label: 'ขาซ้าย' },
  { value: 'right_leg', label: 'ขาขวา' },
];
export const BP_CUFFS = [
  { value: 'child', label: 'เด็ก' },
  { value: 'small_adult', label: 'ผู้ใหญ่เล็ก' },
  { value: 'adult', label: 'ผู้ใหญ่' },
  { value: 'large_adult', label: 'ผู้ใหญ่ใหญ่' },
  { value: 'thigh', label: 'ต้นขา' },
];
export const BP_METHODS = [
  { value: 'automatic', label: 'เครื่องอัตโนมัติ' },
  { value: 'manual', label: 'วัดเอง' },
  { value: 'arterial_line', label: 'Arterial line' },
];
export const O2_DEVICES = [
  { value: 'cannula', label: 'Nasal cannula' },
  { value: 'simple_mask', label: 'Simple mask' },
  { value: 'mask_with_bag', label: 'Mask with bag' },
  { value: 'venturi', label: 'Venturi mask' },
  { value: 'hfnc', label: 'HFNC' },
  { value: 'cpap', label: 'CPAP' },
  { value: 'bipap', label: 'BiPAP' },
  { value: 'ventilator', label: 'Ventilator' },
  { value: 't_piece', label: 'T-piece' },
];
export const PAIN_SCALES = [
  { value: 'NRS', label: 'NRS 0–10 (ผู้ใหญ่สื่อสารได้)' },
  { value: 'VAS', label: 'VAS' },
  { value: 'Wong-Baker', label: 'Wong-Baker FACES (เด็ก)' },
  { value: 'FLACC', label: 'FLACC (ทารก/ไม่รู้สึกตัว)' },
  { value: 'BPS', label: 'BPS (ใส่ท่อช่วยหายใจ)' },
  { value: 'CRIES', label: 'CRIES (ทารกแรกเกิด)' },
];
export const GLUCOSE_TIMINGS = [
  { value: 'fasting', label: 'งดอาหาร (FBS)' },
  { value: 'pre_meal', label: 'ก่อนอาหาร' },
  { value: 'post_meal', label: 'หลังอาหาร' },
  { value: 'random', label: 'สุ่ม' },
  { value: 'bedtime', label: 'ก่อนนอน' },
];
export const AVPU_OPTIONS: { value: Avpu; label: string; hint: string }[] = [
  { value: 'A', label: 'A', hint: 'Alert — รู้สึกตัวดี' },
  { value: 'C', label: 'C', hint: 'Confusion — สับสนใหม่' },
  { value: 'V', label: 'V', hint: 'Voice — ตอบสนองต่อเสียง' },
  { value: 'P', label: 'P', hint: 'Pain — ตอบสนองต่อความเจ็บ' },
  { value: 'U', label: 'U', hint: 'Unresponsive — ไม่ตอบสนอง' },
];
export const GCS_E = [
  { value: 4, label: '4 ลืมตาเอง' }, { value: 3, label: '3 เรียกแล้วลืมตา' },
  { value: 2, label: '2 เจ็บแล้วลืมตา' }, { value: 1, label: '1 ไม่ลืมตา' },
];
export const GCS_V = [
  { value: 5, label: '5 พูดคุยรู้เรื่อง' }, { value: 4, label: '4 สับสน' },
  { value: 3, label: '3 พูดเป็นคำ' }, { value: 2, label: '2 ส่งเสียงไม่เป็นคำ' }, { value: 1, label: '1 ไม่ออกเสียง' },
];
export const GCS_M = [
  { value: 6, label: '6 ทำตามสั่ง' }, { value: 5, label: '5 ปัดตำแหน่งเจ็บ' },
  { value: 4, label: '4 ชักแขนหนี' }, { value: 3, label: '3 งอเกร็ง' },
  { value: 2, label: '2 เหยียดเกร็ง' }, { value: 1, label: '1 ไม่ตอบสนอง' },
];

export const labelOf = (opts: { value: string; label: string }[], v?: string) =>
  opts.find(o => o.value === v)?.label ?? v ?? '-';
