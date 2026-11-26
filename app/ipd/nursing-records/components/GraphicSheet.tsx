'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, DatePicker, Drawer, Form, Input, InputNumber, Segmented, Select, Slider, Space, Spin, message } from 'antd';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import { PiCaretLeftBold, PiCaretRightBold, PiChartLineBold, PiMinusBold, PiPencilSimpleBold, PiPlusBold, PiPrinterBold, PiThermometerBold } from 'react-icons/pi';
import Navbar from '../../../components/Navbar';

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
interface Sheet {
  from: string; vitals: Vital[]; meds: Med[]; pains?: PainRec[]; shifts: ShiftRow[]; daily: DailyRow[]; op_dates: string[]; storage_ready: boolean;
}
interface Patient {
  hn?: string; ptname?: string; name?: string; patient_name?: string; bedno?: string; bed?: string;
  ward?: string; wardName?: string; ward_name?: string; regdate?: string; reg_datetime?: string; admitDateTimeIso?: string;
}

const SHIFTS = ['ดึก', 'เช้า', 'บ่าย'] as const;
const SLOTS = [2, 6, 10, 14, 18, 22];
/** เวลาเหตุการณ์ → ช่องเวลาของฟอร์ม: 00–03 = 2, 04–07 = 6, ... 20–23 = 22 */
const slotOf = (d: Dayjs) => Math.floor(d.hour() / 4);

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
const PAIN_H = 66;

/** ข้อความหนึ่งชิ้นบนใบ — จัดกึ่งกลางแนวตั้งที่ y */
function T({ x, y, children, size = 9, anchor = 'middle', weight, color = INK }: {
  x: number; y: number; children: React.ReactNode; size?: number; anchor?: 'start' | 'middle' | 'end'; weight?: number; color?: string;
}) {
  return <text x={x} y={y} fontSize={size} textAnchor={anchor} fontWeight={weight} fill={color} dominantBaseline="middle">{children}</text>;
}

