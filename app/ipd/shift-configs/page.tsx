'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Modal, DatePicker, Select, message, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import axios from 'axios';
import Navbar from '@/app/components/Navbar';

const { Title } = Typography;
const { Option } = Select;
dayjs.locale('th');

interface StaffRecord {
  id: number;
  name: string;
  position: string;
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

  // โหลด ward list
  useEffect(() => {
    const fetchWards = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.get('/api/v1/wardsV1', { headers });
        const wardList = Array.isArray(response.data) ? response.data : response.data.data || [];
        setWards(wardList);
      } catch (error) {
        console.error("Error fetching wards:", error);
        messageApi.error("ไม่สามารถดึงข้อมูลหอผู้ป่วยได้");
      }
    };
    fetchWards();
  }, [messageApi]);

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

        const reverseShiftCodeMap: Record<string, string> = {
          'M': 'ช',
          'A': 'บ',
          'N': 'ด',
          'M_OT': 'ช(OT8)',
          'A_OT': 'บ(OT8)',
          'N_OT': 'ด(OT8)',
          'M_OT4': 'ช(OT4)',
          'A_OT4': 'บ(OT4)',
          'N_OT4': 'ด(OT4)',
          'OFF': 'OFF'
        };

        const newDutyData: DutyState = {};
        resData.forEach((item: any) => {
          const empId = item.staff_id;
          const day = dayjs(item.shift_date).date(); // แปลงเวลาจาก ISO เป็นตัวเลขวันที่ 1-31
          const shiftStr = reverseShiftCodeMap[item.shift_code] || item.shift_code;

          if (!newDutyData[empId]) newDutyData[empId] = {};
          if (!newDutyData[empId][day]) newDutyData[empId][day] = [];
          newDutyData[empId][day].push(shiftStr);
        });

        setDutyData(newDutyData);
      } catch (error) {
        console.error("Error fetching shift data by date:", error);
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
      const response = await axios.get(`/api/v1/ward-staffs/${value}`, { headers });
      const resData = Array.isArray(response.data) ? response.data : response.data?.data || [];

      const staffRecords: StaffRecord[] = resData.map((s: any) => ({
        id: s.staff_id,
        name: s.fullname,
        position: s.position_name,
      }));

      setDataSource(staffRecords);
    } catch (error) {
      console.error("Error fetching ward staffs:", error);
      messageApi.error("ไม่สามารถดึงรายชื่อเจ้าหน้าที่ได้");
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleCellClick = async (record: StaffRecord, day: number) => {
    // 1. นำข้อมูลเก่าใน state มาแสดงทันทีก่อน เพื่อให้ UI ตอบสนองได้รวดเร็ว (ไม่มีดีเลย์)
    const currentShifts = dutyData[record.id]?.[day] || [];
    setEditingCell({ empId: record.id, day });
    setTempShifts(currentShifts);
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
      
      // 3. แมปกลับจากรหัส DB (M, A, N) เป็นตัวย่อบนหน้าจอ (ช, บ, ด)
      const reverseShiftCodeMap: Record<string, string> = {
        'M': 'ช',
        'A': 'บ',
        'N': 'ด',
        'M_OT': 'ช(OT8)',
        'A_OT': 'บ(OT8)',
        'N_OT': 'ด(OT8)',
        'M_OT4': 'ช(OT4)',
        'A_OT4': 'บ(OT4)',
        'N_OT4': 'ด(OT4)',
        'OFF': 'OFF'
      };

      const fetchedShifts = resData
        .map((s: any) => reverseShiftCodeMap[s.shift_code] || s.shift_code)
        .filter(Boolean); // กรองค่าว่างออก

      // 4. อัปเดตตัวเลือกให้สถานะ Checked ตรงกับข้อมูลที่ดึงมา
      setTempShifts(fetchedShifts);
      
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
        console.error(`API URL Not Found (404): ${error.config?.url}`);
        // แจ้งเตือนแบบเงียบๆ เนื่องจากบางทีอาจจะแปลว่ายังไม่มีเวร
        // messageApi.warning(`ไม่พบ API (404): ${error.config?.url}`);
      } else {
        console.error("Error fetching shift detail:", error);
      }
    }
  };

  const handleModalOk = async () => {
    if (editingCell) {
      if (tempShifts.length === 0) {
        messageApi.warning('ต้องเลือกอย่างน้อย 1 รายการ');
        return;
      }

      // แมปค่าเวรจากหน้าจอให้ตรงกับรหัสในฐานข้อมูล (ปรับได้ตามต้องการ)
      const shiftCodeMap: Record<string, string> = {
        'ช': 'M',
        'บ': 'A',
        'ด': 'N',
        'ช(OT8)': 'M_OT',
        'บ(OT8)': 'A_OT',
        'ด(OT8)': 'N_OT',
        'ช(OT4)': 'M_OT4',
        'บ(OT4)': 'A_OT4',
        'ด(OT4)': 'N_OT4',
        'OFF': 'OFF'
      };

      // 1. จัดเตรียมข้อมูล JSON Payload
      const payload = tempShifts.map(shift => ({
        staff_id: editingCell.empId,
        shift_date: currentDate.date(editingCell.day).format('YYYY-MM-DD'),
        shift_code: shiftCodeMap[shift] || shift,
        ward: selectedWard,
        created_by: 1 // TODO: ควรเปลี่ยนเป็น ID ผู้ล็อกอินใช้งานจริงจาก session หรือ decode จาก token
      }));

      // console.log("Payload to send to API:", JSON.stringify(payload, null, 2));

      // 2. การยิง API เพื่อบันทึกข้อมูล
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        await axios.post('/api/v1/nurse/nurse-schedules', payload, { headers });
        messageApi.success('บันทึกเวรสำเร็จ');
      } catch (error: any) {
        console.error("Error saving shift:", error);
        if (error.response?.status === 404) {
          messageApi.error(`ไม่พบ API (404): ${error.config?.url}`);
        } else {
          messageApi.error('เกิดข้อผิดพลาดในการบันทึกเวร');
        }
        return; // หาก API Error จะไม่อัปเดตตารางและไม่ปิด Modal
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

  const isWeekend = (day: number) => {
    const dayOfWeek = currentDate.date(day).day();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 = วันอาทิตย์, 6 = วันเสาร์
  };

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
      return {
        title: weekend ? <span className="text-yellow-300">{day}</span> : `${day}`,
        dataIndex: 'day_' + day,
        key: day,
        align: 'center' as const,
        className: weekend ? 'bg-slate-100/60' : '',
        render: (_: any, record: StaffRecord) => {
          const shifts = dutyData[record.id]?.[day] || [];
          return (
            <div
              onClick={() => handleCellClick(record, day)}
              className={`cursor-pointer h-8 flex flex-wrap justify-center items-center content-center transition-colors ${weekend ? 'hover:bg-slate-200' : 'hover:bg-blue-50'}`}
            >
              {shifts.length > 0 ? (
                shifts.map((s) => (
                  <span key={s} className={`text-[10px] font-bold mx-0.5 whitespace-nowrap ${
                    s === 'OFF' ? 'text-blue-500' :
                    s.includes('ช') ? 'text-blue-600' :
                    s.includes('บ') ? 'text-orange-500' :
                    s.includes('ด') ? 'text-purple-600' : ''
                  }`}>
                    {s === 'OFF' ? 'x' : s}
                  </span>
                ))
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
      key: 'ช',
      width: 45,
      align: 'center',
      className: 'bg-blue-50 text-blue-600 font-bold',
      render: (_, record) => Object.values(dutyData[record.id] || {}).flat().filter(s => s === 'ช').length || '-',
    },
    {
      title: 'บ่าย',
      key: 'บ',
      width: 45,
      align: 'center',
      className: 'bg-orange-50 text-orange-600 font-bold',
      render: (_, record) => Object.values(dutyData[record.id] || {}).flat().filter(s => s === 'บ').length || '-',
    },
    {
      title: 'ดึก',
      key: 'ด',
      width: 45,
      align: 'center',
      className: 'bg-purple-50 text-purple-600 font-bold',
      render: (_, record) => Object.values(dutyData[record.id] || {}).flat().filter(s => s === 'ด').length || '-',
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
      render: (_, record) => Object.values(dutyData[record.id] || {}).flat().filter(s => s.includes('OT8')).length || '-',
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
      'ช': {},
      'บ': {},
      'ด': {},
      'OFF': {},
      'OT8': {},
      'OT4': {},
      'total': {}
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
        const mCount = shifts.filter(s => s === 'ช').length;
        const aCount = shifts.filter(s => s === 'บ').length;
        const nCount = shifts.filter(s => s === 'ด').length;
        const offCount = shifts.filter(s => s === 'OFF').length;
        const ot8Count = shifts.filter(s => s.includes('OT8')).length;
        const ot4Count = shifts.filter(s => s.includes('OT4')).length;
        const hasShift = shifts.some(s => s !== 'OFF');
        const totalCount = hasShift ? 1 : 0;

        dayTotals['ช'][day] = (dayTotals['ช'][day] || 0) + mCount;
        dayTotals['บ'][day] = (dayTotals['บ'][day] || 0) + aCount;
        dayTotals['ด'][day] = (dayTotals['ด'][day] || 0) + nCount;
        dayTotals['OFF'][day] = (dayTotals['OFF'][day] || 0) + offCount;
        dayTotals['OT8'][day] = (dayTotals['OT8'][day] || 0) + ot8Count;
        dayTotals['OT4'][day] = (dayTotals['OT4'][day] || 0) + ot4Count;
        dayTotals['total'][day] = (dayTotals['total'][day] || 0) + totalCount;
      });

      const allShifts = Object.values(staffShifts).flat();
      grandTotalM += allShifts.filter((s) => s === 'ช').length;
      grandTotalA += allShifts.filter((s) => s === 'บ').length;
      grandTotalN += allShifts.filter((s) => s === 'ด').length;
      grandTotalOFF += allShifts.filter((s) => s === 'OFF').length;
      grandTotalOT8 += allShifts.filter((s) => s.includes('OT8')).length;
      grandTotalOT4 += allShifts.filter((s) => s.includes('OT4')).length;
      grandTotalOverall += Object.values(staffShifts).filter((shifts) => shifts.some((s) => s !== 'OFF')).length;
    });

    return (
      <Table.Summary fixed="bottom">
        <Table.Summary.Row className="bg-blue-50/40 text-xs shadow-[0_-1px_2px_rgba(0,0,0,0.05)]">
          <Table.Summary.Cell index={0} align="right">
            <span className="text-blue-600 font-bold mr-2">รวมเช้า (ช)</span>
          </Table.Summary.Cell>
          {daysArray.map((day, index) => (
            <Table.Summary.Cell key={day} index={index + 1} align="center">
              <span className={dayTotals['ช'][day] > 0 ? "text-blue-600 font-bold" : "text-gray-300"}>
                {dayTotals['ช'][day] > 0 ? dayTotals['ช'][day] : '-'}
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
            <span className="text-orange-500 font-bold mr-2">รวมบ่าย (บ)</span>
          </Table.Summary.Cell>
          {daysArray.map((day, index) => (
            <Table.Summary.Cell key={day} index={index + 1} align="center">
              <span className={dayTotals['บ'][day] > 0 ? "text-orange-500 font-bold" : "text-gray-300"}>
                {dayTotals['บ'][day] > 0 ? dayTotals['บ'][day] : '-'}
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
            <span className="text-purple-600 font-bold mr-2">รวมดึก (ด)</span>
          </Table.Summary.Cell>
          {daysArray.map((day, index) => (
            <Table.Summary.Cell key={day} index={index + 1} align="center">
              <span className={dayTotals['ด'][day] > 0 ? "text-purple-600 font-bold" : "text-gray-300"}>
                {dayTotals['ด'][day] > 0 ? dayTotals['ด'][day] : '-'}
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
            <span className="text-[#006b5f] mr-2">รวมคนขึ้นเวร</span>
          </Table.Summary.Cell>
          {daysArray.map((day, index) => (
            <Table.Summary.Cell key={day} index={index + 1} align="center">
              {dayTotals['total'][day] > 0 ? (
                <span className="text-[#006b5f]">{dayTotals['total'][day]}</span>
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
          <Table.Summary.Cell index={daysInMonth + 7} align="center" className="bg-gray-200 text-[#006b5f] text-[13px]">{grandTotalOverall || '-'}</Table.Summary.Cell>
        </Table.Summary.Row>
      </Table.Summary>
    );
  };

  const shiftIcons: Record<string, React.ReactNode> = {
    'ช': <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" /></svg>,
    'บ': <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" /></svg>,
    'ด': <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" /><path d="M13 6a1 1 0 011-1h.01a1 1 0 110 2H14a1 1 0 01-1-1zM16.5 8a1 1 0 011-1h.01a1 1 0 110 2H17.5a1 1 0 01-1-1zM15 3.5a1 1 0 011-1h.01a1 1 0 110 2H16a1 1 0 01-1-1z" /></svg>,
    'OFF': <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" /></svg>,
  };

  const shiftOptions = [
    { label: 'เวรเช้า (ช)', time: '08:00 - 16:00', value: 'ช', colorText: 'text-blue-600', bgCard: 'bg-blue-50', borderCard: 'border-blue-200', bgIcon: 'bg-blue-500' },
    { label: 'เช้า OT 4 ชม.', time: '', value: 'ช(OT4)', colorText: 'text-blue-600', bgCard: 'bg-blue-50/70', borderCard: 'border-blue-300', bgIcon: 'bg-blue-400' },
    { label: 'เช้า OT 8 ชม.', time: '', value: 'ช(OT8)', colorText: 'text-blue-600', bgCard: 'bg-blue-50', borderCard: 'border-blue-200', bgIcon: 'bg-blue-500' },
    { label: 'เวรบ่าย (บ)', time: '16:00 - 24:00', value: 'บ', colorText: 'text-orange-500', bgCard: 'bg-orange-50', borderCard: 'border-orange-200', bgIcon: 'bg-orange-500' },
    { label: 'บ่าย OT 4 ชม.', time: '', value: 'บ(OT4)', colorText: 'text-orange-500', bgCard: 'bg-orange-50/70', borderCard: 'border-orange-300', bgIcon: 'bg-orange-400' },
    { label: 'บ่าย OT 8 ชม.', time: '', value: 'บ(OT8)', colorText: 'text-orange-500', bgCard: 'bg-orange-50', borderCard: 'border-orange-200', bgIcon: 'bg-orange-500' },
    { label: 'เวรดึก (ด)', time: '24:00 - 08:00', value: 'ด', colorText: 'text-purple-600', bgCard: 'bg-purple-50', borderCard: 'border-purple-200', bgIcon: 'bg-purple-500' },
    { label: 'ดึก OT 4 ชม.', time: '', value: 'ด(OT4)', colorText: 'text-purple-600', bgCard: 'bg-purple-50/70', borderCard: 'border-purple-300', bgIcon: 'bg-purple-400' },
    { label: 'ดึก OT 8 ชม.', time: '', value: 'ด(OT8)', colorText: 'text-purple-600', bgCard: 'bg-purple-50', borderCard: 'border-purple-200', bgIcon: 'bg-purple-500' },
    { label: 'หยุดงาน', time: 'OFF', value: 'OFF', colorText: 'text-gray-500', bgCard: 'bg-slate-50', borderCard: 'border-slate-200', bgIcon: 'bg-gray-500' },
  ];

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      {contextHolder}
      <Navbar />
      <div className="p-6">
        <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <Title level={4} className="mb-0! text-[#006b5f]!">
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
            </div>
            <div className="flex gap-3">
              <span className="text-xs text-blue-600 font-bold">ช: เช้า</span>
              <span className="text-xs text-orange-500 font-bold">บ: บ่าย</span>
              <span className="text-xs text-purple-600 font-bold">ด: ดึก</span>
              <span className="text-xs text-red-500 font-bold">OT8: ล่วงเวลา 8 ชม.</span>
              <span className="text-xs text-red-400 font-bold">OT4: ล่วงเวลา 4 ชม.</span>
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
            width="40%"
            className="[&_.ant-modal-content]:p-0! [&_.ant-modal-content]:rounded-2xl! [&_.ant-modal-content]:overflow-hidden! font-sans"
          >
            <div className="px-6 py-5 border-b border-gray-100 bg-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800 m-0">เลือกเวรปฏิบัติงาน</h3>
                <p className="text-sm text-gray-500 m-0 mt-1">
                  {editingCell
                    ? `วันที่ ${editingCell.day} ${currentDate.format('MMMM')} ${currentDate.year() + 543}`
                    : 'กรุณาเลือกวันที่'}
                </p>
              </div>
              <div className="bg-teal-50 p-2 rounded-full text-[#006b5f]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            <div className="p-6 bg-slate-50/50 max-h-[60vh] overflow-y-auto">
              <div className="w-full grid grid-cols-3 gap-3">
                {shiftOptions.map((option) => {
                  const isChecked = tempShifts.includes(option.value);
                  const isOff = option.value === 'OFF';
                  return (
                    <div
                      key={option.value}
                      style={isOff ? { gridColumn: '1 / -1' } : undefined}
                      onClick={() => {
                        if (!isChecked) {
                          const conflictMap: Record<string, string[]> = {
                            'ช': ['ช(OT8)', 'ช(OT4)'],
                            'ช(OT8)': ['ช', 'ช(OT4)'],
                            'ช(OT4)': ['ช', 'ช(OT8)'],
                            'บ': ['บ(OT8)', 'บ(OT4)'],
                            'บ(OT8)': ['บ', 'บ(OT4)'],
                            'บ(OT4)': ['บ', 'บ(OT8)'],
                            'ด': ['ด(OT8)', 'ด(OT4)'],
                            'ด(OT8)': ['ด', 'ด(OT4)'],
                            'ด(OT4)': ['ด', 'ด(OT8)'],
                          };

                          const conflicts = conflictMap[option.value] || [];
                          const found = conflicts.find(c => tempShifts.includes(c));
                          if (found) {
                            messageApi.warning(`ไม่สามารถเลือก ${option.value} และ ${found} พร้อมกันได้`);
                            return;
                          }
                        }

                        const newShifts = isChecked
                          ? tempShifts.filter((s) => s !== option.value)
                          : [...tempShifts, option.value];
                        setTempShifts(newShifts);
                      }}
                      className={`
                        relative transition-all duration-200 ease-in-out cursor-pointer
                        ${isChecked
                          ? `transform scale-[1.02] ${option.bgCard} ${option.borderCard} shadow-sm`
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'}
                        border rounded-xl
                      `}
                    >
                      <div className="flex items-center w-full p-2 pl-1 select-none">
                        <div className={`
                          w-5 h-5 rounded-full border-2 flex items-center justify-center mr-2 shrink-0 transition-all duration-300
                          ${isChecked ? `${option.bgIcon} border-transparent scale-110` : 'border-gray-200 bg-gray-50'}
                        `}>
                          {isChecked && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`font-bold text-base ${option.colorText} flex items-center gap-1`}>
                              {shiftIcons[option.value.charAt(0)] || shiftIcons[option.value]}
                              {option.value}
                            </span>
                            {option.time && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap ${isChecked ? 'bg-white/60 text-gray-600' : 'bg-gray-100 text-gray-400'}`}>
                                {option.time}
                              </span>
                            )}
                          </div>
                          <div className={`text-xs mt-0.5 font-medium truncate ${isChecked ? 'text-gray-700' : 'text-gray-500'}`}>
                            {option.label}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white! bg-gray-400 hover:bg-gray-500 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleModalOk}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white! bg-[#006b5f] hover:bg-[#00554c] shadow-lg shadow-teal-900/20 active:scale-95 transition-all flex items-center gap-2"
              >
                <span>บันทึกข้อมูล</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </Modal>
        </Card>
      </div>
    </div>
  );
}