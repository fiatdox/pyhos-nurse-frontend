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
  Drawer,
  Empty,
  Flex,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Segmented,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../components/Navbar';
import {
  PiListChecksBold,
  PiPlusBold,
  PiTrashBold,
  PiPencilSimpleBold,
  PiUploadSimpleBold,
  PiArchiveBold,
  PiClockCounterClockwiseBold,
  PiArrowUpBold,
  PiArrowDownBold,
} from 'react-icons/pi';
import { VscSave } from 'react-icons/vsc';

const { Text, Title, Paragraph } = Typography;

const BRAND = '#006b5f';

/**
 * หน้าจัดการแม่แบบแผนการพยาบาลแบบ Focus list — เฉพาะผู้ดูแลระบบ
 *
 * แม่แบบคือเนื้อหาวิชาการที่ทั้งโรงพยาบาลใช้ร่วมกัน การแก้จึงมีผลย้อนไปถึงทุกหอ
 * ที่หยิบไปใช้ หน้าจอนี้เลยแยกฉบับร่างกับฉบับเผยแพร่ออกจากกันชัดเจน
 * และไม่ให้แก้รหัสรายการประเมินที่สร้างไปแล้ว เพราะเป็นคีย์ที่บันทึกเก่าอ้างถึง
 */

// ---------------- ชนิดข้อมูล ----------------

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

interface Template {
  id: number;
  code: string;
  title: string;
  objective?: string | null;
  owner_ward_code: string;
  owner_ward_name?: string | null;
  body?: { sections: Section[] };
  version: number;
  status: 'draft' | 'published' | 'retired';
  section_count?: number;
  updated_at?: string | null;
  updated_by?: string | null;
  updated_by_name?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
}

interface Ward {
  ward: string;
  ward_name: string;
}

interface Revision {
  id: number;
  version: number;
  action: string;
  reason?: string | null;
  changed_by?: string | null;
  changed_by_name?: string | null;
  changed_at: string;
}

const STATUS: Record<string, { label: string; color: string; hint: string }> = {
  draft: { label: 'ฉบับร่าง', color: 'orange', hint: 'ยังไม่ขึ้นให้พยาบาลเลือกใช้' },
  published: { label: 'เผยแพร่แล้ว', color: 'green', hint: 'ทุกหอผู้ป่วยเลือกใช้ได้' },
  retired: { label: 'เลิกใช้', color: 'default', hint: 'เปิดใบใหม่ไม่ได้ แต่ใบเก่ายังอ่านได้' },
};

const KIND_LABEL: Record<EvalKind, string> = {
  check: 'ติ๊ก',
  choice: 'เลือกตัวเลือก',
  number: 'ตัวเลข',
  text: 'ข้อความ',
  time: 'เวลา',
};

const ACTION_LABEL: Record<string, string> = {
  create: 'สร้าง',
  update: 'แก้ไขเนื้อหา',
  publish: 'เผยแพร่',
  retire: 'เลิกใช้',
  unpublish: 'เปลี่ยนกลับเป็นร่าง',
  delete: 'ลบ',
};

/**
 * id ของตารางเป็น bigint ซึ่งฝั่งเซิร์ฟเวอร์คืนมาเป็นข้อความ ("1" ไม่ใช่ 1)
 * แปลงตั้งแต่ตอนรับเข้า ไม่งั้นการเทียบ id และการส่งค่ากลับจะเพี้ยนแบบเงียบๆ
 */
const toNum = (v: unknown) => Number(v ?? 0);

/** รหัสที่ผ่านกติกาของเซิร์ฟเวอร์ (A-Z a-z 0-9 _ -) และไม่ซ้ำกันในใบเดียว */
const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

// ---------------- ตัวแก้รายการประเมินหนึ่งรายการ ----------------

