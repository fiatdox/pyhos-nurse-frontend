/**
 * ธีมกราฟสำหรับโหมดมืด
 *
 * echarts วาดลงบน canvas จึงไม่ได้รับสีจาก CSS เลย ทั้งป้ายแกน เส้นตาราง
 * และกล่อง tooltip ต่างฝังสีของตัวเองมาซึ่งเป็นโทนสว่างทั้งหมด
 * ถ้าไม่สั่งทับ กราฟจะกลายเป็นแผ่นสว่างกลางหน้าจอมืด และป้ายแกนจะอ่านไม่ออก
 *
 * ไม่ใช้ธีม 'dark' ที่ echarts มีมาให้ เพราะมันตั้งพื้นหลังเป็น #100C2A
 * ซึ่งเป็นม่วงเข้มคนละโทนกับพื้นหลังของระบบ และทับชุดสีของกราฟที่ตั้งไว้แล้ว
 */

export const NURSE_DARK_THEME = 'nurse-dark';

const TEXT = '#a6a6a6';
const TEXT_STRONG = '#e8e8e8';
const LINE = '#434343';
const SPLIT = '#303030';

const axis = {
    axisLine: { lineStyle: { color: LINE } },
    axisTick: { lineStyle: { color: LINE } },
    axisLabel: { color: TEXT },
    splitLine: { lineStyle: { color: SPLIT } },
    splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'transparent'] } },
};

const theme = {
    // ปล่อยพื้นหลังโปร่งใส ให้เห็นสีการ์ดที่อยู่ข้างหลังแทน
    backgroundColor: 'transparent',
    textStyle: { color: TEXT },
    title: { textStyle: { color: TEXT_STRONG }, subtextStyle: { color: TEXT } },
    legend: { textStyle: { color: TEXT } },
    tooltip: {
        backgroundColor: '#1f1f1f',
        borderColor: '#434343',
        textStyle: { color: TEXT_STRONG },
        axisPointer: {
            lineStyle: { color: LINE },
            crossStyle: { color: LINE },
            shadowStyle: { color: 'rgba(255,255,255,0.06)' },
        },
    },
    categoryAxis: axis,
    valueAxis: axis,
    logAxis: axis,
    timeAxis: axis,
    // เส้นขอบชิ้นกราฟให้เป็นสีการ์ด จะได้เห็นรอยแบ่งชัดแบบเดียวกับโหมดสว่าง
    pie: { itemStyle: { borderColor: '#1f1f1f' } },
    graph: { label: { color: TEXT } },
};

let registered = false;

/** เรียกก่อน init กราฟทุกครั้ง — ลงทะเบียนซ้ำได้ ไม่มีผลข้างเคียง */
// รับ type ของ theme มาจากตัว echarts ที่ส่งเข้ามา เพราะแต่ละไฟล์ import คนละทาง
// (บางที่ import ตรง บางที่ import แบบ dynamic) แต่ ThemeOption เป็นชนิดเดียวกัน
export const registerNurseDark = <T>(echarts: {
    registerTheme: (name: string, theme: T) => void;
}) => {
    if (registered) return;
    echarts.registerTheme(NURSE_DARK_THEME, theme as T);
    registered = true;
};

/** ชื่อธีมที่ต้องส่งให้ echarts.init — undefined คือใช้ธีมมาตรฐาน (โหมดสว่าง) */
export const chartThemeName = (isDark: boolean) => (isDark ? NURSE_DARK_THEME : undefined);
