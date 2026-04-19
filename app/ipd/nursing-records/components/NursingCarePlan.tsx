'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, Spin, Tag, Table, Popconfirm, Tabs, Badge } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { VscSave, VscTrash, VscEdit, VscCheck } from 'react-icons/vsc';
import { PiTargetBold, PiListChecksBold, PiListBulletsBold } from 'react-icons/pi';

const { TextArea } = Input;
const { Option } = Select;

interface PatientInfo {
  admission_list_id: number;
  hn: string;
  an: string;
  name?: string;
  patient_name?: string;
  bed?: string;
  bedno?: string;
  admitDateTimeIso?: string;
  reg_datetime?: string;
  spcltyName?: string;
  spclty_name?: string;
  doctorName?: string;
  incharge_doctor?: string;
}

interface CarePlan {
  id: number;
  an: string;
  start_date: string;
  nursing_diagnosis: string;
  related_to?: string;
  goal?: string;
  expected_outcome?: string;
  interventions?: string;
  evaluation?: string;
  evaluation_date?: string;
  status: 'active' | 'resolved' | 'revised';
  priority?: 'high' | 'medium' | 'low';
  nurse_name?: string;
}

// --- Mock Data ---
const mockCarePlans: CarePlan[] = [
  {
    id: 1, an: '', start_date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    nursing_diagnosis: 'เสี่ยงต่อการติดเชื้อ',
    related_to: 'มีแผลผ่าตัดหน้าท้อง, มีสาย IV',
    goal: 'ผู้ป่วยไม่มีอาการแสดงของการติดเชื้อตลอดระยะเวลาที่นอนโรงพยาบาล',
    expected_outcome: 'T 36.5-37.4°C, แผลแห้งดี ไม่บวมแดง, WBC ปกติ',
    interventions: '1. ดูแลแผลด้วย aseptic technique\n2. เปลี่ยน dressing ทุกวัน/เมื่อเปียกชื้น\n3. สังเกตอาการ/อาการแสดงของการติดเชื้อ\n4. ดูแลสาย IV อย่างถูกวิธี เปลี่ยนทุก 72 ชม.\n5. ติดตาม V/S ทุก 4 ชม.',
    evaluation: 'แผลแห้งดี ไม่มี discharge T 36.6°C WBC 8,500',
    evaluation_date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    status: 'active', priority: 'high', nurse_name: 'พย.สมหญิง',
  },
  {
    id: 2, an: '', start_date: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    nursing_diagnosis: 'มีความปวดเฉียบพลัน',
    related_to: 'แผลผ่าตัด',
    goal: 'ผู้ป่วยมีระดับความปวดลดลง pain score ≤ 3/10',
    expected_outcome: 'pain score ≤ 3/10, ผู้ป่วยพักผ่อนได้, สามารถทำกิจกรรมได้',
    interventions: '1. ประเมิน pain score ทุก 4 ชม.\n2. ให้ยาแก้ปวดตามแผนการรักษา\n3. จัดท่าสบาย semi-fowler\n4. สอน splinting technique\n5. ใช้วิธีลดปวดแบบไม่ใช้ยา เช่น เบี่ยงเบนความสนใจ',
    evaluation: 'pain score 2/10 ผู้ป่วยพักผ่อนได้ดี ลุกนั่งได้',
    evaluation_date: dayjs().format('YYYY-MM-DD'),
    status: 'resolved', priority: 'high', nurse_name: 'พย.วิภา',
  },
  {
    id: 3, an: '', start_date: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
    nursing_diagnosis: 'เสี่ยงต่อการพลัดตกหกล้ม',
    related_to: 'Orthostatic hypotension, ได้รับยาลดความดัน, อายุมาก',
    goal: 'ผู้ป่วยไม่เกิดเหตุการณ์พลัดตกหกล้มตลอดระยะเวลาที่นอนโรงพยาบาล',
    expected_outcome: 'Morse Fall Scale ลดลง, ผู้ป่วยและญาติบอกวิธีป้องกันได้',
    interventions: '1. ยกไม้กั้นเตียงทั้ง 2 ข้าง\n2. ติดสัญลักษณ์ Fall Risk\n3. สอนเปลี่ยนท่าช้าๆ\n4. จัดสิ่งแวดล้อมให้ปลอดภัย\n5. ให้สวมรองเท้ากันลื่น',
    evaluation: 'ยังไม่เกิดเหตุการณ์พลัดตกหกล้ม ผู้ป่วยและญาติเข้าใจวิธีป้องกัน',
    evaluation_date: dayjs().format('YYYY-MM-DD'),
    status: 'active', priority: 'medium', nurse_name: 'พย.สมหญิง',
  },
  {
    id: 4, an: '', start_date: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    nursing_diagnosis: 'พร่องความรู้เรื่องการดูแลตนเองหลังผ่าตัด',
    related_to: 'เตรียมจำหน่าย',
    goal: 'ผู้ป่วยและญาติมีความรู้ในการดูแลตนเองหลังจำหน่ายกลับบ้าน',
    expected_outcome: 'สามารถบอกวิธีดูแลแผล อาหาร กิจกรรม อาการผิดปกติที่ต้องมาพบแพทย์ได้',
    interventions: '1. สอนการดูแลแผลผ่าตัดที่บ้าน\n2. แนะนำอาหารที่เหมาะสม\n3. สอนการสังเกตอาการผิดปกติ\n4. นัด F/U และให้ข้อมูลการติดต่อ',
    evaluation: '',
    evaluation_date: undefined,
    status: 'active', priority: 'medium', nurse_name: 'พย.นิดา',
  },
];

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'ดำเนินการ', color: 'blue' },
  resolved: { label: 'บรรลุเป้าหมาย', color: 'green' },
  revised: { label: 'ปรับแผน', color: 'orange' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  high: { label: 'สูง', color: 'red' },
  medium: { label: 'ปานกลาง', color: 'orange' },
  low: { label: 'ต่ำ', color: 'blue' },
};

