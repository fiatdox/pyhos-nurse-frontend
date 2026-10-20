'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Drawer, Segmented, Tooltip } from 'antd';
import {
    PiSignOutBold, PiForkKnifeBold, PiMoneyWavyBold, PiBuildingsBold,
    PiTagBold, PiListBold, PiCaretLeftBold, PiCaretRightBold, PiMoonBold,
} from 'react-icons/pi';
import type { IconType } from 'react-icons';
import { useThemeMode, type ThemeMode } from '../lib/theme';
import { clearVendorSession, getVendorProfile, vendorHeaders, type VendorProfile } from '../lib/vendorAuth';
import { useMenuAccess } from '../lib/useMenuAccess';

/**
 * กรอบหน้าจอฝั่งบริษัทผู้รับจ้างทำอาหาร — แถบบน + เมนูข้าง
 *
 * ไม่ใช้ Navbar ของโรงพยาบาล เพราะ Navbar นั้นมีเมนูของระบบภายในทั้งหมด
 * และอ่านคุกกี้คนละตัว ถ้าเอามาใช้ร่วม วันหนึ่งจะมีเมนูใหม่โผล่ให้คนนอกเห็น
 * โดยไม่มีใครตั้งใจ ที่นี่รายการเมนูเป็นค่าคงที่สี่บรรทัดด้านล่าง เพิ่มเองเท่านั้น
 *
 * ตัวนี้ถูกเรียกจาก app/vendor/layout.tsx ไม่ใช่จากแต่ละหน้า
 * เมนูข้างจึงไม่ถูกสร้างใหม่ตอนสลับหน้า สถานะย่อ/ขยายจึงไม่รีเซ็ตทุกครั้งที่กดเมนู
 */

const NAV: { key: string; href: string; label: string; title: string; icon: IconType }[] = [
    /* รหัสตรงกับสารบัญเมนูกลาง (lib/menu.tsx) ผู้ดูแลระบบปิดรายเมนูให้กลุ่มบริษัทได้ */
    { key: 'vendor.report', href: '/vendor/report', label: 'ยอดเงิน', title: 'ยอดค่าอาหาร', icon: PiMoneyWavyBold },
    { key: 'vendor.kitchen', href: '/vendor/kitchen', label: 'ใบรายการอาหาร', title: 'ใบรายการอาหาร', icon: PiForkKnifeBold },
    { key: 'vendor.ward-summary', href: '/vendor/ward-summary', label: 'ยอดตามตึก', title: 'ยอดสั่งอาหารตามหอผู้ป่วย', icon: PiBuildingsBold },
    { key: 'vendor.labels', href: '/vendor/labels', label: 'ใบติดถาด', title: 'ฉลากติดถาดอาหาร', icon: PiTagBold },
];

const SIDEBAR = '#00564d';
const TOPBAR = '#006b5f';

