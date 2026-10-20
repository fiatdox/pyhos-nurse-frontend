import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * ตัวคุมทางเข้าหน้าจอ — มีผู้ใช้สองชนิดที่ไม่เกี่ยวกันเลย
 *
 *   เจ้าหน้าที่โรงพยาบาล  คุกกี้ `token`         หน้าแรกคือ /main
 *   บริษัทผู้รับจ้างทำอาหาร คุกกี้ `vendor_token`  หน้าแรกคือ /vendor/report
 *
 * สองชนิดนี้ต้องไม่ปนกันทั้งสองทาง คุกกี้ของฝั่งหนึ่งเปิดหน้าของอีกฝั่งไม่ได้
 * และเวลาไล่ออกก็ต้องลบเฉพาะคุกกี้ของฝั่งนั้น ไม่ใช่ลบทิ้งทั้งคู่
 * ไม่งั้นเจ้าหน้าที่ที่เปิดหน้าบริษัทดูจะหลุดออกจากระบบของตัวเองไปด้วย
 *
 * ตัวนี้อ่าน payload ของ JWT โดยไม่ตรวจลายเซ็น จึงเป็นแค่ตัวช่วยให้ผู้ใช้
 * ไปหน้าที่ถูกต้อง ไม่ใช่ด่านความปลอดภัย การกันจริงอยู่ที่ทุก endpoint ฝั่งเซิร์ฟเวอร์
 * ซึ่งตรวจลายเซ็นและชนิดของ token เอง (ดู authMiddleware / vendorMiddleware)
 */

const STAFF_COOKIE = 'token';
const VENDOR_COOKIE = 'vendor_token';

const STAFF_HOME = '/main';
const VENDOR_HOME = '/vendor/report';
const VENDOR_LOGIN = '/vendor/login';

interface TokenInfo {
    /** มีคุกกี้อยู่จริงไหม ใช้ตัดสินว่าต้องลบของเก่าทิ้งหรือเปล่า */
    present: boolean;
    valid: boolean;
    typ: string | null;
}

const read = (raw: string | undefined): TokenInfo => {
    if (!raw) return { present: false, valid: false, typ: null };
    try {
        let base64 = raw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const payload = JSON.parse(atob(base64));
        const notExpired = Boolean(payload.exp) && Date.now() < payload.exp * 1000;
        return { present: true, valid: notExpired, typ: payload.typ ?? null };
    } catch {
        // ถอดรหัสไม่ได้ = คุกกี้เสีย ถือว่าใช้ไม่ได้แล้วลบทิ้ง
        return { present: true, valid: false, typ: null };
    }
};

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const staff = read(request.cookies.get(STAFF_COOKIE)?.value);
    const vendor = read(request.cookies.get(VENDOR_COOKIE)?.value);

    /*
      token ของบริษัทเซ็นด้วยกุญแจดอกเดียวกับของเจ้าหน้าที่ ถ้ามีใครย้ายมาใส่
      คุกกี้ `token` มันจะถอดรหัสผ่านและดูเหมือนใช้ได้ จึงต้องคัดชนิดออกตรงนี้ด้วย
      (เซิร์ฟเวอร์คัดอยู่แล้ว แต่ถ้าไม่คัดที่นี่ ผู้ใช้จะเข้าหน้าเปล่าที่ยิง API ไม่ผ่านสักตัว)
      token ของเจ้าหน้าที่รุ่นเก่ายังไม่มีฟิลด์ typ จึงยอมรับค่า null ด้วย
    */
    const staffOk = staff.valid && staff.typ !== 'vendor';
    const vendorOk = vendor.valid && vendor.typ === 'vendor';

    const isVendorArea = pathname === VENDOR_LOGIN || pathname.startsWith('/vendor/');
    const isLoginPage = pathname === '/';

    // ───── ฝั่งบริษัท ─────
    if (isVendorArea) {
        if (pathname === VENDOR_LOGIN) {
            if (vendorOk) return NextResponse.redirect(new URL(VENDOR_HOME, request.url));
            const response = NextResponse.next();
            if (vendor.present) response.cookies.delete(VENDOR_COOKIE);
            return response;
        }

        if (!vendorOk) {
            const response = NextResponse.redirect(new URL(VENDOR_LOGIN, request.url));
            if (vendor.present) response.cookies.delete(VENDOR_COOKIE);
            return response;
        }
        return NextResponse.next();
    }

    // ───── หน้าเข้าระบบรวม มีทั้งแท็บเจ้าหน้าที่และแท็บบริษัท ─────
    if (isLoginPage) {
        if (staffOk) return NextResponse.redirect(new URL(STAFF_HOME, request.url));
        if (vendorOk) return NextResponse.redirect(new URL(VENDOR_HOME, request.url));

        const response = NextResponse.next();
        if (staff.present) response.cookies.delete(STAFF_COOKIE);
        if (vendor.present) response.cookies.delete(VENDOR_COOKIE);
        return response;
    }

    // ───── ฝั่งเจ้าหน้าที่ (ที่เหลือทั้งหมด) ─────
    if (!staffOk) {
        const response = NextResponse.redirect(new URL('/', request.url));
        // ลบเฉพาะคุกกี้ของเจ้าหน้าที่ ของบริษัทไม่เกี่ยวกับการเข้าหน้านี้
        if (staff.present) response.cookies.delete(STAFF_COOKIE);
        return response;
    }

    return NextResponse.next();
}

export const config = {
    /*
      ไฟล์คงที่ใน public ต้องไม่ผ่านตัวตรวจสิทธิ์
      ของเดิมไม่ได้ยกเว้น assets กับ fonts ไว้ คำขอรูปและฟอนต์จึงถูกเด้ง 307 ไปหน้าเข้าระบบ
      รายงาน PDF ที่ดึงโลโก้กับฟอนต์เองจะได้หน้า HTML กลับมาแทนไฟล์ แล้วเงียบไปเฉย ๆ
      เพราะตัวสร้าง PDF ไม่ได้บอกว่าโหลดไฟล์ไม่สำเร็จ
    */
    matcher: [
        '/((?!api|ws|_next/static|_next/image|favicon.ico|assets|fonts).*)',
    ],
};
