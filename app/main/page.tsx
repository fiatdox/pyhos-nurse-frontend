'use client';

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Skeleton } from 'antd';
import type { IconType } from 'react-icons';
import { PiHandWavingBold, PiShieldCheckBold, PiSquaresFourBold } from 'react-icons/pi';
import Navbar from '../components/Navbar';
import { useMenuAccess } from '../lib/useMenuAccess';
import { MENU_ACCESS_ITEM, type MenuItem } from '../lib/menu';
import { getUserProfile } from '../lib/auth';

/**
 * หน้าหลักหลังเข้าระบบ
 *
 * การ์ดทุกใบมาจากสารบัญเมนู (lib/menu.tsx) ผ่านตัวกรองเดียวกับแถบบนและลิ้นชักซ้าย
 * จึงเห็นตรงกันทุกที่เสมอ ถ้าหน้านี้ถือรายการของตัวเอง วันหนึ่งจะมีการ์ดที่พาไปหน้าที่
 * แถบบนซ่อนไว้แล้ว หรือมีเมนูใหม่ที่แถบบนมีแต่หน้านี้ไม่มี
 *
 * การ์ดที่ซ่อนไว้ไม่ใช่การกันสิทธิ์ คนที่รู้ URL ยังพิมพ์เข้าไปได้
 * การกันข้อมูลจริงอยู่ที่ endpoint ฝั่งเซิร์ฟเวอร์
 */

/*
  สีประจำหมวด [โหมดสว่าง, โหมดมืด] ใช้กับไอคอนเท่านั้น ตัวหนังสือบนการ์ดใช้สีเทาของระบบ

  ต้องมีสองค่า เพราะเฉดเข้มที่อ่านชัดบนพื้นขาว จมหายไปบนพื้นมืด
  (เขียวเข้มของ IPD กับเทาเข้มของหมวดตั้งค่ามองแทบไม่เห็นตอนลองในโหมดมืด)
  ค่าเป็นสีคงที่ ไม่ใช่ teal-600 / red-400 เพราะ globals.css พลิกไล่เฉดของ Tailwind ในโหมดมืด
  ใช้ชื่อคลาสสีจะได้เฉดที่กลับด้านซ้อนเข้าไปอีกชั้น
*/
const SECTION_COLOR: Record<string, [light: string, dark: string]> = {
  base: ['#0891b2', '#22d3ee'],
  ipd: ['#006b5f', '#2dd4bf'],
  pharmacy: ['#7c3aed', '#a78bfa'],
  ic: ['#dc2626', '#f87171'],
  nutrition: ['#ea580c', '#fb923c'],
  settings: ['#475569', '#94a3b8'],
  admin: ['#334155', '#cbd5e1'],
};
const DEFAULT_COLOR: [string, string] = ['#006b5f', '#2dd4bf'];

/** ตัวแปรสีให้คลาส text-(--c) / dark:text-(--cd) อ่าน สีพื้นใต้ไอคอนเป็นสีเดียวกันแบบโปร่ง */
const colorVars = ([light, dark]: [string, string]) => ({
  '--c': light, '--cd': dark, '--cb': `${light}1a`, '--cbd': `${dark}24`,
}) as React.CSSProperties;

interface CardGroup {
  key: string;
  heading: string;
  icon: IconType;
  items: MenuItem[];
}

function MenuCard({ item, color }: { item: MenuItem; color: [string, string] }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="group bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-2.5 text-center
        transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-(--brand-text)
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-text)"
    >
      <span
        className="text-2xl p-3 rounded-xl text-(--c) bg-(--cb) dark:text-(--cd) dark:bg-(--cbd)"
        style={colorVars(color)}
        aria-hidden
      >
        <Icon />
      </span>
      <span className="text-[13px] font-semibold text-gray-700 leading-snug group-hover:text-(--brand-text)">
        {item.label}
      </span>
    </Link>
  );
}

