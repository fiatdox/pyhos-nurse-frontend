'use client';

import React from 'react';
import Link from 'next/link';
import { Card, Tag, Empty } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import {
  PiMegaphoneBold,
  PiPushPinFill,
  PiCalendarBlankBold,
  PiUserPlusBold,
  PiUsersThreeBold,
  PiBowlFoodBold,
  PiClipboardTextBold,
  PiChartBarBold,
  PiVirusBold,
  PiArrowRightBold,
} from 'react-icons/pi';
import Navbar from '../components/Navbar';

dayjs.locale('th');

type AnnouncementCategory = 'ประกาศ' | 'อบรม' | 'กิจกรรม' | 'ระบบ';

interface Announcement {
  id: number;
  title: string;
  detail: string;
  date: string;            // YYYY-MM-DD
  category: AnnouncementCategory;
  pinned?: boolean;
}

/**
 * เนื้อหาประชาสัมพันธ์
 * ยังไม่มีตารางข่าวในฐานข้อมูล จึงเก็บไว้ในไฟล์นี้ก่อน — แก้ไข/เพิ่มรายการได้ที่นี่โดยตรง
 * โครงสร้างตรงกับที่ API จะคืนในอนาคต ถ้าย้ายไปเก็บใน DB เปลี่ยนแค่ที่มาของ announcements
 */
const announcements: Announcement[] = [
  {
    id: 1,
    title: 'เปิดใช้งาน Dashboard ภาระงานพยาบาลแล้ววันนี้',
    detail:
      'ดูสถิติผู้ป่วยรายวัน อัตราครองเตียง ชั่วโมงการทำงานรายบุคคล และการเปลี่ยนระดับการดูแลข้ามเวร เลือกหอผู้ป่วยและช่วงเวลาที่ต้องการได้จากเมนู IPD → Dashboard',
    date: '2026-07-31',
    category: 'ระบบ',
    pinned: true,
  },
  {
    id: 2,
    title: 'ขอความร่วมมือบันทึกระดับการดูแลให้ครบทั้ง 3 เวร',
    detail:
      'การบันทึกที่ครบถ้วนทั้งเวรดึก เช้า และบ่าย จะทำให้รายงาน FTE และ Dashboard คำนวณภาระงานได้ตรงกับความเป็นจริง กรุณาบันทึกก่อนสิ้นเวรทุกครั้ง',
    date: '2026-07-28',
    category: 'ประกาศ',
    pinned: true,
  },
  {
    id: 3,
    title: 'อบรมการใช้งานระบบบันทึกทางการพยาบาล รุ่นที่ 2',
    detail:
      'สำหรับพยาบาลวิชาชีพและผู้ช่วยพยาบาลที่ยังไม่ผ่านการอบรมรุ่นที่ 1 ลงทะเบียนได้ที่หัวหน้าหอผู้ป่วยของท่าน',
    date: '2026-07-20',
    category: 'อบรม',
  },
  {
    id: 4,
    title: 'ปรับปรุงเมนูอาหารผู้ป่วยประจำเดือนสิงหาคม',
    detail:
      'ฝ่ายโภชนาการปรับรายการอาหารเฉพาะโรคใหม่ กรุณาตรวจสอบรายการก่อนสั่งอาหารให้ผู้ป่วยในเมนู IPD → สั่งอาหาร',
    date: '2026-07-15',
    category: 'ประกาศ',
  },
];

const categoryColor: Record<AnnouncementCategory, string> = {
  ประกาศ: 'green',
  อบรม: 'blue',
  กิจกรรม: 'purple',
  ระบบ: 'orange',
};

const quickLinks = [
  { href: '/ipd/register', label: 'รับผู้ป่วย / รับย้าย', icon: <PiUserPlusBold />, color: '#0891b2' },
  { href: '/ipd/patients', label: 'ทะเบียนผู้ป่วย', icon: <PiUsersThreeBold />, color: '#006b5f' },
  { href: '/ipd/daily-routine', label: 'รายงานประจำวัน', icon: <PiClipboardTextBold />, color: '#7c3aed' },
  { href: '/ipd/order-food', label: 'สั่งอาหาร', icon: <PiBowlFoodBold />, color: '#ea580c' },
  { href: '/ipd/dashboard', label: 'Dashboard', icon: <PiChartBarBold />, color: '#0f766e' },
  { href: '/ic/ipd', label: 'IPD Infection Control', icon: <PiVirusBold />, color: '#dc2626' },
];

