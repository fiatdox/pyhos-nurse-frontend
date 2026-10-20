'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MENU, BASE_LINKS, MENU_ACCESS_ITEM, defaultGroupsOf, type MenuGroup, type MenuItem, type MenuSection } from './menu';

/**
 * กลุ่มของผู้ใช้ และเมนูที่กลุ่มนั้นเห็น
 *
 * เซิร์ฟเวอร์บอกสองอย่าง: ผู้ใช้อยู่กลุ่มไหน และมีข้อยกเว้นอะไรบ้าง
 * ส่วนค่าเริ่มต้นของแต่ละเมนูอยู่ในสารบัญฝั่งหน้าจอ (menu.tsx) เมนูใหม่จึงใช้งานได้ทันที
 * โดยไม่ต้องรอใครไปเพิ่มแถวในฐานข้อมูล
 *
 * ระหว่างที่ยังไม่รู้คำตอบ (ready = false) หน้าจอควรยังไม่วาดเมนู
 * ไม่ใช่วาดทุกเมนูไว้ก่อนแล้วค่อยซ่อน เพราะเมนูที่กะพริบขึ้นมาครึ่งวินาทีก็ถูกกดได้
 */

export interface MenuAccess {
    ready: boolean;
    groups: MenuGroup[];
    groupLabels: string[];
    isAdmin: boolean;
    majorName: string;
    /** เห็นเมนูนี้ไหม ใช้รหัสเมนูจากสารบัญ */
    can: (key: string) => boolean;
    /** หมวดที่เหลือหลังกรองแล้ว หมวดที่ไม่เหลือเมนูเลยจะหายไปทั้งหมวด */
    sections: { section: MenuSection; items: MenuItem[] }[];
    baseLinks: MenuItem[];
}

interface AccessResponse {
    groups?: string[];
    group_labels?: string[];
    is_admin?: boolean;
    major_name?: string;
    overrides?: Record<string, boolean>;
}

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * @param endpoint ของเจ้าหน้าที่ใช้ค่าเริ่มต้น ส่วนหน้าจอบริษัทผู้รับจ้างส่ง /api/v1/vendor/menu-access
 * @param headers  token ของบริษัทอยู่คนละคุกกี้กับของเจ้าหน้าที่ จึงต้องส่งตัวอ่านของตัวเองมาด้วย
 */
export const useMenuAccess = (
    endpoint = '/api/v1/system/menu-access',
    headers: () => Record<string, string> = authHeaders,
    /*
      กลุ่มที่ใช้เมื่อถามเซิร์ฟเวอร์ไม่สำเร็จ

      หน้าจอของเจ้าหน้าที่ไม่ต้องใส่ เพราะไม่รู้ว่าคนที่นั่งอยู่เป็นใคร เหลือเมนูพื้นฐานไว้ก็ยังใช้งานได้
      แต่หน้าจอของบริษัทผู้รับจ้างรู้แน่นอนว่าเป็นกลุ่ม vendor ถ้าไม่ใส่ค่าสำรอง
      เน็ตสะดุดครั้งเดียวจะได้แถบข้างว่างเปล่าทั้งแถบ ซึ่งดูเหมือนระบบพัง
    */
    fallbackGroups: MenuGroup[] = [],
): MenuAccess => {
    const [ready, setReady] = useState(false);
    const [groups, setGroups] = useState<MenuGroup[]>([]);
    const [groupLabels, setGroupLabels] = useState<string[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [majorName, setMajorName] = useState('');
    const [overrides, setOverrides] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(endpoint, { headers: headers() });
                const json = await res.json();
                if (!alive) return;
                const d = (json?.data ?? {}) as AccessResponse;
                setGroups((d.groups ?? []).filter(Boolean) as MenuGroup[]);
                setGroupLabels(d.group_labels ?? []);
                setIsAdmin(d.is_admin === true);
                setMajorName(d.major_name ?? '');
                setOverrides(d.overrides ?? {});
            } catch {
                /* ถามไม่ได้ (เน็ตสะดุด เซิร์ฟเวอร์ restart) ใช้กลุ่มสำรองของหน้าจอนั้น ไม่เดาเอง */
                if (alive) setGroups(fallbackGroups);
            } finally {
                if (alive) setReady(true);
            }
        })();
        return () => { alive = false; };
        /* ตัวอ่าน header เป็นฟังก์ชันคงที่ของแต่ละหน้าจอ ไม่ต้องเฝ้า ไม่งั้นยิงซ้ำทุกครั้งที่ re-render */
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endpoint]);

    const can = useCallback((key: string) => {
        if (key === MENU_ACCESS_ITEM.key) return isAdmin;
        const override = overrides[key];
        if (override !== undefined) return override;
        for (const section of MENU) {
            const item = section.items.find(i => i.key === key);
            if (item) return defaultGroupsOf(section, item).some(g => groups.includes(g));
        }
        /* ไม่อยู่ในสารบัญ = เมนูพื้นฐาน ทุกคนเห็น */
        return true;
    }, [overrides, groups, isAdmin]);

    const sections = useMemo(() => MENU
        .map(section => ({ section, items: section.items.filter(i => can(i.key)) }))
        .filter(s => s.items.length > 0), [can]);

    return {
        ready, groups, groupLabels, isAdmin, majorName, can, sections,
        baseLinks: BASE_LINKS,
    };
};
