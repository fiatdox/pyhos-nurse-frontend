import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // อ่านค่า token จาก cookie
  const token = request.cookies.get('token')?.value;
  
  // ดึง path ปัจจุบัน
  const { pathname } = request.nextUrl;

  // กำหนดว่าหน้าไหนคือหน้า Login (หน้าแรก)
  const isLoginPage = pathname === '/';

  // กรณีที่ 1: ถ้าไม่มี Token และผู้ใช้ไม่ได้อยู่ที่หน้า Login (พยายามเข้าหน้าอื่น เช่น /main, /ipd/...)
  // ให้ดีดกลับไปหน้า Login (/)
  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // กรณีที่ 2: ถ้ามี Token อยู่แล้ว (Login แล้ว) แต่ผู้ใช้พยายามเข้าหน้า Login อีก
  // ให้ดีดไปหน้า Main (/main) เพื่อความสะดวก (ป้องกันการ login ซ้ำ)
  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/main', request.url));
  }

  return NextResponse.next();
}

// กำหนด path ที่จะให้ Middleware ทำงาน
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};