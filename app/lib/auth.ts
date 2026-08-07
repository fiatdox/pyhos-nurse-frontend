export function getToken(): string | undefined {
  return document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
}

export function getAuthHeaders(): { Authorization: string } | Record<string, never> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * ข้อมูลผู้ใช้ที่ได้ตอนเข้าสู่ระบบ — รูปร่างตามที่ POST /api/v1/auth/login ส่งกลับมาจริง
 * (ดู authController.ts) และหน้า login เก็บลง sessionStorage ทั้งก้อน
 *
 * ที่นี่ไม่มี ward_code / ward_name / staff_id / fullname — ระบบล็อกอินไม่เคยส่งมา
 * หอผู้ป่วยให้เอาจากข้อมูลผู้ป่วย (patient.ward) ส่วนชื่อผู้บันทึกในเวชระเบียน
 * เซิร์ฟเวอร์หามาจาก token เอง หน้าจอใช้ค่าตรงนี้แค่แสดงให้ผู้ใช้เห็นว่ากำลังบันทึกในนามใคร
 */
export interface UserProfile {
  id?: number | string;
  username?: string;
  /** ชื่อ-สกุลพร้อมคำนำหน้า */
  name?: string;
  position_name?: string;
  mission_name?: string;
  major_name?: string;
  [key: string]: any;
}

export function getUserProfile(): UserProfile | null {
  try {
    const raw = sessionStorage.getItem('user_profile');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
