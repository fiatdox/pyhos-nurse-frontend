"use client"
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Select, Table, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import Navbar from '../../components/Navbar';
import { tableLoading } from '@/app/components/Skeletons';
import { currentFiscalYear, fiscalYearRange } from '@/app/lib/fiscalYear';

/*
  product ของหน่วยงานที่ไม่ใช่หอผู้ป่วย — ER · ห้องผ่าตัด · วิสัญญี · ห้องคลอด · ห้องตรวจ OPD

  หน้านี้ทำสองอย่าง: กรอกยอดงานกับคนขึ้นเวร และแสดง FTE / product ที่เซิร์ฟเวอร์คิดให้
  สูตรอยู่ฝั่งเซิร์ฟเวอร์ที่เดียว (utils/fte.ts) ตัวเลขที่คำนวณบนจอจะเปลี่ยนหลังกดบันทึกเท่านั้น
  ถ้าคิดซ้ำบนจอระหว่างพิมพ์ วันหนึ่งสองที่จะคิดไม่ตรงกันโดยไม่มีใครรู้
*/

const { Title, Text } = Typography;

interface UnitItem { item_id: number; code: string; name: string; care_hours: number }
interface WorkUnit {
  work_unit_id: number;
  code: string;
  name: string;
  period: 'shift' | 'month';
  group: string | null;
  shift_weights: { shift_type_id: number; weight: number }[] | null;
  staff_from_schedule: boolean;
  items: UnitItem[];
}
interface StaffCount { regular: number; ot: number; total: number }
interface Sum { qty: number[]; hours: number; fte: number; staff: StaffCount; diff: number; product: number | null }
interface ReportRow extends Sum { record_date: string; shift_type_id: number; entered: boolean }
interface Report {
  unit: WorkUnit;
  rows: ReportRow[];
  monthly: { by_shift: (Sum & { shift_type_id: number })[]; total: Sum };
  header: {
    nurses: number | null; workdays: number; public_holidays: number;
    nurses_by_fte: number | null; over_under: number | null; product_month: number | null;
  };
  no_staff_rows: number;
  entered_rows: number;
}
interface GroupRow {
  work_unit_id: number; code: string; name: string; qty: number[]; hours: number; staff: StaffCount;
  fte_days: number; diff_days: number; fte_persons: number | null; nurses: number | null;
  over_under: number | null; product: number | null; months_entered: number;
}
interface GroupReport {
  workdays: number;
  items: UnitItem[];
  rows: GroupRow[];
  total: Omit<GroupRow, 'work_unit_id' | 'code' | 'name' | 'months_entered'>;
}

const SHIFT_LETTER: Record<number, string> = { 1: 'N', 2: 'D', 3: 'E' };
const SHIFT_NAME: Record<number, string> = { 1: 'ดึก', 2: 'เช้า', 3: 'บ่าย' };
// พื้นพาสเทลทั้งสองโหมด ตัวอักษรจึงล็อกเป็นดำ แบบเดียวกับหน้า FTE ของหอผู้ป่วย
const SHIFT_BG: Record<number, string> = { 1: '#e6f7ff', 2: '#fff7e6', 3: '#fff1f0' };

const TABLE_CLASS = `
  [&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]!
  [&_.ant-table-thead_.ant-table-cell]:text-white!
  [&_.ant-table-thead_.ant-table-cell]:font-semibold!
  [&_.ant-table-thead_.ant-table-cell]:border-[#005a50]!
  [&_.ant-table-thead>tr:nth-child(2)_.ant-table-cell]:bg-[#00897b]!
`;

const authHeaders = () => {
  const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const errorText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;

const num = (v: number | null | undefined) =>
  v === null || v === undefined ? '-' : Number.isInteger(v) ? String(v) : v.toFixed(2);

const sameNum = (a: number | null, b: number | null) => (a ?? null) === (b ?? null);

/** ช่องกรอกตัวเลข — ใช้ input ธรรมดา เพราะหน้าเดือนหนึ่งมีหลายร้อยช่อง InputNumber ของ antd หนักเกินไปตอนพิมพ์ */
function NumInput({ value, onChange, decimals = 0, disabled, width = 56 }: {
  value: number | null; onChange: (v: number | null) => void; decimals?: number; disabled?: boolean; width?: number;
}) {
  return (
    <input
      type="number"
      inputMode={decimals ? 'decimal' : 'numeric'}
      min={0}
      step={decimals ? 1 / 10 ** decimals : 1}
      disabled={disabled}
      value={value ?? ''}
      onChange={e => {
        const raw = e.target.value;
        if (raw === '') return onChange(null);
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) onChange(decimals ? Math.round(n * 10 ** decimals) / 10 ** decimals : Math.trunc(n));
      }}
      style={{ width }}
      className="rounded border border-gray-300 bg-white px-1 py-0.5 text-center text-gray-900 focus:border-[#006b5f] focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
    />
  );
}

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

