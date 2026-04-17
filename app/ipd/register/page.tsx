'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Button, Table, Drawer, Form, Select, DatePicker, message, Row, Col, Typography } from 'antd';
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
  sex?: string;
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

interface RegisterPayload {
  // required
  an: string;
  hn: string;
  patient_name: string;
  reg_datetime: string;
  ward: string;
  // optional
  before_ward?: string | null;
  birth_date?: string | null;
  spclty?: string | null;
  gender?: string | null;
  bedno?: string | null;
  admission_type_id?: number | null;
  status?: number | null;
  admission_change_shift_type_id?: number | null;
  incharge_doctor?: string;
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

  const admissionTypeIdValue = Form.useWatch('admissionTypeId', form);

  // --- Fetch Dropdown Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [admTypeRes, spcltyRes, wardRes, shiftRes] = await Promise.all([
          axios.get('/api/v1/admission-types', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/spclty', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/wardsV1', { headers }).catch(() => axios.get('/api/v1/wards', { headers }).catch(() => ({ data: { data: [] } }))),
          axios.get('/api/v1/admission-change-shift-types', { headers }).catch(() => ({ data: { data: [] } })),
        ]);

        setAdmissionTypes(admTypeRes.data.data || []);
        setSpecialties(spcltyRes.data.data || []);
        const wardList = Array.isArray(wardRes.data) ? wardRes.data : wardRes.data.data || [];
        setWards(wardList);
        setShiftTypes(shiftRes.data.data || []);
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
      before_ward: values.referFromWardId != null ? String(values.referFromWardId) : null,
      ward: String(values.wardId),
      birth_date: values.birthDate ? dayjs(values.birthDate).format('YYYY-MM-DD') : null,

      spclty: values.specialtyCode != null ? String(values.specialtyCode) : null,
      gender: selectedPatient.sex != null ? String(selectedPatient.sex) : null,
      bedno: values.bed != null ? String(values.bed) : null,

      admission_type_id: values.admissionTypeId ?? null,
      status: 1,
      admission_change_shift_type_id: values.shiftTypeId ?? null,

      ...(values.doctor_name?.trim()
        ? { incharge_doctor: values.doctor_name.trim() }
        : {}
      ),
    };

    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      await axios.post('/api/v1/register-patient', payload, { headers });

      onCloseDrawer();
      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ',
        text: 'ลงทะเบียนสำเร็จ',
        confirmButtonColor: '#006b5f',
        confirmButtonText: 'ตกลง',
      });
      if (selectedWard) handleWardChange(selectedWard);

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