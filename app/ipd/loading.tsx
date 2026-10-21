import Navbar from '@/app/components/Navbar';
import { PageSkeleton } from '@/app/components/Skeletons';

/**
 * ระหว่างเปลี่ยนหน้า — Next แสดงตัวนี้ทันทีที่กดเมนู จนกว่าหน้าใหม่จะพร้อม
 * หน้าในส่วนนี้วาดแถบบนเอง (ไม่ได้อยู่ใน layout) จึงต้องมีแถบบนตรงนี้ด้วย ไม่งั้นแถบบนหายวูบทุกครั้งที่เปลี่ยนหน้า
 */
export default function Loading() {
    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <PageSkeleton />
        </div>
    );
}
