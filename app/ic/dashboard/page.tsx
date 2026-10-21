'use client';

import React, { useMemo, useState } from 'react';
import Navbar from '../../components/Navbar';
import NestPie from '@/app/components/ic/NestPie';
import LineSmooth from '@/app/components/ic/LineSmooth';
import MdroSankey from '@/app/components/ic/MdroSankey';
import IcAnalytics from '@/app/components/ic/IcAnalytics';
import { currentFiscalYear, fiscalYearOptions } from '@/app/lib/fiscalYear';
import { Card, Select } from 'antd';
import { PiCalendarBlankBold } from 'react-icons/pi';

/** ย้อนหลังได้กี่ปีงบ นับรวมปีปัจจุบัน */
const FY_SPAN = 6;

const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const DashboardPage = () => {
  const current = useMemo(() => currentFiscalYear(), []);
  const [fy, setFy] = useState(current);

  const options = useMemo(() => fiscalYearOptions(FY_SPAN, current), [current]);

  /* ช่วงวันที่ของปีงบที่เลือก บอกไว้ตรงหัวหน้า ให้รู้ว่าตัวเลขทุกกราฟนับจากช่วงไหน */
  const rangeText = useMemo(() => {
    const start = `1 ${TH_MONTH[9]} ${fy - 1}`;
    if (fy !== current) return `${start} – 30 ${TH_MONTH[8]} ${fy}`;
    const d = new Date();
    return `${start} – ${d.getDate()} ${TH_MONTH[d.getMonth()]} ${d.getFullYear() + 543} (ถึงวันนี้)`;
  }, [fy, current]);

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6 max-w-full mx-auto space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={fy}
            onChange={setFy}
            options={options}
            className="min-w-56"
            suffixIcon={<PiCalendarBlankBold />}
            aria-label="เลือกปีงบประมาณ"
          />
          <span className="text-sm text-gray-500">{rangeText}</span>
        </div>

        {/* วิเคราะห์เชิงลึก: เทียบปีก่อน อัตราต่อวันนอน ติดในโรงพยาบาล กลุ่มก้อน ใช้ปีงบเดียวกับกราฟด้านล่าง */}
        <IcAnalytics fy={fy} />

        {/* Container สำหรับแบ่ง 50/50 */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Chart ที่ 1 (50%) */}
          <div className="w-full lg:w-1/2">
            <Card
              className="shadow-xl rounded-2xl border-none"
              title={<span className="text-lg font-bold text-emerald-700">Infection Trends</span>}
            >
              <div style={{ width: '100%', height: '450px' }}>
                <LineSmooth fy={fy} />
              </div>
            </Card>
          </div>

          {/* Chart ที่ 2 (50%) */}
          <div className="w-full lg:w-1/2">
            <Card
              className="shadow-xl rounded-2xl border-none bg-white"
              title={<span className="text-lg font-bold text-blue-700">ผลเพาะเชื้อดื้อยาตามหน่วยงานที่ส่งตรวจ</span>}
            >
              <div className="flex items-center justify-center text-gray-400" style={{ width: '100%', height: '450px' }}>
                <NestPie fy={fy} />
              </div>
            </Card>
          </div>

        </div>

        {/* กราฟเส้นทางเชื้อดื้อยา วางเต็มความกว้าง เพราะมีสามคอลัมน์และป้ายชื่อเชื้อยาว */}
        <Card
          className="shadow-xl rounded-2xl border-none"
          title={<span className="text-lg font-bold text-rose-700">เส้นทางเชื้อดื้อยา (MDRO Pathway)</span>}
        >
          <div style={{ width: '100%', height: '560px' }}>
            <MdroSankey fy={fy} />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
