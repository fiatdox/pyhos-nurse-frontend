'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Alert,
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Radio,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Timeline,
  TimePicker,
  Tooltip,
  Typography,
} from 'antd';
import type { DescriptionsProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import Navbar from '../../../components/Navbar';
import { getUserProfile } from '../../../lib/auth';
import {
  PiListChecksBold,
  PiArrowLeftBold,
  PiCheckCircleBold,
  PiTrashBold,
  PiSealCheckBold,
  PiUserBold,
  PiPlusBold,
  PiFolderOpenBold,
  PiInfoBold,
  PiProhibitBold,
  PiTableBold,
  PiClockCounterClockwiseBold,
} from 'react-icons/pi';
import { VscSave } from 'react-icons/vsc';

const { Text, Title, Paragraph } = Typography;

const BRAND = '#006b5f';

/**
 * แผนการพยาบาลแบบ Focus list (CNPG)
 *
 * ต่างจากแผนแบบพิมพ์เองตรงที่กิจกรรมการพยาบาลมาจากแม่แบบที่หอผู้ป่วยเขียนไว้
 * พยาบาลหน้างานกรอกเฉพาะคอลัมน์ขวา — ติ๊กและเติมค่า ซึ่งเป็นข้อมูลที่นับเป็นตัวชี้วัดได้
 * เช่น อัตราการใส่ท่อช่วยหายใจซ้ำ ซึ่งข้อความอิสระตอบไม่ได้
 */

// ---------------- ชนิดข้อมูล ----------------

interface PatientInfo {
  hn: string;
  an: string;
  ptname?: string;
  bedno?: string;
  regdate?: string;
  doctor_name?: string;
  pttype_name?: string;
  ward?: string;
  ward_name?: string;
}

type EvalKind = 'check' | 'choice' | 'number' | 'text' | 'time';

interface EvalItem {
  id: string;
  kind: EvalKind;
  label: string;
  unit?: string | null;
  min?: number | null;
  max?: number | null;
  options?: string[];
  allow_other?: boolean;
}

interface Section {
  id: string;
  title: string;
  activities: string[];
  evaluations: EvalItem[];
}

interface TemplateSummary {
  id: number;
  code: string;
  title: string;
  objective?: string | null;
  owner_ward_code: string;
  owner_ward_name?: string | null;
  version: number;
  status: string;
  section_count?: number;
}

type AnswerValue = boolean | number | string;

interface FocusRecord {
  id: number;
  an: string;
  ward_code?: string | null;
  ward_name?: string | null;
  nurse_name?: string | null;
  /** กลุ่มงานของผู้บันทึก ณ เวลาที่บันทึก (majors.name) */
  nurse_major?: string | null;
  template_id: number;
  template_code: string;
  template_title: string;
  template_version: number;
  structure: { sections: Section[] };
  answers: Record<string, AnswerValue>;
  record_datetime: string;
  shift?: string | null;
  status: 'draft' | 'final' | 'cancelled';
  completed_at?: string | null;
  note?: string | null;
  revision_no?: number;
  /** เวลาที่นั่งพิมพ์ ต่างจาก record_datetime ซึ่งคือเวลาที่เหตุการณ์เกิด */
  entered_at?: string | null;
  late_entry_reason?: string | null;
  is_late_entry?: boolean;
  cancelled_at?: string | null;
  /** username ของผู้ยกเลิก เก็บไว้ชี้ตัวตน หน้าจอแสดง cancelled_by_name แทน */
  cancelled_by?: string | null;
  cancelled_by_name?: string | null;
  cancel_reason?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  updated_at?: string | null;
  /** username ของผู้แก้ไขล่าสุด — อ่านไม่รู้ว่าใคร ใช้ updated_by_name แทนเมื่อมี */
  updated_by?: string | null;
  updated_by_name?: string | null;
  answered: number;
  total_items: number;
}

// ---------------- ตัวช่วย ----------------

/**
 * ค่าที่ยังไม่ได้ตอบ
 * ต่างจากตอบว่า "ไม่" ซึ่งเก็บเป็น false — ช่องที่ยังไม่แตะต้องไม่ถูกส่งขึ้นไป
 */
const isBlank = (v: unknown) => v === null || v === undefined || v === '';

/**
 * id ของตารางเป็น bigint ซึ่งฝั่งเซิร์ฟเวอร์คืนมาเป็นข้อความ ("1" ไม่ใช่ 1)
 * แปลงเป็นตัวเลขตั้งแต่ตอนรับเข้า ไม่งั้นการเทียบ id และการส่งค่ากลับจะเพี้ยนแบบเงียบๆ
 */
const toNum = (v: unknown) => Number(v ?? 0);

/**
 * ย้อนหลังเกินกี่ชั่วโมงจึงต้องระบุเหตุผล
 * ต้องตรงกับ REASON_REQUIRED_HOURS ที่ focusRecordController ไม่งั้นหน้าจอจะปล่อยผ่าน
 * แล้วไปโดนปฏิเสธที่เซิร์ฟเวอร์ ซึ่งผู้ใช้จะงงว่าทำไมกรอกครบแล้วยังบันทึกไม่ได้
 */
const LATE_HOURS = 24;

/** ความยาวเหตุผลขั้นต่ำ ตรงกับที่เซิร์ฟเวอร์บังคับทั้งตอนแก้และตอนยกเลิก */
const MIN_REASON = 5;

/** มุมมองรายการใบบันทึก — ตารางไว้กวาดตาเทียบค่า ไทม์ไลน์ไว้ดูลำดับเหตุการณ์ */
type ListView = 'table' | 'timeline';

/**
 * กล่องขอเหตุผลก่อนทำสิ่งที่ย้อนไม่ได้กับเวชระเบียน
 *
 * ใช้ Modal แบบมี state แทน modal.confirm เพราะการตรวจความถูกต้องใน onOk
 * ต้อง reject promise เพื่อไม่ให้กล่องปิด ซึ่ง Next dev overlay จับมาแสดงเป็น error
 * แบบนี้ปุ่มตกลงปิดไว้จนกว่าเหตุผลจะยาวพอ จึงไม่มีเส้นทางที่ต้อง reject เลย
 */
interface ReasonPrompt {
  title: string;
  description: string;
  placeholder: string;
  okText: string;
  cancelText?: string;
  danger?: boolean;
  onSubmit: (reason: string) => Promise<void>;
}

const STATUS_TAG: Record<string, { label: string; color: string }> = {
  draft: { label: 'ร่าง', color: 'orange' },
  final: { label: 'เข้าเวชระเบียนแล้ว', color: 'green' },
  // ใบที่ยกเลิกหลังเข้าเวชระเบียนแล้วยังคงอยู่ในรายการ ไม่ซ่อนทิ้ง
  // ถ้าหายไป คนอ่านย้อนหลังจะไม่รู้ว่าเคยมีใบนี้และถูกเพิกถอนด้วยเหตุผลใด
  cancelled: { label: 'ยกเลิกแล้ว', color: 'red' },
};

// ---------------- ช่องกรอกผลประเมินหนึ่งรายการ ----------------

/**
 * หนึ่งบรรทัดในคอลัมน์ขวาของฟอร์มกระดาษ
 * ชนิดของช่องมาจากแม่แบบ ไม่ได้เดาจากข้อความ — แม่แบบเป็นคนบอกว่าอันไหนติ๊ก อันไหนเติมค่า
 */
function EvalControl({
  item, value, disabled, onChange,
}: {
  item: EvalItem;
  value: AnswerValue | undefined;
  disabled: boolean;
  onChange: (next: AnswerValue | null) => void;
}) {
  const asText = typeof value === 'string' ? value : '';
  // choice ที่เปิดช่อง "…(ระบุ)" — ค่าที่ไม่อยู่ในตัวเลือกแปลว่าผู้ใช้พิมพ์เอง
  const isOther = Boolean(item.allow_other) && asText !== '' && !(item.options ?? []).includes(asText);
  const [otherMode, setOtherMode] = useState(isOther);

  useEffect(() => { if (isOther) setOtherMode(true); }, [isOther]);

  switch (item.kind) {
    case 'check':
      return (
        <Checkbox
          checked={value === true}
          disabled={disabled}
          onChange={e => onChange(e.target.checked ? true : null)}
        >
          <span style={{ fontSize: 13 }}>{item.label}</span>
        </Checkbox>
      );

    case 'choice':
      return (
        <Flex vertical gap={4}>
          <Text style={{ fontSize: 13 }}>{item.label}</Text>
          <Radio.Group
            value={otherMode ? '__other__' : (asText || undefined)}
            disabled={disabled}
            onChange={e => {
              if (e.target.value === '__other__') { setOtherMode(true); onChange(null); }
              else { setOtherMode(false); onChange(e.target.value); }
            }}
          >
            <Space size={4} wrap>
              {(item.options ?? []).map(opt => (
                <Radio key={opt} value={opt} style={{ fontSize: 13 }}>{opt}</Radio>
              ))}
              {item.allow_other && <Radio value="__other__" style={{ fontSize: 13 }}>อื่นๆ (ระบุ)</Radio>}
            </Space>
          </Radio.Group>
          {otherMode && (
            <Input
              size="small"
              placeholder="ระบุ"
              value={isOther ? asText : ''}
              disabled={disabled}
              onChange={e => onChange(e.target.value || null)}
              style={{ maxWidth: 320 }}
            />
          )}
        </Flex>
      );

    case 'number':
      return (
        <Flex align="center" gap={8} wrap>
          <Text style={{ fontSize: 13, minWidth: 150 }}>{item.label}</Text>
          <InputNumber
            size="small"
            value={typeof value === 'number' ? value : null}
            disabled={disabled}
            min={item.min ?? undefined}
            max={item.max ?? undefined}
            onChange={v => onChange(v === null ? null : Number(v))}
            style={{ width: 120 }}
          />
          {/* หน่วยเป็นข้อความต่อท้าย ตรงตามฟอร์มกระดาษที่เขียนว่า "RR=……ครั้งต่อนาที" */}
          {item.unit && <Text type="secondary" style={{ fontSize: 12 }}>{item.unit}</Text>}
        </Flex>
      );

    case 'time':
      return (
        <Flex align="center" gap={8} wrap>
          <Text style={{ fontSize: 13, minWidth: 150 }}>{item.label}</Text>
          <TimePicker
            size="small"
            format="HH:mm"
            value={asText ? dayjs(asText, 'HH:mm') : null}
            disabled={disabled}
            onChange={d => onChange(d ? d.format('HH:mm') : null)}
            style={{ width: 120 }}
          />
        </Flex>
      );

    case 'text':
    default:
      return (
        <Flex align="center" gap={8} wrap>
          <Text style={{ fontSize: 13, minWidth: 150 }}>{item.label}</Text>
          <Input
            size="small"
            value={asText}
            disabled={disabled}
            onChange={e => onChange(e.target.value || null)}
            style={{ width: 220 }}
          />
        </Flex>
      );
  }
}

// ---------------- หนึ่งระยะ = สองคอลัมน์ ----------------

function SectionBlock({
  section, answers, disabled, onAnswer,
}: {
  section: Section;
  answers: Record<string, AnswerValue>;
  disabled: boolean;
  onAnswer: (id: string, next: AnswerValue | null) => void;
}) {
  const answered = section.evaluations.filter(e => !isBlank(answers[e.id])).length;

  return (
    <Card
      size="small"
      variant="outlined"
      style={{ borderLeft: `4px solid ${BRAND}` }}
      styles={{ header: { background: `${BRAND}14`, borderBottom: `1px solid ${BRAND}40` } }}
      title={<Text strong style={{ color: BRAND }}>{section.title}</Text>}
      extra={
        section.evaluations.length > 0 && (
          <Tag color={answered === 0 ? 'default' : answered === section.evaluations.length ? 'green' : 'blue'}>
            บันทึกแล้ว {answered}/{section.evaluations.length}
          </Tag>
        )
      }
    >
      <Row gutter={[16, 16]}>
        {/* ซ้าย — กิจกรรมการพยาบาลจากแม่แบบ อ่านอย่างเดียว */}
        <Col xs={24} lg={14}>
          <Text type="secondary" style={{ fontSize: 12 }}>กิจกรรมการพยาบาล</Text>
          {section.activities.length === 0 ? (
            <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 6 }}>—</Paragraph>
          ) : (
            <ol style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 13, lineHeight: 1.85 }}>
              {section.activities.map((a, i) => <li key={i}>{a}</li>)}
            </ol>
          )}
        </Col>

        {/* ขวา — ผลประเมินที่พยาบาลติ๊กและเติมค่า */}
        <Col xs={24} lg={10} style={{ borderLeft: '1px solid #f0f0f0' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>ประเมินผล</Text>
          {section.evaluations.length === 0 ? (
            <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 6 }}>—</Paragraph>
          ) : (
            <Flex vertical gap={10} style={{ marginTop: 8 }}>
              {section.evaluations.map(item => (
                <EvalControl
                  key={item.id}
                  item={item}
                  value={answers[item.id]}
                  disabled={disabled}
                  onChange={next => onAnswer(item.id, next)}
                />
              ))}
            </Flex>
          )}
        </Col>
      </Row>
    </Card>
  );
}

