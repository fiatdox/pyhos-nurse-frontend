'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import type { ECharts } from 'echarts';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave, VscTrash } from 'react-icons/vsc';
import { PiHeartbeatBold, PiChartLineBold, PiTableBold } from 'react-icons/pi';

const { Option } = Select;

interface PatientInfo {
  admission_list_id: number;
  hn: string;
  an: string;
  name?: string;
  patient_name?: string;
  ptname?: string;
  bed?: string;
  bedno?: string;
  admitDateTimeIso?: string;
  reg_datetime?: string;
  spcltyName?: string;
  spclty_name?: string;
  doctorName?: string;
  incharge_doctor?: string;
  ward?: string;
  wardName?: string;
}

interface VitalRecord {
  id: number;
  an: string;
  record_datetime: string;
  vital_t?: string;
  vital_p?: string;
  vital_r?: string;
  vital_bp_s?: string;
  vital_bp_d?: string;
  vital_o2sat?: string;
  pain_score?: number;
  consciousness?: string;
  nurse_name?: string;
}

// --- Chart Component ---
function VitalChart({ records }: { records: VitalRecord[] }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ECharts | null>(null);

  const sorted = useMemo(() =>
    [...records].sort((a, b) => dayjs(a.record_datetime).unix() - dayjs(b.record_datetime).unix()),
    [records]
  );

  useEffect(() => {
    if (!chartRef.current || sorted.length === 0) return;

    let cancelled = false;
    let resizeHandler: (() => void) | null = null;

    import('echarts').then((echarts) => {
      if (cancelled || !chartRef.current) return;

      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current);
      }
      const chart = chartInstance.current;

      const xData = sorted.map(r => dayjs(r.record_datetime).format('DD/MM HH:mm'));
      const tData = sorted.map(r => r.vital_t ? parseFloat(r.vital_t) : null);
      const pData = sorted.map(r => r.vital_p ? parseFloat(r.vital_p) : null);
      const rData = sorted.map(r => r.vital_r ? parseFloat(r.vital_r) : null);
      const bpSData = sorted.map(r => r.vital_bp_s ? parseFloat(r.vital_bp_s) : null);
      const bpDData = sorted.map(r => r.vital_bp_d ? parseFloat(r.vital_bp_d) : null);
      const o2Data = sorted.map(r => r.vital_o2sat ? parseFloat(r.vital_o2sat) : null);

      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: {
          data: ['T (°C)', 'Pulse', 'RR', 'BP Sys', 'BP Dia', 'O2Sat'],
          bottom: 0,
          textStyle: { fontSize: 11 },
        },
        grid: { top: 30, right: 20, bottom: 50, left: 50 },
        xAxis: {
          type: 'category',
          data: xData,
          axisLabel: { fontSize: 10, rotate: 30 },
        },
        yAxis: [
          { type: 'value', name: 'T / P / R / BP', position: 'left', min: 0 },
          { type: 'value', name: 'O2Sat %', position: 'right', min: 80, max: 100 },
        ],
        series: [
          { name: 'T (°C)', type: 'line', data: tData, smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { width: 2, color: '#ef4444' }, itemStyle: { color: '#ef4444' }, connectNulls: true },
          { name: 'Pulse', type: 'line', data: pData, smooth: true, symbol: 'diamond', symbolSize: 6, lineStyle: { width: 2, color: '#f97316' }, itemStyle: { color: '#f97316' }, connectNulls: true },
          { name: 'RR', type: 'line', data: rData, smooth: true, symbol: 'triangle', symbolSize: 6, lineStyle: { width: 2, color: '#8b5cf6' }, itemStyle: { color: '#8b5cf6' }, connectNulls: true },
          { name: 'BP Sys', type: 'line', data: bpSData, smooth: true, symbol: 'rect', symbolSize: 6, lineStyle: { width: 2, color: '#3b82f6' }, itemStyle: { color: '#3b82f6' }, connectNulls: true },
          { name: 'BP Dia', type: 'line', data: bpDData, smooth: true, symbol: 'rect', symbolSize: 5, lineStyle: { width: 1.5, type: 'dashed', color: '#93c5fd' }, itemStyle: { color: '#93c5fd' }, connectNulls: true },
          { name: 'O2Sat', type: 'line', yAxisIndex: 1, data: o2Data, smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { width: 2, color: '#10b981' }, itemStyle: { color: '#10b981' }, areaStyle: { color: 'rgba(16,185,129,0.08)' }, connectNulls: true },
        ],
      }, true);

      resizeHandler = () => chart.resize();
      window.addEventListener('resize', resizeHandler);
    });

    return () => {
      cancelled = true;
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    };
  }, [sorted]);

  useEffect(() => {
    return () => { chartInstance.current?.dispose(); };
  }, []);

  if (records.length === 0) {
    return <div className="text-center text-gray-400 py-16">ยังไม่มีข้อมูลสำหรับแสดงกราฟ</div>;
  }

  return <div ref={chartRef} className="w-full h-100" />;
}