function SheetSvg({ sheet, start, admitDate, patient, onPainClick }: {
  onPainClick?: () => void;
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
  /* ความปวด: รวมคะแนนจากสัญญาณชีพกับแบบประเมินความปวด ช่องละค่าเดียว ใช้ครั้งล่าสุด */
  const painCell = useMemo(() => {
    const m = new Map<string, { at: string; v: number; note: string }>();
    const all = [
      ...sheet.vitals.filter(v => v.pain_score !== null && v.pain_score !== undefined).map(v => ({ at: v.at, v: v.pain_score as number, note: 'จากสัญญาณชีพ' })),
      ...(sheet.pains ?? []).map(x => ({ at: x.at, v: x.pain_score, note: [x.assessment_tool === 'CPOT' ? `CPOT ${x.pain_score}/8` : `แบบประเมินความปวด ${x.assessment_tool ?? ''}`.trim(), x.location, x.reassess_score !== null ? `ประเมินซ้ำ ${x.reassess_score}` : ''].filter(Boolean).join(' · ') })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    for (const x of all) { const at = dayjs(x.at); m.set(`${at.format('YYYY-MM-DD')}|${slotOf(at)}`, x); }
    return m;
  }, [sheet.vitals, sheet.pains]);
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
  const yEnd = y; y += 8;
  const yLegend = y; y += 112;
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
  const pains: { x: number; y: number; v: number; note: string }[] = [];
  days.forEach((d, di) => SLOTS.forEach((_, si) => {
    const c = painCell.get(`${dayKey(d)}|${si}`);
    if (c) pains.push({ x: slotX(di, si), y: painY(c.v), v: c.v, note: c.note });
  }));
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
      {slotRow(yNews, v => v.news2_score)}
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
      {onPainClick && (
        <rect x={X0} y={yPain} width={XR - X0} height={PAIN_H} fill="transparent" className="cursor-pointer print:hidden" onClick={onPainClick}>
          <title>คลิกเพื่อลงรายละเอียดความปวด (เปิดหน้าต่างใหม่)</title>
        </rect>
      )}
      {pains.length > 1 && <path d={path(pains)} fill="none" stroke={INK} strokeWidth={0.9} />}
      {pains.map((p, i) => <circle key={`pa${i}`} cx={p.x} cy={p.y} r={2.6} fill={INK}><title>{`Pain ${p.v} (${p.note})`}</title></circle>)}

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
      {[yUrine, yType].map(yy => <React.Fragment key={yy}>{hline(yy, X0, XR, 0.8)}</React.Fragment>)}
      {label(yStool, 'Stool')}
      {label(yUrine, 'Urine')}
      {label(yType, 'ประเภทผู้ป่วย')}
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

      {/* ───── คำอธิบายท้ายใบ ───── */}
      <rect x={X0} y={yLegend} width={XR - X0} height={112} fill="none" stroke={BLUE} strokeWidth={1.6} />
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

  const load = useCallback(async () => {
    if (!start) return;
    setLoading(true);
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

  /* รายละเอียดความปวด (ตำแหน่ง ลักษณะ การจัดการ ประเมินซ้ำ) ลงในหน้าแบบประเมินความปวด เปิดเป็นหน้าต่างใหม่
     กลับมาที่ใบนี้เมื่อไหร่ก็โหลดใหม่ จุดในกราฟจะขึ้นทันที */
  const openPain = useCallback(() => {
    window.open(`/ipd/nursing-records/pain/${encodeURIComponent(an)}`, `pain-${an}`, 'width=1100,height=900');
  }, [an]);
  useEffect(() => {
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

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
          <Button type="primary" icon={<PiPencilSimpleBold />} onClick={() => setEditOpen(true)} disabled={!sheet}>บันทึก I/O / รายวัน</Button>
          <Button icon={<PiThermometerBold />} onClick={openPain}>ประเมินความปวด</Button>
          <Button icon={<PiPrinterBold />} onClick={() => window.print()} disabled={!sheet}>พิมพ์</Button>
          <span className="text-xs text-gray-500">สัญญาณชีพ ความปวด และยา ดึงจากหน้าสัญญาณชีพ แบบประเมินความปวด และ MAR อัตโนมัติ · คลิกที่กราฟความปวดเพื่อลงรายละเอียด</span>
        </div>

        {sheet && !sheet.storage_ready && (
          <Alert className="print:hidden mb-3" type="warning" showIcon title="ยังบันทึก I/O และข้อมูลรายวันไม่ได้"
            description="เซิร์ฟเวอร์ยังไม่ได้สร้างตารางของฟอร์มปรอท (sql/2026-11-26_nursing_graphic_sheet.sql) ส่วนสัญญาณชีพยังแสดงได้ตามปกติ" />
        )}
        {error && <Alert className="print:hidden mb-3" type="error" showIcon title={error} />}

        {/* ใบแคบกว่า 760px อ่านไม่ออก บนมือถือจึงเลื่อนซ้ายขวาแทนการย่อ */}
        <div className="overflow-x-auto rounded-lg border border-gray-200 print:border-0 print:overflow-visible" style={{ background: '#ffffff' }}>
          <div className="min-w-[760px] p-2 print:p-0 print:min-w-0">
            {!sheet || !start ? (
              <div className="py-24 text-center"><Spin /></div>
            ) : (
              <Spin spinning={loading}>
                <SheetSvg sheet={sheet} start={start} admitDate={admitDate} patient={patient} onPainClick={openPain} />
              </Spin>
            )}
          </div>
        </div>
      </div>

      {sheet && start && (
        <EditDrawer open={editOpen} onClose={() => setEditOpen(false)} an={an} start={start} sheet={sheet}
          patient={patient} onSaved={() => void load()} />
      )}
    </div>
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

function EditDrawer({ open, onClose, an, start, sheet, patient, onSaved }: {
  open: boolean; onClose: () => void; an: string; start: Dayjs; sheet: Sheet; patient: Patient | null; onSaved: () => void;
}) {
  const [tab, setTab] = useState<'io' | 'daily'>('io');
  const [date, setDate] = useState<Dayjs>(() => {
    const today = dayjs().startOf('day');
    return today.isBefore(start) || today.isAfter(start.add(6, 'day')) ? start : today;
  });
  const [shift, setShift] = useState<string>(() => (dayjs().hour() < 8 ? 'ดึก' : dayjs().hour() < 16 ? 'เช้า' : 'บ่าย'));
  const [saving, setSaving] = useState(false);
  const [ioForm] = Form.useForm();
  const [dayForm] = Form.useForm();
  const key = date.format('YYYY-MM-DD');

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

  return (
    <Drawer open={open} onClose={onClose} title="บันทึกฟอร์มปรอท" size={420} forceRender
      footer={<Button type="primary" block loading={saving} disabled={!sheet.storage_ready} onClick={save}>บันทึก</Button>}>
      <Segmented block value={tab} onChange={v => setTab(v as 'io' | 'daily')} className="mb-3"
        options={[{ value: 'io', label: 'I/O รายเวร' }, { value: 'daily', label: 'ข้อมูลรายวัน' }]} />
      <div className="flex gap-2 mb-3">
        <Select className="flex-1" value={key} onChange={v => setDate(dayjs(v))}
          options={Array.from({ length: 7 }, (_, i) => start.add(i, 'day')).map(d => ({ value: d.format('YYYY-MM-DD'), label: `${beShort(d)} (${d.format('ddd')})` }))} />
        {tab === 'io' && (
          <Segmented value={shift} onChange={v => setShift(String(v))} options={SHIFTS.map(s => ({ value: s, label: s }))} />
        )}
      </div>
      {existing?.updated_by_name && (
        <div className="text-xs text-gray-500 mb-2">บันทึกล่าสุด {existing.updated_at} · {existing.updated_by_name} — บันทึกอีกครั้งจะแก้ค่าเดิม</div>
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
