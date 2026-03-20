'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as echarts from 'echarts';
import axios from 'axios';
import { message } from 'antd';

interface DepResult {
  department: string;
  cc: number;
}

const NestPie = () => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [outerData, setOuterData] = useState<{name: string, value: number}[]>([]);
  const router = useRouter();

  // ดึงข้อมูลแผนกสำหรับแสดงในวงนอก
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) {
          message.error('ไม่พบ Token');
          router.push('/');
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const res = await axios.get('/api/v1/ic/result-dep-in-fiscal-year', { headers });
        
        if (res.data && res.data.success && Array.isArray(res.data.data)) {
          const formatted = res.data.data.map((item: DepResult) => ({
            name: item.department,
            value: item.cc
          }));
          setOuterData(formatted);
        }
      } catch (error: any) {
        console.error("Error fetching pie data:", error);
        if (error.response?.status === 401) {
          message.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
          router.push('/');
        } else {
          message.error("เกิดข้อผิดพลาดในการดึงข้อมูลแผนก");
        }
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    let chartInstance: echarts.ECharts | null = null;

    if (chartRef.current) {
      chartInstance = echarts.init(chartRef.current);
      
      const option = {
        // โทนสี 30 สี
        color: [
          '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
          '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#ff7f50',
          '#87cefa', '#da70d6', '#32cd32', '#6495ed', '#ff69b4',
          '#ba55d3', '#cd5c5c', '#ffa500', '#40e0d0', '#1e90ff',
          '#00bfff', '#00ced1', '#20b2aa', '#3cb371', '#00ff7f',
          '#ffd700', '#f08080', '#ff8c00', '#ff1493', '#ff00ff'
        ],
        tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b}: {c} ({d}%)'
        },

        series: [
          {
            name: 'แผนก',
            type: 'pie',
            radius: ['45%', '70%'],
            labelLine: {
              length: 15,
              length2: 10
            },
            label: {
              formatter: '{b|{b}:} {c}  {per|{d}%}',
              rich: {
                b: {
                  color: '#4C5058',
                  fontSize: 14,
                  fontWeight: 'bold',
                  lineHeight: 24
                },
                per: {
                  color: '#fff',
                  backgroundColor: '#4C5058',
                  padding: [3, 4],
                  borderRadius: 4
                }
              }
            },
            data: outerData
          }
        ]
      };

      chartInstance.setOption(option);
    }

    const handleResize = () => chartInstance?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      chartInstance?.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [outerData]);

  return (
    <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />
  );
};

export default NestPie;