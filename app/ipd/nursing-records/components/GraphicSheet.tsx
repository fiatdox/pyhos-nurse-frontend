'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Checkbox, DatePicker, Drawer, Form, Input, InputNumber, Segmented, Select, Slider, Space, Spin } from 'antd';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import { PiCaretLeftBold, PiCaretRightBold, PiChartLineBold, PiHeartbeatBold, PiMinusBold, PiMoonBold, PiPencilSimpleBold, PiPersonSimpleWalkBold, PiPhoneCallBold, PiPillBold, PiPlusBold, PiPrinterBold, PiSunBold, PiSunHorizonBold, PiThermometerBold } from 'react-icons/pi';
import Navbar from '../../../components/Navbar';
import PainAssessment from './PainAssessment';
import VitalSignsRecord from './VitalSignsRecord';
import FallRiskAssessment from './FallRiskAssessment';
import RrtRecord from './RrtRecord';
import MedicationRecord from './MedicationRecord';

/**
 * ฟอร์มปรอท (graphic sheet) โรงพยาบาลพะเยา — หนึ่งใบ 7 วัน × 6 เวลา (02 06 10 14 18 22)
 *
 * ไม่มีช่องกรอกสัญญาณชีพในหน้านี้ ค่าทั้งหมดมาจากหน้า "สัญญาณชีพ" และ MAR อยู่แล้ว
 * ส่วนที่ไม่มีที่อื่นเก็บ (I/O รายเวร, stool/ปัสสาวะ, ประเภทผู้ป่วย, Wt/Ht/Diet, วันผ่าตัด) กรอกจากปุ่ม "บันทึก I/O / รายวัน"
 *
 * วาดเป็น SVG ชิ้นเดียวขนาดสัดส่วน A4 จะได้พิมพ์ออกมาตรงตามใบกระดาษ ไม่ขึ้นกับความกว้างจอ
 * สีเส้นเป็นค่าคงที่ (กระดาษขาวเสมอ) ไม่ใช้สีของธีม ไม่งั้นโหมดมืดจะพลิกใบทั้งใบ
 */

interface Vital {
  at: string; t: number | null; p: number | null; r: number | null; bp_s: number | null; bp_d: number | null;
  spo2: number | null; o2_therapy: string | null; o2_device: string | null; o2_flow: number | null;
  pain_score: number | null; news2_score: number | null;
}
interface PainRec { at: string; pain_score: number; reassess_score: number | null; location: string | null; assessment_tool?: string | null }
/** Morse Fall Scale วันละครั้ง (nursing_assessments) */
interface FallRec { at: string; total_score: number; risk_level: 'low' | 'moderate' | 'high'; nurse_name: string | null }
interface Med { at: string; medication_name: string; prn: boolean; dose_given: string | null }
interface ShiftRow {
  record_date: string; shift: string;
  oral_ml: number | null; parenteral_ml: number | null;
  intake_other1_label: string | null; intake_other1_ml: number | null; intake_other2_label: string | null; intake_other2_ml: number | null;
  urine_ml: number | null; drainage_ml: number | null;
  output_other1_label: string | null; output_other1_ml: number | null; output_other2_label: string | null; output_other2_ml: number | null;
  updated_by_name?: string | null; updated_at?: string | null;
}
interface DailyRow {
  record_date: string; stool_count: number | null; urine_count: number | null; patient_type: string | null;
  weight_kg: number | null; height_cm: number | null; diet: string | null; is_operation_day: boolean; note: string | null;
  updated_by_name?: string | null; updated_at?: string | null;
}
export interface Sheet {
  from: string; vitals: Vital[]; meds: Med[]; pains?: PainRec[]; falls?: FallRec[]; shifts: ShiftRow[]; daily: DailyRow[]; op_dates: string[]; storage_ready: boolean;
}
export interface Patient {
  hn?: string; ptname?: string; name?: string; patient_name?: string; bedno?: string; bed?: string;
  ward?: string; wardName?: string; ward_name?: string; regdate?: string; reg_datetime?: string; admitDateTimeIso?: string;
}

const SHIFTS = ['ดึก', 'เช้า', 'บ่าย'] as const;
/** เกณฑ์ของโรงพยาบาล: NEWS2 ≥ 5 ต้องตาม RRT */
const RRT_NEWS2 = 5;
/** ระดับความเสี่ยงพลัดตกหกล้ม (Morse): ตัวย่อในช่อง · สี · คำอ่าน */
const FALL_LV: Record<string, { short: string; color: string; th: string }> = {
  low: { short: 'L', color: '#15803d', th: 'เสี่ยงต่ำ (0-24)' },
  moderate: { short: 'M', color: '#c2410c', th: 'เสี่ยงปานกลาง (25-44)' },
  high: { short: 'H', color: '#dc2626', th: 'เสี่ยงสูง (≥45)' },
};
/** ช่องที่จะบันทึก/แก้ในลิ้นชัก: แท็บ วัน และเวร (เวรใช้เฉพาะแท็บ I/O) */
interface EditPos { tab: 'io' | 'daily'; date: string; shift: string }
/** สีประจำเวร: ดึก ม่วง · เช้า เหลือง · บ่าย ส้ม — bg ตอนเลือก, fg ตัวอักษรบน bg (เหลืองใช้ตัวเข้มให้อ่านออก), soft พื้นอ่อนตอนไม่ได้เลือก */
const SHIFT_COLOR: Record<string, { bg: string; fg: string; soft: string; ink: string }> = {
  'ดึก': { bg: '#7c3aed', fg: '#ffffff', soft: '#f3e8ff', ink: '#6d28d9' },
  'เช้า': { bg: '#facc15', fg: '#422006', soft: '#fef9c3', ink: '#854d0e' },
  'บ่าย': { bg: '#f97316', fg: '#ffffff', soft: '#ffedd5', ink: '#c2410c' },
};
/** ไอคอนเวร (แสดงเฉพาะเวรที่เลือก): ดึก พระจันทร์ · เช้า ดวงอาทิตย์ · บ่าย อาทิตย์ตก */
const SHIFT_ICON: Record<string, React.ReactNode> = {
  'ดึก': <PiMoonBold aria-hidden />,
  'เช้า': <PiSunBold aria-hidden />,
  'บ่าย': <PiSunHorizonBold aria-hidden />,
};
const SLOTS = [2, 6, 10, 14, 18, 22];
/** เวลาเหตุการณ์ → ช่องเวลาของฟอร์ม: 00–03 = 2, 04–07 = 6, ... 20–23 = 22 */
const slotOf = (d: Dayjs) => Math.floor(d.hour() / 4);

/**
 * ความปวดหนึ่งครั้ง — มาจากหน้าสัญญาณชีพ (vital) หรือแบบประเมินความปวด (assess)
 * CPOT เต็ม 8 เกณฑ์ต่างจาก NRS จึงเทียบความรุนแรงด้วยระดับ ไม่ใช่ตัวเลขดิบ
 */
interface PainEntry { at: string; v: number; tool: string; src: 'vital' | 'assess'; location: string | null; reassess: number | null }
const isCpot = (e: { tool: string }) => e.tool === 'CPOT';
/** 0 ไม่ปวด · 1 เล็กน้อย · 2 ปานกลาง · 3 มาก — CPOT 0-2/3-5/>5, NRS 0/1-3/4-6/7-10 */
const painRank = (e: { v: number; tool: string }) => isCpot(e)
  ? (e.v <= 2 ? 1 : e.v <= 5 ? 2 : 3)
  : (e.v === 0 ? 0 : e.v <= 3 ? 1 : e.v <= 6 ? 2 : 3);
const PAIN_RANK_TH = ['ไม่ปวด', 'ปวดเล็กน้อย', 'ปวดปานกลาง', 'ปวดมาก'];
/** ปานกลางขึ้นไปต้องได้รับการจัดการ แล้วประเมินซ้ำ */
const needsCare = (e: { v: number; tool: string }) => painRank(e) >= 2;
const painText = (e: PainEntry) => isCpot(e) ? `CPOT ${e.v}/8` : `${e.tool === 'vital' ? 'Pain' : e.tool} ${e.v}/10`;
const painEntries = (sheet: Sheet): PainEntry[] => [
  ...sheet.vitals.filter(v => v.pain_score !== null && v.pain_score !== undefined)
    .map(v => ({ at: v.at, v: v.pain_score as number, tool: 'vital', src: 'vital' as const, location: null, reassess: null })),
  ...(sheet.pains ?? []).map(x => ({ at: x.at, v: x.pain_score, tool: x.assessment_tool || 'NRS', src: 'assess' as const, location: x.location, reassess: x.reassess_score })),
].sort((a, b) => a.at.localeCompare(b.at));

const O2_SHORT: Record<string, string> = {
  cannula: 'C', simple_mask: 'M', mask_with_bag: 'MB', venturi: 'V', hfnc: 'HF',
  cpap: 'CP', bipap: 'BP', ventilator: 'Vent', t_piece: 'T',
};
/** รหัสยาตามคำอธิบายท้ายใบ ยาอื่นแสดงสามตัวอักษรแรก ชื่อเต็มดูได้เมื่อชี้ */
const medCode = (name: string) => {
  const n = name.toLowerCase();
  if (/\bmst\b/.test(n)) return 'Ms';
  if (/morphine.*(syrup|ir\b|oral)|\bmo[\s-]*(ir|syrup)/.test(n)) return 'Mi';
  if (/morphine/.test(n)) return 'M';
  if (/tramadol/.test(n)) return 'T';
  if (/diclofenac/.test(n)) return 'D';
  if (/pethidine|meperidine/.test(n)) return 'P';
  if (/fentanyl/.test(n)) return 'F';
  return name.replace(/[^A-Za-z]/g, '').slice(0, 3) || name.slice(0, 3);
};
const beShort = (d: Dayjs) => `${d.date()}/${d.month() + 1}/${String((d.year() + 543) % 100).padStart(2, '0')}`;

