'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { ConfigProvider, App, theme as antdTheme } from 'antd';

/**
 * โหมดสว่าง/มืดของทั้งระบบ
 *
 * มีสองชั้นที่ต้องเปลี่ยนพร้อมกัน ไม่งั้นจะได้หน้าครึ่งสว่างครึ่งมืด
 *   1. คลาส .dark ที่ <html> — Tailwind ใช้พลิกค่าสีใน globals.css
 *   2. algorithm ของ antd — คอมโพเนนต์ที่ antd วาดเองไม่ได้ใช้คลาสของ Tailwind
 *
 * เก็บค่าที่ localStorage ไม่ใช่ฐานข้อมูล เพราะเป็นความชอบส่วนตัวรายเครื่อง
 * ไม่ใช่นโยบายระดับระบบแบบสวิตช์ผู้ช่วย AI ที่ผู้ดูแลระบบสั่งทีเดียวมีผลกับทุกคน
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'nurse-theme';

const BRAND = '#006b5f';

interface ThemeContextValue {
    /** ค่าที่ผู้ใช้เลือกไว้ */
    mode: ThemeMode;
    /** โหมดที่แสดงอยู่จริง — 'system' ถูกแปลงเป็นสว่างหรือมืดแล้ว */
    resolved: 'light' | 'dark';
    setMode: (next: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    mode: 'system',
    resolved: 'light',
    setMode: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

const prefersDark = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

const readStored = (): ThemeMode => {
    if (typeof window === 'undefined') return 'system';
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
};

/**
 * สคริปต์ที่ต้องรันก่อนเบราว์เซอร์วาดหน้าแรก
 *
 * ถ้ารอให้ React ทำงานก่อนค่อยใส่คลาส ผู้ใช้จะเห็นหน้าสว่างวาบหนึ่งเฟรมแล้วค่อยมืด
 * ทุกครั้งที่โหลดหน้า ซึ่งน่ารำคาญมากในโหมดมืด จึงต้องเป็น inline script ใน <head>
 */
export const themeInitScript = `
(function(){
  try {
    var m = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = m === 'dark' || ((!m || m === 'system') &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // เริ่มที่ system เสมอ แล้วค่อยอ่านค่าจริงหลัง mount
    // ถ้าอ่าน localStorage ตอน render แรก HTML ฝั่งเซิร์ฟเวอร์กับฝั่งเบราว์เซอร์จะไม่ตรงกัน
    const [mode, setModeState] = useState<ThemeMode>('system');
    const [systemDark, setSystemDark] = useState(false);

    useEffect(() => {
        setModeState(readStored());
        setSystemDark(prefersDark());
    }, []);

    // ผู้ใช้เลือก "ตามระบบ" ไว้ แล้วสลับธีมที่เครื่องระหว่างเปิดหน้าค้างอยู่ ต้องเปลี่ยนตามทันที
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const resolved: 'light' | 'dark' = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

    useEffect(() => {
        document.documentElement.classList.toggle('dark', resolved === 'dark');
        // บอกเบราว์เซอร์ด้วย เพื่อให้ scrollbar และช่องกรอกของระบบเข้าโทนตาม
        document.documentElement.style.colorScheme = resolved;
    }, [resolved]);

    const setMode = useCallback((next: ThemeMode) => {
        setModeState(next);
        try { window.localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* โหมดส่วนตัวเขียนไม่ได้ */ }
    }, []);

    const ctx = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, setMode]);

    return (
        <ThemeContext.Provider value={ctx}>
            <ConfigProvider
                theme={{
                    algorithm: resolved === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                    token: { colorPrimary: BRAND, borderRadius: 8 },
                    components: { Card: { headerHeight: 40 } },
                }}
            >
                <App>{children}</App>
            </ConfigProvider>
        </ThemeContext.Provider>
    );
}
