'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Spin } from 'antd';
import dynamic from 'next/dynamic';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import axios from 'axios';
import { useSearchParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import { PiArrowLeftBold } from 'react-icons/pi';

dayjs.locale('th');

const PDFViewerClient = dynamic(
  () => import('./PDFViewerClient').then(m => m.PDFViewerClient),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full"><Spin size="large" /></div> }
);

const PDFDownloadBtn = dynamic(
  () => import('./PDFViewerClient').then(m => m.PDFDownloadBtn),
  { ssr: false }
);

interface FoodOrderAddon {
  food_order_id: number;
  an: string;
  addon: string;
  bedno: string;
  patient_name: string;
  meal_name: string;
  food_name: string;
}

const MEAL_LABEL: Record<string, string> = {
  breakfast: 'มื้อเช้า',
  lunch: 'มื้อกลางวัน',
  dinner: 'มื้อเย็น',
};

const MEAL_NUMBER: Record<string, number> = {
  breakfast: 1,
  lunch: 2,
  dinner: 3,
};

export default function SummaryOrderPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const ward = searchParams.get('ward') || '';
  const date = searchParams.get('date') || dayjs().format('YYYY-MM-DD');
  const meal = searchParams.get('meal') || 'breakfast';

  const [data, setData] = useState<FoodOrderAddon[]>([]);
  const [loading, setLoading] = useState(false);
  const [wardName, setWardName] = useState(ward);

  const fetchData = useCallback(async () => {
    if (!ward) return;
    setLoading(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' };

      const [addonRes, wardRes] = await Promise.all([
        axios.post('/api/v1/food-orders-addon-by-ward', { ward, date, meal: MEAL_NUMBER[meal] }, { headers }),
        axios.get('/api/v1/wardsV1', { headers }).catch(() => ({ data: { data: [] } })),
      ]);

      if (addonRes.data?.success) setData(addonRes.data.data || []);

      const wardList = Array.isArray(wardRes.data) ? wardRes.data : wardRes.data.data || [];
      const found = wardList.find((w: any) => w.his_code === ward);
      if (found) setWardName(found.ward_name);
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  }, [ward, date, meal]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dateLabel = dayjs(date).format('DD/MM/YYYY');
  const mealLabel = MEAL_LABEL[meal] || meal;
  const printedAt = dayjs().format('DD/MM/YYYY HH:mm') + ' น.';
  const fileName = `ใบสรุปอาหาร_${wardName}_${date}_${meal}.pdf`;

  const pdfProps = { data, wardName, dateLabel, mealLabel, printedAt };

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <Navbar />

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Button
            icon={<PiArrowLeftBold />}
            onClick={() => router.back()}
            className="border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            ย้อนกลับ
          </Button>
          <div>
            <span className="font-bold text-[#006b5f]">ใบสรุปรายการอาหารผู้ป่วย</span>
            <span className="text-gray-400 mx-2">|</span>
            <span className="text-sm text-gray-600">{wardName}</span>
            <span className="text-gray-400 mx-2">·</span>
            <span className="text-sm text-gray-600">{dateLabel}</span>
            <span className="text-gray-400 mx-2">·</span>
            <span className="text-sm text-gray-600">{mealLabel}</span>
          </div>
        </div>

        <PDFDownloadBtn {...pdfProps} fileName={fileName} />
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Spin size="large" />
          </div>
        ) : (
          <PDFViewerClient {...pdfProps} />
        )}
      </div>
    </div>
  );
}
