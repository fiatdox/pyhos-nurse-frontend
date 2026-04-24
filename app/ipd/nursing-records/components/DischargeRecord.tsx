'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, Spin, Tag, Checkbox } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave } from 'react-icons/vsc';
import { PiSignOutBold, PiCheckCircleBold, PiHeartbeatBold, PiBookOpenBold, PiUserBold } from 'react-icons/pi';

const { TextArea } = Input;
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
  doctorName?: string;
  incharge_doctor?: string;
  ward?: string;
  wardName?: string;
}

interface DischargeData {
  id?: number;
  an: string;
  admission_list_id?: number;
  discharge_datetime?: string;
  discharge_type?: string;
  discharge_condition?: string;
  // Vital Signs at discharge
  vital_t?: string;
  vital_p?: string;
  vital_r?: string;
  vital_bp?: string;
  vital_o2sat?: string;
  // Discharge summary
  diagnosis_summary?: string;
  treatment_summary?: string;
  procedure_done?: string;
  // Discharge instructions
  medication_instructions?: string;
  diet_instructions?: string;
  activity_instructions?: string;
  wound_care_instructions?: string;
  warning_signs?: string;
  follow_up_appointment?: string;
  // Readiness
  education_completed?: boolean;
  medication_provided?: boolean;
  documents_given?: boolean;
  transportation_arranged?: boolean;
  referral_arranged?: boolean;
  // Caregiver
  discharged_with?: string;
  caregiver_name?: string;
  caregiver_phone?: string;
  discharge_destination?: string;
  // Nurse
  nurse_name?: string;
  record_datetime?: string;
}

const dischargeTypes = [
  { value: 'physician_order', label: 'แพทย์อนุญาต' },
  { value: 'against_advice', label: 'ขัดคำแนะนำแพทย์ (AMA)' },
  { value: 'transfer', label: 'ส่งต่อ/Refer' },
  { value: 'death', label: 'เสียชีวิต' },
  { value: 'escape', label: 'หนีกลับ' },
];

const dischargeConditions = [
  { value: 'improved', label: 'ดีขึ้น' },
  { value: 'recovered', label: 'หายดี' },
  { value: 'unchanged', label: 'เหมือนเดิม' },
  { value: 'worse', label: 'แย่ลง' },
  { value: 'death', label: 'เสียชีวิต' },
];

