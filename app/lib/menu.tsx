import type { IconType } from 'react-icons';
import {
    PiPillBold, PiPaperPlaneTiltBold, PiFirstAidKitBold, PiVirusBold, PiMoneyWavyBold,
    PiIdentificationBadgeBold, PiBuildingsBold, PiForkKnifeBold, PiTagBold, PiSlidersHorizontalBold,
    PiClockCounterClockwiseBold,
} from 'react-icons/pi';
import { VscAccount, VscChecklist } from 'react-icons/vsc';
import { GrSchedulePlay, GrUserAdd, GrWheelchairActive } from 'react-icons/gr';
import { SiWikibooks } from 'react-icons/si';
import { IoFastFoodOutline } from 'react-icons/io5';
import { TbReportSearch } from 'react-icons/tb';
import { CgPerformance } from 'react-icons/cg';
import { LiaHospital } from 'react-icons/lia';
import { RiShareForwardFill } from 'react-icons/ri';

/**
 * สารบัญเมนูของทั้งระบบ
 *
 * ที่เดียวที่บอกว่าระบบนี้มีเมนูอะไรบ้าง ใครเห็นอะไรโดยค่าเริ่มต้น
 * ใช้ร่วมกันสี่ที่: แถบบน ลิ้นชักซ้าย แถบข้างของห้องยา/บริษัท และหน้าจัดการสิทธิ์
 * ถ้าแต่ละที่ถือรายการของตัวเอง วันที่เพิ่มเมนูใหม่จะมีที่หนึ่งถูกลืมเสมอ
 * (ก่อนหน้านี้ลิ้นชักซ้ายกับแถบบนมีรายการไม่ตรงกันอยู่หลายรายการ)
 *
 * สิ่งที่ไฟล์นี้ตัดสินคือ "เห็นเมนูไหม" ไม่ใช่ "เข้าหน้านั้นได้ไหม"
 * คนที่รู้ URL ยังพิมพ์เข้าไปได้ และการกันข้อมูลจริงอยู่ที่ endpoint ฝั่งเซิร์ฟเวอร์เสมอ
 */

export type MenuGroup = 'nursing' | 'pharmacy' | 'nutrition' | 'vendor' | 'admin';

export const GROUPS: { key: MenuGroup; label: string; hint: string }[] = [
    { key: 'nursing', label: 'งานพยาบาล', hint: 'กลุ่มงานการพยาบาลทุกหน่วย · ฝ่ายการพยาบาล · งานป้องกันการติดเชื้อ' },
    { key: 'pharmacy', label: 'ห้องยา', hint: 'กลุ่มงานเภสัชกรรม' },
    { key: 'nutrition', label: 'โภชนาการ', hint: 'กลุ่มงานโภชนศาสตร์' },
    { key: 'vendor', label: 'บริษัททำอาหาร', hint: 'บัญชีบริษัทผู้รับจ้าง ไม่ใช่เจ้าหน้าที่โรงพยาบาล' },
    { key: 'admin', label: 'แอดมิน', hint: 'บัญชีที่มีบทบาท ADMIN ในทะเบียนบุคลากร' },
];

export interface MenuItem {
    /** รหัสถาวร ใช้เป็นกุญแจของสิทธิ์ ไม่ใช้ URL เพราะ URL เดียวอยู่ได้หลายเมนู */
    key: string;
    href: string;
    label: string;
    icon: IconType;
    /** กลุ่มที่เห็นโดยค่าเริ่มต้น ไม่ใส่ = ใช้ของหมวด */
    groups?: MenuGroup[];
}

export interface MenuSection {
    key: string;
    heading: string;
    icon: IconType;
    groups: MenuGroup[];
    /** จริง = ไม่ให้ปิดในหน้าจัดการสิทธิ์ */
    locked?: boolean;
    items: MenuItem[];
}

