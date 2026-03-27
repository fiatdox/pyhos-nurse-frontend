'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Select, DatePicker, Tag, Statistic, Spin } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import axios from 'axios';
import * as echarts from 'echarts';
import Navbar from '../../components/Navbar';
import {
  PiUsersThreeBold,
  PiUserPlusBold,
  PiArrowsLeftRightBold,
  PiHeartbeatBold,
  PiSignOutBold,
  PiChartBarBold,
  PiUserBold,
  PiScalesBold,
  PiClockBold,
  PiBedBold,
  PiChartPolarBold,
  PiWarningBold,
} from 'react-icons/pi';

dayjs.locale('th');

const { RangePicker } = DatePicker;

// --- Interfaces ---
interface Ward {
  ward: number;
  ward_name: string;
  his_code: string;
}

interface DailyStat {
  date: string;        // DD/MM
  newAdmit: number;    // รับใหม่
  transferIn: number;  // รับย้าย
  continued: number;   // ดูแลต่อเนื่อง
  discharge: number;   // จำหน่าย
}

interface MonthlySummary {
  totalPatientDays: number;
  avgCensus: number;
  totalNewAdmit: number;
  totalTransferIn: number;
  totalContinued: number;
  totalDischarge: number;
  nurseCount: number;
  standardRatio: number; // มาตรฐาน พยาบาล:ผู้ป่วย
}

interface NurseWorkload {
  name: string;
  position: string;
  morningShifts: number;   // จำนวนเวรเช้า
  afternoonShifts: number; // จำนวนเวรบ่าย
  nightShifts: number;     // จำนวนเวรดึก
  otHours: number;         // ชั่วโมง OT
  totalHours: number;      // ชั่วโมงรวม
  patientLoad: number;     // จำนวนผู้ป่วยที่ดูแลเฉลี่ย
}

// --- Mock Data Generator ---
function generateMockData(wardCode: string, startDate: dayjs.Dayjs, endDate: dayjs.Dayjs): { daily: DailyStat[]; summary: MonthlySummary } {
  const seed = wardCode.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = (min: number, max: number, offset: number) => {
    const val = ((seed * 13 + offset * 7) % (max - min + 1)) + min;
    return Math.max(min, Math.min(max, val));
  };

  const days = endDate.diff(startDate, 'day') + 1;
  const daily: DailyStat[] = [];

  let totalNew = 0, totalTransfer = 0, totalCont = 0, totalDc = 0;

  for (let i = 0; i < days; i++) {
    const d = startDate.add(i, 'day');
    const newAdmit = rng(0, 5, i * 3 + 1);
    const transferIn = rng(0, 3, i * 5 + 2);
    const continued = rng(8, 25, i * 2 + seed);
    const discharge = rng(0, 4, i * 7 + 3);

    daily.push({
      date: d.format('DD/MM'),
      newAdmit,
      transferIn,
      continued,
      discharge,
    });

    totalNew += newAdmit;
    totalTransfer += transferIn;
    totalCont += continued;
    totalDc += discharge;
  }

  const nurseCount = rng(8, 18, seed);
  const avgCensus = days > 0 ? Math.round(totalCont / days) : 0;

  return {
    daily,
    summary: {
      totalPatientDays: totalCont,
      avgCensus,
      totalNewAdmit: totalNew,
      totalTransferIn: totalTransfer,
      totalContinued: totalCont,
      totalDischarge: totalDc,
      nurseCount,
      standardRatio: 5, // มาตรฐาน 1:5
    },
  };
}

// --- Mock Nurse Workload Generator ---
const NURSE_NAMES = [
  'สมศรี จันทร์แก้ว', 'วิภา สุขสม', 'พรทิพย์ แก้วมณี', 'อรุณี ศรีสวัสดิ์',
  'นิตยา บุญมา', 'สุดา พงษ์สวัสดิ์', 'จันทนา วงศ์ดี', 'ปราณี สมบูรณ์',
  'กัลยา ทองดี', 'ศิริพร แสงทอง', 'มาลี ใจดี', 'รัตนา เพชรดี',
  'อนงค์ รุ่งเรือง', 'สายใจ พิทักษ์', 'ดวงใจ ศรีสุข', 'พิมพ์ ชัยวัฒน์',
  'วรรณา สิริโชค', 'นภา แก้วสว่าง',
];

const POSITIONS = ['RN', 'RN', 'RN', 'PN', 'RN', 'PN', 'RN', 'RN', 'PN', 'RN', 'RN', 'PN', 'RN', 'RN', 'PN', 'RN', 'RN', 'PN'];

