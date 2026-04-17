'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Card, Select, Input, Button, Space, Drawer, Divider, Tag, Radio, DatePicker, message, Avatar, Form, Row, Col, Tabs, Dropdown } from 'antd';
import axios from 'axios';
import type { ColumnsType } from 'antd/es/table';
import { VscSearch, VscRefresh, VscSave, VscListFlat } from "react-icons/vsc";
import { PiUserBold, PiHouseBold, PiCalendarCheckBold, PiArrowRightBold, PiFolderOpenBold, PiClipboardTextBold, PiHeartbeatBold, PiNotePencilBold, PiListChecksBold, PiDropBold, PiPillBold, PiStarBold, PiBookOpenBold, PiArrowsLeftRightBold, PiSignOutBold, PiPersonSimpleBold, PiShieldWarningBold, PiThermometerBold, PiScissorsBold, PiLinkBold, PiBrainBold, PiSmileyNervousBold } from 'react-icons/pi';
import dayjs from 'dayjs';
import Navbar from '../../components/Navbar';
import Swal from 'sweetalert2';

interface PatientRecord {
  admission_list_id: number;
  hn: string;
  an: string;
  // API ส่งกลับ field ชื่อต่างกัน
  name: string;
  patient_name?: string;
  age?: number;
  ward?: string;
  wardName?: string;
  bed?: string;
  bedno?: string;
  admitDate?: string;
  admitDateTimeIso?: string;
  reg_datetime?: string;
  spcltyName?: string;
  spclty_name?: string;
  doctorName?: string;
  incharge_doctor?: string;
  admission_type_id?: number;
  admission_type_name?: string;
  spclty?: number | string;
  before_ward?: string;
  birth_date?: string;
  gender?: string;
  admission_change_shift_type_id?: number;
}

interface Ward {
  ward: number;
  ward_name: string;
  his_code: string;
}

interface AdmissionType {
  admission_type_id: number;
  admission_type_name: string;
}

interface Specialty {
  spclty: string;
  name: string;
}

const { Option } = Select;