/*
  ทุกหมวดมี 'admin' ติดมาด้วยเสมอ เพราะผู้ดูแลระบบต้องเปิดดูได้ทุกหน้าเวลามีคนโทรมาแจ้งปัญหา
  ปิดเองได้ทีหลังถ้ารก แต่ค่าเริ่มต้นต้องเห็น ไม่ใช่ต้องมาตามเปิด
*/
export const MENU: MenuSection[] = [
    {
        key: 'ipd',
        heading: 'IPD',
        icon: VscAccount,
        groups: ['nursing', 'admin'],
        items: [
            { key: 'ipd.register', href: '/ipd/register', label: 'รับผู้ป่วย / รับย้าย', icon: GrUserAdd },
            { key: 'ipd.patients', href: '/ipd/patients', label: 'ทะเบียนผู้ป่วย', icon: SiWikibooks },
            { key: 'ipd.discharge', href: '/ipd/discharge', label: 'จำหน่าย / ย้ายออก', icon: GrWheelchairActive },
            { key: 'ipd.daily-routine', href: '/ipd/daily-routine', label: 'ประเมินระดับการดูแลรายเวร', icon: VscChecklist },
            { key: 'ipd.shift-patient', href: '/ipd/shift-patient', label: 'สรุปยอดผู้ป่วยรายเวร', icon: RiShareForwardFill },
            { key: 'ipd.order-food', href: '/ipd/order-food', label: 'สั่งอาหาร', icon: IoFastFoodOutline },
            { key: 'ipd.rx-order', href: '/ipd/rx-order', label: 'ส่งใบสั่งยาให้ห้องยา', icon: PiPaperPlaneTiltBold },
        ],
    },
    {
        key: 'pharmacy',
        heading: 'ห้องยา',
        icon: PiPillBold,
        groups: ['pharmacy', 'admin'],
        items: [
            { key: 'pharmacy.queue', href: '/pharmacy/queue', label: 'คิวใบสั่งยาจากหอผู้ป่วย', icon: PiFirstAidKitBold },
        ],
    },
    {
        key: 'ic',
        heading: 'IC : Infection Controls',
        icon: PiVirusBold,
        groups: ['nursing', 'admin'],
        items: [
            { key: 'ic.opd', href: '/ic/opd', label: 'OPD Daily', icon: TbReportSearch },
            { key: 'ic.ipd', href: '/ic/ipd', label: 'IPD Daily', icon: TbReportSearch },
            { key: 'ic.follow-up', href: '/ic/follow-up', label: 'ติดตามผู้ป่วยผ่าตัด (T814, A499)', icon: TbReportSearch },
            { key: 'ic.amr', href: '/ic/amr-report', label: 'รายงานผู้ป่วยเชื้อดื้อยา (AMR)', icon: PiVirusBold },
            { key: 'ic.opd-followup', href: '/ic/opd-followup', label: 'ติดตามผู้ป่วยนอกเชื้อดื้อยา (90 วัน)', icon: PiVirusBold },
            { key: 'ic.dashboard', href: '/ic/dashboard', label: 'IC Dashboard', icon: TbReportSearch },
        ],
    },
    {
        key: 'nutrition',
        heading: 'งานโภชนาการ',
        icon: IoFastFoodOutline,
        groups: ['nutrition', 'admin'],
        items: [
            { key: 'nutrition.summary', href: '/ipd/nutrition-summary', label: 'สรุปรายการอาหารประจำวัน', icon: IoFastFoodOutline },
            { key: 'nutrition.ward-summary', href: '/ipd/nutrition-ward-summary', label: 'สรุปยอดอาหารรายหอผู้ป่วย', icon: TbReportSearch },
            { key: 'nutrition.pivot', href: '/ipd/food-pivot', label: 'ตารางไขว้ยอดสั่งอาหาร (Pivot)', icon: TbReportSearch },
            { key: 'nutrition.payment', href: '/ipd/food-payment', label: 'ยอดเงินที่ต้องจ่ายบริษัท', icon: PiMoneyWavyBold },
            { key: 'nutrition.labels', href: '/ipd/nutrition-labels', label: 'พิมพ์ฉลากติดถาดอาหาร', icon: IoFastFoodOutline },
            { key: 'nutrition.dashboard', href: '/ipd/nutrition-dashboard', label: 'ยอดอาหารตามประเภท Dashboard', icon: TbReportSearch },
            { key: 'nutrition.orders', href: '/ipd/order-food', label: 'รายการสั่งอาหารรายหอผู้ป่วย', icon: TbReportSearch },
            { key: 'nutrition.items', href: '/ipd/food-items', label: 'จัดการรายการเมนูอาหาร', icon: IoFastFoodOutline },
        ],
    },
    {
        key: 'settings',
        heading: 'ตั้งค่า',
        icon: LiaHospital,
        groups: ['nursing', 'admin'],
        items: [
            { key: 'settings.positions', href: '/ipd/positions', label: 'จัดการตำแหน่งบุคลากร', icon: PiIdentificationBadgeBold },
            { key: 'settings.ward-staffs', href: '/ipd/ward-staffs', label: 'ตั้งค่าหอผู้ป่วยปฏิบัติงาน', icon: LiaHospital },
            { key: 'settings.ward-quotas', href: '/ipd/ward-quotas', label: 'ตั้งค่าหอผู้ป่วย (อัตรากำลังต่อเวร)', icon: LiaHospital },
            { key: 'settings.shift-configs', href: '/ipd/shift-configs', label: 'ตั้งค่าเวรเจ้าหน้าที่', icon: GrSchedulePlay },
            { key: 'settings.shift-rates', href: '/ipd/shift-rates', label: 'ตั้งค่าตอบแทนตามเวร', icon: PiMoneyWavyBold },
        ],
    },
    {
        /*
          แถบข้างของบริษัทผู้รับจ้าง อยู่ในสารบัญเดียวกันทั้งที่คนละหน้าจอ
          เพื่อให้ผู้ดูแลระบบเห็นทุกเมนูของระบบในตารางเดียว ไม่ต้องจำว่ามีอีกชุดซ่อนอยู่
        */
        key: 'vendor',
        heading: 'บริษัททำอาหาร',
        icon: PiBuildingsBold,
        groups: ['vendor'],
        items: [
            { key: 'vendor.report', href: '/vendor/report', label: 'ยอดเงิน', icon: PiMoneyWavyBold },
            { key: 'vendor.kitchen', href: '/vendor/kitchen', label: 'ใบรายการอาหาร', icon: PiForkKnifeBold },
            { key: 'vendor.ward-summary', href: '/vendor/ward-summary', label: 'ยอดตามตึก', icon: PiBuildingsBold },
            { key: 'vendor.labels', href: '/vendor/labels', label: 'ใบติดถาด', icon: PiTagBold },
        ],
    },
];

