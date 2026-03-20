import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // อ่านค่า token จาก cookie
  const token = request.cookies.get('token')?.value;
  
  // ดึง path ปัจจุบัน
  const { pathname } = request.nextUrl;

  // กำหนดว่าหน้าไหนคือหน้า Login (หน้าแรก)
  const isLoginPage = pathname === '/';

  // ถอดรหัสและเช็คว่า Token สามารถใช้ได้จริงและยังไม่หมดอายุ
  let isTokenValid = false;
  if (token) {
    try {
      // ถอดรหัส JWT Payload (ส่วนที่ 2 ตรงกลาง)
      const payloadBase64 = token.split('.')[1];
      let base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      // เติม Padding ของ Base64 ให้ครบ
      while (base64.length % 4) {
        base64 += '=';
      }
      const decodedJson = atob(base64);
      const payload = JSON.parse(decodedJson);
      
      // ตรวจสอบ exp (วันหมดอายุ) ของ JWT ซึ่งมีหน่วยเป็นวินาที
      if (payload.exp && Date.now() < payload.exp * 1000) {
        isTokenValid = true; // Token ยังใช้งานได้
      }
    } catch (error) {
      // หากถอดรหัสไม่ได้ หรือ Token ผิดรูปแบบ ให้ถือว่าพัง
      isTokenValid = false;
    }
  }

  // กรณีที่ 1: ไม่มี Token หรือ Token หมดอายุแล้ว และไม่ได้อยู่หน้า Login
  if (!isTokenValid && !isLoginPage) {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('token'); // ลบ Cookie ทิ้งเพื่อป้องกันการลูป
    return response;
  }

  // กรณีที่ 2: มี Token ที่ยังใช้งานได้ดี และพยายามเข้าหน้า Login
  if (isTokenValid && isLoginPage) {
    return NextResponse.redirect(new URL('/main', request.url));
  }

  // กรณีที่ 3: Token หมดอายุแล้ว และตอนนี้กำลังเปิดหน้า Login อยู่
  if (!isTokenValid && token) {
    const response = NextResponse.next();
    response.cookies.delete('token'); // ลบของเก่าทิ้ง
    return response;
  }

  return NextResponse.next();
}

// กำหนด path ที่จะให้ Proxy ทำงาน
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};