const ProductCell = ({ v, stale }: { v: number | null; stale?: boolean }) =>
  v === null
    ? <span className="text-gray-300">-</span>
    : <strong className={stale ? 'opacity-40' : ''}>{num(v)}</strong>;

const DiffCell = ({ v, stale }: { v: number; stale?: boolean }) => (
  <span className={`${v < 0 ? 'text-red-500 font-bold' : ''} ${stale ? 'opacity-40' : ''}`}>{num(v)}</span>
);

/* ───────────────────────── หน่วยที่นับรายเวร ───────────────────────── */

interface Draft { qty: (number | null)[]; regular: number | null; ot: number | null }
const keyOf = (d: string, s: number) => `${d}|${s}`;

function ShiftUnitView({ unit, month }: { unit: WorkUnit; month: Dayjs }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Record<string, Draft>>({});
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [nurses, setNurses] = useState<{ saved: number | null; value: number | null }>({ saved: null, value: null });
  const manualStaff = !unit.staff_from_schedule;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/v1/work-units/report',
        { work_unit_id: unit.work_unit_id, month: month.format('YYYY-MM') }, { headers: authHeaders() });
      const data: Report = res.data.data;
      setReport(data);
      // แถวที่ยังไม่กรอกแสดงเป็นช่องว่าง ไม่ใช่ศูนย์ — ศูนย์แปลว่า "ไม่มีงาน" ซึ่งเป็นคนละเรื่องกัน
      const init: Record<string, Draft> = {};
      for (const r of data.rows) {
        init[keyOf(r.record_date, r.shift_type_id)] = r.entered
          ? { qty: [...r.qty], regular: r.staff.regular, ot: r.staff.ot }
          : { qty: r.qty.map(() => null), regular: null, ot: null };
      }
      setSaved(init);
      setDraft(init);
      setNurses({ saved: data.header.nurses, value: data.header.nurses });
    } catch (e) {
      setReport(null);
      Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: errorText(e, 'โปรดลองอีกครั้ง'), confirmButtonColor: '#006b5f' });
    } finally {
      setLoading(false);
    }
  }, [unit.work_unit_id, month]);

  useEffect(() => { load(); }, [load]);

  const isDirty = useCallback((k: string) => {
    const a = draft[k], b = saved[k];
    if (!a || !b) return false;
    return a.qty.some((q, i) => !sameNum(q, b.qty[i]))
      || (manualStaff && (!sameNum(a.regular, b.regular) || !sameNum(a.ot, b.ot)));
  }, [draft, saved, manualStaff]);

  const dirtyKeys = useMemo(() => Object.keys(draft).filter(isDirty), [draft, isDirty]);
  const headcountDirty = manualStaff && !sameNum(nurses.value, nurses.saved);

  const setCell = (k: string, patch: Partial<Draft> | ((d: Draft) => Draft)) =>
    setDraft(prev => ({ ...prev, [k]: typeof patch === 'function' ? patch(prev[k]) : { ...prev[k], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put('/api/v1/work-units/entries', {
        month: month.format('YYYY-MM'),
        entries: dirtyKeys.map(k => {
          const [d, s] = k.split('|');
          const v = draft[k];
          return {
            work_unit_id: unit.work_unit_id,
            record_date: d,
            shift_type_id: Number(s),
            qty: unit.items.map((it, i) => ({ item_id: it.item_id, qty: v.qty[i] })),
            ...(manualStaff ? { regular: v.regular, ot: v.ot } : {}),
          };
        }),
        headcount: headcountDirty ? [{ work_unit_id: unit.work_unit_id, nurses: nurses.value }] : [],
      }, { headers: authHeaders() });
      await load();
      Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1400, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: errorText(e, 'โปรดลองอีกครั้ง'), confirmButtonColor: '#006b5f' });
    } finally {
      setSaving(false);
    }
  };

  type Row = ReportRow & { key: string; first: boolean };
  const rows: Row[] = useMemo(() => (report?.rows ?? []).map(r => ({
    ...r, key: keyOf(r.record_date, r.shift_type_id), first: r.shift_type_id === 1,
  })), [report]);

  const columns: ColumnsType<Row> = [
    {
      title: 'วันที่', dataIndex: 'record_date', align: 'center', width: 52, fixed: 'left',
      render: (d: string) => <strong>{dayjs(d).date()}</strong>,
      onCell: r => ({ rowSpan: r.first ? 3 : 0 }),
    },
    {
      title: 'เวร', dataIndex: 'shift_type_id', align: 'center', width: 44, fixed: 'left',
      render: (s: number) => SHIFT_LETTER[s],
      onCell: r => ({ style: { backgroundColor: SHIFT_BG[r.shift_type_id], color: '#000000', fontWeight: 'bold' } }),
    },
    {
      title: unit.shift_weights ? 'ยอดคงพยาบาลปลายเวร' : 'จำนวนรายที่ให้บริการในเวร',
      children: unit.items.map((it, i) => ({
        title: <Tooltip title={`${it.care_hours} ชั่วโมงต่อราย`}>{it.name}<div className="text-[10px] font-normal opacity-80">× {it.care_hours}</div></Tooltip>,
        key: `q${it.item_id}`, align: 'center' as const, width: 70,
        render: (_: unknown, r: Row) => (
          <NumInput value={draft[r.key]?.qty[i] ?? null}
            onChange={v => setCell(r.key, d => ({ ...d, qty: d.qty.map((q, j) => (j === i ? v : q)) }))} />
        ),
      })),
    },
    {
      title: 'ชั่วโมงภาระงาน', dataIndex: 'hours', align: 'center', width: 80,
      render: (v: number, r) => <span className={isDirty(r.key) ? 'opacity-40' : ''}>{v ? num(v) : <span className="text-gray-300">-</span>}</span>,
    },
    {
      title: 'FTE', dataIndex: 'fte', align: 'center', width: 64,
      render: (v: number, r) => <strong className={isDirty(r.key) ? 'opacity-40' : ''}>{v ? num(v) : <span className="text-gray-300 font-normal">-</span>}</strong>,
    },
    {
      title: unit.staff_from_schedule ? 'ขึ้นเวร (จากตารางเวร)' : 'ขึ้นเวร',
      children: [
        {
          title: 'ปกติ', key: 'regular', align: 'center', width: 64,
          render: (_: unknown, r: Row) => manualStaff
            ? <NumInput value={draft[r.key]?.regular ?? null} onChange={v => setCell(r.key, { regular: v })} />
            : <span>{r.staff.regular || <span className="text-gray-300">-</span>}</span>,
        },
        {
          title: 'OT', key: 'ot', align: 'center', width: 64,
          render: (_: unknown, r: Row) => manualStaff
            ? <NumInput value={draft[r.key]?.ot ?? null} onChange={v => setCell(r.key, { ot: v })} />
            : <span>{r.staff.ot || <span className="text-gray-300">-</span>}</span>,
        },
      ],
    },
    {
      title: '-ขาด/+เกิน', dataIndex: 'diff', align: 'center', width: 72,
      render: (v: number, r) => (r.hours || r.staff.total ? <DiffCell v={v} stale={isDirty(r.key)} /> : <span className="text-gray-300">-</span>),
    },
    {
      title: 'product', dataIndex: 'product', align: 'center', width: 76,
      onCell: () => ({ style: { backgroundColor: 'var(--color-indigo-50)' } }),
      render: (v: number | null, r) => <ProductCell v={v} stale={isDirty(r.key)} />,
    },
  ];

  const summaryRow = (label: string, s: Sum, bg: string, idx: number) => (
    <Table.Summary.Row key={idx} style={{ backgroundColor: bg, color: '#000000' }}>
      <Table.Summary.Cell index={0} colSpan={2} align="center"><strong style={{ color: '#006b5f' }}>{label}</strong></Table.Summary.Cell>
      {s.qty.map((q, i) => <Table.Summary.Cell key={i} index={2 + i} align="center"><strong>{q || '-'}</strong></Table.Summary.Cell>)}
      <Table.Summary.Cell index={2 + s.qty.length} align="center">{num(s.hours)}</Table.Summary.Cell>
      <Table.Summary.Cell index={3 + s.qty.length} align="center"><strong>{num(s.fte)}</strong></Table.Summary.Cell>
      <Table.Summary.Cell index={4 + s.qty.length} align="center">{num(s.staff.regular)}</Table.Summary.Cell>
      <Table.Summary.Cell index={5 + s.qty.length} align="center">{num(s.staff.ot)}</Table.Summary.Cell>
      <Table.Summary.Cell index={6 + s.qty.length} align="center"><span className={s.diff < 0 ? 'text-red-600 font-bold' : ''}>{num(s.diff)}</span></Table.Summary.Cell>
      <Table.Summary.Cell index={7 + s.qty.length} align="center"><strong>{num(s.product)}</strong></Table.Summary.Cell>
    </Table.Summary.Row>
  );

  const exportExcel = () => {
    if (!report) return;
    const items = unit.items.map(i => `${i.name} (×${i.care_hours})`);
    const head = ['วันที่', 'เวร', ...items, 'ชั่วโมงภาระงาน', 'FTE', 'ขึ้นเวรปกติ', 'OT', '-ขาด/+เกิน', 'product'];
    const line = (a: string | number, b: string, s: Sum) =>
      [a, b, ...s.qty, s.hours, s.fte, s.staff.regular, s.staff.ot, s.diff, s.product ?? ''];
    const h = report.header;
    const pad = (t: string) => [t, ...Array(head.length - 1).fill('')];
    const aoa = [
      pad(`การคิด FTE รายวัน — ${unit.name} ประจำเดือน ${month.format('MM/YYYY')}`),
      pad(`จำนวนพยาบาลมีจริง = ${h.nurses ?? '-'} คน · วันราชการ = ${h.workdays} วัน · จำนวนตาม FTE = ${num(h.nurses_by_fte)} คน · ขาด/เกิน = ${num(h.over_under)} คน`),
      pad(`product ทั้งเดือน = ${num(h.product_month)}%`),
      [],
      head,
      ...report.rows.map(r => line(dayjs(r.record_date).date(), SHIFT_LETTER[r.shift_type_id], r)),
      [],
      ...report.monthly.by_shift.map(s => line(`รวมเวร${SHIFT_NAME[s.shift_type_id]}`, '', s)),
      line('รวมทั้งหมด', '', report.monthly.total),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = head.map(() => ({ wch: 12 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, unit.code);
    XLSX.writeFile(wb, `FTE_${unit.code}_${month.format('YYYY-MM')}.xlsx`);
  };

  const h = report?.header;
  const pending = dirtyKeys.length + (headcountDirty ? 1 : 0);

  return (
    <>
      {h && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          {manualStaff ? (
            <Tooltip title="ไม่นับคนที่ลาคลอดหรือเรียนต่อซึ่งไม่มาทำงานทั้งเดือน">
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-[#1f1f1f]">
                <div className="text-[11px] text-gray-500 leading-tight">พยาบาลมีจริงเดือนนี้</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <NumInput value={nurses.value} onChange={v => setNurses(n => ({ ...n, value: v }))} width={64} />
                  <span className="text-xs text-gray-400">คน</span>
                </div>
              </div>
            </Tooltip>
          ) : (
            <Stat label="พยาบาลที่ขึ้นเวรเดือนนี้" value={String(h.nurses ?? 0)} unit="คน" hint="นับจากตารางเวร" />
          )}
          <Stat label="จำนวนตาม FTE" value={num(h.nurses_by_fte)} unit="คน" hint="ชั่วโมงภาระงานทั้งเดือน ÷ (วันราชการ × 7)" />
          <Stat label="ขาด / เกิน" value={num(h.over_under)} unit="คน" tone={(h.over_under ?? 0) < 0 ? 'bad' : 'good'} />
          <Stat label="วันราชการ" value={String(h.workdays)} unit="วัน" hint={`หักเสาร์อาทิตย์และวันหยุดที่ประกาศอีก ${h.public_holidays} วัน`} />
          <Stat label="product ทั้งเดือน" value={num(h.product_month)} unit="%" hint="ชั่วโมงภาระงานรวม ÷ (คนขึ้นเวรรวม OT × 7) × 100" />
        </div>
      )}

      {report && report.no_staff_rows > 0 && (
        <Alert type="warning" showIcon className="mb-3"
          title={`มี ${report.no_staff_rows} เวรที่มีงานแต่ไม่มีคนขึ้นเวร`}
          description={unit.staff_from_schedule
            ? 'ตารางเวรของเวรนั้นยังว่าง product ของเวรนั้นคิดไม่ได้ และ product ทั้งเดือนจะสูงกว่าความจริง'
            : 'ยังไม่ได้กรอกจำนวนคนของเวรนั้น product ของเวรนั้นคิดไม่ได้ และ product ทั้งเดือนจะสูงกว่าความจริง'} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <Text type="secondary" className="text-xs">
          {unit.shift_weights
            ? `ถ่วงตามเวร ดึก ${unit.shift_weights[0].weight}% · เช้า ${unit.shift_weights[1].weight}% · บ่าย ${unit.shift_weights[2].weight}%`
            : 'ไม่ถ่วงตามเวร — ชั่วโมงต่อรายคือชั่วโมงของรายนั้นทั้งหมด'}
          {unit.staff_from_schedule && ' · จำนวนคนขึ้นเวรอ่านจากตารางเวร แก้ที่หน้าตั้งค่าเวรเจ้าหน้าที่'}
        </Text>
        <div className="flex gap-2">
          <Button onClick={exportExcel} disabled={!report || pending > 0}
            style={{ backgroundColor: '#217346', borderColor: '#217346', color: '#fff' }}>ส่งออก Excel</Button>
          <Button type="primary" onClick={save} loading={saving} disabled={pending === 0}>
            บันทึก{pending > 0 ? ` (${pending})` : ''}
          </Button>
        </div>
      </div>

      {pending > 0 && (
        <div className="text-xs text-amber-600 mb-2">ตัวเลขสีจางคือค่าก่อนแก้ — กดบันทึกแล้วระบบจะคำนวณใหม่</div>
      )}

      <Table<Row>
        columns={columns}
        dataSource={rows}
        bordered
        size="small"
        pagination={false}
        scroll={{ x: 'max-content', y: 'calc(100vh - 360px)' }}
        className={TABLE_CLASS}
        {...tableLoading(loading, rows)}
        summary={() => report && (
          <Table.Summary fixed="bottom">
            {report.monthly.by_shift.map((s, i) => summaryRow(`รวมเวร${SHIFT_NAME[s.shift_type_id]}`, s, SHIFT_BG[s.shift_type_id], i))}
            {summaryRow('รวมทั้งหมด', report.monthly.total, '#f6ffed', 9)}
          </Table.Summary>
        )}
      />
    </>
  );
}

/* ───────────────────────── หน่วยรายเดือน (ห้องตรวจ OPD) ───────────────────────── */

interface GroupDraft { qty: (number | null)[]; regular: number | null; ot: number | null; nurses: number | null }

function GroupView({ group, units, month }: { group: string; units: WorkUnit[]; month: Dayjs }) {
  const [monthReport, setMonthReport] = useState<GroupReport | null>(null);
  const [saved, setSaved] = useState<Record<number, GroupDraft>>({});
  const [draft, setDraft] = useState<Record<number, GroupDraft>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => [fiscalYearRange(currentFiscalYear())[0], dayjs()]);
  const [rangeReport, setRangeReport] = useState<GroupReport | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const items = units[0]?.items ?? [];

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      const m = month.format('YYYY-MM');
      const res = await axios.post('/api/v1/work-units/group-report', { group, month_from: m, month_to: m }, { headers: authHeaders() });
      const data: GroupReport = res.data.data;
      setMonthReport(data);
      const init: Record<number, GroupDraft> = {};
      for (const r of data.rows) {
        const entered = r.months_entered > 0;
        init[r.work_unit_id] = {
          qty: entered ? [...r.qty] : r.qty.map(() => null),
          regular: entered ? r.staff.regular : null,
          ot: entered ? r.staff.ot : null,
          nurses: r.nurses,
        };
      }
      setSaved(init);
      setDraft(init);
    } catch (e) {
      setMonthReport(null);
      Swal.fire({ icon: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', text: errorText(e, 'โปรดลองอีกครั้ง'), confirmButtonColor: '#006b5f' });
    } finally {
      setLoading(false);
    }
  }, [group, month]);

  const loadRange = useCallback(async () => {
    setRangeLoading(true);
    try {
      const res = await axios.post('/api/v1/work-units/group-report',
        { group, month_from: range[0].format('YYYY-MM'), month_to: range[1].format('YYYY-MM') }, { headers: authHeaders() });
      setRangeReport(res.data.data);
    } catch {
      setRangeReport(null);
    } finally {
      setRangeLoading(false);
    }
  }, [group, range]);

  useEffect(() => { loadMonth(); }, [loadMonth]);
  useEffect(() => { loadRange(); }, [loadRange]);

  const dirtyOf = (id: number) => {
    const a = draft[id], b = saved[id];
    if (!a || !b) return { data: false, head: false };
    return {
      data: a.qty.some((q, i) => !sameNum(q, b.qty[i])) || !sameNum(a.regular, b.regular) || !sameNum(a.ot, b.ot),
      head: !sameNum(a.nurses, b.nurses),
    };
  };
  const dirtyIds = Object.keys(draft).map(Number).filter(id => dirtyOf(id).data || dirtyOf(id).head);

  const setCell = (id: number, patch: Partial<GroupDraft>) => setDraft(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put('/api/v1/work-units/entries', {
        month: month.format('YYYY-MM'),
        entries: dirtyIds.filter(id => dirtyOf(id).data).map(id => ({
          work_unit_id: id,
          record_date: month.format('YYYY-MM-01'),
          shift_type_id: 0,
          qty: items.map((_, i) => ({ item_id: units.find(u => u.work_unit_id === id)!.items[i].item_id, qty: draft[id].qty[i] })),
          regular: draft[id].regular,
          ot: draft[id].ot,
        })),
        headcount: dirtyIds.filter(id => dirtyOf(id).head).map(id => ({ work_unit_id: id, nurses: draft[id].nurses })),
      }, { headers: authHeaders() });
      await Promise.all([loadMonth(), loadRange()]);
      Swal.fire({ icon: 'success', title: 'บันทึกแล้ว', timer: 1400, showConfirmButton: false });
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: errorText(e, 'โปรดลองอีกครั้ง'), confirmButtonColor: '#006b5f' });
    } finally {
      setSaving(false);
    }
  };

  const entryColumns: ColumnsType<GroupRow> = [
    { title: 'ห้องตรวจ', dataIndex: 'name', fixed: 'left', width: 170 },
    ...items.map((it, i) => ({
      title: <>{it.name}<div className="text-[10px] font-normal opacity-80">× {it.care_hours} ชม.</div></>,
      key: `q${i}`, align: 'center' as const, width: 90,
      render: (_: unknown, r: GroupRow) => (
        <NumInput value={draft[r.work_unit_id]?.qty[i] ?? null} width={72}
          onChange={v => setCell(r.work_unit_id, { qty: draft[r.work_unit_id].qty.map((q, j) => (j === i ? v : q)) })} />
      ),
    })),
    {
      title: <Tooltip title="วันทำงานของพยาบาลรวมทั้งเดือน (คน × วัน)">วันทำงาน</Tooltip>,
      children: [
        {
          title: 'ปกติ', key: 'regular', align: 'center', width: 84,
          render: (_: unknown, r: GroupRow) => <NumInput decimals={2} width={72} value={draft[r.work_unit_id]?.regular ?? null}
            onChange={v => setCell(r.work_unit_id, { regular: v })} />,
        },
        {
          title: 'OT', key: 'ot', align: 'center', width: 76,
          render: (_: unknown, r: GroupRow) => <NumInput decimals={2} width={64} value={draft[r.work_unit_id]?.ot ?? null}
            onChange={v => setCell(r.work_unit_id, { ot: v })} />,
        },
      ],
    },
    {
      title: 'จนท. มีจริง', key: 'nurses', align: 'center', width: 80,
      render: (_: unknown, r: GroupRow) => <NumInput width={56} value={draft[r.work_unit_id]?.nurses ?? null}
        onChange={v => setCell(r.work_unit_id, { nurses: v })} />,
    },
    {
      title: 'ชม.ภาระงาน', dataIndex: 'hours', align: 'center', width: 84,
      render: (v: number, r) => <span className={dirtyOf(r.work_unit_id).data ? 'opacity-40' : ''}>{v ? num(v) : '-'}</span>,
    },
    {
      title: <Tooltip title="ชั่วโมงภาระงาน ÷ 7 (หน่วยเป็นวันทำงาน)">FTE (วัน)</Tooltip>, dataIndex: 'fte_days', align: 'center', width: 76,
      render: (v: number, r) => <strong className={dirtyOf(r.work_unit_id).data ? 'opacity-40' : ''}>{v ? num(v) : '-'}</strong>,
    },
    {
      title: '-ขาด/+เกิน (วัน)', dataIndex: 'diff_days', align: 'center', width: 84,
      render: (v: number, r) => (r.hours || r.staff.total ? <DiffCell v={v} stale={dirtyOf(r.work_unit_id).data} /> : '-'),
    },
    {
      title: 'product', dataIndex: 'product', align: 'center', width: 76,
      onCell: () => ({ style: { backgroundColor: 'var(--color-indigo-50)' } }),
      render: (v: number | null, r) => <ProductCell v={v} stale={dirtyOf(r.work_unit_id).data} />,
    },
  ];

  const summaryColumns: ColumnsType<GroupRow> = [
    { title: 'ห้องตรวจ', dataIndex: 'name', fixed: 'left', width: 170 },
    ...items.map((it, i) => ({
      title: it.name, key: `q${i}`, align: 'center' as const, width: 90,
      render: (_: unknown, r: GroupRow) => r.qty[i]?.toLocaleString() || '-',
    })),
    { title: 'ชม.ภาระงาน', dataIndex: 'hours', align: 'center', width: 90, render: (v: number) => (v ? v.toLocaleString() : '-') },
    { title: 'วันทำงาน (ปกติ+OT)', key: 'st', align: 'center', width: 110, render: (_, r) => (r.staff.total ? num(r.staff.total) : '-') },
    {
      title: <Tooltip title="ชั่วโมงภาระงาน ÷ (วันราชการในช่วง × 7)">FTE (คน)</Tooltip>,
      dataIndex: 'fte_persons', align: 'center', width: 80, render: (v: number | null) => <strong>{num(v)}</strong>,
    },
    { title: 'จนท. มีจริง', dataIndex: 'nurses', align: 'center', width: 80, render: (v: number | null) => num(v) },
    {
      title: '-ขาด/+เกิน (คน)', dataIndex: 'over_under', align: 'center', width: 90,
      render: (v: number | null) => (v === null ? '-' : <DiffCell v={v} />),
    },
    {
      title: 'product', dataIndex: 'product', align: 'center', width: 80,
      onCell: () => ({ style: { backgroundColor: 'var(--color-indigo-50)' } }),
      render: (v: number | null) => <ProductCell v={v} />,
    },
    { title: 'เดือนที่กรอก', dataIndex: 'months_entered', align: 'center', width: 80 },
  ];

  const exportExcel = () => {
    if (!rangeReport) return;
    const head = ['ห้องตรวจ', ...items.map(i => i.name), 'ชม.ภาระงาน', 'วันทำงานปกติ', 'วันทำงาน OT', 'FTE (วัน)', 'FTE (คน)', 'จนท.มีจริง', '-ขาด/+เกิน (คน)', 'product'];
    const line = (name: string, r: GroupReport['total']) =>
      [name, ...r.qty, r.hours, r.staff.regular, r.staff.ot, r.fte_days, r.fte_persons ?? '', r.nurses ?? '', r.over_under ?? '', r.product ?? ''];
    const aoa = [
      [`FTE ${group} ${range[0].format('MM/YYYY')} - ${range[1].format('MM/YYYY')} · วันราชการ ${rangeReport.workdays} วัน`],
      [],
      head,
      ...rangeReport.rows.map(r => line(r.name, r)),
      line('รวม', rangeReport.total),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = head.map((_, i) => ({ wch: i === 0 ? 22 : 12 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, group);
    XLSX.writeFile(wb, `FTE_${group}_${range[0].format('YYYY-MM')}_${range[1].format('YYYY-MM')}.xlsx`);
  };

  const totalCells = (t: GroupReport['total'] | undefined, cols: 'entry' | 'summary') => t && (
    <Table.Summary fixed="bottom">
      <Table.Summary.Row style={{ backgroundColor: '#f6ffed', color: '#000000' }}>
        <Table.Summary.Cell index={0}><strong style={{ color: '#006b5f' }}>รวม</strong></Table.Summary.Cell>
        {t.qty.map((q, i) => <Table.Summary.Cell key={i} index={1 + i} align="center"><strong>{q.toLocaleString()}</strong></Table.Summary.Cell>)}
        {cols === 'entry' ? (
          <>
            <Table.Summary.Cell index={1 + t.qty.length} align="center">{num(t.staff.regular)}</Table.Summary.Cell>
            <Table.Summary.Cell index={2 + t.qty.length} align="center">{num(t.staff.ot)}</Table.Summary.Cell>
            <Table.Summary.Cell index={3 + t.qty.length} align="center">{num(t.nurses)}</Table.Summary.Cell>
            <Table.Summary.Cell index={4 + t.qty.length} align="center">{num(t.hours)}</Table.Summary.Cell>
            <Table.Summary.Cell index={5 + t.qty.length} align="center"><strong>{num(t.fte_days)}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={6 + t.qty.length} align="center"><DiffCell v={t.diff_days} /></Table.Summary.Cell>
            <Table.Summary.Cell index={7 + t.qty.length} align="center"><strong>{num(t.product)}</strong></Table.Summary.Cell>
          </>
        ) : (
          <>
            <Table.Summary.Cell index={1 + t.qty.length} align="center">{t.hours.toLocaleString()}</Table.Summary.Cell>
            <Table.Summary.Cell index={2 + t.qty.length} align="center">{num(t.staff.total)}</Table.Summary.Cell>
            <Table.Summary.Cell index={3 + t.qty.length} align="center"><strong>{num(t.fte_persons)}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={4 + t.qty.length} align="center">{num(t.nurses)}</Table.Summary.Cell>
            <Table.Summary.Cell index={5 + t.qty.length} align="center">{t.over_under === null ? '-' : <DiffCell v={t.over_under} />}</Table.Summary.Cell>
            <Table.Summary.Cell index={6 + t.qty.length} align="center"><strong>{num(t.product)}</strong></Table.Summary.Cell>
            <Table.Summary.Cell index={7 + t.qty.length} />
          </>
        )}
      </Table.Summary.Row>
    </Table.Summary>
  );

  const entryRows = monthReport?.rows ?? [];
  const sumRows = rangeReport?.rows ?? [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <Text type="secondary" className="text-xs">
          กรอกยอดของเดือน {month.format('MM/YYYY')} · วันทำงานกรอกเป็น คน × วัน (ครึ่งวันกรอก .5)
        </Text>
        <Button type="primary" onClick={save} loading={saving} disabled={dirtyIds.length === 0}>
          บันทึก{dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ''}
        </Button>
      </div>
      <Table<GroupRow>
        rowKey="work_unit_id"
        columns={entryColumns}
        dataSource={entryRows}
        bordered size="small" pagination={false}
        scroll={{ x: 'max-content' }}
        className={TABLE_CLASS}
        {...tableLoading(loading, entryRows)}
        summary={() => totalCells(monthReport?.total, 'entry')}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 mt-8 mb-2">
        <Title level={5} className="m-0!">สรุปตามช่วงเดือน</Title>
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker.RangePicker picker="month" format="MM/YYYY" allowClear={false} value={range}
            onChange={v => v?.[0] && v?.[1] && setRange([v[0], v[1]])} />
          <Button onClick={exportExcel} disabled={!rangeReport}
            style={{ backgroundColor: '#217346', borderColor: '#217346', color: '#fff' }}>ส่งออก Excel</Button>
        </div>
      </div>
      <Text type="secondary" className="text-xs block mb-2">
        product รวมคิดจาก ชั่วโมงภาระงานรวม ÷ ชั่วโมงทำงานรวม ไม่ใช่ค่าเฉลี่ยของแต่ละห้อง
        ห้องที่มีพยาบาลมากจึงมีน้ำหนักมากตามจริง · วันราชการในช่วง {rangeReport?.workdays ?? '-'} วัน
      </Text>
      <Table<GroupRow>
        rowKey="work_unit_id"
        columns={summaryColumns}
        dataSource={sumRows}
        bordered size="small" pagination={false}
        scroll={{ x: 'max-content' }}
        className={TABLE_CLASS}
        {...tableLoading(rangeLoading, sumRows)}
        summary={() => totalCells(rangeReport?.total, 'summary')}
      />
    </>
  );
}

/* ───────────────────────── หน้า ───────────────────────── */

export default function WorkProductPage() {
  const [units, setUnits] = useState<WorkUnit[]>([]);
  const [selected, setSelected] = useState<string>();
  const [month, setMonth] = useState<Dayjs>(dayjs());

  useEffect(() => {
    axios.get('/api/v1/work-units/', { headers: authHeaders() })
      .then(res => {
        const list: WorkUnit[] = res.data?.data ?? [];
        setUnits(list);
        const first = list.find(u => u.period === 'shift');
        if (first) setSelected(`unit:${first.work_unit_id}`);
      })
      .catch(e => Swal.fire({ icon: 'error', title: 'โหลดรายชื่อหน่วยงานไม่สำเร็จ', text: errorText(e, ''), confirmButtonColor: '#006b5f' }));
  }, []);

  // หน่วยรายเดือนเลือกเป็นกลุ่ม (ห้องตรวจทุกห้องของ OPD อยู่หน้าเดียว) ไม่ได้เลือกทีละห้อง
  const options = useMemo(() => {
    const single = units.filter(u => u.period === 'shift').map(u => ({ value: `unit:${u.work_unit_id}`, label: u.name }));
    const groups = [...new Set(units.filter(u => u.period === 'month' && u.group).map(u => u.group!))]
      .map(g => ({ value: `group:${g}`, label: `${g} (ห้องตรวจทั้งหมด)` }));
    return [...single, ...groups];
  }, [units]);

  const [kind, ref] = (selected ?? ':').split(':');
  const unit = kind === 'unit' ? units.find(u => u.work_unit_id === Number(ref)) : undefined;
  const groupUnits = kind === 'group' ? units.filter(u => u.group === ref) : [];

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 md:p-6 max-w-full mx-auto">
        <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-3">
            <div>
              <Title level={4} className="text-(--brand-text)! m-0!">FTE และ product หน่วยงาน</Title>
              <Text type="secondary" className="text-xs">
                หน่วยงานที่คิดภาระงานจากยอดบริการ (ER · ห้องผ่าตัด · วิสัญญี · ห้องคลอด · OPD) — หอผู้ป่วยในดูที่หน้า FTE
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select className="w-64" value={selected} onChange={setSelected} options={options}
                placeholder="กำลังโหลด..." showSearch optionFilterProp="label" />
              <DatePicker picker="month" format="MM/YYYY" allowClear={false} value={month}
                onChange={d => setMonth(d ?? dayjs())} />
            </div>
          </div>

          {unit && <ShiftUnitView key={`${unit.work_unit_id}-${month.format('YYYY-MM')}`} unit={unit} month={month} />}
          {kind === 'group' && groupUnits.length > 0 && <GroupView key={ref} group={ref} units={groupUnits} month={month} />}
        </Card>
      </div>
    </div>
  );
}
