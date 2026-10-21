import dayjs, { type Dayjs } from 'dayjs';

/**
 * ปีงบประมาณ พ.ศ. ปัจจุบัน
 * ปีงบเริ่ม 1 ต.ค. ตั้งแต่เดือนตุลาคมจึงขึ้นปีงบใหม่แล้ว (20 ต.ค. 2569 = ปีงบ 2570)
 * ต้องตรงกับ fiscalRange ฝั่งเซิร์ฟเวอร์ ถ้าไม่ตรง ตัวเลือกบนจอจะไม่ตรงกับข้อมูลที่ได้
 */
export const currentFiscalYear = (now = new Date()) =>
    (now.getMonth() + 1 >= 10 ? now.getFullYear() + 1 : now.getFullYear()) + 543;

/** ปีงบ พ.ศ. → 1 ต.ค. ของปีก่อน ถึง 30 ก.ย. · ปีงบปัจจุบันตัดที่วันนี้ */
export const fiscalYearRange = (fy: number): [Dayjs, Dayjs] => {
    const start = dayjs(`${fy - 544}-10-01`);
    const end = dayjs(`${fy - 543}-09-30`);
    const today = dayjs().startOf('day');
    return [start, end.isAfter(today) ? today : end];
};

/** ตัวเลือกปีงบย้อนหลัง span ปี นับรวมปีปัจจุบัน */
export const fiscalYearOptions = (span: number, current = currentFiscalYear()) =>
    Array.from({ length: span }, (_, i) => current - i).map(y => ({
        value: y,
        label: y === current ? `ปีงบประมาณ ${y} (ปัจจุบัน)` : `ปีงบประมาณ ${y}`,
    }));
