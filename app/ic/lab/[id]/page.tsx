'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import { Card } from 'antd';
import { LabResultText, useLabResult } from '@/app/components/ic/LabResult';

/* หน้าเต็มของผลแล็บ สำหรับเปิดในแท็บใหม่หรือส่งลิงก์ต่อ ปกติหน้า IC เปิดเป็นหน้าต่างแทน */
const LabResultPage = () => {
  const params = useParams();
  const labId = (params?.id as string) || null;
  const result = useLabResult(labId);

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6 max-w-5xl mx-auto">
        <Card
          className="shadow-xl rounded-2xl border-none"
          title={<span className="text-xl font-bold text-emerald-700">ผลการตรวจ Lab (Order No: {labId})</span>}
        >
          <LabResultText {...result} />
        </Card>
      </div>
    </div>
  );
};

export default LabResultPage;
