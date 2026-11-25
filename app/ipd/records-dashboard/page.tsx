'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, DatePicker, Select, Table, Typography } from 'antd';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import Navbar from '../../components/Navbar';
import { DashboardSkeleton } from '@/app/components/Skeletons';
import { useThemeMode } from '../../lib/theme';
import { STATUS, Kpi, Section, useChart, baseText, grid, nf, type Status } from '../../lib/dashboardKit';

/*
  วิเคราะห์บันทึกทางการพยาบาลเชิงลึก หลายหอ ตามช่วงวันที่

  ตัวเลขทุกตัวคิดที่เซิร์ฟเวอร์ (recordsAnalyticsController) หน้านี้แค่วาด
  ใช้เฉพาะข้อมูลที่บันทึกในระบบนี้จริง: สัญญาณชีพ/NEWS2, บันทึกทางการพยาบาล, แผนการพยาบาล,
  Focus list, บันทึกรับผู้ป่วย และแบบประเมินความปวด
*/

const { Title, Text } = Typography;

type KV = { key: string; n: number };
type Coded = { code: string; label: string; n: number; patients?: number };

interface Analytics {
  thresholds: { late_entry_minutes: number; news2_escalate: number; vital_gap_hours: number };
  vitals: {
    n: number; patients: number; incomplete: number;
    risk: { low: number; medium: number; high: number };
    patients_escalate: number;
    abnormal: Record<'spo2_low' | 'sbp_low' | 'fever' | 'pulse_extreme' | 'resp_extreme' | 'not_alert', number>;
    from_monitor: number; from_monitor_rate: number | null;
    late: number; late_rate: number | null; late_with_reason: number; median_entry_delay_min: number | null;
    escalate: number; rechecked_1h: number; rechecked_1h_rate: number | null;
    gaps: number; median_interval_h: number | null;
    by_shift: { shift: string; n: number; elevated: number }[];
    daily: { date: string; n: number; medium: number; high: number }[];
  };
  notes: {
    n: number; patients: number; with_nanda: number; nanda_rate: number | null;
    with_nic: number; with_noc: number; noc_rate: number | null;
    linked_plan: number; linked_plan_rate: number | null;
    drafts: number; by_trainee: number; median_cosign_h: number | null;
    late: number; late_rate: number | null;
    by_type: KV[]; by_shift: KV[]; by_role: KV[];
    top_nanda: Coded[]; top_nic: Coded[]; top_noc: Coded[];
  };
  care_plans: { n: number; active: number; resolved: number; overdue_eval: number; with_nanda: number };
  focus: {
    n: number; patients: number; draft: number; final: number; cancelled: number;
    completion_rate: number | null; median_complete_h: number | null; stale_draft: number; late: number;
    top_templates: { code: string; label: string; n: number; final: number; cancelled: number }[];
    cancel_reasons: KV[];
  };
  admit: {
    n: number; reviewed: number; reviewed_rate: number | null; mean_expected_los: number | null;
    fall_risk: number; fall_risk_rate: number | null;
    pressure_risk: number; pressure_risk_rate: number | null;
    nutrition_risk: number; nutrition_risk_rate: number | null;
    readmit: number; readmit_rate: number | null;
    screened_all: number; screened_all_rate: number | null;
    dist: Record<string, KV[]>;
  };
  pain: {
    n: number; mean_score: number | null; severe: number; needs_reassess: number; reassessed: number;
    reassessed_rate: number | null; mean_reduction: number | null;
  };
  by_ward: {
    ward_code: string; ward_name: string; vitals: number; news2_high: number; notes: number; note_drafts: number;
    focus: number; focus_drafts: number; admits: number; pain: number;
  }[];
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${v}%`);
const statusOf = (v: number | null, good: number, warn: number): Status | null =>
  v === null ? null : v >= good ? STATUS.good : v >= warn ? STATUS.warning : STATUS.critical;
/** ตัวเลขที่ยิ่งน้อยยิ่งดี (ลงย้อนหลัง ช่องว่างการวัด) */
const lowIsGood = (v: number | null, good: number, warn: number): Status | null =>
  v === null ? null : v <= good ? STATUS.good : v <= warn ? STATUS.warning : STATUS.critical;

/* คำแปลค่าที่เก็บในฐาน (ค่าเดียวกับตัวเลือกในฟอร์มรับผู้ป่วย) */
const VALUE_LABEL: Record<string, string> = {
  walk: 'เดินมาเอง', wheelchair: 'Wheelchair', stretcher: 'Stretcher', ambulance: 'รถพยาบาล',
  alert: 'Alert', drowsy: 'Drowsy', stupor: 'Stupor', coma: 'Coma',
  low: 'ต่ำ', moderate: 'ปานกลาง', high: 'สูง',
  normal: 'ปกติ', risk: 'เสี่ยง', malnutrition: 'ขาดสารอาหาร',
  independent: 'ช่วยเหลือตนเองได้', partial: 'ช่วยบางส่วน', dependent: 'พึ่งพาทั้งหมด',
  yes: 'ใช่/มี', no: 'ไม่ใช่/ไม่มี',
  professional_nurse: 'พยาบาลวิชาชีพ', practical_nurse: 'พยาบาลเทคนิค', assistant: 'ผู้ช่วยพยาบาล', other: 'ตำแหน่งอื่น',
};
const label = (k: string) => VALUE_LABEL[k] ?? k;
const ADMIT_FIELD_LABEL: Record<string, string> = {
  admit_method: 'วิธีการมา', consciousness: 'ความรู้สึกตัว', fall_risk_screen: 'คัดกรองพลัดตกหกล้ม',
  pressure_sore_screen: 'คัดกรองแผลกดทับ', nutrition_screening: 'คัดกรองโภชนาการ', adl_level: 'ADL',
  readmit_28_days: 'Readmit ใน 28 วัน', isolation_precaution: 'Isolation', emotional_state: 'อารมณ์', breathing: 'การหายใจ',
};
const ABNORMAL_LABEL: Record<string, string> = {
  spo2_low: 'SpO₂ < 92%', sbp_low: 'SBP < 90 mmHg', fever: 'อุณหภูมิ ≥ 38 °C',
  pulse_extreme: 'ชีพจร < 40 หรือ > 130', resp_extreme: 'หายใจ ≤ 8 หรือ ≥ 25', not_alert: 'AVPU ไม่ใช่ Alert',
};

/*
  NEWS2 เป็น "ระดับความเสี่ยง" ไม่ใช่ชุดสีของข้อมูล จึงใช้ชุดสถานะ ต่ำ/ปานกลาง/สูง
  พร้อมคำใน legend และ tooltip เสมอ
*/
const RISK_SERIES = [
  { key: 'low', label: 'NEWS2 ต่ำ (0–4)', light: '#0ca30c', dark: '#3fb950' },
  { key: 'medium', label: 'ปานกลาง (5–6)', light: '#c98500', dark: '#d29922' },
  { key: 'high', label: 'สูง (≥ 7)', light: '#d03b3b', dark: '#f85149' },
] as const;

function News2Daily({ rows, dark }: { rows: Analytics['vitals']['daily']; dark: boolean }) {
  const surface = dark ? '#1f1f1f' : '#ffffff';
  const labels = rows.map(r => dayjs(r.date).format('D/M'));
  const valueOf = (r: Analytics['vitals']['daily'][number], k: string) =>
    k === 'low' ? r.n - r.medium - r.high : k === 'medium' ? r.medium : r.high;
  const ref = useChart({
    textStyle: baseText(dark),
    grid: { left: 40, right: 16, top: 36, bottom: 40 },
    legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 12, data: RISK_SERIES.map(s => s.label) },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps: unknown) => {
        const i = (ps as { dataIndex: number }[])[0]?.dataIndex ?? 0;
        const r = rows[i];
        if (!r) return '';
        return `<b>${labels[i]}</b><br/>วัดทั้งหมด ${r.n} ครั้ง<br/>`
          + RISK_SERIES.map(s => `${s.label}: ${valueOf(r, s.key)}`).join('<br/>');
      },
    },
    xAxis: { type: 'category', data: labels, axisTick: { show: false }, axisLine: { lineStyle: { color: dark ? '#434343' : '#d9d8d4' } } },
    yAxis: { type: 'value', minInterval: 1, splitLine: grid(dark), name: 'ครั้ง', nameTextStyle: { align: 'right' } },
    series: RISK_SERIES.map((s, i) => ({
      name: s.label, type: 'bar', stack: 'n', barMaxWidth: 24,
      data: rows.map(r => valueOf(r, s.key)),
      itemStyle: {
        color: dark ? s.dark : s.light, borderColor: surface, borderWidth: 1,
        borderRadius: i === RISK_SERIES.length - 1 ? [4, 4, 0, 0] : 0,
      },
      emphasis: { focus: 'series' },
    })),
  }, [rows, dark]);
  return <div ref={ref} style={{ height: 280 }} />;
}

/** ตารางสัดส่วนสั้น ๆ: ค่า · จำนวน · % พร้อมแถบเล็กให้กวาดตาเทียบได้ */
function ShareTable({ rows, total, render = label }: { rows: KV[]; total: number; render?: (k: string) => string }) {
  if (rows.length === 0) return <div className="text-xs text-gray-500 py-2">ไม่มีข้อมูล</div>;
  return (
    <div className="flex flex-col gap-1">
      {rows.map(r => {
        const share = total > 0 ? Math.round((r.n / total) * 100) : 0;
        return (
          <div key={r.key} className="grid grid-cols-[1fr_auto_3rem] items-center gap-2 text-xs">
            <div className="min-w-0">
              <div className="truncate">{render(r.key)}</div>
              <div className="h-1.5 rounded-full bg-gray-100 mt-0.5">
                <div className="h-1.5 rounded-full bg-(--brand-text)" style={{ width: `${share}%` }} />
              </div>
            </div>
            <span className="tabular-nums text-right">{nf.format(r.n)}</span>
            <span className="tabular-nums text-right text-gray-500">{share}%</span>
          </div>
        );
      })}
    </div>
  );
}

function CodedTable({ rows, showPatients = false }: { rows: Coded[]; showPatients?: boolean }) {
  return (
    <Table rowKey="code" size="small" pagination={false} dataSource={rows} locale={{ emptyText: 'ยังไม่มีการลงรหัส' }}
      columns={[
        { title: 'รหัส', dataIndex: 'code', width: 70, render: v => <span className="tabular-nums">{v}</span> },
        { title: 'ชื่อ', dataIndex: 'label' },
        { title: 'ครั้ง', dataIndex: 'n', align: 'right', width: 60 },
        ...(showPatients ? [{ title: 'ผู้ป่วย', dataIndex: 'patients', align: 'right' as const, width: 70 }] : []),
      ]} />
  );
}

export default function RecordsDashboardPage() {
  const { resolved } = useThemeMode();
  const dark = resolved === 'dark';
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()]);
  const [wards, setWards] = useState<{ his_code: string; ward_name: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = () => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    axios.get('/api/v1/system/wardsV1', { headers: headers() })
      .then(r => setWards(Array.isArray(r.data) ? r.data : r.data?.data ?? []))
      .catch(() => setWards([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/v1/nursing-records/analytics', {
        date_from: range[0].format('YYYY-MM-DD'), date_to: range[1].format('YYYY-MM-DD'), wards: selected,
      }, { headers: headers() });
      setData(res.data.data);
      setError(null);
    } catch (e) {
      setData(null);
      setError((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [range, selected]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- โหลดรายงานใหม่เมื่อเปลี่ยนช่วงวันหรือหอ (แบบเดียวกับหน้า MAR)
  useEffect(() => { load(); }, [load]);

  const empty = useMemo(() => !!data && data.vitals.n + data.notes.n + data.focus.n + data.admit.n + data.pain.n + data.care_plans.n === 0, [data]);

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const sheet = (name: string, rows: Record<string, unknown>[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name);
    const v = data.vitals;
    sheet('สรุป', [
      { 'ตัวชี้วัด': 'สัญญาณชีพ (ครั้ง)', 'ค่า': v.n },
      { 'ตัวชี้วัด': `NEWS2 ≥ ${data.thresholds.news2_escalate} วัดซ้ำภายใน 1 ชม. (%)`, 'ค่า': v.rechecked_1h_rate },
      { 'ตัวชี้วัด': `ช่องว่างการวัด > ${data.thresholds.vital_gap_hours} ชม. (ครั้ง)`, 'ค่า': v.gaps },
      { 'ตัวชี้วัด': `สัญญาณชีพลงย้อนหลัง > ${data.thresholds.late_entry_minutes} นาที (%)`, 'ค่า': v.late_rate },
      { 'ตัวชี้วัด': 'Progress notes มีรหัส NANDA (%)', 'ค่า': data.notes.nanda_rate },
      { 'ตัวชี้วัด': 'Progress notes เชื่อมแผนการพยาบาล (%)', 'ค่า': data.notes.linked_plan_rate },
      { 'ตัวชี้วัด': 'Focus list ปิดครบ (%)', 'ค่า': data.focus.completion_rate },
      { 'ตัวชี้วัด': 'รับผู้ป่วย คัดกรองครบ 4 ด้าน (%)', 'ค่า': data.admit.screened_all_rate },
      { 'ตัวชี้วัด': 'ปวด ≥ 4 ประเมินซ้ำ (%)', 'ค่า': data.pain.reassessed_rate },
    ]);
    sheet('NEWS2 รายวัน', v.daily.map(d => ({ 'วันที่': d.date, 'ทั้งหมด': d.n, 'ปานกลาง': d.medium, 'สูง': d.high })));
    sheet('NANDA', data.notes.top_nanda.map(r => ({ 'รหัส': r.code, 'ข้อวินิจฉัย': r.label, 'ครั้ง': r.n, 'ผู้ป่วย': r.patients })));
    sheet('NIC', data.notes.top_nic.map(r => ({ 'รหัส': r.code, 'กิจกรรม': r.label, 'ครั้ง': r.n })));
    sheet('NOC', data.notes.top_noc.map(r => ({ 'รหัส': r.code, 'ผลลัพธ์': r.label, 'ครั้ง': r.n })));
    sheet('Focus', data.focus.top_templates.map(r => ({ 'แม่แบบ': r.label, 'ใบ': r.n, 'ปิดแล้ว': r.final, 'ยกเลิก': r.cancelled })));
    sheet('คัดกรองแรกรับ', Object.entries(data.admit.dist).flatMap(([f, rows]) =>
      rows.map(r => ({ 'หัวข้อ': ADMIT_FIELD_LABEL[f] ?? f, 'ค่า': label(r.key), 'จำนวน': r.n }))));
    sheet('รายหอ', data.by_ward.map(r => ({
      'หอ': r.ward_name, 'สัญญาณชีพ': r.vitals, 'NEWS2 สูง': r.news2_high, 'Progress notes': r.notes, 'ร่างรออนุมัติ': r.note_drafts,
      'Focus': r.focus, 'Focus ค้าง': r.focus_drafts, 'รับผู้ป่วย': r.admits, 'ประเมินปวด': r.pain,
    })));
    XLSX.writeFile(wb, `NursingRecords_${range[0].format('YYYYMMDD')}_${range[1].format('YYYYMMDD')}.xlsx`);
  };

  const v = data?.vitals;
  const t = data?.thresholds;

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <Title level={4} className="m-0! text-(--brand-text)!">วิเคราะห์บันทึกทางการพยาบาล</Title>
            <Text type="secondary" className="text-xs">
              สัญญาณชีพ/NEWS2 · บันทึกทางการพยาบาล (NANDA/NIC/NOC) · แผนการพยาบาลและ Focus list · คัดกรองแรกรับ · ความปวด
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select mode="multiple" allowClear placeholder="ทุกหอ" className="min-w-56" maxTagCount="responsive"
              value={selected} onChange={setSelected} optionFilterProp="label"
              options={wards.map(w => ({ value: w.his_code, label: w.ward_name }))} />
            <DatePicker.RangePicker value={range} format="DD/MM/YYYY" allowClear={false}
              disabledDate={d => d.isAfter(dayjs(), 'day')}
              onChange={r => r?.[0] && r?.[1] && setRange([r[0], r[1]])} />
            <Button onClick={exportExcel} disabled={!data} style={{ backgroundColor: '#217346', borderColor: '#217346', color: '#fff' }}>ส่งออก Excel</Button>
          </div>
        </div>

        <Alert type="info" showIcon
          title="รายงานนี้นับเฉพาะแบบฟอร์มที่บันทึกลงระบบได้แล้ว"
          description="แบบประเมิน GCS, Braden, Fall Risk, สุขภาพจิต, ทำแผล, ผูกยึด, I/O, ดูแลพิเศษ, ให้ความรู้, ส่งเวร และจำหน่าย ยังไม่มีที่เก็บข้อมูลฝั่งเซิร์ฟเวอร์ จึงยังไม่อยู่ในรายงาน" />

        {error && <Alert type="error" showIcon title="โหลดข้อมูลไม่สำเร็จ" description={error} />}
        {loading && !data ? <DashboardSkeleton kpis={8} charts={2} /> : data && v && t && (
          <>
            {empty && (
              <Alert type="info" showIcon title="ยังไม่มีบันทึกในช่วงนี้" description="ลองขยายช่วงวันที่ หรือเลือกหอที่เริ่มใช้แบบบันทึกในระบบแล้ว" />
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label={`NEWS2 ≥ ${t.news2_escalate} วัดซ้ำใน 1 ชม.`} value={pct(v.rechecked_1h_rate)} status={statusOf(v.rechecked_1h_rate, 90, 70)}
                sub={`${nf.format(v.rechecked_1h)} จาก ${nf.format(v.escalate)} ครั้ง · ผู้ป่วย ${nf.format(v.patients_escalate)} ราย`}
                hint="ครั้งที่ NEWS2 ถึงเกณฑ์ ที่มีการวัดซ้ำของผู้ป่วยคนเดิมภายใน 60 นาที" />
              <Kpi label={`ขาดการวัดเกิน ${t.vital_gap_hours} ชม.`} value={nf.format(v.gaps)}
                status={v.n === 0 ? null : v.gaps === 0 ? STATUS.good : STATUS.warning}
                sub={v.median_interval_h === null ? 'ครั้ง' : `ครั้ง · ระยะห่างกลาง ${v.median_interval_h} ชม.`}
                hint="ช่วงระหว่างการวัดสองครั้งติดกันของผู้ป่วยคนเดิมที่ห่างเกินหนึ่งเวร" />
              <Kpi label="สัญญาณชีพลงย้อนหลัง" value={pct(v.late_rate)} status={lowIsGood(v.late_rate, 10, 25)}
                sub={`${nf.format(v.late)} ครั้ง (มีเหตุผล ${nf.format(v.late_with_reason)}) · จาก monitor ${pct(v.from_monitor_rate)}`}
                hint={`บันทึกเข้าระบบช้ากว่าเวลาที่วัดจริงเกิน ${t.late_entry_minutes} นาที`} />
              <Kpi label="Progress notes มีรหัส NANDA" value={pct(data.notes.nanda_rate)} status={statusOf(data.notes.nanda_rate, 80, 50)}
                sub={`${nf.format(data.notes.with_nanda)} จาก ${nf.format(data.notes.n)} บันทึก · NOC ${pct(data.notes.noc_rate)}`}
                hint="บันทึกที่ระบุข้อวินิจฉัยทางการพยาบาลมาตรฐาน ใช้วิเคราะห์ปัญหาที่พบบ่อยได้" />
              <Kpi label="Notes เชื่อมแผนการพยาบาล" value={pct(data.notes.linked_plan_rate)} status={statusOf(data.notes.linked_plan_rate, 70, 40)}
                sub={`ร่างรออนุมัติ ${nf.format(data.notes.drafts)} · อนุมัติใช้เวลา ~${data.notes.median_cosign_h ?? '–'} ชม.`} />
              <Kpi label="Focus list ปิดครบ" value={pct(data.focus.completion_rate)} status={statusOf(data.focus.completion_rate, 80, 50)}
                sub={`ร่างค้างเกิน 24 ชม. ${nf.format(data.focus.stale_draft)} ใบ · ปิดใช้เวลา ~${data.focus.median_complete_h ?? '–'} ชม.`}
                hint="ใบที่ปิด (final) ÷ ใบทั้งหมดที่ไม่ถูกยกเลิก" />
              <Kpi label="รับผู้ป่วย คัดกรองครบ 4 ด้าน" value={pct(data.admit.screened_all_rate)} status={statusOf(data.admit.screened_all_rate, 95, 80)}
                sub={`${nf.format(data.admit.screened_all)} จาก ${nf.format(data.admit.n)} ราย`}
                hint="พลัดตกหกล้ม แผลกดทับ โภชนาการ และ ADL ระบุครบทั้งสี่ช่อง" />
              <Kpi label="ปวด ≥ 4 ประเมินซ้ำ" value={pct(data.pain.reassessed_rate)} status={statusOf(data.pain.reassessed_rate, 90, 70)}
                sub={`${nf.format(data.pain.reassessed)} จาก ${nf.format(data.pain.needs_reassess)} ครั้ง · ลดเฉลี่ย ${data.pain.mean_reduction ?? '–'}`} />
            </div>

            <Section title="ระดับ NEWS2 รายวัน" hint="แต่ละแท่งคือจำนวนครั้งที่วัดในวันนั้น แยกตามระดับความเสี่ยง">
              {v.daily.length === 0
                ? <div className="text-sm text-gray-500 py-8 text-center">ไม่มีการวัดสัญญาณชีพในช่วงนี้</div>
                : <News2Daily rows={v.daily} dark={dark} />}
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Section title="ค่าผิดปกติที่พบ" hint="จำนวนครั้งที่วัดได้ค่าเข้าเกณฑ์">
                <ShareTable total={v.n} render={k => ABNORMAL_LABEL[k] ?? k}
                  rows={Object.entries(v.abnormal).map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n)} />
                <div className="text-xs text-gray-500 mt-2">คิดไม่ได้ (กรอกไม่ครบ 7 ตัว) {nf.format(v.incomplete)} ครั้ง</div>
              </Section>
              <Section title="สัญญาณชีพตามเวร">
                <Table rowKey="shift" size="small" pagination={false} dataSource={v.by_shift}
                  columns={[
                    { title: 'เวร', dataIndex: 'shift' },
                    { title: 'ครั้ง', dataIndex: 'n', align: 'right' },
                    { title: 'NEWS2 ≥ 5', dataIndex: 'elevated', align: 'right' },
                  ]} />
              </Section>
              <Section title="ความปวด">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>ประเมิน <b className="tabular-nums">{nf.format(data.pain.n)}</b> ครั้ง</div>
                  <div>คะแนนเฉลี่ย <b className="tabular-nums">{data.pain.mean_score ?? '–'}</b></div>
                  <div>ปวดมาก (≥ 7) <b className="tabular-nums">{nf.format(data.pain.severe)}</b></div>
                  <div>ต้องประเมินซ้ำ <b className="tabular-nums">{nf.format(data.pain.needs_reassess)}</b></div>
                </div>
              </Section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Section title="ข้อวินิจฉัยที่พบบ่อย (NANDA-I)" hint="จากบันทึกทางการพยาบาลที่ลงรหัส">
                <CodedTable rows={data.notes.top_nanda} showPatients />
              </Section>
              <Section title="กิจกรรมการพยาบาล (NIC)">
                <CodedTable rows={data.notes.top_nic} />
              </Section>
              <Section title="ผลลัพธ์ที่ติดตาม (NOC)">
                <CodedTable rows={data.notes.top_noc} />
              </Section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Section title="รูปแบบการบันทึก">
                <ShareTable rows={data.notes.by_type} total={data.notes.n} />
              </Section>
              <Section title="บันทึกตามเวร">
                <ShareTable rows={data.notes.by_shift} total={data.notes.n} />
              </Section>
              <Section title="ผู้บันทึก" hint={`นักศึกษากรอก ${nf.format(data.notes.by_trainee)} บันทึก`}>
                <ShareTable rows={data.notes.by_role} total={data.notes.n} />
              </Section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="Focus list ตามแม่แบบ" hint={`ทั้งหมด ${nf.format(data.focus.n)} ใบ · ผู้ป่วย ${nf.format(data.focus.patients)} ราย`}>
                <Table rowKey="code" size="small" pagination={false} dataSource={data.focus.top_templates} locale={{ emptyText: 'ไม่มี' }}
                  columns={[
                    { title: 'แม่แบบ', dataIndex: 'label' },
                    { title: 'ใบ', dataIndex: 'n', align: 'right', width: 60 },
                    { title: 'ปิดแล้ว', dataIndex: 'final', align: 'right', width: 70 },
                    { title: 'ยกเลิก', dataIndex: 'cancelled', align: 'right', width: 70 },
                  ]} />
              </Section>
              <Section title="แผนการพยาบาล">
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>ทั้งหมด <b className="tabular-nums">{nf.format(data.care_plans.n)}</b></div>
                  <div>กำลังดำเนินการ <b className="tabular-nums">{nf.format(data.care_plans.active)}</b></div>
                  <div>แก้ไขได้แล้ว <b className="tabular-nums">{nf.format(data.care_plans.resolved)}</b></div>
                  <div className={data.care_plans.overdue_eval ? 'text-red-600' : ''}>
                    เลยกำหนดประเมินผล <b className="tabular-nums">{nf.format(data.care_plans.overdue_eval)}</b>
                  </div>
                </div>
                <div className="font-semibold text-sm mb-1">เหตุผลที่ยกเลิก Focus</div>
                <ShareTable rows={data.focus.cancel_reasons} total={data.focus.cancelled} render={k => k} />
              </Section>
            </div>

            <Section title="คัดกรองแรกรับ"
              hint={`รับผู้ป่วย ${nf.format(data.admit.n)} ราย · เสี่ยงพลัดตก ${pct(data.admit.fall_risk_rate)} · เสี่ยงแผลกดทับ ${pct(data.admit.pressure_risk_rate)} · เสี่ยงโภชนาการ ${pct(data.admit.nutrition_risk_rate)} · readmit ${pct(data.admit.readmit_rate)}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {Object.entries(data.admit.dist).map(([f, rows]) => (
                  <div key={f}>
                    <div className="font-semibold text-xs mb-1.5">{ADMIT_FIELD_LABEL[f] ?? f}</div>
                    <ShareTable rows={rows} total={data.admit.n} />
                  </div>
                ))}
              </div>
            </Section>

            <Section title="รายหอผู้ป่วย">
              <Table rowKey="ward_code" size="small" pagination={false} dataSource={data.by_ward} scroll={{ x: 'max-content' }}
                locale={{ emptyText: 'ไม่มี' }}
                columns={[
                  { title: 'หอ', dataIndex: 'ward_name', fixed: 'left' },
                  { title: 'สัญญาณชีพ', dataIndex: 'vitals', align: 'right' },
                  { title: 'NEWS2 สูง', dataIndex: 'news2_high', align: 'right', render: (n: number) => <span className={n ? 'text-red-600 font-semibold' : ''}>{nf.format(n)}</span> },
                  { title: 'Progress notes', dataIndex: 'notes', align: 'right' },
                  { title: 'ร่างรออนุมัติ', dataIndex: 'note_drafts', align: 'right' },
                  { title: 'Focus', dataIndex: 'focus', align: 'right' },
                  { title: 'Focus ค้าง', dataIndex: 'focus_drafts', align: 'right' },
                  { title: 'รับผู้ป่วย', dataIndex: 'admits', align: 'right' },
                  { title: 'ประเมินปวด', dataIndex: 'pain', align: 'right' },
                ]} />
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
