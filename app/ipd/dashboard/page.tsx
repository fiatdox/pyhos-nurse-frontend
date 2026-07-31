'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Select, DatePicker, Tag, Spin } from 'antd';
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
  date: string;        // YYYY-MM-DD จาก API
  newAdmit: number;    // รับใหม่
  transferIn: number;  // รับย้าย
  continued: number;   // ดูแลต่อเนื่อง (ยกมาจากวันก่อน)
  discharge: number;   // จำหน่าย
  census: number;      // ยอดผู้ป่วยคงพยาบาลในวันนั้น
}

interface MonthlySummary {
  totalPatientDays: number;
  avgCensus: number;
  totalNewAdmit: number;
  totalTransferIn: number;
  totalContinued: number;
  totalDischarge: number;
  nurseCount: number;
  standardRatio: number;        // มาตรฐาน พยาบาล:ผู้ป่วย (คำนวณจาก NHPPD ของหอผู้ป่วย)
  nursingHourStandard: number;  // ชม.การพยาบาล/ผู้ป่วย/วัน (ward.general)
  crisisHourStandard: number;   // ชม.การพยาบาลผู้ป่วยวิกฤติ (ward.crisis)
  totalBeds: number | null;
  days: number;
}

interface NurseWorkload {
  staffId: number;
  name: string;
  position: string;
  morningShifts: number;   // จำนวนเวรเช้า
  afternoonShifts: number; // จำนวนเวรบ่าย
  nightShifts: number;     // จำนวนเวรดึก
  otHours: number;         // ชั่วโมง OT
  totalHours: number;      // ชั่วโมงรวม
  patientLoad: number;     // จำนวนผู้ป่วยที่ดูแลเฉลี่ย
}

interface SeverityLevelRef {
  severityLevelId: number;
  severityLevelName: string;
  acuityLevelName: string;
}

interface ShiftSeverity {
  shiftTypeId: number;
  shiftName: string;
  totalPatients: number;
  levels: { severityLevelId: number; patientCount: number; recordCount: number }[];
}

interface ShiftSeverityDay {
  date: string;              // YYYY-MM-DD
  shifts: ShiftSeverity[];   // ดึก / เช้า / บ่าย
}

interface ShiftSeverityData {
  severityLevels: SeverityLevelRef[];
  shiftTypes: { shiftTypeId: number; shiftName: string }[];
  days: ShiftSeverityDay[];
}

interface CareLevelFlowNode {
  name: string;
  shiftTypeId: number;
  shiftName: string;
  careLevelId: number;
  careLevelName: string;
}

interface CareLevelFlow {
  nodes: CareLevelFlowNode[];
  links: { source: string; target: string; value: number; changed: boolean }[];
  totalTransitions: number;
  changedTransitions: number;
}

interface BedOccupancy {
  totalBeds: number | null;
  occupied: number;
  peakOccupied: number;
  occupancyRate: number | null;
  peakOccupancyRate: number | null;
}

const SEVERITY_COLORS = ['#22c55e', '#22d3ee', '#f59e0b', '#f97316', '#ef4444'];

// สีตามระดับการดูแล เรียงจากเบาไปหนัก (ปกติ / O2 / HFNC / Vent-CS)
const CARE_LEVEL_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#22d3ee',
  3: '#f59e0b',
  4: '#ef4444',
};

/**
 * ผูก ECharts instance เข้ากับ DOM node ปัจจุบันเสมอ
 * container จะถูก unmount/remount ทุกครั้งที่สลับ loading ทำให้ node เดิมหลุดไป
 * ถ้า reuse instance เก่าจะวาดลง node ที่ไม่อยู่ในหน้าแล้ว กราฟจึงว่างเปล่า
 */
function ensureChart(
  el: HTMLDivElement,
  ref: { current: echarts.ECharts | null }
): echarts.ECharts {
  const bound = echarts.getInstanceByDom(el);
  if (bound) {
    ref.current = bound;
    return bound;
  }
  ref.current?.dispose();
  const chart = echarts.init(el);
  ref.current = chart;
  return chart;
}