/** ป้ายในปุ่มสลับมุมมอง — บังคับให้ไอคอนกับข้อความอยู่บรรทัดเดียวกันเสมอ */
function SegLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      {icon}
      {text}
    </span>
  );
}

// ---------------- รายการใบบันทึกแบบไทม์ไลน์ ----------------

/**
 * มุมมองเดียวกับตาราง แต่เรียงตามเวลาให้เห็นลำดับเหตุการณ์ระหว่างนอนโรงพยาบาล
 * ใช้ตอนอยากเห็นภาพรวมว่าผู้ป่วยผ่านอะไรมาบ้าง เช่น รับใหม่ → ถอดท่อ → ย้าย ward
 * เรียงใหม่สุดไว้บนเหมือนตาราง จะได้ไม่ต้องคิดใหม่เวลาสลับมุมมอง
 */
function RecordTimeline({
  records, onOpen, onRemove,
}: {
  records: FocusRecord[];
  onOpen: (id: number) => void;
  onRemove: (record: FocusRecord) => void;
}) {
  const dotColor = (status: string) =>
    status === 'final' ? 'green' : status === 'cancelled' ? 'red' : 'orange';

  return (
    <Timeline
      style={{ marginTop: 8, paddingLeft: 4 }}
      items={records.map(row => {
        const cancelled = row.status === 'cancelled';
        const percent = row.total_items ? Math.round((row.answered / row.total_items) * 100) : 0;

        return {
          color: dotColor(row.status),
          content: (
            <Flex vertical gap={6} style={{ opacity: cancelled ? 0.55 : 1, paddingBottom: 4 }}>
              <Flex justify="space-between" align="flex-start" gap={12} wrap>
                <Flex vertical gap={2}>
                  <Space size={6} wrap>
                    <Text
                      strong
                      style={{
                        fontSize: 14,
                        textDecoration: cancelled ? 'line-through' : undefined,
                      }}
                    >
                      {row.template_title}
                    </Text>
                    <Tag color={STATUS_TAG[row.status]?.color} style={{ margin: 0 }}>
                      {STATUS_TAG[row.status]?.label ?? row.status}
                    </Tag>
                    {(row.revision_no ?? 0) > 0 && (
                      <Tag style={{ margin: 0 }}>แก้ไข {row.revision_no} ครั้ง</Tag>
                    )}
                    {row.is_late_entry && (
                      <Tooltip
                        title={`ลงข้อมูลเมื่อ ${
                          row.entered_at ? dayjs(row.entered_at).format('DD/MM/YYYY HH:mm') : '-'
                        }${row.late_entry_reason ? ` · ${row.late_entry_reason}` : ''}`}
                      >
                        <Tag color="gold" style={{ margin: 0 }}>ลงย้อนหลัง</Tag>
                      </Tooltip>
                    )}
                  </Space>

                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(row.record_datetime).format('DD/MM/YYYY HH:mm')}
                    {row.shift ? ` · เวร${row.shift}` : ''}
                  </Text>

                  {/* ผู้บันทึกพร้อมสังกัด — ต่อท้ายเฉพาะส่วนที่มีข้อมูลจริง
                      ใบเก่าที่บันทึกก่อนเก็บกลุ่มงานจะแสดงแค่ชื่อเหมือนเดิม */}
                  {row.nurse_name && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      สร้างโดย{' '}
                      {[row.nurse_name, row.nurse_major, row.ward_name]
                        .filter(v => String(v ?? '').trim())
                        .join(' · ')}
                      {row.created_at ? ` — ${dayjs(row.created_at).format('DD/MM/YYYY HH:mm')}` : ''}
                    </Text>
                  )}

                  {/* บอกเฉพาะเมื่อมีการแก้จริง ใบที่เพิ่งสร้างยังไม่มี updated_at */}
                  {row.updated_at && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ปรับปรุงล่าสุดโดย {row.updated_by_name || '-'}
                      {' '}— {dayjs(row.updated_at).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  )}

                  {cancelled && (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      ยกเลิกเมื่อ{' '}
                      {row.cancelled_at ? dayjs(row.cancelled_at).format('DD/MM/YYYY HH:mm') : '-'}
                      {row.cancelled_by_name ? ` โดย ${row.cancelled_by_name}` : ''}
                      {row.cancel_reason ? ` — ${row.cancel_reason}` : ''}
                    </Text>
                  )}
                </Flex>

                <Space size={4}>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<PiFolderOpenBold />}
                    onClick={() => onOpen(row.id)}
                  >
                    เปิด
                  </Button>
                  <Tooltip title={cancelled ? 'ใบนี้ยกเลิกไปแล้ว' : 'ยกเลิกใบนี้'}>
                    <Button
                      size="small"
                      danger
                      type="text"
                      icon={<PiTrashBold />}
                      disabled={cancelled}
                      onClick={() => onRemove(row)}
                    />
                  </Tooltip>
                </Space>
              </Flex>

              <Tooltip title={`บันทึกผลประเมินแล้ว ${row.answered} จาก ${row.total_items} รายการ`}>
                <Progress
                  percent={percent}
                  size="small"
                  strokeColor={cancelled ? '#bfbfbf' : BRAND}
                  style={{ maxWidth: 320, margin: 0 }}
                />
              </Tooltip>
            </Flex>
          ),
        };
      })}
    />
  );
}