const Main = () => {
  // ปักหมุดขึ้นก่อน แล้วเรียงจากใหม่ไปเก่า
  const sorted = [...announcements].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return dayjs(b.date).valueOf() - dayjs(a.date).valueOf();
  });

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />

      {/* ── Hero ── */}
      <div className="bg-linear-to-r from-[#004d45] via-[#006b5f] to-[#00897b] px-4 sm:px-6 py-8 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm shrink-0">
            <PiMegaphoneBold className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white m-0 leading-tight">ข่าวประชาสัมพันธ์</h1>
            <p className="text-teal-200 text-sm m-0 mt-1">
              ข่าวสารและประกาศสำหรับบุคลากรทางการพยาบาล
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        {/* ── ทางลัดเมนูที่ใช้บ่อย ── */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">เมนูที่ใช้บ่อย</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="group bg-white rounded-2xl shadow-md p-4 flex flex-col items-center gap-2 text-center transition-all hover:shadow-xl hover:-translate-y-0.5"
              >
                <span
                  className="text-2xl p-2.5 rounded-xl transition-colors"
                  style={{ color: link.color, backgroundColor: `${link.color}15` }}
                >
                  {link.icon}
                </span>
                <span className="text-xs font-semibold text-gray-600 leading-tight group-hover:text-[var(--brand-text)]">
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── รายการข่าว ── */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
            ประกาศล่าสุด
          </h2>

          {sorted.length === 0 ? (
            <Card className="shadow-md rounded-2xl border-none">
              <Empty description="ยังไม่มีข่าวประชาสัมพันธ์" />
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {sorted.map(item => (
                <Card
                  key={item.id}
                  className={`shadow-md rounded-2xl border-none transition-all hover:shadow-lg ${
                    item.pinned ? 'ring-1 ring-[#006b5f]/20' : ''
                  }`}
                  styles={{ body: { padding: '1rem 1.25rem' } }}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {item.pinned && (
                      <span className="flex items-center gap-1 text-[var(--brand-text)] text-xs font-bold">
                        <PiPushPinFill /> ปักหมุด
                      </span>
                    )}
                    <Tag color={categoryColor[item.category]} className="m-0 text-xs">
                      {item.category}
                    </Tag>
                    <span className="flex items-center gap-1 text-gray-400 text-xs ml-auto">
                      <PiCalendarBlankBold />
                      {/* dayjs ในโปรเจกต์ยังไม่ได้ลง plugin buddhistEra จึงบวกปี พ.ศ. เอง */}
                      {dayjs(item.date).format('D MMM')} {dayjs(item.date).year() + 543}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-gray-800 m-0 mb-1 leading-snug">{item.title}</h3>
                  <p className="text-sm text-gray-500 m-0 leading-relaxed">{item.detail}</p>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── ลิงก์ไป Dashboard ── */}
        <Link
          href="/ipd/dashboard"
          className="bg-linear-to-r from-teal-50 to-white dark:from-[#113536] dark:to-[#1f1f1f] border border-teal-100 rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-md"
        >
          <span className="bg-[#006b5f] text-white p-3 rounded-xl text-xl shrink-0">
            <PiChartBarBold />
          </span>
          <div className="flex-1">
            <p className="font-bold text-[var(--brand-text)] m-0 text-sm">ดูภาพรวมภาระงานของหอผู้ป่วย</p>
            <p className="text-gray-500 text-xs m-0 mt-0.5">
              สถิติผู้ป่วยรายวัน อัตราครองเตียง ชั่วโมงการทำงาน และระดับความรุนแรงแยกตามเวร
            </p>
          </div>
          <PiArrowRightBold className="text-[var(--brand-text)] text-lg shrink-0" />
        </Link>
      </div>
    </div>
  );
};

export default Main;
