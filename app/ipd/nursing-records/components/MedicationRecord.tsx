"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Alert, Button, Card, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Popover, Radio, Select,
  Table, Tag, TimePicker, Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import Link from 'next/link';
import Swal from 'sweetalert2';
import Navbar from '../../../components/Navbar';
import { FormSkeleton } from '@/app/components/Skeletons';
import { getUserProfile } from '../../../lib/auth';
import {
  ROUTE_LABEL, FREQ_LABEL, DEFAULT_TIMES, CLASS_LABEL, REASON_LABEL, STATUS_LABEL, UNITS, SITES,
  SLOT_STATE, type SlotState,
} from '../../../lib/mar';
import { PiPillBold, PiPlusBold, PiCaretLeftBold, PiCaretRightBold, PiChartBarBold, PiWarningBold, PiSealCheckBold } from 'react-icons/pi';
import { VscTrash, VscEdit } from 'react-icons/vsc';

/*
  บันทึกการให้ยา (MAR)

  หน้านี้เก็บข้อมูลเป็นโครงสร้างทั้งหมด เพื่อให้หน้าวิเคราะห์ (/ipd/mar-dashboard) นับได้จริง
    - คำสั่งยามีเวลาให้ยาแต่ละมื้อ → รู้ว่าวันหนึ่งควรมีกี่มื้อ และมื้อไหนไม่มีบันทึก
    - การให้ยาทุกครั้งผูกกับมื้อ → วัดตรงเวลา/ช้า/ขาดได้
    - ไม่ได้ให้ยาต้องเลือกเหตุผลเป็นรหัส · ยาความเสี่ยงสูงต้องมีผู้ตรวจซ้ำ · PRN มีคะแนนก่อน/หลัง
  สถานะของมื้อ (ตรงเวลา ช้า ขาด) คิดที่เซิร์ฟเวอร์ ที่นี่แค่แสดง
*/

interface PatientInfo {
  hn?: string;
  an?: string;
  ptname?: string;
  bedno?: string;
  regdate?: string;
  ward?: string;
  ward_name?: string;
}

interface Order {
  id: number;
  medication_name: string;
  generic_name: string | null;
  dose: string;
  dose_value: number | null;
  dose_unit: string | null;
  route: string;
  frequency: string;
  frequency_code: string | null;
  schedule_times: string[];
  start_datetime: string;
  end_date: string | null;
  prn: boolean;
  prn_reason: string | null;
  prn_min_interval_hours: number | null;
  prn_max_per_day: number | null;
  time_critical: boolean;
  high_alert: boolean;
  drug_class: string | null;
  doctor_name: string | null;
  note: string | null;
  created_by: string;
  created_by_name: string | null;
  verified_by: string | null;
  verified_by_name: string | null;
  verified_at: string | null;
  discontinued_at: string | null;
  discontinue_reason: string | null;
}

interface Admin {
  id: number;
  order_id: number;
  nurse_name: string;
  admin_datetime: string;
  scheduled_at: string | null;
  shift: string | null;
  medication_name: string;
  dose_given: string;
  route: string | null;
  site: string | null;
  status: string;
  reason_code: string | null;
  held_reason: string | null;
  double_checked_by_name: string | null;
  prn_indication: string | null;
  pre_score: number | null;
  post_score: number | null;
  reassessed_at: string | null;
  adverse_reaction: boolean;
  adverse_note: string | null;
  note: string | null;
}

interface Slot {
  order_id: number;
  scheduled_at: string;
  window_minutes: number;
  admin_id: number | null;
  admin_status: string | null;
  admin_datetime: string | null;
  reason_code: string | null;
  state: SlotState;
  delay: number | null;
}

interface Codes {
  routes: string[];
  frequencies: { code: string; per_day: number | null }[];
  drug_classes: { code: string; high_alert: boolean }[];
  reason_codes: string[];
  windows: { standard_minutes: number; time_critical_minutes: number };
}

const headersOf = () => {
  const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
};
const errText = (e: unknown, fallback = 'เกิดข้อผิดพลาด') =>
  (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? fallback;
const fmt = (v: string | null | undefined, f = 'DD/MM HH:mm') => (v ? dayjs(v).format(f) : '-');
const toast = (title: string) => Swal.fire({ icon: 'success', title, timer: 1300, showConfirmButton: false });
const alertErr = (e: unknown) => Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: errText(e), confirmButtonColor: '#006b5f' });

/** ถามเหตุผลก่อนทำรายการที่ย้อนไม่ได้ (หยุดยา / ลบ) — เหตุผลเก็บไว้ในเวชระเบียน */
const askReason = async (title: string, confirmText: string) => {
  const r = await Swal.fire({
    title, input: 'text', inputPlaceholder: 'ระบุเหตุผล', showCancelButton: true,
    confirmButtonText: confirmText, cancelButtonText: 'ยกเลิก', confirmButtonColor: '#d33',
    inputValidator: v => (!v?.trim() ? 'กรุณาระบุเหตุผล' : undefined),
  });
  return r.isConfirmed ? String(r.value).trim() : null;
};

