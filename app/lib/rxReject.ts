/**
 * กลุ่มเหตุผลที่ห้องยาส่งใบสั่งยากลับ — เก็บในตาราง rx_reject_categories เภสัชตั้งเองที่ /pharmacy/reject-categories
 * ใช้ทำสถิติ ข้อความที่พิมพ์เพิ่มยังเก็บและแสดงให้หอเห็นเหมือนเดิม
 */
export interface RejectCategory {
    code: string;
    label: string;
    sort_order: number;
    active: boolean;
    /** ต้องพิมพ์รายละเอียดเพิ่มตอนเลือกกลุ่มนี้ (เช่น อื่น ๆ) */
    require_note: boolean;
    /** เฉพาะหน้าตั้งค่า (all=1) */
    used?: number;
    updated_by?: string | null;
    updated_at?: string | null;
}

export const REJECT_CATEGORIES_API = '/api/v1/rx/reject-categories';
