'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, DatePicker, Select, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import * as XLSX from 'xlsx';
import Navbar from '../../components/Navbar';
import { DashboardSkeleton } from '@/app/components/Skeletons';
import { useThemeMode } from '../../lib/theme';
import { STATUS, Kpi, Section, useChart, baseText, grid, nf, type Status } from '../../lib/dashboardKit';
import { CLASS_LABEL, REASON_LABEL, STATUS_LABEL } from '../../lib/mar';

/*
  วิเคราะห์การบริหารยา (MAR) หลายหอ ตามช่วงวันที่

  ตัวเลขทุกตัวคิดที่เซิร์ฟเวอร์ (marController.getMarAnalytics) หน้านี้แค่วาด
  นับเฉพาะมื้อที่เลยช่วงเวลาให้ยาไปแล้ว — มื้อที่ยังไม่ถึงหรือยังอยู่ในช่วงไม่นับเป็นขาด
*/

const { Title, Text } = Typography;

interface Bucket {
  due: number; on_time: number; late: number; early: number; not_given: number; missed: number; given: number;
  on_time_rate: number | null; documented_rate: number | null; missed_rate: number | null;
}
interface Analytics {
  windows: { standard_minutes: number; time_critical_minutes: number };
  scheduled: Bucket & { median_late_minutes: number | null; p90_late_minutes: number | null };
  high_alert: { given: number; double_checked: number; rate: number | null };
  given_on_unverified_order: number;
  prn: {
    given: number; with_pre_score: number; reassessed: number; reassessed_rate: number | null;
    reassessed_within_1h: number; mean_reduction: number | null; effective: number; interval_violations: number;
  };
  adverse_reactions: number;
  orders: { created: number; verified: number; verified_rate: number | null; median_verify_minutes: number | null; high_alert: number; pending_verification_now: number };
  not_given_reasons: { reason_code: string; status: string; count: number }[];
  by_ward: (Bucket & { ward_code: string; ward_name: string })[];
  by_shift: (Bucket & { shift: string })[];
  by_drug_class: (Bucket & { drug_class: string })[];
  by_hour: (Bucket & { hour: number })[];
  daily: (Bucket & { date: string })[];
  top_missed_drugs: { medication_name: string; count: number }[];
}

/*
  สีเป็น "สถานะ" ของมื้อ ไม่ใช่ชุดสีของข้อมูล จึงใช้ชุดสถานะดี/เตือน/วิกฤต + เทากลาง
  มาพร้อมคำใน legend และ tooltip เสมอ ไม่มีที่ไหนสื่อด้วยสีอย่างเดียว
*/
const STATE_SERIES = [
  { key: 'on_time', label: 'ตรงเวลา', light: '#0ca30c', dark: '#3fb950' },
  { key: 'late', label: 'ช้า/เร็วเกินช่วง', light: '#c98500', dark: '#d29922' },
  { key: 'not_given', label: 'ไม่ได้ให้ (มีเหตุผล)', light: '#a3a29d', dark: '#6e6d68' },
  { key: 'missed', label: 'ไม่มีบันทึก', light: '#d03b3b', dark: '#f85149' },
] as const;

