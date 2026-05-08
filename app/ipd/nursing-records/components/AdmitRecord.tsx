'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Select, DatePicker, Button, Row, Col, Spin } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
import { getUserProfile } from '../../../lib/auth';
import { VscSave } from 'react-icons/vsc';
import { PiClipboardTextBold, PiHeartbeatBold, PiUserBold, PiUsersFourBold, PiNotePencilBold } from 'react-icons/pi';

const { TextArea } = Input;
const { Option } = Select;

interface PatientInfo {
  admission_list_id: number;
  hn: string;
  an: string;
  name?: string;
  patient_name?: string;
  ptname?: string;
  age?: number;
  gender?: string;
  sex?: string;
  ward?: string;
  wardName?: string;
  bed?: string;
  bedno?: string;
  admitDateTimeIso?: string;
  reg_datetime?: string;
  spcltyName?: string;
  spclty_name?: string;
  doctorName?: string;
  incharge_doctor?: string;
  admission_type_name?: string;
  birth_date?: string;
  before_ward?: string;
}

interface AdmitRecordData {
  id?: number;
  admission_list_id?: number;
  an: string;
  admit_from?: string;
  admit_method?: string;
  admit_reason?: string;
  chief_complaint?: string;
  present_illness?: string;
  past_illness?: string;
  allergies?: string;
  current_medications?: string;
  consciousness?: string;
  vital_t?: string;
  vital_p?: string;
  vital_r?: string;
  vital_bp?: string;
  vital_o2sat?: string;
  weight?: string;
  height?: string;
  bmi?: string;
  pain_score?: number;
  nutrition_screening?: string;
  diagnosis_summary?: string;
  treatment_summary?: string;
  general_appearance?: string;
  skin_condition?: string;
  mobility?: string;
  communication?: string;
  religion?: string;
  occupation?: string;
  caregiver_name?: string;
  caregiver_relation?: string;
  caregiver_phone?: string;
  nursing_diagnosis?: string;
  nursing_plan?: string;
  nurse_name?: string;
  record_datetime?: string;
}