const SlotChip = ({ slot, onClick }: { slot: Slot; onClick?: () => void }) => {
  const s = SLOT_STATE[slot.state];
  const time = dayjs(slot.scheduled_at).format('HH:mm');
  const detail = slot.admin_datetime
    ? `${STATUS_LABEL[slot.admin_status ?? ''] ?? ''} ${dayjs(slot.admin_datetime).format('HH:mm')}`
      + (slot.delay !== null && slot.delay !== 0 ? ` (${slot.delay > 0 ? '+' : ''}${slot.delay} นาที)` : '')
      + (slot.reason_code ? ` · ${REASON_LABEL[slot.reason_code] ?? slot.reason_code}` : '')
    : `${s.label} · ช่วงให้ยา ±${slot.window_minutes} นาที`;
  return (
    <Tooltip title={detail}>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="inline-flex flex-col items-center rounded-md border px-2 py-0.5 leading-tight text-[11px] font-semibold disabled:cursor-default"
        style={{ color: s.color, backgroundColor: s.bg, borderColor: s.color }}
      >
        <span className="text-xs">{time}</span>
        <span className="font-normal">{s.label}</span>
      </button>
    </Tooltip>
  );
};

/* ───────────────────────── ฟอร์มคำสั่งยา ───────────────────────── */

