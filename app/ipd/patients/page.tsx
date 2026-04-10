'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Card, Select, Input, Button, Space, Drawer, Divider, Tag, Radio, DatePicker, message, Avatar } from 'antd';
import axios from 'axios';
import type { ColumnsType } from 'antd/es/table';
import { VscSearch, VscRefresh } from "react-icons/vsc";
import { PiUserBold, PiHouseBold, PiCalendarCheckBold, PiArrowRightBold, PiFolderOpenBold } from 'react-icons/pi';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import Swal from 'sweetalert2';

interface PatientRecord {
  admission_list_id: number;
  hn: string;
  an: string;
  patient_name: string;
  reg_datetime: string;
  admission_type_name: string;
  incharge_doctor: string;
  spclty_name: string;
  bedno: string;
}

interface Ward {
  ward: number;
  ward_name: string;
  his_code: string;
}

const { Option } = Select;

export default function PatientList() {
  const router = useRouter();
  const [selectedWard, setSelectedWard] = useState<string>();
  const [searchText, setSearchText] = useState('');
  const [wards, setWards] = useState<Ward[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // State สำหรับ Drawer จำหน่าย/ย้ายผู้ป่วย
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [destination, setDestination] = useState<string | undefined>();
  const [referHospital, setReferHospital] = useState<string>('');
  const [admitDateTime, setAdmitDateTime] = useState<dayjs.Dayjs | null>(null);
  const [dischargeDate, setDischargeDate] = useState<dayjs.Dayjs | null>(null);
  const [dischargeType, setDischargeType] = useState<string>('transfer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shiftTypeId, setShiftTypeId] = useState<number | undefined>();

  // ข้อมูลตัวเลือกสำหรับฟอร์มจำหน่าย/ย้าย
  const destinations = [
    { ward: '02', name: 'ศัลยกรรมชาย' },
    { ward: '03', name: 'ศัลยกรรมหญิง' },
    { ward: '04', name: 'อายุรกรรมชาย' },
    { ward: '05', name: 'อายุรกรรมหญิง' },
    { ward: '06', name: 'กุมารเวชกรรม' },
    { ward: '10', name: 'หอผู้ป่วยวิกฤต (ICU)' },
    { ward: '11', name: 'หอผู้ป่วยวิกฤต (NICU)' },
    { ward: '20', name: 'สูตินารีเวชกรรม' },
    { ward: 'HOME', name: 'กลับบ้าน (Discharge)' },
    { ward: 'OTHER', name: 'ส่งต่อโรงพยาบาลอื่น' },
  ];

  const dischargeTypes = [
    { value: 'transfer', label: 'ย้ายหอผู้ป่วย', icon: <PiArrowRightBold className="w-4 h-4" /> },
    { value: 'discharge', label: 'จำหน่ายกลับบ้าน', icon: <PiHouseBold className="w-4 h-4" /> },
    { value: 'refer', label: 'ส่งต่อ รพ.อื่น', icon: <PiArrowRightBold className="w-4 h-4 rotate-90" /> },
  ];

  const shiftTypes = [
    { admission_change_shift_type_id: 1, shift_name: "ดึก" },
    { admission_change_shift_type_id: 2, shift_name: "เช้า" },
    { admission_change_shift_type_id: 3, shift_name: "บ่าย" }
  ];

  useEffect(() => {
    const fetchWards = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) return;

        // เรียก API ไปที่ /api/v1/wards (ผ่าน Proxy) พร้อมแนบ Token
        const response = await axios.get('/api/v1/wardsV1', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.data) {
          // รองรับ response ทั้งแบบ Array ตรงๆ และแบบมี field data
          const wardList = Array.isArray(response.data) ? response.data : response.data.data || [];
          setWards(wardList);
          
          if (wardList.length > 0) {
             setSelectedWard(wardList[0].his_code);
          }
        }
      } catch (error) {
        console.error("Error fetching wards:", error);
      }
    };
    fetchWards();
  }, []);

  const fetchPatients = useCallback(async () => {
    if (!selectedWard) {
      setPatients([]);
      return;
    }
    setLoading(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await axios.get(`/api/v1/view-patient-by-ward/${selectedWard}`, { headers });
      
      if (response.data && response.data.success) {
        setPatients(response.data.data || []);
      } else {
        setPatients([]);
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, [selectedWard]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleWardChange = (value: string) => {
    setSelectedWard(value);
  };

  // ฟังก์ชันช่วยเหลือสำหรับฟอร์มจำหน่าย/ย้าย
  const getShiftIdFromTime = (date: dayjs.Dayjs) => {
    const hour = date.hour();
    if (hour >= 8 && hour < 16) return 2; // เช้า
    if (hour >= 16) return 3; // บ่าย
    return 1; // ดึก
  };

  const los = useMemo(() => {
    if (!admitDateTime || !dischargeDate) return 0;
    const totalMinutes = dischargeDate.diff(admitDateTime, 'minute');
    if (totalMinutes < 0) return 0;
    const fullDays = Math.floor(totalMinutes / (24 * 60));
    const remainderHours = (totalMinutes % (24 * 60)) / 60;
    return fullDays + (remainderHours >= 6 ? 1 : 0);
  }, [admitDateTime, dischargeDate]);

  const handleDischargeDateChange = (date: dayjs.Dayjs | null) => {
    setDischargeDate(date);
    setShiftTypeId(date ? getShiftIdFromTime(date) : undefined);
  };

  const dischargeTypeIdMap: Record<string, number> = {
    discharge: 1, // จำหน่าย
    transfer: 2,  // ย้ายออก
    refer: 3,     // REFER
  };

  const handleConfirmShift = async () => {
    if (dischargeType === 'transfer' && !destination) return message.warning('กรุณาเลือกหอผู้ป่วยปลายทาง');
    if (dischargeType === 'refer' && !referHospital.trim()) return message.warning('กรุณาระบุโรงพยาบาลปลายทาง');
    if (!admitDateTime) return message.warning('กรุณาระบุวันที่เวลารับเข้าตึก');
    if (!dischargeDate) return message.warning('กรุณาเลือกวันและเวลาที่จำหน่าย/ย้าย');

    const payload = {
      admission_list_id: selectedPatient!.admission_list_id,
      discharge_type_id: dischargeTypeIdMap[dischargeType],
      discharge_datetime: dischargeDate.format('YYYY-MM-DD HH:mm:ss'),
      move_to_ward: dischargeType === 'transfer' ? (destination ?? '') : null,
      before_ward: '',
      status: dischargeType === 'transfer' ? '2' : '3',
      los,
    };
   

    setIsSubmitting(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post('/api/v1/discharge-patient', payload, { headers });
      message.success('บันทึกการจำหน่ายผู้ป่วยสำเร็จ');
      handleCancelShift();
      fetchPatients();
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelShift = () => {
    setIsSubmitting(false);
    setSelectedPatient(null);
    setDestination(undefined);
    setReferHospital('');
    setAdmitDateTime(null);
    setDischargeDate(null);
    setShiftTypeId(undefined);
    setDischargeType('transfer');
    setIsDrawerOpen(false);
  };

  const filteredPatients = patients
    .filter(p =>
      (p.patient_name || '').includes(searchText) ||
      (p.hn || '').includes(searchText) ||
      (p.an || '').includes(searchText)
    )
    .sort((a, b) => (a.bedno || '').localeCompare(b.bedno || '', undefined, { numeric: true }));

  const columns: ColumnsType<PatientRecord> = [
    {
      title: 'ลำดับ',
      key: 'index',
      width: 70,
      align: 'center',
      render: (_: unknown, __: PatientRecord, index: number) => index + 1,
    },
    { title: 'HN', dataIndex: 'hn', key: 'hn', width: 100 },
    { title: 'AN', dataIndex: 'an', key: 'an', width: 100 },
    {
      title: 'ชื่อ-สกุล',
      dataIndex: 'patient_name',
      key: 'patient_name',
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <Avatar style={{ backgroundColor: '#006b5f', flexShrink: 0 }} size="small">
            {text?.charAt(0) || '?'}
          </Avatar>
          <span className="font-semibold text-[#006b5f]">{text}</span>
        </div>
      )
    },
    { title: 'เตียง', dataIndex: 'bedno', key: 'bedno', width: 100 },
    { 
      title: 'วันที่ Admit', 
      dataIndex: 'reg_datetime', 
      key: 'reg_datetime', 
      width: 150,
      render: (text) => text ? dayjs(text).format('DD/MM/YYYY HH:mm') : '-'
    },
    { title: 'ประเภท', dataIndex: 'admission_type_name', key: 'admission_type_name', width: 120 },
    { title: 'แผนก', dataIndex: 'spclty_name', key: 'spclty_name', width: 120 },
    { title: 'แพทย์เจ้าของไข้', dataIndex: 'incharge_doctor', key: 'incharge_doctor', width: 250 },
    {
      title: 'ดำเนินการ',
      key: 'action',
      align: 'center',
      width: 200,
      
      render: (_, record) => (
        <Space>
          <Button 
            className="text-blue-600 border-blue-600 hover:bg-blue-50 flex items-center justify-center"
            icon={<PiFolderOpenBold className="text-lg" />}
            title="สรุปข้อมูลผู้ป่วย"
            onClick={() => window.open(`/ipd/summary/${record.an}`, '_blank')}
          />
          <Button 
            className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
            onClick={() => router.push(`/ipd/edit-patient?an=${record.an}`)}
          >
            แก้ไข
          </Button>
          <Button 
            type="primary" 
            className="bg-[#006b5f] hover:bg-[#00554c]"
            onClick={() => {
              setSelectedPatient(record);
              setIsDrawerOpen(true);
              const admit = record.reg_datetime ? (() => { const d = dayjs(record.reg_datetime); return d.year() > 2500 ? d.year(d.year() - 543) : d; })() : null;
              const now = dayjs();
              setAdmitDateTime(admit);
              setDischargeDate(now);
              setShiftTypeId(getShiftIdFromTime(now));
            }}
          >
            จำหน่าย/ย้าย
          </Button>
        </Space>
      ),
    },
  ];

  const currentWardName = wards.find(w => w.his_code === selectedWard)?.ward_name || '-';

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6">
        <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
               <h2 className="text-xl font-bold text-[#006b5f] m-0 whitespace-nowrap">รายชื่อผู้ป่วย</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              <span className="text-gray-600">เลือกหอผู้ป่วย:</span>
              <Select 
                value={selectedWard}
                style={{ width: 200 }} 
                onChange={handleWardChange}
                className="min-w-50"
                placeholder="กำลังโหลดข้อมูล..."
                
              >
                {wards.map(w => <Option key={w.his_code} value={w.his_code}>{w.ward_name}</Option>)}
              </Select>
              
              <Button 
                icon={<VscRefresh />} 
                onClick={fetchPatients}
                loading={loading}
              >
                รีเฟรช
              </Button>

              <Input 
                prefix={<VscSearch className="text-gray-400" />} 
                placeholder="ค้นหา HN หรือ ชื่อ" 
                style={{ width: 200 }}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
          </div>

          <Table 
            columns={columns} 
            dataSource={filteredPatients} 
            rowKey="hn"
            pagination={{ pageSize: 10 }}
            size="middle"
            loading={loading}
            className="[&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
          />
        </Card>

        <Drawer
          title={<span className="text-white font-bold text-lg">จำหน่าย / ย้ายผู้ป่วย</span>}
          placement="right"
          styles={{ wrapper: { width: 500 } }}
          onClose={handleCancelShift}
          open={isDrawerOpen}
          className="[&_.ant-drawer-header]:bg-[#005a50] [&_.ant-drawer-close]:text-white font-sans"
        >
          {selectedPatient && (
            <div className="space-y-6">
              <div className="bg-linear-to-r from-teal-50 to-white p-4 rounded-xl border border-teal-100">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#006b5f] flex items-center justify-center shrink-0">
                    <PiUserBold className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 m-0">{selectedPatient.patient_name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Tag color="blue" className="m-0">HN: {selectedPatient.hn}</Tag>
                      <Tag color="orange" className="m-0">AN: {selectedPatient.an}</Tag>
                    </div>
                  </div>
                </div>
                <Divider className="my-3" />
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                  <div>
                    <span className="text-gray-500 block text-xs">หอผู้ป่วยปัจจุบัน</span>
                    <span className="font-semibold text-gray-800">{currentWardName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">เตียง</span>
                    <span className="font-semibold text-gray-800">{selectedPatient.bedno ? `เตียง ${selectedPatient.bedno}` : '-'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500 mr-1">*</span>
                    ประเภทการจำหน่าย
                  </label>
                  <Radio.Group 
                    onChange={(e) => setDischargeType(e.target.value)} 
                    value={dischargeType}
                    buttonStyle="solid"
                    className="w-full flex"
                  >
                    {dischargeTypes.map(type => (
                      <Radio.Button 
                        key={type.value} 
                        value={type.value}
                        className="flex-1 flex justify-center items-center h-10 transition-colors"
                      >
                        <span className="flex items-center gap-2">{type.icon} {type.label}</span>
                      </Radio.Button>
                    ))}
                  </Radio.Group>
                </div>

                {dischargeType === 'transfer' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <span className="text-red-500 mr-1">*</span>
                      <PiArrowRightBold className="inline w-4 h-4 mr-1" />
                      หอผู้ป่วยปลายทาง
                    </label>
                    <Select
                      placeholder="เลือกหอผู้ป่วยปลายทาง"
                      value={destination}
                      onChange={setDestination}
                      className="w-full"
                      size="medium"
                      showSearch
                      optionFilterProp="children"
                    >
                      {destinations
                        .filter(d => d.ward !== selectedWard)
                        .map(d => (
                          <Option key={d.ward} value={d.ward}>{d.name}</Option>
                        ))
                      }
                    </Select>
                  </div>
                )}

                {dischargeType === 'refer' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <span className="text-red-500 mr-1">*</span>
                      <PiArrowRightBold className="inline w-4 h-4 mr-1" />
                      โรงพยาบาลปลายทาง
                    </label>
                    <Input
                      placeholder="ระบุชื่อโรงพยาบาลปลายทาง"
                      value={referHospital}
                      onChange={(e) => setReferHospital(e.target.value)}
                      size="medium"
                      className="w-full"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <span className="text-red-500 mr-1">*</span>
                      วันที่เวลารับเข้าตึก
                    </label>
                    <DatePicker 
                      value={admitDateTime}
                      onChange={setAdmitDateTime}
                      className="w-full"
                      size="medium"
                      showTime
                      disabled
                      placeholder="เลือกวันและเวลา"
                      format="DD/MM/YYYY HH:mm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <span className="text-red-500 mr-1">*</span>
                      <PiCalendarCheckBold className="inline w-4 h-4 mr-1" />
                      วันและเวลาที่จำหน่าย
                    </label>
                    <DatePicker 
                      value={dischargeDate}
                      onChange={handleDischargeDateChange}
                      className="w-full"
                      size="medium"
                      showTime
                      placeholder="เลือกวันและเวลา"
                      format="DD/MM/YYYY HH:mm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      จำนวนวันนอน (LOS)
                    </label>
                    <Input
                      value={`${los} วัน`}
                      readOnly
                      size="medium"
                      className="bg-teal-50 text-center font-bold text-[#006b5f] border-teal-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      จำหน่ายเวร
                    </label>
                    <Select 
                      value={shiftTypeId}
                      className="w-full"
                      size="medium"
                      placeholder="เวร"
                      disabled
                    >
                      {shiftTypes.map(s => <Option key={s.admission_change_shift_type_id} value={s.admission_change_shift_type_id}>{s.shift_name}</Option>)}
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
                <Button 
                  size="medium"
                  onClick={handleCancelShift}
                >
                  ยกเลิก
                </Button>
                <Button 
                  type="primary"
                  size="medium"
                  icon={<PiArrowRightBold className="w-4 h-4" />}
                  onClick={handleConfirmShift}
                  loading={isSubmitting}
                  className="bg-[#006b5f] hover:bg-[#00554c] border-[#006b5f] shadow-lg shadow-teal-900/20"
                >
                  ยืนยันการจำหน่าย
                </Button>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </div>
  );
}