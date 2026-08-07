/**
 * บทบาททางการพยาบาลจากตำแหน่งจริงในระบบบุคลากร (core_kon.user_positions)
 * ไม่ใช่ค่าที่ผู้ใช้เลือกเอง
 *
 * ต้องให้ผลตรงกับ roleClassOf ฝั่ง backend (src/utils/nursingRecord.ts)
 * ฝั่งหน้าจอใช้แค่แสดงผล การตัดสินสิทธิ์จริงเกิดที่เซิร์ฟเวอร์เสมอ
 */

export type RoleClass = 'professional_nurse' | 'practical_nurse' | 'assistant' | 'other';

export const AUTHOR_ROLES: { value: RoleClass; label: string; color: string }[] = [
  { value: 'professional_nurse', label: 'พยาบาลวิชาชีพ', color: '#16a34a' },
  { value: 'practical_nurse', label: 'พยาบาลเทคนิค', color: '#0891b2' },
  { value: 'assistant', label: 'ผู้ช่วยพยาบาล', color: '#ca8a04' },
  { value: 'other', label: 'ตำแหน่งอื่น', color: '#64748b' },
];

export const roleOf = (v?: string | null) => AUTHOR_ROLES.find(r => r.value === v);

const ROLE_BY_POSITION: Record<string, RoleClass> = {
  'พยาบาลวิชาชีพ': 'professional_nurse',
  'พยาบาลเทคนิค': 'practical_nurse',
  'ผู้ช่วยพยาบาล': 'assistant',
  'พนักงานช่วยการพยาบาล': 'assistant',
  'พนักงานช่วยเหลือคนไข้': 'assistant',
};

export const roleClassOf = (position?: string | null): RoleClass =>
  ROLE_BY_POSITION[String(position ?? '').trim()] ?? 'other';
