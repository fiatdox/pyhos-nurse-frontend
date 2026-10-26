/**
 * ป้ายภาษาไทยของรหัส MAR — รหัสจริงและการตรวจอยู่ฝั่งเซิร์ฟเวอร์ (marController)
 * หน้าจอขอรายการรหัสจาก /mar/codes เสมอ ไฟล์นี้มีแค่คำอ่านกับค่าเริ่มต้นที่ช่วยกรอก
 */

export const ROUTE_LABEL: Record<string, string> = {
    PO: 'รับประทาน (PO)', SL: 'อมใต้ลิ้น (SL)', IV: 'ฉีดเข้าหลอดเลือดดำ (IV)', IM: 'ฉีดเข้ากล้าม (IM)',
    SC: 'ฉีดใต้ผิวหนัง (SC)', ID: 'ฉีดเข้าผิวหนัง (ID)', PR: 'ทางทวารหนัก (PR)', INH: 'สูดพ่น (INH)',
    NEB: 'พ่นละออง (NEB)', TOP: 'ทาภายนอก (TOP)', EYE: 'หยอดตา', EAR: 'หยอดหู', NASAL: 'พ่น/หยอดจมูก',
    NG: 'ทางสายให้อาหาร (NG)', PV: 'ทางช่องคลอด (PV)', OTHER: 'อื่น ๆ',
};

export const FREQ_LABEL: Record<string, string> = {
    OD: 'วันละครั้ง (OD)', BID: 'วันละ 2 ครั้ง (BID)', TID: 'วันละ 3 ครั้ง (TID)', QID: 'วันละ 4 ครั้ง (QID)',
    Q4H: 'ทุก 4 ชม.', Q6H: 'ทุก 6 ชม.', Q8H: 'ทุก 8 ชม.', Q12H: 'ทุก 12 ชม.', HS: 'ก่อนนอน (HS)',
    STAT: 'ทันที (STAT)', ONCE: 'ครั้งเดียว', PRN: 'เมื่อมีอาการ (PRN)',
};

/** เวลาให้ยาเริ่มต้นตามความถี่ — ผู้กรอกแก้ได้ก่อนบันทึก จำนวนเวลาต้องตรงกับความถี่ */
export const DEFAULT_TIMES: Record<string, string[]> = {
    OD: ['09:00'], BID: ['09:00', '21:00'], TID: ['09:00', '13:00', '17:00'], QID: ['09:00', '13:00', '17:00', '21:00'],
    Q4H: ['02:00', '06:00', '10:00', '14:00', '18:00', '22:00'], Q6H: ['00:00', '06:00', '12:00', '18:00'],
    Q8H: ['06:00', '14:00', '22:00'], Q12H: ['09:00', '21:00'], HS: ['21:00'],
};

export const CLASS_LABEL: Record<string, string> = {
    ANTIBIOTIC: 'ยาปฏิชีวนะ', OPIOID: 'ยาแก้ปวดกลุ่ม opioid', ANALGESIC: 'ยาแก้ปวด/ลดไข้ (ไม่ใช่ opioid)',
    ANTICOAGULANT: 'ยาต้านการแข็งตัวของเลือด', INSULIN: 'อินซูลิน', ORAL_HYPOGLYCEMIC: 'ยาเบาหวานชนิดรับประทาน',
    CARDIOVASCULAR: 'ยาหัวใจและหลอดเลือด', CONC_ELECTROLYTE: 'อิเล็กโทรไลต์เข้มข้น (KCl, MgSO4 ฯลฯ)',
    SEDATIVE: 'ยานอนหลับ/ยากล่อมประสาท', ANTICONVULSANT: 'ยากันชัก', GI: 'ยาระบบทางเดินอาหาร',
    RESPIRATORY: 'ยาระบบทางเดินหายใจ', STEROID: 'สเตียรอยด์', CHEMOTHERAPY: 'ยาเคมีบำบัด',
    VITAMIN: 'วิตามิน/เกลือแร่เสริม', OTHER: 'อื่น ๆ',
};

export const REASON_LABEL: Record<string, string> = {
    NPO: 'งดน้ำงดอาหาร (NPO)', PATIENT_REFUSED: 'ผู้ป่วยปฏิเสธ', DRUG_UNAVAILABLE: 'ไม่มียา / ยายังไม่มาจากห้องยา',
    HOLD_PARAMETER: 'สัญญาณชีพ/ผลแล็บไม่อยู่ในเกณฑ์ให้ยา', PATIENT_AWAY: 'ผู้ป่วยไม่อยู่ (ผ่าตัด/ตรวจพิเศษ/ย้าย)',
    DOCTOR_HOLD: 'แพทย์สั่งงด', ADVERSE_REACTION: 'เกิดอาการไม่พึงประสงค์', VOMITING: 'อาเจียน', OTHER: 'อื่น ๆ',
};

export const STATUS_LABEL: Record<string, string> = {
    given: 'ให้แล้ว', held: 'ระงับ (Held)', refused: 'ผู้ป่วยปฏิเสธ', omitted: 'งดให้ (Omitted)',
};

export const UNITS = ['mg', 'g', 'mcg', 'mL', 'unit', 'mEq', 'tab', 'cap', 'drop', 'puff', 'amp', 'vial', 'sachet', 'tsp'];

export const SITES = ['Lt. hand', 'Rt. hand', 'Lt. arm', 'Rt. arm', 'Lt. deltoid', 'Rt. deltoid', 'Abdomen', 'Lt. thigh', 'Rt. thigh', 'Buttock'];

/** สถานะของมื้อจากเซิร์ฟเวอร์ — สีเป็นสถานะจึงมาพร้อมคำเสมอ ไม่ใช้สีอย่างเดียว */
export type SlotState = 'on_time' | 'late' | 'early' | 'not_given' | 'missed' | 'due' | 'upcoming';

export const SLOT_STATE: Record<SlotState, { label: string; color: string; bg: string }> = {
    on_time: { label: 'ตรงเวลา', color: '#0a7d0a', bg: '#e8f6e8' },
    late: { label: 'ช้า', color: '#9a6400', bg: '#fdf3dc' },
    early: { label: 'เร็ว', color: '#9a6400', bg: '#fdf3dc' },
    not_given: { label: 'ไม่ได้ให้', color: '#52514e', bg: '#efeeec' },
    missed: { label: 'ไม่มีบันทึก', color: '#b42727', bg: '#fbe6e6' },
    due: { label: 'ถึงเวลา', color: '#1c5cab', bg: '#e3eefc' },
    upcoming: { label: 'ยังไม่ถึง', color: '#6e6d68', bg: '#ffffff' },
};