function OrderModal({ open, order, codes, onClose, onSaved, patient, an }: {
  open: boolean; order: Order | null; codes: Codes | null; onClose: () => void; onSaved: () => void;
  patient: PatientInfo | null; an: string;
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const freq: string | undefined = Form.useWatch('frequency_code', form);
  const cls: string | undefined = Form.useWatch('drug_class', form);
  const perDay = codes?.frequencies.find(f => f.code === freq)?.per_day ?? null;
  const classHighAlert = !!codes?.drug_classes.find(c => c.code === cls)?.high_alert;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (order) {
      form.setFieldsValue({
        ...order,
        start_datetime: dayjs(order.start_datetime),
        end_date: order.end_date ? dayjs(order.end_date) : null,
        schedule_times: order.schedule_times.map(t => dayjs(t, 'HH:mm')),
      });
    } else {
      form.setFieldsValue({ start_datetime: dayjs(), route: 'PO', frequency_code: 'OD', drug_class: 'OTHER', schedule_times: DEFAULT_TIMES.OD.map(t => dayjs(t, 'HH:mm')) });
    }
  }, [open, order, form]);

  const onFreq = (code: string) =>
    form.setFieldValue('schedule_times', (DEFAULT_TIMES[code] ?? []).map(t => dayjs(t, 'HH:mm')));

  const submit = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const body = {
        an, hn: patient?.hn, ward_code: patient?.ward ?? '', ward_name: patient?.ward_name,
        medication_name: v.medication_name, generic_name: v.generic_name || undefined,
        dose_value: v.dose_value, dose_unit: v.dose_unit, route: v.route,
        frequency_code: v.frequency_code,
        schedule_times: perDay ? ((v.schedule_times as Dayjs[]) ?? []).map(t => t.format('HH:mm')) : null,
        start_datetime: (v.start_datetime as Dayjs).format('YYYY-MM-DD HH:mm:ss'),
        end_date: v.end_date ? (v.end_date as Dayjs).format('YYYY-MM-DD') : null,
        prn_reason: v.prn_reason || undefined,
        prn_min_interval_hours: v.prn_min_interval_hours ?? null,
        prn_max_per_day: v.prn_max_per_day ?? null,
        time_critical: !!v.time_critical, high_alert: !!v.high_alert || classHighAlert,
        drug_class: v.drug_class, doctor_name: v.doctor_name || undefined, note: v.note || undefined,
      };
      if (order) await axios.put(`/api/v1/nursing-records/mar/orders/${order.id}`, body, { headers: headersOf() });
      else await axios.post('/api/v1/nursing-records/mar/orders', body, { headers: headersOf() });
      onSaved();
      toast(order ? 'แก้ไขคำสั่งยาแล้ว' : 'บันทึกคำสั่งยาแล้ว — รอพยาบาลอีกคนตรวจทาน');
    } catch (e) {
      alertErr(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} title={order ? 'แก้ไขคำสั่งยา' : 'เพิ่มคำสั่งยา (คัดลอกจากคำสั่งแพทย์)'}
      okText="บันทึก" cancelText="ยกเลิก" onOk={() => form.submit()} confirmLoading={saving} width={720} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} size="middle" className="[&_.ant-form-item]:mb-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
          <Form.Item label="ชื่อยา" name="medication_name" rules={[{ required: true, message: 'กรุณาระบุชื่อยา' }]}>
            <Input placeholder="เช่น Ceftriaxone" maxLength={200} />
          </Form.Item>
          <Form.Item label="ชื่อสามัญ" name="generic_name"><Input maxLength={200} /></Form.Item>
          <div className="flex gap-2">
            <Form.Item label="ขนาดยา" name="dose_value" className="flex-1" rules={[{ required: true, message: 'ระบุขนาด' }]}>
              <InputNumber min={0.001} className="w-full" />
            </Form.Item>
            <Form.Item label="หน่วย" name="dose_unit" className="w-32" rules={[{ required: true, message: 'ระบุหน่วย' }]}>
              <Select showSearch options={UNITS.map(u => ({ value: u, label: u }))} />
            </Form.Item>
          </div>
          <Form.Item label="ทางให้ยา" name="route" rules={[{ required: true }]}>
            <Select options={(codes?.routes ?? []).map(r => ({ value: r, label: ROUTE_LABEL[r] ?? r }))} />
          </Form.Item>
          <Form.Item label="กลุ่มยา" name="drug_class" rules={[{ required: true }]}
            extra={classHighAlert ? 'กลุ่มนี้เป็นยาความเสี่ยงสูง — ต้องมีพยาบาลอีกคนตรวจซ้ำทุกครั้งที่ให้' : undefined}>
            <Select showSearch optionFilterProp="label"
              options={(codes?.drug_classes ?? []).map(c => ({ value: c.code, label: `${CLASS_LABEL[c.code] ?? c.code}${c.high_alert ? ' ⚠' : ''}` }))} />
          </Form.Item>
          <Form.Item label="ความถี่" name="frequency_code" rules={[{ required: true }]}>
            <Select onChange={onFreq} options={(codes?.frequencies ?? []).map(f => ({ value: f.code, label: FREQ_LABEL[f.code] ?? f.code }))} />
          </Form.Item>
        </div>

        {perDay !== null && (
          <Form.Item label={`เวลาให้ยา (${perDay} เวลาต่อวัน)`} required>
            <Form.List name="schedule_times">
              {fields => (
                <div className="flex flex-wrap gap-2">
                  {fields.map(f => (
                    <Form.Item key={f.key} name={f.name} noStyle rules={[{ required: true }]}>
                      <TimePicker format="HH:mm" minuteStep={15} allowClear={false} className="w-24" />
                    </Form.Item>
                  ))}
                </div>
              )}
            </Form.List>
          </Form.Item>
        )}

        {freq === 'PRN' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 rounded-lg bg-amber-50 px-3 pt-2 mb-3">
            <Form.Item label="ให้เมื่อ (ข้อบ่งชี้)" name="prn_reason" className="md:col-span-3" rules={[{ required: true, message: 'ยา PRN ต้องระบุข้อบ่งชี้' }]}>
              <Input placeholder="เช่น pain score ≥ 5, ไข้ ≥ 38°C" maxLength={200} />
            </Form.Item>
            <Form.Item label="ห่างกันอย่างน้อย (ชม.)" name="prn_min_interval_hours"><InputNumber min={0.5} max={72} step={0.5} className="w-full" /></Form.Item>
            <Form.Item label="ไม่เกินวันละ (ครั้ง)" name="prn_max_per_day"><InputNumber min={1} max={48} className="w-full" /></Form.Item>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
          <Form.Item label={freq === 'STAT' || freq === 'ONCE' ? 'เวลาที่ต้องให้' : 'เริ่มให้ยา'} name="start_datetime" rules={[{ required: true }]}>
            <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
          </Form.Item>
          {freq !== 'STAT' && freq !== 'ONCE' && (
            <Form.Item label="ให้ถึงวันที่ (ถ้ามี)" name="end_date"><DatePicker format="DD/MM/YYYY" className="w-full" /></Form.Item>
          )}
          <Form.Item label="แพทย์ผู้สั่ง" name="doctor_name"><Input maxLength={100} /></Form.Item>
          <Form.Item label="หมายเหตุ" name="note"><Input maxLength={500} /></Form.Item>
        </div>

        <div className="flex flex-wrap gap-6">
          <Form.Item name="time_critical" valuePropName="checked" noStyle>
            <Checkbox>ยาที่ต้องตรงเวลาเข้ม (ช่วงให้ยา ±{codes?.windows.time_critical_minutes ?? 30} นาที)</Checkbox>
          </Form.Item>
          {classHighAlert ? (
            <Checkbox checked disabled>ยาความเสี่ยงสูง (กลุ่มยานี้บังคับ)</Checkbox>
          ) : (
            <Form.Item name="high_alert" valuePropName="checked" noStyle>
              <Checkbox>ยาความเสี่ยงสูง (ต้องตรวจซ้ำ)</Checkbox>
            </Form.Item>
          )}
        </div>
      </Form>
    </Modal>
  );
}

/* ───────────────────────── ฟอร์มการให้ยา ───────────────────────── */

