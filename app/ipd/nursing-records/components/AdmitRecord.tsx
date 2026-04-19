'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Row, Col, Spin, Tag, Collapse } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import Navbar from '../../../components/Navbar';
import Swal from 'sweetalert2';
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
  fall_risk?: string;
  nutrition_screening?: string;
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
        const patientRes = await axios.get(`/api/v1/view-patient-by-an/${an}`, { headers });
        if (patientRes.data?.success && patientRes.data.data) {
          const p = Array.isArray(patientRes.data.data) ? patientRes.data.data[0] : patientRes.data.data;
          setPatient(p);
        }
        try {
          const recordRes = await axios.get(`/api/v1/nursing-records/admit/${an}`, { headers });
          if (recordRes.data?.success && recordRes.data.data) {
            const record = recordRes.data.data;
            setExistingRecord(record);
            form.setFieldsValue({
              ...record,
              record_datetime: record.record_datetime ? dayjs(record.record_datetime) : dayjs(),
            });
          }
        } catch {
          form.setFieldsValue({ record_datetime: dayjs() });
        }
      } catch (error) {
        console.error('Error fetching patient data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [an, getHeaders, form]);

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
      const payload: AdmitRecordData = {
        ...values,
        an,
        admission_list_id: patient?.admission_list_id,
        record_datetime: values.record_datetime ? dayjs(values.record_datetime).format('YYYY-MM-DD HH:mm:ss') : dayjs().format('YYYY-MM-DD HH:mm:ss'),
      };
      if (existingRecord?.id) {
        await axios.put(`/api/v1/nursing-records/admit/${existingRecord.id}`, payload, { headers });
      } else {
        await axios.post('/api/v1/nursing-records/admit', payload, { headers });
      }
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกข้อมูลการรับผู้ป่วยสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setSaving(false);
    }
  };

  const patientName = patient?.name || patient?.patient_name || '-';
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
        <div className="bg-linear-to-r from-[#006b5f] to-[#00897b] rounded-xl shadow-lg mb-4 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <PiClipboardTextBold className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white m-0">แบบบันทึกการรับผู้ป่วย</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-white/90 text-sm font-semibold">{patientName}</span>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">HN: {patient?.hn || '-'}</Tag>
                <Tag className="border-none bg-white/20 text-white m-0 text-xs">AN: {an}</Tag>
                <span className="text-white/70 text-xs">เตียง {patient?.bed || patient?.bedno || '-'}</span>
                <span className="text-white/70 text-xs">Admit: {formattedAdmitDate}</span>
                <span className="text-white/70 text-xs">{patient?.doctorName || patient?.incharge_doctor || ''}</span>
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
              <div className="space-y-6">
                {/* ข้อมูลการรับเข้า */}
                <Card size="small" className="shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow"
                  title={sectionLabel(<PiClipboardTextBold />, 'ข้อมูลการรับเข้า', 'bg-[#006b5f]')}>
                  <Row gutter={12}>
                    <Col span={12}><Form.Item label="รับจาก" name="admit_from"><Select placeholder="เลือก">
                      <Option value="ER">ER</Option><Option value="OPD">OPD</Option><Option value="OR">OR</Option><Option value="ICU">ICU</Option><Option value="WARD">Ward อื่น</Option><Option value="REFER">Refer</Option>
                    </Select></Form.Item></Col>
                    <Col span={12}><Form.Item label="วิธีการมา" name="admit_method"><Select placeholder="เลือก">
                      <Option value="walk">เดินมาเอง</Option><Option value="wheelchair">Wheelchair</Option><Option value="stretcher">Stretcher</Option><Option value="ambulance">รถพยาบาล</Option>
                    </Select></Form.Item></Col>
                  </Row>
                  <Form.Item label="สาเหตุการรับเข้า" name="admit_reason"><Input placeholder="ระบุสาเหตุ" /></Form.Item>
                  <Form.Item label="Chief Complaint" name="chief_complaint"><TextArea rows={1} placeholder="อาการสำคัญ" /></Form.Item>
                  <Form.Item label="Present Illness" name="present_illness"><TextArea rows={2} placeholder="ประวัติเจ็บป่วยปัจจุบัน" /></Form.Item>
                  <Form.Item label="Past Illness" name="past_illness"><TextArea rows={1} placeholder="โรคประจำตัว / ประวัติผ่าตัด" /></Form.Item>
                  <Row gutter={12}>
                    <Col span={12}><Form.Item label="แพ้ยา / อาหาร" name="allergies"><Input placeholder="ระบุ หรือ 'ไม่มี'" /></Form.Item></Col>
                    <Col span={12}><Form.Item label="ยาที่ใช้ปัจจุบัน" name="current_medications"><Input placeholder="ระบุยาที่ใช้อยู่" /></Form.Item></Col>
                  </Row>
                </Card>

                {/* สภาพทั่วไป / สังคม */}
                <Card size="small" className="shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow"
                  title={sectionLabel(<PiUserBold />, 'สภาพทั่วไป / สังคม', 'bg-violet-500')}>
                  <Row gutter={12}>
                    <Col span={8}><Form.Item label="ลักษณะทั่วไป" name="general_appearance"><Select placeholder="เลือก">
                      <Option value="good">ดี</Option><Option value="fair">พอใช้</Option><Option value="poor">ไม่ดี</Option><Option value="critical">วิกฤต</Option>
                    </Select></Form.Item></Col>
                    <Col span={8}><Form.Item label="ผิวหนัง" name="skin_condition"><Select placeholder="เลือก">
                      <Option value="normal">ปกติ</Option><Option value="dry">แห้ง</Option><Option value="edema">บวม</Option><Option value="wound">มีแผล</Option><Option value="rash">ผื่น</Option><Option value="jaundice">ตัวเหลือง</Option>
                    </Select></Form.Item></Col>
                    <Col span={8}><Form.Item label="การเคลื่อนไหว" name="mobility"><Select placeholder="เลือก">
                      <Option value="independent">ทำเอง</Option><Option value="assist">มีผู้ช่วย</Option><Option value="bedridden">ติดเตียง</Option><Option value="wheelchair">รถเข็น</Option>
                    </Select></Form.Item></Col>
                  </Row>
                  <Row gutter={12}>
                    <Col span={8}><Form.Item label="การสื่อสาร" name="communication"><Select placeholder="เลือก">
                      <Option value="normal">ปกติ</Option><Option value="difficulty">ลำบาก</Option><Option value="unable">ไม่ได้</Option><Option value="interpreter">ต้องการล่าม</Option>
                    </Select></Form.Item></Col>
                    <Col span={8}><Form.Item label="ศาสนา" name="religion"><Select placeholder="เลือก">
                      <Option value="buddhism">พุทธ</Option><Option value="islam">อิสลาม</Option><Option value="christianity">คริสต์</Option><Option value="other">อื่นๆ</Option>
                    </Select></Form.Item></Col>
                    <Col span={8}><Form.Item label="อาชีพ" name="occupation"><Input placeholder="ระบุ" /></Form.Item></Col>
                  </Row>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* การประเมินแรกรับ */}
                <Card size="small" className="shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow"
                  title={sectionLabel(<PiHeartbeatBold />, 'การประเมินแรกรับ (Initial Assessment)', 'bg-red-500')}>
                  <div className="bg-red-50 rounded-lg p-3 mb-2 border border-red-100">
                    <div className="text-xs text-red-400 font-semibold mb-1.5">Vital Signs</div>
                    <Row gutter={8}>
                      <Col span={5}><Form.Item label="T (°C)" name="vital_t" className="[&_.ant-form-item-label_label]:text-red-500!"><Input placeholder="36.5" /></Form.Item></Col>
                      <Col span={4}><Form.Item label="P" name="vital_p" className="[&_.ant-form-item-label_label]:text-red-500!"><Input placeholder="80" /></Form.Item></Col>
                      <Col span={4}><Form.Item label="R" name="vital_r" className="[&_.ant-form-item-label_label]:text-red-500!"><Input placeholder="20" /></Form.Item></Col>
                      <Col span={6}><Form.Item label="BP" name="vital_bp" className="[&_.ant-form-item-label_label]:text-red-500!"><Input placeholder="120/80" /></Form.Item></Col>
                      <Col span={5}><Form.Item label="O2Sat" name="vital_o2sat" className="[&_.ant-form-item-label_label]:text-red-500!"><Input placeholder="98%" /></Form.Item></Col>
                    </Row>
                  </div>
                  <Row gutter={12}>
                    <Col span={6}><Form.Item label="ความรู้สึกตัว" name="consciousness"><Select placeholder="เลือก">
                      <Option value="alert">Alert</Option><Option value="drowsy">Drowsy</Option><Option value="stupor">Stupor</Option><Option value="coma">Coma</Option>
                    </Select></Form.Item></Col>
                    <Col span={6}><Form.Item label="Pain (0-10)" name="pain_score"><Select placeholder="เลือก">
                      {[...Array(11)].map((_, i) => <Option key={i} value={i}>{i}</Option>)}
                    </Select></Form.Item></Col>
                    <Col span={6}><Form.Item label="Fall Risk" name="fall_risk"><Select placeholder="เลือก">
                      <Option value="low">Low</Option><Option value="moderate">Moderate</Option><Option value="high">High</Option>
                    </Select></Form.Item></Col>
                    <Col span={6}><Form.Item label="Nutrition" name="nutrition_screening"><Select placeholder="เลือก">
                      <Option value="normal">ปกติ</Option><Option value="risk">เสี่ยง</Option><Option value="malnutrition">ขาดสารอาหาร</Option>
                    </Select></Form.Item></Col>
                  </Row>
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <div className="text-xs text-blue-400 font-semibold mb-0.5">Body Measurement</div>
                    <Row gutter={8}>
                      <Col span={8}><Form.Item label="น้ำหนัก (kg)" name="weight"><Input placeholder="60" onChange={calculateBMI} /></Form.Item></Col>
                      <Col span={8}><Form.Item label="ส่วนสูง (cm)" name="height"><Input placeholder="165" onChange={calculateBMI} /></Form.Item></Col>
                      <Col span={8}><Form.Item label="BMI" name="bmi"><Input readOnly className="bg-white font-bold text-[#006b5f]" /></Form.Item></Col>
                    </Row>
                  </div>
                </Card>

                {/* ผู้ดูแล / ญาติ */}
                <Card size="small" className="shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow"
                  title={sectionLabel(<PiUsersFourBold />, 'ผู้ดูแล / ญาติ', 'bg-amber-500')}>
                  <Row gutter={12}>
                    <Col span={8}><Form.Item label="ชื่อผู้ดูแล" name="caregiver_name"><Input placeholder="ระบุชื่อ" /></Form.Item></Col>
                    <Col span={8}><Form.Item label="ความสัมพันธ์" name="caregiver_relation"><Select placeholder="เลือก">
                      <Option value="spouse">คู่สมรส</Option><Option value="parent">บิดา/มารดา</Option><Option value="child">บุตร</Option><Option value="sibling">พี่น้อง</Option><Option value="relative">ญาติ</Option><Option value="other">อื่นๆ</Option>
                    </Select></Form.Item></Col>
                    <Col span={8}><Form.Item label="เบอร์โทร" name="caregiver_phone"><Input placeholder="0xx-xxx-xxxx" /></Form.Item></Col>
                  </Row>
                </Card>

                {/* แผนการพยาบาล / ผู้บันทึก */}
                <Card size="small" className="shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow"
                  title={sectionLabel(<PiNotePencilBold />, 'แผนการพยาบาล / ผู้บันทึก', 'bg-indigo-500')}>
                  <Row gutter={12}>
                    <Col span={12}><Form.Item label="ข้อวินิจฉัยทางการพยาบาล" name="nursing_diagnosis"><TextArea rows={2} placeholder="ระบุข้อวินิจฉัย" /></Form.Item></Col>
                    <Col span={12}><Form.Item label="แผนการพยาบาล" name="nursing_plan"><TextArea rows={2} placeholder="ระบุแผนการพยาบาล" /></Form.Item></Col>
                  </Row>
                  <Row gutter={12} align="bottom">
                    <Col span={8}><Form.Item label="พยาบาลผู้บันทึก" name="nurse_name"><Input placeholder="ระบุชื่อ" /></Form.Item></Col>
                    <Col span={8}><Form.Item label="วันที่/เวลา" name="record_datetime"><DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" /></Form.Item></Col>
                    <Col span={8} className="flex items-end pb-2">
                      <Button type="primary" htmlType="submit" icon={<VscSave />} loading={saving} className="bg-[#006b5f] hover:bg-[#00554c] w-full shadow-lg" size="middle">
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
