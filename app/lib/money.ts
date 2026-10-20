/**
 * การปัดเศษเงินฝั่งหน้าจอ
 *
 * ต้องใช้กติกาเดียวกับเซิร์ฟเวอร์ (src/utils/money.ts) เป๊ะๆ
 * ไม่งั้นตัวเลขที่หน้าจอคำนวณเองจะต่างจากตัวเลขที่เซิร์ฟเวอร์ส่งมาทีละสตางค์
 * แล้วผู้ใช้จะเจอยอดสองแบบในหน้าเดียวกันโดยไม่มีคำอธิบาย
 */

export const MONEY_DECIMALS = 2;

/**
 * ปัดเศษขึ้นเป็นทศนิยมสองตำแหน่ง
 *
 * ปัดขึ้นเสมอเมื่อมีเศษ ไม่ใช่ปัดครึ่งขึ้น เช่น 46.661 ได้ 46.67 ไม่ใช่ 46.66
 * ล้างความคลาดเคลื่อนของเลขทศนิยมฐานสองก่อนปัด ไม่งั้น 46.67 ที่เก็บจริง
 * เป็น 46.670000000000002 จะถูกปัดขึ้นเป็น 46.68 ทั้งที่ไม่มีเศษให้ปัด
 */
export const roundUpMoney = (value: number, decimals: number = MONEY_DECIMALS): number => {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** decimals;
    const cleaned = Math.round(value * factor * 1e6) / 1e6;
    return Math.ceil(cleaned) / factor;
};

/** ข้อความจำนวนเงิน ปัดเศษด้วยกติกาเดียวกันก่อนเสมอ */
export const formatMoney = (value: number | null, decimals: number = MONEY_DECIMALS): string =>
    value === null || !Number.isFinite(value)
        ? '-'
        : roundUpMoney(value, decimals).toLocaleString('th-TH', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
