'use client';

import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const ActivityChart = () => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let chartInstance: echarts.ECharts | null = null;
    if (chartRef.current) {
      chartInstance = echarts.init(chartRef.current);
      const option: echarts.EChartsOption = {
        tooltip: {
          trigger: 'axis',
        },
        legend: {
          data: ['จำนวนคำที่พูด', 'เวลาที่ใช้ (วินาที)'],
          bottom: 0,
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '15%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
        },
        yAxis: {
          type: 'value',
        },
        series: [
          {
            name: 'จำนวนคำที่พูด',
            type: 'line',
            smooth: true,
            itemStyle: { color: '#3b82f6' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
              ])
            },
            data: [120, 132, 101, 134, 90, 230, 210],
          },
          {
            name: 'เวลาที่ใช้ (วินาที)',
            type: 'line',
            smooth: true,
            itemStyle: { color: '#10b981' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(16, 185, 129, 0.5)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
              ])
            },
            data: [220, 182, 191, 234, 290, 330, 310],
          }
        ],
      };
      chartInstance.setOption(option);
    }

    const handleResize = () => chartInstance?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      chartInstance?.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="w-full mt-6 p-6 bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-800">สถิติการใช้งานระบบสั่งการด้วยเสียง</h3>
        <p className="text-sm text-slate-500">ข้อมูลจำลองการใช้งานในสัปดาห์นี้</p>
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '300px' }} />
    </div>
  );
};

export default ActivityChart;
