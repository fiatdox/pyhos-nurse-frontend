'use client';

import {
    createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Badge, Drawer, Segmented, Select, Tooltip } from 'antd';
import {
    PiPillBold, PiListBold, PiCaretLeftBold, PiCaretRightBold, PiMoonBold,
    PiArrowUUpLeftBold, PiFirstAidKitBold, PiBuildingsBold, PiSirenBold,
} from 'react-icons/pi';
import type { IconType } from 'react-icons';
import { useThemeMode, type ThemeMode } from '../lib/theme';
import { PRIORITY, PRIORITY_ORDER, PriorityDot, type RxPriority } from '../lib/rxPriority';
import { useMenuAccess } from '../lib/useMenuAccess';

/**
 * กรอบหน้าจอของห้องยา
 *
 * แยกออกมาจากเมนูหลักของระบบพยาบาล เพราะเครื่องห้องยาเปิดค้างไว้ทั้งวัน
 * บนจอเฉพาะ คนใช้คือเจ้าหน้าที่ห้องยาที่ไม่ได้ใช้เมนูของหอผู้ป่วยเลย
 * ถ้าใช้ Navbar ร่วมกัน เมนูสิบกว่าหัวข้อจะกินที่จอที่ควรเป็นคิวงาน
 *
 * ตัวเลือก "ตึกที่รับ" และ "ความด่วนที่รับ" อยู่บนแถบข้างไม่ใช่ในหน้า เพราะเป็นการตั้งค่าประจำเครื่อง
 * ไม่ใช่ตัวกรองชั่วคราว เจ้าหน้าที่แบ่งกันรับแล้วตั้งค้างไว้ทั้งเวร
 */

const NAV: { key: string; href: string; label: string; title: string; icon: IconType }[] = [
    {
        /* รหัสเดียวกับในสารบัญเมนูกลาง ผู้ดูแลระบบปิดเมนูนี้ที่เดียวแล้วหายทั้งแถบบนและแถบข้าง */
        key: 'pharmacy.queue',
        href: '/pharmacy/queue', label: 'คิวใบสั่งยา', title: 'คิวใบสั่งยาจากหอผู้ป่วย', icon: PiFirstAidKitBold,
    },
];

const SIDEBAR = '#1e3a5f';
const TOPBAR = '#24497a';

const WARDS_KEY = 'rx_pharmacy_wards';
const SIDEBAR_KEY = 'rx_pharmacy_sidebar';
const PRIORITIES_KEY = 'rx_pharmacy_priorities';

export interface Ward { ward: number; ward_name: string }

interface PharmacyCtx {
    /** ตึกที่เครื่องนี้รับ — ว่าง = รับทุกตึก */
    wards: number[];
    wardList: Ward[];
    /** เปลี่ยนตึกที่รับ หน้าคิวเรียกตัวนี้ได้ เพื่อให้มีค่าเดียวทั้งแถบข้างและในหน้า */
    setWards: (next: number[]) => void;
    /** ความด่วนที่เครื่องนี้รับ — ว่าง = รับทุกระดับ ใช้แบ่งงานแบบไม่สนใจตึก */
    priorities: RxPriority[];
    setPriorities: (next: RxPriority[]) => void;
    /** จำนวนใบค้างในคิว ใช้แสดงบนแถบข้าง หน้าคิวเป็นคนบอกมา */
    setPending: (n: number) => void;
}

