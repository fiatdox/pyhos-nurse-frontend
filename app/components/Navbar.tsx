'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Drawer, Menu, ConfigProvider, Checkbox, Alert, Spin, Typography, Segmented } from 'antd';
import { PiSparkleBold, PiListChecksBold, PiMoonBold, PiIdentificationBadgeBold, PiMoneyWavyBold, PiCalendarXBold } from 'react-icons/pi';
import { useThemeMode, type ThemeMode } from '../lib/theme';
import {
    VscSignOut,
    VscAccount,
    VscChecklist
} from "react-icons/vsc";
import { GrSchedulePlay, GrUserAdd, GrWheelchairActive } from 'react-icons/gr';
import { SiWikibooks } from 'react-icons/si';
import { IoFastFoodOutline } from 'react-icons/io5';
import { TbReportSearch } from 'react-icons/tb';
import Link from 'next/link';
import { CgPerformance } from 'react-icons/cg';
import { LiaHospital } from 'react-icons/lia';
import { PiVirusBold } from 'react-icons/pi';
import { RiShareForwardFill } from 'react-icons/ri';
import type { IconType } from 'react-icons';

interface AiSetting {
    enabled: boolean;
    updated_at: string | null;
    updated_by: string | null;
    /** ผู้ใช้คนนี้เป็นผู้ดูแลระบบหรือไม่ — เซิร์ฟเวอร์เป็นคนบอก */
    can_manage: boolean;
}

/** ทางลัดบนแถบบน — เอาเฉพาะงานที่เปิดใช้ทุกวัน */
const TOP_LINKS: { href: string; label: string; icon: IconType }[] = [
    { href: '/ipd/fte', label: 'FTE', icon: CgPerformance },
    { href: '/ipd/dashboard', label: 'Dashboard', icon: TbReportSearch },
];

/**
 * เมนูย่อยใต้ "ระบบงาน" — จัดเป็นคอลัมน์ตามโมดูล
 * ไอคอนใช้ตัวเดียวกับลิ้นชักซ้าย เพื่อให้จำได้ว่าเป็นหน้าเดียวกันไม่ว่าเข้าจากทางไหน
 */
const MEGA_MENU: {
    heading: string;
    icon: IconType;
    /** จริง = แสดงเฉพาะเจ้าหน้าที่งานโภชนาการ (เซิร์ฟเวอร์เป็นคนบอกว่าใช่หรือไม่) */
    nutritionOnly?: boolean;
    items: { href: string; label: string; icon: IconType }[];
}[] = [
    {
        heading: 'IPD',
        icon: VscAccount,
        items: [
            { href: '/ipd/register', label: 'รับผู้ป่วย / รับย้าย', icon: GrUserAdd },
            { href: '/ipd/patients', label: 'ทะเบียนผู้ป่วย', icon: SiWikibooks },
            { href: '/ipd/discharge', label: 'จำหน่าย / ย้ายออก', icon: GrWheelchairActive },
            { href: '/ipd/daily-routine', label: 'ประเมินระดับการดูแลรายเวร', icon: VscChecklist },
            { href: '/ipd/shift-patient', label: 'สรุปยอดผู้ป่วยรายเวร', icon: RiShareForwardFill },
            { href: '/ipd/order-food', label: 'สั่งอาหาร', icon: IoFastFoodOutline },
        ],
    },
    {
        heading: 'IC : Infection Controls',
        icon: PiVirusBold,
        items: [
            { href: '/ic/opd', label: 'OPD Daily', icon: TbReportSearch },
            { href: '/ic/ipd', label: 'IPD Daily', icon: TbReportSearch },
            { href: '/ic/follow-up', label: 'ติดตามผู้ป่วยผ่าตัด (T814, A499)', icon: TbReportSearch },
            { href: '/ic/dashboard', label: 'IC Dashboard', icon: TbReportSearch },
        ],
    },
    {
        heading: 'งานโภชนาการ',
        icon: IoFastFoodOutline,
        nutritionOnly: true,
        items: [
            { href: '/ipd/nutrition-summary', label: 'สรุปรายการอาหารประจำวัน', icon: IoFastFoodOutline },
            { href: '/ipd/order-food', label: 'รายการสั่งอาหารรายหอผู้ป่วย', icon: TbReportSearch },
        ],
    },
    {
        heading: 'ตั้งค่า',
        icon: LiaHospital,
        items: [
            { href: '/ipd/positions', label: 'จัดการตำแหน่งบุคลากร', icon: PiIdentificationBadgeBold },
            { href: '/ipd/ward-staffs', label: 'ตั้งค่าหอผู้ป่วยปฏิบัติงาน', icon: LiaHospital },
            { href: '/ipd/ward-quotas', label: 'ตั้งค่าหอผู้ป่วย (อัตรากำลังต่อเวร)', icon: LiaHospital },
            { href: '/ipd/shift-configs', label: 'ตั้งค่าเวรเจ้าหน้าที่', icon: GrSchedulePlay },
            { href: '/ipd/shift-rates', label: 'ตั้งค่าตอบแทนตามเวร', icon: PiMoneyWavyBold },
        ],
    },
];