function EvalEditor({
  item, onChange, onRemove, onMove,
}: {
  item: EvalItem;
  onChange: (next: EvalItem) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  return (
    <Card size="small" style={{ background: 'var(--surface-muted)' }}>
      <Flex vertical gap={8}>
        <Flex gap={8} wrap align="center">
          <Select
            size="small"
            value={item.kind}
            style={{ width: 140 }}
            onChange={(kind: EvalKind) => {
              // เปลี่ยนชนิดแล้วล้างค่าที่ใช้ได้เฉพาะชนิดเดิม ไม่งั้นจะเหลือ options ค้างใน number
              const next: EvalItem = { id: item.id, kind, label: item.label };
              if (kind === 'choice') { next.options = ['ใช่', 'ไม่ใช่']; next.allow_other = false; }
              if (kind === 'number') { next.unit = null; next.min = null; next.max = null; }
              onChange(next);
            }}
            options={(Object.keys(KIND_LABEL) as EvalKind[]).map(k => ({ value: k, label: KIND_LABEL[k] }))}
          />
          <Input
            size="small"
            placeholder="ข้อความที่แสดงในคอลัมน์ประเมินผล"
            value={item.label}
            onChange={e => onChange({ ...item, label: e.target.value })}
            style={{ flex: 1, minWidth: 220 }}
          />
          <Space size={2}>
            <Tooltip title="เลื่อนขึ้น">
              <Button size="small" type="text" icon={<PiArrowUpBold />} onClick={() => onMove(-1)} />
            </Tooltip>
            <Tooltip title="เลื่อนลง">
              <Button size="small" type="text" icon={<PiArrowDownBold />} onClick={() => onMove(1)} />
            </Tooltip>
            <Tooltip title="ลบรายการนี้">
              <Button size="small" type="text" danger icon={<PiTrashBold />} onClick={onRemove} />
            </Tooltip>
          </Space>
        </Flex>

        {item.kind === 'number' && (
          <Flex gap={12} wrap align="center">
            <Flex gap={6} align="center">
              <Text type="secondary" style={{ fontSize: 12 }}>หน่วย</Text>
              <Input
                size="small"
                placeholder="เช่น % / ครั้งต่อนาที"
                value={item.unit ?? ''}
                onChange={e => onChange({ ...item, unit: e.target.value || null })}
                style={{ width: 170 }}
              />
            </Flex>
            <Flex gap={6} align="center">
              <Text type="secondary" style={{ fontSize: 12 }}>ต่ำสุด</Text>
              <InputNumber
                size="small"
                value={item.min ?? null}
                onChange={v => onChange({ ...item, min: v === null ? null : Number(v) })}
                style={{ width: 90 }}
              />
            </Flex>
            <Flex gap={6} align="center">
              <Text type="secondary" style={{ fontSize: 12 }}>สูงสุด</Text>
              <InputNumber
                size="small"
                value={item.max ?? null}
                onChange={v => onChange({ ...item, max: v === null ? null : Number(v) })}
                style={{ width: 90 }}
              />
            </Flex>
          </Flex>
        )}

        {item.kind === 'choice' && (
          <Flex vertical gap={6}>
            <Select
              size="small"
              mode="tags"
              placeholder="พิมพ์ตัวเลือกแล้วกด Enter"
              value={item.options ?? []}
              onChange={(options: string[]) => onChange({ ...item, options })}
              style={{ width: '100%' }}
              tokenSeparators={[',']}
            />
            <Checkbox
              checked={item.allow_other === true}
              onChange={e => onChange({ ...item, allow_other: e.target.checked })}
            >
              <span style={{ fontSize: 13 }}>ให้พิมพ์คำตอบเองได้ (ช่อง “…(ระบุ)”)</span>
            </Checkbox>
          </Flex>
        )}

        <Text type="secondary" style={{ fontSize: 11 }}>
          รหัส {item.id} — ใช้อ้างอิงในบันทึกและรายงานตัวชี้วัด แก้ไม่ได้
        </Text>
      </Flex>
    </Card>
  );
}

// ---------------- ตัวแก้ระยะหนึ่งระยะ ----------------

function SectionEditor({
  section, index, total, onChange, onRemove, onMove,
}: {
  section: Section;
  index: number;
  total: number;
  onChange: (next: Section) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
}) {
  const setActivity = (i: number, text: string) => {
    const activities = [...section.activities];
    activities[i] = text;
    onChange({ ...section, activities });
  };

  const moveEval = (i: number, delta: number) => {
    const to = i + delta;
    if (to < 0 || to >= section.evaluations.length) return;
    const evaluations = [...section.evaluations];
    const [moved] = evaluations.splice(i, 1);
    evaluations.splice(to, 0, moved!);
    onChange({ ...section, evaluations });
  };

  return (
    <Card
      size="small"
      style={{ borderLeft: `4px solid ${BRAND}` }}
      styles={{ header: { background: `${BRAND}14` } }}
      title={
        <Input
          size="small"
          placeholder="ชื่อระยะ เช่น ระยะเตรียมถอดท่อช่วยหายใจ"
          value={section.title}
          onChange={e => onChange({ ...section, title: e.target.value })}
          style={{ maxWidth: 420, fontWeight: 600 }}
        />
      }
      extra={
        <Space size={2}>
          <Text type="secondary" style={{ fontSize: 11, marginRight: 6 }}>
            ระยะที่ {index + 1}/{total}
          </Text>
          <Button size="small" type="text" icon={<PiArrowUpBold />} onClick={() => onMove(-1)} />
          <Button size="small" type="text" icon={<PiArrowDownBold />} onClick={() => onMove(1)} />
          <Popconfirm title="ลบระยะนี้ทั้งหมด?" onConfirm={onRemove} okText="ลบ" cancelText="ไม่">
            <Button size="small" type="text" danger icon={<PiTrashBold />} />
          </Popconfirm>
        </Space>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>กิจกรรมการพยาบาล</Text>
            <Button
              size="small"
              type="link"
              icon={<PiPlusBold />}
              onClick={() => onChange({ ...section, activities: [...section.activities, ''] })}
            >
              เพิ่มข้อ
            </Button>
          </Flex>
          {section.activities.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>ยังไม่มีกิจกรรม</Text>
          ) : (
            <Flex vertical gap={6}>
              {section.activities.map((a, i) => (
                <Flex key={i} gap={6} align="flex-start">
                  <Text type="secondary" style={{ fontSize: 12, paddingTop: 5, minWidth: 18 }}>{i + 1}.</Text>
                  <Input.TextArea
                    size="small"
                    autoSize={{ minRows: 1, maxRows: 6 }}
                    value={a}
                    onChange={e => setActivity(i, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<PiTrashBold />}
                    onClick={() => onChange({
                      ...section,
                      activities: section.activities.filter((_, j) => j !== i),
                    })}
                  />
                </Flex>
              ))}
            </Flex>
          )}
        </Col>

        <Col xs={24} lg={12} style={{ borderLeft: '1px solid #f0f0f0' }}>
          <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>รายการประเมินผล</Text>
            <Button
              size="small"
              type="link"
              icon={<PiPlusBold />}
              onClick={() => onChange({
                ...section,
                evaluations: [
                  ...section.evaluations,
                  { id: newId('e'), kind: 'check', label: '' },
                ],
              })}
            >
              เพิ่มรายการ
            </Button>
          </Flex>
          {section.evaluations.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>ยังไม่มีรายการประเมินผล</Text>
          ) : (
            <Flex vertical gap={8}>
              {section.evaluations.map((item, i) => (
                <EvalEditor
                  key={item.id}
                  item={item}
                  onChange={next => {
                    const evaluations = [...section.evaluations];
                    evaluations[i] = next;
                    onChange({ ...section, evaluations });
                  }}
                  onRemove={() => onChange({
                    ...section,
                    evaluations: section.evaluations.filter((_, j) => j !== i),
                  })}
                  onMove={delta => moveEval(i, delta)}
                />
              ))}
            </Flex>
          )}
        </Col>
      </Row>
    </Card>
  );
}

// ---------------- หน้าจอ ----------------

function TemplatesInner() {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [canManage, setCanManage] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // แม่แบบที่กำลังแก้ — id = 0 คือสร้างใหม่
  const [editing, setEditing] = useState<Template | null>(null);
  const [sections, setSections] = useState<Section[]>([]);

  const [revOf, setRevOf] = useState<Template | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await axios.get('/api/v1/care-plan-templates?status=all', { headers: getHeaders() });
      if (res.data?.success) {
        setTemplates((res.data.data ?? []).map((t: Template) => ({ ...t, id: toNum(t.id) })));
        setCanManage(res.data.can_manage === true);
        setLoadError(null);
      } else {
        setLoadError(res.data?.message || 'โหลดรายการแม่แบบไม่สำเร็จ');
      }
    } catch (error: any) {
      if (error?.response?.status === 403) {
        setCanManage(false);
        setLoadError(null);
      } else {
        setLoadError(error?.response?.data?.message || 'โหลดรายการแม่แบบไม่สำเร็จ');
      }
    }
  }, [getHeaders]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/v1/system/wardsV1', { headers: getHeaders() });
        if (res.data?.success) setWards(res.data.data ?? []);
      } catch {
        // ไม่มีรายชื่อหอก็ยังแก้เนื้อหาได้ แค่เลือกเจ้าของจาก dropdown ไม่ได้
      }
      await fetchTemplates();
      setLoading(false);
    })();
  }, [getHeaders, fetchTemplates]);

  // ---------------- เปิดตัวแก้ ----------------

  const startCreate = () => {
    setEditing({
      id: 0, code: '', title: '', objective: '',
      owner_ward_code: '', version: 1, status: 'draft',
    });
    setSections([{ id: newId('s'), title: '', activities: [''], evaluations: [] }]);
  };

  const startEdit = async (row: Template) => {
    try {
      const res = await axios.get(`/api/v1/care-plan-templates/${row.id}`, { headers: getHeaders() });
      if (!res.data?.success) { message.error(res.data?.message || 'เปิดแม่แบบไม่สำเร็จ'); return; }
      const full = { ...(res.data.data as Template), id: toNum(res.data.data.id) };
      setEditing(full);
      setSections(full.body?.sections ?? []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'เปิดแม่แบบไม่สำเร็จ');
    }
  };

  const saveTemplate = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        code: editing.code,
        title: editing.title,
        objective: editing.objective ?? '',
        owner_ward_code: editing.owner_ward_code,
        body: { sections },
      };
      const res = editing.id
        ? await axios.put(`/api/v1/care-plan-templates/${editing.id}`, payload, { headers: getHeaders() })
        : await axios.post('/api/v1/care-plan-templates', payload, { headers: getHeaders() });

      if (res.data?.success) {
        message.success(res.data.message);
        setEditing(null);
        await fetchTemplates();
      } else {
        message.error(res.data?.message || 'บันทึกไม่สำเร็จ');
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (row: Template, status: string) => {
    try {
      const res = await axios.put(
        `/api/v1/care-plan-templates/status/${row.id}`,
        { status },
        { headers: getHeaders() }
      );
      if (res.data?.success) { message.success(res.data.message); await fetchTemplates(); }
      else message.error(res.data?.message || 'เปลี่ยนสถานะไม่สำเร็จ');
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'เปลี่ยนสถานะไม่สำเร็จ');
    }
  };

  const removeTemplate = async (row: Template) => {
    try {
      const res = await axios.delete(`/api/v1/care-plan-templates/${row.id}`, { headers: getHeaders() });
      if (res.data?.success) { message.success(res.data.message); await fetchTemplates(); }
      else message.error(res.data?.message || 'ลบไม่สำเร็จ');
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'ลบไม่สำเร็จ');
    }
  };

  const showRevisions = async (row: Template) => {
    setRevOf(row);
    setRevisions([]);
    try {
      const res = await axios.get(`/api/v1/care-plan-templates/revisions/${row.id}`, { headers: getHeaders() });
      if (res.data?.success) setRevisions(res.data.data ?? []);
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'โหลดประวัติไม่สำเร็จ');
    }
  };

  // ---------------- ตาราง ----------------

  const shown = useMemo(
    () => (filter === 'all' ? templates : templates.filter(t => t.status === filter)),
    [templates, filter]
  );

  const columns: ColumnsType<Template> = [
    {
      title: 'Focus',
      dataIndex: 'title',
      render: (title: string, row) => (
        <Flex vertical gap={2}>
          <Text strong style={{ fontSize: 13 }}>{title}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {row.code} · รุ่นที่ {row.version} · {row.section_count ?? '-'} ระยะ
          </Text>
        </Flex>
      ),
    },
    {
      title: 'หอผู้ป่วยเจ้าของ',
      dataIndex: 'owner_ward_name',
      width: 180,
      render: (v: string, row) => v || row.owner_ward_code,
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      width: 150,
      render: (v: string) => (
        <Tooltip title={STATUS[v]?.hint}>
          <Tag color={STATUS[v]?.color}>{STATUS[v]?.label ?? v}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'แก้ไขล่าสุด',
      dataIndex: 'updated_at',
      width: 175,
      render: (v: string | null, row) => (
        <Flex vertical gap={2}>
          <Text style={{ fontSize: 12 }}>
            {v ? dayjs(v).format('DD/MM/YYYY HH:mm') : dayjs(row.created_at).format('DD/MM/YYYY HH:mm')}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            โดย {row.updated_by_name || row.created_by_name || '-'}
          </Text>
        </Flex>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 230,
      render: (_, row) => (
        <Space size={2} wrap>
          <Tooltip title="แก้ไขเนื้อหา">
            <Button size="small" type="text" icon={<PiPencilSimpleBold />} onClick={() => startEdit(row)} />
          </Tooltip>
          {row.status !== 'published' && (
            <Tooltip title="เผยแพร่ให้หอผู้ป่วยใช้งาน">
              <Button size="small" type="text" icon={<PiUploadSimpleBold />} onClick={() => setStatus(row, 'published')} />
            </Tooltip>
          )}
          {row.status === 'published' && (
            <Popconfirm
              title="เลิกใช้แม่แบบนี้?"
              description="เปิดใบใหม่ไม่ได้ แต่ใบที่บันทึกไปแล้วยังอ่านและแก้ได้ตามปกติ"
              onConfirm={() => setStatus(row, 'retired')}
              okText="เลิกใช้"
              cancelText="ไม่"
            >
              <Tooltip title="เลิกใช้"><Button size="small" type="text" icon={<PiArchiveBold />} /></Tooltip>
            </Popconfirm>
          )}
          <Tooltip title="ประวัติการแก้ไข">
            <Button size="small" type="text" icon={<PiClockCounterClockwiseBold />} onClick={() => showRevisions(row)} />
          </Tooltip>
          <Popconfirm
            title="ลบแม่แบบนี้?"
            description="แม่แบบที่ถูกใช้บันทึกไปแล้วจะลบไม่ได้"
            onConfirm={() => removeTemplate(row)}
            okText="ลบ"
            cancelText="ไม่"
          >
            <Button size="small" type="text" danger icon={<PiTrashBold />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // สรุปให้เห็นก่อนบันทึกว่าแม่แบบนี้ใหญ่แค่ไหน
  const totals = sections.reduce(
    (acc, s) => ({
      activities: acc.activities + s.activities.filter(a => a.trim()).length,
      evaluations: acc.evaluations + s.evaluations.length,
    }),
    { activities: 0, evaluations: 0 }
  );

  if (canManage === false) {
    return (
      <Alert
        type="error"
        showIcon
        title="เฉพาะผู้ดูแลระบบเท่านั้น"
        description="หน้านี้ใช้จัดการเนื้อหาที่ทุกหอผู้ป่วยใช้ร่วมกัน จึงจำกัดสิทธิ์ไว้ที่ผู้ดูแลระบบ"
      />
    );
  }

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
              <Title level={5} style={{ color: '#fff', margin: 0 }}>แม่แบบแผนการพยาบาล (Focus list)</Title>
              <Text style={{ color: 'rgba(255,255,255,.85)', fontSize: 12 }}>
                เนื้อหาที่พยาบาลหยิบไปใช้ตอนบันทึก — แก้ที่นี่มีผลกับทุกหอผู้ป่วย
              </Text>
            </div>
          </Space>
          {/* พื้นหลังการ์ดเป็นเขียวแบรนด์ ปุ่มจึงต้องเป็นสีขาวทึบ
              ถ้าใช้ type="primary" ghost จะได้ตัวหนังสือเขียวบนพื้นเขียว อ่านแทบไม่ออก */}
          <Button
            icon={<PiPlusBold />}
            onClick={startCreate}
            style={{ background: '#fff', color: BRAND, borderColor: '#fff', fontWeight: 600 }}
          >
            สร้างแม่แบบ
          </Button>
        </Flex>
      </Card>

      {loading ? (
        <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
      ) : (
        <Flex vertical gap={16}>
          {loadError && (
            <Alert
              type="error"
              showIcon
              title={loadError}
              action={<Button size="small" onClick={fetchTemplates}>ลองใหม่</Button>}
            />
          )}

          <Card size="small">
            <Flex justify="space-between" align="center" gap={12} wrap style={{ marginBottom: 12 }}>
              <Segmented
                value={filter}
                onChange={v => setFilter(String(v))}
                options={[
                  { value: 'all', label: `ทั้งหมด (${templates.length})` },
                  { value: 'published', label: `เผยแพร่แล้ว (${templates.filter(t => t.status === 'published').length})` },
                  { value: 'draft', label: `ฉบับร่าง (${templates.filter(t => t.status === 'draft').length})` },
                  { value: 'retired', label: `เลิกใช้ (${templates.filter(t => t.status === 'retired').length})` },
                ]}
              />
            </Flex>

            {shown.length === 0 ? (
              <Empty description="ยังไม่มีแม่แบบในกลุ่มนี้" style={{ padding: '24px 0' }} />
            ) : (
              <Table
                rowKey="id"
                size="small"
                columns={columns}
                dataSource={shown}
                pagination={false}
                scroll={{ x: 900 }}
              />
            )}
          </Card>
        </Flex>
      )}

      {/* ---------- ตัวแก้แม่แบบ ---------- */}
      <Drawer
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? `แก้ไขแม่แบบ · ${editing.code}` : 'สร้างแม่แบบใหม่'}
        placement="right"
        size="large"
        styles={{ body: { background: 'var(--app-bg)' } }}
        extra={
          <Space>
            <Button onClick={() => setEditing(null)}>ยกเลิก</Button>
            <Button type="primary" icon={<VscSave />} loading={saving} onClick={saveTemplate}>
              บันทึก
            </Button>
          </Space>
        }
      >
        {editing && (
          <Flex vertical gap={16}>
            <Card size="small" title={<Text strong>ข้อมูลทั่วไป</Text>}>
              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                  <Text type="secondary" style={{ fontSize: 12 }}>รหัสแม่แบบ</Text>
                  <Input
                    placeholder="เช่น EXTUBATION"
                    value={editing.code}
                    disabled={Boolean(editing.id)}
                    onChange={e => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  />
                  {Boolean(editing.id) && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      รหัสแก้ไม่ได้ เพราะรายงานตัวชี้วัดอ้างถึงรหัสนี้
                    </Text>
                  )}
                </Col>
                <Col xs={24} md={16}>
                  <Text type="secondary" style={{ fontSize: 12 }}>ชื่อ Focus</Text>
                  <Input
                    placeholder="เช่น ถอดท่อช่วยหายใจ (extubation)"
                    value={editing.title}
                    onChange={e => setEditing({ ...editing, title: e.target.value })}
                  />
                </Col>
                <Col xs={24} md={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>หอผู้ป่วยเจ้าของ</Text>
                  <Select
                    showSearch
                    placeholder="เลือกหอผู้ป่วย"
                    style={{ width: '100%' }}
                    value={editing.owner_ward_code || undefined}
                    onChange={v => setEditing({ ...editing, owner_ward_code: v })}
                    optionFilterProp="label"
                    options={wards.map(w => ({ value: String(w.ward), label: w.ward_name }))}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    หอผู้ป่วยอื่นหยิบไปใช้ได้ ระบุไว้เพื่อความรับผิดชอบต่อเนื้อหา
                  </Text>
                </Col>
                <Col xs={24} md={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>วัตถุประสงค์</Text>
                  <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    placeholder="เช่น ผู้ป่วยปลอดภัยและได้รับการเฝ้าระวังในแต่ละระยะ"
                    value={editing.objective ?? ''}
                    onChange={e => setEditing({ ...editing, objective: e.target.value })}
                  />
                </Col>
              </Row>
            </Card>

            <Flex justify="space-between" align="center" wrap gap={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {sections.length} ระยะ · กิจกรรม {totals.activities} ข้อ · รายการประเมินผล {totals.evaluations} รายการ
              </Text>
              <Button
                icon={<PiPlusBold />}
                onClick={() => setSections([...sections, { id: newId('s'), title: '', activities: [''], evaluations: [] }])}
              >
                เพิ่มระยะ
              </Button>
            </Flex>

            {editing.id > 0 && editing.status === 'published' && (
              <Alert
                type="warning"
                showIcon
                title="แม่แบบนี้เผยแพร่อยู่"
                description="การแก้เนื้อหาจะขยับเลขรุ่นและมีผลกับใบที่เปิดใหม่เท่านั้น ใบที่บันทึกไปแล้วยังใช้โครงเดิมของตัวเอง"
              />
            )}

            {sections.map((section, i) => (
              <SectionEditor
                key={section.id}
                section={section}
                index={i}
                total={sections.length}
                onChange={next => {
                  const list = [...sections];
                  list[i] = next;
                  setSections(list);
                }}
                onRemove={() => setSections(sections.filter((_, j) => j !== i))}
                onMove={delta => {
                  const to = i + delta;
                  if (to < 0 || to >= sections.length) return;
                  const list = [...sections];
                  const [moved] = list.splice(i, 1);
                  list.splice(to, 0, moved!);
                  setSections(list);
                }}
              />
            ))}
          </Flex>
        )}
      </Drawer>

      {/* ---------- ประวัติการแก้ไข ---------- */}
      <Modal
        open={Boolean(revOf)}
        title={`ประวัติการแก้ไข · ${revOf?.title ?? ''}`}
        onCancel={() => setRevOf(null)}
        footer={<Button onClick={() => setRevOf(null)}>ปิด</Button>}
        width={600}
      >
        {revisions.length === 0 ? (
          <Empty description="ยังไม่มีประวัติ" />
        ) : (
          <Timeline
            style={{ marginTop: 16 }}
            items={revisions.map(r => ({
              color: r.action === 'publish' ? 'green' : r.action === 'delete' ? 'red' : 'blue',
              content: (
                <Flex vertical gap={2}>
                  <Space size={6}>
                    <Text strong style={{ fontSize: 13 }}>{ACTION_LABEL[r.action] ?? r.action}</Text>
                    <Tag>รุ่นที่ {r.version}</Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs(r.changed_at).format('DD/MM/YYYY HH:mm')} โดย {r.changed_by_name || '-'}
                  </Text>
                  {r.reason && <Text style={{ fontSize: 12 }}>เหตุผล: {r.reason}</Text>}
                </Flex>
              ),
            }))}
          />
        )}
      </Modal>
    </>
  );
}

export default function CarePlanTemplatesPage() {
  return (
    // ธีมและ <App> มาจาก ThemeProvider ที่ layout ระดับราก
    // ถ้าประกาศ ConfigProvider ซ้ำตรงนี้ หน้าจะถูกล็อกไว้ที่โหมดสว่างเสมอ
    <div style={{ background: 'var(--app-bg)', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ padding: 16, maxWidth: 1600, margin: '0 auto' }}>
            <TemplatesInner />
      </div>
    </div>
  );
}