function SectionCard({
  icon,
  title,
  accentColor,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200"
      style={{ border: '1px solid #f0f0f0', borderLeft: `4px solid ${accentColor}` }}
    >
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm shrink-0"
          style={{ background: accentColor }}
        >
          {icon}
        </div>
        <span className="font-bold text-gray-700 text-sm">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function AdmitRecord({ an }: { an: string }) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [existingRecord, setExistingRecord] = useState<AdmitRecordData | null>(null);

  const getHeaders = useCallback(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = getHeaders();
        const patientRes = await axios.post('/api/v1/patients/by-an', { an }, { headers });
        if (patientRes.data?.success && patientRes.data.data) {
          const p = Array.isArray(patientRes.data.data) ? patientRes.data.data[0] : patientRes.data.data;
          setPatient(p);
        }
        try {
          const recordRes = await axios.get(`/api/v1/nursing-records/admit/${an}`, { headers });
          if (recordRes.data?.success && recordRes.data.data) {
            const raw = recordRes.data.data;
            const record = Array.isArray(raw) ? raw[0] : raw;
            if (!record) throw new Error('no record');
            setExistingRecord(record);
          }
        } catch {
          // ไม่มีข้อมูลเดิม — ใช้ค่า default
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [an, getHeaders, form]);

  useEffect(() => {
    if (loading) return;
    if (existingRecord) {
      form.setFieldsValue({
        ...existingRecord,
        nurse_name: existingRecord.nurse_name || getUserProfile()?.fullname || '',
        pain_score: existingRecord.pain_score !== null && existingRecord.pain_score !== undefined ? Number(existingRecord.pain_score) : undefined,
        record_datetime: existingRecord.record_datetime ? dayjs(existingRecord.record_datetime) : dayjs(),
      });
    } else {
      form.setFieldsValue({ record_datetime: dayjs(), nurse_name: getUserProfile()?.fullname || '' });
    }
  }, [loading, existingRecord, form]);

  const calculateBMI = () => {
    const weight = parseFloat(form.getFieldValue('weight'));
    const height = parseFloat(form.getFieldValue('height'));
    if (weight > 0 && height > 0) {
      const heightM = height / 100;
      const bmi = (weight / (heightM * heightM)).toFixed(1);
      form.setFieldsValue({ bmi });
    }
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const headers = getHeaders();
      const payload: any = {
        ...values,
        an,
        admission_list_id: patient?.admission_list_id ?? null,
        ward_code: patient?.ward || getUserProfile()?.ward_code || '',
        ward_name: patient?.wardName || getUserProfile()?.ward_name || '',
        id: getUserProfile()?.id || null,
        staff_id: String(getUserProfile()?.id || ''),
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
        vital_t: values.vital_t ? parseFloat(values.vital_t) : null,
        vital_p: values.vital_p ? parseInt(values.vital_p, 10) : null,
        vital_r: values.vital_r ? parseInt(values.vital_r, 10) : null,
        vital_o2sat: values.vital_o2sat ? parseInt(String(values.vital_o2sat).replace('%', ''), 10) : null,
        weight: values.weight ? parseFloat(values.weight) : null,
        height: values.height ? parseFloat(values.height) : null,
        bmi: values.bmi ? parseFloat(values.bmi) : null,
        pain_score: values.pain_score !== undefined && values.pain_score !== null ? Number(values.pain_score) : null,
      };

      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) payload[key] = null;
      });

      console.log('AdmitRecord Payload:', payload);
      const response = await axios.post('/api/v1/nursing-records/admit', payload, { headers });
      console.log('API Response:', response.data);
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกข้อมูลการรับผู้ป่วยสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const patientName = patient?.ptname || patient?.name || patient?.patient_name || '-';
  const admitDate = patient?.admitDateTimeIso || patient?.reg_datetime;
  const formattedAdmitDate = admitDate ? dayjs(admitDate).format('DD/MM/YYYY HH:mm') : '-';

  const InfoChip = ({ label, value }: { label: string; value: string }) => (
    <span className="flex items-center gap-1 text-xs">
      <span className="text-white/55">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </span>
  );

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-4 max-w-7xl mx-auto">

        {/* Header */}
        <div className="bg-linear-to-r from-[#006b5f] to-[#00897b] rounded-xl shadow-lg mb-4 px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <PiClipboardTextBold className="text-white text-xl" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-white m-0 leading-tight">แบบบันทึกการรับผู้ป่วย</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                  <span className="text-white font-semibold text-sm">{patientName}</span>
                  <span className="text-white/40 hidden sm:inline">|</span>
                  <InfoChip label="HN:" value={patient?.hn || '-'} />
                  <InfoChip label="AN:" value={an} />
                  <InfoChip label="เตียง:" value={patient?.bed || patient?.bedno || '-'} />
                  <InfoChip label="Ward:" value={patient?.wardName || patient?.ward || '-'} />
                  <InfoChip label="แพทย์:" value={patient?.doctorName || patient?.incharge_doctor || '-'} />
                  <InfoChip label="Admit:" value={formattedAdmitDate} />
                </div>
              </div>
            </div>
            <Button
              size="small"
              onClick={() => window.history.back()}
              className="border-white/30! text-white! bg-white/10! hover:bg-white/20! shrink-0"
            >
              ย้อนกลับ
            </Button>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          size="small"
          className="[&_.ant-form-item]:mb-3 [&_.ant-form-item-label]:pb-0.5 [&_.ant-form-item-label_label]:text-gray-600 [&_.ant-form-item-label_label]:text-xs [&_.ant-form-item-label_label]:font-semibold"
        >
          {loading ? (
            <div className="flex justify-center py-20">
              <Spin size="large" />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* ── Left Column ── */}
              <div className="space-y-4">

                {/* ข้อมูลการรับเข้า */}
                <SectionCard icon={<PiClipboardTextBold />} title="ข้อมูลการรับเข้า" accentColor="#006b5f">
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="รับจาก" name="admit_from">
                        <Select placeholder="เลือก">
                          <Option value="ER">ER</Option>
                          <Option value="OPD">OPD</Option>
                          <Option value="OR">OR</Option>
                          <Option value="ICU">ICU</Option>
                          <Option value="WARD">Ward อื่น</Option>
                          <Option value="REFER">Refer</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="วิธีการมา" name="admit_method">
                        <Select placeholder="เลือก">
                          <Option value="walk">เดินมาเอง</Option>
                          <Option value="wheelchair">Wheelchair</Option>
                          <Option value="stretcher">Stretcher</Option>
                          <Option value="ambulance">รถพยาบาล</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="สาเหตุการรับเข้า" name="admit_reason">
                    <Input placeholder="ระบุสาเหตุ" />
                  </Form.Item>
                  <Form.Item label="Chief Complaint" name="chief_complaint">
                    <TextArea rows={1} placeholder="อาการสำคัญ" />
                  </Form.Item>
                  <Form.Item label="Present Illness" name="present_illness">
                    <TextArea rows={2} placeholder="ประวัติเจ็บป่วยปัจจุบัน" />
                  </Form.Item>
                  <Form.Item label="Past Illness" name="past_illness">
                    <TextArea rows={1} placeholder="โรคประจำตัว / ประวัติผ่าตัด" />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="แพ้ยา / อาหาร" name="allergies">
                        <Input placeholder="ระบุ หรือ 'ไม่มี'" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="ยาที่ใช้ปัจจุบัน" name="current_medications">
                        <Input placeholder="ระบุยาที่ใช้อยู่" />
                      </Form.Item>
                    </Col>
                  </Row>
                </SectionCard>

                {/* สภาพทั่วไป / สังคม */}
                <SectionCard icon={<PiUserBold />} title="สภาพทั่วไป / สังคม" accentColor="#7c3aed">
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="ลักษณะทั่วไป" name="general_appearance">
                        <Select placeholder="เลือก">
                          <Option value="good">ดี</Option>
                          <Option value="fair">พอใช้</Option>
                          <Option value="poor">ไม่ดี</Option>
                          <Option value="critical">วิกฤต</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="ผิวหนัง" name="skin_condition">
                        <Select placeholder="เลือก">
                          <Option value="normal">ปกติ</Option>
                          <Option value="dry">แห้ง</Option>
                          <Option value="edema">บวม</Option>
                          <Option value="wound">มีแผล</Option>
                          <Option value="rash">ผื่น</Option>
                          <Option value="jaundice">ตัวเหลือง</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="การเคลื่อนไหว" name="mobility">
                        <Select placeholder="เลือก">
                          <Option value="independent">ทำเอง</Option>
                          <Option value="assist">มีผู้ช่วย</Option>
                          <Option value="bedridden">ติดเตียง</Option>
                          <Option value="wheelchair">รถเข็น</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="การสื่อสาร" name="communication">
                        <Select placeholder="เลือก">
                          <Option value="normal">ปกติ</Option>
                          <Option value="difficulty">ลำบาก</Option>
                          <Option value="unable">ไม่ได้</Option>
                          <Option value="interpreter">ต้องการล่าม</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="ศาสนา" name="religion">
                        <Select placeholder="เลือก">
                          <Option value="buddhism">พุทธ</Option>
                          <Option value="islam">อิสลาม</Option>
                          <Option value="christianity">คริสต์</Option>
                          <Option value="other">อื่นๆ</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="อาชีพ" name="occupation">
                        <Input placeholder="ระบุ" />
                      </Form.Item>
                    </Col>
                  </Row>
                </SectionCard>
              </div>

              {/* ── Right Column ── */}
              <div className="space-y-4">

                {/* การประเมินแรกรับ */}
                <SectionCard icon={<PiHeartbeatBold />} title="การประเมินแรกรับ (Initial Assessment)" accentColor="#ef4444">
                  {/* Vital Signs */}
                  <div className="rounded-xl p-3 mb-3 border border-red-100 bg-red-50/70">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Vital Signs</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      <Form.Item label="T (°C)" name="vital_t" className="[&_.ant-form-item-label_label]:text-red-500! mb-0!">
                        <Input placeholder="36.5" className="bg-white!" />
                      </Form.Item>
                      <Form.Item label="P (bpm)" name="vital_p" className="[&_.ant-form-item-label_label]:text-red-500! mb-0!">
                        <Input placeholder="80" className="bg-white!" />
                      </Form.Item>
                      <Form.Item label="R (/min)" name="vital_r" className="[&_.ant-form-item-label_label]:text-red-500! mb-0!">
                        <Input placeholder="20" className="bg-white!" />
                      </Form.Item>
                      <Form.Item label="BP (mmHg)" name="vital_bp" className="[&_.ant-form-item-label_label]:text-red-500! mb-0!">
                        <Input placeholder="120/80" className="bg-white!" />
                      </Form.Item>
                      <Form.Item label="O2Sat (%)" name="vital_o2sat" className="[&_.ant-form-item-label_label]:text-red-500! mb-0!">
                        <Input placeholder="98" className="bg-white!" />
                      </Form.Item>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="ความรู้สึกตัว" name="consciousness">
                        <Select placeholder="เลือก">
                          <Option value="alert">Alert</Option>
                          <Option value="drowsy">Drowsy</Option>
                          <Option value="stupor">Stupor</Option>
                          <Option value="coma">Coma</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Pain Score (0-10)" name="pain_score">
                        <Select placeholder="เลือก">
                          {[...Array(11)].map((_, i) => <Option key={i} value={i}>{i}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Nutrition" name="nutrition_screening">
                        <Select placeholder="เลือก">
                          <Option value="normal">ปกติ</Option>
                          <Option value="risk">เสี่ยง</Option>
                          <Option value="malnutrition">ขาดสารอาหาร</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Body Measurement */}
                  <div className="rounded-xl p-3 border border-blue-100 bg-blue-50/70">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Body Measurement</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Form.Item label="น้ำหนัก (kg)" name="weight" className="mb-0!">
                        <Input placeholder="60" onChange={calculateBMI} className="bg-white!" />
                      </Form.Item>
                      <Form.Item label="ส่วนสูง (cm)" name="height" className="mb-0!">
                        <Input placeholder="165" onChange={calculateBMI} className="bg-white!" />
                      </Form.Item>
                      <Form.Item label="BMI" name="bmi" className="mb-0!">
                        <Input readOnly className="bg-white! font-bold! text-[#006b5f]!" />
                      </Form.Item>
                    </div>
                  </div>
                </SectionCard>

                {/* ผู้ดูแล / ญาติ */}
                <SectionCard icon={<PiUsersFourBold />} title="ผู้ดูแล / ญาติ" accentColor="#f59e0b">
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item label="ชื่อผู้ดูแล" name="caregiver_name">
                        <Input placeholder="ระบุชื่อ" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="ความสัมพันธ์" name="caregiver_relation">
                        <Select placeholder="เลือก">
                          <Option value="spouse">คู่สมรส</Option>
                          <Option value="parent">บิดา/มารดา</Option>
                          <Option value="child">บุตร</Option>
                          <Option value="sibling">พี่น้อง</Option>
                          <Option value="relative">ญาติ</Option>
                          <Option value="other">อื่นๆ</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="เบอร์โทร" name="caregiver_phone">
                        <Input placeholder="0xx-xxx-xxxx" />
                      </Form.Item>
                    </Col>
                  </Row>
                </SectionCard>

                {/* การวินิจฉัยและแผนการรักษา/พยาบาล */}
                <SectionCard icon={<PiNotePencilBold />} title="การวินิจฉัยและแผนการรักษา/พยาบาล" accentColor="#6366f1">
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="สรุปการวินิจฉัยโรค (Diagnosis Summary)" name="diagnosis_summary">
                        <TextArea rows={2} placeholder="ระบุสรุปการวินิจฉัยโรคจากแพทย์" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="สรุปแผนการรักษา (Treatment Summary)" name="treatment_summary">
                        <TextArea rows={2} placeholder="ระบุสรุปแผนการรักษาของแพทย์" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item label="ข้อวินิจฉัยทางการพยาบาล" name="nursing_diagnosis">
                        <TextArea rows={2} placeholder="ระบุข้อวินิจฉัย" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="แผนการพยาบาล" name="nursing_plan">
                        <TextArea rows={2} placeholder="ระบุแผนการพยาบาล" />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Footer: nurse + datetime + save */}
                  <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-gray-100">
                    <div className="flex-1 min-w-36">
                      <Form.Item label="พยาบาลผู้บันทึก" name="nurse_name" className="mb-0!">
                        <Input placeholder="ระบุชื่อ" />
                      </Form.Item>
                    </div>
                    <div className="flex-1 min-w-44">
                      <Form.Item label="วันที่/เวลา" name="record_datetime" className="mb-0!">
                        <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
                      </Form.Item>
                    </div>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<VscSave />}
                      loading={saving}
                      size="middle"
                      className="bg-[#006b5f]! hover:bg-[#00554c]! border-none! shadow-lg px-6"
                    >
                      บันทึกข้อมูล
                    </Button>
                  </div>
                </SectionCard>

              </div>
            </div>
          )}
        </Form>
      </div>
    </div>
  );
}