function generateNurseWorkload(wardCode: string, nurseCount: number): NurseWorkload[] {
  const seed = wardCode.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const result: NurseWorkload[] = [];

  for (let i = 0; i < nurseCount; i++) {
    const s = seed + i * 17;
    const morning = ((s * 3 + 5) % 12) + 4;     // 4-15 เวร
    const afternoon = ((s * 7 + 3) % 10) + 3;    // 3-12 เวร
    const night = ((s * 11 + 1) % 8) + 2;        // 2-9 เวร
    const ot = ((s * 5 + 9) % 24);               // 0-23 ชม. OT

    const totalHours = morning * 8 + afternoon * 8 + night * 8 + ot;

    result.push({
      name: NURSE_NAMES[i % NURSE_NAMES.length],
      position: POSITIONS[i % POSITIONS.length],
      morningShifts: morning,
      afternoonShifts: afternoon,
      nightShifts: night,
      otHours: ot,
      totalHours,
      patientLoad: ((s * 3 + 2) % 6) + 3, // 3-8 คน
    });
  }

  return result.sort((a, b) => b.totalHours - a.totalHours);
}

export default function DashboardPage() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);
  const [loading, setLoading] = useState(false);
  const [dailyData, setDailyData] = useState<DailyStat[]>([]);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [nurseWorkload, setNurseWorkload] = useState<NurseWorkload[]>([]);

  const mainChartRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<HTMLDivElement>(null);
  const nurseChartRef = useRef<HTMLDivElement>(null);
  const gaugeChartRef = useRef<HTMLDivElement>(null);
  const bedChartRef = useRef<HTMLDivElement>(null);
  const radarChartRef = useRef<HTMLDivElement>(null);
  const severityChartRef = useRef<HTMLDivElement>(null);
  const mainChartInstance = useRef<echarts.ECharts | null>(null);
  const pieChartInstance = useRef<echarts.ECharts | null>(null);
  const nurseChartInstance = useRef<echarts.ECharts | null>(null);
  const gaugeChartInstance = useRef<echarts.ECharts | null>(null);
  const bedChartInstance = useRef<echarts.ECharts | null>(null);
  const radarChartInstance = useRef<echarts.ECharts | null>(null);
  const severityChartInstance = useRef<echarts.ECharts | null>(null);

  // --- Fetch Wards ---
  useEffect(() => {
    const fetchWards = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.get('/api/v1/wardsV1', { headers });
        const wardList = Array.isArray(response.data) ? response.data : response.data.data || [];
        setWards(wardList);
        if (wardList.length > 0) {
          setSelectedWard(wardList[0].his_code);
        }
      } catch (error) {
        console.error('Error fetching wards:', error);
      }
    };
    fetchWards();
  }, []);

  // --- Load Data ---
  const loadData = useCallback(() => {
    if (!selectedWard) return;
    setLoading(true);
    // Simulate API call with mock data
    setTimeout(() => {
      const { daily, summary: s } = generateMockData(selectedWard, dateRange[0], dateRange[1]);
      setDailyData(daily);
      setSummary(s);
      setNurseWorkload(generateNurseWorkload(selectedWard, s.nurseCount));
      setLoading(false);
    }, 400);
  }, [selectedWard, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Main Chart (Stacked Bar + Line) ---
  useEffect(() => {
    if (!mainChartRef.current || dailyData.length === 0) return;

    if (!mainChartInstance.current) {
      mainChartInstance.current = echarts.init(mainChartRef.current);
    }
    const chart = mainChartInstance.current;

    const dates = dailyData.map(d => d.date);

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: '#e5e7eb',
        textStyle: { color: '#374151', fontSize: 13 },
      },
      legend: {
        bottom: 0,
        itemGap: 20,
        textStyle: { fontSize: 13 },
      },
      grid: {
        left: '3%',
        right: '4%',
        top: '12%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 11, rotate: dates.length > 20 ? 45 : 0 },
        axisTick: { alignWithLabel: true },
      },
      yAxis: [
        {
          type: 'value',
          name: 'จำนวน (คน)',
          nameTextStyle: { fontSize: 12, color: '#6b7280' },
          splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
        },
      ],
      series: [
        {
          name: 'ดูแลต่อเนื่อง',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 28,
          itemStyle: { color: '#006b5f', borderRadius: [0, 0, 0, 0] },
          emphasis: { focus: 'series' },
          data: dailyData.map(d => d.continued),
        },
        {
          name: 'รับใหม่',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#22d3ee' },
          emphasis: { focus: 'series' },
          data: dailyData.map(d => d.newAdmit),
        },
        {
          name: 'รับย้าย',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: '#a78bfa', borderRadius: [4, 4, 0, 0] },
          emphasis: { focus: 'series' },
          data: dailyData.map(d => d.transferIn),
        },
        {
          name: 'จำหน่าย',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 7,
          lineStyle: { width: 2.5, color: '#f97316' },
          itemStyle: { color: '#f97316', borderWidth: 2, borderColor: '#fff' },
          emphasis: { focus: 'series' },
          data: dailyData.map(d => d.discharge),
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [dailyData]);

  // --- Pie Chart (สัดส่วนประเภทผู้ป่วย) ---
  useEffect(() => {
    if (!pieChartRef.current || !summary) return;

    if (!pieChartInstance.current) {
      pieChartInstance.current = echarts.init(pieChartRef.current);
    }
    const chart = pieChartInstance.current;

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} คน ({d}%)',
      },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 12 },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            fontSize: 12,
          },
          data: [
            { value: summary.totalNewAdmit, name: 'รับใหม่', itemStyle: { color: '#22d3ee' } },
            { value: summary.totalTransferIn, name: 'รับย้าย', itemStyle: { color: '#a78bfa' } },
            { value: summary.totalContinued, name: 'ดูแลต่อเนื่อง', itemStyle: { color: '#006b5f' } },
            { value: summary.totalDischarge, name: 'จำหน่าย', itemStyle: { color: '#f97316' } },
          ],
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [summary]);

  // --- Nurse Workload Chart (Horizontal Bar) ---
  useEffect(() => {
    if (!nurseChartRef.current || nurseWorkload.length === 0) return;

    if (!nurseChartInstance.current) {
      nurseChartInstance.current = echarts.init(nurseChartRef.current);
    }
    const chart = nurseChartInstance.current;

    const names = nurseWorkload.map(n => `${n.name} (${n.position})`);
    const standardHours = 176; // มาตรฐาน ~22 วัน x 8 ชม.

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: '#e5e7eb',
        textStyle: { color: '#374151', fontSize: 13 },
        formatter: (params: unknown) => {
          const p = params as { name: string; marker: string; seriesName: string; value: number }[];
          if (!Array.isArray(p) || p.length === 0) return '';
          let tip = `<b>${p[0].name}</b><br/>`;
          let total = 0;
          p.forEach(item => {
            if (item.seriesName !== 'มาตรฐาน') {
              tip += `${item.marker} ${item.seriesName}: <b>${item.value}</b> ชม.<br/>`;
              total += item.value;
            }
          });
          tip += `<br/><b>รวม: ${total} ชม.</b>`;
          const diff = total - standardHours;
          if (diff > 0) {
            tip += `<br/><span style="color:#ef4444">เกินมาตรฐาน +${diff} ชม.</span>`;
          } else {
            tip += `<br/><span style="color:#22c55e">อยู่ในเกณฑ์</span>`;
          }
          return tip;
        },
      },
      legend: {
        bottom: 0,
        itemGap: 16,
        textStyle: { fontSize: 12 },
      },
      grid: {
        left: '2%',
        right: '6%',
        top: '6%',
        bottom: '14%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: 'ชั่วโมง',
        nameTextStyle: { fontSize: 12, color: '#6b7280' },
        splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
      },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: { fontSize: 12, width: 140, overflow: 'truncate' },
        inverse: true,
      },
      series: [
        {
          name: 'เวรเช้า',
          type: 'bar',
          stack: 'hours',
          barMaxWidth: 22,
          itemStyle: { color: '#22d3ee', borderRadius: [0, 0, 0, 0] },
          data: nurseWorkload.map(n => n.morningShifts * 8),
        },
        {
          name: 'เวรบ่าย',
          type: 'bar',
          stack: 'hours',
          itemStyle: { color: '#a78bfa' },
          data: nurseWorkload.map(n => n.afternoonShifts * 8),
        },
        {
          name: 'เวรดึก',
          type: 'bar',
          stack: 'hours',
          itemStyle: { color: '#1e3a5f' },
          data: nurseWorkload.map(n => n.nightShifts * 8),
        },
        {
          name: 'OT',
          type: 'bar',
          stack: 'hours',
          itemStyle: { color: '#f97316', borderRadius: [0, 4, 4, 0] },
          data: nurseWorkload.map(n => n.otHours),
        },
        {
          name: 'มาตรฐาน',
          type: 'line',
          symbol: 'none',
          lineStyle: { type: 'dashed', color: '#ef4444', width: 2 },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { type: 'dashed', color: '#ef4444', width: 2 },
            label: { formatter: `มาตรฐาน ${standardHours} ชม.`, fontSize: 11, color: '#ef4444' },
            data: [{ xAxis: standardHours }],
          },
          data: [],
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [nurseWorkload]);

  // --- Gauge Chart (สัดส่วนภาระงาน) ---
  useEffect(() => {
    if (!gaugeChartRef.current || !summary) return;

    if (!gaugeChartInstance.current) {
      gaugeChartInstance.current = echarts.init(gaugeChartRef.current);
    }
    const chart = gaugeChartInstance.current;

    // คำนวณค่า gauge: 0 = ไม่มีภาระ, 1 = เกินมาตรฐาน 2 เท่า
    const ratio = summary.avgCensus / summary.nurseCount;
    const maxScale = summary.standardRatio * 2;
    const gaugeValue = Math.min(ratio / maxScale, 1);

    const gradeLabel = (v: number) => {
      if (v >= 0.75) return 'เกินมาตรฐานมาก';
      if (v >= 0.5) return 'เกินมาตรฐาน';
      if (v >= 0.25) return 'อยู่ในเกณฑ์';
      return 'ภาระงานต่ำ';
    };

    const option: echarts.EChartsOption = {
      series: [
        {
          type: 'gauge',
          startAngle: 180,
          endAngle: 0,
          center: ['50%', '75%'],
          radius: '90%',
          min: 0,
          max: 1,
          splitNumber: 8,
          axisLine: {
            lineStyle: {
              width: 6,
              color: [
                [0.25, '#7CFFB2'],
                [0.5, '#58D9F9'],
                [0.75, '#FDDD60'],
                [1, '#FF6E76'],
              ],
            },
          },
          pointer: {
            icon: 'path://M12.8,0.7l12,40.1H0.7L12.8,0.7z',
            length: '12%',
            width: 20,
            offsetCenter: [0, '-60%'],
            itemStyle: { color: 'auto' },
          },
          axisTick: {
            length: 12,
            lineStyle: { color: 'auto', width: 2 },
          },
          splitLine: {
            length: 20,
            lineStyle: { color: 'auto', width: 5 },
          },
          axisLabel: {
            color: '#464646',
            fontSize: 11,
            distance: -35,
            rotate: 'tangential',
            formatter: (value: number) => {
              if (value === 0.875) return 'D';
              if (value === 0.625) return 'C';
              if (value === 0.375) return 'B';
              if (value === 0.125) return 'A';
              return '';
            },
          },
          title: {
            offsetCenter: [0, '-10%'],
            fontSize: 12,
            color: '#6b7280',
          },
          detail: {
            fontSize: 22,
            offsetCenter: [0, '-35%'],
            valueAnimation: true,
            formatter: () => `1 : ${ratio.toFixed(1)}`,
            color: 'inherit',
          },
          data: [
            {
              value: gaugeValue,
              name: gradeLabel(gaugeValue),
            },
          ],
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [summary]);

  // --- Bed Occupancy Ring Chart ---
  useEffect(() => {
    if (!bedChartRef.current || !summary) return;

    if (!bedChartInstance.current) {
      bedChartInstance.current = echarts.init(bedChartRef.current);
    }
    const chart = bedChartInstance.current;

    const seed = (selectedWard || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const totalBeds = ((seed * 3 + 7) % 20) + 20; // 20-39 เตียง
    const occupied = Math.min(summary.avgCensus, totalBeds);
    const rate = Math.round((occupied / totalBeds) * 100);

    const rateColor = rate >= 90 ? '#ef4444' : rate >= 75 ? '#f97316' : '#006b5f';

    const option: echarts.EChartsOption = {
      series: [
        {
          type: 'pie',
          radius: ['60%', '78%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          silent: true,
          itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 3 },
          label: { show: false },
          data: [
            { value: occupied, itemStyle: { color: rateColor } },
            { value: totalBeds - occupied, itemStyle: { color: '#f1f5f9' } },
          ],
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '35%',
          style: { text: `${rate}%`, fontSize: 28, fontWeight: 'bold', fill: rateColor, align: 'center' },
        },
        {
          type: 'text',
          left: 'center',
          top: '52%',
          style: { text: `${occupied} / ${totalBeds} เตียง`, fontSize: 13, fill: '#6b7280', align: 'center' },
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [summary, selectedWard]);

  // --- Radar Chart (Shift Distribution) ---
  useEffect(() => {
    if (!radarChartRef.current || nurseWorkload.length === 0 || !summary) return;

    if (!radarChartInstance.current) {
      radarChartInstance.current = echarts.init(radarChartRef.current);
    }
    const chart = radarChartInstance.current;

    const totalMorning = nurseWorkload.reduce((s, n) => s + n.morningShifts, 0);
    const totalAfternoon = nurseWorkload.reduce((s, n) => s + n.afternoonShifts, 0);
    const totalNight = nurseWorkload.reduce((s, n) => s + n.nightShifts, 0);
    const totalOT = nurseWorkload.reduce((s, n) => s + n.otHours, 0);
    const avgPatient = nurseWorkload.reduce((s, n) => s + n.patientLoad, 0) / nurseWorkload.length;
    const maxVal = Math.max(totalMorning, totalAfternoon, totalNight, totalOT, Math.round(avgPatient * 10)) + 10;

    const option: echarts.EChartsOption = {
      radar: {
        indicator: [
          { name: 'เวรเช้า', max: maxVal },
          { name: 'เวรบ่าย', max: maxVal },
          { name: 'เวรดึก', max: maxVal },
          { name: 'OT (ชม.)', max: maxVal },
          { name: 'ภาระผู้ป่วย\n(x10)', max: maxVal },
        ],
        shape: 'circle',
        splitNumber: 4,
        axisName: { color: '#374151', fontSize: 12 },
        splitArea: { areaStyle: { color: ['#fff', '#f0fdfa', '#fff', '#f0fdfa'] } },
        splitLine: { lineStyle: { color: '#d1d5db' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: [totalMorning, totalAfternoon, totalNight, totalOT, Math.round(avgPatient * 10)],
              name: 'ภาระงานรวม',
              areaStyle: { color: 'rgba(0,107,95,0.2)' },
              lineStyle: { color: '#006b5f', width: 2 },
              itemStyle: { color: '#006b5f' },
              symbol: 'circle',
              symbolSize: 6,
            },
          ],
        },
      ],
      tooltip: {
        trigger: 'item',
      },
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [nurseWorkload, summary]);

  // --- Severity Level Chart ---
  useEffect(() => {
    if (!severityChartRef.current || !summary) return;

    if (!severityChartInstance.current) {
      severityChartInstance.current = echarts.init(severityChartRef.current);
    }
    const chart = severityChartInstance.current;

    const seed = (selectedWard || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rng = (min: number, max: number, offset: number) => ((seed * 13 + offset * 7) % (max - min + 1)) + min;

    const levels = [
      { name: 'ระดับ 1 - Minimal Care', value: rng(5, 15, 1), color: '#22c55e' },
      { name: 'ระดับ 2 - Moderate Care', value: rng(8, 20, 2), color: '#22d3ee' },
      { name: 'ระดับ 3 - High Care', value: rng(4, 12, 3), color: '#f59e0b' },
      { name: 'ระดับ 4 - Intensive Care', value: rng(2, 8, 4), color: '#f97316' },
      { name: 'ระดับ 5 - Critical Care', value: rng(0, 5, 5), color: '#ef4444' },
    ];

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = params as { name: string; marker: string; value: number }[];
          if (!Array.isArray(p) || p.length === 0) return '';
          return `${p[0].marker} ${p[0].name}<br/><b>${p[0].value}</b> คน`;
        },
      },
      grid: {
        left: '3%',
        right: '8%',
        top: '8%',
        bottom: '5%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'category',
        data: levels.map(l => l.name),
        inverse: true,
        axisLabel: { fontSize: 11, width: 160, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 20,
          data: levels.map(l => ({
            value: l.value,
            itemStyle: {
              color: l.color,
              borderRadius: [0, 6, 6, 0],
            },
          })),
          label: {
            show: true,
            position: 'right',
            fontSize: 12,
            fontWeight: 'bold',
            formatter: '{c} คน',
          },
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [summary, selectedWard]);

  // --- Cleanup Charts ---
  useEffect(() => {
    return () => {
      mainChartInstance.current?.dispose();
      pieChartInstance.current?.dispose();
      nurseChartInstance.current?.dispose();
      gaugeChartInstance.current?.dispose();
      bedChartInstance.current?.dispose();
      radarChartInstance.current?.dispose();
      severityChartInstance.current?.dispose();
    };
  }, []);

  const wardName = wards.find(w => w.his_code === selectedWard)?.ward_name || '-';
  const workloadPerNurse = summary ? (summary.avgCensus / summary.nurseCount).toFixed(1) : '-';
  const isOverStandard = summary ? (summary.avgCensus / summary.nurseCount) > summary.standardRatio : false;

  return (
    <div className="bg-slate-50 min-h-screen font-sans pb-10">
      <Navbar />

      <div className="p-6 max-w-full mx-auto">
        {/* Header */}
        <Card className="shadow-xl rounded-2xl border-none mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#006b5f] p-2.5 rounded-xl shadow-md">
                <PiChartBarBold className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#006b5f] m-0">Dashboard ภาระงานพยาบาล</h2>
                <p className="text-sm text-gray-500 m-0">สถิติจำนวนผู้ป่วยและภาระงานตามมาตรฐานการพยาบาล</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">หอผู้ป่วย</label>
                <Select
                  size="middle"
                  value={selectedWard}
                  onChange={setSelectedWard}
                  className="w-52"
                  placeholder="เลือกหอผู้ป่วย"
                  options={wards.map(w => ({ label: w.ward_name, value: w.his_code }))}
                  showSearch
                  optionFilterProp="label"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">ช่วงเวลา</label>
                <RangePicker
                  size="middle"
                  picker="date"
                  value={dateRange}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setDateRange([dates[0], dates[1]]);
                    }
                  }}
                  format="DD/MM/YYYY"
                  allowClear={false}
                  presets={[
                    { label: 'เดือนนี้', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                    { label: 'เดือนที่แล้ว', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                    { label: '3 เดือนล่าสุด', value: [dayjs().subtract(2, 'month').startOf('month'), dayjs().endOf('month')] },
                  ]}
                />
              </div>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Spin size="large" />
          </div>
        ) : summary && (
          <div className="flex flex-col gap-8 mt-8">
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
              <StatCard
                icon={<PiUsersThreeBold />}
                label="ค่าเฉลี่ย Census/วัน"
                value={summary.avgCensus}
                suffix="คน"
                color="#006b5f"
              />
              <StatCard
                icon={<PiUserPlusBold />}
                label="รับใหม่ (ทั้งหมด)"
                value={summary.totalNewAdmit}
                suffix="คน"
                color="#22d3ee"
              />
              <StatCard
                icon={<PiArrowsLeftRightBold />}
                label="รับย้าย (ทั้งหมด)"
                value={summary.totalTransferIn}
                suffix="คน"
                color="#a78bfa"
              />
              <StatCard
                icon={<PiSignOutBold />}
                label="จำหน่าย (ทั้งหมด)"
                value={summary.totalDischarge}
                suffix="คน"
                color="#f97316"
              />
              <StatCard
                icon={<PiUserBold />}
                label="จำนวนพยาบาล"
                value={summary.nurseCount}
                suffix="คน"
                color="#006b5f"
              />
              <StatCard
                icon={<PiScalesBold />}
                label="ภาระงาน/คน"
                value={workloadPerNurse}
                suffix={`(มฐ. 1:${summary.standardRatio})`}
                color={isOverStandard ? '#ef4444' : '#006b5f'}
                highlight={isOverStandard}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Gauge Chart */}
              <Card
                className="shadow-md rounded-2xl border-none"
                styles={{ body: { padding: '8px 12px 12px' } }}
                title={
                  <span className="text-[#006b5f] font-bold flex items-center gap-2 text-sm">
                    <PiScalesBold /> สัดส่วนภาระงาน : มาตรฐาน
                  </span>
                }
              >
                <div ref={gaugeChartRef} style={{ width: '100%', height: 220 }} />
                <div className="text-center -mt-2">
                  <Tag
                    color={isOverStandard ? 'red' : 'green'}
                    className="text-xs font-bold px-3 py-0.5 rounded-full"
                  >
                    {isOverStandard ? 'เกินมาตรฐาน' : 'อยู่ในเกณฑ์'}
                  </Tag>
                  <div className="text-[11px] text-gray-400 mt-1">
                    มาตรฐาน 1:{summary.standardRatio} | {wardName}
                  </div>
                </div>
              </Card>

              {/* Bed Occupancy Chart */}
              <Card
                className="shadow-md rounded-2xl border-none"
                styles={{ body: { padding: '8px 12px 12px' } }}
                title={
                  <span className="text-[#006b5f] font-bold flex items-center gap-2 text-sm">
                    <PiBedBold /> อัตราครองเตียง
                  </span>
                }
              >
                <div ref={bedChartRef} style={{ width: '100%', height: 220 }} />
              </Card>

              {/* Radar Chart */}
              <Card
                className="shadow-md rounded-2xl border-none"
                styles={{ body: { padding: '8px 12px 12px' } }}
                title={
                  <span className="text-[#006b5f] font-bold flex items-center gap-2 text-sm">
                    <PiChartPolarBold /> การกระจายภาระงาน
                  </span>
                }
              >
                <div ref={radarChartRef} style={{ width: '100%', height: 220 }} />
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Main Chart */}
              <Card
                className="shadow-md rounded-2xl border-none"
                title={
                  <span className="text-[#006b5f] font-bold flex items-center gap-2">
                    <PiChartBarBold /> สถิติรายวัน — รับใหม่ / รับย้าย / ดูแลต่อเนื่อง / จำหน่าย
                  </span>
                }
              >
                <div ref={mainChartRef} style={{ width: '100%', height: 380 }} />
              </Card>

              {/* Severity Chart */}
              <Card
                className="shadow-md rounded-2xl border-none"
                title={
                  <span className="text-[#006b5f] font-bold flex items-center gap-2">
                    <PiWarningBold /> สถิติระดับความรุนแรงผู้ป่วย
                  </span>
                }
              >
                <div ref={severityChartRef} style={{ width: '100%', height: 380 }} />
              </Card>
            </div>

            {/* Charts Row 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Nurse Workload Chart */}
              <Card
                className="shadow-md rounded-2xl border-none lg:col-span-2"
                title={
                  <span className="text-[#006b5f] font-bold flex items-center gap-2">
                    <PiClockBold /> สรุปชั่วโมงการทำงานรายบุคคล — {wardName}
                  </span>
                }
              >
                <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-500">
                  <span>มาตรฐาน: <b className="text-gray-700">176 ชม./เดือน</b> (22 วัน x 8 ชม.)</span>
                  <span>|</span>
                  <span>เวรเช้า <b>08:00-16:00</b></span>
                  <span>เวรบ่าย <b>16:00-24:00</b></span>
                  <span>เวรดึก <b>00:00-08:00</b></span>
                </div>
                <div
                  ref={nurseChartRef}
                  style={{ width: '100%', height: Math.max(300, nurseWorkload.length * 45 + 80) }}
                />

                {/* Summary Table Below Chart */}
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-gray-600">
                        <th className="p-2.5 text-left rounded-tl-lg">ชื่อ-สกุล</th>
                        <th className="p-2.5 text-center">ตำแหน่ง</th>
                        <th className="p-2.5 text-center">เวรเช้า</th>
                        <th className="p-2.5 text-center">เวรบ่าย</th>
                        <th className="p-2.5 text-center">เวรดึก</th>
                        <th className="p-2.5 text-center">OT (ชม.)</th>
                        <th className="p-2.5 text-center">รวม (ชม.)</th>
                        <th className="p-2.5 text-center">ผู้ป่วยเฉลี่ย</th>
                        <th className="p-2.5 text-center rounded-tr-lg">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nurseWorkload.map((n, idx) => {
                        const over = n.totalHours > 176;
                        return (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-teal-50/40">
                            <td className="p-2.5 font-semibold text-gray-700">{n.name}</td>
                            <td className="p-2.5 text-center">
                              <Tag color={n.position === 'RN' ? 'blue' : 'green'} className="m-0">{n.position}</Tag>
                            </td>
                            <td className="p-2.5 text-center">{n.morningShifts}</td>
                            <td className="p-2.5 text-center">{n.afternoonShifts}</td>
                            <td className="p-2.5 text-center">{n.nightShifts}</td>
                            <td className="p-2.5 text-center">
                              {n.otHours > 0 ? <span className="text-orange-500 font-semibold">{n.otHours}</span> : <span className="text-gray-300">-</span>}
                            </td>
                            <td className={`p-2.5 text-center font-bold ${over ? 'text-red-500' : 'text-[#006b5f]'}`}>{n.totalHours}</td>
                            <td className="p-2.5 text-center">{n.patientLoad} คน</td>
                            <td className="p-2.5 text-center">
                              <Tag color={over ? 'red' : 'green'} className="m-0 font-semibold">
                                {over ? 'เกินเกณฑ์' : 'ปกติ'}
                              </Tag>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Pie Chart */}
              <Card
                className="shadow-md rounded-2xl border-none"
                styles={{ body: { padding: '8px 12px 12px' } }}
                title={
                  <span className="text-[#006b5f] font-bold flex items-center gap-2 text-sm">
                    <PiHeartbeatBold /> สัดส่วนประเภทผู้ป่วย
                  </span>
                }
              >
                <div ref={pieChartRef} style={{ width: '100%', height: 350 }} />
              </Card>
            </div>

            {/* Summary Table */}
            <Card className="shadow-md rounded-2xl border-none">
              <h3 className="text-base font-bold text-[#006b5f] mb-4 flex items-center gap-2">
                <PiHeartbeatBold /> สรุปภาระงานเทียบมาตรฐาน
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#006b5f] text-white">
                      <th className="p-3 text-left rounded-tl-lg">รายการ</th>
                      <th className="p-3 text-center">จำนวน</th>
                      <th className="p-3 text-center">ค่าเฉลี่ย/วัน</th>
                      <th className="p-3 text-center rounded-tr-lg">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100 hover:bg-teal-50/50">
                      <td className="p-3 font-semibold text-gray-700">รับใหม่</td>
                      <td className="p-3 text-center">{summary.totalNewAdmit}</td>
                      <td className="p-3 text-center">{(summary.totalNewAdmit / dailyData.length).toFixed(1)}</td>
                      <td className="p-3 text-center"><Tag color="cyan">New Admission</Tag></td>
                    </tr>
                    <tr className="border-b border-gray-100 hover:bg-teal-50/50">
                      <td className="p-3 font-semibold text-gray-700">รับย้าย</td>
                      <td className="p-3 text-center">{summary.totalTransferIn}</td>
                      <td className="p-3 text-center">{(summary.totalTransferIn / dailyData.length).toFixed(1)}</td>
                      <td className="p-3 text-center"><Tag color="purple">Transfer In</Tag></td>
                    </tr>
                    <tr className="border-b border-gray-100 hover:bg-teal-50/50">
                      <td className="p-3 font-semibold text-gray-700">ดูแลต่อเนื่อง (Patient Day)</td>
                      <td className="p-3 text-center font-bold text-[#006b5f]">{summary.totalContinued}</td>
                      <td className="p-3 text-center font-bold text-[#006b5f]">{summary.avgCensus}</td>
                      <td className="p-3 text-center"><Tag color="green">Continued Care</Tag></td>
                    </tr>
                    <tr className="border-b border-gray-100 hover:bg-teal-50/50">
                      <td className="p-3 font-semibold text-gray-700">จำหน่าย</td>
                      <td className="p-3 text-center">{summary.totalDischarge}</td>
                      <td className="p-3 text-center">{(summary.totalDischarge / dailyData.length).toFixed(1)}</td>
                      <td className="p-3 text-center"><Tag color="orange">Discharge</Tag></td>
                    </tr>
                    <tr className="border-b border-gray-100 hover:bg-teal-50/50">
                      <td className="p-3 font-semibold text-gray-700">จำนวนพยาบาล</td>
                      <td className="p-3 text-center" colSpan={2}>{summary.nurseCount} คน</td>
                      <td className="p-3 text-center"><Tag color="blue">Nurse Staff</Tag></td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="p-3 font-bold text-gray-800 rounded-bl-lg">ภาระงาน / พยาบาล 1 คน</td>
                      <td className="p-3 text-center font-bold text-lg" colSpan={2}>
                        <span className={isOverStandard ? 'text-red-500' : 'text-[#006b5f]'}>
                          1 : {workloadPerNurse}
                        </span>
                        <span className="text-gray-400 text-sm ml-2">(มาตรฐาน 1:{summary.standardRatio})</span>
                      </td>
                      <td className="p-3 text-center rounded-br-lg">
                        <Tag
                          color={isOverStandard ? 'red' : 'green'}
                          className="font-bold"
                        >
                          {isOverStandard ? 'เกินมาตรฐาน' : 'ผ่านเกณฑ์'}
                        </Tag>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Stat Card Component ---
function StatCard({
  icon,
  label,
  value,
  suffix,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix?: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`shadow-md rounded-2xl border-none transition-all hover:shadow-lg hover:-translate-y-0.5 ${highlight ? 'ring-2 ring-red-400 ring-offset-2' : ''}`}
      styles={{ body: { padding: '16px' } }}
    >
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-lg text-white text-xl shrink-0"
          style={{ backgroundColor: color }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-gray-500 truncate">{label}</div>
          <Statistic
            value={value}
            suffix={<span className="text-xs text-gray-400">{suffix}</span>}
            styles={{ content: { fontSize: 22, fontWeight: 700, color, lineHeight: 1.2 } }}
          />
        </div>
      </div>
    </Card>
  );
}