function AdminModal({ target, onClose, onSaved, patient, an }: {
  target: { order: Order; slot: Slot | null } | null; onClose: () => void; onSaved: () => void;
  patient: PatientInfo | null; an: string;
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const status: string = Form.useWatch('status', form) ?? 'given';
  const adverse: boolean = Form.useWatch('adverse_reaction', form) ?? false;
  const postScore: number | null = Form.useWatch('post_score', form) ?? null;
  const order = target?.order;

  useEffect(() => {
    if (!target) return;
    form.resetFields();
    form.setFieldsValue({
      status: 'given', admin_datetime: dayjs(), dose_value: target.order.dose_value, route: target.order.route,
    });
  }, [target, form]);

  if (!order) return null;
  const given = status === 'given';

  const submit = async (v: Record<string, unknown>) => {
    setSaving(true);
    try {
      const hasPost = v.post_score !== undefined && v.post_score !== null;
      await axios.post('/api/v1/nursing-records/mar/admin', {
        order_id: order.id, an, ward_code: patient?.ward ?? '', ward_name: patient?.ward_name,
        scheduled_at: target?.slot ? dayjs(target.slot.scheduled_at).format('YYYY-MM-DD HH:mm:ss') : null,
        admin_datetime: (v.admin_datetime as Dayjs).format('YYYY-MM-DD HH:mm:ss'),
        status: v.status,
        dose_value: given ? v.dose_value : null,
        route: v.route, site: v.site || undefined,
        reason_code: given ? null : v.reason_code, held_reason: v.held_reason || undefined,
        double_checked_by: order.high_alert && given ? v.double_checked_by : null,
        prn_indication: v.prn_indication || undefined,
        pre_score: v.pre_score ?? null, post_score: hasPost ? v.post_score : null,
        reassessed_at: hasPost && v.reassessed_at ? (v.reassessed_at as Dayjs).format('YYYY-MM-DD HH:mm:ss') : null,
        adverse_reaction: !!v.adverse_reaction, adverse_note: v.adverse_note || undefined,
        note: v.note || undefined,
      }, { headers: headersOf() });
      onSaved();
      toast('บันทึกการให้ยาแล้ว');
    } catch (e) {
      alertErr(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!target} onCancel={onClose} okText="บันทึก" cancelText="ยกเลิก" onOk={() => form.submit()}
      confirmLoading={saving} width={620} destroyOnHidden
      title={<span>บันทึกการให้ยา — {order.medication_name}</span>}>
      <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 mb-3 text-sm">
        <div className="font-semibold text-violet-800">{order.medication_name} {order.dose} · {ROUTE_LABEL[order.route] ?? order.route}</div>
        <div className="text-xs text-gray-600">
          {order.prn ? `PRN: ${order.prn_reason ?? ''}` : `มื้อ ${target?.slot ? dayjs(target.slot.scheduled_at).format('DD/MM HH:mm') : '-'} (ช่วงให้ยา ±${target?.slot?.window_minutes ?? 60} นาที)`}
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {order.high_alert && <Tag color="red" className="m-0">ยาความเสี่ยงสูง</Tag>}
          {!order.verified_by && <Tag color="orange" className="m-0">คำสั่งยังไม่ผ่านการตรวจทาน</Tag>}
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={submit} className="[&_.ant-form-item]:mb-3">
        <Form.Item name="status" label="ผลการให้ยา">
          <Radio.Group optionType="button" buttonStyle="solid"
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
        </Form.Item>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
          <Form.Item label="วันเวลา" name="admin_datetime" rules={[{ required: true }]}>
            <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" disabledDate={d => d.isAfter(dayjs(), 'day')} />
          </Form.Item>
          {given ? (
            <Form.Item label={`ขนาดที่ให้ (${order.dose_unit ?? ''})`} name="dose_value" rules={[{ required: true, message: 'ระบุขนาดที่ให้' }]}>
              <InputNumber min={0.001} className="w-full" />
            </Form.Item>
          ) : (
            <Form.Item label="เหตุผลที่ไม่ได้ให้" name="reason_code" rules={[{ required: true, message: 'เลือกเหตุผล' }]}>
              <Select options={Object.entries(REASON_LABEL).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
          )}
        </div>

        {given && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-3">
            <Form.Item label="ทางให้ยา" name="route">
              <Select options={Object.entries(ROUTE_LABEL).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
            <Form.Item label="ตำแหน่ง" name="site"><Select allowClear options={SITES.map(s => ({ value: s, label: s }))} /></Form.Item>
          </div>
        )}
        {!given && <Form.Item label="รายละเอียดเพิ่มเติม" name="held_reason"><Input maxLength={500} /></Form.Item>}

        {order.high_alert && given && (
          <Form.Item label="ชื่อผู้ใช้ (username) ของพยาบาลผู้ตรวจซ้ำ" name="double_checked_by"
            rules={[{ required: true, message: 'ยาความเสี่ยงสูงต้องมีพยาบาลอีกคนตรวจซ้ำ' }]}
            extra="พยาบาลวิชาชีพอีกคนที่ตรวจชื่อยา ขนาด ทาง และผู้ป่วยร่วมกันก่อนให้ — ระบบตรวจว่ามีบัญชีจริง">
            <Input maxLength={20} />
          </Form.Item>
        )}

        {order.prn && given && (
          <div className="rounded-lg bg-amber-50 px-3 pt-2 mb-3">
            <Form.Item label="อาการที่ให้ยา" name="prn_indication" rules={[{ required: true, message: 'ระบุอาการ' }]}>
              <Input placeholder={order.prn_reason ?? ''} maxLength={200} />
            </Form.Item>
            <div className="grid grid-cols-3 gap-x-3">
              <Form.Item label="คะแนนก่อนให้ (0-10)" name="pre_score"><InputNumber min={0} max={10} precision={0} className="w-full" /></Form.Item>
              <Form.Item label="คะแนนหลังให้" name="post_score"><InputNumber min={0} max={10} precision={0} className="w-full" /></Form.Item>
              {postScore !== null && (
                <Form.Item label="เวลาที่ประเมินซ้ำ" name="reassessed_at" initialValue={dayjs()}>
                  <TimePicker format="HH:mm" className="w-full" />
                </Form.Item>
              )}
            </div>
            <div className="text-xs text-gray-500 pb-2">ยังไม่ได้ประเมินซ้ำ เว้นคะแนนหลังไว้ก่อน แล้วกด &ldquo;ประเมินซ้ำ&rdquo; ในประวัติภายหลังได้</div>
          </div>
        )}

        <Form.Item name="adverse_reaction" valuePropName="checked" className="mb-1!">
          <Checkbox>เกิดอาการไม่พึงประสงค์จากยา</Checkbox>
        </Form.Item>
        {adverse && <Form.Item name="adverse_note" rules={[{ required: true, message: 'ระบุอาการ' }]}><Input placeholder="อาการที่พบ" maxLength={500} /></Form.Item>}
        <Form.Item label="หมายเหตุ" name="note"><Input maxLength={500} /></Form.Item>
      </Form>
    </Modal>
  );
}

/* ───────────────────────── หน้า ───────────────────────── */

export default function MedicationRecord({ an }: { an: string }) {
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [codes, setCodes] = useState<Codes | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState<Dayjs>(dayjs());
  /*
    โหลดคำสั่งยาไม่ได้ต้องบอกตรงๆ และห้ามบันทึก
    เดิมหน้านี้ใส่รายการยาตัวอย่างแทน (Ceftriaxone, Morphine ฯลฯ) ทำให้ผู้ป่วยทุกคนเห็นยาที่ไม่ได้สั่งจริง
  */
  const [marError, setMarError] = useState<string | null>(null);
  const [orderModal, setOrderModal] = useState<{ open: boolean; order: Order | null }>({ open: false, order: null });
  const [adminTarget, setAdminTarget] = useState<{ order: Order; slot: Slot | null } | null>(null);
  const me = getUserProfile()?.username ?? '';

  const fetchData = useCallback(async () => {
    const headers = headersOf();
    const [o, a, s] = await Promise.all([
      axios.get(`/api/v1/nursing-records/mar/orders/${an}`, { headers }).catch(() => null),
      axios.get(`/api/v1/nursing-records/mar/admins/${an}`, { headers }).catch(() => null),
      axios.get(`/api/v1/nursing-records/mar/schedule/${an}`, { headers, params: { date: date.format('YYYY-MM-DD') } }).catch(() => null),
    ]);
    const ok = o?.data?.success && a?.data?.success && s?.data?.success;
    setOrders(ok ? o.data.data : []);
    setAdmins(ok ? a.data.data : []);
    setSlots(ok ? s.data.data.slots : []);
    setMarError(ok ? null : 'โหลดคำสั่งยาและประวัติการให้ยาไม่สำเร็จ — ห้ามบันทึกการให้ยาจากหน้านี้จนกว่าจะโหลดได้');
  }, [an, date]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const headers = headersOf();
        await Promise.all([
          axios.post('/api/v1/patients/patient-by-an', { an }, { headers })
            .then(res => {
              const d = res.data?.success ? res.data.data : null;
              setPatient(Array.isArray(d) ? d[0] ?? null : d);
            })
            .catch(error => console.error('Error fetching patient:', error)),
          axios.get('/api/v1/nursing-records/mar/codes', { headers }).then(r => setCodes(r.data.data)).catch(() => null),
        ]);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [an]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refresh = async () => {
    setOrderModal({ open: false, order: null });
    setAdminTarget(null);
    await fetchData();
  };

  const act = async (fn: () => Promise<unknown>, done: string) => {
    try { await fn(); await fetchData(); toast(done); } catch (e) { alertErr(e); }
  };

  const verify = (o: Order) => act(() => axios.post(`/api/v1/nursing-records/mar/orders/${o.id}/verify`, {}, { headers: headersOf() }), 'ตรวจทานคำสั่งยาแล้ว');
  const discontinue = async (o: Order) => {
    const reason = await askReason(`หยุดยา ${o.medication_name}`, 'หยุดยา');
    if (reason) act(() => axios.post(`/api/v1/nursing-records/mar/orders/${o.id}/discontinue`, { reason }, { headers: headersOf() }), 'หยุดยาแล้ว');
  };
  const deleteOrder = async (o: Order) => {
    const reason = await askReason(`ลบคำสั่ง ${o.medication_name} (บันทึกผิด)`, 'ลบ');
    if (reason) act(() => axios.delete(`/api/v1/nursing-records/mar/orders/${o.id}`, { headers: headersOf(), data: { reason } }), 'ลบคำสั่งยาแล้ว');
  };
  const deleteAdmin = async (a: Admin) => {
    const reason = await askReason(`ลบบันทึก ${a.medication_name} ${fmt(a.admin_datetime)}`, 'ลบ');
    if (reason) act(() => axios.delete(`/api/v1/nursing-records/mar/admin/${a.id}`, { headers: headersOf(), data: { reason } }), 'ลบรายการแล้ว');
  };
  const reassess = async (a: Admin) => {
    const r = await Swal.fire({
      title: `ประเมินซ้ำหลังให้ ${a.medication_name}`, input: 'number', inputLabel: `คะแนนก่อนให้ ${a.pre_score ?? '-'} · คะแนนตอนนี้ (0-10)`,
      inputAttributes: { min: '0', max: '10', step: '1' }, showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#006b5f',
      inputValidator: v => (v === '' || Number(v) < 0 || Number(v) > 10 || !Number.isInteger(Number(v)) ? 'ใส่จำนวนเต็ม 0-10' : undefined),
    });
    if (r.isConfirmed) act(() => axios.post(`/api/v1/nursing-records/mar/admin/${a.id}/reassess`, { post_score: Number(r.value) }, { headers: headersOf() }), 'บันทึกการประเมินซ้ำแล้ว');
  };

  /* ───── ตาราง MAR ของวันที่เลือก: ยาที่มีมื้อวันนั้น + ยา PRN ที่ยังใช้อยู่ ───── */
  const marRows = useMemo(() => {
    const dayStart = date.startOf('day');
    const activeOnDay = (o: Order) =>
      !dayjs(o.start_datetime).isAfter(date.endOf('day'))
      && (!o.end_date || !dayjs(o.end_date).isBefore(dayStart, 'day'))
      && (!o.discontinued_at || dayjs(o.discontinued_at).isAfter(dayStart));
    return orders.filter(o => (o.prn ? activeOnDay(o) : slots.some(s => s.order_id === o.id)));
  }, [orders, slots, date]);
  const prnOnDay = (o: Order) => admins.filter(a => a.order_id === o.id && a.status === 'given' && dayjs(a.admin_datetime).isSame(date, 'day')).length;

  const OrderCell = (o: Order) => (
    <div className="leading-tight">
      <div className="font-semibold text-violet-800">{o.medication_name} <span className="font-normal text-gray-600">{o.dose}</span></div>
      <div className="text-xs text-gray-500">{ROUTE_LABEL[o.route] ?? o.route} · {o.prn ? `PRN ${o.prn_reason ?? ''}` : o.frequency}</div>
      <div className="flex flex-wrap gap-1 mt-0.5">
        {o.high_alert && <Tag color="red" className="m-0 text-[10px]">High alert</Tag>}
        {o.time_critical && <Tag color="blue" className="m-0 text-[10px]">ตรงเวลาเข้ม</Tag>}
        {!o.verified_by && <Tag color="orange" className="m-0 text-[10px]">ยังไม่ตรวจทาน</Tag>}
        {o.discontinued_at && <Tag className="m-0 text-[10px]">หยุดยา {fmt(o.discontinued_at)}</Tag>}
      </div>
    </div>
  );

  const marColumns: ColumnsType<Order> = [
    { title: 'ยา', key: 'drug', width: 280, render: (_, o) => OrderCell(o) },
    {
      title: 'มื้อยา (กดเพื่อบันทึก)', key: 'slots',
      render: (_, o) => {
        if (o.prn) {
          const n = prnOnDay(o);
          const over = o.prn_max_per_day !== null && n >= o.prn_max_per_day;
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="small" icon={<PiPlusBold />} disabled={!!marError || !!o.discontinued_at || !date.isSame(dayjs(), 'day')}
                onClick={() => setAdminTarget({ order: o, slot: null })}>ให้ยา PRN</Button>
              <span className="text-xs text-gray-500">วันนี้ {n} ครั้ง{o.prn_max_per_day ? ` / สูงสุด ${o.prn_max_per_day}` : ''}</span>
              {over && <Tag color="red" className="m-0"><PiWarningBold className="inline" /> ครบจำนวนสูงสุดแล้ว</Tag>}
            </div>
          );
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {slots.filter(s => s.order_id === o.id).map(s => (
              <SlotChip key={s.scheduled_at} slot={s}
                onClick={!s.admin_id && !marError && s.state !== 'upcoming' ? () => setAdminTarget({ order: o, slot: s }) : undefined} />
            ))}
          </div>
        );
      },
    },
  ];

  const orderColumns: ColumnsType<Order> = [
    { title: 'ยา', key: 'drug', render: (_, o) => OrderCell(o) },
    { title: 'กลุ่ม', dataIndex: 'drug_class', width: 140, render: v => <span className="text-xs">{CLASS_LABEL[v] ?? v}</span> },
    { title: 'เริ่ม', dataIndex: 'start_datetime', width: 100, render: v => <span className="text-xs">{fmt(v, 'DD/MM/YY HH:mm')}</span> },
    {
      title: 'ผู้คัดลอก / ตรวจทาน', key: 'by', width: 170,
      render: (_, o) => (
        <div className="text-xs leading-tight">
          <div>{o.created_by_name ?? o.created_by}</div>
          <div className={o.verified_by ? 'text-emerald-700' : 'text-amber-600'}>
            {o.verified_by ? `✓ ${o.verified_by_name ?? o.verified_by}` : 'รอตรวจทาน'}
          </div>
        </div>
      ),
    },
    {
      title: '', key: 'act', width: 150, align: 'right',
      render: (_, o) => (
        <div className="flex justify-end gap-1">
          {!o.verified_by && !o.discontinued_at && o.created_by !== me && (
            <Tooltip title="ตรวจทานว่าตรงกับคำสั่งแพทย์ (พยาบาลวิชาชีพ คนละคนกับผู้คัดลอก)">
              <Button size="small" type="primary" ghost icon={<PiSealCheckBold />} onClick={() => verify(o)}>ตรวจทาน</Button>
            </Tooltip>
          )}
          {!o.verified_by && !o.discontinued_at && (
            <Tooltip title="แก้ไข (ได้เฉพาะก่อนตรวจทาน)"><Button size="small" type="text" icon={<VscEdit />} onClick={() => setOrderModal({ open: true, order: o })} /></Tooltip>
          )}
          {!o.discontinued_at && <Button size="small" danger type="text" onClick={() => discontinue(o)}>หยุดยา</Button>}
          {!admins.some(a => a.order_id === o.id) && (
            <Tooltip title="ลบคำสั่งที่บันทึกผิด"><Button size="small" danger type="text" icon={<VscTrash />} onClick={() => deleteOrder(o)} /></Tooltip>
          )}
        </div>
      ),
    },
  ];

  const adminColumns: ColumnsType<Admin> = [
    {
      title: 'เวลา', dataIndex: 'admin_datetime', width: 95, render: (v, a) => (
        <div className="text-xs leading-tight">{fmt(v)}{a.scheduled_at && <div className="text-gray-400">มื้อ {fmt(a.scheduled_at, 'HH:mm')}</div>}</div>
      ),
    },
    {
      title: 'ยา', dataIndex: 'medication_name', width: 150, render: (v, a) => (
        <div className="leading-tight"><div className="font-semibold text-violet-700">{v}</div>
          <div className="text-xs text-gray-500">{a.status === 'given' ? `${a.dose_given} ${a.route ?? ''} ${a.site ?? ''}` : ''}</div></div>
      ),
    },
    {
      title: 'ผล', dataIndex: 'status', width: 150, render: (v, a) => (
        <div className="leading-tight">
          <Tag color={v === 'given' ? 'green' : 'default'} className="m-0 text-xs">{STATUS_LABEL[v] ?? v}</Tag>
          {a.reason_code && <div className="text-xs text-gray-500 mt-0.5">{REASON_LABEL[a.reason_code] ?? a.reason_code}</div>}
          {a.adverse_reaction && <div className="text-xs text-red-600 mt-0.5"><PiWarningBold className="inline" /> {a.adverse_note ?? 'ADR'}</div>}
        </div>
      ),
    },
    {
      title: 'PRN / ประเมิน', key: 'prn', width: 150, render: (_, a) => (a.prn_indication ? (
        <div className="text-xs leading-tight">
          <div>{a.prn_indication}</div>
          <div className="text-gray-500">คะแนน {a.pre_score ?? '-'} → {a.post_score ?? '?'}</div>
          {a.post_score === null && a.status === 'given' && <Button size="small" type="link" className="p-0! h-auto!" onClick={() => reassess(a)}>ประเมินซ้ำ</Button>}
        </div>
      ) : null),
    },
    {
      title: 'ผู้ให้ / ผู้ตรวจซ้ำ', key: 'who', width: 160, render: (_, a) => (
        <div className="text-xs leading-tight">{a.nurse_name}{a.double_checked_by_name && <div className="text-gray-500">ตรวจซ้ำ: {a.double_checked_by_name}</div>}</div>
      ),
    },
    { title: 'หมายเหตุ', dataIndex: 'note', ellipsis: true, render: (v, a) => <span className="text-xs">{[a.held_reason, v].filter(Boolean).join(' · ')}</span> },
    { title: '', key: 'del', width: 44, render: (_, a) => <Button size="small" danger type="text" icon={<VscTrash />} onClick={() => deleteAdmin(a)} /> },
  ];

  const missedOnDay = slots.filter(s => s.state === 'missed').length;
  const pendingVerify = orders.filter(o => !o.verified_by && !o.discontinued_at).length;
  const formattedAdmitDate = patient?.regdate ? dayjs(patient.regdate).format('DD/MM/YYYY HH:mm') : '-';

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        <div className="bg-linear-to-r from-violet-600 to-purple-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiPillBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">บันทึกการให้ยา (Medication Administration Record)</h1>
              <div className="flex flex-wrap items-center gap-3 mt-0.5">
                <span className="text-white/90 text-sm font-semibold">{patient?.ptname ?? '-'}</span>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">HN: {patient?.hn || '-'}</Tag>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">AN: {an}</Tag>
                <span className="text-white/70 text-xs">เตียง {patient?.bedno || '-'}</span>
                <span className="text-white/70 text-xs">Admit: {formattedAdmitDate}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/ipd/mar-dashboard"><Button size="small" icon={<PiChartBarBold />} className="border-white/30 text-white bg-white/10 hover:bg-white/20">วิเคราะห์การให้ยา</Button></Link>
            <Button size="small" onClick={() => window.history.back()} className="border-white/30 text-white bg-white/10 hover:bg-white/20">ย้อนกลับ</Button>
          </div>
        </div>

        {marError && <Alert type="error" showIcon className="mb-4" title="บันทึกการให้ยายังใช้งานไม่ได้" description={marError} />}
        {!marError && pendingVerify > 0 && (
          <Alert type="warning" showIcon className="mb-4" title={`มี ${pendingVerify} คำสั่งยาที่ยังไม่ผ่านการตรวจทาน`}
            description="คำสั่งที่คัดลอกจากคำสั่งแพทย์ต้องมีพยาบาลวิชาชีพอีกคนตรวจทาน — การให้ยาตามคำสั่งที่ยังไม่ตรวจทานจะถูกนับแยกในรายงาน" />
        )}

        {loading ? <FormSkeleton /> : (
          <div className="flex flex-col gap-4">
            <Card size="small" className="shadow-sm rounded-xl"
              title={
                <div className="flex flex-wrap items-center gap-2 py-1">
                  <span className="font-bold text-violet-700">ตารางให้ยา</span>
                  <Button size="small" type="text" icon={<PiCaretLeftBold />} onClick={() => setDate(d => d.subtract(1, 'day'))} />
                  <DatePicker size="small" value={date} format="DD/MM/YYYY" allowClear={false} onChange={d => d && setDate(d)} disabledDate={d => d.isAfter(dayjs(), 'day')} />
                  <Button size="small" type="text" icon={<PiCaretRightBold />} disabled={date.isSame(dayjs(), 'day')} onClick={() => setDate(d => d.add(1, 'day'))} />
                  {missedOnDay > 0 && <Tag color="red" className="m-0">ไม่มีบันทึก {missedOnDay} มื้อ</Tag>}
                </div>
              }
              extra={
                <Popover content={
                  <div className="flex flex-col gap-1 text-xs">
                    {(Object.keys(SLOT_STATE) as SlotState[]).map(k => (
                      <span key={k} className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-sm border" style={{ background: SLOT_STATE[k].bg, borderColor: SLOT_STATE[k].color }} />
                        {SLOT_STATE[k].label}
                      </span>
                    ))}
                    <span className="text-gray-500 mt-1">ตรงเวลา = ภายใน ±{codes?.windows.standard_minutes ?? 60} นาที (ยาตรงเวลาเข้ม ±{codes?.windows.time_critical_minutes ?? 30})</span>
                  </div>
                }>
                  <Button size="small" type="link">ความหมายของสี</Button>
                </Popover>
              }>
              <Table<Order> rowKey="id" size="small" pagination={false} columns={marColumns} dataSource={marRows}
                locale={{ emptyText: marError ? '-' : 'ไม่มีคำสั่งยาที่ต้องให้ในวันนี้' }} scroll={{ x: 'max-content' }} />
            </Card>

            <Card size="small" className="shadow-sm rounded-xl"
              title={<span className="font-bold text-violet-700">คำสั่งยา</span>}
              extra={<Button type="primary" size="small" icon={<PiPlusBold />} disabled={!!marError || !patient?.ward}
                onClick={() => setOrderModal({ open: true, order: null })} className="bg-violet-600">เพิ่มคำสั่งยา</Button>}>
              <Table<Order> rowKey="id" size="small" pagination={false} columns={orderColumns} dataSource={orders}
                rowClassName={o => (o.discontinued_at ? 'opacity-50' : '')} scroll={{ x: 'max-content' }}
                locale={{ emptyText: 'ยังไม่มีคำสั่งยา' }} />
            </Card>

            <Card size="small" className="shadow-sm rounded-xl" title={<span className="font-bold text-violet-700">ประวัติการให้ยา</span>}>
              <Table<Admin> rowKey="id" size="small" columns={adminColumns} dataSource={admins}
                pagination={{ pageSize: 20, size: 'small', hideOnSinglePage: true }} scroll={{ x: 'max-content' }}
                locale={{ emptyText: 'ยังไม่มีบันทึก' }} />
            </Card>
          </div>
        )}
      </div>

      <OrderModal open={orderModal.open} order={orderModal.order} codes={codes} patient={patient} an={an}
        onClose={() => setOrderModal({ open: false, order: null })} onSaved={refresh} />
      <AdminModal target={adminTarget} patient={patient} an={an} onClose={() => setAdminTarget(null)} onSaved={refresh} />
    </div>
  );
}
