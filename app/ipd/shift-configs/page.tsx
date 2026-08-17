'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Modal, DatePicker, Select, message, Spin, Button, Tooltip, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PiMagicWandBold } from 'react-icons/pi';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import axios from 'axios';
import Navbar from '@/app/components/Navbar';

const { Title } = Typography;
const { Option } = Select;

/** ร่างที่ตัวจัดเวรอัตโนมัติคืนมา — ยังไม่ได้บันทึกลงฐานข้อมูล */
interface AutoDraft {
  month: string;
  days_in_month: number;
  assignments: { staff_id: number; shift_date: string; shift_code: string; nurse_shift_type_id: number | null }[];
  summary: { assigned: number; needed: number; locked: number; gap_shifts: number };
  impossible_positions: { staff_position_id: number; shifts_per_day: number }[];
  per_staff: { staff_id: number; fullname: string; code: string; total: number; nights: number; days_off: number }[];
  rules: { maxConsecutiveDays: number; minDaysOffPerMonth: number; forbidNightThenMorning: boolean };
  notes: string[];
}

const HOLIDAY_TYPE_LABEL: Record<string, string> = {
  public: 'วันหยุดราชการ',
  substitution: 'วันหยุดชดเชย',
  special: 'มติ ครม.',
  organization: 'เฉพาะโรงพยาบาล',
};
dayjs.locale('th');

interface StaffRecord {
  id: number;
  name: string;
  position: string;
}

interface NurseShiftType {
  nurse_shift_type_id: number;
  code: string;
  name: string;
  description: string;
  admission_change_shift_type_id: number;
  display_order: number;
}

interface DutyState {
  [empId: number]: {
    [day: number]: string[];
  };
}

interface Ward {
  his_code: string;
  ward_name: string;
}