/* ─────────────── เรขาคณิตของใบ (หน่วยใน viewBox) ─────────────── */
const W = 1000;
const X0 = 30;            // ขอบซ้ายของตาราง
const LBL = 140;          // ความกว้างคอลัมน์ชื่อแถว
const XD = X0 + LBL;      // จุดเริ่มข้อมูล
const XR = 980;           // ขอบขวา
const DAY_W = (XR - XD) / 7;
const SLOT_W = DAY_W / 6;
const SHIFT_W = DAY_W / 3;
const RH = 17;            // ความสูงแถวปกติ
const BLUE = '#1f5fbf';
const LIGHT = '#9dbbe6';
const RED = '#d32f2f';
const INK = '#0f172a';

const T_MIN = 35, T_MAX = 41;
const GRAPH_H = 360;
const PAIN_H = 96;

/** ข้อความหนึ่งชิ้นบนใบ — จัดกึ่งกลางแนวตั้งที่ y */
function T({ x, y, children, size = 9, anchor = 'middle', weight, color = INK }: {
  x: number; y: number; children: React.ReactNode; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; color?: string;
}) {
  return <text x={x} y={y} fontSize={size} textAnchor={anchor} fontWeight={weight} fill={color} dominantBaseline="middle">{children}</text>;
}

export function SheetSvg({ sheet, start, admitDate, patient, onPainClick, onVitalClick, onFallClick, onMedClick, onCellClick }: {
  /** คลิกช่องวันในแถว Fall risk → เปิดแบบประเมิน Morse ของวันนั้น */
  onFallClick?: (day: Dayjs) => void;
  /** คลิกแถวยา (continuous / prn dose) ของวันใด → เปิดบันทึกการให้ยา (MAR) ของวันนั้น */
  onMedClick?: (day: Dayjs) => void;
  /** คลิกช่องเวลาในแถวความปวด → เปิดแบบประเมินที่เวลาของช่องนั้น */
  onPainClick?: (at: Dayjs) => void;
  /** คลิกช่องเวลาในกราฟ T/P หรือแถว RR–O₂ therapy → เปิดแบบบันทึกสัญญาณชีพที่เวลาของช่องนั้น */
  onVitalClick?: (at: Dayjs) => void;
  /** คลิกช่อง I/O (วัน+เวร) หรือแถวรายวัน (Wt/Ht/Diet, Stool, Urine, ประเภทผู้ป่วย) เพื่อเปิดลิ้นชักไปที่ช่องนั้น */
  onCellClick?: (pos: EditPos) => void;
  sheet: Sheet; start: Dayjs; admitDate: Dayjs | null; patient: Patient | null;
}) {
  const days = Array.from({ length: 7 }, (_, i) => start.add(i, 'day'));
  const dayKey = (d: Dayjs) => d.format('YYYY-MM-DD');

  /* ค่าที่วัดหลายครั้งในช่องเดียว ใช้ครั้งล่าสุด — ตรงกับที่พยาบาลลงกระดาษเป็นค่าเดียวต่อช่อง */
  const cell = useMemo(() => {
    const m = new Map<string, Vital>();
    for (const v of sheet.vitals) {
      const at = dayjs(v.at);
      m.set(`${at.format('YYYY-MM-DD')}|${slotOf(at)}`, v);
    }
    return m;
  }, [sheet.vitals]);
  /* ความปวด: ช่องละหนึ่งจุด ใช้ครั้งที่รุนแรงที่สุด (ความปวดสูงต้องไม่หายจากใบ) เก็บครั้งอื่นไว้แสดงเมื่อชี้ */
  const painCell = useMemo(() => {
    const m = new Map<string, PainEntry[]>();
    for (const e of painEntries(sheet)) {
      const at = dayjs(e.at);
      const k = `${at.format('YYYY-MM-DD')}|${slotOf(at)}`;
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [sheet]);
  const medsAt = useMemo(() => {
    const m = new Map<string, Med[]>();
    for (const x of sheet.meds) {
      const at = dayjs(x.at);
      const k = `${at.format('YYYY-MM-DD')}|${slotOf(at)}|${x.prn ? 'prn' : 'cont'}`;
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    return m;
  }, [sheet.meds]);
  const shiftOf = (d: Dayjs, s: string) => sheet.shifts.find(r => r.record_date === dayKey(d) && r.shift === s);
  const dailyOf = (d: Dayjs) => sheet.daily.find(r => r.record_date === dayKey(d));

  const slotX = (di: number, si: number) => XD + di * DAY_W + si * SLOT_W + SLOT_W / 2;

  /* ───── แถวต่าง ๆ ไล่จากบนลงล่าง ───── */
  let y = 64;
  const yTitle = 30;
  const yInfo = 50;
  const yDate = y; y += RH;
  const yAdm = y; y += RH;
  const yOp = y; y += RH;
  const yTime = y; y += RH;
  const yGraph = y; y += GRAPH_H;
  const yRR = y; y += RH;
  const ySys = y; y += RH;
  const yDia = y; y += RH;
  const yNews = y; y += RH;
  const ySpo2 = y; y += RH;
  const yO2 = y; y += RH;
  const yPain = y; y += PAIN_H;
  const yMedH = y; y += RH;
  const yCont = y; y += RH;
  const yPrn = y; y += RH;
  const yBlank = y; y += RH;
  const yWt = y; y += RH;
  const yIn = y; y += RH * 5;
  const yOut = y; y += RH * 5;
  const yStool = y; y += RH;
  const yUrine = y; y += RH;
  const yType = y; y += RH;
  const yFall = y; y += RH;
  const yEnd = y; y += 8;
  const yLegend = y; y += 156;
  const H = y + 10;

  const tY = (t: number) => yGraph + (T_MAX - Math.max(T_MIN, Math.min(T_MAX, t))) / (T_MAX - T_MIN) * GRAPH_H;
  const pulseToT = (p: number) => 35 + (p - 40) / 20;
  const painY = (s: number) => yPain + PAIN_H - (Math.max(0, Math.min(10, s)) / 10) * PAIN_H;

  /* จุดอุณหภูมิ ชีพจร และความปวด เรียงตามเวลาเพื่อลากเส้นต่อกัน */
  const points = (pick: (v: Vital) => number | null, toY: (n: number) => number) => {
    const out: { x: number; y: number; v: number }[] = [];
    days.forEach((d, di) => SLOTS.forEach((_, si) => {
      const v = cell.get(`${dayKey(d)}|${si}`);
      const n = v ? pick(v) : null;
      if (n !== null && n !== undefined) out.push({ x: slotX(di, si), y: toY(n), v: n });
    }));
    return out;
  };
  const temps = points(v => v.t, tY);
  const pulses = points(v => v.p, p => tY(pulseToT(p)));
  const pains: { x: number; y: number; e: PainEntry; all: PainEntry[] }[] = [];
  days.forEach((d, di) => SLOTS.forEach((_, si) => {
    const list = painCell.get(`${dayKey(d)}|${si}`);
    if (!list) return;
    const top = list.reduce((a, b) => (painRank(b) > painRank(a) || (painRank(b) === painRank(a) && b.at > a.at) ? b : a));
    pains.push({ x: slotX(di, si), y: painY(top.v), e: top, all: list });
  }));
  const painTip = (all: PainEntry[]) => all.map(e => `${dayjs(e.at).format('HH:mm')} ${painText(e)} (${PAIN_RANK_TH[painRank(e)]})${e.src === 'vital' ? ' · จากสัญญาณชีพ' : ''}${e.location ? ` · ${e.location}` : ''}${e.reassess !== null ? ` · ประเมินซ้ำ ${e.reassess}` : ''}`).join('\n');
  const path = (ps: { x: number; y: number }[]) => ps.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const opDates = sheet.op_dates.map(d => dayjs(d));
  const dayAfterOp = (d: Dayjs) => {
    const last = opDates.filter(o => !o.isAfter(d, 'day')).pop();
    return last ? String(d.diff(last, 'day')) : '';
  };

  const hline = (yy: number, x1 = X0, x2 = XR, w = 0.6, c = BLUE) => <line x1={x1} x2={x2} y1={yy} y2={yy} stroke={c} strokeWidth={w} />;
  const label = (yy: number, text: React.ReactNode, h = RH, size = 9.5) => <T x={X0 + LBL / 2} y={yy + h / 2} size={size}>{text}</T>;

  /* แถวตัวเลขรายช่องเวลา */
  const slotRow = (yy: number, val: (v: Vital) => string | number | null | undefined) =>
    days.flatMap((d, di) => SLOTS.map((_, si) => {
      const v = cell.get(`${dayKey(d)}|${si}`);
      const s = v ? val(v) : null;
      return s === null || s === undefined || s === '' ? null
        : <T key={`${yy}-${di}-${si}`} x={slotX(di, si)} y={yy + RH / 2} size={7.5}>{s}</T>;
    }));
  const medRow = (yy: number, kind: 'cont' | 'prn') =>
    days.flatMap((d, di) => SLOTS.map((_, si) => {
      const list = medsAt.get(`${dayKey(d)}|${si}|${kind}`);
      if (!list?.length) return null;
      const codes = [...new Set(list.map(m => medCode(m.medication_name)))].join(',');
      return (
        <g key={`${kind}-${di}-${si}`}>
          <title>{list.map(m => `${dayjs(m.at).format('HH:mm')} ${m.medication_name}${m.dose_given ? ` ${m.dose_given}` : ''}`).join('\n')}</title>
          <T x={slotX(di, si)} y={yy + RH / 2} size={codes.length > 3 ? 5.5 : 7.5} weight={600}>{codes}</T>
        </g>
      );
    }));
  const shiftCell = (yy: number, di: number, si: number, val: number | null | undefined) =>
    val === null || val === undefined ? null
      : <T key={`${yy}-${di}-${si}`} x={XD + di * DAY_W + si * SHIFT_W + SHIFT_W / 2} y={yy + RH / 2} size={8}>{val}</T>;
  const sum = (...xs: (number | null | undefined)[]) => {
    const vs = xs.filter((x): x is number => typeof x === 'number');
    return vs.length ? vs.reduce((a, b) => a + b, 0) : null;
  };

  const name = patient?.ptname || patient?.name || patient?.patient_name || '-';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" style={{ background: '#ffffff', fontFamily: 'var(--font-sarabun), Sarabun, sans-serif' }}>
      <T x={W / 2} y={yTitle} size={20} weight={700} color={BLUE}>ฟอร์มปรอท โรงพยาบาลพะเยา</T>
      <T x={X0} y={yInfo} size={10} anchor="start">
        {`ชื่อ-สกุล ${name}   HN ${patient?.hn ?? '-'}   หอผู้ป่วย ${patient?.wardName ?? patient?.ward_name ?? patient?.ward ?? '-'}   เตียง ${patient?.bedno ?? patient?.bed ?? '-'}`}
      </T>

      {/* กรอบนอก */}
      <rect x={X0} y={yDate} width={XR - X0} height={yEnd - yDate} fill="none" stroke={BLUE} strokeWidth={1.6} />

      {/* ───── หัวตาราง ───── */}
      {label(yDate, 'Date')}
      {label(yAdm, 'Day Admission')}
      {label(yOp, 'Day after Operation')}
      <T x={X0 + 30} y={yTime + RH / 2} size={9.5}>Pulse</T>
      <T x={X0 + LBL - 16} y={yTime + RH / 2} size={9.5}>°C</T>
      {[yAdm, yOp, yTime, yGraph].map(yy => <React.Fragment key={yy}>{hline(yy, X0, XR, 0.8)}</React.Fragment>)}
      {days.map((d, di) => {
        const x = XD + di * DAY_W;
        const admDay = admitDate ? d.diff(admitDate.startOf('day'), 'day') + 1 : null;
        return (
          <g key={di}>
            <T x={x + DAY_W / 2} y={yDate + RH / 2} size={9.5} weight={600}>{beShort(d)}</T>
            <T x={x + DAY_W / 2} y={yAdm + RH / 2} size={9.5}>{admDay !== null && admDay >= 1 ? admDay : ''}</T>
            <T x={x + DAY_W / 2} y={yOp + RH / 2} size={9.5}>{dayAfterOp(d)}</T>
            {SLOTS.map((s, si) => <T key={si} x={slotX(di, si)} y={yTime + RH / 2} size={8}>{s}</T>)}
          </g>
        );
      })}

      {/* ───── กราฟอุณหภูมิ/ชีพจร ───── */}
      {Array.from({ length: (T_MAX - T_MIN) * 5 + 1 }, (_, i) => {
        const yy = yGraph + (i / ((T_MAX - T_MIN) * 5)) * GRAPH_H;
        const major = i % 5 === 0;
        return <line key={i} x1={XD} x2={XR} y1={yy} y2={yy} stroke={major ? BLUE : LIGHT} strokeWidth={major ? 0.8 : 0.35} />;
      })}
      {/* ไม่เขียน 41 ที่ขอบบน ชนกับหัว °C */}
      {Array.from({ length: T_MAX - T_MIN }, (_, i) => {
        const t = T_MAX - 1 - i;
        return <T key={t} x={XD - 6} y={tY(t)} size={8.5} anchor="end">{t}</T>;
      })}
      {[50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150].map(p => (
        <T key={p} x={X0 + 58} y={tY(pulseToT(p))} size={8} anchor="start">{p}-</T>
      ))}
      <g transform={`translate(${X0 + 22}, ${yGraph + GRAPH_H / 2}) rotate(-90)`}>
        <text x={0} y={0} fontSize={13} textAnchor="middle" fill={BLUE} dominantBaseline="middle">● = Temperature     X = Pulse</text>
      </g>
      {hline(tY(37), XD, XR, 1.4, RED)}

      {/* เส้นแนวตั้ง: ช่องเวลา (บาง) และวัน (หนา) ตั้งแต่หัวลงถึงส่วนยา */}
      {days.map((_, di) => SLOTS.map((__, si) => si === 0 ? null : (
        <line key={`${di}-${si}`} x1={XD + di * DAY_W + si * SLOT_W} x2={XD + di * DAY_W + si * SLOT_W}
          y1={yTime} y2={yWt} stroke={LIGHT} strokeWidth={0.5} />
      )))}
      {Array.from({ length: 8 }, (_, di) => (
        <line key={`d${di}`} x1={XD + di * DAY_W} x2={XD + di * DAY_W} y1={yDate} y2={yEnd} stroke={BLUE} strokeWidth={di === 0 ? 1.2 : 1.4} />
      ))}

      {temps.length > 1 && <path d={path(temps)} fill="none" stroke={BLUE} strokeWidth={1.2} />}
      {pulses.length > 1 && <path d={path(pulses)} fill="none" stroke={RED} strokeWidth={1.1} strokeDasharray="3 2" />}
      {temps.map((p, i) => (
        <circle key={`t${i}`} cx={p.x} cy={p.y} r={3.2} fill={BLUE}><title>{`T ${p.v} °C`}</title></circle>
      ))}
      {pulses.map((p, i) => (
        <g key={`p${i}`} stroke={RED} strokeWidth={1.4}>
          <title>{`P ${p.v} /min`}</title>
          <line x1={p.x - 3.2} x2={p.x + 3.2} y1={p.y - 3.2} y2={p.y + 3.2} />
          <line x1={p.x - 3.2} x2={p.x + 3.2} y1={p.y + 3.2} y2={p.y - 3.2} />
        </g>
      ))}

      {/* ───── แถวตัวเลข ───── */}
      {[yRR, ySys, yDia, yNews, ySpo2, yO2, yPain, yMedH, yCont, yPrn, yBlank, yWt].map(yy => <React.Fragment key={yy}>{hline(yy, X0, XR, 0.8)}</React.Fragment>)}
      {label(yRR, 'Respiratory rate')}
      <T x={X0 + 22} y={ySys + RH} size={11}>BP</T>
      {hline(yDia, X0 + 44, XR, 0.6)}
      <line x1={X0 + 44} x2={X0 + 44} y1={ySys} y2={yNews} stroke={BLUE} strokeWidth={0.6} />
      <T x={X0 + 92} y={ySys + RH / 2} size={9.5}>Systolic</T>
      <T x={X0 + 92} y={yDia + RH / 2} size={9.5}>Diastolic</T>
      {label(yNews, 'NEWS2 score')}
      {label(ySpo2, 'O₂ saturation')}
      {label(yO2, 'O₂ therapy')}
      {slotRow(yRR, v => v.r)}
      {slotRow(ySys, v => v.bp_s)}
      {slotRow(yDia, v => v.bp_d)}
      {days.flatMap((d, di) => SLOTS.map((_, si) => {
        const v = cell.get(`${dayKey(d)}|${si}`);
        const n = v?.news2_score;
        if (n === null || n === undefined) return null;
        const hit = n >= RRT_NEWS2;
        return <T key={`nw-${di}-${si}`} x={slotX(di, si)} y={yNews + RH / 2} size={hit ? 8.5 : 7.5} weight={hit ? 700 : undefined} color={hit ? RED : INK}>{n}</T>;
      }))}
      {slotRow(ySpo2, v => v.spo2)}
      {slotRow(yO2, v => (v.o2_therapy === 'on_oxygen'
        ? `${O2_SHORT[v.o2_device ?? ''] ?? 'O₂'}${v.o2_flow ? v.o2_flow : ''}`
        : v.o2_therapy === 'room_air' ? 'RA' : null))}

      {/* ───── กราฟความปวด ───── */}
      <T x={X0 + 62} y={yPain + 18} size={9.5}>ระดับความเจ็บปวด</T>
      <T x={X0 + 62} y={yPain + 34} size={9.5}>Pain scale</T>
      {[0, 2, 4, 6, 8, 10].map(s => (
        <g key={s}>
          <line x1={XD} x2={XR} y1={painY(s)} y2={painY(s)} stroke={s === 4 || s === 8 ? RED : LIGHT} strokeWidth={s === 4 || s === 8 ? 1.2 : 0.4} />
          {s > 0 && s < 10 && <T x={XD - 6} y={painY(s)} size={7.5} anchor="end">{s}</T>}
        </g>
      ))}
      {pains.length > 1 && <path d={path(pains)} fill="none" stroke={INK} strokeWidth={0.9} />}
      {pains.map((p, i) => {
        const care = needsCare(p.e);
        const c = care ? RED : INK;
        // ประเมินซ้ำ: วงกลมกลวงขวาของจุดเดิม ต่อด้วยเส้นประ — เห็นว่าหลังจัดการปวดลดลงเท่าไร
        const rx = p.x + SLOT_W * 0.45, ry = p.e.reassess !== null ? painY(p.e.reassess) : 0;
        return (
          <g key={`pa${i}`}>
            <title>{painTip(p.all)}</title>
            {p.all.length > 1 && <circle cx={p.x} cy={p.y} r={5.2} fill="none" stroke={c} strokeWidth={0.9} />}
            {isCpot(p.e)
              ? <path d={`M${p.x},${p.y - 3.8} L${p.x + 3.6},${p.y + 2.6} L${p.x - 3.6},${p.y + 2.6} Z`} fill={c} />
              : <circle cx={p.x} cy={p.y} r={2.6} fill={c} />}
            {(isCpot(p.e) || care) && (
              // จุดชิดขอบบนของแถว ย้ายป้ายไปด้านซ้ายของจุด ไม่ให้ทับเส้นขอบ
              p.y - 8 < yPain + 7
                ? <T x={p.x - 6} y={p.y} size={7.5} weight={700} color={c} anchor="end">{isCpot(p.e) ? `C${p.e.v}` : String(p.e.v)}</T>
                : <T x={p.x} y={p.y - 8} size={7.5} weight={700} color={c}>{isCpot(p.e) ? `C${p.e.v}` : String(p.e.v)}</T>
            )}
            {p.e.reassess !== null && (
              <>
                <line x1={p.x + 2.6} y1={p.y} x2={rx - 2.4} y2={ry} stroke={INK} strokeWidth={0.8} strokeDasharray="2 1.5" />
                <circle cx={rx} cy={ry} r={2.4} fill="#fff" stroke={INK} strokeWidth={1} />
                <T x={rx + 1} y={ry - 7} size={7} color={INK}>{`R${p.e.reassess}`}</T>
              </>
            )}
          </g>
        );
      })}
      {/* ช่องคลิกประเมินความปวด (จอเท่านั้น): ชี้แล้วช่องสว่าง คลิกแล้วเปิดแบบประเมินที่เวลาของช่องนั้น
          ช่องที่ยังไม่ถึงเวลาคลิกไม่ได้ — อยู่บนจุดกราฟ จึงรวมค่าที่ลงไว้ในช่องไว้ใน tooltip ด้วย */}
      {onPainClick && days.map((d, di) => SLOTS.map((h, si) => {
        const from = d.hour(si * 4);
        if (from.isAfter(dayjs())) return null;
        const list = painCell.get(`${dayKey(d)}|${si}`);
        const at = d.hour(h);
        return (
          <rect key={`pc${di}-${si}`} x={XD + di * DAY_W + si * SLOT_W} y={yPain} width={SLOT_W} height={PAIN_H}
            fill="transparent" className="cursor-pointer print:hidden hover:fill-rose-300/30 hover:stroke-rose-500"
            onClick={() => onPainClick(at)}>
            <title>{`ประเมินความปวด ${beShort(d)} ${String(h).padStart(2, '0')}:00 น. (ช่อง ${String(si * 4).padStart(2, '0')}:00–${String(si * 4 + 3).padStart(2, '0')}:59)${list ? `\nที่ลงไว้:\n${painTip(list)}` : ''}`}</title>
          </rect>
        );
      }))}

      {/* ช่องคลิกบันทึกสัญญาณชีพ (จอเท่านั้น): กราฟ T/P ถึงแถว O₂ therapy ทีละช่องเวลา
          ชี้แล้วทั้งแถบตั้งสว่าง คลิกแล้วเปิดแบบบันทึกที่เวลาของช่อง · ช่องในอนาคตคลิกไม่ได้ */}
      {onVitalClick && days.map((d, di) => SLOTS.map((h, si) => {
        const from = d.hour(si * 4);
        if (from.isAfter(dayjs())) return null;
        const list = sheet.vitals.filter(v => { const t = dayjs(v.at); return t.isSame(d, 'day') && slotOf(t) === si; });
        const tip = list.map(v => `${dayjs(v.at).format('HH:mm')}`
          + `${v.t !== null ? ` T ${v.t}` : ''}${v.p !== null ? ` P ${v.p}` : ''}${v.r !== null ? ` R ${v.r}` : ''}`
          + `${v.bp_s !== null && v.bp_d !== null ? ` BP ${v.bp_s}/${v.bp_d}` : ''}${v.spo2 !== null ? ` SpO₂ ${v.spo2}%` : ''}`
          + `${v.news2_score !== null ? ` NEWS2 ${v.news2_score}` : ''}`).join('\n');
        return (
          <rect key={`vc${di}-${si}`} x={XD + di * DAY_W + si * SLOT_W} y={yGraph} width={SLOT_W} height={yPain - yGraph}
            fill="transparent" className="cursor-pointer print:hidden hover:fill-sky-300/25 hover:stroke-sky-600"
            onClick={() => onVitalClick(d.hour(h))}>
            <title>{`${list.length ? 'แก้ไข' : 'บันทึก'}สัญญาณชีพ ${beShort(d)} ${String(h).padStart(2, '0')}:00 น. (ช่อง ${String(si * 4).padStart(2, '0')}:00–${String(si * 4 + 3).padStart(2, '0')}:59)${tip ? `\nที่ลงไว้:\n${tip}` : ''}`}</title>
          </rect>
        );
      }))}

      {/* ───── ยา ───── */}
      {label(yMedH, 'Medication')}
      {label(yCont, 'continuous dose')}
      {label(yPrn, 'prn dose')}
      {medRow(yCont, 'cont')}
      {medRow(yPrn, 'prn')}

      {/* ───── Wt/Ht/Diet (รายวัน) ───── */}
      {label(yWt, 'Wt/Ht/Diet')}
      {days.map((d, di) => {
        const r = dailyOf(d);
        const parts = [r?.weight_kg, r?.height_cm].filter(v => v !== null && v !== undefined).join('/');
        const txt = [parts, r?.diet].filter(Boolean).join(' ');
        return txt ? <T key={di} x={XD + di * DAY_W + DAY_W / 2} y={yWt + RH / 2} size={8}>{txt.slice(0, 26)}</T> : null;
      })}

      {/* ───── I/O รายเวร ───── */}
      {hline(yIn, X0, XR, 1.4)}
      {hline(yOut, X0, XR, 1.4)}
      {hline(yStool, X0, XR, 1.4)}
      {Array.from({ length: 4 }, (_, i) => <React.Fragment key={`ih${i}`}>{hline(yIn + RH * (i + 1), X0 + 26, XR, 0.5)}</React.Fragment>)}
      {Array.from({ length: 4 }, (_, i) => <React.Fragment key={`oh${i}`}>{hline(yOut + RH * (i + 1), X0 + 26, XR, 0.5)}</React.Fragment>)}
      <line x1={X0 + 26} x2={X0 + 26} y1={yIn} y2={yStool} stroke={BLUE} strokeWidth={0.8} />
      <g transform={`translate(${X0 + 13}, ${yIn + RH * 2.5}) rotate(-90)`}>
        <text x={0} y={0} fontSize={11} textAnchor="middle" fill={BLUE} dominantBaseline="middle">Fluid intake</text>
      </g>
      <g transform={`translate(${X0 + 13}, ${yOut + RH * 2.5}) rotate(-90)`}>
        <text x={0} y={0} fontSize={11} textAnchor="middle" fill={BLUE} dominantBaseline="middle">Fluid output</text>
      </g>
      {[['Oral fluid', 0], ['Parenteral', 1], ['Total', 4]].map(([t, i]) => (
        <T key={`il${t}`} x={X0 + 26 + (LBL - 26) / 2} y={yIn + RH * Number(i) + RH / 2} size={9.5}>{t}</T>
      ))}
      {[['Urine', 0], ['Drainage', 1], ['Total', 4]].map(([t, i]) => (
        <T key={`ol${t}`} x={X0 + 26 + (LBL - 26) / 2} y={yOut + RH * Number(i) + RH / 2} size={9.5}>{t}</T>
      ))}
      {days.map((_, di) => [1, 2].map(si => (
        <line key={`sh${di}-${si}`} x1={XD + di * DAY_W + si * SHIFT_W} x2={XD + di * DAY_W + si * SHIFT_W}
          y1={yIn} y2={yStool} stroke={LIGHT} strokeWidth={0.6} />
      )))}
      {days.map((d, di) => SHIFTS.map((s, si) => {
        const r = shiftOf(d, s);
        if (!r) return null;
        const inTotal = sum(r.oral_ml, r.parenteral_ml, r.intake_other1_ml, r.intake_other2_ml);
        const outTotal = sum(r.urine_ml, r.drainage_ml, r.output_other1_ml, r.output_other2_ml);
        return (
          <g key={`io${di}-${si}`}>
            {shiftCell(yIn, di, si, r.oral_ml)}
            {shiftCell(yIn + RH, di, si, r.parenteral_ml)}
            {shiftCell(yIn + RH * 2, di, si, r.intake_other1_ml)}
            {shiftCell(yIn + RH * 3, di, si, r.intake_other2_ml)}
            {shiftCell(yIn + RH * 4, di, si, inTotal)}
            {shiftCell(yOut, di, si, r.urine_ml)}
            {shiftCell(yOut + RH, di, si, r.drainage_ml)}
            {shiftCell(yOut + RH * 2, di, si, r.output_other1_ml)}
            {shiftCell(yOut + RH * 3, di, si, r.output_other2_ml)}
            {shiftCell(yOut + RH * 4, di, si, outTotal)}
          </g>
        );
      }))}
      {/* ชื่อช่อง "อื่น ๆ" ที่หอตั้งเอง — ใช้ชื่อแรกที่พบในใบนี้ */}
      {(['intake_other1_label', 'intake_other2_label', 'output_other1_label', 'output_other2_label'] as const).map((k, i) => {
        const lbl = sheet.shifts.find(r => r[k])?.[k];
        const yy = (i < 2 ? yIn : yOut) + RH * (2 + (i % 2)) + RH / 2;
        return lbl ? <T key={k} x={X0 + 26 + (LBL - 26) / 2} y={yy} size={8.5}>{lbl.slice(0, 18)}</T> : null;
      })}

      {/* ───── รายวัน ───── */}
      {[yUrine, yType, yFall].map(yy => <React.Fragment key={yy}>{hline(yy, X0, XR, 0.8)}</React.Fragment>)}
      {label(yStool, 'Stool')}
      {label(yUrine, 'Urine')}
      {label(yType, 'ประเภทผู้ป่วย')}
      {label(yFall, 'Fall risk (Morse)')}
      {/* ความเสี่ยงพลัดตกหกล้ม วันละครั้ง: คะแนน + ระดับ (L/M/H) — สีแดงเมื่อเสี่ยงสูง */}
      {days.map((d, di) => {
        const f = (sheet.falls ?? []).filter(x => dayjs(x.at).isSame(d, 'day')).pop();
        if (!f) return null;
        const lv = FALL_LV[f.risk_level] ?? FALL_LV.low;
        return (
          <T key={`fl${di}`} x={XD + di * DAY_W + DAY_W / 2} y={yFall + RH / 2} size={9.5} weight={700} color={lv.color}>
            {`${f.total_score} ${lv.short}`}
          </T>
        );
      })}
      {days.map((d, di) => {
        const r = dailyOf(d);
        const cx = XD + di * DAY_W + DAY_W / 2;
        return (
          <g key={`dy${di}`}>
            {r?.stool_count !== null && r?.stool_count !== undefined && <T x={cx} y={yStool + RH / 2} size={9}>{r.stool_count}</T>}
            {r?.urine_count !== null && r?.urine_count !== undefined && <T x={cx} y={yUrine + RH / 2} size={9}>{r.urine_count}</T>}
            {r?.patient_type && <T x={cx} y={yType + RH / 2} size={9.5} weight={700}>{r.patient_type}</T>}
          </g>
        );
      })}

      {/* แถวยา (Medication / continuous / prn dose) คลิกทีละวัน → บันทึกการให้ยา (MAR) ของวันนั้น · วันในอนาคตคลิกไม่ได้ */}
      {onMedClick && days.map((d, di) => {
        if (d.isAfter(dayjs(), 'day')) return null;
        const given = sheet.meds.filter(m => dayjs(m.at).isSame(d, 'day'));
        const line = (prn: boolean) => given.filter(m => m.prn === prn)
          .map(m => `${dayjs(m.at).format('HH:mm')} ${m.medication_name}${m.dose_given ? ` ${m.dose_given}` : ''}`).join('\n');
        const cont = line(false), prn = line(true);
        return (
          <rect key={`mc${di}`} x={XD + di * DAY_W} y={yMedH} width={DAY_W} height={yBlank - yMedH}
            fill="transparent" className="cursor-pointer print:hidden hover:fill-violet-200/40 hover:stroke-violet-500"
            onClick={() => onMedClick(d)}>
            <title>{`บันทึกการให้ยา ${beShort(d)}${cont ? `\ncontinuous dose:\n${cont}` : ''}${prn ? `\nprn dose:\n${prn}` : ''}${!cont && !prn ? '\n(ยังไม่มีการให้ยาในวันนี้)' : ''}`}</title>
          </rect>
        );
      })}

      {/* ชั้นคลิกแก้ไข (จอเท่านั้น): I/O ทีละวัน+เวร, รายวันทีละวัน */}
      {onCellClick && days.map((d, di) => (
        <g key={`hit${di}`} className="print:hidden">
          {SHIFTS.map((s, si) => (
            <rect key={s} x={XD + di * DAY_W + si * SHIFT_W} y={yIn} width={SHIFT_W} height={yStool - yIn}
              fill="transparent" className="cursor-pointer hover:fill-sky-200/40"
              onClick={() => onCellClick({ tab: 'io', date: dayKey(d), shift: s })}>
              <title>{`${shiftOf(d, s) ? 'แก้ไข' : 'บันทึก'} I/O ${beShort(d)} เวร${s}`}</title>
            </rect>
          ))}
          {[[yWt, yIn], [yStool, yFall]].map(([a, b]) => (
            <rect key={a} x={XD + di * DAY_W} y={a} width={DAY_W} height={b - a}
              fill="transparent" className="cursor-pointer hover:fill-sky-200/40"
              onClick={() => onCellClick({ tab: 'daily', date: dayKey(d), shift: SHIFTS[0] })}>
              <title>{`${dailyOf(d) ? 'แก้ไข' : 'บันทึก'}ข้อมูลรายวัน ${beShort(d)}`}</title>
            </rect>
          ))}
        </g>
      ))}

      {onFallClick && days.map((d, di) => {
        if (d.isAfter(dayjs(), 'day')) return null;
        const f = (sheet.falls ?? []).filter(x => dayjs(x.at).isSame(d, 'day')).pop();
        return (
          <rect key={`fc${di}`} x={XD + di * DAY_W} y={yFall} width={DAY_W} height={RH}
            fill="transparent" className="cursor-pointer print:hidden hover:fill-orange-200/50 hover:stroke-orange-500"
            onClick={() => onFallClick(d)}>
            <title>{f
              ? `แก้ไขการประเมินพลัดตกหกล้ม ${beShort(d)}\nMorse ${f.total_score} คะแนน · ${(FALL_LV[f.risk_level] ?? FALL_LV.low).th} · ${dayjs(f.at).format('HH:mm')} น.${f.nurse_name ? ` · ${f.nurse_name}` : ''}`
              : `ประเมินความเสี่ยงพลัดตกหกล้ม ${beShort(d)} (วันละ 1 ครั้ง)`}</title>
          </rect>
        );
      })}

      {/* ───── คำอธิบายท้ายใบ ───── */}
      <rect x={X0} y={yLegend} width={XR - X0} height={156} fill="none" stroke={BLUE} strokeWidth={1.6} />
      <line x1={X0 + 320} x2={X0 + 320} y1={yLegend} y2={yLegend + 112} stroke={BLUE} strokeWidth={1.4} />
      <line x1={X0 + 720} x2={X0 + 720} y1={yLegend} y2={yLegend + 112} stroke={BLUE} strokeWidth={1.4} />
      <T x={X0 + 18} y={yLegend + 18} size={11} anchor="start" color={BLUE}>ประเภทผู้ป่วย :</T>
      <T x={X0 + 28} y={yLegend + 42} size={10} anchor="start" color={BLUE}>CI = ผู้ป่วยหนัก</T>
      <T x={X0 + 170} y={yLegend + 42} size={10} anchor="start" color={BLUE}>SI = ผู้ป่วยกึ่งหนัก</T>
      <T x={X0 + 28} y={yLegend + 64} size={10} anchor="start" color={BLUE}>MI = ผู้ป่วยระดับปานกลาง</T>
      <T x={X0 + 28} y={yLegend + 86} size={10} anchor="start" color={BLUE}>CL = ผู้ป่วยระยะพักฟื้น</T>
      <T x={X0 + 338} y={yLegend + 18} size={11} anchor="start" color={BLUE}>Medication :</T>
      {[['Mi', 'MO - IR or MO syrup'], ['M', 'Morphine IV'], ['T', 'Tramadol'], ['D', 'Diclofenac']].map(([c, n], i) => (
        <T key={c} x={X0 + 346} y={yLegend + 40 + i * 18} size={9.5} anchor="start" color={BLUE}>{`${c} = ${n}`}</T>
      ))}
      {[['Ms', 'MST'], ['P', 'Pethidine'], ['F', 'Fentanyl']].map(([c, n], i) => (
        <T key={c} x={X0 + 560} y={yLegend + 40 + i * 18} size={9.5} anchor="start" color={BLUE}>{`${c} = ${n}`}</T>
      ))}
      <T x={X0 + 738} y={yLegend + 18} size={11} anchor="start" color={BLUE}>สัญลักษณ์ :</T>
      <T x={X0 + 746} y={yLegend + 40} size={9.5} anchor="start" color={BLUE}>● อุณหภูมิ   X ชีพจร</T>
      <T x={X0 + 746} y={yLegend + 58} size={9.5} anchor="start" color={BLUE}>O₂: RA ห้อง · C cannula · M mask</T>
      <T x={X0 + 746} y={yLegend + 76} size={9.5} anchor="start" color={BLUE}>HF HFNC · Vent เครื่องช่วยหายใจ</T>
      <T x={X0 + 560} y={yLegend + 94} size={9} anchor="start" color={BLUE}>Fall risk: L &lt;25 · M 25-44 · H ≥45</T>
      {/* ความปวด: แถวล่างของกล่องคำอธิบาย เต็มความกว้าง */}
      <line x1={X0} x2={XR} y1={yLegend + 112} y2={yLegend + 112} stroke={BLUE} strokeWidth={1.2} />
      <T x={X0 + 18} y={yLegend + 128} size={10} anchor="start" color={BLUE} weight={700}>ความปวด :</T>
      <circle cx={X0 + 92} cy={yLegend + 128} r={2.6} fill={INK} />
      <T x={X0 + 99} y={yLegend + 128} size={9} anchor="start" color={BLUE}>NRS 0-10</T>
      <path d={`M${X0 + 162},${yLegend + 124.2} L${X0 + 165.6},${yLegend + 130.6} L${X0 + 158.4},${yLegend + 130.6} Z`} fill={INK} />
      <T x={X0 + 170} y={yLegend + 128} size={9} anchor="start" color={BLUE}>C = CPOT 0-8 (คะแนนจริง ไม่แปลงสเกล)</T>
      <circle cx={X0 + 364} cy={yLegend + 128} r={2.4} fill="#fff" stroke={INK} strokeWidth={1} />
      <T x={X0 + 371} y={yLegend + 128} size={9} anchor="start" color={BLUE}>R = คะแนนประเมินซ้ำหลังจัดการ</T>
      <circle cx={X0 + 528} cy={yLegend + 128} r={4.6} fill="none" stroke={INK} strokeWidth={0.9} />
      <circle cx={X0 + 528} cy={yLegend + 128} r={2} fill={INK} />
      <T x={X0 + 537} y={yLegend + 128} size={9} anchor="start" color={BLUE}>วงล้อม = ช่องนี้มีหลายค่า แสดงค่าที่ปวดมากที่สุด</T>
      <T x={X0 + 18} y={yLegend + 144} size={9} anchor="start" color={RED}>สีแดง = ปวดปานกลางขึ้นไป (NRS ≥ 4 · CPOT ≥ 3) ต้องได้รับการจัดการและประเมินซ้ำ · ชี้ที่จุดเพื่อดูทุกค่าในช่อง</T>
      <T x={X0 + 746} y={yLegend + 94} size={8.5} anchor="start" color={BLUE}>{`พิมพ์ ${dayjs().format('D/M/')}${dayjs().year() + 543} ${dayjs().format('HH:mm')}`}</T>
    </svg>
  );
}

const authHeaders = (): Record<string, string> => {
  const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function GraphicSheet({ an }: { an: string }) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [start, setStart] = useState<Dayjs | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editPos, setEditPos] = useState<EditPos | null>(null);
  /* ปุ่มบันทึก: เปิดที่วันนี้ เวรปัจจุบัน (ถ้าวันนี้อยู่ในใบ) — คลิกช่องในใบ: เปิดที่ช่องนั้น */
  const openEdit = useCallback((pos?: EditPos) => {
    if (!start) return;
    const today = dayjs().startOf('day');
    const h = dayjs().hour();
    setEditPos(prev => pos ?? {
      tab: prev?.tab ?? 'io',
      date: (today.isBefore(start) || today.isAfter(start.add(6, 'day')) ? start : today).format('YYYY-MM-DD'),
      shift: h < 8 ? 'ดึก' : h < 16 ? 'เช้า' : 'บ่าย',
    });
    setEditOpen(true);
  }, [start]);

  const admitDate = useMemo(() => {
    const raw = patient?.admitDateTimeIso || patient?.reg_datetime || patient?.regdate;
    return raw && dayjs(raw).isValid() ? dayjs(raw).startOf('day') : null;
  }, [patient]);

  /* ใบเริ่มนับจากวันรับไว้ ทีละ 7 วันเหมือนกระดาษ — เปิดมาเจอใบที่มีวันนี้ */
  useEffect(() => {
    (async () => {
      let adm: Dayjs | null = null;
      try {
        const res = await axios.post('/api/v1/patients/patient-by-an', { an }, { headers: authHeaders() });
        const p = Array.isArray(res.data?.data) ? res.data.data[0] : res.data?.data;
        if (p) {
          setPatient(p);
          const raw = p.admitDateTimeIso || p.reg_datetime || p.regdate;
          if (raw && dayjs(raw).isValid()) adm = dayjs(raw).startOf('day');
        }
      } catch { /* ไม่มีข้อมูลผู้ป่วยก็ยังดูใบได้ เริ่มจาก 6 วันก่อนวันนี้ */ }
      const today = dayjs().startOf('day');
      if (adm && !adm.isAfter(today)) {
        const k = Math.floor(today.diff(adm, 'day') / 7);
        setStart(adm.add(k * 7, 'day'));
      } else {
        setStart(today.subtract(6, 'day'));
      }
    })();
  }, [an]);

  /* NEWS2 ≥ 5 ที่ยังไม่มีบันทึกการตาม RRT (72 ชม.) — เตือนบนใบ */
  const [rrtPending, setRrtPending] = useState<{ id: number; record_datetime: string; news2_score: number; qsofa: { score: number } }[]>([]);
  const load = useCallback(async () => {
    if (!start) return;
    setLoading(true);
    // ไม่ให้การโหลด RRT ล้มทำให้ใบไม่ขึ้น
    void axios.get(`/api/v1/nursing-records/rrt/${encodeURIComponent(an)}`, { headers: authHeaders() })
      .then(r => setRrtPending(r.data?.data?.pending ?? []))
      .catch(() => setRrtPending([]));
    try {
      const res = await axios.get(`/api/v1/nursing-records/graphic/${an}`, { params: { from: start.format('YYYY-MM-DD') }, headers: authHeaders() });
      setSheet(res.data.data);
      setError(null);
    } catch (e) {
      setError((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'โหลดฟอร์มปรอทไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [an, start]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- โหลดใบใหม่เมื่อเลื่อนสัปดาห์
  useEffect(() => { void load(); }, [load]);

  /* รายละเอียดความปวด (ตำแหน่ง ลักษณะ การจัดการ ประเมินซ้ำ) ลงในลิ้นชักบนหน้านี้ ไม่เปิดแท็บใหม่ (ใช้บนแท็บเล็ตต่อเนื่อง)
     บันทึก/ลบแล้วโหลดใบใหม่ จุดในกราฟขึ้นทันที */
  const [painOpen, setPainOpen] = useState(false);
  /* ปุ่มด้านบน = เวลาปัจจุบัน · คลิกช่องในกราฟ = เวลาของช่องนั้น */
  const [painAt, setPainAt] = useState<Dayjs | null>(null);
  const openPain = useCallback((at?: Dayjs) => { setPainAt(at ?? null); setPainOpen(true); }, []);
  /* สัญญาณชีพ: แบบเดียวกับความปวด — ลิ้นชักบนหน้านี้ คลิกช่องในกราฟ = เปิดที่เวลาของช่อง (มีค่าแล้วเปิดมาให้แก้) */
  const [vitalOpen, setVitalOpen] = useState(false);
  const [vitalAt, setVitalAt] = useState<Dayjs | null>(null);
  const openVital = useCallback((at?: Dayjs) => { setVitalAt(at ?? null); setVitalOpen(true); }, []);
  /* บันทึกการให้ยา (MAR) — คลิกแถวยาของวันใด เปิด MAR วันนั้นในลิ้นชัก */
  const [medOpen, setMedOpen] = useState(false);
  const [medDay, setMedDay] = useState<Dayjs | null>(null);
  const openMed = useCallback((day?: Dayjs) => { setMedDay((day ?? dayjs()).startOf('day')); setMedOpen(true); }, []);
  /* การตาม RRT (NEWS2 ≥ 5) และคัดกรอง sepsis — ลิ้นชักบนหน้านี้ */
  const [rrtOpen, setRrtOpen] = useState(false);
  /* ความเสี่ยงพลัดตกหกล้ม: คลิกช่องวัน = เปิดแบบประเมินของวันนั้น (วันนี้ = เวลาปัจจุบัน, วันก่อน = 08:00) */
  const [fallOpen, setFallOpen] = useState(false);
  const [fallAt, setFallAt] = useState<Dayjs | null>(null);
  const openFall = useCallback((day?: Dayjs) => {
    const now = dayjs();
    setFallAt(!day || day.isSame(now, 'day') ? now : day.startOf('day').hour(8));
    setFallOpen(true);
  }, []);

  const name = patient?.ptname || patient?.name || patient?.patient_name || '-';

  return (
    <div className="bg-slate-50 min-h-screen font-sans print:bg-white">
      <div className="print:hidden"><Navbar /></div>
      <style>{`@media print { @page { size: A4 portrait; margin: 6mm; } }`}</style>
      <div className="p-4 max-w-6xl mx-auto print:p-0 print:max-w-none">
        <div className="print:hidden bg-linear-to-r from-[#004d45] via-[#006b5f] to-[#00796b] rounded-xl shadow-md mb-4 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 shrink-0 bg-white/20 rounded-xl flex items-center justify-center">
              <PiChartLineBold className="text-white text-xl" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white m-0 leading-snug">ฟอร์มปรอท (Graphic sheet)</h1>
              <div className="text-white/90 text-sm">{name} · HN {patient?.hn ?? '-'} · AN {an}</div>
            </div>
          </div>
        </div>

        <div className="print:hidden flex flex-wrap items-center gap-2 mb-3">
          <Space.Compact>
            <Button icon={<PiCaretLeftBold />} disabled={!start} onClick={() => setStart(s => s?.subtract(7, 'day') ?? s)}>7 วันก่อน</Button>
            <DatePicker value={start} format="DD/MM/YYYY" allowClear={false} onChange={d => d && setStart(d.startOf('day'))} />
            <Button disabled={!start} onClick={() => setStart(s => s?.add(7, 'day') ?? s)}>7 วันถัดไป <PiCaretRightBold className="inline" /></Button>
          </Space.Compact>
          <Button type="primary" icon={<PiPencilSimpleBold />} onClick={() => openEdit()} disabled={!sheet}>บันทึก / แก้ไข I/O รายวัน</Button>
          <Button icon={<PiHeartbeatBold />} onClick={() => openVital()}>บันทึกสัญญาณชีพ</Button>
          <Button icon={<PiPillBold />} onClick={() => openMed()}>บันทึกการให้ยา</Button>
          <Button icon={<PiThermometerBold />} onClick={() => openPain()}>ประเมินความปวด</Button>
          <Button icon={<PiPersonSimpleWalkBold />} onClick={() => openFall()}>Fall risk</Button>
          <Button icon={<PiPhoneCallBold />} danger={rrtPending.length > 0} onClick={() => setRrtOpen(true)}>
            RRT{rrtPending.length > 0 ? ` (ค้าง ${rrtPending.length})` : ''}
          </Button>
          <Button icon={<PiPrinterBold />} onClick={() => window.print()} disabled={!sheet}>พิมพ์</Button>
          <span className="text-xs text-gray-500">สัญญาณชีพ ความปวด และยา ดึงจากหน้าสัญญาณชีพ แบบประเมินความปวด และ MAR อัตโนมัติ · คลิกช่องเวลาในกราฟ T/P (ถึงแถว O₂) เพื่อบันทึก/แก้สัญญาณชีพ · คลิกช่องเวลาในแถวความปวดเพื่อประเมินที่เวลานั้น · คลิกช่อง I/O หรือแถวรายวันในใบเพื่อแก้ค่าที่ลงไว้ · แถวยา (continuous / prn dose) คลิกเพื่อบันทึกการให้ยาของวันนั้น · แถวสุดท้าย Fall risk คลิกเพื่อประเมิน (วันละครั้ง)</span>
        </div>

        {sheet && !sheet.storage_ready && (
          <Alert className="print:hidden! mb-3" type="warning" showIcon title="ยังบันทึก I/O และข้อมูลรายวันไม่ได้"
            description="เซิร์ฟเวอร์ยังไม่ได้สร้างตารางของฟอร์มปรอท (sql/2026-11-26_nursing_graphic_sheet.sql) ส่วนสัญญาณชีพยังแสดงได้ตามปกติ" />
        )}
        {error && <Alert className="print:hidden! mb-3" type="error" showIcon title={error} />}
        {rrtPending.length > 0 && (
          <Alert className="print:hidden! mb-3" type="error" showIcon
            title={<b>NEWS2 ≥ {RRT_NEWS2} ยังไม่มีบันทึกการตาม RRT</b>}
            description={<span className="text-sm">
              {rrtPending.slice(0, 4).map(t => `${dayjs(t.record_datetime).format('DD/MM HH:mm')} NEWS2 ${t.news2_score}${t.qsofa.score >= 2 ? ` (qSOFA ${t.qsofa.score})` : ''}`).join(' · ')}
              {rrtPending.length > 4 ? ` และอีก ${rrtPending.length - 4} ครั้ง` : ''}
            </span>}
            action={<Button size="small" danger type="primary" onClick={() => setRrtOpen(true)}>บันทึกการตาม RRT</Button>} />
        )}
        {sheet && <PainHandover sheet={sheet} />}

        {/* ใบแคบกว่า 760px อ่านไม่ออก บนมือถือจึงเลื่อนซ้ายขวาแทนการย่อ */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 print:border-0 print:overflow-visible" style={{ background: '#ffffff' }}>
          <div className="min-w-[760px] p-2 print:p-0 print:min-w-0">
            {!sheet || !start ? (
              <div className="py-24 text-center"><Spin /></div>
            ) : (
              <Spin spinning={loading}>
                <SheetSvg sheet={sheet} start={start} admitDate={admitDate} patient={patient} onPainClick={openPain} onVitalClick={openVital} onFallClick={openFall} onMedClick={openMed} onCellClick={openEdit} />
              </Spin>
            )}
          </div>
        </div>
      </div>

      <Drawer open={painOpen} onClose={() => setPainOpen(false)} size="min(1100px, 100vw)" destroyOnHidden
        title={<span>ประเมินความปวด <span className="font-normal text-gray-500 text-sm">· {name} · HN {patient?.hn ?? '-'} · AN {an}</span></span>}
        styles={{ body: { background: '#f8fafc', padding: '12px 12px 0' } }}>
        <PainAssessment key={painAt?.valueOf() ?? 'now'} an={an} embedded initialAt={painAt ?? undefined} onSaved={() => void load()} />
      </Drawer>

      <Drawer open={vitalOpen} onClose={() => setVitalOpen(false)} size="min(1100px, 100vw)" destroyOnHidden
        title={<span>บันทึกสัญญาณชีพ <span className="font-normal text-gray-500 text-sm">· {name} · HN {patient?.hn ?? '-'} · AN {an}</span></span>}
        styles={{ body: { background: '#f8fafc', padding: '12px 12px 0' } }}>
        <VitalSignsRecord key={vitalAt?.valueOf() ?? 'now'} an={an} embedded initialAt={vitalAt ?? undefined} onSaved={() => void load()} />
      </Drawer>

      <Drawer open={medOpen} onClose={() => setMedOpen(false)} size="min(1200px, 100vw)" destroyOnHidden
        title={<span>บันทึกการให้ยา (MAR){medDay ? ` · ${beShort(medDay)}` : ''} <span className="font-normal text-gray-500 text-sm">· {name} · HN {patient?.hn ?? '-'} · AN {an}</span></span>}
        styles={{ body: { background: '#f8fafc', padding: 12 } }}>
        {medDay && <MedicationRecord key={medDay.valueOf()} an={an} embedded initialDate={medDay} onSaved={() => void load()} />}
      </Drawer>

      <Drawer open={rrtOpen} onClose={() => setRrtOpen(false)} size="min(1100px, 100vw)" destroyOnHidden
        title={<span>การตาม RRT (NEWS2 ≥ {RRT_NEWS2}) และคัดกรอง sepsis <span className="font-normal text-gray-500 text-sm">· {name} · HN {patient?.hn ?? '-'} · AN {an}</span></span>}
        styles={{ body: { background: '#f8fafc', padding: '12px 12px 0' } }}>
        <RrtRecord an={an} wardCode={patient?.ward ?? null} wardName={patient?.wardName ?? patient?.ward_name ?? null} onSaved={() => void load()} />
      </Drawer>

      <Drawer open={fallOpen} onClose={() => setFallOpen(false)} size="min(1100px, 100vw)" destroyOnHidden
        title={<span>ประเมินความเสี่ยงพลัดตกหกล้ม (Morse){fallAt ? ` · ${beShort(fallAt)}` : ''} <span className="font-normal text-gray-500 text-sm">· {name} · HN {patient?.hn ?? '-'} · AN {an}</span></span>}
        styles={{ body: { background: '#f8fafc', padding: '12px 12px 0' } }}>
        {fallAt && <FallRiskAssessment key={fallAt.valueOf()} an={an} embedded initialAt={fallAt} onSaved={() => void load()} />}
      </Drawer>

      {sheet && start && editPos && (
        <EditDrawer open={editOpen} onClose={() => setEditOpen(false)} an={an} start={start} sheet={sheet}
          patient={patient} pos={editPos} onPos={setEditPos} onSaved={() => void load()} />
      )}
    </div>
  );
}

/**
 * สรุปความปวดสำหรับส่งเวร (จอเท่านั้น): ครั้งล่าสุดในใบนี้ และเตือนถ้าปวดปานกลางขึ้นไปแต่ยังไม่มีการประเมินซ้ำ
 * "ประเมินซ้ำแล้ว" = มีคะแนนประเมินซ้ำในบันทึกนั้น หรือมีการประเมินครั้งใหม่ตามมา
 */
function PainHandover({ sheet }: { sheet: Sheet }) {
  const list = painEntries(sheet);
  if (!list.length) return null;
  const last = list[list.length - 1];
  const fmt = (e: PainEntry) => `${dayjs(e.at).format('DD/MM HH:mm')} น. · ${painText(e)} (${PAIN_RANK_TH[painRank(e)]})${e.location ? ` · ${e.location}` : ''}${e.src === 'vital' ? ' · จากสัญญาณชีพ' : ''}`;
  const pending = needsCare(last) && last.reassess === null;
  const after = last.reassess !== null ? { ...last, v: last.reassess } : null;
  const recent = list.slice(-6).reverse();
  return (
    <Alert className="print:hidden! mb-3" type={pending ? 'warning' : 'info'} showIcon
      title={<span className="font-semibold">ความปวดล่าสุด (ส่งเวร): {fmt(last)}</span>}
      description={
        <div className="text-sm space-y-1">
          {after && <div>ประเมินซ้ำหลังจัดการ: <b>{after.v}</b> ({PAIN_RANK_TH[painRank(after)]})</div>}
          {pending && <div className="font-semibold text-red-700">ปวดปานกลางขึ้นไป ยังไม่มีคะแนนประเมินซ้ำหลังจัดการ — เวรถัดไปติดตามและประเมินซ้ำ</div>}
          <div className="text-xs text-gray-600">
            ย้อนหลัง: {recent.map(e => `${dayjs(e.at).format('DD/MM HH:mm')} ${isCpot(e) ? `C${e.v}` : e.v}${e.reassess !== null ? `→R${e.reassess}` : ''}`).join(' · ')}
          </div>
        </div>
      } />
  );
}

/**
 * ช่องปริมาณสารน้ำ: แถบเลื่อนเป็นหลัก (step 10 ml) + ปุ่ม −/+ ทีละ 50 ml + ช่องตัวเลขไว้แก้ให้ตรงเป๊ะ
 * แถบเลื่อนอย่างเดียวเลื่อนให้ได้เลขตรงยาก (เช่น 350, 1,240) จึงมีทางกดและพิมพ์ด้วย
 * ว่าง (null) = ยังไม่ได้บันทึก ต่างจาก 0 ml ที่บันทึกแล้วว่าไม่มี ปุ่ม "ล้าง" ทำให้กลับเป็นว่าง
 * เกิน 2,000 แถบจะยืดตามค่าให้เอง (ทีละ 500)
 */
function VolumeInput({ value, onChange }: { value?: number | null; onChange?: (v: number | null) => void }) {
  const v = value ?? null;
  const max = Math.max(2000, Math.ceil(((v ?? 0) + 1) / 500) * 500);
  const set = (n: number | null) => onChange?.(n === null ? null : Math.max(0, Math.min(20000, Math.round(n))));
  return (
    <div>
      <Slider min={0} max={max} step={10} value={v ?? 0} onChange={n => set(n)}
        className={`mx-1! my-1! ${v === null ? 'opacity-50' : ''}`}
        tooltip={{ formatter: n => `${n} ml` }}
        marks={{ 0: '0', 500: '500', 1000: '1000', 1500: '1500', [max]: String(max) }} />
      <div className="flex items-center gap-1.5 mt-7">
        <Button icon={<PiMinusBold />} aria-label="ลด 50 ml" disabled={!v} onClick={() => set((v ?? 0) - 50)} />
        <InputNumber min={0} max={20000} value={v} placeholder="ไม่ได้บันทึก" suffix="ml" className="w-36!"
          onChange={n => set(typeof n === 'number' ? n : null)} />
        <Button icon={<PiPlusBold />} aria-label="เพิ่ม 50 ml" onClick={() => set((v ?? 0) + 50)} />
        {v !== null && <Button type="link" size="small" onClick={() => set(null)}>ล้าง</Button>}
      </div>
    </div>
  );
}

function EditDrawer({ open, onClose, an, start, sheet, patient, pos, onPos, onSaved }: {
  open: boolean; onClose: () => void; an: string; start: Dayjs; sheet: Sheet; patient: Patient | null;
  pos: EditPos; onPos: (p: EditPos) => void; onSaved: () => void;
}) {
  // message ต้องมาจาก App.useApp() (ThemeProvider ห่อ <App> ไว้แล้ว) ตัว static ไม่ได้รับธีม/context
  const { message } = App.useApp();
  const { tab, shift } = pos;
  const key = pos.date;
  const setTab = (t: 'io' | 'daily') => onPos({ ...pos, tab: t });
  const [saving, setSaving] = useState(false);
  const [ioForm] = Form.useForm();
  const [dayForm] = Form.useForm();
  const weekDays = Array.from({ length: 7 }, (_, i) => start.add(i, 'day').format('YYYY-MM-DD'));
  const hasIo = (d: string, s: string) => sheet.shifts.some(x => x.record_date === d && x.shift === s);
  const hasDaily = (d: string) => sheet.daily.some(x => x.record_date === d);
  /* รายการที่ลงไว้ในใบนี้ เรียงตามวัน/เวร — กดเพื่อเปิดมาแก้ */
  const ioDone = weekDays.flatMap(d => SHIFTS.filter(s => hasIo(d, s)).map(s => ({ d, s })));
  const dailyDone = weekDays.filter(hasDaily);

  /* เปลี่ยนวันหรือเวร = ดึงค่าที่บันทึกไว้แล้วมาให้แก้ ไม่ใช่เริ่มว่างแล้วบันทึกทับ */
  useEffect(() => {
    const r = sheet.shifts.find(x => x.record_date === key && x.shift === shift);
    ioForm.resetFields();
    if (r) ioForm.setFieldsValue(r);
  }, [key, shift, sheet, ioForm]);
  useEffect(() => {
    const r = sheet.daily.find(x => x.record_date === key);
    dayForm.resetFields();
    if (r) dayForm.setFieldsValue(r);
  }, [key, sheet, dayForm]);

  const ward = { ward_code: patient?.ward ?? null, ward_name: patient?.wardName ?? patient?.ward_name ?? null };
  const save = async () => {
    setSaving(true);
    try {
      if (tab === 'io') {
        const v = await ioForm.validateFields();
        await axios.put('/api/v1/nursing-records/graphic/shift', { an, record_date: key, shift, ...ward, ...v }, { headers: authHeaders() });
      } else {
        const v = await dayForm.validateFields();
        await axios.put('/api/v1/nursing-records/graphic/daily', { an, record_date: key, ...ward, ...v, is_operation_day: !!v.is_operation_day }, { headers: authHeaders() });
      }
      message.success('บันทึกแล้ว');
      onSaved();
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (msg) message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const ml = (n: string, lbl: string) => (
    <Form.Item name={n} label={lbl || undefined} className="mb-3!">
      <VolumeInput />
    </Form.Item>
  );
  const existing = tab === 'io'
    ? sheet.shifts.find(x => x.record_date === key && x.shift === shift)
    : sheet.daily.find(x => x.record_date === key);
  const title = `${existing ? 'แก้ไข' : 'บันทึก'}${tab === 'io' ? ` I/O ${beShort(dayjs(key))} เวร${shift}` : `ข้อมูลรายวัน ${beShort(dayjs(key))}`}`;

  return (
    <Drawer open={open} onClose={onClose} title={title} size={420} forceRender
      footer={<Button type="primary" block loading={saving} disabled={!sheet.storage_ready} onClick={save}>{existing ? 'บันทึกการแก้ไข' : 'บันทึก'}</Button>}>
      {/* แถบที่เลือกใน Segmented ไม่มี token รายตัวเลือก จึงทาสีด้วย CSS จากตัวแปร --shift-bg (เฉพาะ .shift-seg) */}
      <style>{`
        .shift-seg .ant-segmented-item-selected, .shift-seg .ant-segmented-thumb { background: var(--shift-bg); }
        .shift-seg .ant-segmented-item { padding: 0 2px; }
        .shift-seg .ant-segmented-item-label { padding-inline: 0; }
      `}</style>
      <Segmented block value={tab} onChange={v => setTab(v as 'io' | 'daily')} className="mb-3"
        options={[{ value: 'io', label: 'I/O รายเวร' }, { value: 'daily', label: 'ข้อมูลรายวัน' }]} />
      <div className="flex flex-col gap-2 mb-3">
        <Select className="w-full" value={key} onChange={v => onPos({ ...pos, date: v })}
          options={weekDays.map(d => {
            const done = tab === 'io' ? SHIFTS.filter(s => hasIo(d, s)).length : (hasDaily(d) ? 1 : 0);
            return { value: d, label: `${beShort(dayjs(d))} (${dayjs(d).format('ddd')})${done ? (tab === 'io' ? ` · ลงแล้ว ${done}/3 เวร` : ' · ลงแล้ว') : ''}` };
          })} />
        {tab === 'io' && (
          <Segmented block value={shift} onChange={v => onPos({ ...pos, shift: String(v) })}
            className="shift-seg p-1!" style={{ '--shift-bg': SHIFT_COLOR[shift].bg } as React.CSSProperties}
            options={SHIFTS.map(s => {
              const c = SHIFT_COLOR[s];
              const on = s === shift;
              return {
                value: s,
                label: (
                  <span className="block rounded font-semibold" style={{ color: on ? c.fg : c.ink, background: on ? 'transparent' : c.soft }}>
                    <span className="inline-flex items-center justify-center gap-1">
                      {on && SHIFT_ICON[s]}
                      {hasIo(key, s) ? `${s} ✓` : s}
                    </span>
                  </span>
                ),
              };
            })} />
        )}
      </div>

      {/* ที่ลงไว้แล้วในใบนี้ — กดเพื่อเปิดค่ามาแก้ */}
      <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-2">
        <div className="text-xs font-semibold text-gray-600 mb-1">ที่ลงไว้แล้วในใบนี้ (กดเพื่อแก้)</div>
        {(tab === 'io' ? ioDone.length : dailyDone.length) === 0 ? (
          <div className="text-xs text-gray-500">ยังไม่มี{tab === 'io' ? ' I/O' : 'ข้อมูลรายวัน'}ในสัปดาห์นี้</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {tab === 'io'
              ? ioDone.map(({ d, s }) => (
                <Button key={d + s} size="small" onClick={() => onPos({ ...pos, date: d, shift: s })}
                  style={d === key && s === shift
                    ? { background: SHIFT_COLOR[s].bg, color: SHIFT_COLOR[s].fg, borderColor: SHIFT_COLOR[s].bg, fontWeight: 600 }
                    : { background: SHIFT_COLOR[s].soft, color: SHIFT_COLOR[s].ink, borderColor: SHIFT_COLOR[s].soft }}>
                  {`${beShort(dayjs(d))} ${s}`}
                </Button>
              ))
              : dailyDone.map(d => (
                <Button key={d} size="small" type={d === key ? 'primary' : 'default'}
                  onClick={() => onPos({ ...pos, date: d })}>{beShort(dayjs(d))}</Button>
              ))}
          </div>
        )}
      </div>
      {existing?.updated_by_name && (
        <Alert className="mb-3!" type="info" showIcon
          title={`กำลังแก้ค่าที่ลงไว้ · ล่าสุด ${existing.updated_at ? dayjs(existing.updated_at).format('DD/MM HH:mm') : ''} น. โดย ${existing.updated_by_name}`}
          description="แก้ตัวเลขแล้วกดบันทึก จะทับค่าเดิมของช่องนี้" />
      )}

      {/* ทั้งสองฟอร์มอยู่ในหน้าเสมอ (ซ่อนอันที่ไม่ได้เลือก) ฟอร์มที่ถูกถอดออกจะเติมค่าเดิมกลับไม่ได้ */}
      <div hidden={tab !== 'io'}>
        <Form form={ioForm} layout="vertical" size="middle">
          <div className="font-semibold text-sm mb-1">สารน้ำเข้า (Intake)</div>
          {ml('oral_ml', 'Oral fluid')}
          {ml('parenteral_ml', 'Parenteral')}
          <Form.Item name="intake_other1_label" label="อื่น ๆ (ชื่อ)" className="mb-1!"><Input maxLength={60} placeholder="เช่น NG feed" /></Form.Item>
          {ml('intake_other1_ml', '')}
          <Form.Item name="intake_other2_label" label="อื่น ๆ (ชื่อ)" className="mb-1!"><Input maxLength={60} /></Form.Item>
          {ml('intake_other2_ml', '')}
          <div className="font-semibold text-sm mt-2 mb-1">สารน้ำออก (Output)</div>
          {ml('urine_ml', 'Urine')}
          {ml('drainage_ml', 'Drainage')}
          <Form.Item name="output_other1_label" label="อื่น ๆ (ชื่อ)" className="mb-1!"><Input maxLength={60} placeholder="เช่น Vomit" /></Form.Item>
          {ml('output_other1_ml', '')}
          <Form.Item name="output_other2_label" label="อื่น ๆ (ชื่อ)" className="mb-1!"><Input maxLength={60} /></Form.Item>
          {ml('output_other2_ml', '')}
        </Form>
      </div>
      <div hidden={tab !== 'daily'}>
        <Form form={dayForm} layout="vertical" size="middle">
          <Form.Item name="patient_type" label="ประเภทผู้ป่วย" className="mb-2!">
            <Select allowClear options={[
              { value: 'CI', label: 'CI — ผู้ป่วยหนัก' }, { value: 'SI', label: 'SI — ผู้ป่วยกึ่งหนัก' },
              { value: 'MI', label: 'MI — ผู้ป่วยระดับปานกลาง' }, { value: 'CL', label: 'CL — ผู้ป่วยระยะพักฟื้น' },
            ]} />
          </Form.Item>
          <div className="grid grid-cols-2 gap-2">
            <Form.Item name="stool_count" label="Stool (ครั้ง)" className="mb-2!"><InputNumber min={0} max={50} className="w-full!" /></Form.Item>
            <Form.Item name="urine_count" label="Urine (ครั้ง)" className="mb-2!"><InputNumber min={0} max={50} className="w-full!" /></Form.Item>
            <Form.Item name="weight_kg" label="น้ำหนัก (kg)" className="mb-2!"><InputNumber min={0} max={400} step={0.1} className="w-full!" /></Form.Item>
            <Form.Item name="height_cm" label="ส่วนสูง (cm)" className="mb-2!"><InputNumber min={0} max={250} className="w-full!" /></Form.Item>
          </div>
          <Form.Item name="diet" label="อาหาร (Diet)" className="mb-2!"><Input maxLength={100} placeholder="เช่น อ่อน, BD 1500 kcal, NPO" /></Form.Item>
          <Form.Item name="is_operation_day" valuePropName="checked" className="mb-2!">
            <Checkbox>วันนี้ผ่าตัด (ใช้นับ Day after operation)</Checkbox>
          </Form.Item>
          <Form.Item name="note" label="หมายเหตุ" className="mb-2!"><Input maxLength={200} /></Form.Item>
        </Form>
      </div>
    </Drawer>
  );
}