// สถานะว่างของกราฟ ใช้แทนการปล่อยพื้นที่โล่งเมื่อหอผู้ป่วยนั้นไม่มีข้อมูลในช่วงที่เลือก
const emptyOption = (text = 'ไม่มีข้อมูลในช่วงเวลาที่เลือก'): echarts.EChartsOption => ({
  graphic: [
    {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: { text, fontSize: 13, fill: '#9ca3af', align: 'center' },
    },
  ],
});

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
  const [shiftSeverity, setShiftSeverity] = useState<ShiftSeverityData | null>(null);
  const [bedOccupancy, setBedOccupancy] = useState<BedOccupancy | null>(null);
  const [careLevelFlow, setCareLevelFlow] = useState<CareLevelFlow | null>(null);

  const mainChartRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<HTMLDivElement>(null);
  const nurseChartRef = useRef<HTMLDivElement>(null);
  const gaugeChartRef = useRef<HTMLDivElement>(null);
  const bedChartRef = useRef<HTMLDivElement>(null);
  const radarChartRef = useRef<HTMLDivElement>(null);
  const severityChartRef = useRef<HTMLDivElement>(null);
  const sankeyChartRef = useRef<HTMLDivElement>(null);
  const mainChartInstance = useRef<echarts.ECharts | null>(null);
  const pieChartInstance = useRef<echarts.ECharts | null>(null);
  const nurseChartInstance = useRef<echarts.ECharts | null>(null);
  const gaugeChartInstance = useRef<echarts.ECharts | null>(null);
  const bedChartInstance = useRef<echarts.ECharts | null>(null);
  const radarChartInstance = useRef<echarts.ECharts | null>(null);
  const severityChartInstance = useRef<echarts.ECharts | null>(null);
  const sankeyChartInstance = useRef<echarts.ECharts | null>(null);

  // --- Fetch Wards ---
  useEffect(() => {
    const fetchWards = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.get('/api/v1/system/wardsV1', { headers });
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
  const loadData = useCallback(async () => {
    if (!selectedWard) return;
    setLoading(true);

    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const payload = {
      ward: selectedWard,
      date_from: dateRange[0].format('YYYY-MM-DD'),
      date_to: dateRange[1].format('YYYY-MM-DD'),
    };

    try {
      const [stats, workload, severityRes, bed, flow] = await Promise.all([
        axios.post('/api/v1/dashboard/ipd-daily-stats', payload, { headers }),
        axios.post('/api/v1/dashboard/nurse-workload', payload, { headers }),
        axios.post('/api/v1/dashboard/shift-severity-distribution', payload, { headers }),
        axios.post('/api/v1/dashboard/bed-occupancy', payload, { headers }),
        axios.post('/api/v1/dashboard/care-level-flow', payload, { headers }),
      ]);

      setDailyData(stats.data?.data?.daily ?? []);
      setSummary(stats.data?.data?.summary ?? null);
      setNurseWorkload(
        [...(workload.data?.data ?? [])].sort((a: NurseWorkload, b: NurseWorkload) => b.totalHours - a.totalHours)
      );
      setShiftSeverity(severityRes.data?.data ?? null);
      setBedOccupancy(bed.data?.data ?? null);
      setCareLevelFlow(flow.data?.data ?? null);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setDailyData([]);
      setSummary(null);
      setNurseWorkload([]);
      setShiftSeverity(null);
      setBedOccupancy(null);
      setCareLevelFlow(null);
    } finally {
      setLoading(false);
    }
  }, [selectedWard, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Main Chart (Stacked Bar + Line) ---
  useEffect(() => {
    if (!mainChartRef.current) return;
    const chart = ensureChart(mainChartRef.current, mainChartInstance);

    if (dailyData.length === 0) {
      chart.setOption(emptyOption(), true);
      return;
    }

    const dates = dailyData.map(d => dayjs(d.date).format('DD/MM'));

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
    if (!pieChartRef.current) return;
    const chart = ensureChart(pieChartRef.current, pieChartInstance);

    if (!summary) {
      chart.setOption(emptyOption(), true);
      return;
    }

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
    if (!nurseChartRef.current) return;
    const chart = ensureChart(nurseChartRef.current, nurseChartInstance);

    if (nurseWorkload.length === 0) {
      chart.setOption(emptyOption('ยังไม่มีการจัดเวรในช่วงเวลาที่เลือก'), true);
      return;
    }

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
    if (!gaugeChartRef.current) return;
    const chart = ensureChart(gaugeChartRef.current, gaugeChartInstance);

    if (!summary) {
      chart.setOption(emptyOption(), true);
      return;
    }

    // คำนวณค่า gauge: 0 = ไม่มีภาระ, 1 = เกินมาตรฐาน 2 เท่า
    const ratio = summary.nurseCount > 0 ? summary.avgCensus / summary.nurseCount : 0;
    const maxScale = summary.standardRatio > 0 ? summary.standardRatio * 2 : 1;
    const gaugeValue = Math.min(ratio / maxScale, 1);

    const gradeLabel = (v: number) => {
      if (summary.nurseCount === 0) return 'ยังไม่มีการจัดเวร';
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
            formatter: () => (summary.nurseCount > 0 ? `1 : ${ratio.toFixed(1)}` : '-'),
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
    if (!bedChartRef.current) return;
    const chart = ensureChart(bedChartRef.current, bedChartInstance);

    if (!bedOccupancy) {
      chart.setOption(emptyOption(), true);
      return;
    }

    const { totalBeds, occupied, occupancyRate } = bedOccupancy;
    // หอผู้ป่วยที่ยังไม่ได้บันทึกจำนวนเตียงจะไม่มีอัตราครองเตียง แสดงเฉพาะยอดผู้ป่วยเฉลี่ย
    const hasBeds = totalBeds != null && totalBeds > 0;
    const rate = occupancyRate ?? 0;
    const remaining = hasBeds ? Math.max(0, totalBeds - occupied) : 1;

    const rateColor = !hasBeds ? '#94a3b8' : rate >= 90 ? '#ef4444' : rate >= 75 ? '#f97316' : '#006b5f';

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
            { value: remaining, itemStyle: { color: '#f1f5f9' } },
          ],
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '35%',
          style: {
            text: hasBeds ? `${rate}%` : `${occupied}`,
            fontSize: 28,
            fontWeight: 'bold',
            fill: rateColor,
            align: 'center',
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '52%',
          style: {
            text: hasBeds ? `${occupied} / ${totalBeds} เตียง` : 'ยังไม่ระบุจำนวนเตียง',
            fontSize: 13,
            fill: '#6b7280',
            align: 'center',
          },
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [bedOccupancy]);

  // --- Radar Chart (Shift Distribution) ---
  useEffect(() => {
    if (!radarChartRef.current) return;
    const chart = ensureChart(radarChartRef.current, radarChartInstance);

    if (nurseWorkload.length === 0 || !summary) {
      chart.setOption(emptyOption('ยังไม่มีการจัดเวรในช่วงเวลาที่เลือก'), true);
      return;
    }

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
    if (!severityChartRef.current) return;
    const chart = ensureChart(severityChartRef.current, severityChartInstance);

    const days = shiftSeverity?.days ?? [];
    const levelRefs = shiftSeverity?.severityLevels ?? [];
    const shiftTypes = shiftSeverity?.shiftTypes ?? [];

    const hasData = days.some(d => d.shifts.some(s => s.totalPatients > 0));
    if (days.length === 0 || levelRefs.length === 0 || !hasData) {
      chart.setOption(emptyOption('ยังไม่มีการประเมินระดับความรุนแรงในช่วงเวลาที่เลือก'), true);
      return;
    }

    const dates = days.map(d => dayjs(d.date).format('DD/MM'));
    const compact = days.length > 7;

    /**
     * แต่ละวันมี 3 แท่ง (ดึก/เช้า/บ่าย) แยกกันด้วย stack คนละชื่อ
     * ในแท่งเดียวกันซ้อนด้วยระดับความรุนแรง 1-5
     * ตั้งชื่อ series ตามระดับซ้ำกันทั้ง 3 เวร เพื่อให้ legend มีแค่ 5 รายการและ toggle พร้อมกัน
     */
    const series: echarts.BarSeriesOption[] = [];
    const seriesShift: string[] = []; // seriesIndex -> ชื่อเวร ใช้จัดกลุ่มใน tooltip

    shiftTypes.forEach(st => {
      levelRefs.forEach((lv, li) => {
        series.push({
          name: `ระดับ ${lv.severityLevelId} - ${lv.acuityLevelName}`,
          type: 'bar',
          stack: st.shiftName,
          barMaxWidth: 34,
          barGap: '15%',
          barCategoryGap: '35%',
          itemStyle: {
            color: SEVERITY_COLORS[li % SEVERITY_COLORS.length],
            borderRadius: li === levelRefs.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0],
          },
          emphasis: { focus: 'series' },
          label: {
            show: !compact,
            fontSize: 10,
            fontWeight: 'bold',
            color: '#fff',
            // ซ่อนตัวเลขของระดับที่ไม่มีผู้ป่วย ไม่ให้เลข 0 เกลื่อนแท่ง
            formatter: p => (Number(p.value) > 0 ? String(p.value) : ''),
          },
          data: days.map(d =>
            d.shifts.find(s => s.shiftTypeId === st.shiftTypeId)
              ?.levels.find(l => l.severityLevelId === lv.severityLevelId)?.patientCount ?? 0
          ),
        });
        seriesShift.push(st.shiftName);
      });
    });

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: '#e5e7eb',
        textStyle: { color: '#374151', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as { name: string; marker: string; seriesName: string; seriesIndex: number; value: number }[];
          if (!Array.isArray(p) || p.length === 0) return '';

          // จัดกลุ่มตามเวร เพราะ tooltip แบบ axis จะรวม series ของทั้ง 3 เวรมาไว้ด้วยกัน
          let tip = `<b>${p[0].name}</b>`;
          shiftTypes.forEach(st => {
            const items = p.filter(item => seriesShift[item.seriesIndex] === st.shiftName && item.value > 0);
            const total = items.reduce((a, item) => a + item.value, 0);
            if (total === 0) return;
            tip += `<br/><span style="color:#006b5f;font-weight:bold">เวร${st.shiftName} — รวม ${total} คน</span><br/>`;
            items.forEach(item => {
              tip += `${item.marker} ${item.seriesName}: <b>${item.value}</b><br/>`;
            });
          });
          return tip;
        },
      },
      legend: {
        bottom: 0,
        itemGap: 10,
        textStyle: { fontSize: 11 },
        type: 'scroll',
        data: levelRefs.map(lv => `ระดับ ${lv.severityLevelId} - ${lv.acuityLevelName}`),
      },
      grid: { left: '3%', right: '4%', top: '8%', bottom: compact ? '26%' : '22%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 11, rotate: dates.length > 12 ? 45 : 0 },
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: 'value',
        name: 'จำนวน (คน)',
        nameTextStyle: { fontSize: 12, color: '#6b7280' },
        minInterval: 1,
        splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
      },
      // แสดงทั้งช่วงที่เลือกเสมอ ให้ slider ไว้ซูมเข้าดูเฉพาะช่วงเมื่อผู้ใช้ต้องการ
      dataZoom: days.length > 10
        ? [
            { type: 'slider', height: 16, bottom: '13%', start: 0, end: 100 },
            { type: 'inside', start: 0, end: 100 },
          ]
        : undefined,
      series,
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [shiftSeverity]);

  // --- Sankey: การเปลี่ยนระดับการดูแลข้ามเวร ---
  useEffect(() => {
    if (!sankeyChartRef.current) return;
    const chart = ensureChart(sankeyChartRef.current, sankeyChartInstance);

    const nodes = careLevelFlow?.nodes ?? [];
    const links = careLevelFlow?.links ?? [];

    if (nodes.length === 0 || links.length === 0) {
      chart.setOption(
        emptyOption('ต้องมีการบันทึกระดับการดูแลอย่างน้อย 2 เวรติดกันในวันเดียวกัน\nจึงจะแสดงการเปลี่ยนระดับได้'),
        true
      );
      return;
    }

    const colorOf = (careLevelId: number) => CARE_LEVEL_COLORS[careLevelId] ?? '#94a3b8';
    const nodeById = new Map(nodes.map(n => [n.name, n]));

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: '#e5e7eb',
        textStyle: { color: '#374151', fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as { dataType: string; name: string; value: number; data: { source?: string; target?: string; changed?: boolean } };
          if (p.dataType === 'edge') {
            const from = nodeById.get(p.data.source ?? '');
            const to = nodeById.get(p.data.target ?? '');
            const tag = p.data.changed
              ? '<span style="color:#f97316;font-weight:bold">เปลี่ยนระดับการดูแล</span>'
              : '<span style="color:#22c55e">คงระดับเดิม</span>';
            return `เวร${from?.shiftName} <b>${from?.careLevelName}</b> → เวร${to?.shiftName} <b>${to?.careLevelName}</b><br/><b>${p.value}</b> ราย<br/>${tag}`;
          }
          const n = nodeById.get(p.name);
          return `เวร${n?.shiftName} · <b>${n?.careLevelName}</b><br/><b>${p.value}</b> ราย`;
        },
      },
      series: [
        {
          type: 'sankey',
          left: '3%',
          right: '12%',
          top: '6%',
          bottom: '6%',
          nodeWidth: 16,
          nodeGap: 12,
          // ล็อกลำดับคอลัมน์ตามเวร ไม่ให้ ECharts จัดใหม่จนอ่านลำดับเวลาไม่ออก
          nodeAlign: 'left',
          draggable: false,
          emphasis: { focus: 'adjacency' },
          data: nodes.map(n => ({
            name: n.name,
            itemStyle: { color: colorOf(n.careLevelId), borderColor: colorOf(n.careLevelId) },
            label: {
              fontSize: 11,
              formatter: () => `${n.shiftName} · ${n.careLevelName}`,
            },
          })),
          links: links.map(l => ({
            source: l.source,
            target: l.target,
            value: l.value,
            changed: l.changed,
            lineStyle: {
              // เส้นที่เปลี่ยนระดับเน้นให้ชัดกว่าเส้นที่คงระดับเดิม
              color: l.changed ? 'source' : 'gradient',
              opacity: l.changed ? 0.55 : 0.25,
              curveness: 0.5,
            },
          })),
          label: { color: '#374151' },
        },
      ],
    };

    chart.setOption(option, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [careLevelFlow]);

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
      sankeyChartInstance.current?.dispose();
    };
  }, []);

  const wardName = wards.find(w => w.his_code === selectedWard)?.ward_name || '-';
  const ratio = summary && summary.nurseCount > 0 ? summary.avgCensus / summary.nurseCount : null;
  const workloadPerNurse = ratio != null ? ratio.toFixed(1) : '-';
  const isOverStandard = ratio != null && summary != null ? ratio > summary.standardRatio : false;

  return (
    <div className="bg-slate-100 min-h-screen font-sans">
      <Navbar />

      {/* ── Hero Header ── */}
      <div className="bg-linear-to-r from-[#004d45] via-[#006b5f] to-[#00897b] px-4 sm:px-6 py-5 shadow-lg">
        <div className="max-w-full mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm">
              <PiChartBarBold className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white m-0 leading-tight">Dashboard ภาระงานพยาบาล</h2>
              <p className="text-teal-200 text-xs m-0 hidden sm:block">สถิติจำนวนผู้ป่วยและภาระงานตามมาตรฐานการพยาบาล</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none">
              <label className="block text-xs font-semibold text-teal-200 mb-1">หอผู้ป่วย</label>
              <Select
                size="middle"
                value={selectedWard}
                onChange={setSelectedWard}
                className="w-full sm:w-48"
                placeholder="เลือกหอผู้ป่วย"
                options={wards.map(w => ({ label: w.ward_name, value: w.his_code }))}
                showSearch
                optionFilterProp="label"
              />
            </div>
            <div className="flex-1 sm:flex-none">
              <label className="block text-xs font-semibold text-teal-200 mb-1">ช่วงเวลา</label>
              <RangePicker
                size="middle"
                picker="date"
                value={dateRange}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) setDateRange([dates[0], dates[1]]);
                }}
                format="DD/MM/YY"
                allowClear={false}
                className="w-full sm:w-auto"
                presets={[
                  { label: 'เดือนนี้', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                  { label: 'เดือนที่แล้ว', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                  { label: '3 เดือนล่าสุด', value: [dayjs().subtract(2, 'month').startOf('month'), dayjs().endOf('month')] },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-6 py-5 max-w-full mx-auto">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Spin size="large" />
          </div>
        ) : !summary ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <PiWarningBold className="text-4xl text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium mb-1">ไม่สามารถโหลดข้อมูลของหอผู้ป่วยนี้ได้</p>
            <p className="text-gray-400 text-xs">ลองเลือกหอผู้ป่วยหรือช่วงเวลาอื่น</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon={<PiUsersThreeBold />} label="Census เฉลี่ย/วัน" value={summary.avgCensus} suffix="คน" color="#006b5f" />
              <StatCard icon={<PiUserPlusBold />} label="รับใหม่รวม" value={summary.totalNewAdmit} suffix="คน" color="#0891b2" />
              <StatCard icon={<PiArrowsLeftRightBold />} label="รับย้ายรวม" value={summary.totalTransferIn} suffix="คน" color="#7c3aed" />
              <StatCard icon={<PiSignOutBold />} label="จำหน่ายรวม" value={summary.totalDischarge} suffix="คน" color="#ea580c" />
              <StatCard icon={<PiUserBold />} label="จำนวนพยาบาล" value={summary.nurseCount} suffix="คน" color="#0f766e" />
              <StatCard
                icon={<PiScalesBold />}
                label="ภาระงาน/คน"
                value={`1:${workloadPerNurse}`}
                suffix={`มฐ. 1:${summary.standardRatio}`}
                color={isOverStandard ? '#dc2626' : '#006b5f'}
                highlight={isOverStandard}
              />
            </div>

            {/* ── Mini Charts Row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ChartCard icon={<PiScalesBold />} title="สัดส่วนภาระงาน : มาตรฐาน">
                <div ref={gaugeChartRef} style={{ width: '100%', height: 200 }} />
                <div className="text-center -mt-1 pb-1">
                  <Tag color={isOverStandard ? 'red' : 'green'} className="font-bold rounded-full">
                    {isOverStandard ? 'เกินมาตรฐาน' : 'อยู่ในเกณฑ์'}
                  </Tag>
                  <p className="text-[11px] text-gray-400 mt-1 mb-0">มาตรฐาน 1:{summary.standardRatio} · {wardName}</p>
                </div>
              </ChartCard>

              <ChartCard icon={<PiBedBold />} title="อัตราครองเตียง">
                <div ref={bedChartRef} style={{ width: '100%', height: 220 }} />
              </ChartCard>

              <ChartCard icon={<PiChartPolarBold />} title="การกระจายภาระงาน">
                <div ref={radarChartRef} style={{ width: '100%', height: 220 }} />
              </ChartCard>
            </div>

            {/* ── Main + Severity Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard icon={<PiChartBarBold />} title="สถิติรายวัน — รับใหม่ / รับย้าย / ดูแลต่อเนื่อง / จำหน่าย">
                <div ref={mainChartRef} style={{ width: '100%', height: 340 }} />
              </ChartCard>
              <ChartCard icon={<PiWarningBold />} title="ระดับความรุนแรงผู้ป่วยรายวัน แยกตามเวร (ดึก / เช้า / บ่าย)">
                <div ref={severityChartRef} style={{ width: '100%', height: 340 }} />
              </ChartCard>
            </div>

            {/* ── Sankey: การเปลี่ยนระดับการดูแลข้ามเวร ── */}
            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 bg-linear-to-r from-teal-50 to-white">
                <PiArrowsLeftRightBold className="text-[#006b5f] text-base shrink-0" />
                <span className="font-bold text-[#006b5f] text-sm leading-tight">
                  การเปลี่ยนระดับการดูแลข้ามเวร (ดึก → เช้า → บ่าย)
                </span>
                {careLevelFlow && careLevelFlow.totalTransitions > 0 && (
                  <div className="ml-auto flex items-center gap-2">
                    <Tag color="default" className="m-0 text-xs">
                      ทั้งหมด {careLevelFlow.totalTransitions} ครั้ง
                    </Tag>
                    <Tag color={careLevelFlow.changedTransitions > 0 ? 'orange' : 'green'} className="m-0 text-xs font-semibold">
                      เปลี่ยนระดับ {careLevelFlow.changedTransitions} ครั้ง
                    </Tag>
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-[11px] text-gray-400 mb-2 px-1">
                  แต่ละเส้นคือผู้ป่วยที่ถูกประเมินต่อเนื่องสองเวรในวันเดียวกัน — เส้นทึบคือกลุ่มที่ระดับการดูแลเปลี่ยนไป
                </p>
                <div ref={sankeyChartRef} style={{ width: '100%', height: 360 }} />
              </div>
            </div>

            {/* ── Nurse Workload + Pie ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Workload */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-md overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-linear-to-r from-teal-50 to-white">
                  <PiClockBold className="text-[#006b5f] text-lg shrink-0" />
                  <span className="font-bold text-[#006b5f] text-sm">สรุปชั่วโมงการทำงานรายบุคคล — {wardName}</span>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-400">
                    <span>มาตรฐาน <b className="text-gray-600">176 ชม./เดือน</b></span>
                    <span>เวรเช้า <b className="text-gray-600">08-16</b></span>
                    <span>เวรบ่าย <b className="text-gray-600">16-24</b></span>
                    <span>เวรดึก <b className="text-gray-600">00-08</b></span>
                  </div>
                  <div ref={nurseChartRef} style={{ width: '100%', height: Math.max(260, nurseWorkload.length * 40 + 80) }} />
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-[#006b5f] text-white text-xs">
                          <th className="px-3 py-2 text-left rounded-tl-lg font-semibold">ชื่อ-สกุล</th>
                          <th className="px-2 py-2 text-center font-semibold">ตำแหน่ง</th>
                          <th className="px-2 py-2 text-center font-semibold">เช้า</th>
                          <th className="px-2 py-2 text-center font-semibold">บ่าย</th>
                          <th className="px-2 py-2 text-center font-semibold">ดึก</th>
                          <th className="px-2 py-2 text-center font-semibold">OT</th>
                          <th className="px-2 py-2 text-center font-semibold">รวม (ชม.)</th>
                          <th className="px-2 py-2 text-center font-semibold">ผู้ป่วย</th>
                          <th className="px-2 py-2 text-center rounded-tr-lg font-semibold">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nurseWorkload.map((n, idx) => {
                          const over = n.totalHours > 176;
                          return (
                            <tr key={idx} className={`border-b border-gray-100 text-xs transition-colors ${over ? 'hover:bg-red-50' : 'hover:bg-teal-50/40'}`}>
                              <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{n.name}</td>
                              <td className="px-2 py-2 text-center">
                                <Tag color={n.position === 'RN' ? 'blue' : 'green'} className="m-0 text-xs">{n.position}</Tag>
                              </td>
                              <td className="px-2 py-2 text-center text-cyan-700 font-medium">{n.morningShifts}</td>
                              <td className="px-2 py-2 text-center text-violet-700 font-medium">{n.afternoonShifts}</td>
                              <td className="px-2 py-2 text-center text-slate-600 font-medium">{n.nightShifts}</td>
                              <td className="px-2 py-2 text-center">
                                {n.otHours > 0 ? <span className="text-orange-500 font-bold">{n.otHours}</span> : <span className="text-gray-300">-</span>}
                              </td>
                              <td className={`px-2 py-2 text-center font-bold ${over ? 'text-red-500' : 'text-[#006b5f]'}`}>{n.totalHours}</td>
                              <td className="px-2 py-2 text-center text-gray-600">{n.patientLoad}</td>
                              <td className="px-2 py-2 text-center">
                                <Tag color={over ? 'red' : 'green'} className="m-0 font-semibold text-xs">{over ? 'เกิน' : 'ปกติ'}</Tag>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Pie */}
              <ChartCard icon={<PiHeartbeatBold />} title="สัดส่วนประเภทผู้ป่วย">
                <div ref={pieChartRef} style={{ width: '100%', height: 340 }} />
              </ChartCard>
            </div>

            {/* ── Summary Table ── */}
            <div className="bg-white rounded-2xl shadow-md overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5 bg-linear-to-r from-[#006b5f] to-[#00897b]">
                <PiHeartbeatBold className="text-white text-lg" />
                <span className="font-bold text-white text-sm">สรุปภาระงานเทียบมาตรฐาน</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-semibold">รายการ</th>
                      <th className="px-4 py-3 text-center font-semibold">จำนวน</th>
                      <th className="px-4 py-3 text-center font-semibold">เฉลี่ย/วัน</th>
                      <th className="px-4 py-3 text-center font-semibold">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'รับใหม่', total: summary.totalNewAdmit, tag: <Tag color="cyan" className="text-xs">New Admission</Tag> },
                      { label: 'รับย้าย', total: summary.totalTransferIn, tag: <Tag color="purple" className="text-xs">Transfer In</Tag> },
                      { label: 'ดูแลต่อเนื่อง (Patient Day)', total: summary.totalPatientDays, avg: summary.avgCensus, tag: <Tag color="green" className="text-xs">Continued Care</Tag>, bold: true },
                      { label: 'จำหน่าย', total: summary.totalDischarge, tag: <Tag color="orange" className="text-xs">Discharge</Tag> },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-teal-50/30 transition-colors">
                        <td className={`px-4 py-3 ${row.bold ? 'font-bold text-[#006b5f]' : 'font-medium text-gray-700'}`}>{row.label}</td>
                        <td className={`px-4 py-3 text-center ${row.bold ? 'font-bold text-[#006b5f]' : ''}`}>{row.total}</td>
                        <td className={`px-4 py-3 text-center ${row.bold ? 'font-bold text-[#006b5f]' : ''}`}>
                          {row.avg ?? (row.total / (summary.days || 1)).toFixed(1)}
                        </td>
                        <td className="px-4 py-3 text-center">{row.tag}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-gray-100 hover:bg-teal-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-700">จำนวนพยาบาล</td>
                      <td className="px-4 py-3 text-center" colSpan={2}>{summary.nurseCount} คน</td>
                      <td className="px-4 py-3 text-center"><Tag color="blue" className="text-xs">Nurse Staff</Tag></td>
                    </tr>
                    <tr className="bg-teal-50/50">
                      <td className="px-4 py-3.5 font-bold text-gray-800">ภาระงาน / พยาบาล 1 คน</td>
                      <td className="px-4 py-3.5 text-center font-bold text-lg" colSpan={2}>
                        <span className={isOverStandard ? 'text-red-500' : 'text-[#006b5f]'}>1 : {workloadPerNurse}</span>
                        <span className="text-gray-400 text-xs ml-2">(มาตรฐาน 1:{summary.standardRatio})</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Tag color={isOverStandard ? 'red' : 'green'} className="font-bold">
                          {isOverStandard ? 'เกินมาตรฐาน' : 'ผ่านเกณฑ์'}
                        </Tag>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

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
    <div
      className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-md transition-all hover:shadow-xl hover:-translate-y-0.5 ${highlight ? 'ring-2 ring-red-400 ring-offset-2' : ''}`}
      style={{ background: `linear-gradient(135deg, ${color}ee, ${color}99)` }}
    >
      <div className="absolute -right-3 -bottom-3 text-7xl opacity-15">{icon}</div>
      <div className="relative">
        <p className="text-white/75 text-[11px] font-medium mb-1 leading-tight">{label}</p>
        <p className="text-2xl sm:text-3xl font-bold leading-none">{value}</p>
        {suffix && <p className="text-white/60 text-[11px] mt-1">{suffix}</p>}
      </div>
    </div>
  );
}

// --- Chart Card Component ---
function ChartCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-linear-to-r from-teal-50 to-white">
        <span className="text-[#006b5f] text-base shrink-0">{icon}</span>
        <span className="font-bold text-[#006b5f] text-sm leading-tight">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}
