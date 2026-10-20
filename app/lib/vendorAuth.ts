/**
 * ตัวตนของบริษัทผู้รับจ้างทำอาหาร แยกจากของเจ้าหน้าที่โดยสิ้นเชิง
 *
 * เก็บ token คนละคุกกี้กับของเจ้าหน้าที่ (`vendor_token` ไม่ใช่ `token`)
 * เพราะเจ้าหน้าที่งานโภชนาการอาจเปิดหน้าของบริษัทในเครื่องเดียวกันเพื่อช่วยดู
 * ถ้าใช้คุกกี้ชื่อเดียวกัน การเข้าระบบฝั่งหนึ่งจะเตะอีกฝั่งออกโดยไม่มีอะไรเตือน
 */

const COOKIE = 'vendor_token';
const PROFILE = 'vendor_profile';

export interface VendorProfile {
    vendor_id: number;
    vendor_name: string;
    display_name: string;
}

export function getVendorToken(): string | undefined {
    if (typeof document === 'undefined') return undefined;
    return document.cookie.split('; ').find(r => r.startsWith(`${COOKIE}=`))?.split('=')[1];
}

export function vendorHeaders(): Record<string, string> {
    const token = getVendorToken();
    return token
        ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };
}

export function saveVendorSession(token: string, profile: VendorProfile) {
    // อายุเท่ากับ token ฝั่งเซิร์ฟเวอร์ (8 ชม.) คุกกี้จะได้หมดอายุพร้อมกัน
    document.cookie = `${COOKIE}=${token}; path=/; max-age=${60 * 60 * 8}; samesite=lax`;
    sessionStorage.setItem(PROFILE, JSON.stringify(profile));
}

export function getVendorProfile(): VendorProfile | null {
    try {
        const raw = sessionStorage.getItem(PROFILE);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function clearVendorSession() {
    document.cookie = `${COOKIE}=; path=/; max-age=0`;
    sessionStorage.removeItem(PROFILE);
}