const Ctx = createContext<PharmacyCtx>({
    wards: [], wardList: [], setWards: () => {},
    priorities: [], setPriorities: () => {},
    setPending: () => {},
});
export const usePharmacy = () => useContext(Ctx);

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function PharmacyShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { mode, setMode } = useThemeMode();
    /* เมนูบนแถบข้างใช้สิทธิ์ชุดเดียวกับเมนูหลัก ไม่ได้ตัดสินเองว่าใครเห็นอะไร */
    const access = useMenuAccess();
    /*
      เริ่มต้นแบบย่อ จอห้องยาควรเหลือที่ให้คิวงานมากที่สุด เมนูมีหัวข้อเดียว
      ค่าที่ผู้ใช้กดจะถูกจำไว้ที่เครื่อง เหมือนตึกที่รับ เพราะผูกกับเครื่องหน้าเคาน์เตอร์ ไม่ใช่กับคน
    */
    const [collapsed, setCollapsed] = useState(true);
    const [drawer, setDrawer] = useState(false);
    const [wardList, setWardList] = useState<Ward[]>([]);
    const [wards, setWards] = useState<number[]>([]);
    const [priorities, setPriorities] = useState<RxPriority[]>([]);
    const [pending, setPending] = useState(0);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        (async () => {
            const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
            if (!token) { router.replace('/'); return; }

            try {
                const res = await fetch('/api/v1/system/wardsV1', { headers: authHeaders() });
                const json = await res.json();
                setWardList((json?.data ?? []).map((w: { ward: number | string; ward_name: string }) => ({
                    ward: Number(w.ward), ward_name: w.ward_name,
                })));
            } catch { /* ไม่มีรายการตึก ยังรับได้ทุกตึกตามค่าเริ่มต้น */ }

            /*
              อ่านตึกที่ตั้งไว้จากครั้งก่อน เก็บที่เครื่องไม่ใช่ที่บัญชี
              เพราะการแบ่งงานผูกกับเครื่องที่ตั้งอยู่หน้าเคาน์เตอร์ ไม่ใช่ผูกกับคน
              คนละคนมานั่งเครื่องเดิมก็ควรรับตึกชุดเดิมต่อโดยไม่ต้องตั้งใหม่
            */
            try {
                const saved = JSON.parse(localStorage.getItem(WARDS_KEY) ?? '[]');
                if (Array.isArray(saved)) setWards(saved.map(Number).filter(Number.isInteger));
            } catch { /* ค่าเสีย ถือว่ารับทุกตึก */ }

            try {
                const saved = JSON.parse(localStorage.getItem(PRIORITIES_KEY) ?? '[]');
                if (Array.isArray(saved)) {
                    setPriorities(saved.filter((p): p is RxPriority =>
                        PRIORITY_ORDER.includes(p as RxPriority)));
                }
            } catch { /* ค่าเสีย ถือว่ารับทุกระดับ */ }

            // ไม่มีค่าเก่า หรืออ่านไม่ได้ = ย่อไว้ ต้องกดกางเองจึงจะกาง
            try { setCollapsed(localStorage.getItem(SIDEBAR_KEY) !== '0'); } catch { /* โหมดส่วนตัว */ }

            setReady(true);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pickWards = useCallback((next: number[]) => {
        setWards(next);
        try { localStorage.setItem(WARDS_KEY, JSON.stringify(next)); } catch { /* โหมดส่วนตัว */ }
    }, []);

    const pickPriorities = useCallback((next: RxPriority[]) => {
        setPriorities(next);
        try { localStorage.setItem(PRIORITIES_KEY, JSON.stringify(next)); } catch { /* โหมดส่วนตัว */ }
    }, []);

    const toggleSidebar = useCallback(() => {
        setCollapsed(c => {
            const next = !c;
            try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); } catch { /* โหมดส่วนตัว */ }
            return next;
        });
    }, []);

    const ctx = useMemo<PharmacyCtx>(
        () => ({ wards, wardList, setWards: pickWards, priorities, setPriorities: pickPriorities, setPending }),
        [wards, wardList, pickWards, priorities, pickPriorities]);
    const current = NAV.find(n => n.href === pathname);

    // กันเนื้อหาวาดออกมาก่อนรู้ว่าเครื่องนี้ตั้งให้รับตึกไหน ไม่งั้นจะเห็นคิวของทุกตึกแวบหนึ่ง
    if (!ready) return null;

    const wardOptions = wardList.map(w => ({ label: w.ward_name, value: w.ward }));

    const wardPicker = (
        <div className="px-3 pb-3">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1.5">
                <PiBuildingsBold size={14} /> ตึกที่เครื่องนี้รับ
            </div>
            <Select
                mode="multiple"
                allowClear
                value={wards}
                onChange={pickWards}
                options={wardOptions}
                placeholder="ทุกตึก"
                maxTagCount="responsive"
                optionFilterProp="label"
                className="w-full"
                size="small"
            />
            <div className="text-white/65 text-[11px] mt-1.5 leading-snug">
                {wards.length === 0
                    ? 'ไม่ได้เลือก = รับทุกตึก'
                    : `รับ ${wards.length} ตึก · ใบของตึกอื่นจะไม่ขึ้นบนเครื่องนี้`}
            </div>
        </div>
    );

    /*
      แบ่งงานตามความด่วน เป็นคนละแกนกับการแบ่งตามตึก
      ใช้ตอนที่เครื่องหนึ่งรับเฉพาะ STAT ของทุกตึก อีกเครื่องรับเฉพาะยากลับบ้าน
      จึงไม่ผูกกับช่องตึกด้านบน ปล่อยตึกว่างไว้ได้ และยังเลือกพร้อมกันทั้งสองแกนได้ถ้าต้องการ
    */
    const priorityPicker = (
        <div className="px-3 pb-3">
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1.5">
                <PiSirenBold size={14} /> ความด่วนที่เครื่องนี้รับ
            </div>
            <Select
                mode="multiple"
                allowClear
                value={priorities}
                onChange={pickPriorities}
                options={PRIORITY_ORDER.map(p => ({
                    label: (
                        <span className="inline-flex items-center gap-1.5">
                            <PriorityDot color={PRIORITY[p].dot} />
                            {PRIORITY[p].label}
                        </span>
                    ),
                    value: p,
                }))}
                placeholder="ทุกระดับ"
                maxTagCount="responsive"
                className="w-full"
                size="small"
            />
            <div className="text-white/65 text-[11px] mt-1.5 leading-snug">
                {priorities.length === 0
                    ? 'ไม่ได้เลือก = รับทุกระดับ'
                    : `รับเฉพาะ ${priorities.map(p => PRIORITY[p].label).join(' · ')} · ระดับอื่นจะไม่ขึ้นและไม่มีเสียงบนเครื่องนี้`}
            </div>
        </div>
    );

    /*
      ตอนย่อ ช่องเลือกตึกใส่ไม่ลง แต่ถ้าซ่อนไปเฉย ๆ คนจะลืมว่าเครื่องนี้ตั้งรับไว้กี่ตึก
      แล้วนึกว่าคิวว่างจริง จึงเหลือไอคอนกับจำนวนตึกไว้ กดแล้วกางออกไปตั้งค่าได้
    */
    const wardMini = (
        <Tooltip
            placement="right"
            title={`${wards.length === 0
                ? 'รับทุกตึก'
                : `รับ ${wards.length} ตึก: ${wardList.filter(w => wards.includes(w.ward)).map(w => w.ward_name).join(', ')}`}`
                + (priorities.length > 0 ? ` · เฉพาะ ${priorities.map(p => PRIORITY[p].label).join(', ')}` : '')
                + ' · กดเพื่อตั้งค่า'}
        >
            <button
                onClick={toggleSidebar}
                className="mx-2 mb-2 flex flex-col items-center gap-0.5 rounded-lg py-2
                    text-white/70 hover:bg-white/10 transition-colors"
                aria-label="ตึกที่เครื่องนี้รับ"
            >
                <PiBuildingsBold size={18} />
                <span className="text-[11px] leading-none">
                    {wards.length === 0 ? 'ทุกตึก' : `${wards.length} ตึก`}
                </span>
                {/* ย่อแล้วยังต้องเห็นว่าเครื่องนี้ถูกตั้งให้รับแคบลง ไม่งั้นจะนึกว่าคิวว่างจริง */}
                {priorities.length > 0 && (
                    <span className="flex items-center gap-0.5 mt-0.5">
                        {priorities.map(p => <PriorityDot key={p} color={PRIORITY[p].dot} />)}
                    </span>
                )}
            </button>
        </Tooltip>
    );

    const navList = (mini: boolean) => (
        <nav className="flex flex-col gap-1 px-2 mb-2">
            {NAV.filter(n => access.can(n.key)).map(n => {
                const active = pathname === n.href;
                const item = (
                    <Link
                        key={n.href}
                        href={n.href}
                        onClick={() => setDrawer(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                            active ? 'bg-white/15' : 'hover:bg-white/10'
                        } ${mini ? 'justify-center' : ''}`}
                    >
                        {/* สีอยู่ที่ span ข้างใน เพราะกฎ a{color} ของ antd ชนะคลาสบนลิงก์ (ดู globals.css) */}
                        <span className={`flex items-center gap-3 min-w-0 ${
                            active ? 'text-white font-semibold' : 'text-white/75'
                        }`}>
                            <Badge count={n.href === '/pharmacy/queue' ? pending : 0} size="small" offset={[4, -2]}>
                                <n.icon size={18} className="shrink-0 text-inherit" />
                            </Badge>
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
                <PiPillBold size={20} />
            </span>
            {!mini && (
                <div className="leading-tight min-w-0">
                    <div className="font-semibold truncate">ห้องยา</div>
                    <div className="text-white/60 text-xs truncate">รับใบสั่งยาจากหอผู้ป่วย</div>
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
                        block size="small" value={mode}
                        onChange={v => setMode(v as ThemeMode)}
                        options={[
                            { value: 'light', label: 'สว่าง' },
                            { value: 'dark', label: 'มืด' },
                            { value: 'system', label: 'เครื่อง' },
                        ]}
                    />
                </div>
            )}
            {/* <a> ธรรมดา ไม่ใช่ปุ่มของ antd ด้วยเหตุผลเรื่อง specificity เดียวกับเมนู */}
            <Link
                href="/main"
                className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 hover:bg-white/10 transition-colors
                    ${mini ? 'justify-center' : ''}`}
            >
                <span className="flex items-center gap-3 text-white/75 text-sm">
                    <PiArrowUUpLeftBold size={18} className="shrink-0" />
                    {!mini && 'กลับระบบหลัก'}
                </span>
            </Link>
        </div>
    );

    return (
        <div className="min-h-screen flex bg-slate-50 dark:bg-[#141414]">
            <aside
                className={`hidden lg:flex flex-col shrink-0 text-white sticky top-0 h-screen
                    transition-[width] duration-200 ${collapsed ? 'w-16' : 'w-64'}`}
                style={{ backgroundColor: SIDEBAR }}
            >
                {brand(collapsed)}
                {navList(collapsed)}
                {collapsed ? wardMini : <>{wardPicker}{priorityPicker}</>}
                {footer(collapsed)}
            </aside>

            <div className="flex-1 min-w-0 flex flex-col">
                <header className="sticky top-0 z-20 text-white shadow-sm" style={{ backgroundColor: TOPBAR }}>
                    <div className="flex items-center gap-3 px-4 h-14">
                        <button
                            onClick={() => setDrawer(true)}
                            className="lg:hidden grid place-items-center size-9 rounded-lg hover:bg-white/10 transition-colors"
                            aria-label="เปิดเมนู"
                        >
                            <PiListBold size={20} />
                        </button>
                        <button
                            onClick={toggleSidebar}
                            className="hidden lg:grid place-items-center size-9 rounded-lg hover:bg-white/10 transition-colors"
                            aria-label={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
                        >
                            {collapsed ? <PiCaretRightBold size={16} /> : <PiCaretLeftBold size={16} />}
                        </button>

                        <div className="min-w-0 leading-tight">
                            <div className="font-semibold truncate">{current?.title ?? 'ห้องยา'}</div>
                            <div className="text-white/60 text-[11px] truncate">
                                {wards.length === 0
                                    ? 'รับทุกตึก'
                                    : `รับ ${wards.length} ตึก: ${wardList.filter(w => wards.includes(w.ward)).map(w => w.ward_name).join(', ')}`}
                                {priorities.length > 0
                                    && ` · เฉพาะ ${priorities.map(p => PRIORITY[p].label).join(' · ')}`}
                            </div>
                        </div>

                        {pending > 0 && (
                            <span className="ml-auto bg-white/15 rounded-lg px-3 py-1 text-sm font-semibold shrink-0">
                                ค้างในคิว {pending}
                            </span>
                        )}
                    </div>
                </header>

                <main className="flex-1 p-4 w-full max-w-[1600px] mx-auto">
                    <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
                </main>
            </div>

            <Drawer
                open={drawer}
                onClose={() => setDrawer(false)}
                placement="left"
                size={270}
                closable={false}
                styles={{ body: { padding: 0, backgroundColor: SIDEBAR, display: 'flex', flexDirection: 'column' } }}
            >
                <div className="text-white flex flex-col h-full">
                    {brand(false)}
                    {navList(false)}
                    {wardPicker}
                    {priorityPicker}
                    {footer(false)}
                </div>
            </Drawer>
        </div>
    );
}
