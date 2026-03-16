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
  ward: string;
  name: string;
}

export default function ShiftMatrix() {
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
        const response = await axios.get('/api/v1/wards', { headers });
        const wardList = Array.isArray(response.data) ? response.data : response.data.data || [];
        setWards(wardList);
      } catch (error) {
        console.error("Error fetching wards:", error);
        message.error("ไม่สามารถดึงข้อมูลหอผู้ป่วยได้");
      }
    };
    fetchWards();
  }, []);

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
      message.error("ไม่สามารถดึงรายชื่อเจ้าหน้าที่ได้");
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleCellClick = (record: StaffRecord, day: number) => {
    const currentShifts = dutyData[record.id]?.[day] || [];
    setEditingCell({ empId: record.id, day });
    setTempShifts(currentShifts);
    setIsModalOpen(true);
  };

  const handleModalOk = () => {
    if (editingCell) {
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
    ...daysArray.map(day => ({
      title: `${day}`,
      dataIndex: 'day_' + day,
      key: day,
      align: 'center' as const,
      render: (_: any, record: StaffRecord) => {
        const shifts = dutyData[record.id]?.[day] || [];
        return (
          <div
            onClick={() => handleCellClick(record, day)}
            className="cursor-pointer h-8 flex flex-wrap justify-center items-center content-center hover:bg-blue-50 transition-colors"
          >
            {shifts.length > 0 ? (
              shifts.map((s) => (
                <span key={s} className={`text-[10px] font-bold mx-0.5 ${
                  s === 'OFF' ? 'text-gray-300' :
                  s === 'M' ? 'text-blue-600' :
                  s === 'A' ? 'text-orange-500' :
                  s === 'N' ? 'text-purple-600' : 'text-red-500'
                }`}>
                  {s === 'OFF' ? 'x' : s}
                </span>
              ))
            ) : (
              <span className="text-gray-200 text-[10px]">-</span>
            )}
          </div>
        );
      },
    })),
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
      title: '12H',
      key: '12H',
      width: 45,
      align: 'center',
      className: 'bg-red-50 text-red-600 font-bold',
      render: (_, record) => Object.values(dutyData[record.id] || {}).flat().filter(s => s === '12H').length || '-',
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
      title: 'รวม',
      key: 'Total',
      width: 45,
      align: 'center',
      className: 'font-bold bg-gray-200',
      render: (_, record) =>
        Object.values(dutyData[record.id] || {}).flat().filter(s => s !== 'OFF').length || '-',
    },
  ];

  const shiftOptions = [
    { label: 'เวรเช้า (M)', time: '08:00 - 16:00', value: 'M', colorText: 'text-blue-600', bgCard: 'bg-blue-50', borderCard: 'border-blue-200', bgIcon: 'bg-blue-500' },
    { label: 'เวรบ่าย (A)', time: '16:00 - 24:00', value: 'A', colorText: 'text-orange-500', bgCard: 'bg-orange-50', borderCard: 'border-orange-200', bgIcon: 'bg-orange-500' },
    { label: 'เวรดึก (N)', time: '24:00 - 08:00', value: 'N', colorText: 'text-purple-600', bgCard: 'bg-purple-50', borderCard: 'border-purple-200', bgIcon: 'bg-purple-500' },
    { label: '12 ชั่วโมง', time: '08:00 - 20:00', value: '12H', colorText: 'text-red-500', bgCard: 'bg-red-50', borderCard: 'border-red-200', bgIcon: 'bg-red-500' },
    { label: 'หยุดงาน', time: 'OFF', value: 'OFF', colorText: 'text-gray-500', bgCard: 'bg-slate-50', borderCard: 'border-slate-200', bgIcon: 'bg-gray-500' },
  ];

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
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
                {wards.map(w => <Option key={w.ward} value={w.ward}>{w.name}</Option>)}
              </Select>
              <DatePicker
                picker="month"
                value={currentDate}
                onChange={(date) => date && setCurrentDate(date)}
                allowClear={false}
              />
            </div>
            <div className="flex gap-3">
              <span className="text-xs text-blue-600 font-bold">M: เช้า</span>
              <span className="text-xs text-orange-500 font-bold">A: บ่าย</span>
              <span className="text-xs text-purple-600 font-bold">N: ดึก</span>
              <span className="text-xs text-red-500 font-bold">12H: 12 ชม.</span>
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
            width="50%"
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
              <div className="w-full flex flex-col gap-3">
                {shiftOptions.map((option) => {
                  const isChecked = tempShifts.includes(option.value);
                  return (
                    <div
                      key={option.value}
                      onClick={() => {
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
                          w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-all duration-300
                          ${isChecked ? `${option.bgIcon} border-transparent scale-110` : 'border-gray-200 bg-gray-50'}
                        `}>
                          {isChecked && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`font-bold text-lg ${option.colorText}`}>{option.value}</span>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-md ${isChecked ? 'bg-white/60 text-gray-600' : 'bg-gray-100 text-gray-400'}`}>
                              {option.time}
                            </span>
                          </div>
                          <div className={`text-sm mt-0.5 font-medium ${isChecked ? 'text-gray-700' : 'text-gray-500'}`}>
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
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleModalOk}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#006b5f] hover:bg-[#00554c] shadow-lg shadow-teal-900/20 active:scale-95 transition-all flex items-center gap-2"
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