export default function DischargeRecord({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [existingRecord, setExistingRecord] = useState<DischargeData | null>(null);

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

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
        try {
          const recordRes = await axios.get(`/api/v1/nursing-records/discharge/${an}`, { headers });
          if (recordRes.data?.success && recordRes.data.data) {
            const record = recordRes.data.data;
            setExistingRecord(record);
            form.setFieldsValue({
              ...record,
              discharge_datetime: record.discharge_datetime ? dayjs(record.discharge_datetime) : dayjs(),
              record_datetime: record.record_datetime ? dayjs(record.record_datetime) : dayjs(),
            });
          }
        } catch {
          form.setFieldsValue({ discharge_datetime: dayjs(), record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [an, getHeaders, form]);

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const headers = getHeaders();
      const payload: DischargeData = {
        ...values,
        an,
        admission_list_id: patient?.admission_list_id,
        ward_code: patient?.ward || getUserProfile()?.ward_code || '',
        ward_name: patient?.wardName || getUserProfile()?.ward_name || '',
        staff_id: getUserProfile()?.staff_id || '',
        discharge_datetime: values.discharge_datetime ? dayjs(values.discharge_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
      };
      if (existingRecord?.id) {
        await axios.put(`/api/v1/nursing-records/discharge/${existingRecord.id}`, payload, { headers });
      } else {
        await axios.post('/api/v1/nursing-records/discharge', payload, { headers });
      }
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกข้อมูลการจำหน่ายสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาดในการบันทึก', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const patientName = patient?.ptname || patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  const sectionLabel = (icon: React.ReactNode, text: string, color: string) => (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-lg ${color} flex items-center justify-center text-white text-sm`}>{icon}</div>
      <span className="font-bold text-gray-700 text-sm">{text}</span>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-linear-to-r from-orange-500 to-red-400 rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiSignOutBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">บันทึกการจำหน่าย (Discharge Record)</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-white/90 text-sm font-semibold">{patientName}</span>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">HN: {patient?.hn || '-'}</Tag>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">AN: {an}</Tag>
                <span className="text-white/70 text-xs">เตียง {patient?.bed || patient?.bedno || '-'}</span>
                <span className="text-white/70 text-xs">Admit: {formattedAdmitDate}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="small" onClick={() => window.history.back()} className="border-white/30 text-white bg-white/10 hover:bg-white/20">ย้อนกลับ</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" description="กำลังโหลดข้อมูล..." /></div>
        ) : (
          <Form form={form} layout="vertical" onFinish={onFinish} size="small"
            className="[&_.ant-form-item]:mb-3 [&_.ant-form-item-label]:pb-0.5 [&_.ant-form-item-label_label]:text-gray-600 [&_.ant-form-item-label_label]:text-xs [&_.ant-form-item-label_label]:font-semibold"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column */}
              <div className="space-y-4">
                {/* Discharge Info */}
                <Card size="small" className="shadow-sm rounded-xl border border-gray-100"
                  title={sectionLabel(<PiSignOutBold />, 'ข้อมูลการจำหน่าย', 'bg-orange-500')}>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="วันที่/เวลาจำหน่าย" name="discharge_datetime">
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="ประเภทการจำหน่าย" name="discharge_type">
                        <Select placeholder="เลือก" options={dischargeTypes.map(d => ({ value: d.value, label: d.label }))} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="สภาพผู้ป่วยเมื่อจำหน่าย" name="discharge_condition">
                    <Select placeholder="เลือก" options={dischargeConditions.map(d => ({ value: d.value, label: d.label }))} />
                  </Form.Item>
                </Card>

                {/* Vital Signs at discharge */}
                <Card size="small" className="shadow-sm rounded-xl border border-gray-100"
                  title={sectionLabel(<PiHeartbeatBold />, 'สัญญาณชีพขณะจำหน่าย', 'bg-red-500')}>
                  <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                    <Row gutter={8}>
                      <Col span={5}><Form.Item label="T (°C)" name="vital_t" className="[&_.ant-form-item-label_label]:text-red-500!"><Input placeholder="36.5" /></Form.Item></Col>
                      <Col span={4}><Form.Item label="P" name="vital_p" className="[&_.ant-form-item-label_label]:text-red-500!"><Input placeholder="80" /></Form.Item></Col>
                      <Col span={4}><Form.Item label="R" name="vital_r" className="[&_.ant-form-item-label_label]:text-red-500!"><Input placeholder="20" /></Form.Item></Col>
                      <Col span={6}><Form.Item label="BP" name="vital_bp" className="[&_.ant-form-item-label_label]:text-red-500!"><Input placeholder="120/80" /></Form.Item></Col>
                      <Col span={5}><Form.Item label="O2Sat" name="vital_o2sat" className="[&_.ant-form-item-label_label]:text-red-500!"><Input placeholder="98%" /></Form.Item></Col>
                    </Row>
                  </div>
                </Card>

                {/* Discharge Summary */}
                <Card size="small" className="shadow-sm rounded-xl border border-gray-100"
                  title={sectionLabel(<PiCheckCircleBold />, 'สรุปการรักษา', 'bg-blue-500')}>
                  <Form.Item label="การวินิจฉัยสรุป" name="diagnosis_summary">
                    <TextArea rows={2} placeholder="สรุปการวินิจฉัย" />
                  </Form.Item>
                  <Form.Item label="สรุปการรักษา" name="treatment_summary">
                    <TextArea rows={2} placeholder="สรุปการรักษาที่ได้รับ" />
                  </Form.Item>
                  <Form.Item label="หัตถการที่ทำ" name="procedure_done">
                    <TextArea rows={1} placeholder="เช่น ผ่าตัด, ใส่ drain" />
                  </Form.Item>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                {/* Discharge Instructions */}
                <Card size="small" className="shadow-sm rounded-xl border border-gray-100"
                  title={sectionLabel(<PiBookOpenBold />, 'คำแนะนำเมื่อจำหน่าย', 'bg-emerald-500')}>
                  <Form.Item label="ยาที่ต้องรับประทาน" name="medication_instructions">
                    <TextArea rows={2} placeholder="ชื่อยา ขนาด วิธีรับประทาน" />
                  </Form.Item>
                  <Form.Item label="อาหาร" name="diet_instructions">
                    <Input placeholder="เช่น อาหารอ่อน งดของทอด" />
                  </Form.Item>
                  <Form.Item label="กิจกรรม/การปฏิบัติตัว" name="activity_instructions">
                    <TextArea rows={2} placeholder="เช่น พักผ่อน งดยกของหนัก 2 สัปดาห์" />
                  </Form.Item>
                  <Form.Item label="การดูแลแผล" name="wound_care_instructions">
                    <TextArea rows={2} placeholder="วิธีดูแลแผล ทำแผล" />
                  </Form.Item>
                  <Form.Item label="อาการผิดปกติที่ต้องมาพบแพทย์" name="warning_signs">
                    <TextArea rows={2} placeholder="เช่น ไข้สูง, แผลบวมแดง, ปวดมาก" />
                  </Form.Item>
                  <Form.Item label="นัดติดตาม" name="follow_up_appointment">
                    <Input placeholder="เช่น OPD ศัลยกรรม 7 วัน" />
                  </Form.Item>
                </Card>

                {/* Readiness Checklist */}
                <Card size="small" className="shadow-sm rounded-xl border border-gray-100"
                  title={sectionLabel(<PiCheckCircleBold />, 'Discharge Checklist', 'bg-violet-500')}>
                  <div className="space-y-2">
                    <Form.Item name="education_completed" valuePropName="checked" className="mb-0!">
                      <Checkbox>ให้ความรู้/สอนผู้ป่วยและญาติแล้ว</Checkbox>
                    </Form.Item>
                    <Form.Item name="medication_provided" valuePropName="checked" className="mb-0!">
                      <Checkbox>จ่ายยากลับบ้านแล้ว</Checkbox>
                    </Form.Item>
                    <Form.Item name="documents_given" valuePropName="checked" className="mb-0!">
                      <Checkbox>มอบเอกสาร/ใบนัด/ใบรับรองแพทย์แล้ว</Checkbox>
                    </Form.Item>
                    <Form.Item name="transportation_arranged" valuePropName="checked" className="mb-0!">
                      <Checkbox>จัดเตรียมการเดินทางกลับแล้ว</Checkbox>
                    </Form.Item>
                    <Form.Item name="referral_arranged" valuePropName="checked" className="mb-0!">
                      <Checkbox>จัดเตรียมการส่งต่อแล้ว (ถ้ามี)</Checkbox>
                    </Form.Item>
                  </div>
                </Card>

                {/* Caregiver / Nurse */}
                <Card size="small" className="shadow-sm rounded-xl border border-gray-100"
                  title={sectionLabel(<PiUserBold />, 'ผู้รับกลับ / ผู้บันทึก', 'bg-amber-500')}>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="จำหน่ายไปกับ" name="discharged_with">
                        <Select placeholder="เลือก">
                          <Option value="relative">ญาติ</Option>
                          <Option value="self">ตนเอง</Option>
                          <Option value="ambulance">รถพยาบาล</Option>
                          <Option value="refer_team">ทีมส่งต่อ</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="ชื่อผู้รับ" name="caregiver_name">
                        <Input placeholder="ระบุชื่อ" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="เบอร์โทร" name="caregiver_phone">
                        <Input placeholder="0xx-xxx-xxxx" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="สถานที่จำหน่ายไป" name="discharge_destination">
                    <Input placeholder="เช่น บ้าน, สถานพักฟื้น, รพ.อื่น" />
                  </Form.Item>
                  <Row gutter={12} align="bottom">
                    <Col span={8}>
                      <Form.Item label="พยาบาลผู้บันทึก" name="nurse_name">
                        <Input placeholder="ระบุชื่อ" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="วันที่/เวลาบันทึก" name="record_datetime">
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={8} className="flex items-end pb-2">
                      <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving}
                        className="bg-orange-500 hover:bg-orange-600 w-full shadow-lg" size="middle">
                        บันทึกข้อมูล
                      </Button>
                    </Col>
                  </Row>
                </Card>
              </div>
            </div>
          </Form>
        )}
      </div>
    </div>
  );
}
