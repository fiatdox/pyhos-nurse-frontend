'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as echarts from 'echarts';
import axios from 'axios';
import { message, Spin } from 'antd';

interface InfectionResult {
  ResultValue: string;
  cc: number;
  fiscal_month_order: number;
  monthName: string;
}

const LineSmooth = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let chartInstance: echarts.ECharts | null = null;

    const fetchAndRenderChart = async () => {
      setLoading(true);
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) {
          message.error('ไม่พบ Token');
          router.push('/');
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.get('/api/v1/ic/result-in-fiscal-year', { headers });

        if (response.data.success && Array.isArray(response.data.data)) {
          let rawData: InfectionResult[] = response.data.data;

          // Logic: หาเดือนที่ต่อเนื่องกันเพื่อตัดเดือนที่กระโดด (เช่น เดือน 12) ออก
          const orders = [...new Set(rawData.map(item => item.fiscal_month_order))].sort((a, b) => a - b);
          let lastContinuousOrder = 0;
          for (let i = 0; i < orders.length; i++) {
            if (orders[i] === i + 1) lastContinuousOrder = orders[i];
            else break;
          }

          const filteredData = rawData.filter(item => item.fiscal_month_order <= lastContinuousOrder);
          const monthMap = new Map<string, number>();
          filteredData.forEach(item => monthMap.set(item.monthName, item.fiscal_month_order));
          const sortedMonths = Array.from(monthMap.keys()).sort(
            (a, b) => (monthMap.get(a) || 0) - (monthMap.get(b) || 0)
          );

          const uniqueInfections = [...new Set(filteredData.map(item => item.ResultValue))];
          const seriesData = uniqueInfections.map(infection => {
            const data = sortedMonths.map(month => {
              const found = filteredData.find(i => i.ResultValue === infection && i.monthName === month);
              return found ? found.cc : 0;
            });

            return {
              name: infection,
              type: 'line',
              smooth: true,
              symbol: 'circle',
              symbolSize: 8,
              emphasis: { focus: 'series' as const },
              data: data
            };
          });

          if (chartRef.current) {
            chartInstance = echarts.init(chartRef.current);
            const option = {
              tooltip: { trigger: 'item', formatter: '{a} <br/>{b} : <b>{c}</b> ราย' },
              legend: { type: 'scroll', bottom: 0 },
              grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
              xAxis: { type: 'category', boundaryGap: true, data: sortedMonths },
              yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
              series: seriesData
            };
            chartInstance.setOption(option);
          }
        }
      } catch (error: any) {
        if (error.response?.status === 401) {
          message.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
          router.push('/');
        } else {
          message.error('เกิดข้อผิดพลาดในการดึงข้อมูล');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchAndRenderChart();
    const handleResize = () => chartInstance?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      chartInstance?.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-100">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
          <Spin />
        </div>
      )}
      <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />
    </div>
  );
};

export default LineSmooth;