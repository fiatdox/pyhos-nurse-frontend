'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as echarts from 'echarts';
import axios from 'axios';
import { message } from 'antd';
import { BlockSkeleton } from '@/app/components/Skeletons';
import { useThemeMode } from '../../lib/theme';
import { registerNurseDark, chartThemeName } from '../../lib/echartsTheme';

/** เท่าที่ formatter ของ tooltip ใช้จริง echarts ส่งฟิลด์มามากกว่านี้ */
interface TooltipParam {
  axisValue: string;
  seriesName: string;
  value: number;
  marker: string;
}

interface InfectionResult {
  ResultValue: string;
  cc: number;
  fiscal_month_order: number;
  monthName: string;
}

/** fy = ปีงบประมาณ พ.ศ. ไม่ส่ง = ปีงบปัจจุบัน */
const LineSmooth = ({ fy }: { fy?: number }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  // ธีมของ echarts ตั้งได้แค่ตอน init กราฟจึงต้องสร้างใหม่ทุกครั้งที่สลับโหมด
  const { resolved } = useThemeMode();

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
        const response = await axios.get('/api/v1/ic/result-in-fiscal-year', { headers, params: { fy } });

        if (response.data.success && Array.isArray(response.data.data)) {
          /* แถวที่ไม่รู้เดือน ข้ามไป ถ้าปล่อยไว้ ตัวหาเดือนต่อเนื่องด้านล่างจะเจอเป็นตัวแรกแล้วตัดทิ้งทั้งปี */
          const rawData: InfectionResult[] = (response.data.data as InfectionResult[])
            .filter(item => Number.isInteger(item.fiscal_month_order) && !!item.monthName);

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
            registerNurseDark(echarts);
            chartInstance = echarts.init(chartRef.current, chartThemeName(resolved === 'dark'));
            const option = {
              /*
                trigger เป็น axis ไม่ใช่ item เพราะกราฟนี้มีเชื้อประมาณ 30 เส้นซ้อนกัน
                ถ้าใช้ item ต้องเล็งให้โดนจุดพอดีถึงจะเห็นตัวเลข ซึ่งแทบเป็นไปไม่ได้
                แบบ axis ชี้ตรงไหนของเดือนก็เห็นยอดทุกเชื้อในเดือนนั้นพร้อมกัน
              */
              tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'line', lineStyle: { type: 'dashed' } },
                // ให้เลื่อนอ่านได้ บางเดือนมีเชื้อขึ้นพร้อมกันเกือบ 20 ชนิด
                enterable: true,
                extraCssText: 'max-height: 340px; overflow-y: auto;',
                formatter: (params: TooltipParam[]) => {
                  if (!params?.length) return '';
                  // ตัดเชื้อที่เป็น 0 ทิ้ง ไม่งั้นทุกเดือนจะมี 30 บรรทัดโดยส่วนใหญ่เป็นศูนย์
                  const hits = params
                    .filter(p => Number(p.value) > 0)
                    .sort((a, b) => Number(b.value) - Number(a.value));
                  const total = hits.reduce((s, p) => s + Number(p.value), 0);

                  const head = `<div style="font-weight:600;margin-bottom:4px">${params[0].axisValue}`
                    + ` <span style="opacity:.65;font-weight:400">รวม ${total} ราย · ${hits.length} ชนิด</span></div>`;

                  if (hits.length === 0) return head + '<div style="opacity:.65">ไม่พบเชื้อในเดือนนี้</div>';

                  // แสดง 12 อันดับแรก ที่เหลือยุบเป็นบรรทัดเดียว กล่องจะได้ไม่ยาวจนบังกราฟ
                  const TOP = 12;
                  const rows = hits.slice(0, TOP).map(p =>
                    `<div style="display:flex;justify-content:space-between;gap:16px">`
                    + `<span>${p.marker}${p.seriesName}</span>`
                    + `<b>${p.value}</b></div>`).join('');

                  const rest = hits.slice(TOP);
                  const more = rest.length
                    ? `<div style="opacity:.65;margin-top:4px">อีก ${rest.length} ชนิด`
                      + ` รวม ${rest.reduce((s, p) => s + Number(p.value), 0)} ราย</div>`
                    : '';

                  return head + rows + more;
                },
              },
              legend: { type: 'scroll', bottom: 0 },
              grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
              xAxis: { type: 'category', boundaryGap: true, data: sortedMonths },
              yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
              series: seriesData
            };
            chartInstance.setOption(option);
          }
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
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
  }, [resolved, fy, router]);

  return (
    <div className="relative w-full h-full min-h-100">
      {loading && (
        <div className="absolute inset-0 z-10 bg-white">
          <BlockSkeleton />
        </div>
      )}
      <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />
    </div>
  );
};

export default LineSmooth;