/**
 * หัวข้อคั่นกลุ่มเมนูในลิ้นชักตั้งค่า
 *
 * เมนูตั้งค่ายาวขึ้นเรื่อยๆ จนหาของไม่เจอ จึงแบ่งเป็นหมวดตามลำดับที่ใช้งานจริง
 * เส้นคั่นอยู่บนหัวข้อ ไม่ใช่ใต้ เพราะหัวข้อควรติดกับรายการที่มันคุมอยู่
 */
const DrawerSection = ({ label }: { label: string }) => (
    <div className="mt-4 mb-1 pt-3 px-2 border-t border-white/15 text-[11px] font-semibold tracking-wide text-white/55">
        {label}
    </div>
);

const Navbar = () => {
    const [openLeft, setOpenLeft] = useState(false);
    const [openRight, setOpenRight] = useState(false);
    const { mode, resolved, setMode } = useThemeMode();
    const router = useRouter();
    const pathname = usePathname();

    const openKey = pathname ? pathname.split('/')[1] : '';

    const showLeftDrawer = () => setOpenLeft(true);
    const onCloseLeft = () => setOpenLeft(false);

    const showRightDrawer = () => setOpenRight(true);
    const onCloseRight = () => setOpenRight(false);

    /**
     * ค่าตั้งผู้ช่วย AI ระดับระบบ
     *
     * can_manage มาจากเซิร์ฟเวอร์ (ตารางบทบาทใน core_kon) ไม่ได้เดาจากตำแหน่งฝั่งหน้าจอ
     * และการซ่อนเมนูเป็นแค่ความสะดวก การกันจริงอยู่ที่เซิร์ฟเวอร์ซึ่งตรวจสิทธิ์ทุกครั้งที่บันทึก
     */
    const [aiSetting, setAiSetting] = useState<AiSetting | null>(null);
    const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
    const [aiSaving, setAiSaving] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const authHeaders = useCallback((): Record<string, string> => {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/v1/system/ai-setting', { headers: authHeaders() });
                const json = await res.json();
                if (json?.success) setAiSetting(json.data);
            } catch {
                // อ่านค่าไม่ได้ก็แค่ไม่แสดงเมนู ไม่ต้องรบกวนผู้ใช้
            }
        })();
    }, [authHeaders]);

    /**
     * สิทธิ์งานโภชนาการ — ผูกกับกลุ่มงานจริงในทะเบียนบุคลากร ไม่ได้เดาจากฝั่งหน้าจอ
     * ซ่อนเมนูเป็นแค่ความสะดวก การกันจริงอยู่ที่เซิร์ฟเวอร์ซึ่งตรวจทุกครั้งที่กดรับรายการ
     */
    const [canNutrition, setCanNutrition] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/v1/nutrition/access', { headers: authHeaders() });
                const json = await res.json();
                setCanNutrition(json?.data?.can_receive === true);
            } catch {
                // อ่านไม่ได้ก็ถือว่าไม่มีสิทธิ์ ไม่ต้องรบกวนผู้ใช้
            }
        })();
    }, [authHeaders]);

    const visibleMegaMenu = MEGA_MENU.filter(g => !g.nutritionOnly || canNutrition);

    const toggleAi = async (enabled: boolean) => {
        setAiSaving(true);
        setAiError(null);
        try {
            const res = await fetch('/api/v1/system/ai-setting', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ enabled }),
            });
            const json = await res.json();
            if (json?.success) setAiSetting(json.data);
            else setAiError(json?.message || 'บันทึกไม่สำเร็จ');
        } catch {
            setAiError('บันทึกไม่สำเร็จ กรุณาลองใหม่');
        } finally {
            setAiSaving(false);
        }
    };

    const handleLogout = async () => {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        await fetch('/api/v1/logout', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
        document.cookie = 'token=; Max-Age=0; path=/';
        sessionStorage.clear();
        router.push("/");
    };

    return (
        <nav className="bg-[#006b5f] shadow-lg sticky top-0 z-50">
            <div className="max-w-full mx-auto px-2 sm:px-6 lg:px-8">
                <div className="relative flex items-center justify-between h-16">
                    {/* Hamburger Menu (Left) - Visible on Mobile only */}
                    <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                        <button
                            onClick={showLeftDrawer}
                            className="p-2 rounded-md text-white hover:text-gray-200 hover:bg-white/10 focus:outline-none"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center sm:items-stretch sm:justify-start">
                        {/* Hamburger Menu (Left) */}
                        <div className="hidden sm:flex items-center mr-2">
                            <button
                                onClick={showLeftDrawer}
                                className="p-2 rounded-md text-white hover:text-gray-200 hover:bg-white/10 focus:outline-none"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                </svg>
                            </button>
                        </div>

                        <div className="shrink-0 flex items-center">

                            <span className="ml-2 text-xl font-bold text-white">PYHOS x Nurse</span>

                        </div>
                        <div className="hidden sm:block sm:ml-6">
                            <div className="flex space-x-4">
                                <Link
                                    href="/main"
                                    className={`hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium ${pathname === '/main' ? 'bg-white/15' : ''}`}
                                >
                                    <span className="text-white">หน้าหลัก</span>
                                </Link>

                                {/* เมนูย่อยแบบเดิม เปลี่ยนแค่รายการข้างในให้เป็นหน้าที่มีจริง */}
                                <div className="group">
                                    <button className="text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                                        ระบบงาน
                                        <svg className="ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <div className="absolute left-0 top-16 w-full bg-white border-b border-gray-200 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 before:absolute before:-top-4 before:h-4 before:w-full">
                                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                            {/* จำนวนคอลัมน์ตามกลุ่มที่มองเห็นจริง ไม่งั้นกลุ่มที่ 4 จะตกไปอยู่แถวล่างตัวเดียว */}
                                            <div className={`grid grid-cols-1 gap-8 p-6 ${
                                                visibleMegaMenu.length >= 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'
                                            }`}>
                                                {visibleMegaMenu.map(group => (
                                                    <div key={group.heading}>
                                                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                            <group.icon className="w-5 h-5 text-[var(--brand-text)]" />
                                                            {group.heading}
                                                        </h3>
                                                        <ul className="space-y-3">
                                                            {group.items.map(item => {
                                                                const active = pathname === item.href;
                                                                return (
                                                                    <li key={item.href}>
                                                                        <Link href={item.href} className="flex items-center gap-2 group/item">
                                                                            {/* ไอคอนจางกว่าตัวหนังสือ ให้ตายังอ่านชื่อเมนูก่อน */}
                                                                            <item.icon className={`w-4 h-4 shrink-0 ${
                                                                                active ? 'text-[var(--brand-text)]' : 'text-gray-400 group-hover/item:text-[var(--brand-text)]'
                                                                            }`} />
                                                                            <span className={`group-hover/item:text-[var(--brand-text)] ${
                                                                                active ? 'font-semibold text-[var(--brand-text)]' : 'text-gray-600'
                                                                            }`}>
                                                                                {item.label}
                                                                            </span>
                                                                        </Link>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {TOP_LINKS.map(item => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium ${
                                            pathname === item.href ? 'bg-white/15' : ''
                                        }`}
                                    >
                                        <span className="text-white flex items-center gap-1.5">
                                            <item.icon className="w-4 h-4" />
                                            {item.label}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                        {/* User Icon (Right) */}
                        <button
                            onClick={showRightDrawer}
                            className="p-2 rounded-full text-white hover:text-gray-200 hover:bg-white/10 focus:outline-none"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Left Drawer (Menu) */}
            <Drawer
                title={<span className="text-white font-bold text-lg">Menu</span>}
                placement="left"
                onClose={onCloseLeft}
                open={openLeft}
                className="[&_.ant-drawer-body]:p-0 [&_.ant-drawer-content]:bg-transparent [&_.ant-drawer-header]:bg-[#005a50] [&_.ant-drawer-header]:border-b-white/10 [&_.ant-drawer-close]:text-white"
                styles={{ body: { padding: 0 }, mask: { backgroundColor: 'rgba(0, 0, 0, 0.2)' }, wrapper: { boxShadow: 'none' } }}
            >
                <div className="flex flex-col h-full bg-linear-to-b from-[#005a50] to-[#008f7f] p-4 text-white">
                    <div className="flex-1">
                        <ConfigProvider
                            theme={{
                                components: {
                                    Menu: {
                                        darkItemBg: 'transparent',
                                        darkSubMenuItemBg: 'transparent',
                                        darkItemSelectedBg: 'rgba(255, 255, 255, 0.1)',
                                        darkItemHoverBg: 'rgba(255, 255, 255, 0.1)',
                                        darkItemColor: '#fff',
                                        itemPaddingInline: 8,
                                        itemMarginInline: 0,
                                        itemBorderRadius: 4,
                                    }
                                }
                            }}
                        >
                            <Menu
                                mode="inline"
                                theme="dark"
                                inlineIndent={12}
                                defaultOpenKeys={[openKey]}
                                selectedKeys={[pathname]}
                                style={{ background: 'transparent', borderRight: 'none', padding: 0 }}
                                className="mt-2 [&_.ant-menu-submenu-title]:px-2 [&_.ant-menu-submenu-title]:border-t [&_.ant-menu-submenu-title]:border-b [&_.ant-menu-submenu-title]:border-white/10 [&_.ant-menu-submenu-title]:font-bold [&_.ant-menu-submenu-title]:text-white [&_.ant-menu-title-content]:text-left"
                                /* key ของทุกรายการต้องเป็น path จริง เพราะ selectedKeys เทียบกับ pathname
                                   ของเดิมกลุ่ม IPD ใช้ชื่อสั้นๆ ทำให้ไม่เคยไฮไลต์ว่าอยู่หน้าไหน */
                                items={[
                                    {
                                        key: 'ipd',
                                        icon: <VscAccount className="w-5 h-5 text-white" />,
                                        label: <span className="text-white text-left block w-full">IPD</span>,
                                        children: [
                                            {
                                                key: '/ipd/register',
                                                icon: <GrUserAdd className="w-5 h-5" />,
                                                label: <Link href="/ipd/register" onClick={onCloseLeft} className="block w-full text-left"><span className="text-white">รับผู้ป่วย / รับย้าย</span></Link>,
                                            },
                                            {
                                                key: '/ipd/patients',
                                                icon: <SiWikibooks className="w-5 h-5" />,
                                                label: <Link href="/ipd/patients" onClick={onCloseLeft} className="block w-full text-left"><span className="text-white">ทะเบียนผู้ป่วย</span></Link>,
                                            },
                                            {
                                                key: '/ipd/discharge',
                                                icon: <GrWheelchairActive className="w-5 h-5" />,
                                                label: <Link href="/ipd/discharge" onClick={onCloseLeft} className="block w-full text-left"><span className="text-white">จำหน่าย / ย้ายออก</span></Link>,
                                            },
                                            {
                                                key: '/ipd/order-food',
                                                icon: <IoFastFoodOutline className="w-5 h-5" />,
                                                label: <Link href="/ipd/order-food" onClick={onCloseLeft} className="block w-full text-left"><span className="text-white">สั่งอาหาร</span></Link>,
                                            },
                                            {
                                                key: '/ipd/daily-routine',
                                                icon: <VscChecklist className="w-5 h-5" />,
                                                label: <Link href="/ipd/daily-routine" onClick={onCloseLeft} className="block w-full text-left"><span className="text-white">ประเมินระดับการดูแลรายเวร</span></Link>,
                                            },
                                            {
                                                key: '/ipd/shift-patient',
                                                icon: <RiShareForwardFill className="w-5 h-5" />,
                                                label: <Link href="/ipd/shift-patient" onClick={onCloseLeft} className="block w-full text-left"><span className="text-white">สรุปยอดผู้ป่วยรายเวร</span></Link>,
                                            },
                                            {
                                                key: '/ipd/dashboard',
                                                icon: <TbReportSearch className="w-5 h-5" />,
                                                label: <Link href="/ipd/dashboard" onClick={onCloseLeft} className="block w-full text-left"><span className="text-white">Dashboard</span></Link>,
                                            },
                                        ]
                                    },
                                    {
                                        key: 'ic',
                                        icon: <PiVirusBold className="w-5 h-5 text-white" />,
                                        label: <span className="text-white text-left block w-full">IC : Infection Controls</span>,
                                        children: [
                                            {
                                                key: '/ic/opd',
                                                icon: <TbReportSearch className="w-5 h-5" />,
                                                label: <Link href="/ic/opd" onClick={onCloseLeft} className="block w-full text-left"><span className="text-white">OPD Daily</span></Link>,
                                            },
                                            {
                                                key: '/ic/ipd',
                                                icon: <TbReportSearch className="w-5 h-5" />,
                                                label: <Link href="/ic/ipd" onClick={onCloseLeft} className="block w-full text-left"><span className="text-white">IPD Daily</span></Link>,
                                            },
                                            {
                                                key: '/ic/follow-up',
                                                icon: <TbReportSearch className="w-5 h-5" />,
                                                label: <Link href="/ic/follow-up" onClick={onCloseLeft} className="block w-full text-left"><span className="text-white">ติดตามผู้ป่วยผ่าตัด(T814,A499)</span></Link>,
                                            },
                                            {
                                                key: '/ic/dashboard',
                                                icon: <TbReportSearch className="w-5 h-5" />,
                                                label: <Link href="/ic/dashboard" onClick={onCloseLeft} className="block w-full text-left"><span className="text-white">IC Dashboard</span></Link>,
                                            },
                                        ]
                                    },
                                    /* ER / OR / CHEMO เอาออกก่อน — ทั้งสามชี้ไป /or/statistics และ
                                       /chemo/statistics ซึ่งยังไม่มีหน้าจริงในระบบ กดแล้วได้ 404
                                       (ของ ER ยังชี้ผิดไปที่ URL ของ OR ด้วย) ใส่กลับได้เมื่อหน้าพร้อม */
                                ]}
                            />
                        </ConfigProvider>

                    </div>

                </div>
            </Drawer>

            {/* Right Drawer (User Profile) */}
            <Drawer
                title={<span className="text-white font-bold text-lg">Setting</span>}
                placement="right"
                onClose={onCloseRight}
                open={openRight}
                className="[&_.ant-drawer-body]:p-0 [&_.ant-drawer-content]:bg-transparent [&_.ant-drawer-header]:bg-[#005a50] [&_.ant-drawer-header]:border-b-white/10 [&_.ant-drawer-close]:text-white"
                styles={{ body: { padding: 0 }, mask: { backgroundColor: 'rgba(0, 0, 0, 0.2)' }, wrapper: { boxShadow: 'none' } }}
            >
                <div className="flex flex-col h-full bg-linear-to-b from-[#005a50] to-[#008f7f] p-4 text-white">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 p-2 font-bold border-b border-white/10 mb-2">
                            <VscAccount className="w-5 h-5" />
                            <span>Setting Information</span>
                        </div>
                        {/* เรียงตามลำดับที่ต้องตั้งค่าจริง — ตำแหน่งต้องมาก่อน
                            เพราะหน้าหอผู้ป่วยดึงรายชื่อจากตำแหน่งที่จับคู่ไว้ */}
                        <DrawerSection label="บุคลากรและเวร" />
                        <Link href="/ipd/positions" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <PiIdentificationBadgeBold className="w-5 h-5 text-white" />
                            <span>จัดการตำแหน่งบุคลากร</span>
                           </div>
                        </Link>
                        <Link href="/ipd/ward-staffs" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <LiaHospital    className="w-5 h-5 text-white" />
                            <span>ตั้งค่าหอผู้ป่วยปฏิบัติงาน</span>
                           </div>
                        </Link>
                        <Link href="/ipd/ward-quotas" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <LiaHospital    className="w-5 h-5 text-white" />
                            <span>ตั้งค่าหอผู้ป่วย (อัตรากำลังต่อเวร)</span>
                           </div>
                        </Link>
                        <Link href="/ipd/shift-configs" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <GrSchedulePlay    className="w-5 h-5 text-white" />
                            <span>ตั้งค่าเวรเจ้าหน้าที่</span>
                           </div>
                        </Link>
                        <Link href="/ipd/shift-rates" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <PiMoneyWavyBold className="w-5 h-5 text-white" />
                            <span>ตั้งค่าตอบแทนตามเวร</span>
                           </div>
                        </Link>

                        <DrawerSection label="รายงานภาระงาน" />
                        {/* <Link href="#" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <CgPerformance    className="w-5 h-5 text-white" />
                            <span>Performance ของฉัน</span>
                           </div>
                        </Link> */}
                        <Link href="/ipd/fte" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <CgPerformance    className="w-5 h-5 text-white" />
                            <span>Full-Time Equivalent (FTE)</span>
                           </div>
                        </Link>

                        <DrawerSection label="การแสดงผล" />
                        {/* โหมดสว่าง/มืด — ทุกคนตั้งได้ เป็นความชอบส่วนตัวรายเครื่อง
                            ไม่ใช่นโยบายระดับระบบแบบสวิตช์ผู้ช่วย AI */}
                        <div className="p-2 text-white">
                            <div className="flex items-center gap-3 mb-2">
                                <PiMoonBold className="w-5 h-5 text-white" />
                                <span>โหมดการแสดงผล</span>
                            </div>
                            <Segmented
                                block
                                size="small"
                                value={mode}
                                onChange={v => setMode(v as ThemeMode)}
                                options={[
                                    { value: 'light', label: 'สว่าง' },
                                    { value: 'dark', label: 'มืด' },
                                    { value: 'system', label: 'ตามเครื่อง' },
                                ]}
                            />
                            {mode === 'system' && (
                                <div className="text-xs text-white/60 mt-1">
                                    ตอนนี้เครื่องตั้งเป็นโหมด{resolved === 'dark' ? 'มืด' : 'สว่าง'}
                                </div>
                            )}
                        </div>

                        {/* งานออกแบบเนื้อหาวิชาการ คนละเรื่องกับการดูแลระบบ จึงแยกหมวดกัน
                            สิทธิ์เข้าถึงยังผูกกับ can_manage เหมือนเดิม (ADMIN ใน core_kon)
                            การเปิดให้หัวหน้าพยาบาลเข้าได้ต้องแก้ที่ฝั่งเซิร์ฟเวอร์ ไม่ใช่ที่เมนู */}
                        {aiSetting?.can_manage && (
                            <>
                                <DrawerSection label="งานวิชาการการพยาบาล" />
                                <Link href="/ipd/care-plan-templates" onClick={onCloseRight}>
                                    <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                                        <PiListChecksBold className="w-5 h-5 text-white" />
                                        <span>ออกแบบแม่แบบแผนการพยาบาล</span>
                                    </div>
                                </Link>

                                <DrawerSection label="ผู้ดูแลระบบ" />
                                <Link href="/ipd/holidays" onClick={onCloseRight}>
                                    <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                                        <PiCalendarXBold className="w-5 h-5 text-white" />
                                        <span>จัดการวันหยุด</span>
                                    </div>
                                </Link>
                                <button
                                    onClick={() => setAiDrawerOpen(true)}
                                    className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white w-full text-left"
                                >
                                    <PiSparkleBold className="w-5 h-5 text-white" />
                                    <span className="flex-1">ผู้ช่วย AI</span>
                                    <span className={`text-xs px-2 py-0.5 rounded ${aiSetting.enabled ? 'bg-emerald-400/30 text-emerald-50' : 'bg-white/10 text-white/60'}`}>
                                        {aiSetting.enabled ? 'เปิด' : 'ปิด'}
                                    </span>
                                </button>
                            </>
                        )}

                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-3 p-2 mt-auto pt-3 border-t border-white/15 hover:bg-white/10 rounded-b text-red-100 hover:text-white transition-colors w-full text-left">
                        <VscSignOut className="w-5 h-5" />
                        <span>ออกจากระบบ</span>
                    </button>
                </div>
            </Drawer>

            {/* ตั้งค่าผู้ช่วย AI — เฉพาะผู้ดูแลระบบ */}
            <Drawer
                title="ผู้ช่วย AI"
                placement="right"
                size={420}
                onClose={() => setAiDrawerOpen(false)}
                open={aiDrawerOpen}
            >
                {!aiSetting ? (
                    <Spin />
                ) : (
                    <div className="flex flex-col gap-4">
                        <Checkbox
                            checked={aiSetting.enabled}
                            disabled={aiSaving}
                            onChange={e => toggleAi(e.target.checked)}
                        >
                            <span className="font-semibold">เปิดโหมดผู้ช่วย AI</span>
                        </Checkbox>

                        <Typography.Text type="secondary" className="text-xs">
                            เปลี่ยนแล้วมีผลกับทุกคนทันที เพราะเซิร์ฟเวอร์ตรวจค่านี้ทุกครั้งที่มีการเรียกใช้ผู้ช่วย
                            ไม่ได้จำไว้ตอนเปิดโปรแกรม ปิดแล้วคำขอที่ยิงเข้ามาจะถูกปฏิเสธทันทีแม้หน้าจอจะเปิดค้างอยู่
                        </Typography.Text>

                        {aiSaving && <Spin size="small" />}

                        {aiError && <Alert type="error" showIcon title={aiError} />}

                        <Alert
                            type={aiSetting.enabled ? 'success' : 'info'}
                            showIcon
                            title={aiSetting.enabled ? 'กำลังเปิดใช้งาน' : 'ปิดใช้งานอยู่'}
                            description={
                                aiSetting.enabled
                                    ? 'ปุ่มช่วยร่างในหน้าแผนการพยาบาลใช้งานได้ ผลที่ได้เป็นร่างที่พยาบาลต้องตรวจแก้ก่อนบันทึกเสมอ'
                                    : 'ปุ่มช่วยร่างจะไม่แสดงในหน้าแผนการพยาบาล'
                            }
                        />

                        {aiSetting.updated_at && (
                            <Typography.Text type="secondary" className="text-xs">
                                แก้ไขล่าสุด {new Date(aiSetting.updated_at).toLocaleString('th-TH')}
                                {aiSetting.updated_by ? ` โดย ${aiSetting.updated_by}` : ''}
                            </Typography.Text>
                        )}

                        <Typography.Text type="secondary" className="text-xs">
                            โมเดลรันในเครือข่ายโรงพยาบาล ข้อมูลที่ส่งมีเฉพาะข้อความทางคลินิก อายุ เพศ และสัญญาณชีพ
                            ไม่มี HN AN ชื่อ หรือเตียง
                        </Typography.Text>
                    </div>
                )}
            </Drawer>
        </nav>
    )
}

export default Navbar