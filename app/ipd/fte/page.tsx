"use client"
import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Select, Typography, DatePicker, Button, Alert, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Navbar from '../../components/Navbar';
import axios from 'axios';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title } = Typography;

interface Ward {
  ward: number;
  ward_name: string;
  his_code: string;
  general?: number;
  crisis?: number;
}

const bold = (val: number | string) => (Number(val) > 0 ? <strong>{val}</strong> : <span>{val}</span>);

const NUMERIC_FIELDS = [
  'ptNormal', 'ptO2', 'ptHfnc', 'ptVent', 'fte',
  'noOtRn', 'noOtTn', 'noOtPn',
  'ot8Rn', 'ot8Tn', 'ot8Pn',
  'ot4Rn', 'ot4Tn', 'ot4Pn',
  'diff', 'prod1',
  't1', 't2', 't3', 't4', 't5',
  'total', 'prod2', 'check',
] as const;

const SHIFT_COLORS: Record<string, string> = { N: '#e6f7ff', D: '#fff7e6', E: '#fff1f0' };
const SHIFT_LABELS: Record<string, string> = { N: 'รวมเวรดึก (N)', D: 'รวมเวรเช้า (D)', E: 'รวมเวรบ่าย (E)' };

/** รูปร่างที่ POST /api/v1/nurse/fte-by-ward ส่งกลับมา — สูตรทั้งหมดคิดจบฝั่งเซิร์ฟเวอร์แล้ว */
interface FteStaff {
  rn: number; tn: number; pn: number;
  ot8_rn: number; ot8_tn: number; ot8_pn: number;
  ot4_rn: number; ot4_tn: number; ot4_pn: number;
}

interface FteRow {
  record_date: string;
  shift_type_id: number;
  shift_name: string;
  pt_normal: number; pt_o2: number; pt_hfnc: number; pt_vent: number;
  fte: number;
  staff: FteStaff;
  diff: number;
  /** null เมื่อเวรนั้นไม่มีใครขึ้นเวร หารไม่ได้ */
  product: number | null;
  types: number[];
  type_total: number;
  product_type: number | null;
  check_diff: number;
}

interface FteMonthlyRow extends Omit<FteRow, 'record_date'> {
  fte_excel: number;
  product_excel: number | null;
}

interface FteAverage {
  pt_vent: number;
  staff: FteStaff;
  types: number[];
  type_total: number;
  product_type: number | null;
}

/** แถวที่ตารางใช้จริง อนุมานจากผลลัพธ์ของ toRow จะได้ไม่ต้องประกาศฟิลด์ซ้ำสองที่ */
type TableRow = Record<string, string | number | null | undefined>;

interface FteHeader {
  nurses_on_duty: number;
  workdays: number;
  public_holidays: number;
  nurses_by_fte: number | null;
  over_under: number | null;
  product_month: number | null;
  product_type_month: number | null;
  shift_pay: number;
  ot_pay: number;
}

const SHIFT_LETTER: Record<string, string> = { 'ดึก': 'N', 'เช้า': 'D', 'บ่าย': 'E' };

const money = (v: number) => v.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: number | null) => (v === null ? '-' : (Number.isInteger(v) ? String(v) : v.toFixed(2)));