const valueOf = (b: Bucket, key: (typeof STATE_SERIES)[number]['key']) => (key === 'late' ? b.late + b.early : b[key]);
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${v}%`);

/** เกณฑ์เบื้องต้นสำหรับป้ายสถานะ — ปรับได้ที่นี่ที่เดียว */
const statusOf = (v: number | null, good: number, warn: number): Status | null =>
  v === null ? null : v >= good ? STATUS.good : v >= warn ? STATUS.warning : STATUS.critical;

function StackedBars({ rows, labels, dark, height = 300 }: {
  rows: Bucket[]; labels: string[]; dark: boolean; height?: number;
}) {
  const surface = dark ? '#1f1f1f' : '#ffffff';
  const ref = useChart({
    textStyle: baseText(dark),
    grid: { left: 40, right: 16, top: 36, bottom: 40 },
    /* legend ชิดขวา ฝั่งซ้ายบนเป็นที่ของชื่อแกน "มื้อ" */
    legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 12, data: STATE_SERIES.map(s => s.label) },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps: unknown) => {
        const i = (ps as { dataIndex: number }[])[0]?.dataIndex ?? 0;
        const b = rows[i];
        if (!b) return '';
        return `<b>${labels[i]}</b><br/>มื้อที่ถึงกำหนด ${b.due}<br/>`
          + STATE_SERIES.map(s => `${s.label}: ${valueOf(b, s.key)}`).join('<br/>')
          + `<br/>ตรงเวลา ${pct(b.on_time_rate)} ของมื้อที่ให้`;
      },
    },
    xAxis: { type: 'category', data: labels, axisTick: { show: false }, axisLine: { lineStyle: { color: dark ? '#434343' : '#d9d8d4' } } },
    yAxis: { type: 'value', minInterval: 1, splitLine: grid(dark), name: 'มื้อ', nameTextStyle: { align: 'right' } },
    series: STATE_SERIES.map((s, i) => ({
      name: s.label, type: 'bar', stack: 'n', barMaxWidth: 24,
      data: rows.map(b => valueOf(b, s.key)),
      itemStyle: {
        color: dark ? s.dark : s.light, borderColor: surface, borderWidth: 1,
        borderRadius: i === STATE_SERIES.length - 1 ? [4, 4, 0, 0] : 0,
      },
      emphasis: { focus: 'series' },
    })),
  }, [rows, labels, dark]);
  return <div ref={ref} style={{ height }} />;
}

const bucketColumns = <T extends Bucket>(first: ColumnsType<T>[number]): ColumnsType<T> => [
  first,
  { title: 'มื้อที่ถึงกำหนด', dataIndex: 'due', align: 'right', width: 100, render: v => nf.format(v) },
  { title: 'ตรงเวลา', dataIndex: 'on_time_rate', align: 'right', width: 90, render: v => pct(v) },
  { title: 'ช้า/เร็ว', key: 'late', align: 'right', width: 80, render: (_, b) => nf.format(b.late + b.early) },
  { title: 'ไม่ได้ให้', dataIndex: 'not_given', align: 'right', width: 80, render: v => nf.format(v) },
  { title: 'ไม่มีบันทึก', dataIndex: 'missed', align: 'right', width: 90, render: (v: number) => <span className={v ? 'text-red-600 font-semibold' : ''}>{nf.format(v)}</span> },
  { title: 'บันทึกครบ', dataIndex: 'documented_rate', align: 'right', width: 90, render: v => pct(v) },
];

export default function MarDashboardPage() {
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
      const res = await axios.post('/api/v1/nursing-records/mar/analytics', {
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

  useEffect(() => { load(); }, [load]);

  const s = data?.scheduled;
  const dailyLabels = useMemo(() => (data?.daily ?? []).map(d => dayjs(d.date).format('D/M')), [data]);
  const hourLabels = useMemo(() => (data?.by_hour ?? []).map(h => `${String(h.hour).padStart(2, '0')}:00`), [data]);

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const sheet = (name: string, rows: Record<string, unknown>[]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
    const flat = (b: Bucket) => ({
      'มื้อที่ถึงกำหนด': b.due, 'ตรงเวลา': b.on_time, 'ช้า': b.late, 'เร็ว': b.early, 'ไม่ได้ให้': b.not_given,
      'ไม่มีบันทึก': b.missed, 'อัตราตรงเวลา %': b.on_time_rate, 'บันทึกครบ %': b.documented_rate,
    });
    sheet('รายวัน', data.daily.map(d => ({ 'วันที่': d.date, ...flat(d) })));
    sheet('รายหอ', data.by_ward.map(d => ({ 'หอ': d.ward_name, ...flat(d) })));
    sheet('รายเวร', data.by_shift.map(d => ({ 'เวร': d.shift, ...flat(d) })));
    sheet('กลุ่มยา', data.by_drug_class.map(d => ({ 'กลุ่มยา': CLASS_LABEL[d.drug_class] ?? d.drug_class, ...flat(d) })));
    sheet('รายชั่วโมง', data.by_hour.map(d => ({ 'ชั่วโมง': d.hour, ...flat(d) })));
    sheet('เหตุผลที่ไม่ได้ให้', data.not_given_reasons.map(r => ({ 'เหตุผล': REASON_LABEL[r.reason_code] ?? r.reason_code, 'ผล': STATUS_LABEL[r.status] ?? r.status, 'จำนวน': r.count })));
    sheet('ยาที่ขาดบ่อย', data.top_missed_drugs.map(r => ({ 'ยา': r.medication_name, 'มื้อที่ไม่มีบันทึก': r.count })));
    XLSX.writeFile(wb, `MAR_${range[0].format('YYYYMMDD')}_${range[1].format('YYYYMMDD')}.xlsx`);
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 md:p-6 max-w-7xl mx-auto flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <Title level={4} className="m-0! text-(--brand-text)!">วิเคราะห์การบริหารยา (MAR)</Title>
            <Text type="secondary" className="text-xs">
              ตรงเวลา = ให้ภายใน ±{data?.windows.standard_minutes ?? 60} นาทีจากเวลาที่กำหนด (ยาที่ต้องตรงเวลาเข้ม ±{data?.windows.time_critical_minutes ?? 30})
              · นับเฉพาะมื้อที่เลยช่วงเวลาให้ยาแล้ว
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select mode="multiple" allowClear placeholder="ทุกหอ" className="min-w-56" maxTagCount="responsive"
              value={selected} onChange={setSelected} optionFilterProp="label"
              options={wards.map(w => ({ value: w.his_code, label: w.ward_name }))} />
            <DatePicker.RangePicker value={range} format="DD/MM/YYYY" allowClear={false}
              disabledDate={d => d.isAfter(dayjs(), 'day')}
              onChange={v => v?.[0] && v?.[1] && setRange([v[0], v[1]])} />
            <Button onClick={exportExcel} disabled={!data} style={{ backgroundColor: '#217346', borderColor: '#217346', color: '#fff' }}>ส่งออก Excel</Button>
          </div>
        </div>

        {error && <Alert type="error" showIcon title="โหลดข้อมูลไม่สำเร็จ" description={error} />}
        {loading && !data ? <DashboardSkeleton kpis={8} charts={2} /> : data && s && (
          <>
            {s.due === 0 && data.prn.given === 0 && (
              <Alert type="info" showIcon title="ยังไม่มีข้อมูลในช่วงนี้" description="ตัวเลขจะขึ้นเมื่อหอผู้ป่วยเริ่มบันทึกคำสั่งยาและการให้ยาในหน้า MAR ของผู้ป่วย" />
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi label="ให้ยาตรงเวลา" value={pct(s.on_time_rate)} status={statusOf(s.on_time_rate, 90, 80)}
                sub={`${nf.format(s.on_time)} จาก ${nf.format(s.given)} มื้อที่ให้`}
                hint="มื้อที่ให้ภายในช่วงเวลา ÷ มื้อที่ให้ทั้งหมด (ไม่รวมมื้อที่ไม่ได้ให้หรือไม่มีบันทึก)" />
              <Kpi label="บันทึกครบทุกมื้อ" value={pct(s.documented_rate)} status={statusOf(s.documented_rate, 98, 95)}
                sub={`ไม่มีบันทึก ${nf.format(s.missed)} จาก ${nf.format(s.due)} มื้อ`}
                hint="มื้อที่ถึงกำหนดแล้วและมีบันทึก (ให้ หรือ ไม่ได้ให้พร้อมเหตุผล) ÷ มื้อที่ถึงกำหนดทั้งหมด" />
              <Kpi label="ให้หลังเวลากำหนด (มัธยฐาน)" value={s.median_late_minutes === null ? '–' : `${s.median_late_minutes} นาที`}
                sub={s.p90_late_minutes === null ? undefined : `มื้อที่ช้าที่สุด 10% เกิน ${s.p90_late_minutes} นาที`}
                hint="นับทุกมื้อที่ให้หลังเวลาที่กำหนด รวมที่ยังอยู่ในช่วงตรงเวลา" />
              <Kpi label="ยาความเสี่ยงสูงมีผู้ตรวจซ้ำ" value={pct(data.high_alert.rate)} status={statusOf(data.high_alert.rate, 100, 95)}
                sub={`${nf.format(data.high_alert.double_checked)} จาก ${nf.format(data.high_alert.given)} ครั้ง`} />
              <Kpi label="คำสั่งยาผ่านการตรวจทาน" value={pct(data.orders.verified_rate)} status={statusOf(data.orders.verified_rate, 100, 95)}
                sub={`รอตรวจทานตอนนี้ ${nf.format(data.orders.pending_verification_now)} คำสั่ง${data.orders.median_verify_minutes !== null ? ` · ใช้เวลา ~${data.orders.median_verify_minutes} นาที` : ''}`}
                hint="คำสั่งยาที่บันทึกในช่วงนี้ ที่มีพยาบาลอีกคนตรวจทานแล้ว" />
              <Kpi label="ให้ยาตามคำสั่งที่ยังไม่ตรวจทาน" value={nf.format(data.given_on_unverified_order)}
                status={data.given_on_unverified_order === 0 ? STATUS.good : STATUS.warning} sub="ครั้ง" />
              <Kpi label="PRN ประเมินผลซ้ำ" value={pct(data.prn.reassessed_rate)}
                sub={`${nf.format(data.prn.reassessed)} จาก ${nf.format(data.prn.given)} ครั้ง · ภายใน 1 ชม. ${nf.format(data.prn.reassessed_within_1h)}`}
                hint="ยา PRN ที่มีคะแนนอาการหลังให้ยา" />
              <Kpi label="PRN ได้ผล (คะแนนลด ≥ 2)" value={nf.format(data.prn.effective)}
                sub={`คะแนนลดเฉลี่ย ${data.prn.mean_reduction ?? '–'} · ให้ถี่กว่าคำสั่ง ${nf.format(data.prn.interval_violations)} ครั้ง`} />
            </div>

            {data.adverse_reactions > 0 && (
              <Alert type="warning" showIcon title={`มีรายงานอาการไม่พึงประสงค์จากยา ${data.adverse_reactions} ครั้งในช่วงนี้`}
                description="ดูรายละเอียดได้ในประวัติการให้ยาของผู้ป่วย และควรรายงานตามระบบ ADR ของโรงพยาบาล" />
            )}

            <Section title="มื้อยารายวัน" hint="แต่ละแท่งคือมื้อที่ถึงกำหนดในวันนั้น แยกตามผลการบันทึก">
              <StackedBars rows={data.daily} labels={dailyLabels} dark={dark} />
            </Section>

            <Section title="ตามช่วงเวลาของวัน" hint="มื้อที่ไม่มีบันทึกหรือช้ากระจุกอยู่ช่วงไหน — ใช้วางคนช่วงรอบยา">
              <StackedBars rows={data.by_hour} labels={hourLabels} dark={dark} height={260} />
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="รายหอผู้ป่วย">
                <Table rowKey="ward_code" size="small" pagination={false} dataSource={data.by_ward} scroll={{ x: 'max-content' }}
                  columns={bucketColumns<Analytics['by_ward'][number]>({ title: 'หอ', dataIndex: 'ward_name' })} />
              </Section>
              <Section title="รายเวร" hint="เวรตามเวลาที่กำหนดให้ยา (ดึก 00–08 · เช้า 08–16 · บ่าย 16–24)">
                <Table rowKey="shift" size="small" pagination={false} dataSource={data.by_shift} scroll={{ x: 'max-content' }}
                  columns={bucketColumns<Analytics['by_shift'][number]>({ title: 'เวร', dataIndex: 'shift' })} />
              </Section>
              <Section title="ตามกลุ่มยา">
                <Table rowKey="drug_class" size="small" pagination={false} dataSource={data.by_drug_class} scroll={{ x: 'max-content' }}
                  columns={bucketColumns<Analytics['by_drug_class'][number]>({ title: 'กลุ่มยา', dataIndex: 'drug_class', render: v => CLASS_LABEL[v] ?? v })} />
              </Section>
              <Section title="เหตุผลที่ไม่ได้ให้ยา">
                <Table rowKey={r => `${r.reason_code}-${r.status}`} size="small" pagination={false} dataSource={data.not_given_reasons}
                  locale={{ emptyText: 'ไม่มี' }}
                  columns={[
                    { title: 'เหตุผล', dataIndex: 'reason_code', render: v => REASON_LABEL[v] ?? v },
                    { title: 'ผล', dataIndex: 'status', width: 120, render: v => STATUS_LABEL[v] ?? v },
                    { title: 'ครั้ง', dataIndex: 'count', align: 'right', width: 70 },
                  ]} />
                <div className="mt-4 font-semibold text-sm">ยาที่ไม่มีบันทึกบ่อยที่สุด</div>
                <Table rowKey="medication_name" size="small" pagination={false} dataSource={data.top_missed_drugs}
                  locale={{ emptyText: 'ไม่มี' }}
                  columns={[
                    { title: 'ยา', dataIndex: 'medication_name' },
                    { title: 'มื้อที่ไม่มีบันทึก', dataIndex: 'count', align: 'right', width: 120 },
                  ]} />
              </Section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
