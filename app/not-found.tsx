import type { Metadata } from 'next';
import NotFoundView from './components/NotFoundView';

export const metadata: Metadata = {
    title: 'ไม่พบหน้าที่ต้องการ | PYHOS x NIS',
};

/**
 * หน้า 404 ของทั้งระบบ — Next ใช้ไฟล์นี้กับทุก URL ที่ไม่มีหน้าอยู่จริง
 * คนที่ยังไม่เข้าระบบไม่เห็นหน้านี้ เพราะ proxy เด้งไปหน้าเข้าระบบก่อน
 */
export default function NotFound() {
    return <NotFoundView />;
}
