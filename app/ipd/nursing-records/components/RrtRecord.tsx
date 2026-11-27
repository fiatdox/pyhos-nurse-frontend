'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, AutoComplete, Button, Card, Checkbox, DatePicker, Form, Input, Popconfirm, Segmented, Select, Spin, Tag } from 'antd';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import { PiCheckBold, PiPencilSimpleBold, PiPhoneCallBold, PiPlusBold, PiTrashBold, PiWarningBold, PiXBold } from 'react-icons/pi';

/**
 * บันทึกการตามทีม RRT (Rapid Response Team) — เกณฑ์ของโรงพยาบาล NEWS2 ≥ 5
 * ทุกครั้งที่สัญญาณชีพถึงเกณฑ์ต้องมีบันทึก: ตามแล้ว (เวลาตาม เวลาทีมมาถึง ผลลัพธ์) หรือไม่ได้ตามพร้อมเหตุผล
 * คัดกรอง sepsis: qSOFA (คำนวณจากสัญญาณชีพที่ถึงเกณฑ์) ≥ 2 ร่วมกับสงสัยติดเชื้อ
 * ใช้ในลิ้นชักของฟอร์มปรอท
 */

interface Qsofa { score: number; items: { rr: boolean; sbp: boolean; mentation: boolean } }
interface Trigger {
  id: number; record_datetime: string; news2_score: number;
  vital_r: number | null; vital_bp_s: number | null; vital_p: number | null; vital_t: string | number | null;
  vital_o2sat: number | null; avpu: string | null; gcs_total: number | null; nurse_name: string | null; qsofa: Qsofa;
}
interface RrtCall {
  id: number; vital_id: number | null; trigger_at: string; trigger_reason: 'news2' | 'nurse_concern' | 'other';
  news2_score: number | null; qsofa_score: number | null; suspected_infection: boolean; sepsis_screen_positive: boolean;
  status: 'called' | 'not_called'; not_called_reason: string | null; called_at: string | null; notified_to: string | null;
  team_arrived_at: string | null; outcome: string | null; outcome_note: string | null; note: string | null;
  nurse_name: string | null; updated_at: string | null;
}
interface RrtData { calls: RrtCall[]; triggers: Trigger[]; pending: Trigger[]; storage_ready: boolean; threshold: number; cover_hours: number }
interface FormValues {
  trigger_reason: RrtCall['trigger_reason']; vital_id?: number; trigger_at?: Dayjs;
  suspected_infection?: boolean; status: RrtCall['status']; not_called_reason?: string;
  called_at?: Dayjs; notified_to?: string; team_arrived_at?: Dayjs; outcome?: string; outcome_note?: string; note?: string;
}

const OUTCOMES = [
  { value: 'stay_ward', label: 'ดูแลต่อที่หอเดิม' },
  { value: 'transfer_icu', label: 'ย้าย ICU' },
  { value: 'transfer_other', label: 'ย้ายหอ/ส่งต่ออื่น' },
  { value: 'cpr', label: 'CPR' },
  { value: 'death', label: 'เสียชีวิต' },
  { value: 'other', label: 'อื่น ๆ' },
];
const outcomeLabel = (v: string | null) => OUTCOMES.find(o => o.value === v)?.label ?? '-';
const REASON_LABEL: Record<string, string> = { news2: 'NEWS2 ถึงเกณฑ์', nurse_concern: 'พยาบาลกังวลอาการ', other: 'อื่น ๆ' };
const NOT_CALLED_HINTS = ['DNR / ดูแลแบบประคับประคอง', 'แพทย์อยู่ที่เตียงแล้ว', 'วัดซ้ำทันทีแล้วค่ากลับสู่ปกติ', 'อยู่ระหว่างย้าย ICU'];
const fmt = (s: string | null | undefined) => (s ? dayjs(s).format('DD/MM HH:mm') : '-');
const minutesBetween = (a: string | Dayjs | null | undefined, b: string | Dayjs | null | undefined) =>
  a && b ? dayjs(b).diff(dayjs(a), 'minute') : null;