export default function VendorShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { mode, setMode } = useThemeMode();
    const [profile, setProfile] = useState<VendorProfile | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [drawer, setDrawer] = useState(false);
    /* เมนูที่ผู้ดูแลระบบเปิดให้กลุ่มบริษัท ใช้ token ของบริษัท ไม่ใช่ของเจ้าหน้าที่ */
    const access = useMenuAccess('/api/v1/vendor/menu-access', vendorHeaders, ['vendor']);

    const signOut = useCallback(() => {
        clearVendorSession();
        router.replace('/vendor/login');
    }, [router]);

    useEffect(() => {
        const p = getVendorProfile();
        if (!p) {
            router.replace('/vendor/login');
            return;
        }
        /*
          sessionStorage อ่านได้เฉพาะฝั่งเบราว์เซอร์ จึงอ่านหลัง mount เท่านั้น
          ตัวตรวจเตือนเรื่องเรียก setState ใน effect ซึ่งปกติถูกต้อง
          แต่กรณีนี้คือการดึงค่าจากที่เก็บของเบราว์เซอร์เข้ามาครั้งเดียวตอนเปิดหน้า
          ซึ่งเป็นการซิงก์กับระบบภายนอกตามที่กฎข้อนั้นยกเว้นไว้เอง
        */
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setProfile(p);
    }, [router]);

    // กันไม่ให้เนื้อหาวาดออกมาชั่ววินาทีก่อนถูกเด้งกลับหน้าเข้าระบบ
    if (!profile) return null;

    const current = NAV.find(n => n.href === pathname);
    const visibleNav = NAV.filter(n => access.can(n.key));

    /* ใช้ตัวเดียวกันทั้งเมนูข้างบนจอกว้างและในลิ้นชักบนมือถือ รายการจะได้ไม่หลุดจากกัน */
    const navList = (mini: boolean) => (
        <nav className="flex flex-col gap-1 px-2">
            {visibleNav.map(n => {
                const active = pathname === n.href;
                const item = (
                    <Link
                        key={n.href}
                        href={n.href}
                        /* ปิดลิ้นชักตรงนี้ ไม่ใช่ใน effect ที่เฝ้าดู pathname
                           เพราะการกดเมนูคือเหตุการณ์ที่รู้ตัวอยู่แล้วว่าต้องปิด
                           ไม่ต้องรอให้หน้าเปลี่ยนเสร็จแล้วค่อยสั่ง setState ซ้ำอีกรอบ */
                        onClick={() => setDrawer(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                            active ? 'bg-white/15' : 'hover:bg-white/10'
                        } ${mini ? 'justify-center' : ''}`}
                    >
                        {/*
                          สีตัวอักษรต้องอยู่ที่ <span> ข้างใน ไม่ใช่ที่ <a>
                          เพราะ CSS ของ antd ไม่ได้ถูกห่อ layer ไว้ (ดูเหตุผลใน globals.css)
                          กฎ a{color} ของ antd จึงชนะ text-white ที่ใส่บนลิงก์ตรง ๆ
                          แล้วเมนูจะกลายเป็นเขียวเข้มบนพื้นเขียว อ่านไม่ออกทั้งแถบ
                        */}
                        <span className={`flex items-center gap-3 min-w-0 ${
                            active ? 'text-white font-semibold' : 'text-white/75'
                        }`}>
                            <n.icon size={18} className="shrink-0" />
                            {!mini && <span className="truncate text-sm">{n.label}</span>}
                        </span>
                    </Link>
                );
                return mini
                    ? <Tooltip key={n.href} title={n.label} placement="right">{item}</Tooltip>
                    : item;
            })}
        </nav>
    );

    const brand = (mini: boolean) => (
        <div className={`flex items-center gap-3 px-4 py-4 min-w-0 ${mini ? 'justify-center px-2' : ''}`}>
            <span className="grid place-items-center size-9 rounded-xl bg-white/15 shrink-0">
                <PiForkKnifeBold size={20} />
            </span>
            {!mini && (
                <div className="leading-tight min-w-0">
                    <div className="font-semibold truncate">{profile.vendor_name}</div>
                    <div className="text-white/60 text-xs truncate">คู่สัญญาโรงพยาบาล</div>
                </div>
            )}
        </div>
    );

    const footer = (mini: boolean) => (
        <div className="mt-auto px-2 pb-3 pt-2 border-t border-white/15">
            {!mini && (
                <div className="px-2 pb-2">
                    <div className="flex items-center gap-2 text-white/60 text-xs mb-1.5">
                        <PiMoonBold size={14} /> โหมดการแสดงผล
                    </div>
                    <Segmented
                        block
                        size="small"
                        value={mode}
                        onChange={v => setMode(v as ThemeMode)}
                        options={[
                            { value: 'light', label: 'สว่าง' },
                            { value: 'dark', label: 'มืด' },
                            { value: 'system', label: 'เครื่อง' },
                        ]}
                    />
                </div>
            )}
            {/*
              <button> ธรรมดา ไม่ใช่ Button ของ antd
              ปุ่ม ghost ของ antd ทำแค่พื้นโปร่ง สีตัวอักษรยังเป็นสีข้อความปกติ
              พออยู่บนแถบเขียวจึงเป็นเข้มบนเข้ม และต้องไล่ทับ specificity กันไม่จบ
            */}
            <button
                onClick={signOut}
                className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm
                    text-red-100 hover:bg-white/10 hover:text-white transition-colors
                    ${mini ? 'justify-center' : ''}`}
            >
                <PiSignOutBold size={18} className="shrink-0" />
                {!mini && 'ออกจากระบบ'}
            </button>
        </div>
    );

    return (
        <div className="min-h-screen flex bg-slate-50 dark:bg-[#141414]">
            {/*
              เมนูข้างอยู่บนจอตั้งแต่ lg ขึ้นไป ต่ำกว่านั้นย้ายไปอยู่ในลิ้นชัก
              หน้าใบติดถาดกับยอดตามตึกเป็นตารางกว้าง จึงยุบเหลือไอคอนได้
            */}
            <aside
                className={`hidden lg:flex flex-col shrink-0 text-white sticky top-0 h-screen
                    transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-64'}`}
                style={{ backgroundColor: SIDEBAR }}
            >
                {brand(collapsed)}
                {navList(collapsed)}
                {footer(collapsed)}
            </aside>

            <div className="flex-1 min-w-0 flex flex-col">
                <header
                    className="sticky top-0 z-20 text-white shadow-sm"
                    style={{ backgroundColor: TOPBAR }}
                >
                    <div className="flex items-center gap-3 px-4 h-14">
                        <button
                            onClick={() => setDrawer(true)}
                            className="lg:hidden grid place-items-center size-9 rounded-lg hover:bg-white/10 transition-colors"
                            aria-label="เปิดเมนู"
                        >
                            <PiListBold size={20} />
                        </button>
                        <button
                            onClick={() => setCollapsed(c => !c)}
                            className="hidden lg:grid place-items-center size-9 rounded-lg hover:bg-white/10 transition-colors"
                            aria-label={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
                        >
                            {collapsed ? <PiCaretRightBold size={16} /> : <PiCaretLeftBold size={16} />}
                        </button>

                        <div className="min-w-0 leading-tight">
                            <div className="font-semibold truncate">{current?.title ?? 'ระบบบริษัทคู่สัญญา'}</div>
                            <div className="text-white/60 text-[11px] truncate lg:hidden">{profile.vendor_name}</div>
                        </div>

                        {/*
                          ชื่อผู้ใช้อยู่ขวาบน ไม่ใช่ในเมนูข้าง เพราะเป็นของที่ต้องเห็นตลอด
                          บริษัทหนึ่งมีได้หลายบัญชี จะได้รู้ว่ากำลังเปิดด้วยบัญชีไหนอยู่
                        */}
                        <div className="ml-auto flex items-center gap-2 min-w-0">
                            <span className="hidden sm:block text-white/75 text-xs truncate max-w-56">
                                {profile.display_name}
                            </span>
                            <span className="grid place-items-center size-8 rounded-full bg-white/15 text-sm shrink-0">
                                {profile.display_name?.trim().charAt(0) || '?'}
                            </span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-4 w-full max-w-7xl mx-auto">{children}</main>
            </div>

            <Drawer
                open={drawer}
                onClose={() => setDrawer(false)}
                placement="left"
                size={260}
                closable={false}
                styles={{ body: { padding: 0, backgroundColor: SIDEBAR, display: 'flex', flexDirection: 'column' } }}
            >
                <div className="text-white flex flex-col h-full">
                    {brand(false)}
                    {navList(false)}
                    {footer(false)}
                </div>
            </Drawer>
        </div>
    );
}
