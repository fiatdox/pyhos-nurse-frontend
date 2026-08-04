'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Card, Form, Input, InputNumber, Select, DatePicker, Button, Row, Col, Spin, Tag,
  Table, Popconfirm, Tabs, Segmented, Alert, Tooltip, Empty, Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import type { ECharts } from 'echarts';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { newRequestId } from '../../../lib/requestId';
import {
  calcNews2, checkRange, NEWS2_MIN_AGE, REFERENCE_RANGE, TEMP_RANGE,
  AGE_GROUP_LABEL, RISK_STYLE,
  type AgeGroup, type Avpu, type RangeVerdict,
} from '../../../lib/news2';
import { VscSave, VscTrash, VscWarning, VscCheck } from 'react-icons/vsc';
import { PiHeartbeatBold, PiChartLineBold, PiTableBold, PiGaugeBold, PiClockClockwiseBold, PiUserBold } from 'react-icons/pi';

// ---------- ชนิดข้อมูล ----------

interface PatientInfo {
  admission_list_id?: number;
  hn?: string;
  an?: string;
  ptname?: string;
  bedno?: string;
  regdate?: string;
  ward?: string;
  ward_name?: string;
  birthday?: string;
}

interface VitalRecord {
  id: number;
  an: string;
  record_datetime: string;
  entered_at?: string;
  shift?: string;
  is_late_entry?: boolean;
  late_entry_reason?: string;
  entry_method?: string;
  device_id?: string;

  vital_t?: string | number;
  temp_route?: string;
  vital_p?: number;
  pulse_rhythm?: string;
  pulse_site?: string;
  vital_r?: number;
  resp_pattern?: string;
  vital_bp_s?: number;
  vital_bp_d?: number;
  bp_position?: string;
  bp_site?: string;
  bp_cuff_size?: string;
  bp_method?: string;
  map_value?: string | number;
  pulse_pressure?: number;
  vital_o2sat?: number;
  o2_therapy?: string;
  o2_device?: string;
  o2_flow?: string | number;
  fio2?: number;

  pain_score?: number;
  pain_scale?: string;
  avpu?: Avpu;
  gcs_e?: number;
  gcs_v?: number;
  gcs_m?: number;
  gcs_total?: number;
  blood_glucose?: string | number;
  glucose_timing?: string;
  urine_output_ml?: number;

  news2_score?: number;
  news2_risk?: keyof typeof RISK_STYLE;
  news2_scale?: number;
  monitor_freq?: string;
  nurse_name?: string;
}

interface PatientVitalMeta {
  age_years: number | null;
  age_group: AgeGroup | null;
  age_known: boolean;
  news2_applicable: boolean;
}

// ตัวเลือกและคำแปลอยู่ที่ไฟล์กลาง ใช้ร่วมกับรายงานสรุป (PDF) เพื่อไม่ให้แปลรหัสไม่ตรงกัน
import {
  TEMP_ROUTES,
  PULSE_SITES,
  RESP_PATTERNS,
  BP_POSITIONS,
  BP_SITES,
  BP_CUFFS,
  BP_METHODS,
  O2_DEVICES,
  PAIN_SCALES,
  GLUCOSE_TIMINGS,
  AVPU_OPTIONS,
  GCS_E,
  GCS_V,
  GCS_M,
  labelOf,
} from '../../../lib/vitalOptions';

// ---------- ชิ้นส่วน UI ----------

const VERDICT_STYLE: Record<RangeVerdict, { color: string; mark: string }> = {
  normal: { color: '#16a34a', mark: '' },
  low: { color: '#2563eb', mark: '▼ ต่ำกว่าเกณฑ์' },
  high: { color: '#dc2626', mark: '▲ สูงกว่าเกณฑ์' },
  unknown: { color: '#9ca3af', mark: '' },
};

/** บอกช่วงปกติใต้ช่องกรอก และเปลี่ยนสีทันทีที่ค่าออกนอกเกณฑ์ */
function RangeHint({ verdict, range, unit }: { verdict: RangeVerdict; range?: [number, number]; unit?: string }) {
  if (!range) return null;
  const s = VERDICT_STYLE[verdict];
  return (
    <div className="text-[11px] leading-tight mt-0.5" style={{ color: s.color }}>
      ปกติ {range[0]}–{range[1]}{unit ? ` ${unit}` : ''} {s.mark}
    </div>
  );
}

/** หัวข้อย่อยในการ์ด */
function SubHead({ children, color = '#dc2626' }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5 mt-1">
      <span className="w-1 h-3.5 rounded-sm" style={{ background: color }} />
      <span className="text-[13px] font-bold" style={{ color }}>{children}</span>
    </div>
  );
}

function SectionCard({ title, accent, children, extra }: {
  title: string; accent: string; children: React.ReactNode; extra?: React.ReactNode;
}) {
  return (
    <Card
      size="small"
      className="shadow-sm rounded-xl border mb-3"
      style={{ borderColor: `${accent}40` }}
      styles={{
        header: {
          background: `linear-gradient(90deg, ${accent}33, ${accent}14)`,
          borderBottom: `1px solid ${accent}59`,
          minHeight: 38,
        },
      }}
      title={<span className="font-bold text-[13px]" style={{ color: accent }}>{title}</span>}
      extra={extra}
    >
      {children}
    </Card>
  );
}

// ---------- แผง NEWS2 ----------