export default function ShiftMatrix() {
  const [messageApi, contextHolder] = message.useMessage();
  const [currentDate, setCurrentDate] = useState(dayjs());
  const daysInMonth = currentDate.daysInMonth();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<StaffRecord[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const [dutyData, setDutyData] = useState<DutyState>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{ empId: number; day: number } | null>(null);
  const [tempShifts, setTempShifts] = useState<string[]>([]);
  // เจ้าหน้าที่ที่กำลังจัดเวรให้ — ต้องโชว์ชื่อบนหัว modal ไม่งั้นคลิกผิดแถวแล้วไม่รู้ตัว
  const [editingStaff, setEditingStaff] = useState<StaffRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingShift, setSavingShift] = useState(false);
  // id ของเวรที่มีอยู่จริงในฐานข้อมูล ใช้ตอนล้างเวรทั้งวัน
  const [existingIds, setExistingIds] = useState<number[]>([]);
  // ผู้ใช้แตะตัวเลือกไปแล้วหรือยัง — กันข้อมูลที่โหลดมาทีหลังทับสิ่งที่เพิ่งเลือก
  const [touched, setTouched] = useState(false);
  const [shiftTypes, setShiftTypes] = useState<NurseShiftType[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  // วันหยุดที่ประกาศไว้ เก็บเป็น map ของ 'YYYY-MM-DD' เพื่อค้นทีละวันได้เร็ว
  const [holidays, setHolidays] = useState<Record<string, { name: string; type: string }>>({});
  // ร่างตารางเวรที่ตัวจัดอัตโนมัติเสนอมา — ยังไม่ได้บันทึกจนกว่าจะกดยืนยัน
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [draft, setDraft] = useState<AutoDraft | null>(null);

  // โหลด ward list และชั่วโมงเวร
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        try {
          const parts = token?.split('.');
          if (parts && parts.length === 3) {
            const decoded = JSON.parse(atob(parts[1]));
            if (decoded.id) setUserId(String(decoded.id));
          }
        } catch { /* ignore decode error */ }

        const response = await axios.get('/api/v1/system/wardsV1', { headers });
        const wardList = Array.isArray(response.data) ? response.data : response.data?.data || [];
        setWards(wardList);

        const shiftsRes = await axios.get('/api/v1/nurse/nurse-shift-types', { headers });
        if (shiftsRes.data?.success) {
          setShiftTypes(shiftsRes.data.data.sort((a: any, b: any) => a.display_order - b.display_order));
        }
      } catch (error) {
        // console.error("Error fetching initial data:", error);
        messageApi.error("เกิดข้อผิดพลาดในการโหลดข้อมูลเบื้องต้น");
      }
    };
    fetchInitialData();
  }, [messageApi]);

  // วันหยุดผูกกับปี ไม่ใช่หอผู้ป่วย จึงโหลดใหม่เฉพาะตอนข้ามปี ไม่ใช่ทุกครั้งที่เปลี่ยนเดือน
  const viewYear = currentDate.year();
  useEffect(() => {
    const year = viewYear;
    const fetchHolidays = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.get('/api/v1/holidays/', { headers, params: { year } });
        const map: Record<string, { name: string; type: string }> = {};
        for (const h of res.data?.data ?? []) {
          map[h.holiday_date] = { name: h.name_th, type: h.holiday_type };
        }
        setHolidays(map);
      } catch {
        // ไม่มีวันหยุดก็ยังจัดเวรได้ ไม่ต้องรบกวนผู้ใช้ด้วย error
        setHolidays({});
      }
    };
    fetchHolidays();
  }, [viewYear]);

  // โหลดข้อมูลตารางเวรภาพรวมทั้งหมดเมื่อเลือก Ward หรือเปลี่ยนเดือน/ปี
  useEffect(() => {
    const fetchShiftData = async () => {
      if (!selectedWard) return;

      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const response = await axios.post('/api/v1/nurse/nurse-schedule-by-date', {
          ward: selectedWard,
          date: currentDate.format('YYYY-MM')
        }, { headers });

        const resData = response.data?.data || response.data || [];

        const newDutyData: DutyState = {};
        resData.forEach((item: any) => {
          const empId = item.staff_id;
          const day = dayjs(item.shift_date).date(); // แปลงเวลาจาก ISO เป็นตัวเลขวันที่ 1-31
          const shiftStr = item.shift_code; // ใช้ค่า code ตรงๆ

          if (!newDutyData[empId]) newDutyData[empId] = {};
          if (!newDutyData[empId][day]) newDutyData[empId][day] = [];
          newDutyData[empId][day].push(shiftStr);
        });

        setDutyData(newDutyData);
      } catch (error) {
        // console.error("Error fetching shift data by date:", error);
      }
    };

    fetchShiftData();
  }, [selectedWard, currentDate]);

  // โหลดรายชื่อเจ้าหน้าที่เมื่อเลือก ward
  const handleWardChange = async (value: string) => {
    setSelectedWard(value);
    setDataSource([]);
    setDutyData({});
    setLoadingStaff(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`/api/v1/staffs/ward-staffs/${value}`, { headers });
      const resData = Array.isArray(response.data) ? response.data : response.data?.data || [];

      const staffRecords: StaffRecord[] = resData.map((s: any) => ({
        id: s.staff_id,
        name: s.fullname,
        position: s.position_name,
      }));

      setDataSource(staffRecords);
    } catch (error) {
      // console.error("Error fetching ward staffs:", error);
      messageApi.error("ไม่สามารถดึงรายชื่อเจ้าหน้าที่ได้");
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleCellClick = async (record: StaffRecord, day: number) => {
    // 1. นำข้อมูลเก่าใน state มาแสดงทันทีก่อน เพื่อให้ UI ตอบสนองได้รวดเร็ว (ไม่มีดีเลย์)
    const currentShifts = dutyData[record.id]?.[day] || [];
    setEditingCell({ empId: record.id, day });
    setEditingStaff(record);
    setTempShifts(currentShifts);
    setExistingIds([]);
    setTouched(false);
    setLoadingDetail(true);
    setIsModalOpen(true);

    // 2. เรียก API ดึงข้อมูลล่าสุดจากฐานข้อมูล
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const shift_date = currentDate.date(day).format('YYYY-MM-DD');

      // เปลี่ยนจาก GET เป็น POST และแนบข้อมูลไปกับ Body แทน Params
      const response = await axios.post('/api/v1/nurse/nurse-schedule-detail', {
        ward: selectedWard,
        shift_date: shift_date,
        staff_id: record.id
      }, { headers });

      const resData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      
      // 3. เลิกแมปเป็นภาษาไทย ใช้รหัสตรงไปเลยได้เลย
      const fetchedShifts = resData
        .map((s: any) => s.shift_code)
        .filter(Boolean); // กรองค่าว่างออก

      // เก็บ id ไว้ใช้ตอนล้างเวรทั้งวัน — API ลบรับเป็น id เท่านั้น
      setExistingIds(resData.map((s: any) => s.shift_assignment_id).filter(Boolean));

      // 4. อัปเดตตัวเลือกให้สถานะ Checked ตรงกับข้อมูลที่ดึงมา
      //    ข้ามถ้าผู้ใช้กดเลือกไปแล้วระหว่างรอ ไม่งั้นสิ่งที่เพิ่งกดจะถูกทับหายไป
      setTouched(prevTouched => {
        if (!prevTouched) setTempShifts(fetchedShifts);
        return prevTouched;
      });

      // 5. (ทางเลือก) อัปเดตตารางหลักไปพร้อมๆ กัน เผื่อข้อมูลในตารางยังไม่อัปเดต
      setDutyData((prev) => ({
        ...prev,
        [record.id]: {
          ...(prev[record.id] || {}),
          [day]: fetchedShifts,
        },
      }));
    } catch (error: any) {
      if (error.response?.status === 404) {
      } else {
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  /**
   * ล้างเวรของวันนั้นออกทั้งหมด
   *
   * เดิมทำไม่ได้เลย เพราะปุ่มบันทึกบังคับว่าต้องเลือกอย่างน้อย 1 รายการ
   * พอจัดเวรผิดคนหรือผิดวัน จึงได้แค่เปลี่ยนเป็นเวรอื่น เอาออกไม่ได้
   * ต้องใช้ API ลบแยก เพราะ API บันทึกไม่รับรายการว่าง
   */
  const handleClearDay = async () => {
    if (!editingCell) return;
    if (existingIds.length === 0) {
      // ยังไม่เคยบันทึกลงฐานข้อมูล ล้างแค่ตัวเลือกบนจอก็พอ
      setTempShifts([]);
      setTouched(true);
      return;
    }
    setSavingShift(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await axios.delete('/api/v1/nurse/nurse-schedules-delete', { headers, data: existingIds });
      setDutyData((prev) => ({
        ...prev,
        [editingCell.empId]: { ...prev[editingCell.empId], [editingCell.day]: [] },
      }));
      messageApi.success('ล้างเวรของวันนี้แล้ว');
      setIsModalOpen(false);
      setEditingCell(null);
    } catch {
      messageApi.error('ล้างเวรไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSavingShift(false);
    }
  };

  const handleModalOk = async () => {
    if (editingCell) {
      // ไม่เลือกอะไรเลย = ตั้งใจจะเอาเวรออก ส่งไปทางเดียวกับปุ่มล้างเวร
      // API บันทึกไม่รับรายการว่าง เดิมจึงขึ้นเตือนแล้วตัน ทำอะไรต่อไม่ได้
      if (tempShifts.length === 0) {
        await handleClearDay();
        return;
      }
      setSavingShift(true);

      // 1. จัดเตรียมข้อมูล JSON Payload
      const payload = tempShifts.map(shiftCode => {
        const shiftType = shiftTypes.find(t => t.code === shiftCode);
        return {
          staff_id: editingCell.empId,
          shift_date: currentDate.date(editingCell.day).format('YYYY-MM-DD'),
          shift_code: shiftCode,
          nurse_shift_type_id: shiftType?.nurse_shift_type_id ?? 0,
          admission_change_shift_type_id: shiftType?.admission_change_shift_type_id ?? 0,
          description: shiftType?.description ?? '',
          ward: selectedWard,
          created_by: userId
        };
      });

      // 2. การยิง API เพื่อบันทึกข้อมูล
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        await axios.post('/api/v1/nurse/nurse-schedules', payload, { headers });
        messageApi.success('บันทึกเวรสำเร็จ');
      } catch (error: any) {
        if (error.response?.status === 404) {
          messageApi.error(`ไม่พบ API (404): ${error.config?.url}`);
        } else {
          messageApi.error('เกิดข้อผิดพลาดในการบันทึกเวร');
        }
        return; // หาก API Error จะไม่อัปเดตตารางและไม่ปิด Modal
      } finally {
        setSavingShift(false);
      }

      // 3. อัปเดตข้อมูลบนหน้าจอ (UI) เมื่อบันทึกสำเร็จ
      setDutyData((prev) => ({
        ...prev,
        [editingCell.empId]: {
          ...prev[editingCell.empId],
          [editingCell.day]: tempShifts,
        },
      }));
    }
    setIsModalOpen(false);
    setEditingCell(null);
  };

  /*
    ขอร่างตารางเวรจากเซิร์ฟเวอร์ — endpoint นี้อ่านอย่างเดียว ไม่เขียนอะไรลงฐาน
    แยกขั้นตอน "เสนอ" กับ "บันทึก" ออกจากกัน เพราะตารางเวรกระทบรายได้และชีวิตคน
    ไม่ควรมีอะไรลงฐานข้อมูลโดยที่หัวหน้าเวรยังไม่เห็นว่าจะได้อะไร
  */
  const handleGenerate = async () => {
    if (!selectedWard) return;
    setGenerating(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.post('/api/v1/nurse/auto-schedule', {
        ward: selectedWard,
        month: currentDate.format('YYYY-MM'),
      }, { headers });
      setDraft(res.data?.data ?? null);
    } catch (error) {
      const msg = (error as { response?: { data?: { message?: string } } }).response?.data?.message;
      messageApi.error(msg ?? 'สร้างร่างตารางเวรไม่สำเร็จ');
    } finally {
      setGenerating(false);
    }
  };

  /** บันทึกร่างผ่านเส้นทางบันทึกเดิม ไม่ได้เขียนฐานข้อมูลด้วยทางลัดของตัวเอง */
  const handleApplyDraft = async () => {
    if (!draft || !selectedWard) return;
    setApplying(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const payload = draft.assignments.map(a => ({
        staff_id: a.staff_id,
        shift_date: a.shift_date,
        shift_code: a.shift_code,
        nurse_shift_type_id: a.nurse_shift_type_id ?? 0,
        ward: selectedWard,
        created_by: userId,
      }));
      await axios.post('/api/v1/nurse/nurse-schedules', payload, { headers });

      // วาดลงตารางทันที ไม่ต้องรอโหลดใหม่ทั้งเดือน
      setDutyData(prev => {
        const next: DutyState = { ...prev };
        for (const a of draft.assignments) {
          const day = Number(a.shift_date.slice(-2));
          next[a.staff_id] = { ...(next[a.staff_id] ?? {}), [day]: [a.shift_code] };
        }
        return next;
      });
      setDraft(null);
      messageApi.success(`บันทึกตารางเวรแล้ว ${payload.length} เวร`);
    } catch {
      messageApi.error('บันทึกร่างไม่สำเร็จ');
    } finally {
      setApplying(false);
    }
  };

  const isWeekend = (day: number) => {
    const dayOfWeek = currentDate.date(day).day();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 = วันอาทิตย์, 6 = วันเสาร์
  };

  /*
    วันหยุดที่ประกาศ ต่างจากเสาร์–อาทิตย์ตรงที่มองจากปฏิทินไม่ออก
    จึงต้องเน้นให้เห็นชัดกว่า และวันหยุดที่ตรงกับเสาร์–อาทิตย์ให้สีวันหยุดชนะ
    เพราะเป็นข้อมูลที่ผู้จัดเวรยังไม่รู้ ส่วนเสาร์อาทิตย์เขารู้อยู่แล้ว
  */
  const holidayOf = (day: number) => holidays[currentDate.date(day).format('YYYY-MM-DD')];

  const columns: ColumnsType<StaffRecord> = [
    {
      title: 'ชื่อ-สกุล',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 120,
      render: (text, record: StaffRecord) => (
        <div className="leading-tight">
          <div className="font-bold text-xs truncate">{text}</div>
          <div className="text-[10px] text-gray-400 truncate">{record.position}</div>
        </div>
      ),
    },
    ...daysArray.map(day => {
      const weekend = isWeekend(day);
      const holiday = holidayOf(day);
      return {
        title: holiday ? (
          <Tooltip title={`${holiday.name} (${HOLIDAY_TYPE_LABEL[holiday.type] ?? holiday.type})`}>
            <span className="text-rose-200 underline decoration-dotted underline-offset-2">{day}</span>
          </Tooltip>
        ) : weekend ? (
          <span className="text-yellow-300">{day}</span>
        ) : `${day}`,
        dataIndex: 'day_' + day,
        key: day,
        align: 'center' as const,
        className: holiday ? 'bg-rose-100/70' : weekend ? 'bg-slate-100/60' : '',
        render: (_: any, record: StaffRecord) => {
          const shifts = dutyData[record.id]?.[day] || [];
          return (
            <div
              onClick={() => handleCellClick(record, day)}
              className={`cursor-pointer h-8 flex flex-wrap justify-center items-center content-center transition-colors ${
                holiday ? 'hover:bg-rose-200' : weekend ? 'hover:bg-slate-200' : 'hover:bg-blue-50'
              }`}
            >
              {shifts.length > 0 ? (
                shifts.map((s) => {
                  const st = shiftTypes.find(t => t.code === s);
                  const label = st ? st.name : s;
                  const color = s.startsWith('M') ? 'text-blue-600'
                    : s.startsWith('A') ? 'text-orange-500'
                    : s.startsWith('N') ? 'text-purple-600'
                    : 'text-blue-500'; // OFF
                  return (
                    <span key={s} className={`text-[10px] font-bold mx-0.5 whitespace-nowrap ${color}`}>
                      {s === 'OFF' ? 'x' : label}
                    </span>
                  );
                })
              ) : (
                <span className="text-gray-300 text-[10px]">-</span>
              )}
            </div>
          );
        },
      };
    }),
    {
      title: 'เช้า',
      key: 'M',
      width: 45,
      align: 'center',
      className: 'bg-blue-50 text-blue-600 font-bold',
      render: (_, record) => Object.values(dutyData[record.id] || {}).flat().filter(s => s === 'M').length || '-',
    },
    {
      title: 'บ่าย',
      key: 'A',
      width: 45,
      align: 'center',
      className: 'bg-orange-50 text-orange-600 font-bold',
      render: (_, record) => Object.values(dutyData[record.id] || {}).flat().filter(s => s === 'A').length || '-',
    },
    {
      title: 'ดึก',
      key: 'N',
      width: 45,
      align: 'center',
      className: 'bg-purple-50 text-purple-600 font-bold',
      render: (_, record) => Object.values(dutyData[record.id] || {}).flat().filter(s => s === 'N').length || '-',
    },
    {
      title: 'OFF',
      key: 'OFF',
      width: 45,
      align: 'center',
      className: 'bg-gray-100 text-gray-500',
      render: (_, record) => Object.values(dutyData[record.id] || {}).flat().filter(s => s === 'OFF').length || '-',
    },
    {
      title: 'OT8',
      key: 'OT8',
      width: 45,
      align: 'center',
      className: 'bg-red-50 text-red-600 font-bold',
      render: (_, record) => Object.values(dutyData[record.id] || {}).flat().filter(s => s.includes('_OT') && !s.includes('OT4')).length || '-',
    },
    {
      title: 'OT4',
      key: 'OT4',
      width: 45,
      align: 'center',
      className: 'bg-red-50/70 text-red-400 font-bold',
      render: (_, record) => Object.values(dutyData[record.id] || {}).flat().filter(s => s.includes('OT4')).length || '-',
    },
    {
      title: 'รวม',
      key: 'Total',
      width: 45,
      align: 'center',
      className: 'font-bold bg-gray-200',
      render: (_, record) =>
        Object.values(dutyData[record.id] || {}).filter(shifts => shifts.some(s => s !== 'OFF')).length || '-',
    },
  ];

  const summaryNode = (pageData: readonly StaffRecord[]) => {
    const dayTotals: Record<string, Record<number, number>> = {
      'M': {}, 'A': {}, 'N': {}, 'OFF': {}, 'OT8': {}, 'OT4': {}, 'total': {}
    };

    let grandTotalM = 0;
    let grandTotalA = 0;
    let grandTotalN = 0;
    let grandTotalOFF = 0;
    let grandTotalOT8 = 0;
    let grandTotalOT4 = 0;
    let grandTotalOverall = 0;

    pageData.forEach((record) => {
      const staffShifts = dutyData[record.id] || {};

      daysArray.forEach((day) => {
        const shifts = staffShifts[day] || [];
        const mCount = shifts.filter(s => s === 'M').length;
        const aCount = shifts.filter(s => s === 'A').length;
        const nCount = shifts.filter(s => s === 'N').length;
        const offCount = shifts.filter(s => s === 'OFF').length;
        const ot8Count = shifts.filter(s => s.includes('_OT') && !s.includes('OT4')).length;
        const ot4Count = shifts.filter(s => s.includes('OT4')).length;
        const hasShift = shifts.some(s => s !== 'OFF');
        const totalCount = hasShift ? 1 : 0;

        dayTotals['M'][day] = (dayTotals['M'][day] || 0) + mCount;
        dayTotals['A'][day] = (dayTotals['A'][day] || 0) + aCount;
        dayTotals['N'][day] = (dayTotals['N'][day] || 0) + nCount;
        dayTotals['OFF'][day] = (dayTotals['OFF'][day] || 0) + offCount;
        dayTotals['OT8'][day] = (dayTotals['OT8'][day] || 0) + ot8Count;
        dayTotals['OT4'][day] = (dayTotals['OT4'][day] || 0) + ot4Count;
        dayTotals['total'][day] = (dayTotals['total'][day] || 0) + totalCount;
      });

      const allShifts = Object.values(staffShifts).flat();
      grandTotalM += allShifts.filter((s) => s === 'M').length;
      grandTotalA += allShifts.filter((s) => s === 'A').length;
      grandTotalN += allShifts.filter((s) => s === 'N').length;
      grandTotalOFF += allShifts.filter((s) => s === 'OFF').length;
      grandTotalOT8 += allShifts.filter((s) => s.includes('_OT') && !s.includes('OT4')).length;
      grandTotalOT4 += allShifts.filter((s) => s.includes('OT4')).length;
      grandTotalOverall += Object.values(staffShifts).filter((shifts) => shifts.some((s) => s !== 'OFF')).length;
    });

    return (
      <Table.Summary fixed="bottom">
        <Table.Summary.Row className="bg-blue-50/40 text-xs shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
          <Table.Summary.Cell index={0} align="right">
            <span className="text-blue-600 font-bold mr-2">รวมเช้า (M)</span>
          </Table.Summary.Cell>
          {daysArray.map((day, index) => (
            <Table.Summary.Cell key={day} index={index + 1} align="center">
              <span className={dayTotals['M'][day] > 0 ? "text-blue-600 font-bold" : "text-gray-300"}>
                {dayTotals['M'][day] > 0 ? dayTotals['M'][day] : '-'}
              </span>
            </Table.Summary.Cell>
          ))}
          <Table.Summary.Cell index={daysInMonth + 1} align="center" className="bg-blue-50 text-blue-600 font-bold">{grandTotalM || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 2} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 3} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 4} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 5} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 6} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 7} align="center" className="text-gray-300">-</Table.Summary.Cell>
        </Table.Summary.Row>

        <Table.Summary.Row className="bg-orange-50/40 text-xs">
          <Table.Summary.Cell index={0} align="right">
            <span className="text-orange-500 font-bold mr-2">รวมบ่าย (A)</span>
          </Table.Summary.Cell>
          {daysArray.map((day, index) => (
            <Table.Summary.Cell key={day} index={index + 1} align="center">
              <span className={dayTotals['A'][day] > 0 ? "text-orange-500 font-bold" : "text-gray-300"}>
                {dayTotals['A'][day] > 0 ? dayTotals['A'][day] : '-'}
              </span>
            </Table.Summary.Cell>
          ))}
          <Table.Summary.Cell index={daysInMonth + 1} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 2} align="center" className="bg-orange-50 text-orange-600 font-bold">{grandTotalA || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 3} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 4} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 5} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 6} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 7} align="center" className="text-gray-300">-</Table.Summary.Cell>
        </Table.Summary.Row>

        <Table.Summary.Row className="bg-purple-50/40 text-xs">
          <Table.Summary.Cell index={0} align="right">
            <span className="text-purple-600 font-bold mr-2">รวมดึก (N)</span>
          </Table.Summary.Cell>
          {daysArray.map((day, index) => (
            <Table.Summary.Cell key={day} index={index + 1} align="center">
              <span className={dayTotals['N'][day] > 0 ? "text-purple-600 font-bold" : "text-gray-300"}>
                {dayTotals['N'][day] > 0 ? dayTotals['N'][day] : '-'}
              </span>
            </Table.Summary.Cell>
          ))}
          <Table.Summary.Cell index={daysInMonth + 1} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 2} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 3} align="center" className="bg-purple-50 text-purple-600 font-bold">{grandTotalN || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 4} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 5} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 6} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 7} align="center" className="text-gray-300">-</Table.Summary.Cell>
        </Table.Summary.Row>

        <Table.Summary.Row className="bg-slate-100/50 text-xs">
          <Table.Summary.Cell index={0} align="right">
            <span className="text-gray-500 font-bold mr-2">รวม OFF</span>
          </Table.Summary.Cell>
          {daysArray.map((day, index) => (
            <Table.Summary.Cell key={day} index={index + 1} align="center">
              <span className={dayTotals['OFF'][day] > 0 ? "text-gray-500 font-bold" : "text-gray-300"}>
                {dayTotals['OFF'][day] > 0 ? dayTotals['OFF'][day] : '-'}
              </span>
            </Table.Summary.Cell>
          ))}
          <Table.Summary.Cell index={daysInMonth + 1} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 2} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 3} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 4} align="center" className="bg-gray-100 text-gray-500 font-bold">{grandTotalOFF || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 5} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 6} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 7} align="center" className="text-gray-300">-</Table.Summary.Cell>
        </Table.Summary.Row>

        <Table.Summary.Row className="bg-red-50/40 text-xs">
          <Table.Summary.Cell index={0} align="right">
            <span className="text-red-500 font-bold mr-2">รวม OT8</span>
          </Table.Summary.Cell>
          {daysArray.map((day, index) => (
            <Table.Summary.Cell key={day} index={index + 1} align="center">
              <span className={dayTotals['OT8'][day] > 0 ? "text-red-500 font-bold" : "text-gray-300"}>
                {dayTotals['OT8'][day] > 0 ? dayTotals['OT8'][day] : '-'}
              </span>
            </Table.Summary.Cell>
          ))}
          <Table.Summary.Cell index={daysInMonth + 1} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 2} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 3} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 4} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 5} align="center" className="bg-red-50 text-red-600 font-bold">{grandTotalOT8 || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 6} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 7} align="center" className="text-gray-300">-</Table.Summary.Cell>
        </Table.Summary.Row>

        <Table.Summary.Row className="bg-red-50/30 text-xs">
          <Table.Summary.Cell index={0} align="right">
            <span className="text-red-400 font-bold mr-2">รวม OT4</span>
          </Table.Summary.Cell>
          {daysArray.map((day, index) => (
            <Table.Summary.Cell key={day} index={index + 1} align="center">
              <span className={dayTotals['OT4'][day] > 0 ? "text-red-400 font-bold" : "text-gray-300"}>
                {dayTotals['OT4'][day] > 0 ? dayTotals['OT4'][day] : '-'}
              </span>
            </Table.Summary.Cell>
          ))}
          <Table.Summary.Cell index={daysInMonth + 1} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 2} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 3} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 4} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 5} align="center" className="text-gray-300">-</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 6} align="center" className="bg-red-50/70 text-red-400 font-bold">{grandTotalOT4 || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 7} align="center" className="text-gray-300">-</Table.Summary.Cell>
        </Table.Summary.Row>

        <Table.Summary.Row className="bg-teal-50/50 font-bold text-xs shadow-[0_-1px_2px_rgba(0,0,0,0.05)] border-t-2 border-white">
          <Table.Summary.Cell index={0} align="right">
            <span className="text-[var(--brand-text)] mr-2">รวมคนขึ้นเวร</span>
          </Table.Summary.Cell>
          {daysArray.map((day, index) => (
            <Table.Summary.Cell key={day} index={index + 1} align="center">
              {dayTotals['total'][day] > 0 ? (
                <span className="text-[var(--brand-text)]">{dayTotals['total'][day]}</span>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </Table.Summary.Cell>
          ))}
          <Table.Summary.Cell index={daysInMonth + 1} align="center" className="bg-blue-50/50 text-blue-600">{grandTotalM || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 2} align="center" className="bg-orange-50/50 text-orange-600">{grandTotalA || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 3} align="center" className="bg-purple-50/50 text-purple-600">{grandTotalN || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 4} align="center" className="bg-gray-50 text-gray-500">{grandTotalOFF || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 5} align="center" className="bg-red-50/50 text-red-600">{grandTotalOT8 || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 6} align="center" className="bg-red-50/30 text-red-400">{grandTotalOT4 || '-'}</Table.Summary.Cell>
          <Table.Summary.Cell index={daysInMonth + 7} align="center" className="bg-gray-200 text-[var(--brand-text)] text-[13px]">{grandTotalOverall || '-'}</Table.Summary.Cell>
        </Table.Summary.Row>
      </Table.Summary>
    );
  };

  // icon ตาม prefix ของ shift code
  const getShiftIcon = (code: string) => {
    if (code === 'OFF') return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" /></svg>;
    if (code.startsWith('M')) return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" /></svg>;
    return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" /></svg>;
  };

  /**
   * เลือก/ยกเลิกเวรหนึ่งตัว
   *
   * เดิมถ้ากดตัวที่ชนกัน (เช่น ช อยู่แล้วกด ช8) จะขึ้นเตือนแล้วไม่ทำอะไร
   * ผู้ใช้ต้องกดยกเลิกตัวเดิมก่อนแล้วค่อยกดตัวใหม่ ซึ่งเสียเวลาโดยไม่จำเป็น
   * เปลี่ยนเป็นสลับให้เลย เพราะในเวรเดียวกันเลือกได้แบบเดียวอยู่แล้ว
   * ส่วน OFF คือไม่ขึ้นเวร จึงอยู่ร่วมกับเวรอื่นไม่ได้ — เดิมเลือกพร้อมกันได้ซึ่งไม่ถูก
   */
  const toggleShift = (code: string) => {
    setTouched(true);
    const target = shiftTypes.find(t => t.code === code);
    setTempShifts(prev => {
      if (prev.includes(code)) return prev.filter(c => c !== code);
      if (code === 'OFF') return ['OFF'];
      const sameShift = shiftTypes
        .filter(t => t.admission_change_shift_type_id === target?.admission_change_shift_type_id)
        .map(t => t.code);
      return [...prev.filter(c => c !== 'OFF' && !sameShift.includes(c)), code];
    });
  };

  /** จัดกลุ่มตัวเลือกตามเวร (เช้า/บ่าย/ดึก) ให้กวาดตาหาได้เร็วกว่ารายการ 10 ช่องเรียงกันรวด */
  const shiftGroups = (() => {
    const sorted = [...shiftTypes].sort((a, b) => a.display_order - b.display_order);
    const groups: { id: number; label: string; items: NurseShiftType[] }[] = [];
    const labelOf: Record<number, string> = { 1: 'เวรดึก', 2: 'เวรเช้า', 3: 'เวรบ่าย', 0: 'ไม่ขึ้นเวร' };
    sorted.forEach(t => {
      const id = t.admission_change_shift_type_id;
      const found = groups.find(g => g.id === id);
      if (found) found.items.push(t);
      else groups.push({ id, label: labelOf[id] ?? 'อื่นๆ', items: [t] });
    });
    return groups;
  })();

  // derive สี/สไตล์จาก code prefix
  const getShiftStyle = (code: string) => {
    if (code === 'OFF') return { colorText: 'text-gray-500', bgCard: 'bg-slate-50', borderCard: 'border-slate-200', bgIcon: 'bg-gray-500' };
    const isOT = code.includes('_OT');
    if (code.startsWith('M')) return isOT
      ? { colorText: 'text-blue-600', bgCard: 'bg-blue-50/70', borderCard: 'border-blue-300', bgIcon: 'bg-blue-400' }
      : { colorText: 'text-blue-600', bgCard: 'bg-blue-50', borderCard: 'border-blue-200', bgIcon: 'bg-blue-500' };
    if (code.startsWith('A')) return isOT
      ? { colorText: 'text-orange-500', bgCard: 'bg-orange-50/70', borderCard: 'border-orange-300', bgIcon: 'bg-orange-400' }
      : { colorText: 'text-orange-500', bgCard: 'bg-orange-50', borderCard: 'border-orange-200', bgIcon: 'bg-orange-500' };
    if (code.startsWith('N')) return isOT
      ? { colorText: 'text-purple-600', bgCard: 'bg-purple-50/70', borderCard: 'border-purple-300', bgIcon: 'bg-purple-400' }
      : { colorText: 'text-purple-600', bgCard: 'bg-purple-50', borderCard: 'border-purple-200', bgIcon: 'bg-purple-500' };
    return { colorText: 'text-gray-500', bgCard: 'bg-gray-50', borderCard: 'border-gray-200', bgIcon: 'bg-gray-400' };
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      {contextHolder}
      <Navbar />
      <div className="p-6">
        <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <Title level={4} className="mb-0! text-[var(--brand-text)]!">
                ตารางเวร {currentDate.format('MMMM')} {currentDate.year() + 543}
              </Title>
              <Select
                placeholder="เลือกหอผู้ป่วย"
                style={{ width: 220 }}
                value={selectedWard}
                onChange={handleWardChange}
                showSearch
                optionFilterProp="children"
              >
                {wards.map(w => <Option key={w.his_code} value={w.his_code}>{w.ward_name}</Option>)}
              </Select>
              <DatePicker
                picker="month"
                value={currentDate}
                onChange={(date) => date && setCurrentDate(date)}
                allowClear={false}
              />
              <Tooltip title={selectedWard ? 'สร้างร่างตารางเวรจากอัตรากำลังที่ตั้งไว้' : 'เลือกหอผู้ป่วยก่อน'}>
                <Button
                  icon={<PiMagicWandBold />}
                  disabled={!selectedWard || generating}
                  loading={generating}
                  onClick={handleGenerate}
                >
                  จัดเวรอัตโนมัติ
                </Button>
              </Tooltip>
            </div>
            <div className="flex gap-3">
              <span className="text-xs text-blue-600 font-bold">ช: เช้า</span>
              <span className="text-xs text-orange-500 font-bold">บ: บ่าย</span>
              <span className="text-xs text-purple-600 font-bold">ด: ดึก</span>
              <span className="text-xs text-red-500 font-bold">OT8: ล่วงเวลา 8 ชม.</span>
              <span className="text-xs text-red-400 font-bold">OT4: ล่วงเวลา 4 ชม.</span>
              <span className="text-xs text-gray-500 font-bold flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-slate-200 border border-slate-300" />
                เสาร์–อาทิตย์
              </span>
              <span className="text-xs text-rose-500 font-bold flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-rose-200 border border-rose-300" />
                วันหยุด
              </span>
            </div>
          </div>

          {!selectedWard ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
              กรุณาเลือกหอผู้ป่วยเพื่อแสดงตารางเวร
            </div>
          ) : loadingStaff ? (
            <div className="flex justify-center items-center py-16">
              <Spin size="large" />
            </div>
          ) : dataSource.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-lg border border-dashed border-gray-300">
              ไม่พบรายชื่อเจ้าหน้าที่ในหอผู้ป่วยนี้
            </div>
          ) : (
            <Table
              dataSource={dataSource}
              columns={columns}
              pagination={false}
              scroll={{ x: 'max-content' }}
              bordered
              size="small"
              rowKey="id"
              summary={summaryNode}
              className="
                [&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]!
                [&_.ant-table-thead_.ant-table-cell]:text-white!
                [&_.ant-table-thead_.ant-table-cell]:font-semibold!
                [&_.ant-table-thead_.ant-table-cell]:border-r-white/20!
                [&_.ant-table-cell]:px-0.5!
                [&_.ant-table-cell]:py-1.5!
                text-xs
                shadow-sm
              "
            />
          )}

          <Modal
            open={isModalOpen}
            onOk={handleModalOk}
            onCancel={() => setIsModalOpen(false)}
            footer={null}
            closable={false}
            centered
            /* เดิมกำหนด 40% ซึ่งบนจอเล็กจะแคบจนกดไม่ถูก และบนจอกว้างมากจะยืดเกินจำเป็น */
            width={520}
            style={{ maxWidth: 'calc(100vw - 32px)' }}
            mask={{ closable: !savingShift }}
            className="[&_.ant-modal-content]:p-0! [&_.ant-modal-content]:rounded-2xl! [&_.ant-modal-content]:overflow-hidden! font-sans"
          >
            {/*
              หัว modal ต้องบอกว่ากำลังจัดเวรให้ "ใคร"
              เดิมบอกแต่วันที่ พอคลิกผิดแถวในตารางที่มีเจ้าหน้าที่หลายสิบคน
              จะไม่มีทางรู้เลยจนกว่าจะบันทึกไปแล้ว
            */}
            <div className="px-5 py-4 border-b border-gray-100 bg-white flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-800 m-0 truncate">
                  {editingStaff?.name ?? 'เลือกเวรปฏิบัติงาน'}
                </h3>
                <p className="text-sm text-gray-500 m-0 mt-0.5">
                  {editingStaff?.position && (
                    <span className="text-gray-400">{editingStaff.position} · </span>
                  )}
                  {editingCell
                    ? `${currentDate.date(editingCell.day).format('dddd D MMMM')} ${currentDate.year() + 543}`
                    : 'กรุณาเลือกวันที่'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={savingShift}
                aria-label="ปิด"
                className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 bg-slate-50/50 max-h-[60vh] overflow-y-auto">
              {/* ต้องเป็น div ไม่ใช่ p เพราะ Spin ของ antd วาดออกมาเป็น div
                  ซึ่งอยู่ใน p ไม่ได้ตามกฎ HTML แล้วจะทำให้ hydration พัง */}
              {loadingDetail && (
                <div className="text-xs text-gray-400 mb-3 flex items-center gap-2">
                  <Spin size="small" /> กำลังตรวจเวรล่าสุดจากฐานข้อมูล
                </div>
              )}

              {/*
                จัดกลุ่มตามเวร แทนการวางเรียง 10 ช่องรวดเดียว
                เวรหนึ่งมีทั้งแบบเต็ม OT8 และ OT4 ถ้าไม่แยกกลุ่มจะกวาดตาหาไม่เจอ
                ว่าอันไหนเป็นพวกเดียวกัน และมองไม่ออกว่าเลือกได้แค่แบบเดียวต่อเวร
              */}
              <div className="flex flex-col gap-3">
                {shiftGroups.map(group => {
                  const picked = group.items.find(t => tempShifts.includes(t.code));
                  return (
                    <div key={group.id}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-semibold text-gray-500">{group.label}</span>
                        {picked && (
                          <span className="text-[10px] text-gray-400">เลือก {picked.name} แล้ว</span>
                        )}
                      </div>
                      <div className={`grid gap-2 ${group.items.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
                        {group.items.map(shiftType => {
                          const isChecked = tempShifts.includes(shiftType.code);
                          const style = getShiftStyle(shiftType.code);
                          return (
                            <div
                              key={shiftType.code}
                              role="checkbox"
                              aria-checked={isChecked}
                              tabIndex={0}
                              onClick={() => toggleShift(shiftType.code)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleShift(shiftType.code);
                                }
                              }}
                              className={`
                                relative transition-all duration-200 ease-in-out cursor-pointer
                                focus:outline-none focus:ring-2 focus:ring-[#006b5f]/40
                                ${isChecked
                                  ? `${style.bgCard} ${style.borderCard} shadow-sm`
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'}
                                border rounded-xl
                              `}
                            >
                              <div className="flex items-center w-full p-2 pl-1 select-none">
                                <div className={`
                                  w-5 h-5 rounded-full border-2 flex items-center justify-center mr-2 shrink-0 transition-all duration-300
                                  ${isChecked ? `${style.bgIcon} border-transparent scale-110` : 'border-gray-200 bg-gray-50'}
                                `}>
                                  {isChecked && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className={`font-bold text-base ${style.colorText} flex items-center gap-1`}>
                                      {getShiftIcon(shiftType.code)}
                                      {shiftType.name}
                                    </span>
                                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap font-mono ${isChecked ? 'bg-white/60 text-gray-600 dark:bg-black/30 dark:text-white' : 'bg-gray-100 text-gray-400'}`}>
                                      {shiftType.code}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex items-center gap-3 rounded-b-2xl">
              {/* ล้างเวรทั้งวัน — เดิมทำไม่ได้เลย จัดผิดคนแล้วได้แค่เปลี่ยนเป็นเวรอื่น */}
              <button
                onClick={handleClearDay}
                disabled={savingShift || (tempShifts.length === 0 && existingIds.length === 0)}
                className="px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ล้างเวรวันนี้
              </button>
              <span className="text-xs text-gray-400 ml-auto hidden sm:inline">
                {tempShifts.length > 0 ? `เลือกไว้ ${tempShifts.length} รายการ` : 'ยังไม่ได้เลือก'}
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={savingShift}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white! bg-gray-400 hover:bg-gray-500 transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleModalOk}
                disabled={savingShift}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white! bg-[#006b5f] hover:bg-[#00554c] shadow-lg shadow-teal-900/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 disabled:active:scale-100"
              >
                <span>{savingShift ? 'กำลังบันทึก' : 'บันทึกข้อมูล'}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </Modal>

          {/* หน้าตรวจร่างก่อนบันทึก — ตั้งใจให้เห็นตัวเลขที่สำคัญครบก่อนตัดสินใจ */}
          <Modal
            title="ร่างตารางเวรอัตโนมัติ"
            open={draft !== null}
            onCancel={() => setDraft(null)}
            width={720}
            style={{ maxWidth: 'calc(100vw - 32px)' }}
            okText={`บันทึก ${draft?.assignments.length ?? 0} เวรลงตาราง`}
            cancelText="ทิ้งร่างนี้"
            onOk={handleApplyDraft}
            confirmLoading={applying}
            okButtonProps={{ className: 'bg-[#006b5f]', disabled: (draft?.assignments.length ?? 0) === 0 }}
          >
            {draft && (
              <div className="flex flex-col gap-4 mt-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  {[
                    { label: 'ต้องการตามโควตา', value: draft.summary.needed, cls: 'text-gray-600' },
                    { label: 'จัดให้ได้', value: draft.summary.assigned, cls: 'text-emerald-600' },
                    { label: 'เติมไม่ได้', value: draft.summary.gap_shifts, cls: 'text-red-500' },
                    { label: 'จัดมือไว้ก่อน', value: draft.summary.locked, cls: 'text-blue-500' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded-lg p-2">
                      <div className={`text-lg font-bold ${s.cls}`}>{s.value}</div>
                      <div className="text-[11px] text-gray-500">{s.label}</div>
                    </div>
                  ))}
                </div>

                {draft.impossible_positions.length > 0 && (
                  <Alert
                    type="error"
                    showIcon
                    title="มีตำแหน่งที่ไม่มีเจ้าหน้าที่ในหอนี้เลย"
                    description={
                      <span>
                        โควตาขอไว้แต่ไม่มีคนให้จัด รวม{' '}
                        <b>{draft.impossible_positions.reduce((a, p) => a + p.shifts_per_day, 0)}</b> เวรต่อวัน —
                        แก้ด้วยการจัดเวรไม่ได้ ต้องแก้ที่อัตรากำลังหรือเพิ่มคนเข้าหอ
                      </span>
                    }
                  />
                )}

                <Alert
                  type="warning"
                  showIcon
                  title="ยังไม่ได้ตรวจวันลา"
                  description="ระบบลายังไม่มีข้อมูล กรุณาตรวจว่าไม่มีใครถูกจัดเวรทับวันลาก่อนบันทึก"
                />

                <div>
                  <div className="text-sm font-semibold text-gray-700 mb-1">ภาระงานรายคน</div>
                  <div className="max-h-56 overflow-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr className="text-gray-500">
                          <th className="text-left p-2 font-medium">ชื่อ</th>
                          <th className="p-2 font-medium">ตำแหน่ง</th>
                          <th className="p-2 font-medium">รวมเวร</th>
                          <th className="p-2 font-medium">เวรดึก</th>
                          <th className="p-2 font-medium">วันหยุด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.per_staff.map(s => (
                          <tr key={s.staff_id} className="border-t border-gray-100">
                            <td className="p-2">{s.fullname}</td>
                            <td className="p-2 text-center text-gray-500">{s.code}</td>
                            <td className="p-2 text-center font-semibold">{s.total}</td>
                            <td className="p-2 text-center">{s.nights}</td>
                            <td className="p-2 text-center text-gray-500">{s.days_off}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 leading-relaxed">
                  กติกาที่ใช้: ไม่ลงดึกติดเช้า · ขึ้นติดต่อกันไม่เกิน {draft.rules.maxConsecutiveDays} วัน ·
                  หยุดอย่างน้อย {draft.rules.minDaysOffPerMonth} วัน/เดือน · จัดเฉพาะเวรปกติ ไม่รวม OT ·
                  เวรที่จัดด้วยมือไว้แล้วถูกคงไว้ทั้งหมด
                </div>
              </div>
            )}
          </Modal>
        </Card>
      </div>
    </div>
  );
}