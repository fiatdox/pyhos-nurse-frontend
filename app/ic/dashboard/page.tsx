'use client';

import React from 'react';
import Navbar from '../../components/Navbar';
import NestPie from '@/app/components/ic/NestPie';
import LineSmooth from '@/app/components/ic/LineSmooth';
import { Card } from 'antd';

const DashboardPage = () => {
  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6 max-w-full mx-auto">
        {/* Container สำหรับแบ่ง 50/50 */}
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Chart ที่ 1 (50%) */}
          <div className="w-full lg:w-1/2">
            <Card 
              className="shadow-xl rounded-2xl border-none" 
              title={<span className="text-lg font-bold text-emerald-700">Infection Trends</span>}
            >
              <div style={{ width: '100%', height: '450px' }}>
                <LineSmooth />
              </div>
            </Card>
          </div>

          {/* Chart ที่ 2 (50%) - ตัวอย่างโครงสร้างเตรียมไว้ให้ */}
          <div className="w-full lg:w-1/2">
            <Card 
              className="shadow-xl rounded-2xl border-none bg-white" 
              title={<span className="text-lg font-bold text-blue-700">Future Chart</span>}
            >
              <div className="flex items-center justify-center text-gray-400" style={{ width: '100%', height: '450px' }}>
                <NestPie />
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DashboardPage;