function News2Panel({ result, applicable, ageKnown, ageYears }: {
  result: ReturnType<typeof calcNews2>;
  applicable: boolean;
  ageKnown: boolean;
  ageYears: number | null;
}) {
  // ไม่รู้อายุกับเป็นเด็ก ไม่คิด NEWS2 เหมือนกันแต่คนละเรื่อง ต้องบอกให้ตรง
  if (!ageKnown) {
    return (
      <Alert
        type="warning"
        showIcon
        title="ไม่มีวันเกิดของผู้ป่วยใน HIS — ไม่คำนวณ NEWS2"
        description={
          <span className="text-xs">
            NEWS2 ใช้ได้กับอายุ {NEWS2_MIN_AGE} ปีขึ้นไป เมื่อไม่รู้อายุจึงคิดคะแนนให้ไม่ได้
            และช่วงค่าปกติที่แสดงด้านล่างเป็น<b>ของผู้ใหญ่</b> ไม่ได้ปรับตามอายุจริง
            กรุณาแก้วันเกิดใน HIS แล้วเปิดหน้านี้ใหม่
          </span>
        }
      />
    );
  }

  if (!applicable) {
    return (
      <Alert
        type="info"
        showIcon
        title="ผู้ป่วยกลุ่มเด็ก — ไม่ใช้ NEWS2"
        description={
          <span className="text-xs">
            NEWS2 ใช้กับอายุ {NEWS2_MIN_AGE} ปีขึ้นไปเท่านั้น
            {ageYears !== null && ` (ผู้ป่วยรายนี้อายุ ${ageYears} ปี)`}
            {' '}ผู้ป่วยเด็กต้องใช้ PEWS ซึ่งมีเกณฑ์คนละชุด ระบบยังคงเทียบช่วงค่าปกติตามอายุให้
          </span>
        }
      />
    );
  }

  const incomplete = result.score === null;
  const style = incomplete
    ? { label: 'ข้อมูลยังไม่ครบ', color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' }
    : RISK_STYLE[result.risk as string];

  return (
    <div className="rounded-xl border p-3" style={{ background: style.bg, borderColor: style.border }}>
      <div className="flex items-center gap-4">
        <div
          className="shrink-0 w-20 h-20 rounded-xl flex flex-col items-center justify-center border-2"
          style={{ borderColor: style.border, background: '#fff' }}
        >
          <span className="text-[10px] font-semibold text-gray-400 leading-none">NEWS2</span>
          <span className="text-3xl font-black leading-none mt-1" style={{ color: style.color }}>
            {incomplete ? '–' : result.score}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm" style={{ color: style.color }}>
            {style.label}
            {result.hasSingleThree && (
              <Tag color="orange" className="ml-2 m-0 text-[11px]">มีค่าเดี่ยว 3 คะแนน</Tag>
            )}
          </div>
          {incomplete ? (
            <div className="text-xs text-gray-500 mt-1">
              กรอกครบ {result.completeness}/7 ตัว — ต้องครบทั้งหมดจึงจะตีความคะแนนรวมได้
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-700 mt-1 flex items-center gap-1.5">
                <PiClockClockwiseBold className="shrink-0" />
                <span className="font-semibold">วัดซ้ำ {result.monitorFreq}</span>
              </div>
              <div className="text-xs text-gray-600 mt-0.5">{result.response}</div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {result.params.map(p => (
          <Tooltip key={p.key} title={p.value === null ? 'ยังไม่ได้กรอก' : `${p.label}: ${p.value}`}>
            <span
              className="px-2 py-0.5 rounded-md text-[11px] font-semibold border"
              style={
                p.score === null
                  ? { background: '#fff', borderColor: '#e5e7eb', color: '#9ca3af' }
                  : p.score === 0
                    ? { background: '#fff', borderColor: '#bbf7d0', color: '#16a34a' }
                    : p.score >= 3
                      ? { background: '#fee2e2', borderColor: '#fca5a5', color: '#b91c1c' }
                      : { background: '#fef9c3', borderColor: '#fde047', color: '#a16207' }
              }
            >
              {p.label} {p.score === null ? '–' : `+${p.score}`}
            </span>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

// ---------- กราฟแนวโน้ม ----------

function VitalChart({ records, refRange }: {
  records: VitalRecord[];
  refRange?: (typeof REFERENCE_RANGE)[AgeGroup];
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ECharts | null>(null);

  const sorted = useMemo(
    () => [...records].sort((a, b) => dayjs(a.record_datetime).unix() - dayjs(b.record_datetime).unix()),
    [records]
  );

  useEffect(() => {
    if (!chartRef.current || sorted.length === 0) return;

    let cancelled = false;
    let resizeHandler: (() => void) | null = null;

    import('echarts').then((echarts) => {
      if (cancelled || !chartRef.current) return;
      if (!chartInstance.current) chartInstance.current = echarts.init(chartRef.current);
      const chart = chartInstance.current;

      const x = sorted.map(r => dayjs(r.record_datetime).format('DD/MM HH:mm'));
      const numOf = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

      // แถบช่วงค่าปกติตามอายุ ช่วยให้เห็นทันทีว่าค่าไหนหลุดเกณฑ์
      const band = (range: [number, number] | undefined, color: string) =>
        range
          ? [{ yAxis: range[0], itemStyle: { color }, label: { show: false } },
             { yAxis: range[1] }]
          : [];

      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { bottom: 0, textStyle: { fontSize: 11 }, itemWidth: 14 },
        grid: { top: 34, right: 46, bottom: 46, left: 46 },
        xAxis: { type: 'category', data: x, axisLabel: { fontSize: 10, rotate: 30 } },
        yAxis: [
          { type: 'value', name: 'T / P / R / BP', min: 0, nameTextStyle: { fontSize: 10 } },
          { type: 'value', name: 'SpO₂ / NEWS2', position: 'right', min: 0, max: 100, nameTextStyle: { fontSize: 10 } },
        ],
        series: [
          {
            name: 'T (°C)', type: 'line', smooth: true, connectNulls: true, symbolSize: 6,
            data: sorted.map(r => numOf(r.vital_t)),
            lineStyle: { width: 2, color: '#ef4444' }, itemStyle: { color: '#ef4444' },
          },
          {
            name: 'ชีพจร', type: 'line', smooth: true, connectNulls: true, symbolSize: 6, symbol: 'diamond',
            data: sorted.map(r => numOf(r.vital_p)),
            lineStyle: { width: 2, color: '#f97316' }, itemStyle: { color: '#f97316' },
            markArea: refRange ? { silent: true, data: [band(refRange.pulse, 'rgba(249,115,22,0.05)')] } : undefined,
          },
          {
            name: 'หายใจ', type: 'line', smooth: true, connectNulls: true, symbolSize: 6, symbol: 'triangle',
            data: sorted.map(r => numOf(r.vital_r)),
            lineStyle: { width: 2, color: '#8b5cf6' }, itemStyle: { color: '#8b5cf6' },
          },
          {
            name: 'BP บน', type: 'line', smooth: true, connectNulls: true, symbolSize: 6, symbol: 'rect',
            data: sorted.map(r => numOf(r.vital_bp_s)),
            lineStyle: { width: 2, color: '#3b82f6' }, itemStyle: { color: '#3b82f6' },
          },
          {
            name: 'BP ล่าง', type: 'line', smooth: true, connectNulls: true, symbolSize: 5, symbol: 'rect',
            data: sorted.map(r => numOf(r.vital_bp_d)),
            lineStyle: { width: 1.5, type: 'dashed', color: '#93c5fd' }, itemStyle: { color: '#93c5fd' },
          },
          {
            name: 'MAP', type: 'line', smooth: true, connectNulls: true, symbolSize: 4,
            data: sorted.map(r => numOf(r.map_value)),
            lineStyle: { width: 1, type: 'dotted', color: '#1d4ed8' }, itemStyle: { color: '#1d4ed8' },
          },
          {
            name: 'SpO₂ %', type: 'line', yAxisIndex: 1, smooth: true, connectNulls: true, symbolSize: 6,
            data: sorted.map(r => numOf(r.vital_o2sat)),
            lineStyle: { width: 2, color: '#10b981' }, itemStyle: { color: '#10b981' },
          },
          {
            name: 'NEWS2', type: 'bar', yAxisIndex: 1, barMaxWidth: 14,
            data: sorted.map(r => (r.news2_score ?? null)),
            itemStyle: {
              color: (p: { dataIndex: number }) => {
                const risk = sorted[p.dataIndex]?.news2_risk;
                return risk ? RISK_STYLE[risk]?.border ?? '#cbd5e1' : '#cbd5e1';
              },
            },
          },
        ],
      }, true);

      resizeHandler = () => chart.resize();
      window.addEventListener('resize', resizeHandler);
    });

    return () => {
      cancelled = true;
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    };
  }, [sorted, refRange]);

  useEffect(() => () => { chartInstance.current?.dispose(); }, []);

  if (records.length === 0) {
    return <Empty description="ยังไม่มีข้อมูลสำหรับแสดงกราฟ" className="py-16" />;
  }
  return <div ref={chartRef} className="w-full h-105" />;
}

// ---------- ค่าตั้งต้นของฟอร์ม ----------

const DEFAULTS = {
  temp_route: 'axillary',
  pulse_rhythm: 'regular',
  pulse_site: 'radial',
  resp_pattern: 'regular',
  bp_position: 'supine',
  bp_site: 'left_arm',
  bp_cuff_size: 'adult',
  bp_method: 'automatic',
  o2_therapy: 'room_air',
  pain_scale: 'NRS',
  avpu: 'A' as Avpu,
  entry_method: 'manual',
};

/**
 * ปิดปุ่มบันทึกกี่วินาทีหลังบันทึกสำเร็จ
 * กันพยาบาลกดซ้ำเพราะไม่แน่ใจว่าเข้าไปแล้วหรือยัง — ฝั่ง server กันข้อมูลซ้ำอยู่แล้ว
 * แต่ปุ่มที่กดไม่ได้พร้อมนับถอยหลังบอกได้ชัดกว่าว่า "เรียบร้อยแล้ว ไม่ต้องกดอีก"
 * ปิดเฉพาะตอนสำเร็จ ถ้าบันทึกไม่ผ่านต้องแก้แล้วส่งใหม่ได้ทันที
 */
const SAVE_COOLDOWN_SECONDS = 5;

interface FormValues {
  record_datetime?: Dayjs;
  vital_t?: number; temp_route?: string;
  vital_p?: number; pulse_rhythm?: string; pulse_site?: string;
  vital_r?: number; resp_pattern?: string;
  vital_bp_s?: number; vital_bp_d?: number;
  bp_position?: string; bp_site?: string; bp_cuff_size?: string; bp_method?: string;
  vital_o2sat?: number; o2_therapy?: string; o2_device?: string; o2_flow?: number; fio2?: number;
  pain_score?: number; pain_scale?: string; avpu?: Avpu;
  gcs_e?: number; gcs_v?: number; gcs_m?: number;
  blood_glucose?: number; glucose_timing?: string; urine_output_ml?: number;
  entry_method?: string; device_id?: string;
  late_entry_reason?: string;
}

// ---------- คอมโพเนนต์หลัก ----------

export default function VitalSignsRecord({ an }: { an: string }) {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<VitalRecord[]>([]);
  // เริ่มด้วย age_known เพื่อไม่ให้ขึ้นคำเตือนวูบหนึ่งก่อนข้อมูลผู้ป่วยจะมาถึง
  const [meta, setMeta] = useState<PatientVitalMeta>({
    age_years: null, age_group: null, age_known: true, news2_applicable: true,
  });
  const [rightTab, setRightTab] = useState('chart');
  // Scale 2 ใช้กับผู้ป่วยที่มีเป้าหมาย SpO₂ 88–92% เป็นการตัดสินใจทางคลินิกต่อผู้ป่วย
  // ไม่ใช่ค่าที่วัด จึงแยกจากฟอร์มแต่ส่งไปกับ payload
  const [news2Scale, setNews2Scale] = useState<1 | 2>(1);
  // อ่านจาก sessionStorage ครั้งเดียว ใช้แค่แสดงผล ฝั่ง server ยึดตาม token เสมอ
  const profile = useMemo(() => getUserProfile(), []);
  // กุญแจกันส่งซ้ำ หนึ่งใบต่อการกรอกหนึ่งครั้ง เปลี่ยนใหม่เมื่อบันทึกสำเร็จ
  // ส่ง payload เดิมซ้ำกี่รอบ (กดรัว เน็ตค้างแล้ว retry) server ก็บันทึกให้แถวเดียว
  const requestId = useRef(newRequestId());

  const w = Form.useWatch([], form) ?? {};

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const res = await axios.get(`/api/v1/nursing-records/vital/${an}`, { headers: getHeaders() });
      if (res.data?.success) {
        setRecords(res.data.data || []);
        if (res.data.patient) setMeta(res.data.patient);
      }
    } catch (error) {
      console.error('โหลดสัญญาณชีพไม่สำเร็จ:', error);
      setRecords([]);
    }
  }, [an, getHeaders]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const res = await axios.post('/api/v1/patients/patient-by-an', { an }, { headers: getHeaders() });
        if (res.data?.success && res.data.data) {
          const p = Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;
          setPatient(p ?? null);
        }
        await fetchRecords();
      } catch (error) {
        console.error('โหลดข้อมูลผู้ป่วยไม่สำเร็จ:', error);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [an, getHeaders, fetchRecords]);

  // ---------- คำนวณสดขณะพิมพ์ ----------

  const onOxygen = w.o2_therapy === 'on_oxygen';

  const liveNews2 = useMemo(
    () => calcNews2({
      resp_rate: w.vital_r, spo2: w.vital_o2sat, on_oxygen: onOxygen,
      temperature: w.vital_t, systolic_bp: w.vital_bp_s, pulse: w.vital_p,
      avpu: w.avpu ?? null, scale: news2Scale,
    }),
    [w.vital_r, w.vital_o2sat, onOxygen, w.vital_t, w.vital_bp_s, w.vital_p, w.avpu, news2Scale]
  );

  const refRange = meta.age_group ? REFERENCE_RANGE[meta.age_group] : REFERENCE_RANGE.adult;
  const tempRange = TEMP_RANGE[w.temp_route ?? DEFAULTS.temp_route];

  const map = useMemo(() => {
    const s = w.vital_bp_s, d = w.vital_bp_d;
    if (typeof s !== 'number' || typeof d !== 'number' || d >= s) return null;
    return Math.round((d + (s - d) / 3) * 10) / 10;
  }, [w.vital_bp_s, w.vital_bp_d]);
  const pulsePressure =
    typeof w.vital_bp_s === 'number' && typeof w.vital_bp_d === 'number' ? w.vital_bp_s - w.vital_bp_d : null;

  const gcsTotal =
    typeof w.gcs_e === 'number' && typeof w.gcs_v === 'number' && typeof w.gcs_m === 'number'
      ? w.gcs_e + w.gcs_v + w.gcs_m
      : null;

  // เวลาที่วัดกับเวลาที่บันทึกต่างกันเกิน 1 ชม. ถือเป็นการลงย้อนหลัง มีผลทางกฎหมาย
  const backdatedHours = w.record_datetime ? dayjs().diff(w.record_datetime, 'hour', true) : 0;
  const isLateEntry = backdatedHours > 1;
  const reasonRequired = backdatedHours > 24;

  // นับถอยหลัง cooldown ทีละวินาที เคลียร์เองเมื่อออกจากหน้า
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ---------- บันทึก ----------

  const onFinish = async (values: FormValues) => {
    if (saving || cooldown > 0) return;   // กันกดซ้ำก่อนที่ปุ่มจะเข้าสถานะ loading
    setSaving(true);
    try {
      // ไม่ส่ง nurse_name / staff_id — server ดึงจาก token เอง
      const payload = {
        an,
        ward_code: patient?.ward || profile?.ward_code || '',
        ward_name: patient?.ward_name || profile?.ward_name || '',
        ...values,
        news2_scale: news2Scale,
        request_id: requestId.current,
        record_datetime: dayjs(values.record_datetime ?? dayjs()).format('YYYY-MM-DD HH:mm:ss'),
      };
      const res = await axios.post('/api/v1/nursing-records/vital', payload, { headers: getHeaders() });

      // เริ่มนับถอยหลังทันทีที่ server ตอบ ไม่รอให้ปิดกล่องข้อความ
      setCooldown(SAVE_COOLDOWN_SECONDS);

      if (res.data?.duplicate) {
        // คำขอเดิมสำเร็จไปแล้ว ไม่ใช่ความผิดพลาด แค่บอกให้รู้ว่าไม่ได้บันทึกซ้ำ
        await Swal.fire({
          icon: 'info',
          title: 'บันทึกไว้แล้ว',
          text: res.data.message,
          confirmButtonColor: '#006b5f',
          confirmButtonText: 'ตกลง',
          timer: SAVE_COOLDOWN_SECONDS * 1000,
          timerProgressBar: true,
        });
      } else {
        const saved = res.data?.news2;
        const risk = saved?.risk ? RISK_STYLE[saved.risk as string] : null;
        // คะแนนสูงต้องให้พยาบาลอ่านเอง ห้ามปิดเอง ส่วนเคสปกติปิดให้เพื่อกรอกรายต่อไปได้เร็ว
        const needsAttention = saved?.risk === 'high' || saved?.risk === 'medium' || saved?.hasSingleThree;
        await Swal.fire({
          icon: needsAttention ? 'warning' : 'success',
          title: 'บันทึกสัญญาณชีพสำเร็จ',
          html: saved?.score !== null && saved?.score !== undefined
            ? `<div style="font-size:14px">NEWS2 = <b style="color:${risk?.color}">${saved.score}</b> (${risk?.label})<br/>
               <span style="color:#64748b">วัดซ้ำ ${saved.monitorFreq}</span></div>`
            : undefined,
          confirmButtonColor: '#006b5f',
          confirmButtonText: 'ตกลง',
          timer: needsAttention ? undefined : SAVE_COOLDOWN_SECONDS * 1000,
          timerProgressBar: !needsAttention,
        });
      }

      // ขึ้นใบใหม่ การกรอกครั้งถัดไปคือคนละรายการ
      requestId.current = newRequestId();
      form.resetFields();
      form.setFieldsValue({
        ...DEFAULTS,
        record_datetime: dayjs(),
      });
      await fetchRecords();
    } catch (error) {
      const err = error as { response?: { status?: number; data?: { message?: string } } };
      const status = err.response?.status;
      Swal.fire({
        // 409 = มีบันทึกของเวลานี้อยู่แล้ว เป็นเรื่องที่แก้ได้ ไม่ใช่ระบบพัง
        icon: status === 409 ? 'warning' : 'error',
        title: status === 409 ? 'บันทึกซ้ำ' : `บันทึกไม่สำเร็จ (${status ?? 'Network Error'})`,
        text: err.response?.data?.message ?? 'เกิดข้อผิดพลาดในการบันทึก',
        confirmButtonColor: '#006b5f',
        confirmButtonText: 'ตกลง',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/v1/nursing-records/vital/${id}`, { headers: getHeaders() });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchRecords();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  // ---------- ตาราง ----------

  const cellOf = (value: unknown, verdict: RangeVerdict, suffix = '') => {
    if (value === null || value === undefined || value === '') return <span className="text-gray-300">-</span>;
    return (
      <span className="font-semibold" style={{ color: VERDICT_STYLE[verdict].color }}>
        {String(value)}{suffix}
      </span>
    );
  };

  const columns: ColumnsType<VitalRecord> = [
    {
      title: 'เวลาที่วัด', dataIndex: 'record_datetime', width: 140, fixed: 'left',
      defaultSortOrder: 'descend',
      sorter: (a, b) => dayjs(a.record_datetime).unix() - dayjs(b.record_datetime).unix(),
      render: (v, r) => (
        <div className="leading-tight">
          <div className="font-semibold text-xs">{dayjs(v).format('DD/MM/YY HH:mm')}</div>
          <div className="text-[10px] text-gray-400">
            เวร{r.shift ?? '-'}
            {r.is_late_entry && (
              <Tooltip title={`บันทึกเข้าระบบ ${dayjs(r.entered_at).format('DD/MM/YY HH:mm')}${r.late_entry_reason ? ` — ${r.late_entry_reason}` : ''}`}>
                <Tag color="orange" className="ml-1 m-0 text-[10px] leading-4">ย้อนหลัง</Tag>
              </Tooltip>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'NEWS2', dataIndex: 'news2_score', width: 76, align: 'center',
      render: (v, r) => {
        if (v === null || v === undefined) return <span className="text-gray-300">-</span>;
        const s = r.news2_risk ? RISK_STYLE[r.news2_risk] : null;
        return (
          <Tooltip title={r.monitor_freq ? `วัดซ้ำ ${r.monitor_freq}` : undefined}>
            <span
              className="inline-block px-2 py-0.5 rounded-md font-bold border text-xs"
              style={{ color: s?.color, background: s?.bg, borderColor: s?.border }}
            >
              {v}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'T', dataIndex: 'vital_t', width: 84, align: 'center',
      render: (v, r) => (
        <Tooltip title={`วัดทาง${labelOf(TEMP_ROUTES, r.temp_route)}`}>
          {cellOf(v, checkRange(Number(v), TEMP_RANGE[r.temp_route ?? 'axillary']), ' °C')}
        </Tooltip>
      ),
    },
    {
      title: 'ชีพจร', dataIndex: 'vital_p', width: 84, align: 'center',
      render: (v, r) => (
        <Tooltip title={`${labelOf(PULSE_SITES, r.pulse_site)} • ${r.pulse_rhythm === 'irregular' ? 'ไม่สม่ำเสมอ' : 'สม่ำเสมอ'}`}>
          <span>
            {cellOf(v, checkRange(v, refRange.pulse))}
            {r.pulse_rhythm === 'irregular' && <span className="text-red-500 text-[10px] ml-0.5">irr</span>}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'หายใจ', dataIndex: 'vital_r', width: 76, align: 'center',
      render: (v, r) => (
        <Tooltip title={labelOf(RESP_PATTERNS, r.resp_pattern)}>
          {cellOf(v, checkRange(v, refRange.resp))}
        </Tooltip>
      ),
    },
    {
      title: 'ความดัน', key: 'bp', width: 130, align: 'center',
      render: (_, r) => {
        if (!r.vital_bp_s || !r.vital_bp_d) return <span className="text-gray-300">-</span>;
        return (
          <Tooltip title={`${labelOf(BP_POSITIONS, r.bp_position)} • ${labelOf(BP_SITES, r.bp_site)} • ${labelOf(BP_METHODS, r.bp_method)}`}>
            <div className="leading-tight">
              <span className="font-semibold" style={{ color: VERDICT_STYLE[checkRange(r.vital_bp_s, refRange.sbp)].color }}>
                {r.vital_bp_s}/{r.vital_bp_d}
              </span>
              <div className="text-[10px] text-gray-400">MAP {r.map_value ?? '-'} • PP {r.pulse_pressure ?? '-'}</div>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'SpO₂', dataIndex: 'vital_o2sat', width: 116, align: 'center',
      render: (v, r) => (
        <div className="leading-tight">
          {cellOf(v, checkRange(v, refRange.spo2), '%')}
          <div className="text-[10px] text-gray-400">
            {r.o2_therapy === 'on_oxygen'
              ? `${labelOf(O2_DEVICES, r.o2_device)}${r.o2_flow ? ` ${r.o2_flow} LPM` : ''}`
              : 'room air'}
          </div>
        </div>
      ),
    },
    {
      title: 'ปวด', dataIndex: 'pain_score', width: 70, align: 'center',
      render: (v, r) => {
        if (v === null || v === undefined) return <span className="text-gray-300">-</span>;
        const color = v >= 7 ? 'red' : v >= 4 ? 'orange' : 'green';
        return <Tooltip title={r.pain_scale}><Tag color={color} className="m-0 font-semibold">{v}</Tag></Tooltip>;
      },
    },
    {
      title: 'รู้สึกตัว', key: 'loc', width: 90, align: 'center',
      render: (_, r) => (
        <div className="leading-tight">
          {r.avpu ? (
            <Tag color={r.avpu === 'A' ? 'green' : 'red'} className="m-0 font-bold">{r.avpu}</Tag>
          ) : <span className="text-gray-300">-</span>}
          {r.gcs_total && <div className="text-[10px] text-gray-400 mt-0.5">GCS {r.gcs_total}</div>}
        </div>
      ),
    },
    {
      title: 'DTX', dataIndex: 'blood_glucose', width: 88, align: 'center',
      render: (v, r) => v ? (
        <Tooltip title={labelOf(GLUCOSE_TIMINGS, r.glucose_timing)}>
          <span className="font-semibold text-xs">{v}</span>
        </Tooltip>
      ) : <span className="text-gray-300">-</span>,
    },
    {
      title: 'ปัสสาวะ', dataIndex: 'urine_output_ml', width: 78, align: 'center',
      render: v => v ? <span className="text-xs">{v} ml</span> : <span className="text-gray-300">-</span>,
    },
    {
      title: 'ผู้บันทึก', dataIndex: 'nurse_name', width: 130,
      render: (v, r) => (
        <div className="leading-tight">
          <div className="text-xs">{v || '-'}</div>
          {r.entry_method === 'monitor_import' && (
            <Tag color="blue" className="m-0 text-[10px] leading-4 mt-0.5">จาก monitor</Tag>
          )}
        </div>
      ),
    },
    {
      title: '', key: 'action', width: 46, align: 'center', fixed: 'right',
      render: (_, r) => (
        <Popconfirm title="ยืนยันลบรายการนี้?" description="ระบบจะเก็บแถวไว้เพื่อการตรวจสอบ"
          onConfirm={() => handleDelete(r.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
          <Button type="text" danger size="small" icon={<VscTrash />} />
        </Popconfirm>
      ),
    },
  ];

  const latest = records[0];
  const admitDate = patient?.regdate;

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      {/* ทำให้ label ของฟอร์มนี้หนาทุกอัน อ่านเร็วขึ้นตอนกรอกงานเร่ง */}
      <style>{`
        .vital-form .ant-form-item-label > label { font-weight: 600; font-size: 13px; }
        .vital-form .ant-form-item { margin-bottom: 12px; }
        .vital-form .ant-input-number { width: 100%; }

        /* ขนาดของ control ตั้งไว้ที่ <Form size="large"> ที่เดียว ทุกตัวจึงสูง 40px เท่ากัน
           เคยลองบังคับความสูงด้วย CSS แล้วไม่ติด เพราะต้องไปทับ selector ภายในของ antd
           ปล่อยให้ antd คุมความสูงเอง เหลือแต่แต่งตัวเลขให้ใหญ่และอยู่กึ่งกลาง */
        .vital-form .vs-line .ant-input-number-input {
          font-size: 20px; font-weight: 700; text-align: center;
        }
        /* ซ่อนลูกศรขึ้น-ลง globals.css บังคับให้แสดงตลอด มันกินที่ด้านขวา
           ทำให้ตัวเลขที่จัดกึ่งกลางเยื้องไปทางซ้าย และค่าสัญญาณชีพก็พิมพ์เร็วกว่ากดอยู่แล้ว */
        .vital-form .vs-line .ant-input-number-handler-wrap { display: none; }

        /* ช่วงค่าปกติใต้ช่องกรอก จองที่ไว้เท่ากันทุกช่องให้ก้นแถวตรงกัน */
        .vital-form .vs-line .ant-form-item-extra { min-height: 18px; }
      `}</style>

      <div className="p-4 max-w-400 mx-auto">
        {/* หัวเรื่อง */}
        <div className="bg-linear-to-r from-red-500 to-rose-400 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiHeartbeatBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">แบบบันทึกสัญญาณชีพ (Vital Signs)</h1>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <span className="text-white/90 text-sm font-semibold">{patient?.ptname || '-'}</span>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">HN: {patient?.hn || '-'}</Tag>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">AN: {an}</Tag>
                <span className="text-white/70 text-xs">เตียง {patient?.bedno || '-'}</span>
                {meta.age_years !== null && (
                  <span className="text-white/70 text-xs">
                    อายุ {meta.age_years} ปี
                    {meta.age_group && ` (${AGE_GROUP_LABEL[meta.age_group]})`}
                  </span>
                )}
                <span className="text-white/70 text-xs">
                  Admit: {admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-'}
                </span>
              </div>
            </div>
          </div>
          <Button size="small" onClick={() => window.history.back()}
            className="border-white/30 text-white bg-white/10 hover:bg-white/20">ย้อนกลับ</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" /></div>
        ) : (
          <Row gutter={16}>
            {/* ---------- ฟอร์ม ---------- */}
            <Col xs={24} xl={10}>
              <Form
                form={form}
                layout="vertical"
                size="large"
                className="vital-form"
                onFinish={onFinish}
                initialValues={{
                  ...DEFAULTS,
                  record_datetime: dayjs(),
                }}
              >
                <SectionCard title="เวลาและวิธีบันทึก" accent="#64748b">
                  <Row gutter={8}>
                    <Col span={16}>
                      <Form.Item label="เวลาที่วัดจริง" name="record_datetime"
                        rules={[{ required: true, message: 'กรุณาระบุเวลาที่วัด' }]}
                        extra={isLateEntry ? (
                          <span className="text-[11px] text-amber-600">
                            ลงย้อนหลัง {backdatedHours < 24 ? `${Math.round(backdatedHours)} ชม.` : `${Math.round(backdatedHours / 24)} วัน`}
                            {' '}— ระบบจะบันทึกเวลาที่กรอกเข้าระบบแยกไว้
                          </span>
                        ) : undefined}
                      >
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full"
                          disabledDate={d => d.isAfter(dayjs(), 'day')} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      {/* label ว่างไว้จองความสูง ให้ปุ่มอยู่ระนาบเดียวกับช่องวันที่ */}
                      <Form.Item label=" " colon={false}>
                        <Button block onClick={() => form.setFieldValue('record_datetime', dayjs())}>
                          ตอนนี้
                        </Button>
                      </Form.Item>
                    </Col>
                  </Row>

                  {reasonRequired && (
                    <Form.Item label="เหตุผลที่บันทึกย้อนหลัง" name="late_entry_reason"
                      rules={[{ required: true, min: 5, message: 'ระบุเหตุผลอย่างน้อย 5 ตัวอักษร' }]}>
                      <Input.TextArea rows={2} placeholder="เช่น เครื่องขัดข้อง ลงย้อนหลังจากใบวัดกระดาษ" />
                    </Form.Item>
                  )}

                  <Row gutter={8}>
                    <Col span={12}>
                      {/* ผู้บันทึกมาจากบัญชีที่เข้าสู่ระบบ แก้ไม่ได้ ฝั่ง server ก็ใช้ค่าจาก token
                          ไม่ใช่ค่าที่ส่งมาจากหน้าจอ */}
                      <Form.Item label="พยาบาลผู้บันทึก" colon={false}>
                        <div className="h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-1.5 overflow-hidden">
                          <PiUserBold className="text-slate-400 shrink-0" />
                          <span className="text-xs font-semibold text-slate-700 truncate">
                            {profile?.name || 'ไม่พบบัญชีผู้ใช้'}
                          </span>
                          {profile?.position_name && (
                            <span className="text-[10px] text-slate-400 shrink-0">· {profile.position_name}</span>
                          )}
                        </div>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="วิธีได้มาซึ่งค่า" name="entry_method">
                        <Segmented block options={[
                          { value: 'manual', label: 'วัดเอง' },
                          { value: 'monitor_import', label: 'จาก monitor' },
                        ]} />
                      </Form.Item>
                    </Col>
                  </Row>
                  {w.entry_method === 'monitor_import' && (
                    <Form.Item label="รหัสเครื่อง / เตียง monitor" name="device_id">
                      <Input placeholder="เช่น MON-ICU-03" maxLength={50} />
                    </Form.Item>
                  )}
                </SectionCard>

                {/* ---------- Core Five ---------- */}
                <SectionCard title="สัญญาณชีพหลัก (Core Five)" accent="#dc2626">
                  <SubHead>อุณหภูมิ</SubHead>
                  <Row gutter={8} className="vs-line">
                    <Col span={8}>
                      <Form.Item label="T (°C)" name="vital_t"
                        extra={<RangeHint verdict={checkRange(w.vital_t, tempRange)} range={tempRange} unit="°C" />}>
                        <InputNumber min={30} max={45} step={0.1} placeholder="36.5" inputMode="decimal" />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item label="วัดทาง (มีผลต่อค่าปกติ)" name="temp_route">
                        <Select options={TEMP_ROUTES} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider className="my-2!" />
                  <SubHead>ชีพจร</SubHead>
                  <Row gutter={8} className="vs-line">
                    <Col span={8}>
                      <Form.Item label="P (ครั้ง/นาที)" name="vital_p"
                        extra={<RangeHint verdict={checkRange(w.vital_p, refRange.pulse)} range={refRange.pulse} />}>
                        <InputNumber min={20} max={300} precision={0} placeholder="80" inputMode="numeric" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="จังหวะ" name="pulse_rhythm">
                        <Select options={[
                          { value: 'regular', label: 'สม่ำเสมอ' },
                          { value: 'irregular', label: 'ไม่สม่ำเสมอ' },
                        ]} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="ตำแหน่งที่คลำ" name="pulse_site">
                        <Select options={PULSE_SITES} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider className="my-2!" />
                  <SubHead>การหายใจ</SubHead>
                  <Row gutter={8} className="vs-line">
                    <Col span={8}>
                      <Form.Item label="RR (ครั้ง/นาที)" name="vital_r"
                        extra={<RangeHint verdict={checkRange(w.vital_r, refRange.resp)} range={refRange.resp} />}>
                        <InputNumber min={5} max={60} precision={0} placeholder="18" inputMode="numeric" />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item label="ลักษณะการหายใจ" name="resp_pattern">
                        <Select options={RESP_PATTERNS} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider className="my-2!" />
                  <SubHead>ความดันโลหิต</SubHead>
                  <Row gutter={8} className="vs-line">
                    <Col span={8}>
                      <Form.Item label="Systolic" name="vital_bp_s"
                        extra={<RangeHint verdict={checkRange(w.vital_bp_s, refRange.sbp)} range={refRange.sbp} />}>
                        <InputNumber min={50} max={300} precision={0} placeholder="120" inputMode="numeric" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Diastolic" name="vital_bp_d"
                        dependencies={['vital_bp_s']}
                        rules={[({ getFieldValue }) => ({
                          validator: (_, v) =>
                            v == null || getFieldValue('vital_bp_s') == null || v < getFieldValue('vital_bp_s')
                              ? Promise.resolve()
                              : Promise.reject(new Error('ต้องน้อยกว่าตัวบน')),
                        })]}>
                        <InputNumber min={20} max={200} precision={0} placeholder="80" inputMode="numeric" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      {/* คำนวณให้อัตโนมัติ พยาบาลไม่ต้องคิดเอง */}
                      <Form.Item label="คำนวณอัตโนมัติ" colon={false}>
                        <div className="h-10 bg-blue-50 border border-blue-100 rounded-lg flex flex-col items-center justify-center leading-tight">
                          <div className="text-sm font-bold text-blue-700">MAP {map ?? '–'}</div>
                          <div className="text-[11px] text-blue-500">PP {pulsePressure ?? '–'}</div>
                        </div>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={8}><Form.Item label="ท่า" name="bp_position"><Select options={BP_POSITIONS} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="ตำแหน่ง" name="bp_site"><Select options={BP_SITES} /></Form.Item></Col>
                    <Col span={8}><Form.Item label="ขนาด cuff" name="bp_cuff_size"><Select options={BP_CUFFS} /></Form.Item></Col>
                  </Row>
                  <Form.Item label="วิธีวัด" name="bp_method">
                    <Segmented block options={BP_METHODS} />
                  </Form.Item>

                  <Divider className="my-2!" />
                  <SubHead>ความอิ่มตัวออกซิเจน</SubHead>
                  <Row gutter={8} className="vs-line">
                    <Col span={8}>
                      <Form.Item label="SpO₂ (%)" name="vital_o2sat"
                        extra={<RangeHint verdict={checkRange(w.vital_o2sat, refRange.spo2)} range={refRange.spo2} unit="%" />}>
                        <InputNumber min={0} max={100} precision={0} placeholder="98" inputMode="numeric" />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item label="ขณะวัด" name="o2_therapy"
                        extra={<span className="text-[11px] text-gray-400">ไม่ระบุ = ตีความค่าผิดได้ทันที</span>}>
                        <Segmented block options={[
                          { value: 'room_air', label: 'Room air' },
                          { value: 'on_oxygen', label: 'ได้รับ O₂' },
                        ]} />
                      </Form.Item>
                    </Col>
                  </Row>
                  {onOxygen && (
                    <Row gutter={8}>
                      <Col span={8}>
                        <Form.Item label="อุปกรณ์" name="o2_device"
                          rules={[{ required: true, message: 'กรุณาเลือกอุปกรณ์' }]}>
                          <Select options={O2_DEVICES} placeholder="เลือก" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Flow (LPM)" name="o2_flow">
                          <InputNumber min={0} max={80} step={0.5} placeholder="3" inputMode="decimal" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="FiO₂ (%)" name="fio2">
                          <InputNumber min={21} max={100} precision={0} placeholder="40" inputMode="numeric" />
                        </Form.Item>
                      </Col>
                    </Row>
                  )}
                </SectionCard>

                {/* ---------- สัญญาณชีพที่ 6 ---------- */}
                <SectionCard title="สัญญาณชีพที่ 6 และตัวชี้วัดเสริม" accent="#7c3aed">
                  <SubHead color="#7c3aed">ความปวด</SubHead>
                  <Row gutter={8}>
                    <Col span={16}>
                      <Form.Item label="เครื่องมือประเมิน (เลือกตามกลุ่มผู้ป่วย)" name="pain_scale">
                        <Select options={PAIN_SCALES} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="คะแนน" name="pain_score">
                        <Select allowClear placeholder="0–10"
                          options={[...Array(11)].map((_, i) => ({ value: i, label: String(i) }))} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider className="my-2!" />
                  <SubHead color="#7c3aed">ระดับความรู้สึกตัว</SubHead>
                  <Form.Item label="ACVPU (ใช้ให้คะแนน NEWS2)" name="avpu">
                    <Segmented block options={AVPU_OPTIONS.map(o => ({
                      value: o.value,
                      label: <Tooltip title={o.hint}><span className="font-bold">{o.label}</span></Tooltip>,
                    }))} />
                  </Form.Item>
                  <Row gutter={8}>
                    <Col span={6}><Form.Item label="GCS Eye" name="gcs_e"><Select allowClear options={GCS_E} placeholder="E" /></Form.Item></Col>
                    <Col span={6}><Form.Item label="Verbal" name="gcs_v"><Select allowClear options={GCS_V} placeholder="V" /></Form.Item></Col>
                    <Col span={6}><Form.Item label="Motor" name="gcs_m"><Select allowClear options={GCS_M} placeholder="M" /></Form.Item></Col>
                    <Col span={6}>
                      <Form.Item label="รวม" colon={false}>
                        {/* สูงเท่า Select ขนาด small ให้อยู่ระนาบเดียวกับสามช่องซ้าย */}
                        <div className={`h-10 flex items-center justify-center rounded-lg font-bold text-base border ${
                          gcsTotal === null ? 'bg-gray-50 border-gray-200 text-gray-300'
                            : gcsTotal <= 8 ? 'bg-red-50 border-red-200 text-red-600'
                            : gcsTotal <= 12 ? 'bg-amber-50 border-amber-200 text-amber-600'
                            : 'bg-green-50 border-green-200 text-green-600'
                        }`}>
                          {gcsTotal ?? '–'}
                        </div>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider className="my-2!" />
                  <SubHead color="#7c3aed">น้ำตาลในเลือดและปัสสาวะ</SubHead>
                  <Row gutter={8}>
                    <Col span={8}>
                      <Form.Item label="DTX (mg/dL)" name="blood_glucose">
                        <InputNumber min={10} max={900} step={1} placeholder="110" inputMode="decimal" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="สัมพันธ์กับมื้ออาหาร" name="glucose_timing">
                        <Select allowClear options={GLUCOSE_TIMINGS} placeholder="เลือก" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="ปัสสาวะ (ml)" name="urine_output_ml">
                        <InputNumber min={0} max={20000} precision={0} placeholder="400" inputMode="numeric" />
                      </Form.Item>
                    </Col>
                  </Row>
                </SectionCard>

                <Button
                  type="primary"
                  htmlType="submit"
                  icon={cooldown > 0 ? <VscCheck /> : <VscSave />}
                  loading={saving}
                  disabled={cooldown > 0}
                  size="large"
                  className="bg-red-500 hover:bg-red-600! w-full shadow-md mb-1"
                >
                  {saving
                    ? 'กำลังบันทึก...'
                    : cooldown > 0
                      ? `บันทึกแล้ว · เปิดให้บันทึกอีกครั้งใน ${cooldown} วินาที`
                      : 'บันทึกสัญญาณชีพ'}
                </Button>
                <div className="text-[11px] text-gray-400 text-center mb-4 h-4">
                  {cooldown > 0 && 'ข้อมูลเข้าระบบแล้ว ไม่ต้องกดซ้ำ'}
                </div>
              </Form>
            </Col>

            {/* ---------- ผลลัพธ์ ---------- */}
            <Col xs={24} xl={14}>
              <div className="mb-3">
                {meta.news2_applicable && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                      <PiGaugeBold /> คะแนนเตือนภัยล่วงหน้า (คำนวณสดจากค่าที่กำลังกรอก)
                    </span>
                    <Tooltip title="Scale 2 ใช้กับผู้ป่วยที่แพทย์กำหนดเป้าหมาย SpO₂ 88–92% เช่น COPD ที่คั่ง CO₂">
                      <Segmented
                        size="small"
                        value={news2Scale}
                        onChange={v => setNews2Scale(v as 1 | 2)}
                        options={[
                          { value: 1, label: 'Scale 1' },
                          { value: 2, label: 'Scale 2 (COPD)' },
                        ]}
                      />
                    </Tooltip>
                  </div>
                )}
                <News2Panel result={liveNews2} applicable={meta.news2_applicable}
                  ageKnown={meta.age_known} ageYears={meta.age_years} />
              </div>

              {/* ค่าล่าสุดที่บันทึกไว้ */}
              {latest && (
                <Card size="small" className="rounded-xl border border-gray-100 shadow-sm mb-3"
                  title={<span className="text-xs font-bold text-gray-500">
                    ค่าล่าสุดที่บันทึก — {dayjs(latest.record_datetime).format('DD/MM/YYYY HH:mm')}
                  </span>}>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {([
                      ['T', latest.vital_t, '°C', checkRange(Number(latest.vital_t), TEMP_RANGE[latest.temp_route ?? 'axillary'])],
                      ['ชีพจร', latest.vital_p, '', checkRange(latest.vital_p, refRange.pulse)],
                      ['หายใจ', latest.vital_r, '', checkRange(latest.vital_r, refRange.resp)],
                      ['BP', latest.vital_bp_s && latest.vital_bp_d ? `${latest.vital_bp_s}/${latest.vital_bp_d}` : null, '', checkRange(latest.vital_bp_s, refRange.sbp)],
                      ['SpO₂', latest.vital_o2sat, '%', checkRange(latest.vital_o2sat, refRange.spo2)],
                      ['MAP', latest.map_value, '', 'unknown' as RangeVerdict],
                    ] as [string, string | number | null | undefined, string, RangeVerdict][]).map(([label, value, unit, verdict]) => (
                      <div key={label} className="text-center rounded-lg bg-slate-50 border border-slate-100 py-1.5">
                        <div className="text-[10px] text-gray-400 font-semibold">{label}</div>
                        <div className="font-bold text-sm" style={{ color: VERDICT_STYLE[verdict].color }}>
                          {value ?? '–'}<span className="text-[10px] font-normal">{value ? unit : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card size="small" className="shadow-sm rounded-xl border border-gray-100"
                styles={{ body: { padding: 0 } }}>
                <Tabs
                  activeKey={rightTab}
                  onChange={setRightTab}
                  type="card"
                  className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                  items={[
                    {
                      key: 'chart',
                      label: <span className="flex items-center gap-1.5"><PiChartLineBold /> แนวโน้ม</span>,
                      children: (
                        <div className="p-3">
                          <div className="text-[11px] text-gray-400 mb-1">
                            แท่งด้านหลังคือคะแนน NEWS2 — การทรุดลงมักเห็นจากแนวโน้มก่อนเห็นจากค่าเดี่ยว
                          </div>
                          <VitalChart records={records} refRange={refRange} />
                        </div>
                      ),
                    },
                    {
                      key: 'table',
                      label: <span className="flex items-center gap-1.5"><PiTableBold /> รายการ ({records.length})</span>,
                      children: (
                        <div className="p-3">
                          <Table
                            columns={columns}
                            dataSource={records}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 20, size: 'small', showSizeChanger: false }}
                            scroll={{ x: 1250 }}
                            locale={{ emptyText: 'ยังไม่มีข้อมูลสัญญาณชีพ' }}
                            rowClassName={r => (r.news2_risk === 'high' ? 'bg-red-50/60' : r.news2_risk === 'medium' ? 'bg-orange-50/50' : '')}
                            className="[&_.ant-table-thead_.ant-table-cell]:bg-red-50! [&_.ant-table-thead_.ant-table-cell]:text-red-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!"
                          />
                          <div className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5">
                            <VscWarning /> ค่าที่แสดงเป็นสีเทียบกับช่วงปกติของ
                            {meta.age_group
                              ? `กลุ่ม${AGE_GROUP_LABEL[meta.age_group]} ไม่ใช่ช่วงเดียวตายตัว`
                              : 'ผู้ใหญ่ (ไม่มีวันเกิดใน HIS จึงปรับตามอายุไม่ได้)'}
                          </div>
                        </div>
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        )}
      </div>
    </div>
  );
}