// --- Mock Data ---
const mockRecords: VitalRecord[] = [
  { id: 1, an: '', record_datetime: dayjs().subtract(3, 'day').hour(8).format('YYYY-MM-DD HH:mm:ss'), vital_t: '36.5', vital_p: '78', vital_r: '18', vital_bp_s: '120', vital_bp_d: '80', vital_o2sat: '98', pain_score: 2, consciousness: 'Alert', nurse_name: 'พย.สมหญิง' },
  { id: 2, an: '', record_datetime: dayjs().subtract(3, 'day').hour(16).format('YYYY-MM-DD HH:mm:ss'), vital_t: '37.2', vital_p: '82', vital_r: '20', vital_bp_s: '125', vital_bp_d: '82', vital_o2sat: '97', pain_score: 3, consciousness: 'Alert', nurse_name: 'พย.วิภา' },
  { id: 3, an: '', record_datetime: dayjs().subtract(3, 'day').hour(0).format('YYYY-MM-DD HH:mm:ss'), vital_t: '37.0', vital_p: '75', vital_r: '19', vital_bp_s: '118', vital_bp_d: '78', vital_o2sat: '98', pain_score: 1, consciousness: 'Alert', nurse_name: 'พย.นิดา' },
  { id: 4, an: '', record_datetime: dayjs().subtract(2, 'day').hour(8).format('YYYY-MM-DD HH:mm:ss'), vital_t: '38.2', vital_p: '96', vital_r: '24', vital_bp_s: '130', vital_bp_d: '88', vital_o2sat: '95', pain_score: 5, consciousness: 'Alert', nurse_name: 'พย.สมหญิง' },
  { id: 5, an: '', record_datetime: dayjs().subtract(2, 'day').hour(16).format('YYYY-MM-DD HH:mm:ss'), vital_t: '38.5', vital_p: '102', vital_r: '26', vital_bp_s: '135', vital_bp_d: '90', vital_o2sat: '93', pain_score: 6, consciousness: 'Drowsy', nurse_name: 'พย.วิภา' },
  { id: 6, an: '', record_datetime: dayjs().subtract(2, 'day').hour(0).format('YYYY-MM-DD HH:mm:ss'), vital_t: '38.0', vital_p: '98', vital_r: '22', vital_bp_s: '128', vital_bp_d: '85', vital_o2sat: '94', pain_score: 5, consciousness: 'Alert', nurse_name: 'พย.นิดา' },
  { id: 7, an: '', record_datetime: dayjs().subtract(1, 'day').hour(8).format('YYYY-MM-DD HH:mm:ss'), vital_t: '37.5', vital_p: '88', vital_r: '20', vital_bp_s: '122', vital_bp_d: '80', vital_o2sat: '96', pain_score: 3, consciousness: 'Alert', nurse_name: 'พย.สมหญิง' },
  { id: 8, an: '', record_datetime: dayjs().subtract(1, 'day').hour(16).format('YYYY-MM-DD HH:mm:ss'), vital_t: '37.0', vital_p: '80', vital_r: '18', vital_bp_s: '120', vital_bp_d: '78', vital_o2sat: '97', pain_score: 2, consciousness: 'Alert', nurse_name: 'พย.วิภา' },
  { id: 9, an: '', record_datetime: dayjs().subtract(1, 'day').hour(0).format('YYYY-MM-DD HH:mm:ss'), vital_t: '36.8', vital_p: '76', vital_r: '18', vital_bp_s: '118', vital_bp_d: '76', vital_o2sat: '98', pain_score: 1, consciousness: 'Alert', nurse_name: 'พย.นิดา' },
  { id: 10, an: '', record_datetime: dayjs().hour(8).format('YYYY-MM-DD HH:mm:ss'), vital_t: '36.6', vital_p: '74', vital_r: '17', vital_bp_s: '116', vital_bp_d: '75', vital_o2sat: '99', pain_score: 0, consciousness: 'Alert', nurse_name: 'พย.สมหญิง' },
];

