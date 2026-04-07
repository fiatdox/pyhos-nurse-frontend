'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Button, Table, Drawer, Form, Select, DatePicker, message, Row, Col, Typography, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import Navbar from '../../components/Navbar';
import { VscSearch, VscSave } from "react-icons/vsc";
import Swal from 'sweetalert2';

dayjs.locale('th');

const { Title, Text } = Typography;
const { Option } = Select;

// --- Interfaces ---
interface Patient {
  hn: string;
  an: string;
  ptname: string;
  bedno?: string;
  doctor_name?: string;
  regdate?: string;
  ward?: string;
  gender?: string;
  birthday?: string;
}

interface AdmissionType {
  admission_type_id: number;
  admission_type_name: string;
}

interface Specialty {
  spclty: string;
  name: string;
}

interface Ward {
  ward: string | number;
  name?: string;
  ward_name?: string;
  his_code?: string;
  is_labor_room?: string | null;
}

interface ShiftType {
  admission_change_shift_type_id: number;
  shift_name: string;
}

interface SeverityLevel {
  severity_level_id: number;
  severity_level_name: string;
}

// ✅ interface ตรงกับ Elysia Backend schema ทุก field
//
// กฎ Elysia Type:
//   t.String()                                    → required, ห้าม null/undefined
//   t.Optional(t.String())                        → string | undefined   ⚠️ ห้ามส่ง null!
//   t.Optional(t.Union([t.String(), t.Null()]))   → string | null | undefined  ✅ ส่ง null ได้
//
interface RegisterPayload {
  // required
  an: string;
  hn: string;
  patient_name: string;
  reg_datetime: string;
  before_ward?: string | null;
  ward: string;
  // Optional(Union(...Null)) → null ได้
  birth_date?: string | null;
  spclty?: string | null;
  admission_type_id?: number | null;
  status?: number | string | null;
  serverity_level_id?: number | null;
  severity_level_id?: number | null;
  gender?: string | null;
  bedno?: string | null;
  // Optional(String) → ห้ามส่ง null! ใช้ spread omit เมื่อไม่มีค่า
  incharge_doctor?: string;
  is_ventilator?: string;
  oxygen_support_type?: number | null;
  admission_change_shift_type_id?: number | null;
}

