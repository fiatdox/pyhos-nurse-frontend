import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';

dayjs.extend(buddhistEra);

/**
 * ช่องวันที่ในตารางใบสั่งยา
 *
 * มีไว้เพราะตอนค้นด้วย HN ผลลัพธ์ข้ามวันข้ามเดือน เห็นแต่เวลา 08:05 แล้วบอกไม่ได้ว่าใบไหนก่อนหลัง
 * วันนี้กับเมื่อวานเขียนเป็นคำ เพราะเวลาใช้งานจริงคนอ่าน "วันนี้" ได้เร็วกว่าอ่านตัวเลขวันที่
 * แล้วค่อยมีวันที่จริงตัวเล็กกำกับไว้ ไม่ให้ต้องเดา
 *
 * อยู่ในไฟล์กลางเพราะทั้งหน้าห้องยาและหน้าหอใช้ช่องนี้ ต้องอ่านได้เหมือนกันทั้งสองหน้า
 */
const parts = (value: string): { main: string; sub: string } => {
    const d = dayjs(value);
    const today = dayjs();
    if (d.isSame(today, 'day')) return { main: 'วันนี้', sub: d.format('D MMM') };
    if (d.isSame(today.subtract(1, 'day'), 'day')) return { main: 'เมื่อวาน', sub: d.format('D MMM') };
    /* ข้ามปีเมื่อไหร่ต้องเห็นปี ไม่งั้น "19 ต.ค." ของปีที่แล้วอ่านเหมือนของปีนี้ */
    return { main: d.format('D MMM'), sub: d.isSame(today, 'year') ? d.format('dddd') : d.format('BBBB') };
};

export const RxDay = ({ value }: { value: string }) => {
    const { main, sub } = parts(value);
    return (
        <div className="leading-tight">
            <div className="text-sm font-semibold whitespace-nowrap">{main}</div>
            <div className="text-[11px] text-gray-500 whitespace-nowrap">{sub}</div>
        </div>
    );
};

/**
 * เรียงตามเวลาที่ส่ง
 * เทียบเป็นข้อความได้เลย เพราะเซิร์ฟเวอร์ส่งมาเป็น 'YYYY-MM-DD HH:mm' ซึ่งเรียงตัวอักษรแล้วตรงกับเรียงเวลา
 */
export const byTime = (a: { submitted_at: string }, b: { submitted_at: string }) =>
    String(a.submitted_at).localeCompare(String(b.submitted_at));
