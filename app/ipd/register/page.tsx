'use client';

import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Table, Drawer, Form, Select, DatePicker, message, Row, Col, Typography, Radio } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import Navbar from '../../components/Navbar';
import { VscSearch, VscSave } from "react-icons/vsc";
import Swal from 'sweetalert2';

// ตั้งค่า locale ภาษาไทยให้กับ dayjs
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
  ward: string;
  name: string;
}

interface ShiftType {
  admission_change_shift_type_id: number;
  shift_name: string;
}

interface SeverityLevel {
  severity_level_id: number;
  severity_level_name: string;
}

export default function RegisterPage() {
  const [form] = Form.useForm();
  const severityLevelValue = Form.useWatch('severityLevelId', form);
  const admissionTypeIdValue = Form.useWatch('admissionTypeId', form);
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [anInput, setAnInput] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Drawer & Selection State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [admissionTypes, setAdmissionTypes] = useState<AdmissionType[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [severityLevels, setSeverityLevels] = useState<SeverityLevel[]>([]);

  // --- Fetch Dropdown Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        // ดึง Token จาก Cookie (ถ้ามีระบบ Auth)
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // เรียก API พร้อมกัน
        const [admTypeRes, spcltyRes, wardRes, shiftRes, severityRes] = await Promise.all([
          axios.get('/api/v1/admission-types', { headers }).catch(() => ({ data: { data: [] } })), 
          axios.get('/api/v1/spclty', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/wards', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/admission-change-shift-types', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/admission-severity-levels', { headers }).catch(() => ({ data: { data: [] } }))
        ]);

        setAdmissionTypes(admTypeRes.data.data || []);
        setSpecialties(spcltyRes.data.data || []);
        const wardList = Array.isArray(wardRes.data) ? wardRes.data : wardRes.data.data || [];
        setWards(wardList);
        setShiftTypes(shiftRes.data.data || []);
        setSeverityLevels(severityRes.data.data || []);

      } catch (error) {
        console.error("Error fetching dropdown data:", error);
        // Mock Data กรณีต่อ API ไม่ได้ เพื่อให้เห็น UI
        mockDropdownData();
      }
    };

    fetchData();
  }, []);

  const mockDropdownData = () => {
    setAdmissionTypes([
      { admission_type_id: 1, admission_type_name: "รับใหม่" },
      { admission_type_id: 2, admission_type_name: "รับย้ายจากหอผู้ป่วยอื่น" }
    ]);
    setSpecialties([
      { spclty: "01", name: "กุมารเวชกรรม" },
      { spclty: "05", name: "ศัลยกรรม" },
      { spclty: "09", name: "อายุรกรรม" }
    ]);
    setShiftTypes([
      { admission_change_shift_type_id: 1, shift_name: "ดึก" },
      { admission_change_shift_type_id: 2, shift_name: "เช้า" },
      { admission_change_shift_type_id: 3, shift_name: "บ่าย" }
    ]);
    setSeverityLevels([
      { severity_level_id: 1, severity_level_name: "ผู้ป่วยทั่วไป / อาการดี" },
      { severity_level_id: 2, severity_level_name: "ผู้ป่วยต้องช่วยเหลือบางส่วน" },
      { severity_level_id: 3, severity_level_name: "ผู้ป่วยมีอาการปานกลาง" },
      { severity_level_id: 4, severity_level_name: "ผู้ป่วยอาการหนัก ต้องการดูแลพิเศษ" },
      { severity_level_id: 5, severity_level_name: "ผู้ป่วยวิกฤติ (Critical)" }
    ]);
  };

  const handleWardChange = async (ward: string) => {
    setSelectedWard(ward);
    setLoading(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.post('/api/v1/patients-list-by-ward', { ward }, { headers });

      // รองรับ Response ทั้งแบบ { success: true, data: [...] } และแบบ Array [...] ตรงๆ
      if (response.data.success && Array.isArray(response.data.data)) {
        setPatients(response.data.data);
      } else if (Array.isArray(response.data)) {
        setPatients(response.data);
      } else {
        setPatients([]);
        message.info('ไม่พบผู้ป่วยใน Ward นี้');
      }
    } catch (error) {
      console.error("Error fetching patients by ward:", error);
      message.error('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วย');
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---
  const handleSearch = async () => {
    if (!anInput) {
      message.warning('กรุณากรอกเลข AN');
      return;
    }
    setLoading(true);
    
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await axios.post(`/api/v1/patient-by-an`, { an: anInput }, { headers });

      if (response.data.success && response.data.data) {
        setPatients(response.data.data);
        if (response.data.data.length === 0) {
          message.info('ไม่พบข้อมูลผู้ป่วยสำหรับ AN นี้');
        } else {
          // พบข้อมูล เปิด Drawer ทันทีเพื่อลดขั้นตอน
          openRegisterDrawer(response.data.data[0]);
        }
      } else {
        message.error('ไม่สามารถดึงข้อมูลผู้ป่วยได้');
        setPatients([]);
      }
    } catch (error) {
      console.error("Error fetching patient data:", error);
      message.error('เกิดข้อผิดพลาดในการค้นหาผู้ป่วย');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const getShiftIdFromTime = (date: dayjs.Dayjs) => {
    const hour = date.hour();
    // 8.00-15.59 = เช้า (2)
    // 16.00-23.59 = บ่าย (3)
    // 00.00-07.59 = ดึก (1)
    if (hour >= 8 && hour < 16) return 2;
    if (hour >= 16) return 3;
    return 1;
  };

  const handleAdmitDateChange = (date: dayjs.Dayjs | null) => {
    if (date) {
      const shiftId = getShiftIdFromTime(date);
      form.setFieldsValue({ shiftTypeId: shiftId });
    }
  };

  const openRegisterDrawer = (patient: Patient) => {
    setSelectedPatient(patient);
    form.resetFields();
    // ตั้งค่าเริ่มต้นวันที่เป็นปัจจุบัน และคำนวณเวร
    const now = dayjs();
    form.setFieldsValue({
        admitDate: now,
        shiftTypeId: getShiftIdFromTime(now),
        bed: patient.bedno,
        doctor_name: patient.doctor_name,
        wardId: patient.ward || selectedWard
    });
    setIsDrawerOpen(true);
  };

  const onCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedPatient(null);
  };

  const onFinish = (values: any) => {
    console.log('Form Values:', values);

    // ตรวจสอบว่ารับเข้าตึกต้องไม่ซ้ำกับรับย้ายจากหอผู้ป่วย (กรณีรับย้าย)
    if (values.admissionTypeId === 2 && values.wardId === values.referFromWardId) {
      Swal.fire({
        icon: 'error',
        title: 'ข้อมูลไม่ถูกต้อง',
        text: 'หอผู้ป่วยที่รับเข้า ต้องไม่เป็นหอผู้ป่วยเดียวกับที่ย้ายมา',
        confirmButtonColor: '#006b5f',
        confirmButtonText: 'ตกลง'
      });
      return;
    }

    // Logic บันทึกข้อมูลลงฐานข้อมูล
    Swal.fire({
      icon: 'success',
      title: 'สำเร็จ',
      text: 'ลงทะเบียนสำเร็จ',
      confirmButtonColor: '#006b5f',
      confirmButtonText: 'ตกลง'
    });
    onCloseDrawer();
  };

  // --- Table Columns ---
  const columns: ColumnsType<Patient> = [
    { title: 'AN', dataIndex: 'an', key: 'an', width: 120 },
    { title: 'HN', dataIndex: 'hn', key: 'hn', width: 120 },
    { 
      title: 'ชื่อ-นามสกุล', 
      key: 'fullname',
      render: (_, record) => record.ptname
    },
    { 
      title: 'แพทย์เจ้าของไข้', 
      dataIndex: 'doctor_name', 
      key: 'doctor_name',
      render: (text) => text || '-'
    },
    { 
      title: 'เตียง', 
      dataIndex: 'bedno', 
      key: 'bedno',
      width: 100,
      align: 'center',
      render: (text) => text || '-'
    },
    { 
      title: 'วันที่ Admit', 
      dataIndex: 'regdate', 
      key: 'regdate',
      width: 150,
      render: (text) => text ? dayjs(text).format('DD/MM/YYYY') : '-'
    },
    {
      title: 'ดำเนินการ',
      key: 'action',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <Button 
          type="primary" 
          className="bg-[#006b5f]"
          onClick={() => openRegisterDrawer(record)}
        >
          ลงทะเบียน
        </Button>
      ),
    },
  ];

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
              size="large"
              placeholder="เลือกหอผู้ป่วย"
              style={{ width: 250 }}
              onChange={handleWardChange}
              showSearch
              optionFilterProp="children"
            >
              {wards.map(w => <Option key={w.ward} value={w.ward}>{w.name}</Option>)}
            </Select>
            <Input 
              size="large"
              prefix={<VscSearch className="text-gray-400" />}
              placeholder="ระบุเลข AN เพื่อค้นหา" 
              value={anInput}
              onChange={(e) => setAnInput(e.target.value)}
              onPressEnter={handleSearch}
              style={{ maxWidth: 400 }}
            />
            <Button size="large" type="primary" onClick={handleSearch} loading={loading} className="bg-[#006b5f]">
              ค้นหา
            </Button>
          </div>

          <Table 
            columns={columns} 
            dataSource={patients} 
            rowKey="an" 
            pagination={false}
            locale={{ emptyText: 'ไม่พบข้อมูล หรือยังไม่ได้ค้นหา' }}
            className="[&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]! [&_.ant-table-thead_.ant-table-cell]:text-white!"
          />
        </Card>

        {/* Drawer ลงทะเบียน */}
        <Drawer
          title={<span className="text-white font-bold text-lg">ลงทะเบียนรับผู้ป่วย</span>}
          placement="right"
          styles={{ wrapper: { width: 500 } }}
          onClose={onCloseDrawer}
          open={isDrawerOpen}
          className="[&_.ant-drawer-header]:bg-[#005a50] [&_.ant-drawer-close]:text-white"
        >
          {selectedPatient && (
            <div className="mb-6 p-4 bg-teal-50 rounded-lg border border-teal-100">
              <div className="flex flex-col gap-1">
                <Text className="text-lg font-bold text-[#006b5f]">{selectedPatient.ptname}</Text>
                <div className="flex gap-4 text-gray-600">
                  <span>HN: <strong className="text-gray-800">{selectedPatient.hn}</strong></span>
                  <span>AN: <strong className="text-gray-800">{selectedPatient.an}</strong></span>
                </div>
              </div>
            </div>
          )}

          <Form layout="vertical" form={form} onFinish={onFinish}>
            <Form.Item label="รับเข้าตึก" name="wardId" rules={[{ required: true, message: 'กรุณาเลือกหอผู้ป่วย' }]}>
              <Select placeholder="เลือกหอผู้ป่วย" showSearch optionFilterProp="children">
                {wards.map(w => <Option key={w.ward} value={w.ward}>{w.name}</Option>)}
              </Select>
            </Form.Item>

            <Form.Item label="ประเภทการรับเข้า" name="admissionTypeId" rules={[{ required: true, message: 'กรุณาเลือกประเภทการรับเข้า' }]}>
              <Select placeholder="เลือกประเภท">
                {admissionTypes.map(t => (
                  <Option key={t.admission_type_id} value={t.admission_type_id}>{t.admission_type_name}</Option>
                ))}
              </Select>
            </Form.Item>

            {admissionTypeIdValue === 2 && (
              <Form.Item label="รับย้ายจากหอผู้ป่วย" name="referFromWardId" rules={[{ required: true, message: 'กรุณาเลือกหอผู้ป่วยต้นทาง' }]}>
                <Select placeholder="เลือกหอผู้ป่วย" showSearch optionFilterProp="children">
                  {wards.map(w => <Option key={w.ward} value={w.ward}>{w.name}</Option>)}
                </Select>
              </Form.Item>
            )}

            <Form.Item label="แผนกการรักษา" name="specialtyCode" rules={[{ required: true, message: 'กรุณาเลือกแผนก' }]}>
              <Select placeholder="เลือกแผนก" showSearch optionFilterProp="children">
                {specialties.map(s => (
                  <Option key={s.spclty} value={s.spclty}>{s.name}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item label="แพทย์เจ้าของไข้" name="doctor_name">
              <Input placeholder="ระบุชื่อแพทย์" />
            </Form.Item>

            <Form.Item label="ระดับความรุนแรง" name="severityLevelId" rules={[{ required: true, message: 'กรุณาเลือกระดับความรุนแรง' }]}>
              <Radio.Group className="w-full">
                <div className="grid grid-cols-2 gap-2">
                  {severityLevels.map(level => {
                    const colors: Record<number, { bg: string; border: string; text: string; selectedBg: string; }> = {
                      1: { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d', selectedBg: '#52c41a' }, // Green
                      2: { bg: '#fffbe6', border: '#ffe58f', text: '#d48806', selectedBg: '#faad14' }, // Yellow
                      3: { bg: '#fff7e6', border: '#ffd591', text: '#d46b08', selectedBg: '#fa8c16' }, // Orange
                      4: { bg: '#fff1f0', border: '#ffccc7', text: '#cf1322', selectedBg: '#f5222d' }, // Red
                      5: { bg: '#f9f0ff', border: '#d3adf7', text: '#531dab', selectedBg: '#722ed1' }, // Purple
                    };
                    const isSelected = severityLevelValue === level.severity_level_id;
                    const theme = colors[level.severity_level_id] || { bg: '#fafafa', border: '#d9d9d9', text: 'rgba(0,0,0,0.88)', selectedBg: '#1677ff' };

                    return (
                      <Radio.Button
                        key={level.severity_level_id}
                        value={level.severity_level_id}
                        style={{
                          backgroundColor: isSelected ? theme.selectedBg : theme.bg, borderColor: isSelected ? theme.selectedBg : theme.border, color: isSelected ? '#fff' : theme.text,
                          height: 'auto', textAlign: 'center', padding: '8px 4px', lineHeight: '1.2', borderWidth: '1px', borderStyle: 'solid',
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
                    {shiftTypes.map(s => <Option key={s.admission_change_shift_type_id} value={s.admission_change_shift_type_id}>{s.shift_name}</Option>)}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="เบอร์โทรศัพท์" name="phone">
                  <Input placeholder="ระบุเบอร์โทร" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="เตียง" name="bed" rules={[{ required: true, message: 'ระบุเตียง' }]}>
                  <Input placeholder="ระบุเลขเตียง" />
                </Form.Item>
              </Col>
            </Row>

            <div className="flex justify-end gap-2 mt-0 pt-4 border-t border-gray-100">
               <Button onClick={onCloseDrawer}>ยกเลิก</Button>
               <Button type="primary" htmlType="submit" icon={<VscSave />} className="bg-[#006b5f]">บันทึกข้อมูล</Button>
            </div>
          </Form>
        </Drawer>
      </div>
    </div>
  );
}