export default function RegisterPage() {
  const [form] = Form.useForm();
  const router = useRouter();

  // ✅ ย้าย useState ทั้งหมดขึ้นก่อน useMemo เพื่อป้องกัน "used before declaration"
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [anInput, setAnInput] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const [admissionTypes, setAdmissionTypes] = useState<AdmissionType[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [severityLevels, setSeverityLevels] = useState<SeverityLevel[]>([]);

  const severityLevelValue = Form.useWatch('severityLevelId', form);
  const admissionTypeIdValue = Form.useWatch('admissionTypeId', form);
  const isVentilatorValue = Form.useWatch('isVentilator', form);
  const wardIdValue = Form.useWatch('wardId', form);

  // ✅ declare isLaborRoom เพียงครั้งเดียว (ลบอันซ้ำออก)
  const isLaborRoom = useMemo(() => {
    const selected = wards.find(w => String(w.his_code) === String(wardIdValue) || String(w.ward) === String(wardIdValue));
    return selected?.is_labor_room === 'Y';
  }, [wardIdValue, wards]);

  // --- Fetch Dropdown Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [admTypeRes, spcltyRes, wardRes, shiftRes, severityRes] = await Promise.all([
          axios.get('/api/v1/admission-types', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/spclty', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/wardsV1', { headers }).catch(() => axios.get('/api/v1/wards', { headers }).catch(() => ({ data: { data: [] } }))),
          axios.get('/api/v1/admission-change-shift-types', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/admission-severity-levels', { headers }).catch(() => ({ data: { data: [] } })),
        ]);

        setAdmissionTypes(admTypeRes.data.data || []);
        setSpecialties(spcltyRes.data.data || []);
        const wardList = Array.isArray(wardRes.data) ? wardRes.data : wardRes.data.data || [];
        setWards(wardList);
        setShiftTypes(shiftRes.data.data || []);
        setSeverityLevels(severityRes.data.data || []);
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
        mockDropdownData();
      }
    };
    fetchData();
  }, []);

  const mockDropdownData = () => {
    setAdmissionTypes([
      { admission_type_id: 1, admission_type_name: 'รับใหม่' },
      { admission_type_id: 2, admission_type_name: 'รับย้ายจากหอผู้ป่วยอื่น' },
    ]);
    setSpecialties([
      { spclty: '01', name: 'กุมารเวชกรรม' },
      { spclty: '05', name: 'ศัลยกรรม' },
      { spclty: '09', name: 'อายุรกรรม' },
    ]);
    setShiftTypes([
      { admission_change_shift_type_id: 1, shift_name: 'ดึก' },
      { admission_change_shift_type_id: 2, shift_name: 'เช้า' },
      { admission_change_shift_type_id: 3, shift_name: 'บ่าย' },
    ]);
    setSeverityLevels([
      { severity_level_id: 1, severity_level_name: 'ผู้ป่วยทั่วไป / อาการดี' },
      { severity_level_id: 2, severity_level_name: 'ผู้ป่วยต้องช่วยเหลือบางส่วน' },
      { severity_level_id: 3, severity_level_name: 'ผู้ป่วยมีอาการปานกลาง' },
      { severity_level_id: 4, severity_level_name: 'ผู้ป่วยอาการหนัก ต้องการดูแลพิเศษ' },
      { severity_level_id: 5, severity_level_name: 'ผู้ป่วยวิกฤติ (Critical)' },
    ]);
  };

  // --- Ward Change ---
  const handleWardChange = async (ward: string) => {
    setSelectedWard(ward);
    setLoading(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post('/api/v1/patients-list-by-ward', { ward }, { headers });
      if (response.data.success && Array.isArray(response.data.data)) {
        setPatients(response.data.data);
      } else if (Array.isArray(response.data)) {
        setPatients(response.data);
      } else {
        setPatients([]);
        message.info('ไม่พบผู้ป่วยใน Ward นี้');
      }
    } catch (error) {
      console.error('Error fetching patients by ward:', error);
      message.error('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย');
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Swal.fire({
          icon: 'error',
          title: 'เซสชันหมดอายุ',
          text: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
          confirmButtonText: 'ตกลง',
        }).then(() => router.push('/'));
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Check Labor Room on Ward Change ---
  const handleDrawerWardChange = (value: string) => {
    const selectedWardObj = wards.find(w => String(w.his_code) === String(value) || String(w.ward) === String(value));
    if (selectedWardObj && selectedWardObj.is_labor_room === 'Y') {
      Swal.fire({
        icon: 'info',
        title: 'แจ้งเตือนห้องคลอด',
        text: 'หอผู้ป่วยที่เลือกเป็นห้องคลอด (Labor Room)',
        confirmButtonColor: '#006b5f',
        confirmButtonText: 'รับทราบ',
      });
    }
    // รีเซตค่าทุกครั้งที่เปลี่ยนตึก เพื่อป้องกันค่าหลุดข้าม mode (labor ↔ non-labor)
    form.setFieldsValue({
      isVentilator: 'N',
      oxygenSupportType: 1,
    });
  };

  // --- Search ---
  const handleSearch = async () => {
    if (!anInput) { message.warning('กรุณากรอกเลข AN'); return; }
    setLoading(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post('/api/v1/patient-by-an', { an: anInput }, { headers });
      if (response.data.success && response.data.data) {
        setPatients(response.data.data);
        if (response.data.data.length === 0) {
          message.info('ไม่พบข้อมูลผู้ป่วยสำหรับ AN นี้');
        } else {
          openRegisterDrawer(response.data.data[0]);
        }
      } else {
        message.error('ไม่สามารถดึงข้อมูลผู้ป่วยได้');
        setPatients([]);
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      message.error('เกิดข้อผิดพลาดในการค้นหาผู้ป่วย');
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        Swal.fire({
          icon: 'error',
          title: 'เซสชันหมดอายุ',
          text: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
          confirmButtonText: 'ตกลง',
        }).then(() => router.push('/'));
      }
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  // --- Shift helper ---
  const getShiftIdFromTime = (date: dayjs.Dayjs) => {
    const h = date.hour();
    if (h >= 8 && h < 16) return 2; // เช้า
    if (h >= 16) return 3;           // บ่าย
    return 1;                         // ดึก
  };

  const handleAdmitDateChange = (date: dayjs.Dayjs | null) => {
    if (date) form.setFieldsValue({ shiftTypeId: getShiftIdFromTime(date) });
  };

  // --- Open / Close Drawer ---
  const openRegisterDrawer = (patient: Patient) => {
    setSelectedPatient(patient);
    form.resetFields();
    const admitDate = patient.regdate ? dayjs(patient.regdate) : dayjs();
    form.setFieldsValue({
      admitDate: admitDate,
      shiftTypeId: getShiftIdFromTime(admitDate),
      bed: patient.bedno,
      doctor_name: patient.doctor_name,
      wardId: patient.ward || selectedWard,
      isVentilator: 'N',
      oxygenSupportType: 1,
      birthDate: patient.birthday ? dayjs(patient.birthday) : undefined,
    });
    setIsDrawerOpen(true);
  };

  const onCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedPatient(null);
  };

  // --- Submit ---
  const onFinish = async (values: any) => {
    // Guard: required patient fields
    if (!selectedPatient?.an || !selectedPatient?.hn || !selectedPatient?.ptname) {
      Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ครบ',
        text: 'ไม่พบข้อมูล AN / HN / ชื่อผู้ป่วย กรุณาค้นหาผู้ป่วยใหม่อีกครั้ง',
        confirmButtonColor: '#006b5f',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    // Guard: ห้ามรับย้ายจาก ward เดียวกัน
    if (values.admissionTypeId === 2 && values.wardId === values.referFromWardId) {
      Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'หอผู้ป่วยที่รับเข้า ต้องไม่เป็นหอผู้ป่วยเดียวกับที่ย้ายมา',
        confirmButtonColor: '#006b5f',
        confirmButtonText: 'ตกลง',
      });
      return;
    }

    // reg_datetime: guaranteed string เสมอ
    const regDatetime: string = values.admitDate
      ? dayjs(values.admitDate).format('YYYY-MM-DD HH:mm:ss')
      : dayjs().format('YYYY-MM-DD HH:mm:ss');

    // ✅ Build payload ตาม Elysia schema อย่างเคร่งครัด
    const payload: RegisterPayload = {
      // required
      an: selectedPatient.an,
      hn: selectedPatient.hn,
      patient_name: selectedPatient.ptname,
      reg_datetime: regDatetime,
      before_ward: String(values.referFromWardId) ?? null,
      ward: String(values.wardId),
      birth_date: values.birthDate ? dayjs(values.birthDate).format('YYYY-MM-DD') : null,

      spclty: values.specialtyCode != null ? String(values.specialtyCode) : null,
      gender: selectedPatient.gender != null ? String(selectedPatient.gender) : null,
      bedno: values.bed != null ? String(values.bed) : null,

      admission_type_id: values.admissionTypeId ?? null,
      status: 1,
      serverity_level_id: values.severityLevelId ?? null,
      severity_level_id: values.severityLevelId ?? null,
      admission_change_shift_type_id: values.shiftTypeId ?? null,

      is_ventilator: values.isVentilator || 'N',
      oxygen_support_type: values.isVentilator === 'N' ? values.oxygenSupportType : null,
      ...(values.doctor_name?.trim()
        ? { incharge_doctor: values.doctor_name.trim() }
        : {}
      ),
    };

    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.post('/api/v1/register-patient', payload, { headers });
      console.log('✅ Response:', response.data);

      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ',
        text: 'ลงทะเบียนสำเร็จ',
        confirmButtonColor: '#006b5f',
        confirmButtonText: 'ตกลง',
      }).then(() => {
        router.push('/ipd/shift-patient');
      });
      onCloseDrawer();

    } catch (error: any) {
      const status = error?.response?.status;
      const detail = error?.response?.data;
      console.error('❌ Error:', status, JSON.stringify(detail, null, 2));

      let errorText = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      if (status === 422) errorText = `ข้อมูลไม่ถูกต้อง (422): ${JSON.stringify(detail)}`;
      else if (status === 401) {
        errorText = 'Session หมดอายุ กรุณา Login ใหม่';
        Swal.fire({
          icon: 'error', title: 'เซสชันหมดอายุ', text: errorText, confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง',
        }).then(() => router.push('/'));
      }
      else if (status === 404) errorText = 'ไม่พบข้อมูลผู้ป่วยในระบบ HIS';
      else if (status === 500) errorText = 'เกิดข้อผิดพลาดที่ Server (500)';

      Swal.fire({
        icon: 'error',
        title: `ผิดพลาด (${status ?? 'Network Error'})`,
        text: errorText,
        confirmButtonColor: '#006b5f',
        confirmButtonText: 'ตกลง',
      });
    }
  };

  // --- Table Columns ---
  const columns: ColumnsType<Patient> = [
    { title: 'AN', dataIndex: 'an', key: 'an', width: 120 },
    { title: 'HN', dataIndex: 'hn', key: 'hn', width: 120 },
    { title: 'ชื่อ-นามสกุล', key: 'fullname', render: (_, r) => r.ptname },
    { title: 'แพทย์เจ้าของไข้', dataIndex: 'doctor_name', key: 'doctor_name', render: t => t || '-' },
    {
      title: 'เตียง', dataIndex: 'bedno', key: 'bedno',
      width: 100, align: 'center', render: t => t || '-',
    },
    {
      title: 'วันที่ Admit', dataIndex: 'regdate', key: 'regdate', width: 150,
      render: t => t ? dayjs(t).format('DD/MM/YYYY HH:mm') : '-',
    },
    {
      title: 'ดำเนินการ', key: 'action', width: 150, align: 'center',
      render: (_, record) => (
        <Button type="primary" className="bg-[#006b5f]" onClick={() => openRegisterDrawer(record)}>
          ลงทะเบียน
        </Button>
      ),
    },
  ];

  // --- Severity color map ---
  const severityColors: Record<number, { bg: string; border: string; text: string; selectedBg: string }> = {
    1: { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d', selectedBg: '#52c41a' },
    2: { bg: '#fffbe6', border: '#ffe58f', text: '#d48806', selectedBg: '#faad14' },
    3: { bg: '#fff7e6', border: '#ffd591', text: '#d46b08', selectedBg: '#fa8c16' },
    4: { bg: '#fff1f0', border: '#ffccc7', text: '#cf1322', selectedBg: '#f5222d' },
    5: { bg: '#f9f0ff', border: '#d3adf7', text: '#531dab', selectedBg: '#722ed1' },
  };

  // --- Render ---
  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6 max-w-7xl mx-auto">
        <Card className="shadow-xl rounded-2xl border-none mb-6">
          <Title level={4} className="text-[#006b5f]! mb-6! flex items-center gap-2">
            ลงทะเบียนรับผู้ป่วย (IPD Register)
          </Title>

          <div className="flex flex-wrap gap-4 mb-6">
            <Select
              size="middle"
              placeholder="เลือกหอผู้ป่วย"
              style={{ width: 250 }}
              onChange={handleWardChange}
              showSearch
              optionFilterProp="children"
            >
              {wards.map(w => <Option key={w.ward} value={w.his_code || String(w.ward)}>{w.ward_name || w.name}</Option>)}
            </Select>
            <Input
              size="middle"
              prefix={<VscSearch className="text-gray-400" />}
              placeholder="ระบุเลข AN เพื่อค้นหา"
              value={anInput}
              onChange={e => setAnInput(e.target.value)}
              onPressEnter={handleSearch}
              style={{ maxWidth: 200 }}
            />
            <Button size="middle" type="primary" onClick={handleSearch} loading={loading} className="bg-[#006b5f]">
              ค้นหา
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={patients}
            rowKey="an"
            pagination={false}
            size='small'
            locale={{ emptyText: 'ไม่พบข้อมูล หรือยังไม่ได้ค้นหา' }}
            className="[&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]! [&_.ant-table-thead_.ant-table-cell]:text-white!"
          />
        </Card>

        {/* Drawer */}
        <Drawer
          title={<span className="text-white font-bold text-lg">ลงทะเบียนรับผู้ป่วย</span>}
          placement="right"
          styles={{ wrapper: { width: 500 } }}
          onClose={onCloseDrawer}
          open={isDrawerOpen}
          className="[&_.ant-drawer-header]:bg-[#005a50] [&_.ant-drawer-close]:text-white"
        >
          {selectedPatient && (
            <div className="mb-4 p-4 bg-teal-50 rounded-lg border border-teal-100">
              <Text className="text-lg font-bold text-[#006b5f] block">{selectedPatient.ptname}</Text>
              <div className="flex gap-4 text-gray-600 mt-1">
                <span>HN: <strong className="text-gray-800">{selectedPatient.hn}</strong></span>
                <span>AN: <strong className="text-gray-800">{selectedPatient.an}</strong></span>
              </div>
            </div>
          )}

          <Form layout="vertical" form={form} onFinish={onFinish}>

            {/* Ward */}
            <Form.Item label="รับเข้าตึก" name="wardId" rules={[{ required: true, message: 'กรุณาเลือกหอผู้ป่วย' }]}>
              <Select placeholder="เลือกหอผู้ป่วย" showSearch optionFilterProp="children" onChange={handleDrawerWardChange}>
                {wards.map(w => <Option key={w.ward} value={w.his_code || String(w.ward)}>{w.ward_name || w.name}</Option>)}
              </Select>
            </Form.Item>

            {/* Admission Type */}
            <Form.Item label="ประเภทการรับเข้า" name="admissionTypeId" rules={[{ required: true, message: 'กรุณาเลือกประเภทการรับเข้า' }]}>
              <Select placeholder="เลือกประเภท">
                {admissionTypes.map(t => (
                  <Option key={t.admission_type_id} value={t.admission_type_id}>{t.admission_type_name}</Option>
                ))}
              </Select>
            </Form.Item>

            {/* Refer From Ward (conditional) */}
            {admissionTypeIdValue === 2 && (
              <Form.Item label="รับย้ายจากหอผู้ป่วย" name="referFromWardId" rules={[{ required: true, message: 'กรุณาเลือกหอผู้ป่วยต้นทาง' }]}>
                <Select placeholder="เลือกหอผู้ป่วย" showSearch optionFilterProp="children">
                  {wards.map(w => <Option key={w.ward} value={w.his_code || String(w.ward)}>{w.ward_name || w.name}</Option>)}
                </Select>
              </Form.Item>
            )}

            {/* Specialty */}
            <Form.Item label="แผนกการรักษา" name="specialtyCode" rules={[{ required: true, message: 'กรุณาเลือกแผนก' }]}>
              <Select placeholder="เลือกแผนก" showSearch optionFilterProp="children">
                {specialties.map(s => <Option key={s.spclty} value={s.spclty}>{s.name}</Option>)}
              </Select>
            </Form.Item>

            {/* Doctor */}
            <Form.Item label="แพทย์เจ้าของไข้" name="doctor_name">
              <Input placeholder="ระบุชื่อแพทย์" />
            </Form.Item>

            {/* Severity */}
            <Form.Item label="ระดับความรุนแรง" name="severityLevelId" rules={[{ required: true, message: 'กรุณาเลือกระดับความรุนแรง' }]}>
              <Radio.Group className="w-full">
                <div className="grid grid-cols-2 gap-2">
                  {severityLevels.map(level => {
                    const isSelected = severityLevelValue === level.severity_level_id;
                    const theme = severityColors[level.severity_level_id] || {
                      bg: '#fafafa', border: '#d9d9d9', text: 'rgba(0,0,0,0.88)', selectedBg: '#1677ff',
                    };
                    return (
                      <Radio.Button
                        key={level.severity_level_id}
                        value={level.severity_level_id}
                        style={{
                          backgroundColor: isSelected ? theme.selectedBg : theme.bg,
                          borderColor: isSelected ? theme.selectedBg : theme.border,
                          color: isSelected ? '#fff' : theme.text,
                          height: 'auto', textAlign: 'center', padding: '8px 4px',
                          lineHeight: '1.2', borderWidth: '1px', borderStyle: 'solid',
                        }}
                        className="transition-all"
                      >
                        <span className="text-xs whitespace-normal">{level.severity_level_name.split(' / ')[0]}</span>
                      </Radio.Button>
                    );
                  })}
                </div>
              </Radio.Group>
            </Form.Item>

            {/* Ventilator / Patient Condition */}
            {isLaborRoom ? (
              <Form.Item
                label="สภาวะผู้ป่วย"
                name="isVentilator"
                rules={[{ required: true, message: 'กรุณาระบุสภาวะผู้ป่วย' }]}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  className="w-full flex"
                  onChange={e => {
                    if (e.target.value !== 'N') form.setFieldsValue({ oxygenSupportType: 1 });
                  }}
                >
                  <Radio.Button value="N" className="flex-1 text-center font-semibold">
                    คลอดปกติ
                  </Radio.Button>
                  <Radio.Button value="C" className="flex-1 text-center font-semibold [&.ant-radio-button-wrapper-checked]:bg-orange-500 [&.ant-radio-button-wrapper-checked]:border-orange-500">
                    C/S Complication อื่นๆ
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>
            ) : (
              <Form.Item
                label="การใช้เครื่องช่วยหายใจ (Ventilator)"
                name="isVentilator"
                rules={[{ required: true, message: 'กรุณาระบุข้อมูลการใช้เครื่องช่วยหายใจ' }]}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  className="w-full flex"
                  onChange={e => {
                    if (e.target.value !== 'N') form.setFieldsValue({ oxygenSupportType: 1 });
                  }}
                >
                  <Radio.Button value="Y" className="flex-1 text-center font-semibold [&.ant-radio-button-wrapper-checked]:bg-orange-500 [&.ant-radio-button-wrapper-checked]:border-orange-500">
                    ใส่เครื่องช่วยหายใจ
                  </Radio.Button>
                  <Radio.Button value="N" className="flex-1 text-center font-semibold text-slate-500">
                    ไม่ใส่เครื่องช่วยหายใจ
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>
            )}

            {/* Oxygen Support — แสดงเมื่อ isVentilator === 'N' (ทั้ง labor room และ ward ทั่วไป) */}
            {isVentilatorValue === 'N' && (
              <Form.Item
                label="การให้ออกซิเจน (Oxygen Support)"
                name="oxygenSupportType"
                rules={[{ required: true, message: 'กรุณาเลือกประเภทการให้ออกซิเจน' }]}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  className="w-full flex"
                >
                  <Radio.Button value={1} className="flex-1 text-center">ปกติ (Room Air)</Radio.Button>
                  <Radio.Button value={2} className="flex-1 text-center">Oxygen (O2)</Radio.Button>
                  <Radio.Button value={3} className="flex-1 text-center">HFNC</Radio.Button>
                </Radio.Group>
              </Form.Item>
            )}

            {/* Date + Shift */}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="วันที่รับการรักษา" name="admitDate" rules={[{ required: true, message: 'กรุณาระบุวันที่' }]}>
                  <DatePicker
                    showTime
                    format="DD/MM/YYYY HH:mm"
                    className="w-full"
                    placeholder="เลือกวันเวลา"
                    onChange={handleAdmitDateChange}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="เวร" name="shiftTypeId" rules={[{ required: true, message: 'กรุณาเลือกเวร' }]}>
                  <Select placeholder="เลือกเวร" disabled>
                    {shiftTypes.map(s => (
                      <Option key={s.admission_change_shift_type_id} value={s.admission_change_shift_type_id}>
                        {s.shift_name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* Bed + Birth Date */}
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="เตียง" name="bed" rules={[{ required: true, message: 'ระบุเตียง' }]}>
                  <Input placeholder="ระบุเลขเตียง" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="วันเกิด" name="birthDate">
                  <DatePicker format="DD/MM/YYYY" className="w-full" placeholder="ไม่ระบุ" disabled />
                </Form.Item>
              </Col>
            </Row>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <Button onClick={onCloseDrawer}>ยกเลิก</Button>
              <Button type="primary" htmlType="submit" icon={<VscSave />} className="bg-[#006b5f]">
                บันทึกข้อมูล
              </Button>
            </div>
          </Form>
        </Drawer>
      </div>
    </div>
  );
}