// ---------------- หน้าจอ ----------------

function FocusInner({ an }: { an: string }) {
  // ต้องเอา modal มาจาก App ไม่ใช้ Modal.confirm แบบ static
  // เพราะ static เรียกนอกต้นไม้ React จึงมองไม่เห็น ConfigProvider — ธีมและสีแบรนด์จะหลุด
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<FocusRecord[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ใบที่กำลังเปิดอยู่ — null คือหน้ารายการ
  const [openId, setOpenId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [dirty, setDirty] = useState(false);

  const [prompt, setPrompt] = useState<ReasonPrompt | null>(null);
  const [promptReason, setPromptReason] = useState('');
  const [promptBusy, setPromptBusy] = useState(false);

  const [listView, setListView] = useState<ListView>('table');

  const [pickOpen, setPickOpen] = useState(false);
  const [pickTemplate, setPickTemplate] = useState<number | null>(null);
  // เวลาที่เหตุการณ์เกิดจริง ไม่ใช่เวลาที่นั่งพิมพ์ — ตั้งต้นเป็นตอนนี้ แต่ย้อนหลังได้
  const [pickAt, setPickAt] = useState<Dayjs>(dayjs());
  const [pickLateReason, setPickLateReason] = useState('');

  const profile = useMemo(() => getUserProfile(), []);

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const openRecord = useMemo(() => records.find(r => r.id === openId) ?? null, [records, openId]);

  // เวชระเบียนโหลดไม่ได้ต้องบอกให้รู้ ห้ามแสดงข้อมูลตัวอย่างแทน
  // เพราะบนหน้าจอจะแยกไม่ออกว่าอันไหนของผู้ป่วยจริง
  const fetchRecords = useCallback(async () => {
    try {
      const res = await axios.get(`/api/v1/nursing-records/focus/${an}`, { headers: getHeaders() });
      if (res.data?.success) {
        setRecords((res.data.data ?? []).map((r: FocusRecord) => ({
          ...r,
          id: toNum(r.id),
          template_id: toNum(r.template_id),
        })));
        setLoadError(null);
      } else {
        setRecords([]);
        setLoadError(res.data?.message || 'โหลดใบบันทึกไม่สำเร็จ');
      }
    } catch (error: any) {
      setRecords([]);
      setLoadError(error?.response?.data?.message || 'โหลดใบบันทึกไม่สำเร็จ กรุณาลองใหม่');
    }
  }, [an, getHeaders]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const headers = getHeaders();

      try {
        const res = await axios.post('/api/v1/patients/patient-by-an', { an }, { headers });
        if (res.data?.success && res.data.data) {
          const p = Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;
          setPatient(p ?? null);
        }
      } catch (error) {
        console.error('Error fetching patient:', error);
      }

      try {
        const res = await axios.get('/api/v1/care-plan-templates', { headers });
        if (res.data?.success) {
          setTemplates((res.data.data ?? []).map((t: TemplateSummary) => ({ ...t, id: toNum(t.id) })));
        }
      } catch {
        // ไม่มีรายการแม่แบบก็ยังเปิดใบเดิมดูได้ แค่เปิดใบใหม่ไม่ได้
      }

      await fetchRecords();
      setLoading(false);
    })();
  }, [an, getHeaders, fetchRecords]);

  // เปิดใบไหนก็โหลดคำตอบของใบนั้นมาเป็นค่าตั้งต้น
  useEffect(() => {
    if (!openRecord) { setAnswers({}); setDirty(false); return; }
    setAnswers({ ...(openRecord.answers ?? {}) });
    setDirty(false);
    // ผูกกับ id ของใบเท่านั้น ไม่งั้นทุกครั้งที่ refetch จะทับสิ่งที่พยาบาลกำลังพิมพ์ค้างไว้
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const setAnswer = (id: string, next: AnswerValue | null) => {
    setAnswers(prev => {
      const out = { ...prev };
      if (next === null) delete out[id];
      else out[id] = next;
      return out;
    });
    setDirty(true);
  };

  // ---------------- เปิดใบใหม่ ----------------

  const openPicker = () => {
    // ตั้งเวลาใหม่ทุกครั้งที่เปิด ไม่งั้นถ้าเปิดหน้าค้างไว้นาน จะได้เวลาตอนที่โหลดหน้า
    setPickAt(dayjs());
    setPickLateReason('');
    setPickTemplate(null);
    setPickOpen(true);
  };

  const createRecord = async () => {
    if (!pickTemplate) return;
    setSaving(true);
    try {
      const res = await axios.post(
        '/api/v1/nursing-records/focus',
        {
          an,
          template_id: pickTemplate,
          ward_code: patient?.ward,
          ward_name: patient?.ward_name,
          record_datetime: pickAt.format('YYYY-MM-DD HH:mm:ss'),
          late_entry_reason: pickLateReason.trim() || undefined,
        },
        { headers: getHeaders() }
      );
      if (res.data?.success) {
        message.success(res.data.message);
        setPickOpen(false);
        setPickTemplate(null);
        await fetchRecords();
        setOpenId(toNum(res.data.data.id));
      } else {
        message.error(res.data?.message || 'เปิดใบไม่สำเร็จ');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'เปิดใบไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  // ---------------- บันทึกผลประเมิน ----------------

  const saveAnswers = async (amendReason?: string) => {
    if (!openRecord) return;
    setSaving(true);
    try {
      const res = await axios.put(
        `/api/v1/nursing-records/focus/${openRecord.id}`,
        { answers, ...(amendReason ? { amend_reason: amendReason } : {}) },
        { headers: getHeaders() }
      );
      if (res.data?.success) {
        message.success(res.data.message);
        setDirty(false);
        await fetchRecords();
      } else {
        message.error(res.data?.message || 'บันทึกไม่สำเร็จ');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  /**
   * ใบที่ปิดแล้วคือเวชระเบียน แก้ต้องมีเหตุผลและระบบจะเก็บฉบับเดิมไว้
   * ถามเหตุผลตั้งแต่ที่หน้าจอ ไม่ปล่อยให้ยิงไปโดนปฏิเสธที่เซิร์ฟเวอร์แล้วค่อยรู้
   */
  const requestSave = () => {
    if (!openRecord) return;
    if (openRecord.status === 'draft') { void saveAnswers(); return; }

    setPrompt({
      title: 'แก้ไขบันทึกที่เข้าเวชระเบียนแล้ว',
      description: 'ใบนี้ปิดไปแล้ว ระบบจะเก็บฉบับเดิมไว้เป็นประวัติ พร้อมบันทึกว่าใครแก้ด้วยเหตุผลใด',
      placeholder: 'เหตุผลในการแก้ไข เช่น บันทึกค่าผิดจากต้นฉบับ',
      okText: 'บันทึกการแก้ไข',
      onSubmit: saveAnswers,
    });
  };

  const completeRecord = async () => {
    if (!openRecord) return;
    setSaving(true);
    try {
      // บันทึกที่ค้างอยู่ก่อน ไม่งั้นสิ่งที่เพิ่งติ๊กจะไม่ถูกนับตอนตรวจความครบ
      if (dirty) {
        await axios.put(
          `/api/v1/nursing-records/focus/${openRecord.id}`,
          { answers },
          { headers: getHeaders() }
        );
        setDirty(false);
      }
      const res = await axios.post(
        `/api/v1/nursing-records/focus-complete/${openRecord.id}`,
        {},
        { headers: getHeaders() }
      );
      if (res.data?.success) {
        message.success(res.data.message);
        await fetchRecords();
      } else {
        message.error(res.data?.message || 'ปิดใบไม่สำเร็จ');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'ปิดใบไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const removeRecord = async (record: FocusRecord, reason?: string) => {
    try {
      const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
      const res = await axios.delete(
        `/api/v1/nursing-records/focus/${record.id}${query}`,
        { headers: getHeaders() }
      );
      if (res.data?.success) {
        message.success(res.data.message);
        if (openId === record.id) setOpenId(null);
        await fetchRecords();
      } else {
        message.error(res.data?.message || 'ยกเลิกไม่สำเร็จ');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'ยกเลิกไม่สำเร็จ');
    }
  };

  const requestRemove = (record: FocusRecord) => {
    if (record.status === 'draft') { void removeRecord(record); return; }

    setPrompt({
      title: 'ยกเลิกใบที่เข้าเวชระเบียนแล้ว',
      description: 'ใบจะยังแสดงในประวัติพร้อมตราประทับว่ายกเลิก ระบบบันทึกเหตุผลและชื่อผู้ยกเลิกไว้ด้วย',
      placeholder: 'เหตุผลในการยกเลิก เช่น บันทึกผิดคน',
      okText: 'ยกเลิกใบนี้',
      danger: true,
      cancelText: 'ไม่ใช่ตอนนี้',
      onSubmit: reason => removeRecord(record, reason),
    });
  };

  // ---------------- ส่วนหัว ----------------

  const headerItems: DescriptionsProps['items'] = [
    { key: 'hn', label: 'HN', children: patient?.hn ?? '-' },
    { key: 'an', label: 'AN', children: an },
    { key: 'bed', label: 'เตียง', children: patient?.bedno ?? '-' },
    { key: 'ward', label: 'หอผู้ป่วย', children: patient?.ward_name ?? patient?.ward ?? '-' },
    { key: 'doctor', label: 'แพทย์', children: patient?.doctor_name ?? '-' },
    {
      key: 'admit', label: 'วันที่รับไว้',
      children: patient?.regdate ? dayjs(patient.regdate).format('DD/MM/YYYY HH:mm') : '-',
    },
  ];

  const drafts = records.filter(r => r.status === 'draft');
  const finals = records.filter(r => r.status === 'final');
  const cancelled = records.filter(r => r.status === 'cancelled');
  // ใบที่ยกเลิกแล้วเปิดดูได้อย่างเดียว ทุกช่องต้องล็อก
  const isCancelled = openRecord?.status === 'cancelled';

  const columns: ColumnsType<FocusRecord> = [
    {
      title: 'Focus',
      dataIndex: 'template_title',
      render: (title: string, row) => (
        <Flex vertical gap={2}>
          <Text strong style={{ fontSize: 13 }}>{title}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {row.template_code} · แม่แบบรุ่นที่ {row.template_version}
          </Text>
        </Flex>
      ),
    },
    {
      title: 'วันเวลาที่บันทึก',
      dataIndex: 'record_datetime',
      width: 165,
      render: (v: string, row) => (
        <Flex vertical gap={2}>
          <Text style={{ fontSize: 13 }}>{dayjs(v).format('DD/MM/YYYY HH:mm')}</Text>
          <Space size={4} wrap>
            {row.shift && <Text type="secondary" style={{ fontSize: 11 }}>เวร{row.shift}</Text>}
            {/* ต้องเห็นได้จากรายการว่าใบไหนลงย้อนหลัง ไม่ต้องเปิดเข้าไปดู */}
            {row.is_late_entry && (
              <Tooltip
                title={
                  <>
                    ลงข้อมูลเมื่อ {row.entered_at ? dayjs(row.entered_at).format('DD/MM/YYYY HH:mm') : '-'}
                    {row.late_entry_reason ? <><br />เหตุผล: {row.late_entry_reason}</> : null}
                  </>
                }
              >
                <Tag color="gold" style={{ margin: 0, fontSize: 11, lineHeight: '16px' }}>ลงย้อนหลัง</Tag>
              </Tooltip>
            )}
          </Space>
        </Flex>
      ),
    },
    {
      title: 'ความคืบหน้า',
      key: 'progress',
      width: 150,
      render: (_, row) => (
        <Tooltip title={`บันทึกผลประเมินแล้ว ${row.answered} จาก ${row.total_items} รายการ`}>
          <Progress
            percent={row.total_items ? Math.round((row.answered / row.total_items) * 100) : 0}
            size="small"
            strokeColor={BRAND}
          />
        </Tooltip>
      ),
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      width: 170,
      render: (v: string, row) => (
        <Space size={4} wrap>
          <Tag color={STATUS_TAG[v]?.color}>{STATUS_TAG[v]?.label ?? v}</Tag>
          {(row.revision_no ?? 0) > 0 && <Tag>แก้ไข {row.revision_no} ครั้ง</Tag>}
        </Space>
      ),
    },
    { title: 'ผู้บันทึก', dataIndex: 'nurse_name', width: 170, render: (v: string) => v || '-' },
    {
      title: '',
      key: 'action',
      width: 120,
      render: (_, row) => (
        <Space size={4}>
          <Button size="small" type="primary" ghost icon={<PiFolderOpenBold />} onClick={() => setOpenId(row.id)}>
            เปิด
          </Button>
          <Tooltip title="ยกเลิกใบนี้">
            <Button
              size="small"
              danger
              type="text"
              icon={<PiTrashBold />}
              disabled={row.status === 'cancelled'}
              onClick={() => requestRemove(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const publishedTemplates = templates.filter(t => t.status === 'published');
  const chosen = publishedTemplates.find(t => t.id === pickTemplate) ?? null;

  // ย้อนหลังเท่าไร ใช้ตัดสินว่าต้องขอเหตุผลไหม — ตัวเลขเดียวกับที่เซิร์ฟเวอร์บังคับ
  const backdatedHours = dayjs().diff(pickAt, 'hour', true);
  const backdatedLabel = backdatedHours >= 24
    ? `${Math.floor(backdatedHours / 24)} วัน ${Math.round(backdatedHours % 24)} ชั่วโมง`
    : `${Math.round(backdatedHours)} ชั่วโมง`;
  const needLateReason = backdatedHours > LATE_HOURS;
  const lateReasonMissing = needLateReason && pickLateReason.trim().length < 5;

  return (
    <>
      <Card
        size="small"
        variant="borderless"
        style={{ background: `linear-gradient(90deg, ${BRAND}, #00897b)`, marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Flex align="center" justify="space-between" gap={16} wrap>
          <Space size={12} align="center">
            <Avatar size={40} shape="square" style={{ background: 'rgba(255,255,255,.2)' }} icon={<PiListChecksBold />} />
            <div>
              <Title level={5} style={{ color: '#fff', margin: 0 }}>
                แผนการพยาบาล (Focus list)
              </Title>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{patient?.ptname ?? '-'}</Text>
            </div>
          </Space>
          <Space size={8} wrap>
            <Tag style={{ margin: 0, background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff' }}>
              ร่าง {drafts.length}
            </Tag>
            <Tag style={{ margin: 0, background: 'rgba(255,255,255,.12)', border: 'none', color: 'rgba(255,255,255,.85)' }}>
              เข้าเวชระเบียนแล้ว {finals.length}
            </Tag>
            {cancelled.length > 0 && (
              <Tag style={{ margin: 0, background: 'rgba(255,255,255,.12)', border: 'none', color: 'rgba(255,255,255,.85)' }}>
                ยกเลิก {cancelled.length}
              </Tag>
            )}
          </Space>
        </Flex>

        <Divider style={{ margin: '10px 0', borderColor: 'rgba(255,255,255,.25)' }} />

        <Descriptions
          size="small"
          column={{ xs: 1, sm: 2, md: 3, lg: 6 }}
          items={headerItems}
          styles={{
            label: { color: 'rgba(255,255,255,.65)', fontSize: 12 },
            content: { color: '#fff', fontSize: 12, fontWeight: 500 },
          }}
        />
      </Card>

      {loading ? (
        <Card><Skeleton active paragraph={{ rows: 8 }} /></Card>
      ) : (
        <Flex vertical gap={16}>
          {loadError && (
            <Alert
              type="error"
              showIcon
              title={loadError}
              description="หน้านี้ไม่แสดงข้อมูลตัวอย่างแทนข้อมูลจริง สิ่งที่เห็นคือใบที่บันทึกไว้จริงเท่านั้น"
              action={<Button size="small" onClick={fetchRecords}>ลองใหม่</Button>}
            />
          )}

          {/* ---------- หน้ารายการ ---------- */}
          {!openRecord && (
            <Card
              size="small"
              // ธีมของหน้านี้ตั้ง headerHeight ไว้ 40 ซึ่งพอดีกับหัวข้อเปล่าๆ
              // แต่หัวนี้มีปุ่มขนาดปกติสูง 32 อยู่ด้วย เลยดูอึดอัด ปล่อยให้สูงตามเนื้อหาแทน
              styles={{ header: { height: 'auto', minHeight: 52, paddingBlock: 10 } }}
              title={<Text strong>ใบบันทึกของผู้ป่วยรายนี้</Text>}
              extra={
                <Space size={8} wrap>
                  {records.length > 0 && (
                    <Segmented
                      size="small"
                      value={listView}
                      onChange={v => setListView(v as ListView)}
                      // ประกอบไอคอนกับข้อความเองแทนการใช้ prop icon
                      // เพราะ antd วางทั้งสองเป็น <span> ธรรมดาคู่กัน พอหัวการ์ดแคบจะตัดบรรทัดคั่นกลาง
                      options={[
                        { value: 'table', label: <SegLabel icon={<PiTableBold />} text="ตาราง" /> },
                        { value: 'timeline', label: <SegLabel icon={<PiClockCounterClockwiseBold />} text="ไทม์ไลน์" /> },
                      ]}
                    />
                  )}
                  <Button type="primary" icon={<PiPlusBold />} onClick={openPicker}>
                    เปิดใบใหม่
                  </Button>
                </Space>
              }
            >
              {records.length === 0 ? (
                <Empty
                  description="ยังไม่มีใบบันทึก กด “เปิดใบใหม่” แล้วเลือก Focus จากแม่แบบของหอผู้ป่วย"
                  style={{ padding: '24px 0' }}
                />
              ) : listView === 'table' ? (
                <Table
                  rowKey="id"
                  size="small"
                  columns={columns}
                  dataSource={records}
                  pagination={false}
                  scroll={{ x: 960 }}
                  // ใบที่ยกเลิกยังอยู่ในรายการแต่ต้องดูจางกว่า จะได้ไม่สับสนกับใบที่ใช้งานจริง
                  onRow={row => (row.status === 'cancelled' ? { style: { opacity: 0.55 } } : {})}
                />
              ) : (
                <RecordTimeline
                  records={records}
                  onOpen={setOpenId}
                  onRemove={requestRemove}
                />
              )}
            </Card>
          )}

          {/* ---------- ใบที่เปิดอยู่ ---------- */}
          {openRecord && (
            <>
              <Card size="small">
                <Flex justify="space-between" align="flex-start" gap={16} wrap>
                  <Flex vertical gap={4}>
                    <Space size={8} wrap>
                      <Text strong style={{ fontSize: 15, color: BRAND }}>{openRecord.template_title}</Text>
                      <Tag color={STATUS_TAG[openRecord.status]?.color}>
                        {STATUS_TAG[openRecord.status]?.label}
                      </Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {openRecord.template_code} · แม่แบบรุ่นที่ {openRecord.template_version} ·
                      {' '}บันทึก {dayjs(openRecord.record_datetime).format('DD/MM/YYYY HH:mm')}
                      {openRecord.completed_at
                        ? ` · ปิดใบ ${dayjs(openRecord.completed_at).format('DD/MM/YYYY HH:mm')}`
                        : ''}
                    </Text>
                    <Space size={6} align="start">
                      <PiUserBold color="#8c8c8c" style={{ marginTop: 3 }} />
                      <Flex vertical gap={1}>
                        {/* ผู้สร้างมาจากบัญชีที่เปิดใบ ผู้แก้ไขคือคนล่าสุดที่กดบันทึก
                            แยกสองบรรทัดเพราะเป็นคนละคนได้ และการตรวจสอบต้องเห็นทั้งคู่ */}
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          สร้างโดย{' '}
                          {[openRecord.nurse_name || profile?.name, openRecord.nurse_major]
                            .filter(v => String(v ?? '').trim())
                            .join(' · ') || '-'}
                          {openRecord.created_at
                            ? ` — ${dayjs(openRecord.created_at).format('DD/MM/YYYY HH:mm')}`
                            : ''}
                        </Text>
                        {openRecord.updated_at && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            ปรับปรุงล่าสุดโดย {openRecord.updated_by_name || '-'}
                            {' '}— {dayjs(openRecord.updated_at).format('DD/MM/YYYY HH:mm')}
                          </Text>
                        )}
                      </Flex>
                    </Space>
                  </Flex>

                  <Space size={8} wrap>
                    {/* ทางกลับไปหน้ารายการ วางรวมกับปุ่มอื่นของใบ
                        เป็นการปิดใบที่เปิดอยู่ ไม่ใช่การออกจากหน้า */}
                    <Button icon={<PiArrowLeftBold />} onClick={() => setOpenId(null)}>
                      รายการใบบันทึก
                    </Button>
                    <Button
                      type="primary"
                      icon={<VscSave />}
                      loading={saving}
                      disabled={!dirty || isCancelled}
                      onClick={requestSave}
                    >
                      บันทึก
                    </Button>
                    {openRecord.status === 'draft' && (
                      <Popconfirm
                        title="ปิดใบเข้าเวชระเบียน?"
                        description="หลังปิดแล้ว การแก้ไขทุกครั้งต้องระบุเหตุผลและระบบจะเก็บฉบับเดิมไว้"
                        onConfirm={completeRecord}
                        okText="ปิดใบ"
                        cancelText="ยังก่อน"
                      >
                        <Button icon={<PiSealCheckBold />} loading={saving}>ปิดใบ</Button>
                      </Popconfirm>
                    )}
                  </Space>
                </Flex>

                {isCancelled && (
                  <Alert
                    style={{ marginTop: 12 }}
                    type="error"
                    showIcon
                    icon={<PiProhibitBold />}
                    title={`ใบนี้ถูกยกเลิกเมื่อ ${
                      openRecord.cancelled_at
                        ? dayjs(openRecord.cancelled_at).format('DD/MM/YYYY HH:mm')
                        : '-'
                    } โดย ${openRecord.cancelled_by_name || '-'}`}
                    description={
                      <>
                        {openRecord.cancel_reason ? `เหตุผล: ${openRecord.cancel_reason}` : 'ไม่ได้ระบุเหตุผล'}
                        <br />
                        ใบยังแสดงในประวัติเพื่อให้ตรวจสอบย้อนหลังได้ แต่แก้ไขต่อไม่ได้และไม่ถูกนับเป็นตัวชี้วัด
                        หากต้องบันทึกใหม่ให้เปิดใบใหม่แทน
                      </>
                    }
                  />
                )}
                {openRecord.is_late_entry && (
                  <Alert
                    style={{ marginTop: 12 }}
                    type="warning"
                    showIcon
                    title={`ใบนี้ลงข้อมูลย้อนหลัง — พิมพ์เมื่อ ${
                      openRecord.entered_at
                        ? dayjs(openRecord.entered_at).format('DD/MM/YYYY HH:mm')
                        : '-'
                    }`}
                    description={
                      openRecord.late_entry_reason
                        ? `เหตุผล: ${openRecord.late_entry_reason}`
                        : 'วันเวลาที่แสดงด้านบนคือเวลาที่เหตุการณ์เกิดจริง ไม่ใช่เวลาที่บันทึก'
                    }
                  />
                )}
                {openRecord.status === 'final' && (
                  <Alert
                    style={{ marginTop: 12 }}
                    type="success"
                    showIcon
                    icon={<PiCheckCircleBold />}
                    title="ใบนี้เข้าเวชระเบียนแล้ว"
                    description="ยังแก้ไขได้ แต่ต้องระบุเหตุผลทุกครั้ง และระบบจะเก็บฉบับก่อนแก้ไว้เป็นประวัติ"
                  />
                )}
                {dirty && (
                  <Alert
                    style={{ marginTop: 12 }}
                    type="warning"
                    showIcon
                    title="มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก"
                  />
                )}
              </Card>

              {(openRecord.structure?.sections ?? []).map(section => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  answers={answers}
                  disabled={saving || isCancelled}
                  onAnswer={setAnswer}
                />
              ))}
            </>
          )}
        </Flex>
      )}

      {/* ---------- ขอเหตุผลก่อนแก้หรือยกเลิกใบที่เข้าเวชระเบียนแล้ว ---------- */}
      <Modal
        open={Boolean(prompt)}
        title={prompt?.title}
        width={520}
        okText={prompt?.okText}
        cancelText={prompt?.cancelText ?? 'ยกเลิก'}
        okButtonProps={{
          danger: prompt?.danger,
          // ปุ่มปิดไว้จนกว่าเหตุผลจะยาวพอ จึงไม่ต้องตรวจแล้ว reject ตอนกด
          disabled: promptReason.trim().length < MIN_REASON,
          loading: promptBusy,
        }}
        cancelButtonProps={{ disabled: promptBusy }}
        onCancel={() => { if (!promptBusy) setPrompt(null); }}
        onOk={async () => {
          if (!prompt) return;
          setPromptBusy(true);
          try {
            await prompt.onSubmit(promptReason.trim());
            setPrompt(null);
          } finally {
            setPromptBusy(false);
          }
        }}
        // ล้างข้อความเก่าหลังกล่องปิดสนิท ไม่งั้นเปิดครั้งถัดไปจะเห็นเหตุผลของครั้งก่อน
        afterOpenChange={open => { if (!open) setPromptReason(''); }}
        destroyOnHidden
      >
        <Flex vertical gap={10} style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>{prompt?.description}</Text>
          <Input.TextArea
            rows={3}
            autoFocus
            placeholder={prompt?.placeholder}
            value={promptReason}
            disabled={promptBusy}
            onChange={e => setPromptReason(e.target.value)}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            ต้องยาวอย่างน้อย {MIN_REASON} ตัวอักษร (ตอนนี้ {promptReason.trim().length})
          </Text>
        </Flex>
      </Modal>

      {/* ---------- เลือกแม่แบบ ---------- */}
      <Modal
        open={pickOpen}
        title="เปิดใบบันทึกใหม่"
        onCancel={() => setPickOpen(false)}
        onOk={createRecord}
        okText="เปิดใบ"
        cancelText="ยกเลิก"
        okButtonProps={{ disabled: !pickTemplate || lateReasonMissing, loading: saving }}
        width={640}
      >
        <Flex vertical gap={12} style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            เลือก Focus จากแม่แบบที่หอผู้ป่วยเขียนไว้ กิจกรรมการพยาบาลจะมาสำเร็จรูป
            สิ่งที่ต้องกรอกคือคอลัมน์ประเมินผล
          </Text>

          {/* วันเวลาที่เหตุการณ์เกิดจริง แยกจากเวลาที่นั่งพิมพ์ซึ่งระบบเก็บเองอัตโนมัติ */}
          <Flex vertical gap={4}>
            <Text style={{ fontSize: 13 }}>วันเวลาที่บันทึก</Text>
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="DD/MM/YYYY HH:mm"
              value={pickAt}
              onChange={d => setPickAt(d ?? dayjs())}
              allowClear={false}
              // เลือกเวลาอนาคตไม่ได้ เพราะเหตุการณ์ที่ยังไม่เกิดบันทึกไม่ได้
              disabledDate={d => d.isAfter(dayjs(), 'day')}
              style={{ width: '100%' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              เวลาที่เหตุการณ์เกิดจริง ย้อนหลังได้ · ระบบเก็บเวลาที่กดบันทึกไว้แยกต่างหากเสมอ
            </Text>
          </Flex>

          {backdatedHours > LATE_HOURS && (
            <Flex vertical gap={4}>
              <Alert
                type="warning"
                showIcon
                title={`บันทึกย้อนหลัง ${backdatedLabel}`}
                description="ย้อนหลังเกิน 24 ชั่วโมงต้องระบุเหตุผล เพื่อให้ผู้ตรวจสอบเวชระเบียนทราบว่าทำไมข้อมูลจึงมาลงทีหลัง"
              />
              <Input.TextArea
                rows={2}
                placeholder="เหตุผลที่บันทึกย้อนหลัง เช่น ระบบขัดข้องขณะปฏิบัติงาน"
                value={pickLateReason}
                onChange={e => setPickLateReason(e.target.value)}
                status={pickLateReason.trim().length < 5 ? 'warning' : undefined}
              />
            </Flex>
          )}

          {publishedTemplates.length === 0 ? (
            <Alert
              type="warning"
              showIcon
              title="ยังไม่มีแม่แบบที่เผยแพร่"
              description="ผู้ดูแลระบบต้องสร้างและเผยแพร่แม่แบบก่อน จึงจะเปิดใบบันทึกได้"
            />
          ) : (
            <>
              <Select
                showSearch
                placeholder="ค้นหา Focus"
                style={{ width: '100%' }}
                value={pickTemplate}
                onChange={setPickTemplate}
                optionFilterProp="label"
                options={publishedTemplates.map(t => ({
                  value: t.id,
                  label: `${t.title} — ${t.owner_ward_name ?? t.owner_ward_code}`,
                }))}
              />

              {chosen && (
                <Card size="small" style={{ background: 'var(--surface-muted)' }}>
                  <Descriptions
                    size="small"
                    column={1}
                    items={[
                      { key: 'c', label: 'รหัส', children: `${chosen.code} · รุ่นที่ ${chosen.version}` },
                      { key: 'w', label: 'หอผู้ป่วยเจ้าของ', children: chosen.owner_ward_name ?? chosen.owner_ward_code },
                      { key: 'o', label: 'วัตถุประสงค์', children: chosen.objective || '-' },
                      { key: 's', label: 'จำนวนระยะ', children: `${chosen.section_count ?? '-'} ระยะ` },
                    ]}
                    styles={{ label: { width: 140, fontSize: 12 }, content: { fontSize: 12 } }}
                  />
                  {String(chosen.owner_ward_code) !== String(patient?.ward ?? '') && (
                    <Alert
                      style={{ marginTop: 10 }}
                      type="info"
                      showIcon
                      icon={<PiInfoBold />}
                      title="แม่แบบนี้เป็นของหอผู้ป่วยอื่น"
                      description="ใช้ได้ตามปกติ แต่ควรตรวจว่าเนื้อหาตรงกับแนวทางของหอที่ดูแลผู้ป่วยรายนี้"
                    />
                  )}
                </Card>
              )}
            </>
          )}
        </Flex>
      </Modal>
    </>
  );
}

export default function NursingCarePlan({ an }: { an: string }) {
  return (
    // ธีมและ <App> มาจาก ThemeProvider ที่ layout ระดับราก
    // ถ้าประกาศ ConfigProvider ซ้ำตรงนี้ หน้าจะถูกล็อกไว้ที่โหมดสว่างเสมอ
    <div style={{ background: 'var(--app-bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
            <FocusInner an={an} />
      </div>
    </div>
  );
}