export default function PatientList() {
  const [activeTab, setActiveTab] = useState<string>('current');
  const [selectedWard, setSelectedWard] = useState<string>();
  const [searchText, setSearchText] = useState('');
  const [wards, setWards] = useState<Ward[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // State สำหรับ Tab ผู้ป่วยจำหน่าย
  const [dischargedPatients, setDischargedPatients] = useState<PatientRecord[]>([]);
  const [dischargedLoading, setDischargedLoading] = useState(false);
  const [dischargedDateRange, setDischargedDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs()]);

  // State สำหรับ Drawer แก้ไขผู้ป่วย
  const [editForm] = Form.useForm();
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<PatientRecord | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [admissionTypes, setAdmissionTypes] = useState<AdmissionType[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const editAdmissionTypeIdValue = Form.useWatch('admissionTypeId', editForm);

  // State สำหรับ Drawer จำหน่าย/ย้ายผู้ป่วย
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [move_to_ward, setMoveToWard] = useState<string | undefined>();
  const [referHospital, setReferHospital] = useState<string>('');
  const [admitDateTime, setAdmitDateTime] = useState<dayjs.Dayjs | null>(null);
  const [dischargeDate, setDischargeDate] = useState<dayjs.Dayjs | null>(null);
  const [dischargeType, setDischargeType] = useState<string>('transfer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shiftTypeId, setShiftTypeId] = useState<number | undefined>();

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

  // --- Fetch Dropdown Data ---
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const [admTypeRes, spcltyRes] = await Promise.all([
          axios.get('/api/v1/admission-types', { headers }).catch(() => ({ data: { data: [] } })),
          axios.get('/api/v1/spclty', { headers }).catch(() => ({ data: { data: [] } })),
        ]);
        setAdmissionTypes(admTypeRes.data.data || []);
        setSpecialties(spcltyRes.data.data || []);
      } catch (error) {
        console.error('Error fetching dropdowns:', error);
      }
    };
    fetchDropdowns();
  }, []);

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

  const fetchDischargedPatients = useCallback(async () => {
    if (!selectedWard) {
      setDischargedPatients([]);
      return;
    }
    setDischargedLoading(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.post('/api/v1/view-discharged-patient-by-ward', {
        ward: selectedWard,
        ds1: dischargedDateRange[0].format('YYYY-MM-DD'),
        ds2: dischargedDateRange[1].format('YYYY-MM-DD'),
      }, { headers });
      if (response.data && response.data.success) {
        setDischargedPatients(response.data.data || []);
      } else {
        setDischargedPatients([]);
      }
    } catch (error) {
      console.error('Error fetching discharged patients:', error);
      setDischargedPatients([]);
    } finally {
      setDischargedLoading(false);
    }
  }, [selectedWard, dischargedDateRange]);

  useEffect(() => {
    fetchDischargedPatients();
  }, [fetchDischargedPatients]);

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
    if (dischargeType === 'transfer' && !move_to_ward) return message.warning('กรุณาเลือกหอผู้ป่วยปลายทาง');
    if (dischargeType === 'refer' && !referHospital.trim()) return message.warning('กรุณาระบุโรงพยาบาลปลายทาง');
    if (!admitDateTime) return message.warning('กรุณาระบุวันที่เวลารับเข้าตึก');
    if (!dischargeDate) return message.warning('กรุณาเลือกวันและเวลาที่จำหน่าย/ย้าย');

    const payload = {
      admission_list_id: selectedPatient!.admission_list_id,
      discharge_type_id: dischargeTypeIdMap[dischargeType],
      discharge_datetime: dischargeDate.format('YYYY-MM-DD HH:mm:ss'),
      move_to_ward: dischargeType === 'transfer' ? (move_to_ward ?? '') : null,
      status: 2,
      los,
    };
    console.log('discharge payload:', payload);

    setIsSubmitting(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post('/api/v1/discharge-patient', payload, { headers });
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'บันทึกการจำหน่ายผู้ป่วยสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      handleCancelShift();
      fetchPatients();
      fetchDischargedPatients();
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Edit Drawer ---
  const openEditDrawer = (record: PatientRecord) => {
    setEditPatient(record);
    editForm.resetFields();
    const admitDate = record.reg_datetime ? (() => {
      const d = dayjs(record.reg_datetime);
      return d.year() > 2500 ? d.year(d.year() - 543) : d;
    })() : dayjs();
    editForm.setFieldsValue({
      wardId: record.ward || selectedWard,
      admissionTypeId: record.admission_type_id ?? undefined,
      referFromWardId: record.before_ward || undefined,
      specialtyCode: record.spclty ?? undefined,
      doctor_name: record.doctorName || record.incharge_doctor,
      admitDate: admitDate,
      shiftTypeId: record.admission_change_shift_type_id ?? getShiftIdFromTime(admitDate),
      bed: record.bed || record.bedno,
      birthDate: record.birth_date ? dayjs(record.birth_date) : undefined,
    });
    setIsEditDrawerOpen(true);
  };

  const closeEditDrawer = () => {
    setIsEditDrawerOpen(false);
    setEditPatient(null);
  };

  const handleAdmitDateChange = (date: dayjs.Dayjs | null) => {
    if (date) editForm.setFieldsValue({ shiftTypeId: getShiftIdFromTime(date) });
  };

  const onEditFinish = async (values: any) => {
    if (!editPatient) return;

    const regDatetime = values.admitDate
      ? dayjs(values.admitDate).format('YYYY-MM-DD HH:mm:ss')
      : dayjs().format('YYYY-MM-DD HH:mm:ss');

    const payload = {
      admission_list_id: editPatient.admission_list_id,
      patient_name: editPatient.name || editPatient.patient_name || '',
      reg_datetime: regDatetime,
      ward: String(values.wardId),
      before_ward: values.referFromWardId != null ? String(values.referFromWardId) : null,
      birth_date: values.birthDate ? dayjs(values.birthDate).format('YYYY-MM-DD') : null,
      spclty: values.specialtyCode != null ? String(values.specialtyCode) : null,
      bedno: values.bed != null ? String(values.bed) : null,
      admission_type_id: values.admissionTypeId ?? null,
      status: 1,
      admission_change_shift_type_id: values.shiftTypeId ?? null,
      incharge_doctor: values.doctor_name?.trim() || '',
    };

    setEditSubmitting(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.post('/api/v1/update-patient', payload, { headers });
      closeEditDrawer();
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'แก้ไขข้อมูลสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      fetchPatients();
    } catch (error: any) {
      const status = error?.response?.status;
      Swal.fire({ icon: 'error', title: `ผิดพลาด (${status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleCancelShift = () => {
    setIsSubmitting(false);
    setSelectedPatient(null);
    setMoveToWard(undefined);
    setReferHospital('');
    setAdmitDateTime(null);
    setDischargeDate(null);
    setShiftTypeId(undefined);
    setDischargeType('transfer');
    setIsDrawerOpen(false);
  };

  const filteredPatients = patients
    .filter(p =>
      (p.name || p.patient_name || '').includes(searchText) ||
      (p.hn || '').includes(searchText) ||
      (p.an || '').includes(searchText)
    )
    .sort((a, b) => (a.bed || a.bedno || '').localeCompare(b.bed || b.bedno || '', undefined, { numeric: true }));

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
      key: 'name',
      render: (_, r) => {
        const displayName = r.name || r.patient_name || '';
        return (
          <div className="flex items-center gap-2">
            <Avatar style={{ backgroundColor: '#006b5f', flexShrink: 0 }} size="small">
              {displayName?.charAt(0) || '?'}
            </Avatar>
            <span className="font-semibold text-[#006b5f]">{displayName}</span>
          </div>
        );
      }
    },
    { title: 'เตียง', key: 'bed', width: 100, render: (_, r) => r.bed || r.bedno || '-' },
    {
      title: 'วันที่ Admit',
      key: 'admitDate',
      width: 150,
      render: (_, r) => {
        const dt = r.admitDateTimeIso || r.reg_datetime;
        return dt ? dayjs(dt).format('DD/MM/YYYY HH:mm') : (r.admitDate || '-');
      }
    },
    { title: 'ประเภท', key: 'admission_type_name', width: 120, render: (_, r) => r.admission_type_name || '-' },
    { title: 'แผนก', key: 'spclty_name', width: 120, render: (_, r) => r.spcltyName || r.spclty_name || '-' },
    { title: 'แพทย์เจ้าของไข้', key: 'incharge_doctor', width: 250, render: (_, r) => r.doctorName || r.incharge_doctor || '-' },
    {
      title: 'ดำเนินการ',
      key: 'action',
      align: 'center',
      width: 300,

      render: (_, record) => (
        <Space>
          <Dropdown
            menu={{
              items: [
                { key: 'group1', type: 'group', label: <span className="text-[#006b5f] font-bold text-xs uppercase tracking-wide">แบบบันทึก</span>, children: [
                  { key: 'admit', icon: <PiClipboardTextBold className="text-[#006b5f] text-base" />, label: 'การบันทึกการรับผู้ป่วย' },
                  { key: 'vital', icon: <PiHeartbeatBold className="text-red-500 text-base" />, label: 'แบบบันทึกสัญญาณชีพ (Vital Signs Record)' },
                  { key: 'nursing', icon: <PiNotePencilBold className="text-blue-600 text-base" />, label: 'บันทึกทางการพยาบาล (Nursing Progress Notes)' },
                  { key: 'careplan', icon: <PiListChecksBold className="text-green-600 text-base" />, label: 'แผนการพยาบาล (Nursing Care Plan)' },
                  { key: 'io', icon: <PiDropBold className="text-cyan-500 text-base" />, label: 'บันทึกการได้รับและขับออกของสารน้ำ (I/O Record)' },
                  { key: 'mar', icon: <PiPillBold className="text-purple-500 text-base" />, label: 'บันทึกการให้ยา (MAR)' },
                  { key: 'special', icon: <PiStarBold className="text-amber-500 text-base" />, label: 'บันทึกการดูแลพิเศษ (Special Care Records)' },
                  { key: 'education', icon: <PiBookOpenBold className="text-indigo-500 text-base" />, label: 'บันทึกการศึกษาและให้ความรู้ (Patient Education)' },
                  { key: 'handover', icon: <PiArrowsLeftRightBold className="text-orange-500 text-base" />, label: 'บันทึกการส่งเวร (Nursing Handover / SBAR)' },
                  { key: 'discharge', icon: <PiSignOutBold className="text-rose-600 text-base" />, label: 'บันทึกการจำหน่าย (Discharge Record)' },
                ]},
                { type: 'divider' },
                { key: 'group2', type: 'group', label: <span className="text-orange-600 font-bold text-xs uppercase tracking-wide">แบบประเมิน</span>, children: [
                  { key: 'fall-risk', icon: <PiPersonSimpleBold className="text-orange-500 text-base" />, label: 'แบบประเมินความเสี่ยงพลัดตกหกล้ม (Fall Risk)' },
                  { key: 'braden', icon: <PiShieldWarningBold className="text-yellow-600 text-base" />, label: 'แบบประเมินแผลกดทับ (Braden Scale)' },
                  { key: 'pain', icon: <PiThermometerBold className="text-red-400 text-base" />, label: 'แบบประเมินความปวด (Pain Assessment)' },
                  { key: 'wound-care', icon: <PiScissorsBold className="text-pink-500 text-base" />, label: 'บันทึกการทำแผล (Wound Care Record)' },
                  { key: 'restraint', icon: <PiLinkBold className="text-gray-600 text-base" />, label: 'บันทึกการผูกยึด (Restraint Record)' },
                  { key: 'gcs', icon: <PiBrainBold className="text-violet-600 text-base" />, label: 'แบบประเมินระดับความรู้สึกตัว (GCS)' },
                  { key: 'mental-health', icon: <PiSmileyNervousBold className="text-teal-500 text-base" />, label: 'แบบประเมินสุขภาพจิต/ความวิตกกังวล' },
                ]},
              ],
              onClick: ({ key }) => {
                if (key === 'group1' || key === 'group2') return;
                window.open(`/ipd/${key}/${record.an}`, '_blank');
              },
              className: '[&_.ant-dropdown-menu]:rounded-xl [&_.ant-dropdown-menu]:shadow-2xl [&_.ant-dropdown-menu]:border [&_.ant-dropdown-menu]:border-gray-100 [&_.ant-dropdown-menu-item]:rounded-lg [&_.ant-dropdown-menu-item]:mx-1 [&_.ant-dropdown-menu-item:hover]:bg-teal-50',
            }}
            trigger={['click']}
          >
            <Button
              type="primary"
              className="bg-[#006b5f] hover:bg-[#00554c] flex items-center justify-center"
              icon={<VscListFlat className="text-lg" />}
            >
              แบบบันทึก
            </Button>
          </Dropdown>
          <Button
            className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
            onClick={() => openEditDrawer(record)}
          >
            แก้ไข
          </Button>
          <Button
            type="primary"
            className="bg-[#006b5f] hover:bg-[#00554c]"
            onClick={() => {
              setSelectedPatient(record);
              setIsDrawerOpen(true);
              const rawDt = record.admitDateTimeIso || record.reg_datetime;
              const admit = rawDt ? (() => { const d = dayjs(rawDt); return d.year() > 2500 ? d.year(d.year() - 543) : d; })() : null;
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

  const filteredDischargedPatients = dischargedPatients
    .filter(p =>
      (p.name || p.patient_name || '').includes(searchText) ||
      (p.hn || '').includes(searchText) ||
      (p.an || '').includes(searchText)
    );

  const dischargedColumns: ColumnsType<PatientRecord> = [
    {
      title: 'ลำดับ',
      key: 'index',
      width: 70,
      align: 'center',
      render: (_: unknown, __: PatientRecord, index: number) => index + 1,
    },
    { title: 'HN', dataIndex: 'hn', key: 'hn', width: 100,align: 'center' },
    { title: 'AN', dataIndex: 'an', key: 'an', width: 100,align: 'center' },
    {
      title: 'ชื่อ-สกุล',
      key: 'name',
      render: (_, r) => {
        const displayName = r.name || r.patient_name || '';
        return (
          <div className="flex items-center gap-2">
            <Avatar style={{ backgroundColor: '#888', flexShrink: 0 }} size="small">
              {displayName?.charAt(0) || '?'}
            </Avatar>
            <span className="font-semibold text-gray-600">{displayName}</span>
          </div>
        );
      }
    },
    { title: 'เตียง',align: 'center', key: 'bed', width: 100, render: (_, r) => r.bed || r.bedno || '-' },
    {
      title: 'วันที่ Admit',
      key: 'admitDate',
      width: 150,
      align: 'center',
      render: (_, r) => {
        const dt = r.admitDateTimeIso || r.reg_datetime;
        return dt ? dayjs(dt).format('DD/MM/YYYY HH:mm') : (r.admitDate || '-');
      }
    },
    { title: 'แผนก', key: 'spclty_name',align: 'center', width: 120, render: (_, r) => r.spcltyName || r.spclty_name || '-' },
    { title: 'แพทย์เจ้าของไข้', key: 'incharge_doctor', width: 250, render: (_, r) => r.doctorName || r.incharge_doctor || '-' },
    { title: 'ประเภทการจำหน่าย', dataIndex: 'discharge_type_name', key: 'discharge_type_name',align: 'center', width: 150, render: (text) => text || '-' },
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
            type="primary"
            danger
            onClick={() => {
              Swal.fire({
                title: 'ยกเลิกจำหน่าย',
                text: `ยืนยันยกเลิกจำหน่ายผู้ป่วย ${record.name || record.patient_name} (AN: ${record.an}) ?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#006b5f',
                cancelButtonColor: '#d33',
                confirmButtonText: 'ยืนยัน',
                cancelButtonText: 'ปิด',
              }).then(async (result) => {
                if (result.isConfirmed) {
                  try {
                    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
                    const headers = token ? { Authorization: `Bearer ${token}` } : {};
                    await axios.get(`/api/v1/cancel-discharge/${record.admission_list_id}`, { headers });
                    Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'ยกเลิกจำหน่ายสำเร็จ', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
                    fetchPatients();
                    fetchDischargedPatients();
                  } catch (error: any) {
                    const st = error?.response?.status;
                    Swal.fire({ icon: 'error', title: `ผิดพลาด (${st ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาด กรุณาลองใหม่', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
                  }
                }
              });
            }}
          >
            ยกเลิกจำหน่าย
          </Button>
        </Space>
      ),
    },
  ];

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
                placeholder="เลือกหอผู้ป่วย..."
              >
                {wards.map(w => <Option key={w.his_code} value={w.his_code}>{w.ward_name}</Option>)}
              </Select>

              <Input
                prefix={<VscSearch className="text-gray-400" />}
                placeholder="ค้นหา HN หรือ ชื่อ"
                style={{ width: 200 }}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="card"
            className="[&_.ant-tabs-tab-active]:bg-[#006b5f]! [&_.ant-tabs-tab-active_.ant-tabs-tab-btn]:text-white! [&_.ant-tabs-tab]:font-semibold [&_.ant-tabs-tab]:px-6 [&_.ant-tabs-tab]:py-2"
            tabBarExtraContent={
              activeTab === 'current' ? (
                <Button icon={<VscRefresh />} onClick={fetchPatients} loading={loading}>
                  รีเฟรช
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">ช่วงวันที่จำหน่าย:</span>
                  <DatePicker.RangePicker
                    value={dischargedDateRange}
                    onChange={(dates) => { if (dates && dates[0] && dates[1]) setDischargedDateRange([dates[0], dates[1]]); }}
                    format="DD/MM/YYYY"
                    allowClear={false}
                  />
                  <Button icon={<VscRefresh />} onClick={fetchDischargedPatients} loading={dischargedLoading}>
                    รีเฟรช
                  </Button>
                </div>
              )
            }
            items={[
              {
                key: 'current',
                label: `ผู้ป่วยปัจจุบัน (${filteredPatients.length})`,
                children: (
                  <Table
                      columns={columns}
                      dataSource={filteredPatients}
                      rowKey="admission_list_id"
                      pagination={{ pageSize: 10 }}
                      size="middle"
                      loading={loading}
                      locale={{ emptyText: 'ไม่พบข้อมูล หรือยังไม่ได้เลือกหอผู้ป่วย' }}
                      className="[&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
                    />
                ),
              },
              {
                key: 'discharged',
                label: `ผู้ป่วยจำหน่าย (${filteredDischargedPatients.length})`,
                children: (
                  <Table
                      columns={dischargedColumns}
                      dataSource={filteredDischargedPatients}
                      rowKey="admission_list_id"
                      pagination={{ pageSize: 10 }}
                      size="middle"
                      loading={dischargedLoading}
                      locale={{ emptyText: 'ไม่พบข้อมูลผู้ป่วยจำหน่าย' }}
                      className="[&_.ant-table-thead_.ant-table-cell]:bg-gray-500! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
                    />
                ),
              },
            ]}
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
                    <h3 className="text-lg font-bold text-gray-800 m-0">{selectedPatient.name || selectedPatient.patient_name}</h3>
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
                    <span className="font-semibold text-gray-800">{(selectedPatient.bed || selectedPatient.bedno) ? `เตียง ${selectedPatient.bed || selectedPatient.bedno}` : '-'}</span>
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
                      value={move_to_ward}
                      onChange={setMoveToWard}
                      className="w-full"
                      size="medium"
                      showSearch
                      optionFilterProp="children"
                    >
                      {wards
                        .filter(w => w.his_code !== selectedWard)
                        .map(w => (
                          <Option key={w.his_code} value={w.his_code}>{w.ward_name}</Option>
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

        {/* Edit Drawer */}
        <Drawer
          title={<span className="text-white font-bold text-lg">แก้ไขข้อมูลผู้ป่วย</span>}
          placement="right"
          styles={{ wrapper: { width: 500 } }}
          onClose={closeEditDrawer}
          open={isEditDrawerOpen}
          className="[&_.ant-drawer-header]:bg-[#005a50] [&_.ant-drawer-close]:text-white"
        >
          {editPatient && (
            <div className="mb-4 p-4 bg-teal-50 rounded-lg border border-teal-100">
              <span className="text-lg font-bold text-[#006b5f] block">{editPatient.name || editPatient.patient_name}</span>
              <div className="flex gap-4 text-gray-600 mt-1">
                <span>HN: <strong className="text-gray-800">{editPatient.hn}</strong></span>
                <span>AN: <strong className="text-gray-800">{editPatient.an}</strong></span>
              </div>
            </div>
          )}

          <Form layout="vertical" form={editForm} onFinish={onEditFinish}>
            <Form.Item label="รับเข้าตึก" name="wardId" rules={[{ required: true, message: 'กรุณาเลือกหอผู้ป่วย' }]}>
              <Select placeholder="เลือกหอผู้ป่วย" showSearch optionFilterProp="children">
                {wards.map(w => <Option key={w.his_code} value={w.his_code}>{w.ward_name}</Option>)}
              </Select>
            </Form.Item>

            <Form.Item label="ประเภทการรับเข้า" name="admissionTypeId" rules={[{ required: true, message: 'กรุณาเลือกประเภทการรับเข้า' }]}>
              <Select placeholder="เลือกประเภท">
                {admissionTypes.map(t => (
                  <Option key={t.admission_type_id} value={t.admission_type_id}>{t.admission_type_name}</Option>
                ))}
              </Select>
            </Form.Item>

            {editAdmissionTypeIdValue === 2 && (
              <Form.Item label="รับย้ายจากหอผู้ป่วย" name="referFromWardId" rules={[{ required: true, message: 'กรุณาเลือกหอผู้ป่วยต้นทาง' }]}>
                <Select placeholder="เลือกหอผู้ป่วย" showSearch optionFilterProp="children">
                  {wards.map(w => <Option key={w.his_code} value={w.his_code}>{w.ward_name}</Option>)}
                </Select>
              </Form.Item>
            )}

            <Form.Item label="แผนกการรักษา" name="specialtyCode" rules={[{ required: true, message: 'กรุณาเลือกแผนก' }]}>
              <Select placeholder="เลือกแผนก" showSearch optionFilterProp="children">
                {specialties.map(s => <Option key={s.spclty} value={s.spclty}>{s.name}</Option>)}
              </Select>
            </Form.Item>

            <Form.Item label="แพทย์เจ้าของไข้" name="doctor_name">
              <Input placeholder="ระบุชื่อแพทย์" />
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
                    {shiftTypes.map(s => (
                      <Option key={s.admission_change_shift_type_id} value={s.admission_change_shift_type_id}>
                        {s.shift_name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

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
              <Button onClick={closeEditDrawer}>ยกเลิก</Button>
              <Button type="primary" htmlType="submit" icon={<VscSave />} loading={editSubmitting} className="bg-[#006b5f]">
                บันทึกข้อมูล
              </Button>
            </div>
          </Form>
        </Drawer>
      </div>
    </div>
  );
}