/** ช่องตัวเลขสรุปหัวตาราง — hint คือคำอธิบายว่าเลขนี้คิดมาอย่างไร ให้กดค้างดูได้ */
function Stat({ label, value, unit, hint, tone }: {
  label: string; value: string; unit: string; hint?: string; tone?: 'good' | 'bad';
}) {
  const color = tone === 'bad' ? 'text-red-600' : tone === 'good' ? 'text-emerald-600' : 'text-[#006b5f]';
  const box = (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-[#1f1f1f]">
      <div className="text-[11px] text-gray-500 leading-tight">{label}</div>
      <div className={`font-bold text-lg leading-tight ${color}`}>
        {value}<span className="text-xs font-normal text-gray-400 ml-1">{unit}</span>
      </div>
    </div>
  );
  return hint ? <Tooltip title={hint}>{box}</Tooltip> : box;
}

const ScheduleTableAntd = () => {
  // กำหนดโครงสร้างคอลัมน์ (Columns)
  const columns: ColumnsType<TableRow> = [
    {
      title: 'วันที่',
      dataIndex: 'date',
      key: 'date',
      align: 'center',
      width: 50,
      // ฟังก์ชัน render เพื่อทำ RowSpan ผสาน 3 เวรเข้าด้วยกัน
      render: (value) => <strong>{value}</strong>,
      onCell: (record) => {
        if (record.indexInDay === 0) {
          // ใช้ rowSpanForDay จากข้อมูลจริง หรือ fallback เป็น 3
          return { rowSpan: Number(record.rowSpanForDay) || 3 };
        }
        return { rowSpan: 0 }; // แถวอื่นๆ ให้ถูกซ่อนไป
      },
    },
    {
      title: 'เวร',
      dataIndex: 'shift',
      key: 'shift',
      align: 'center',
      width: 50,
      onCell: (record) => {
        // แต่งสีพื้นหลังแยกตามเวร
        let bgColor = '#ffffff';
        if (record.shift === 'N') bgColor = '#e6f7ff';
        if (record.shift === 'D') bgColor = '#fff7e6';
        if (record.shift === 'E') bgColor = '#fff1f0';
        // พื้นหลังเป็นพาสเทลอ่อนทั้งสองโหมด ตัวอักษรจึงต้องล็อกเป็นดำ
        // ไม่งั้นโหมดมืดจะสืบทอดสีอ่อนของ antd มาแล้วอ่านไม่ออก
        return { style: { backgroundColor: bgColor, fontWeight: 'bold', color: '#000000' } };
      }
    },
    {
      title: 'ยอด ที่ไม่ on ventilator',
      children: [
        { title: 'ปกติ', dataIndex: 'ptNormal', key: 'ptNormal', align: 'center', width: 50, render: bold },
        { title: 'O2', dataIndex: 'ptO2', key: 'ptO2', align: 'center', width: 50, render: bold },
        { title: 'HFNC', dataIndex: 'ptHfnc', key: 'ptHfnc', align: 'center', width: 50, render: bold },
      ]
    },
    {
      title: 'ยอด\n ventilator  C/S',
      dataIndex: 'ptVent',
      key: 'ptVent',
      align: 'center',
      width: 70,
      render: bold,
    },
    {
      title: 'FTE',
      dataIndex: 'fte',
      key: 'fte',
      align: 'center',
      width: 60,
      render: bold,
    },
    {
      title: 'ขึ้นตามตารางเวร',
      children: [
        {
          title: 'ไม่ใช่ OT',
          children: [
            { title: 'RN', dataIndex: 'noOtRn', key: 'noOtRn', align: 'center', width: 40, className: 'text-red-500', render: bold },
            { title: 'TN', dataIndex: 'noOtTn', key: 'noOtTn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
            { title: 'PN', dataIndex: 'noOtPn', key: 'noOtPn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
          ],
        },
        {
          title: 'OT 8 hr',
          children: [
            { title: 'RN', dataIndex: 'ot8Rn', key: 'ot8Rn', align: 'center', width: 40, className: 'text-red-500', render: bold },
            { title: 'TN', dataIndex: 'ot8Tn', key: 'ot8Tn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
            { title: 'PN', dataIndex: 'ot8Pn', key: 'ot8Pn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
          ],
        },
        {
          title: 'OT 4 hr',
          children: [
            { title: 'RN', dataIndex: 'ot4Rn', key: 'ot4Rn', align: 'center', width: 40, className: 'text-red-500', render: bold },
            { title: 'TN', dataIndex: 'ot4Tn', key: 'ot4Tn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
            { title: 'PN', dataIndex: 'ot4Pn', key: 'ot4Pn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
          ],
        },
      ],
    },
    {
      title: '-ขาด/+\nเกิน',
      dataIndex: 'diff',
      key: 'diff',
      align: 'center',
      width: 70,
      render: (val) => (
        <span style={{ color: val < 0 ? 'red' : 'inherit', fontWeight: val !== 0 ? 'bold' : 'normal' }}>{val}</span>
      ),
    },
    {
      title: 'product',
      dataIndex: 'prod1',
      key: 'prod1',
      align: 'center',
      width: 80,
      onCell: () => ({ style: { backgroundColor: 'var(--color-indigo-50)' } }),
      // null = เวรนั้นไม่มีใครขึ้นเวร หารไม่ได้ ต้องไม่แสดงเป็นศูนย์ซึ่งแปลว่าไม่มีภาระงาน
      render: (v: number | null) => (v === null ? <span className="text-gray-300">-</span> : bold(v)),
    },
    {
      title: 'ประเภทผู้ป่วย',
      children: [
        { title: '1', dataIndex: 't1', key: 't1', align: 'center', width: 40, render: bold },
        { title: '2', dataIndex: 't2', key: 't2', align: 'center', width: 40, render: bold },
        { title: '3', dataIndex: 't3', key: 't3', align: 'center', width: 40, render: bold },
        { title: '4', dataIndex: 't4', key: 't4', align: 'center', width: 40, render: bold },
        { title: '5', dataIndex: 't5', key: 't5', align: 'center', width: 40, render: bold },
      ],
    },
    {
      title: 'รวม',
      dataIndex: 'total',
      key: 'total',
      align: 'center',
      width: 60,
      onCell: () => ({ style: { backgroundColor: 'var(--color-green-100)', fontWeight: 'bold' } }),
      render: bold,
    },
    {
      title: 'product\nตาม\nประเภท',
      dataIndex: 'prod2',
      key: 'prod2',
      align: 'center',
      width: 80,
      render: (v: number | null) => (v === null ? <span className="text-gray-300">-</span> : bold(v)),
    },
    {
      /*
        ยอดผู้ป่วยต้องเท่ากับผลรวมประเภท 1-5 ไม่เท่ากันแปลว่าลงประเภทไม่ครบ
        คู่มือของแบบฟอร์มเดิมกำกับเรื่องนี้ไว้ แต่ระบบยังไม่เคยมีอะไรจับให้
      */
      title: 'ตรวจ\nยอด',
      dataIndex: 'check',
      key: 'check',
      align: 'center',
      width: 64,
      render: (v: number) => v === 0
        ? <span className="text-gray-300">0</span>
        : (
          <Tooltip title="ยอดผู้ป่วยไม่ตรงกับผลรวมประเภท 1-5 — ลงประเภทผู้ป่วยไม่ครบ">
            <strong className="text-red-500">{v > 0 ? `+${v}` : v}</strong>
          </Tooltip>
        ),
    },
  ];



  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState<string | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());
  const [tableData, setTableData] = useState<TableRow[]>([]);
  const [header, setHeader] = useState<FteHeader | null>(null);
  const [monthlyRows, setMonthlyRows] = useState<TableRow[]>([]);
  const [incomplete, setIncomplete] = useState(0);
  const [loading, setLoading] = useState(false);

  const wardConfig = useMemo(() => {
    const w = wards.find(x => x.his_code === selectedWard);
    return { general: w?.general, crisis: w?.crisis };
  }, [wards, selectedWard]);

  // 1. ดึงรายชื่อหอผู้ป่วย
  useEffect(() => {
    const fetchWards = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) return;
        const response = await axios.get('/api/v1/system/wardsV1', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data) {
          const wardList = Array.isArray(response.data) ? response.data : response.data.data || [];
          setWards(wardList);
          if (wardList.length > 0) {
             setSelectedWard(wardList[0].his_code);
          }
        }
      } catch (error) {
        console.error("Error fetching wards:", error);
      }
    };
    fetchWards();
  }, []);

  // 2. ดึงข้อมูลตารางเมื่อเปลี่ยนหอผู้ป่วย หรือ เดือน
  useEffect(() => {
    if (!selectedWard || !selectedMonth) {
      setTableData([]);
      return;
    }
    
    const fetchFteData = async () => {
      setLoading(true);
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const payload = {
          ward: String(selectedWard),
          month: selectedMonth.format('YYYY-MM') // เช่น '2026-03'
        };
        
        const response = await axios.post('/api/v1/nurse/fte-by-ward', payload, { headers });
        
        if (response.data && response.data.success) {
          const d = response.data.data ?? {};
          const rows: FteRow[] = d.rows ?? [];

          /*
            เซิร์ฟเวอร์คิดสูตรมาให้ครบแล้ว ตรงนี้แค่จัดรูปให้ตาราง
            ห้ามคำนวณ FTE หรือ product ซ้ำที่นี่ ไม่งั้นจะมีสูตรสองชุดในระบบเดียว
            แล้ววันหนึ่งจะแก้ที่เดียวแล้วอีกที่ยังใช้ของเก่าโดยไม่มีใครรู้
          */
          const byDate: Record<string, FteRow[]> = {};
          for (const r of rows) (byDate[r.record_date] ??= []).push(r);

          const toRow = (r: FteRow, index: number, perDay: number) => ({
            key: `${r.record_date}-${r.shift_type_id}`,
            date: dayjs(r.record_date).date(),
            indexInDay: index,
            rowSpanForDay: index === 0 ? perDay : 0,
            shift: SHIFT_LETTER[r.shift_name] ?? r.shift_name,
            ptNormal: r.pt_normal, ptO2: r.pt_o2, ptHfnc: r.pt_hfnc, ptVent: r.pt_vent,
            fte: r.fte,
            noOtRn: r.staff.rn, noOtTn: r.staff.tn, noOtPn: r.staff.pn,
            ot8Rn: r.staff.ot8_rn, ot8Tn: r.staff.ot8_tn, ot8Pn: r.staff.ot8_pn,
            ot4Rn: r.staff.ot4_rn, ot4Tn: r.staff.ot4_tn, ot4Pn: r.staff.ot4_pn,
            diff: r.diff,
            prod1: r.product,
            t1: r.types[0], t2: r.types[1], t3: r.types[2], t4: r.types[3], t5: r.types[4],
            total: r.type_total,
            prod2: r.product_type,
            check: r.check_diff,
          });

          const finalData: TableRow[] = [];
          for (const dateKey of Object.keys(byDate).sort()) {
            const perDay = byDate[dateKey].sort((a, b) => a.shift_type_id - b.shift_type_id);
            perDay.forEach((r, i) => finalData.push(toRow(r, i, perDay.length)));
          }

          setTableData(finalData);
          setHeader(d.header ?? null);
          setIncomplete(Number(d.incomplete_rows ?? 0));

          const avg: FteAverage | undefined = d.monthly?.average;
          setMonthlyRows([
            ...(d.monthly?.by_shift ?? []).map((b: FteMonthlyRow) => ({
              shift: SHIFT_LETTER[b.shift_name] ?? b.shift_name,
              ptNormal: b.pt_normal, ptO2: b.pt_o2, ptHfnc: b.pt_hfnc, ptVent: b.pt_vent,
              fte: b.fte,
              noOtRn: b.staff.rn, noOtTn: b.staff.tn, noOtPn: b.staff.pn,
              ot8Rn: b.staff.ot8_rn, ot8Tn: b.staff.ot8_tn, ot8Pn: b.staff.ot8_pn,
              ot4Rn: b.staff.ot4_rn, ot4Tn: b.staff.ot4_tn, ot4Pn: b.staff.ot4_pn,
              diff: b.diff, prod1: b.product,
              t1: b.types[0], t2: b.types[1], t3: b.types[2], t4: b.types[3], t5: b.types[4],
              total: b.type_total, prod2: b.product_type, check: b.check_diff,
              fteExcel: b.fte_excel, prodExcel: b.product_excel,
            })),
            /*
              แถวเฉลี่ย ยอดผู้ป่วยและประเภทเป็นค่าเฉลี่ยต่อเวร ส่วนจำนวนเจ้าหน้าที่เป็นผลรวมทั้งเดือน
              หน่วยไม่ตรงกันตามแบบฟอร์มเดิม จึงเว้น FTE กับ product ไว้ ไม่แสดงเลขที่ตีความไม่ได้
            */
            {
              shift: 'เฉลี่ย',
              ptNormal: 0, ptO2: 0, ptHfnc: 0, ptVent: avg?.pt_vent ?? 0,
              fte: 0,
              noOtRn: avg?.staff?.rn ?? 0,
              noOtTn: avg?.staff?.tn ?? 0,
              noOtPn: avg?.staff?.pn ?? 0,
              ot8Rn: 0, ot8Tn: 0, ot8Pn: 0, ot4Rn: 0, ot4Tn: 0, ot4Pn: 0,
              diff: 0, prod1: null,
              t1: avg?.types?.[0] ?? 0, t2: avg?.types?.[1] ?? 0,
              t3: avg?.types?.[2] ?? 0, t4: avg?.types?.[3] ?? 0,
              t5: avg?.types?.[4] ?? 0,
              total: avg?.type_total ?? 0,
              prod2: avg?.product_type ?? null,
              check: 0,
            },
          ]);
        } else {
          setTableData([]);
          setHeader(null);
          setMonthlyRows([]);
        }
      } catch (error) {
        console.error("Error fetching fte data:", error);
        setTableData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFteData();
  }, [selectedWard, selectedMonth]);

  /*
    แถวสรุปมาจากเซิร์ฟเวอร์ ไม่ได้บวกเองที่หน้าจอ

    ของเดิมบวกทุกคอลัมน์รวมทั้ง FTE และ product ซึ่งเป็นค่าร้อยละกับค่าถ่วงน้ำหนัก
    บวกตรงๆ แล้วได้ตัวเลขที่ไม่มีความหมาย เช่น product รวมทั้งเดือนเป็นหลักพันเปอร์เซ็นต์
  */
  const summaryRows = monthlyRows;

  const handleExportExcel = () => {
    const wardObj = wards.find(w => w.his_code === selectedWard);
    const wardName = wardObj?.ward_name || selectedWard || 'ward';
    const monthStr = selectedMonth.format('YYYY-MM');

    const HEADERS = [
      'วันที่', 'เวร',
      'ปกติ', 'O2', 'HFNC', 'Vent C/S', 'FTE',
      'ไม่OT-RN', 'ไม่OT-TN', 'ไม่OT-PN',
      'OT8-RN', 'OT8-TN', 'OT8-PN',
      'OT4-RN', 'OT4-TN', 'OT4-PN',
      '-ขาด/+เกิน', 'product',
      'ประเภท1', 'ประเภท2', 'ประเภท3', 'ประเภท4', 'ประเภท5',
      'รวม', 'productตามประเภท', 'ตรวจยอด',
    ];

    const toRow = (r: TableRow) => [
      r.date ?? '', r.shift ?? '',
      ...NUMERIC_FIELDS.map(f => r[f] ?? 0),
    ];

    const dataRows = tableData.map(toRow);
    const blankRow = Array(HEADERS.length).fill('');
    const summaryHeaderRow = ['--- สรุปทั้งเดือน ---', ...Array(HEADERS.length - 1).fill('')];
    const summaryDataRows = summaryRows.map(r => [SHIFT_LABELS[r.shift as string] || r.shift, '', ...NUMERIC_FIELDS.map(f => r[f] ?? 0)]);

    const pad = (text: string) => [text, ...Array(HEADERS.length - 1).fill('')];
    const configRows = [
      pad(`การคิด FTE รายวัน — ${wardName} ประจำเดือน ${selectedMonth.format('MM/YYYY')}`),
      pad(`ค่าน้ำหนักผู้ป่วยทั่วไปต่อพยาบาล 1 คน = ${wardConfig.general ?? '-'}`),
      pad(`ค่าน้ำหนักผู้ป่วย on ventilator หรือ C/S ต่อพยาบาล 1 คน = ${wardConfig.crisis ?? '-'}`),
      pad(`จำนวนพยาบาลที่ขึ้นเวรเดือนนี้ = ${header?.nurses_on_duty ?? '-'} คน · วันราชการ = ${header?.workdays ?? '-'} วัน`),
      pad(`จำนวนพยาบาลตาม FTE = ${num(header?.nurses_by_fte ?? null)} คน · ขาด/เกิน = ${num(header?.over_under ?? null)} คน`),
      pad(`product ทั้งเดือน = ${num(header?.product_month ?? null)}% · product ตามประเภท = ${num(header?.product_type_month ?? null)}%`),
      pad(`ค่าเวร = ${money(header?.shift_pay ?? 0)} บาท · ค่า OT = ${money(header?.ot_pay ?? 0)} บาท`),
      blankRow,
    ];

    const wsData = [...configRows, HEADERS, ...dataRows, blankRow, summaryHeaderRow, ...summaryDataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = HEADERS.map(() => ({ wch: 12 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FTE');
    XLSX.writeFile(wb, `FTE_${wardName}_${monthStr}.xlsx`);
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6 max-w-full mx-auto">
        <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <Title level={4} className="text-[var(--brand-text)]! m-0">
              ตารางเวรและภาระงาน (FTE)
            </Title>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 whitespace-nowrap">เลือกหอผู้ป่วย:</span>
              <Select 
                size="middle"
                value={selectedWard}
                className="w-48"
                onChange={(value) => setSelectedWard(value)}
                placeholder="กำลังโหลดข้อมูล..."
                options={wards.map(w => ({ label: w.ward_name, value: w.his_code }))}
                showSearch
                optionFilterProp="label"
              />
              <span className="text-gray-600 whitespace-nowrap ml-2">ประจำเดือน:</span>
              <DatePicker
                picker="month"
                size="middle"
                value={selectedMonth}
                onChange={(date) => setSelectedMonth(date || dayjs())}
                format="MM/YYYY"
                allowClear={false}
              />
              <Button
                size="middle"
                onClick={handleExportExcel}
                disabled={tableData.length === 0}
                style={{ backgroundColor: '#217346', borderColor: '#217346', color: '#fff' }}
              >
                ส่งออก Excel
              </Button>
            </div>
          </div>

          {header && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <Stat label="พยาบาลที่ขึ้นเวรเดือนนี้" value={`${header.nurses_on_duty}`} unit="คน"
                hint="นับจากตารางเวร คนที่ไม่มีเวรทั้งเดือน (ลาคลอด/เรียนต่อ) ไม่ถูกนับ" />
              <Stat label="จำนวนตาม FTE" value={num(header.nurses_by_fte)} unit="คน"
                hint="คิดตามสูตรในแบบฟอร์มเดิม ซึ่งใช้ตัวคูณ 12 กับผู้ป่วยทั้งสองกลุ่ม" />
              <Stat label="ขาด / เกิน" value={num(header.over_under)} unit="คน"
                tone={(header.over_under ?? 0) < 0 ? 'bad' : 'good'} />
              <Stat label="วันราชการ" value={`${header.workdays}`} unit="วัน"
                hint={`หักเสาร์อาทิตย์และวันหยุดที่ประกาศอีก ${header.public_holidays} วัน`} />
              <Stat label="product ทั้งเดือน" value={num(header.product_month)} unit="%" />
              <Stat label="product ตามประเภท" value={num(header.product_type_month)} unit="%"
                hint="คิดแบบเดียวกับแบบฟอร์มเดิม ซึ่งเอาค่าเฉลี่ยผู้ป่วยหารด้วยยอดรวมเจ้าหน้าที่ทั้งเดือน" />
              <Stat label="ค่าเวร" value={money(header.shift_pay)} unit="บาท"
                hint="คิดจากอัตราในหน้าตั้งค่าค่าตอบแทนตามเวร ไม่ใช่ตัวเลขที่ฝังในแบบฟอร์มเดิม" />
              <Stat label="ค่า OT" value={money(header.ot_pay)} unit="บาท" />
            </div>
          )}

          {incomplete > 0 && (
            <Alert
              type="warning"
              showIcon
              className="mb-4"
              message={`มี ${incomplete} เวรที่ลงประเภทผู้ป่วยไม่ครบ`}
              description="ยอดผู้ป่วยไม่ตรงกับผลรวมประเภท 1-5 ดูคอลัมน์ตรวจยอดท้ายตาราง — ค่า product ตามประเภทของเวรนั้นจะต่ำกว่าความจริง"
            />
          )}

          <div style={{ overflowX: 'auto' }}>
            <Table
              columns={columns}
              dataSource={tableData}
              bordered
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
              rowClassName={() => 'hover:bg-gray-50'}
              title={() => (
                <div className="flex flex-col gap-0.5 text-sm font-medium text-white">
                  <span>
                    ค่าน้ำหนักผู้ป่วยทั่วไปต่อพยาบาล 1 คน&nbsp;=&nbsp;
                    <strong>{wardConfig.general ?? '-'}</strong>
                  </span>
                  <span>
                    ค่าน้ำหนักผู้ป่วย on ventilator หรือ C/S ต่อพยาบาล 1 คน&nbsp;=&nbsp;
                    <strong>{wardConfig.crisis ?? '-'}</strong>
                  </span>
                </div>
              )}
              loading={loading}
              className="
                [&_.ant-table-title]:bg-[#006b5f]!
                [&_.ant-table-title]:border-b-0!
                [&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]!
                [&_.ant-table-thead_.ant-table-cell]:text-white!
                [&_.ant-table-thead_.ant-table-cell]:font-semibold!
                [&_.ant-table-thead_.ant-table-cell]:border-[#005a50]!
                [&_.ant-table-thead>tr:nth-child(2)_.ant-table-cell]:bg-[#00897b]!
                [&_.ant-table-thead>tr:nth-child(3)_.ant-table-cell]:bg-[#26a69a]!
              "
              summary={() => (
                <Table.Summary fixed="bottom">
                  {summaryRows.map((row, rowIdx) => {
                    const isAvg = row.shift === 'เฉลี่ย';
                    const bg = isAvg ? '#f6ffed' : SHIFT_COLORS[row.shift as string] || '#fafafa';
                    const label = isAvg ? 'เฉลี่ย/วัน' : SHIFT_LABELS[row.shift as string];
                    // พื้นหลังแถวสรุปเป็นพาสเทลอ่อนทั้งสองโหมด จึงล็อกตัวอักษรเป็นดำไว้ด้วย
                    return (
                      <Table.Summary.Row key={rowIdx} style={{ backgroundColor: bg, color: '#000000' }}>
                        <Table.Summary.Cell index={0} colSpan={2} align="center">
                          <strong style={{ color: isAvg ? '#389e0d' : '#006b5f' }}>{label}</strong>
                        </Table.Summary.Cell>
                        {NUMERIC_FIELDS.map((f, fi) => {
                          const raw = row[f];
                          const val = raw === null || raw === undefined ? null : Number(raw);
                          return (
                            <Table.Summary.Cell key={f} index={fi + 2} align="center">
                              {val !== null && val !== 0
                                ? <strong>{Number.isInteger(val) ? val : val.toFixed(2)}</strong>
                                : <span style={{ color: '#ccc' }}>-</span>}
                              {/* ค่าตามสูตรในแบบฟอร์มเดิม ไว้เทียบกับรายงานเก่าที่เคยส่งไป */}
                              {f === 'fte' && row.fteExcel !== undefined && (
                                <div className="text-[10px] font-normal text-gray-400">เดิม {num(Number(row.fteExcel))}</div>
                              )}
                              {f === 'prod1' && row.prodExcel !== undefined && (
                                <div className="text-[10px] font-normal text-gray-400">เดิม {num(Number(row.prodExcel))}</div>
                              )}
                            </Table.Summary.Cell>
                          );
                        })}
                      </Table.Summary.Row>
                    );
                  })}
                </Table.Summary>
              )}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ScheduleTableAntd;