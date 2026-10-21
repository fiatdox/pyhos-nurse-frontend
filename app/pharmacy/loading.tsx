import { PageSkeleton } from '@/app/components/Skeletons';

/** ระหว่างเปลี่ยนหน้า — กรอบและเมนูข้างอยู่ใน layout แล้ว ตรงนี้วาดเฉพาะพื้นที่เนื้อหา */
export default function Loading() {
    return <PageSkeleton />;
}