/**
 * เมนูพื้นฐานบนแถบบน — ทุกคนที่เข้าระบบได้เห็น รวมคนที่ไม่ได้อยู่กลุ่มไหนเลย
 * (แพทย์ การเงิน พัสดุ ฯลฯ ซึ่งมีหลายร้อยคนในทะเบียนบุคลากร)
 * ถ้าไม่มีอะไรเหลือให้เห็นเลย คนเหล่านี้จะเข้าระบบมาเจอหน้าว่างแล้วโทรหาแอดมินพร้อมกันทั้งโรงพยาบาล
 */
export const BASE_LINKS: MenuItem[] = [
    { key: 'base.fte', href: '/ipd/fte', label: 'FTE', icon: CgPerformance },
    { key: 'base.dashboard', href: '/ipd/dashboard', label: 'Dashboard', icon: TbReportSearch },
];

/** หน้าจัดการสิทธิ์เอง ปิดไม่ได้ ไม่งั้นแอดมินจะปิดทางกลับเข้ามาแก้ของตัวเอง */
export const MENU_ACCESS_ITEM: MenuItem = {
    key: 'admin.menu-access',
    href: '/ipd/menu-access',
    label: 'สิทธิ์การมองเห็นเมนู',
    icon: PiSlidersHorizontalBold,
    groups: ['admin'],
};

/** ระยะเวลาจัดเก็บไฟล์ใบสั่งยา แอดมินเท่านั้น เซิร์ฟเวอร์ตรวจสิทธิ์ตอนบันทึกเองอีกชั้น */
export const RX_RETENTION_ITEM: MenuItem = {
    key: 'admin.rx-retention',
    href: '/ipd/rx-retention',
    label: 'ระยะเวลาจัดเก็บไฟล์ใบสั่งยา',
    icon: PiClockCounterClockwiseBold,
    groups: ['admin'],
};

/** กลุ่มที่เห็นเมนูนี้โดยค่าเริ่มต้น (ยังไม่รวมข้อยกเว้นที่แอดมินตั้งไว้) */
export const defaultGroupsOf = (section: MenuSection, item: MenuItem): MenuGroup[] =>
    item.groups ?? section.groups;

/** ทุกเมนูในระบบแบบแบน ใช้ในหน้าจัดการสิทธิ์ */
export const ALL_ITEMS: { section: MenuSection; item: MenuItem }[] =
    MENU.flatMap(section => section.items.map(item => ({ section, item })));