const Main = () => {
  const access = useMenuAccess();
  /*
    ชื่ออยู่ใน sessionStorage ซึ่งฝั่งเซิร์ฟเวอร์ไม่มี
    อ่านผ่าน useSyncExternalStore ให้รอบเซิร์ฟเวอร์ได้ค่าว่างแล้วค่อยเติมชื่อตอนอยู่ในเบราว์เซอร์
    โปรไฟล์ไม่เปลี่ยนระหว่างอยู่หน้านี้ จึงไม่ต้องติดตามการเปลี่ยนแปลง
  */
  const name = useSyncExternalStore(
    () => () => {},
    () => String(getUserProfile()?.name ?? ''),
    () => '',
  );

  /*
    หมวดของบริษัทผู้รับจ้างไม่ขึ้นที่นี่ แม้แอดมินจะตั้งให้กลุ่มอื่นเห็นก็ตาม
    หน้าพวกนั้นใช้บัญชีบริษัทซึ่งเป็นคนละคุกกี้กับเจ้าหน้าที่ กดจากตรงนี้ไปจะเปิดไม่ได้
  */
  const groups: CardGroup[] = [
    ...access.sections
      .filter(({ section }) => section.key !== 'vendor')
      .map(({ section, items }) => ({ key: section.key, heading: section.heading, icon: section.icon, items })),
    { key: 'base', heading: 'ทั่วไป', icon: PiSquaresFourBold, items: access.baseLinks },
    ...(access.isAdmin
      ? [{ key: 'admin', heading: 'ผู้ดูแลระบบ', icon: PiShieldCheckBold, items: [MENU_ACCESS_ITEM] }]
      : []),
  ];

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />

      {/*
        สีตัวหนังสือบนแถบเป็นค่าคงที่ แถบนี้เป็นเขียวตายตัวทั้งสองโหมด
        ถ้าใช้ text-teal-200 โหมดมืดจะพลิกเป็นเฉดเข้มแล้วจมหายไปกับพื้น (ดู globals.css)
      */}
      <div className="bg-linear-to-r from-[#004d45] via-[#006b5f] to-[#00796b] px-4 sm:px-6 py-7 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm shrink-0">
            <PiHandWavingBold className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-white m-0 leading-tight truncate">
              {name ? `สวัสดี ${name}` : 'ยินดีต้อนรับ'}
            </h1>
            <p className="text-[#ccfbf1] text-sm m-0 mt-1">
              {!access.ready
                ? 'กำลังโหลดเมนูของคุณ...'
                : access.groupLabels.length > 0
                  ? `กลุ่มผู้ใช้: ${access.groupLabels.join(' · ')}`
                  : access.majorName || 'ยังไม่ได้จัดกลุ่มผู้ใช้'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/*
          ยังไม่รู้กลุ่มของผู้ใช้ ให้วาดโครงไว้ก่อน ไม่วาดการ์ดทุกใบแล้วค่อยซ่อน
          เพราะการ์ดที่โผล่มาครึ่งวินาทีก่อนหายไปก็ถูกกดได้ แล้วผู้ใช้จะงงว่ามันหายไปไหน
        */}
        {!access.ready ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : (
          groups.map(g => {
            const color = SECTION_COLOR[g.key] ?? DEFAULT_COLOR;
            const Icon = g.icon;
            return (
              <section key={g.key} aria-labelledby={`sec-${g.key}`}>
                <h2
                  id={`sec-${g.key}`}
                  className="flex items-center gap-2 text-sm font-bold text-gray-600 mb-3"
                >
                  <span className="text-(--c) dark:text-(--cd)" style={colorVars(color)} aria-hidden>
                    <Icon className="w-4.5 h-4.5" />
                  </span>
                  {g.heading}
                  <span className="text-xs font-normal text-gray-500">({g.items.length})</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {g.items.map(item => <MenuCard key={item.key} item={item} color={color} />)}
                </div>
              </section>
            );
          })
        )}

        {/*
          คนที่ไม่อยู่กลุ่มไหนเลย (แพทย์ การเงิน พัสดุ ฯลฯ) ยังมีหมวดทั่วไปให้ใช้
          จึงบอกไว้ตรงนี้ว่าทำไมเห็นน้อย จะได้รู้ว่าต้องติดต่อใคร ไม่ใช่คิดว่าระบบพัง
        */}
        {access.ready && access.groupLabels.length === 0 && (
          <p className="text-sm text-gray-500 m-0">
            บัญชีนี้ยังไม่อยู่ในกลุ่มงานที่ระบบรู้จัก จึงเห็นเฉพาะเมนูทั่วไป
            ถ้าต้องใช้เมนูอื่น ติดต่อผู้ดูแลระบบ
          </p>
        )}
      </div>
    </div>
  );
};

export default Main;