// --- Main Component ---
export default function VitalSignsRecord({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [records, setRecords] = useState<VitalRecord[]>(mockRecords);
  const [rightTab, setRightTab] = useState('chart');

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/vital/${an}`, { headers });
      if (res.data?.success) setRecords(res.data.data || []);
    } catch {
      // ถ้า API ยังไม่มี ใช้ mock data
      setRecords(mockRecords.map(r => ({ ...r, an })));
    }
  }, [an, getHeaders]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = getHeaders();
        const patientRes = await axios.post('/api/v1/patient-by-an', { an }, { headers });
        if (patientRes.data?.success && patientRes.data.data) {
          const p = Array.isArray(patientRes.data.data) ? patientRes.data.data[0] : patientRes.data.data;
          setPatient(p);
        }
        await fetchRecords();
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [an, getHeaders, fetchRecords]);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const headers = getHeaders();
      const payload = {
        an,
        admission_list_id: patient?.admission_list_id,
        ward_code: patient?.ward || getUserProfile()?.ward_code || '',
        ward_name: patient?.wardName || getUserProfile()?.ward_name || '',
        staff_id: getUserProfile()?.staff_id || '',
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        vital_t: values.vital_t || null,
        vital_p: values.vital_p || null,
        vital_r: values.vital_r || null,
        vital_bp_s: values.vital_bp_s || null,
        vital_bp_d: values.vital_bp_d || null,
        vital_o2sat: values.vital_o2sat || null,
        pain_score: values.pain_score ?? null,
        consciousness: values.consciousness || null,
        nurse_name: values.nurse_name || null,
      };
      await axios.post('/api/v1/nursing-records/vital', payload, { headers });
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกสัญญาณชีพสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      form.resetFields();
      form.setFieldsValue({ record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' });
      await fetchRecords();
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาดในการบันทึก', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/vital/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchRecords();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const getTagColor = (key: string, value: string | number | undefined) => {
    if (value === undefined || value === null || value === '') return '';
    const v = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(v)) return '';
    switch (key) {
      case 't': return v >= 38 ? 'red' : v <= 35.5 ? 'blue' : 'green';
      case 'p': return v > 100 || v < 60 ? 'red' : 'green';
      case 'r': return v > 24 || v < 12 ? 'red' : 'green';
      case 'o2': return v < 94 ? 'red' : 'green';
      case 'pain': return v >= 7 ? 'red' : v >= 4 ? 'orange' : 'green';
      default: return '';
    }
  };

  const columns: ColumnsType<VitalRecord> = [
    {
      title: 'วันที่/เวลา', dataIndex: 'record_datetime', key: 'record_datetime', width: 140,
      render: (v) => v ? dayjs(v).format('DD/MM/YY HH:mm') : '-',
      defaultSortOrder: 'descend', sorter: (a, b) => dayjs(a.record_datetime).unix() - dayjs(b.record_datetime).unix(),
    },
    {
      title: 'T (°C)', dataIndex: 'vital_t', key: 'vital_t', width: 80, align: 'center',
      render: (v) => v ? <Tag color={getTagColor('t', v)} className="m-0 font-semibold">{v}</Tag> : '-',
    },
    {
      title: 'P', dataIndex: 'vital_p', key: 'vital_p', width: 70, align: 'center',
      render: (v) => v ? <Tag color={getTagColor('p', v)} className="m-0 font-semibold">{v}</Tag> : '-',
    },
    {
      title: 'R', dataIndex: 'vital_r', key: 'vital_r', width: 70, align: 'center',
      render: (v) => v ? <Tag color={getTagColor('r', v)} className="m-0 font-semibold">{v}</Tag> : '-',
    },
    {
      title: 'BP', key: 'bp', width: 100, align: 'center',
      render: (_, r) => (r.vital_bp_s && r.vital_bp_d) ? <span className="font-semibold">{r.vital_bp_s}/{r.vital_bp_d}</span> : '-',
    },
    {
      title: 'O2Sat', dataIndex: 'vital_o2sat', key: 'vital_o2sat', width: 80, align: 'center',
      render: (v) => v ? <Tag color={getTagColor('o2', v)} className="m-0 font-semibold">{v}%</Tag> : '-',
    },
    {
      title: 'Pain', dataIndex: 'pain_score', key: 'pain_score', width: 70, align: 'center',
      render: (v) => v !== null && v !== undefined ? <Tag color={getTagColor('pain', v)} className="m-0 font-semibold">{v}</Tag> : '-',
    },
    {
      title: 'Conscious', dataIndex: 'consciousness', key: 'consciousness', width: 90, align: 'center',
      render: (v) => v || '-',
    },
    { title: 'พยาบาล', dataIndex: 'nurse_name', key: 'nurse_name', width: 120 },
    {
      title: '', key: 'action', width: 50, align: 'center',
      render: (_, r) => (
        <Popconfirm title="ยืนยันลบรายการนี้?" onConfirm={() => handleDelete(r.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
          <Button type="text" danger size="small" icon={<VscTrash />} />
        </Popconfirm>
      ),
    },
  ];

  const patientName = patient?.ptname || patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-red-500 to-rose-400 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiHeartbeatBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">แบบบันทึกสัญญาณชีพ (Vital Signs)</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-white/90 text-sm font-semibold">{patientName}</span>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">HN: {patient?.hn || '-'}</Tag>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">AN: {an}</Tag>
                <span className="text-white/70 text-xs">เตียง {patient?.bed || patient?.bedno || '-'}</span>
                <span className="text-white/70 text-xs">Admit: {formattedAdmitDate}</span>
              </div>
            </div>
          </div>
          <Button size="small" onClick={() => window.history.back()} className="border-white/30 text-white bg-white/10 hover:bg-white/20">ย้อนกลับ</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" description="กำลังโหลดข้อมูล..." /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Form - Left */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-1"
              title={<span className="text-red-500 font-bold text-sm">บันทึกสัญญาณชีพ</span>}>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' }}
                className="[&_.ant-form-item]:mb-2 [&_.ant-form-item-label]:pb-0 [&_.ant-form-item-label_label]:text-xs [&_.ant-form-item-label_label]:font-semibold [&_.ant-form-item-label_label]:text-gray-600"
              >
                <Form.Item label="วันที่/เวลา" name="record_datetime" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
                  <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
                </Form.Item>

                <div className="bg-red-50 rounded-lg px-3 pt-2 pb-0 mb-2 border border-red-100">
                  <div className="text-xs text-red-400 font-semibold mb-1">Vital Signs</div>
                  <Row gutter={8}>
                    <Col span={12}><Form.Item label="T (°C)" name="vital_t" className="mb-1!"><Input placeholder="36.5" /></Form.Item></Col>
                    <Col span={12}><Form.Item label="Pulse (/min)" name="vital_p" className="mb-1!"><Input placeholder="80" /></Form.Item></Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={12}><Form.Item label="RR (/min)" name="vital_r" className="mb-1!"><Input placeholder="20" /></Form.Item></Col>
                    <Col span={12}><Form.Item label="O2 Sat (%)" name="vital_o2sat" className="mb-1!"><Input placeholder="98" /></Form.Item></Col>
                  </Row>
                  <Row gutter={8}>
                    <Col span={12}><Form.Item label="BP Systolic" name="vital_bp_s" className="mb-1!"><Input placeholder="120" /></Form.Item></Col>
                    <Col span={12}><Form.Item label="BP Diastolic" name="vital_bp_d" className="mb-1!"><Input placeholder="80" /></Form.Item></Col>
                  </Row>
                </div>

                <Row gutter={8}>
                  <Col span={12}><Form.Item label="Pain (0-10)" name="pain_score"><Select placeholder="เลือก" allowClear>
                    {[...Array(11)].map((_, i) => <Option key={i} value={i}>{i}</Option>)}
                  </Select></Form.Item></Col>
                  <Col span={12}><Form.Item label="Consciousness" name="consciousness"><Select placeholder="เลือก" allowClear>
                    <Option value="Alert">Alert</Option><Option value="Drowsy">Drowsy</Option><Option value="Stupor">Stupor</Option><Option value="Coma">Coma</Option>
                  </Select></Form.Item></Col>
                </Row>

                <Form.Item label="พยาบาลผู้บันทึก" name="nurse_name"><Input placeholder="ระบุชื่อ" /></Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving} className="bg-red-500 hover:bg-red-600 w-full shadow-md" size="middle">
                  บันทึกสัญญาณชีพ
                </Button>
              </Form>
            </Card>

            {/* Chart + Table Tabs - Right */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-2 [&_.ant-card-body]:p-0 [&_.ant-card-body]:pt-0">
              <Tabs
                activeKey={rightTab}
                onChange={setRightTab}
                type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-red-500! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'chart',
                    label: <span className="flex items-center gap-1.5"><PiChartLineBold /> กราฟสัญญาณชีพ</span>,
                    children: (
                      <div className="p-3">
                        <VitalChart records={records} />
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
                          pagination={{ pageSize: 15, size: 'small' }}
                          scroll={{ x: 900 }}
                          locale={{ emptyText: 'ยังไม่มีข้อมูลสัญญาณชีพ' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-red-50! [&_.ant-table-thead_.ant-table-cell]:text-red-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!"
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
