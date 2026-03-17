'use client';

import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Select, 
  DatePicker, 
  TimePicker, 
  Radio, 
  Input, 
  Button, 
  message,
  Divider,
  Tag,
  Space,
  Table,
  Drawer
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import Navbar from '../../components/Navbar';
import { 
  PiUserBold, 
  PiHouseBold, 
  PiCalendarCheckBold,
  PiNoteBold,
  PiArrowRightBold,
  PiXBold,
  PiMagnifyingGlassBold
} from 'react-icons/pi';

dayjs.locale('th');

const { TextArea } = Input;
const { Option } = Select;

interface PatientInfo {
  hn: string;
  an: string;
  name: string;
  age: number;
  ward: string;
  wardName: string;
  bed: string;
  admitDate: string;
  admitDateTimeIso: string;
  spcltyName: string;
  doctorName: string;
}

interface Destination {
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

export default function ShiftPatientPage() {
  const [selectedPatient, setSelectedPatient] = useState<PatientInfo | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [destination, setDestination] = useState<string | undefined>();
  const [referHospital, setReferHospital] = useState<string>('');
  const [admitDateTime, setAdmitDateTime] = useState<dayjs.Dayjs | null>(null);
  const [dischargeDate, setDischargeDate] = useState<dayjs.Dayjs | null>(null);
  const [dischargeType, setDischargeType] = useState<string>('transfer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [severityLevelId, setSeverityLevelId] = useState<number | undefined>();
  const [shiftTypeId, setShiftTypeId] = useState<number | undefined>();
  const [los, setLos] = useState<number>(0);

  const mockPatients: PatientInfo[] = [
    { hn: '66000123', an: '67000456', name: 'นายสมชาย รักดี', age: 45, ward: '02', wardName: 'ศัลยกรรมชาย', bed: '01', admitDate: '01/03/2567', admitDateTimeIso: '2024-03-01T08:30:00', spcltyName: 'ศัลยกรรม', doctorName: 'นพ. สมชาย ใจดี' },
    { hn: '66000199', an: '67000999', name: 'นายวิชัย ใจกล้า', age: 50, ward: '02', wardName: 'ศัลยกรรมชาย', bed: '02', admitDate: '05/03/2567', admitDateTimeIso: '2024-03-05T14:20:00', spcltyName: 'ศัลยกรรม', doctorName: 'พญ. หญิง สมบูรณ์' },
    { hn: '66000124', an: '67000457', name: 'นางสาวสมหญิง จริงใจ', age: 32, ward: '03', wardName: 'ศัลยกรรมหญิง', bed: '01', admitDate: '02/03/2567', admitDateTimeIso: '2024-03-02T10:00:00', spcltyName: 'ศัลยกรรม', doctorName: 'นพ. ประสิทธิ์ เก่งกาจ' },
    { hn: '66000200', an: '67001000', name: 'นายประสิทธิ์ คิดรอบคอบ', age: 62, ward: '04', wardName: 'อายุรกรรมชาย', bed: '05', admitDate: '04/03/2567', admitDateTimeIso: '2024-03-04T22:15:00', spcltyName: 'อายุรกรรม', doctorName: 'นพ. สมชาย ใจดี' },
  ];

  const destinations: Destination[] = [
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

  const severityLevels: SeverityLevel[] = [
    { severity_level_id: 1, severity_level_name: "ผู้ป่วยทั่วไป / อาการดี" },
    { severity_level_id: 2, severity_level_name: "ผู้ป่วยต้องช่วยเหลือบางส่วน" },
    { severity_level_id: 3, severity_level_name: "ผู้ป่วยมีอาการปานกลาง" },
    { severity_level_id: 4, severity_level_name: "ผู้ป่วยอาการหนัก ต้องการดูแลพิเศษ" },
    { severity_level_id: 5, severity_level_name: "ผู้ป่วยวิกฤติ (Critical)" }
  ];

  const shiftTypes: ShiftType[] = [
    { admission_change_shift_type_id: 1, shift_name: "ดึก" },
    { admission_change_shift_type_id: 2, shift_name: "เช้า" },
    { admission_change_shift_type_id: 3, shift_name: "บ่าย" }
  ];

  const getShiftIdFromTime = (date: dayjs.Dayjs) => {
    const hour = date.hour();
    // 8.00-15.59 = เช้า (2)
    // 16.00-23.59 = บ่าย (3)
    // 00.00-07.59 = ดึก (1)
    if (hour >= 8 && hour < 16) return 2;
    if (hour >= 16) return 3;
    return 1;
  };

  const handleDischargeDateChange = (date: dayjs.Dayjs | null) => {
    setDischargeDate(date);
    if (date) {
      setShiftTypeId(getShiftIdFromTime(date));
    } else {
      setShiftTypeId(undefined);
    }
  };

  useEffect(() => {
    if (admitDateTime && dischargeDate) {
      const hours = dischargeDate.diff(admitDateTime, 'hour');
      if (hours >= 0) {
        const days = Math.floor(hours / 24);
        const remainder = hours % 24;
        setLos(days + (remainder >= 6 ? 1 : 0));
      } else {
        setLos(0);
      }
    } else {
      setLos(0);
    }
  }, [admitDateTime, dischargeDate]);

  const handleConfirm = async () => {
    if (!selectedPatient) {
      message.warning('กรุณาเลือกผู้ป่วย');
      return;
    }
    if (!severityLevelId) {
      message.warning('กรุณาเลือกระดับความรุนแรง');
      return;
    }
    if (dischargeType === 'transfer' && !destination) {
      message.warning('กรุณาเลือกหอผู้ป่วยปลายทาง');
      return;
    }
    if (dischargeType === 'refer' && !referHospital.trim()) {
      message.warning('กรุณาระบุโรงพยาบาลปลายทาง');
      return;
    }
    if (!admitDateTime) {
      message.warning('กรุณาระบุวันที่เวลารับเข้าตึก');
      return;
    }
    if (!dischargeDate) {
      message.warning('กรุณาเลือกวันและเวลาที่จำหน่าย/ย้าย');
      return;
    }

    setIsSubmitting(true);
    
    setTimeout(() => {
      message.success('บันทึกการจำหน่ายผู้ป่วยสำเร็จ');
      setIsSubmitting(false);
      setSelectedPatient(null);
      setDestination(undefined);
      setReferHospital('');
      setAdmitDateTime(null);
      setDischargeDate(null);
      setSeverityLevelId(undefined);
      setShiftTypeId(undefined);
      setIsDrawerOpen(false);
    }, 1000);
  };

  const handleCancel = () => {
    setSelectedPatient(null);
    setDestination(undefined);
    setReferHospital('');
    setAdmitDateTime(null);
    setDischargeDate(null);
    setSeverityLevelId(undefined);
    setShiftTypeId(undefined);
    setDischargeType('transfer');
    setIsDrawerOpen(false);
  };

  const filteredPatients = mockPatients.filter(p => 
    p.name.includes(searchText) || p.hn.includes(searchText) || p.an.includes(searchText)
  );

  const columns: ColumnsType<PatientInfo> = [
    { title: 'HN', dataIndex: 'hn', key: 'hn', width: 100 },
    { title: 'AN', dataIndex: 'an', key: 'an', width: 100 },
    { 
      title: 'ชื่อ-สกุล', 
      dataIndex: 'name', 
      key: 'name',
      render: (text) => <span className="font-semibold text-[#006b5f]">{text}</span>
    },
    { title: 'อายุ', dataIndex: 'age', key: 'age', width: 70, align: 'center' },
    { title: 'หอผู้ป่วย', dataIndex: 'wardName', key: 'wardName', width: 150 },
    { title: 'เตียง', dataIndex: 'bed', key: 'bed', width: 80, align: 'center' },
    { title: 'แผนกการรักษา', dataIndex: 'spcltyName', key: 'spcltyName', width: 120 },
    { title: 'วันที่ Admit', dataIndex: 'admitDate', key: 'admitDate', width: 120 },
    { title: 'แพทย์เจ้าของไข้', dataIndex: 'doctorName', key: 'doctorName' },
    { 
      title: 'วันนอน', 
      key: 'los', 
      width: 80, 
      align: 'center',
      render: (_, record) => {
        const hours = dayjs().diff(dayjs(record.admitDateTimeIso), 'hour');
        return hours >= 0 ? `${Math.floor(hours / 24) + (hours % 24 >= 6 ? 1 : 0)} วัน` : '0 วัน';
      }
    },
    {
      title: 'ดำเนินการ',
      key: 'action',
      width: 130,
      align: 'center',
      render: (_, record) => (
        <Button 
          type="primary" 
          className="bg-[#006b5f] flex items-center justify-center gap-1 mx-auto w-full"
          onClick={() => {
            setSelectedPatient(record);
            setIsDrawerOpen(true);
            setAdmitDateTime(dayjs(record.admitDateTimeIso));
            const now = dayjs();
            setDischargeDate(now);
            setShiftTypeId(getShiftIdFromTime(now));
          }}
        >
          ทำรายการ
        </Button>
      ),
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6 max-w-full mx-auto">
        <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="bg-[#006b5f] p-2 rounded-xl">
                <PiArrowRightBold className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#006b5f] m-0">จำหน่าย / ย้ายผู้ป่วย</h2>
                <p className="text-sm text-gray-500 m-0">IPD Patient Discharge & Transfer</p>
              </div>
            </div>
            
            <div className="flex w-full md:w-auto">
              <Input 
                size="medium"
                prefix={<PiMagnifyingGlassBold className="text-gray-400" />} 
                placeholder="ค้นหา HN, AN หรือชื่อ-สกุล" 
                style={{ minWidth: 280 }}
                onChange={e => setSearchText(e.target.value)}
                value={searchText}
              />
            </div>
          </div>

          <Table 
            columns={columns} 
            dataSource={filteredPatients} 
            rowKey="hn"
            size='small'
            pagination={{ pageSize: 10 }}
            className="[&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
          />
        </Card>

        <Drawer
          title={<span className="text-white font-bold text-lg">จำหน่าย / ย้ายผู้ป่วย</span>}
          placement="right"
          styles={{ wrapper: { width: 500 } }}
          onClose={handleCancel}
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
                    <h3 className="text-lg font-bold text-gray-800 m-0">{selectedPatient.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Tag color="blue" className="m-0">HN: {selectedPatient.hn}</Tag>
                      <Tag color="orange" className="m-0">AN: {selectedPatient.an}</Tag>
                      <span className="text-sm text-gray-500 whitespace-nowrap">อายุ {selectedPatient.age} ปี</span>
                    </div>
                  </div>
                </div>
                <Divider className="my-3" />
                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                  <div>
                    <span className="text-gray-500 block text-xs">หอผู้ป่วยปัจจุบัน</span>
                    <span className="font-semibold text-gray-800">{selectedPatient.wardName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-xs">เตียง</span>
                    <span className="font-semibold text-gray-800">เตียง {selectedPatient.bed}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500 mr-1">*</span>
                    ระดับความรุนแรง
                  </label>
                  <Radio.Group className="w-full" value={severityLevelId} onChange={(e) => setSeverityLevelId(e.target.value)} size='small'>
                    <div className="grid grid-cols-2 gap-2">
                      {severityLevels.map(level => {
                        const colors: Record<number, { bg: string; border: string; text: string; selectedBg: string; }> = {
                          1: { bg: '#f6ffed', border: '#b7eb8f', text: '#389e0d', selectedBg: '#52c41a' }, // Green
                          2: { bg: '#fffbe6', border: '#ffe58f', text: '#d48806', selectedBg: '#faad14' }, // Yellow
                          3: { bg: '#fff7e6', border: '#ffd591', text: '#d46b08', selectedBg: '#fa8c16' }, // Orange
                          4: { bg: '#fff1f0', border: '#ffccc7', text: '#cf1322', selectedBg: '#f5222d' }, // Red
                          5: { bg: '#f9f0ff', border: '#d3adf7', text: '#531dab', selectedBg: '#722ed1' }, // Purple
                        };
                        const isSelected = severityLevelId === level.severity_level_id;
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
                </div>

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
                      .filter(d => d.ward !== selectedPatient.ward)
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
                  onClick={handleCancel}
                >
                  ยกเลิก
                </Button>
                <Button 
                  type="primary"
                  size="medium"
                  icon={<PiArrowRightBold className="w-4 h-4" />}
                  onClick={handleConfirm}
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