export default function NursingCarePlan({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [carePlans, setCarePlans] = useState<CarePlan[]>(mockCarePlans);
  const [editingPlan, setEditingPlan] = useState<CarePlan | null>(null);
  const [rightTab, setRightTab] = useState('cards');

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchCarePlans = useCallback(async () => {
    try {
      const headers = getHeaders();
      const res = await axios.get(`/api/v1/nursing-records/careplan/${an}`, { headers });
      if (res.data?.success) setCarePlans(res.data.data || []);
    } catch {
      setCarePlans(mockCarePlans.map(p => ({ ...p, an })));
    }
  }, [an, getHeaders]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = getHeaders();
        const patientRes = await axios.get(`/api/v1/view-patient-by-an/${an}`, { headers });
        if (patientRes.data?.success && patientRes.data.data) {
          const p = Array.isArray(patientRes.data.data) ? patientRes.data.data[0] : patientRes.data.data;
          setPatient(p);
        }
        await fetchCarePlans();
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [an, getHeaders, fetchCarePlans]);

  const resetForm = () => {
    setEditingPlan(null);
    form.resetFields();
    form.setFieldsValue({ start_date: dayjs(), status: 'active', priority: 'medium' });
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const headers = getHeaders();
      const payload = {
        an,
        admission_list_id: patient?.admission_list_id,
        start_date: values.start_date ? dayjs(values.start_date).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        nursing_diagnosis: values.nursing_diagnosis || null,
        related_to: values.related_to || null,
        goal: values.goal || null,
        expected_outcome: values.expected_outcome || null,
        interventions: values.interventions || null,
        evaluation: values.evaluation || null,
        evaluation_date: values.evaluation_date ? dayjs(values.evaluation_date).format('YYYY-MM-DD') : null,
        status: values.status || 'active',
        priority: values.priority || 'medium',
        nurse_name: values.nurse_name || null,
      };

      if (editingPlan?.id) {
        await axios.put(`/api/v1/nursing-records/careplan/${editingPlan.id}`, payload, { headers });
      } else {
        await axios.post('/api/v1/nursing-records/careplan', payload, { headers });
      }
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกแผนการพยาบาลสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      resetForm();
      await fetchCarePlans();
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาดในการบันทึก', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: CarePlan) => {
    setEditingPlan(record);
    form.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : dayjs(),
      evaluation_date: record.evaluation_date ? dayjs(record.evaluation_date) : undefined,
    });
    setRightTab('cards');
  };

  const handleDelete = async (id: number) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/v1/nursing-records/careplan/${id}`, { headers });
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchCarePlans();
    } catch {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    }
  };

  const handleResolve = async (record: CarePlan) => {
    try {
      const headers = getHeaders();
      await axios.put(`/api/v1/nursing-records/careplan/${record.id}`, {
        ...record,
        status: 'resolved',
        evaluation_date: dayjs().format('YYYY-MM-DD'),
      }, { headers });
      Swal.fire({ icon: 'success', title: 'อัพเดตสถานะสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      await fetchCarePlans();
    } catch {
      // update locally for mock
      setCarePlans(prev => prev.map(p => p.id === record.id ? { ...p, status: 'resolved', evaluation_date: dayjs().format('YYYY-MM-DD') } : p));
    }
  };

  const activePlans = carePlans.filter(p => p.status === 'active');
  const resolvedPlans = carePlans.filter(p => p.status !== 'active');

  const columns: ColumnsType<CarePlan> = [
    {
      title: 'วันที่เริ่ม', dataIndex: 'start_date', key: 'start_date', width: 100,
      render: (v) => v ? dayjs(v).format('DD/MM/YY') : '-',
    },
    {
      title: 'ข้อวินิจฉัย', dataIndex: 'nursing_diagnosis', key: 'nursing_diagnosis', width: 180,
      render: (v) => <span className="font-semibold text-emerald-700">{v}</span>,
    },
    {
      title: 'ลำดับความสำคัญ', dataIndex: 'priority', key: 'priority', width: 110, align: 'center',
      render: (v) => {
        const cfg = priorityConfig[v] || { label: v, color: 'default' };
        return <Tag color={cfg.color} className="m-0">{cfg.label}</Tag>;
      },
    },
    { title: 'เป้าหมาย', dataIndex: 'goal', key: 'goal', ellipsis: true },
    {
      title: 'สถานะ', dataIndex: 'status', key: 'status', width: 110, align: 'center',
      render: (v) => {
        const cfg = statusConfig[v] || { label: v, color: 'default' };
        return <Tag color={cfg.color} className="m-0">{cfg.label}</Tag>;
      },
    },
    { title: 'พยาบาล', dataIndex: 'nurse_name', key: 'nurse_name', width: 100 },
    {
      title: '', key: 'action', width: 110, align: 'center',
      render: (_, r) => (
        <div className="flex gap-1 justify-center">
          <Button type="text" size="small" icon={<VscEdit />} onClick={() => handleEdit(r)} className="text-blue-500" />
          {r.status === 'active' && (
            <Popconfirm title="บรรลุเป้าหมายแล้ว?" onConfirm={() => handleResolve(r)} okText="ใช่" cancelText="ยกเลิก">
              <Button type="text" size="small" icon={<VscCheck />} className="text-green-600" />
            </Popconfirm>
          )}
          <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(r.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
            <Button type="text" danger size="small" icon={<VscTrash />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  const patientName = patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 to-teal-500 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiTargetBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">แผนการพยาบาล (Nursing Care Plan)</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-white/90 text-sm font-semibold">{patientName}</span>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">HN: {patient?.hn || '-'}</Tag>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">AN: {an}</Tag>
                <span className="text-white/70 text-xs">เตียง {patient?.bed || patient?.bedno || '-'}</span>
                <span className="text-white/70 text-xs">Admit: {formattedAdmitDate}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <Badge count={activePlans.length} color="#fff" style={{ color: '#059669' }} className="[&_.ant-badge-count]:shadow-none">
                <Tag className="border-none bg-white/20 text-white m-0 text-sm font-semibold px-3">Active</Tag>
              </Badge>
              <Badge count={resolvedPlans.length} color="#fff" style={{ color: '#6b7280' }} className="[&_.ant-badge-count]:shadow-none">
                <Tag className="border-none bg-white/10 text-white/70 m-0 text-sm px-3">Resolved</Tag>
              </Badge>
            </div>
            <Button size="small" onClick={() => window.history.back()} className="border-white/30 text-white bg-white/10 hover:bg-white/20">ย้อนกลับ</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" description="กำลังโหลดข้อมูล..." /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Form - Left 2 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-2"
              title={
                <div className="flex items-center justify-between">
                  <span className="text-emerald-600 font-bold text-sm">{editingPlan ? 'แก้ไขแผนการพยาบาล' : 'เพิ่มแผนการพยาบาล'}</span>
                  {editingPlan && <Button size="small" type="link" onClick={resetForm} className="text-xs p-0">ยกเลิกแก้ไข</Button>}
                </div>
              }>
              <Form form={form} layout="vertical" onFinish={onFinish} size="small"
                initialValues={{ start_date: dayjs(), status: 'active', priority: 'medium' }}
                className="[&_.ant-form-item]:mb-2 [&_.ant-form-item-label]:pb-0 [&_.ant-form-item-label_label]:text-xs [&_.ant-form-item-label_label]:font-semibold [&_.ant-form-item-label_label]:text-gray-600"
              >
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item label="วันที่เริ่มแผน" name="start_date" rules={[{ required: true, message: 'กรุณาระบุ' }]}>
                      <DatePicker format="DD/MM/YYYY" className="w-full" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="ลำดับความสำคัญ" name="priority">
                      <Select>
                        <Option value="high"><Tag color="red" className="m-0">สูง</Tag></Option>
                        <Option value="medium"><Tag color="orange" className="m-0">ปานกลาง</Tag></Option>
                        <Option value="low"><Tag color="blue" className="m-0">ต่ำ</Tag></Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <div className="bg-emerald-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-emerald-100">
                  <div className="text-xs text-emerald-600 font-bold mb-1">ข้อวินิจฉัยและเป้าหมาย</div>
                  <Form.Item label="ข้อวินิจฉัยทางการพยาบาล" name="nursing_diagnosis" rules={[{ required: true, message: 'กรุณาระบุ' }]} className="mb-1!">
                    <Input placeholder="เช่น เสี่ยงต่อการติดเชื้อ, มีความปวดเฉียบพลัน" />
                  </Form.Item>
                  <Form.Item label="สัมพันธ์กับ (Related to)" name="related_to" className="mb-1!">
                    <TextArea rows={1} placeholder="เช่น มีแผลผ่าตัด, มีสาย IV" />
                  </Form.Item>
                  <Form.Item label="เป้าหมาย (Goal)" name="goal" className="mb-1!">
                    <TextArea rows={2} placeholder="ผลลัพธ์ที่ต้องการ..." />
                  </Form.Item>
                  <Form.Item label="ผลลัพธ์ที่คาดหวัง (Expected Outcome)" name="expected_outcome" className="mb-1!">
                    <TextArea rows={2} placeholder="ตัวชี้วัดที่วัดได้..." />
                  </Form.Item>
                </div>

                <div className="bg-blue-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-blue-100">
                  <div className="text-xs text-blue-600 font-bold mb-1">กิจกรรมการพยาบาล</div>
                  <Form.Item label="กิจกรรมการพยาบาล (Interventions)" name="interventions" className="mb-1!">
                    <TextArea rows={4} placeholder="1. ...\n2. ...\n3. ..." />
                  </Form.Item>
                </div>

                <div className="bg-amber-50 rounded-lg px-3 pt-2 pb-1 mb-2 border border-amber-100">
                  <div className="text-xs text-amber-600 font-bold mb-1">การประเมินผล</div>
                  <Form.Item label="การประเมินผล (Evaluation)" name="evaluation" className="mb-1!">
                    <TextArea rows={2} placeholder="ผลการดำเนินงาน..." />
                  </Form.Item>
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label="วันที่ประเมิน" name="evaluation_date" className="mb-1!">
                        <DatePicker format="DD/MM/YYYY" className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="สถานะ" name="status" className="mb-1!">
                        <Select>
                          <Option value="active">ดำเนินการ</Option>
                          <Option value="resolved">บรรลุเป้าหมาย</Option>
                          <Option value="revised">ปรับแผน</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                </div>

                <Form.Item label="พยาบาลผู้บันทึก" name="nurse_name">
                  <Input placeholder="ระบุชื่อ" />
                </Form.Item>

                <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving} className="bg-emerald-600 hover:bg-emerald-700 w-full shadow-md" size="middle">
                  {editingPlan ? 'อัพเดตแผน' : 'บันทึกแผนการพยาบาล'}
                </Button>
              </Form>
            </Card>

            {/* Cards + Table - Right 3 cols */}
            <Card size="small" className="shadow-sm rounded-xl border border-gray-100 lg:col-span-3 [&_.ant-card-body]:p-0">
              <Tabs
                activeKey={rightTab}
                onChange={setRightTab}
                type="card"
                className="[&_.ant-tabs-nav]:mb-0 [&_.ant-tabs-nav]:px-3 [&_.ant-tabs-nav]:pt-2 [&_.ant-tabs-tab-active]:bg-emerald-600! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:text-sm"
                items={[
                  {
                    key: 'cards',
                    label: <span className="flex items-center gap-1.5"><PiListChecksBold /> แผนการพยาบาล ({carePlans.length})</span>,
                    children: (
                      <div className="p-3 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto">
                        {carePlans.length === 0 ? (
                          <div className="text-center text-gray-400 py-16">ยังไม่มีแผนการพยาบาล</div>
                        ) : (
                          <>
                            {/* Active Plans */}
                            {activePlans.length > 0 && (
                              <div>
                                <div className="text-xs font-bold text-emerald-600 mb-2 flex items-center gap-1.5">
                                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                  แผนที่ดำเนินการอยู่ ({activePlans.length})
                                </div>
                                <div className="space-y-3">
                                  {activePlans.map((plan) => (
                                    <div key={plan.id} className="bg-white border-l-4 border-l-emerald-500 border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow relative group">
                                      <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Tag color={priorityConfig[plan.priority || 'medium']?.color} className="m-0 text-xs">
                                            {priorityConfig[plan.priority || 'medium']?.label}
                                          </Tag>
                                          <span className="font-bold text-emerald-700 text-sm">{plan.nursing_diagnosis}</span>
                                          <span className="text-xs text-gray-400">เริ่ม: {dayjs(plan.start_date).format('DD/MM/YY')}</span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button type="text" size="small" icon={<VscEdit />} onClick={() => handleEdit(plan)} className="text-blue-500" />
                                          <Popconfirm title="บรรลุเป้าหมายแล้ว?" onConfirm={() => handleResolve(plan)} okText="ใช่" cancelText="ยกเลิก">
                                            <Button type="text" size="small" icon={<VscCheck />} className="text-green-600" title="บรรลุเป้าหมาย" />
                                          </Popconfirm>
                                          <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(plan.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
                                            <Button type="text" danger size="small" icon={<VscTrash />} />
                                          </Popconfirm>
                                        </div>
                                      </div>

                                      {plan.related_to && (
                                        <div className="text-xs text-gray-500 mb-2">
                                          <span className="font-semibold">สัมพันธ์กับ:</span> {plan.related_to}
                                        </div>
                                      )}

                                      <div className="space-y-1.5 text-sm">
                                        {plan.goal && (
                                          <div className="bg-emerald-50 rounded-lg px-3 py-1.5">
                                            <span className="text-emerald-600 font-bold text-xs">เป้าหมาย:</span>
                                            <span className="text-gray-700 ml-1">{plan.goal}</span>
                                          </div>
                                        )}
                                        {plan.expected_outcome && (
                                          <div className="px-3">
                                            <span className="text-blue-500 font-bold text-xs">ผลลัพธ์ที่คาดหวัง:</span>
                                            <span className="text-gray-600 ml-1 text-xs">{plan.expected_outcome}</span>
                                          </div>
                                        )}
                                        {plan.interventions && (
                                          <div className="bg-blue-50 rounded-lg px-3 py-1.5">
                                            <span className="text-blue-600 font-bold text-xs">กิจกรรม:</span>
                                            <div className="text-gray-700 ml-1 whitespace-pre-line text-xs mt-0.5">{plan.interventions}</div>
                                          </div>
                                        )}
                                        {plan.evaluation && (
                                          <div className="bg-amber-50 rounded-lg px-3 py-1.5">
                                            <span className="text-amber-600 font-bold text-xs">ประเมินผล ({plan.evaluation_date ? dayjs(plan.evaluation_date).format('DD/MM/YY') : '-'}):</span>
                                            <span className="text-gray-700 ml-1 text-xs">{plan.evaluation}</span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="mt-2 pt-2 border-t border-gray-50 flex justify-end">
                                        <span className="text-xs text-gray-400">บันทึกโดย: <span className="font-semibold text-gray-600">{plan.nurse_name || '-'}</span></span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Resolved Plans */}
                            {resolvedPlans.length > 0 && (
                              <div>
                                <div className="text-xs font-bold text-gray-400 mb-2 flex items-center gap-1.5">
                                  <div className="w-2 h-2 bg-gray-300 rounded-full" />
                                  บรรลุเป้าหมาย / ปรับแผน ({resolvedPlans.length})
                                </div>
                                <div className="space-y-2">
                                  {resolvedPlans.map((plan) => (
                                    <div key={plan.id} className="bg-gray-50 border-l-4 border-l-gray-300 border border-gray-100 rounded-xl p-3 group opacity-75 hover:opacity-100 transition-opacity">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Tag color={statusConfig[plan.status]?.color} className="m-0 text-xs">{statusConfig[plan.status]?.label}</Tag>
                                          <span className="font-semibold text-gray-600 text-sm">{plan.nursing_diagnosis}</span>
                                          <span className="text-xs text-gray-400">{dayjs(plan.start_date).format('DD/MM/YY')} - {plan.evaluation_date ? dayjs(plan.evaluation_date).format('DD/MM/YY') : '-'}</span>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Button type="text" size="small" icon={<VscEdit />} onClick={() => handleEdit(plan)} className="text-blue-500" />
                                          <Popconfirm title="ยืนยันลบ?" onConfirm={() => handleDelete(plan.id)} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}>
                                            <Button type="text" danger size="small" icon={<VscTrash />} />
                                          </Popconfirm>
                                        </div>
                                      </div>
                                      {plan.evaluation && (
                                        <div className="mt-1 text-xs text-gray-500">
                                          <span className="font-semibold">ผลประเมิน:</span> {plan.evaluation}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'table',
                    label: <span className="flex items-center gap-1.5"><PiListBulletsBold /> ตาราง</span>,
                    children: (
                      <div className="p-3">
                        <Table
                          columns={columns}
                          dataSource={carePlans}
                          rowKey="id"
                          size="small"
                          pagination={{ pageSize: 10, size: 'small' }}
                          scroll={{ x: 900 }}
                          locale={{ emptyText: 'ยังไม่มีแผนการพยาบาล' }}
                          className="[&_.ant-table-thead_.ant-table-cell]:bg-emerald-50! [&_.ant-table-thead_.ant-table-cell]:text-emerald-700! [&_.ant-table-thead_.ant-table-cell]:font-semibold! [&_.ant-table-thead_.ant-table-cell]:text-xs!"
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