const authHeaders = (): Record<string, string> => {
  const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** ค่าของทั้งฟอร์ม (ระบุครบทุกช่อง ไม่ให้ค่ารายการก่อนหน้าค้าง) */
const toFormValues = (c: RrtCall | null, trig?: Trigger | null): FormValues => c ? {
  trigger_reason: c.trigger_reason, vital_id: c.vital_id ?? undefined,
  trigger_at: c.vital_id ? undefined : dayjs(c.trigger_at),
  suspected_infection: c.suspected_infection, status: c.status, not_called_reason: c.not_called_reason ?? undefined,
  called_at: c.called_at ? dayjs(c.called_at) : undefined, notified_to: c.notified_to ?? undefined,
  team_arrived_at: c.team_arrived_at ? dayjs(c.team_arrived_at) : undefined, outcome: c.outcome ?? undefined,
  outcome_note: c.outcome_note ?? undefined, note: c.note ?? undefined,
} : {
  trigger_reason: trig ? 'news2' : 'nurse_concern', vital_id: trig?.id, trigger_at: trig ? undefined : dayjs(),
  suspected_infection: false, status: 'called', not_called_reason: undefined,
  called_at: dayjs(), notified_to: undefined, team_arrived_at: undefined, outcome: undefined, outcome_note: undefined, note: undefined,
};

function QsofaView({ q }: { q: Qsofa }) {
  const item = (on: boolean, label: string) => (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${on ? 'bg-red-50 text-red-700 font-semibold' : 'bg-gray-50 text-gray-500'}`}>
      {on ? <PiCheckBold aria-hidden /> : <PiXBold aria-hidden />}{label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <b className={q.score >= 2 ? 'text-red-600' : 'text-gray-700'}>qSOFA {q.score}/3</b>
      {item(q.items.rr, 'RR ≥ 22')}
      {item(q.items.sbp, 'SBP ≤ 100')}
      {item(q.items.mentation, 'ความรู้สึกตัวเปลี่ยน')}
    </div>
  );
}

export default function RrtRecord({ an, wardCode, wardName, onSaved }: {
  an: string; wardCode?: string | null; wardName?: string | null; onSaved?: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [data, setData] = useState<RrtData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<RrtCall | null>(null);
  const top = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`/api/v1/nursing-records/rrt/${encodeURIComponent(an)}`, { headers: authHeaders() });
      setData(res.data.data);
      setError(null);
      return res.data.data as RrtData;
    } catch (e) {
      setError((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'โหลดข้อมูล RRT ไม่สำเร็จ');
      return null;
    }
  }, [an]);
  useEffect(() => {
    // เปิดมา: มีรายการถึงเกณฑ์ค้าง → ตั้งฟอร์มให้บันทึกรายการล่าสุดที่ค้างเลย
    // eslint-disable-next-line react-hooks/set-state-in-effect -- โหลดข้อมูลครั้งแรกเมื่อเปิดลิ้นชัก
    void load().then(d => { if (d?.pending[0]) form.setFieldsValue(toFormValues(null, d.pending[0])); });
  }, [load, form]);

  const reason = Form.useWatch('trigger_reason', form);
  const vitalId = Form.useWatch('vital_id', form);
  const status = Form.useWatch('status', form);
  const suspected = Form.useWatch('suspected_infection', form);
  const calledAt = Form.useWatch('called_at', form);
  const arrivedAt = Form.useWatch('team_arrived_at', form);
  const trig = useMemo(() => data?.triggers.find(t => t.id === vitalId) ?? null, [data, vitalId]);
  const sepsisPositive = !!suspected && !!trig && trig.qsofa.score >= 2;
  const responseMin = minutesBetween(calledAt, arrivedAt);

  const startNew = (t?: Trigger | null) => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue(toFormValues(null, t ?? null));
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const startEdit = (c: RrtCall) => {
    setEditing(c);
    form.resetFields();
    form.setFieldsValue(toFormValues(c));
    top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    const iso = (d?: Dayjs) => (d ? d.format('YYYY-MM-DD HH:mm:ss') : null);
    const payload = {
      an, ward_code: wardCode ?? null, ward_name: wardName ?? null,
      trigger_reason: v.trigger_reason, vital_id: v.trigger_reason === 'news2' ? v.vital_id ?? null : null,
      trigger_at: iso(v.trigger_at), suspected_infection: !!v.suspected_infection, status: v.status,
      not_called_reason: v.not_called_reason ?? null, called_at: iso(v.called_at), notified_to: v.notified_to ?? null,
      team_arrived_at: iso(v.team_arrived_at), outcome: v.outcome ?? null, outcome_note: v.outcome_note ?? null, note: v.note ?? null,
    };
    try {
      if (editing) await axios.put(`/api/v1/nursing-records/rrt/${editing.id}`, payload, { headers: authHeaders() });
      else await axios.post('/api/v1/nursing-records/rrt', payload, { headers: authHeaders() });
      message.success(editing ? 'แก้ไขบันทึกการตาม RRT แล้ว' : 'บันทึกการตาม RRT แล้ว');
      const d = await load();
      onSaved?.();
      startNew(d?.pending[0] ?? null);
    } catch (e) {
      const r = (e as { response?: { status?: number; data?: { message?: string; existing_id?: number } } }).response;
      message.error(r?.data?.message ?? 'บันทึกไม่สำเร็จ');
      if (r?.status === 409 && r.data?.existing_id) {
        const hit = data?.calls.find(c => c.id === r.data?.existing_id);
        if (hit) startEdit(hit);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await axios.delete(`/api/v1/nursing-records/rrt/${id}`, { headers: authHeaders() });
      message.success('ลบแล้ว');
      if (editing?.id === id) startNew();
      await load();
      onSaved?.();
    } catch {
      message.error('ลบไม่สำเร็จ');
    }
  };

  if (!data && !error) return <div className="py-16 text-center"><Spin /></div>;

  const triggerOptions = (data?.triggers ?? []).map(t => ({
    value: t.id,
    label: `${fmt(t.record_datetime)} · NEWS2 ${t.news2_score} · qSOFA ${t.qsofa.score}${data?.pending.some(p => p.id === t.id) ? ' · ยังไม่มีบันทึก' : ''}`,
  }));

  return (
    <div className="font-sans @container" ref={top}>
      {error && <Alert type="error" showIcon className="mb-3!" title={error} />}
      {data && !data.storage_ready && (
        <Alert type="warning" showIcon className="mb-3!" title="ยังบันทึกการตาม RRT ไม่ได้"
          description="ต้องรัน sql/2026-11-26_rrt_calls.sql ก่อน (รายการที่ถึงเกณฑ์ด้านล่างยังดูได้)" />
      )}
      {data && data.pending.length > 0 && (
        <Alert type="error" showIcon icon={<PiWarningBold />} className="mb-3!"
          title={<b>NEWS2 ≥ {data.threshold} ยังไม่มีบันทึกการตาม RRT ({data.pending.length} ครั้ง ใน 72 ชม.)</b>}
          description={
            <div className="flex flex-wrap gap-1 mt-1">
              {data.pending.map(t => (
                <Button key={t.id} size="small" danger onClick={() => startNew(t)}>
                  {fmt(t.record_datetime)} · NEWS2 {t.news2_score}{t.qsofa.score >= 2 ? ` · qSOFA ${t.qsofa.score}` : ''}
                </Button>
              ))}
            </div>
          } />
      )}

      <div className="grid grid-cols-1 @3xl:grid-cols-5 gap-4">
        <Card size="small" className="@3xl:col-span-2 rounded-xl shadow-sm"
          title={<span className={`font-bold text-sm ${editing ? 'text-blue-700' : 'text-red-700'}`}>
            <PiPhoneCallBold className="inline mr-1" aria-hidden />{editing ? 'แก้ไขบันทึกการตาม RRT' : 'บันทึกการตาม RRT'}
          </span>}
          extra={editing ? <Button size="small" icon={<PiPlusBold />} onClick={() => startNew()}>บันทึกใหม่</Button> : undefined}>
          <Form form={form} layout="vertical" size="middle" initialValues={toFormValues(null, null)}
            className="[&_.ant-form-item]:mb-3! [&_.ant-form-item-label_label]:font-semibold">
            <Form.Item name="trigger_reason" label="เหตุที่ตาม">
              <Segmented block options={[
                { value: 'news2', label: `NEWS2 ≥ ${data?.threshold ?? 5}` },
                { value: 'nurse_concern', label: 'พยาบาลกังวล' },
                { value: 'other', label: 'อื่น ๆ' },
              ]} />
            </Form.Item>
            {reason === 'news2' ? (
              <Form.Item name="vital_id" label="สัญญาณชีพที่ถึงเกณฑ์" rules={[{ required: true, message: 'เลือกสัญญาณชีพที่ถึงเกณฑ์' }]}
                extra={trig && (
                  <div className="mt-1 text-xs text-gray-600">
                    T {trig.vital_t ?? '-'} · P {trig.vital_p ?? '-'} · RR {trig.vital_r ?? '-'} · SBP {trig.vital_bp_s ?? '-'} · SpO₂ {trig.vital_o2sat ?? '-'} · {trig.avpu ?? '-'}
                  </div>
                )}>
                <Select options={triggerOptions} placeholder="เลือกครั้งที่ NEWS2 ≥ 5" notFoundContent="ยังไม่มีสัญญาณชีพที่ถึงเกณฑ์" />
              </Form.Item>
            ) : (
              <Form.Item name="trigger_at" label="เวลาที่พบอาการ" rules={[{ required: true, message: 'ระบุเวลา' }]}>
                <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" disabledDate={d => d.isAfter(dayjs(), 'day')} />
              </Form.Item>
            )}

            {/* คัดกรอง sepsis */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 mb-3">
              <div className="text-xs font-bold text-amber-800 mb-1">คัดกรอง sepsis (qSOFA ≥ 2 + สงสัยติดเชื้อ)</div>
              {trig ? <QsofaView q={trig.qsofa} /> : <div className="text-xs text-gray-500">qSOFA คำนวณจากสัญญาณชีพที่ถึงเกณฑ์ (ตามด้วยเหตุอื่นไม่มีค่าให้คำนวณ)</div>}
              <Form.Item name="suspected_infection" valuePropName="checked" className="mb-0! mt-1">
                <Checkbox>สงสัยติดเชื้อ (ไข้ แผล/สายสวนอักเสบ ปอดอักเสบ ปัสสาวะผิดปกติ ฯลฯ)</Checkbox>
              </Form.Item>
              {sepsisPositive && (
                <Alert type="error" showIcon className="mt-2!" title={<b>คัดกรอง sepsis พบ</b>}
                  description="รายงานแพทย์ทันทีเพื่อเริ่มแนวทางดูแล sepsis ของโรงพยาบาล" />
              )}
            </div>

            <Form.Item name="status" label="การตาม RRT">
              <Segmented block options={[{ value: 'called', label: 'ตาม RRT แล้ว' }, { value: 'not_called', label: 'ไม่ได้ตาม' }]} />
            </Form.Item>
            {status === 'not_called' ? (
              <Form.Item name="not_called_reason" label="เหตุผลที่ไม่ได้ตาม" rules={[{ required: true, whitespace: true, message: 'ต้องระบุเหตุผล' }]}>
                <AutoComplete options={NOT_CALLED_HINTS.map(v => ({ value: v }))} placeholder="เลือกหรือพิมพ์เหตุผล" />
              </Form.Item>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Form.Item name="called_at" label="เวลาที่ตาม" rules={[{ required: true, message: 'ระบุเวลาที่ตาม' }]}>
                    <DatePicker showTime format="DD/MM HH:mm" className="w-full" disabledDate={d => d.isAfter(dayjs(), 'day')} />
                  </Form.Item>
                  <Form.Item name="team_arrived_at" label="เวลาทีมมาถึง"
                    dependencies={['called_at']}
                    rules={[({ getFieldValue }) => ({
                      validator: (_, v?: Dayjs) => !v || !getFieldValue('called_at') || !v.isBefore(getFieldValue('called_at'))
                        ? Promise.resolve() : Promise.reject(new Error('ต้องไม่ก่อนเวลาที่ตาม')),
                    })]}>
                    <DatePicker showTime format="DD/MM HH:mm" className="w-full" placeholder="ระบุเมื่อทีมมาถึง" disabledDate={d => d.isAfter(dayjs(), 'day')}
                      renderExtraFooter={() => <Button size="small" type="link" onClick={() => form.setFieldValue('team_arrived_at', dayjs())}>ตอนนี้</Button>} />
                  </Form.Item>
                </div>
                {responseMin !== null && responseMin >= 0 && (
                  <div className="text-xs -mt-2 mb-3">เวลาตอบสนอง <b>{responseMin} นาที</b></div>
                )}
                <Form.Item name="notified_to" label="ผู้รับแจ้ง">
                  <Input maxLength={200} placeholder="เช่น แพทย์เวร / ทีม RRT" />
                </Form.Item>
                <Form.Item name="outcome" label="ผลลัพธ์">
                  <Select allowClear options={OUTCOMES} placeholder="ระบุเมื่อทราบผล" />
                </Form.Item>
                <Form.Item name="outcome_note" label="รายละเอียดผลลัพธ์">
                  <Input.TextArea rows={2} maxLength={2000} />
                </Form.Item>
              </>
            )}
            <Form.Item name="note" label="บันทึกเพิ่มเติม">
              <Input.TextArea rows={2} maxLength={2000} />
            </Form.Item>
            <div className="sticky bottom-0 z-10 -mx-3 px-3 pt-2 pb-3 bg-white border-t border-gray-100">
              <Button type="primary" danger block loading={saving} disabled={!data?.storage_ready} onClick={() => void save()}>
                {editing ? 'บันทึกการแก้ไข' : 'บันทึกการตาม RRT'}
              </Button>
            </div>
          </Form>
        </Card>

        <Card size="small" className="@3xl:col-span-3 rounded-xl shadow-sm" title={<span className="font-bold text-sm">ประวัติการตาม RRT ({data?.calls.length ?? 0})</span>}>
          {(data?.calls.length ?? 0) === 0 && <div className="py-10 text-center text-sm text-gray-500">ยังไม่มีบันทึก</div>}
          <div className="space-y-2">
            {data?.calls.map(c => {
              const rm = minutesBetween(c.called_at, c.team_arrived_at);
              return (
                <div key={c.id} className={`rounded-lg border p-3 ${editing?.id === c.id ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'}`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b>{fmt(c.trigger_at)}</b>
                    <Tag className="m-0">{REASON_LABEL[c.trigger_reason]}{c.news2_score !== null ? ` · NEWS2 ${c.news2_score}` : ''}</Tag>
                    {c.status === 'called'
                      ? <Tag color="red" className="m-0">ตาม RRT {fmt(c.called_at)}</Tag>
                      : <Tag color="default" className="m-0">ไม่ได้ตาม</Tag>}
                    {c.qsofa_score !== null && <Tag color={c.qsofa_score >= 2 ? 'orange' : 'default'} className="m-0">qSOFA {c.qsofa_score}</Tag>}
                    {c.sepsis_screen_positive && <Tag color="volcano" className="m-0 font-bold">คัดกรอง sepsis พบ</Tag>}
                  </div>
                  <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                    {c.status === 'called' ? (
                      <div>
                        ทีมมาถึง {fmt(c.team_arrived_at)}{rm !== null ? ` (ตอบสนอง ${rm} นาที)` : ''} · ผู้รับแจ้ง {c.notified_to || '-'} · ผลลัพธ์ <b>{outcomeLabel(c.outcome)}</b>
                      </div>
                    ) : <div>เหตุผล: {c.not_called_reason}</div>}
                    {c.outcome_note && <div>{c.outcome_note}</div>}
                    {c.note && <div className="text-gray-500">{c.note}</div>}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-400">บันทึกโดย {c.nurse_name || '-'}</span>
                    <span className="flex gap-1">
                      <Button size="small" icon={<PiPencilSimpleBold />} onClick={() => startEdit(c)} disabled={editing?.id === c.id}>แก้ไข</Button>
                      <Popconfirm title="ยืนยันลบ?" okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => void remove(c.id)}>
                        <Button size="small" danger icon={<PiTrashBold />} aria-label="ลบ" />
                      </Popconfirm>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
