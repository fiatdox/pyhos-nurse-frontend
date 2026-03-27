"use client"
import React, { useState, useEffect } from 'react';
import { Table, Card, Select, Typography, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import 'antd/dist/reset.css'; // อย่าลืม import css ของ antd (ถ้าใช้เวอร์ชัน 5 ไม่ต้องใช้บรรทัดนี้)
import Navbar from '../../components/Navbar';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title } = Typography;

interface Ward {
  ward: number;
  ward_name: string;
  his_code: string;
}

const ScheduleTableAntd = () => {
  // กำหนดโครงสร้างคอลัมน์ (Columns)
  const columns: ColumnsType<any> = [
    {
      title: 'วันที่',
      dataIndex: 'date',
      key: 'date',
      align: 'center',
      width: 50,
      // ฟังก์ชัน render เพื่อทำ RowSpan ผสาน 3 เวรเข้าด้วยกัน
      render: (value) => <strong>{value}</strong>,
      onCell: (record) => {
        if (record.indexInDay === 0) {
          return { rowSpan: 3 }; // ถ้าเป็นเวรแรกของวัน (indexInDay === 0) ให้กินพื้นที่ 3 แถว
        }
        return { rowSpan: 0 }; // แถวอื่นๆ ให้ถูกซ่อนไป (RowSpan = 0)
      },
    },
    {
      title: 'เวร',
      dataIndex: 'shift',
      key: 'shift',
      align: 'center',
      width: 50,
      onCell: (record) => {
        // แต่งสีพื้นหลังแยกตามเวร
        let bgColor = '#ffffff';
        if (record.shift === 'N') bgColor = '#e6f7ff';
        if (record.shift === 'D') bgColor = '#fff7e6';
        if (record.shift === 'E') bgColor = '#fff1f0';
        return { style: { backgroundColor: bgColor, fontWeight: 'bold' } };
      }
    },
    {
      title: 'ยอดผป.ที่\nเครื่องช่วย\nหายใจ',
      dataIndex: 'ptIn',
      key: 'ptIn',
      align: 'center',
      width: 80,
    },
    {
      title: 'ยอดผป.ที่ใช้\nเครื่องช่วย\nหายใจ',
      dataIndex: 'ptVent',
      key: 'ptVent',
      align: 'center',
      width: 80,
    },
    {
      title: 'FTE',
      dataIndex: 'fte',
      key: 'fte',
      align: 'center',
      width: 60,
    },
    {
      title: 'ขึ้นตามตารางเวร',
      // ใช้ children เพื่อสร้าง Header ซ้อนกัน (Nested Header)
      children: [
        {
          title: 'ไม่ใช่ OT',
          children: [
            { title: 'RN', dataIndex: 'noOtRn', key: 'noOtRn', align: 'center', width: 40, className: 'text-red-500' },
            { title: 'TN', dataIndex: 'noOtTn', key: 'noOtTn', align: 'center', width: 40, className: 'text-blue-500' },
            { title: 'PN', dataIndex: 'noOtPn', key: 'noOtPn', align: 'center', width: 40, className: 'text-blue-500' },
          ],
        },
        {
          title: 'OT',
          children: [
            { title: 'RN', dataIndex: 'otRn', key: 'otRn', align: 'center', width: 40, className: 'text-blue-500' },
            { title: 'TN', dataIndex: 'otTn', key: 'otTn', align: 'center', width: 40, className: 'text-blue-500' },
            { title: 'PN', dataIndex: 'otPn', key: 'otPn', align: 'center', width: 40, className: 'text-blue-500' },
          ],
        },
      ],
    },
    {
      title: 'OT\nเสริม',
      dataIndex: 'extraOt',
      key: 'extraOt',
      align: 'center',
      width: 60,
    },
    {
      title: '-ขาด/+\nเกิน',
      dataIndex: 'diff',
      key: 'diff',
      align: 'center',
      width: 70,
      render: (val) => (
        <span style={{ color: val < 0 ? 'red' : 'inherit' }}>{val}</span>
      ),
    },
    {
      title: 'product',
      dataIndex: 'prod1',
      key: 'prod1',
      align: 'center',
      width: 80,
      onCell: () => ({ style: { backgroundColor: '#f0f5ff' } }),
    },
    {
      title: 'ประเภทผู้ป่วย',
      children: [
        { title: '1', dataIndex: 't1', key: 't1', align: 'center', width: 40 },
        { title: '2', dataIndex: 't2', key: 't2', align: 'center', width: 40 },
        { title: '3', dataIndex: 't3', key: 't3', align: 'center', width: 40 },
        { title: '4', dataIndex: 't4', key: 't4', align: 'center', width: 40 },
        { title: '5', dataIndex: 't5', key: 't5', align: 'center', width: 40 },
      ],
    },
    {
      title: 'รวม',
      dataIndex: 'total',
      key: 'total',
      align: 'center',
      width: 60,
      onCell: () => ({ style: { backgroundColor: '#d9f7be', fontWeight: 'bold' } }), // สีเขียวอ่อน
    },
    {
      title: 'product\nตาม\nประเภท',
      dataIndex: 'prod2',
      key: 'prod2',
      align: 'center',
      width: 80,
    },
  ];

  // ข้อมูลจำลองตั้งต้น
  const defaultData = [
    { key: '1-N', date: 1, indexInDay: 0, shift: 'N', ptIn: 7, ptVent: '', fte: 1.13, noOtRn: 2, noOtTn: '', noOtPn: '', otRn: '', otTn: '', otPn: '', extraOt: '', diff: 0.88, prod1: 56.25, t1: 6, t2: 1, t3: '', t4: '', t5: '', total: 7, prod2: 63.10 },
    { key: '1-D', date: 1, indexInDay: 1, shift: 'D', ptIn: 10, ptVent: '', fte: 2.57, noOtRn: 1, noOtTn: '', noOtPn: '', otRn: 1, otTn: '', otPn: '', extraOt: '', diff: -1.57, prod1: 80.36, t1: 9, t2: 1, t3: '', t4: '', t5: '', total: 10, prod2: 88.10 },
    { key: '1-E', date: 1, indexInDay: 2, shift: 'E', ptIn: 11, ptVent: '', fte: 2.48, noOtRn: 2, noOtTn: '', noOtPn: '', otRn: '', otTn: '', otPn: '', extraOt: '', diff: -0.48, prod1: 88.39, t1: 11, t2: '', t3: '', t4: '', t5: '', total: 11, prod2: 91.67 },
    { key: '2-N', date: 2, indexInDay: 0, shift: 'N', ptIn: 11, ptVent: '', fte: 1.77, noOtRn: 1, noOtTn: '', noOtPn: '', otRn: 1, otTn: '', otPn: '', extraOt: '', diff: 0.77, prod1: 88.39, t1: 11, t2: '', t3: '', t4: '', t5: '', total: 11, prod2: 91.67 },
    { key: '2-D', date: 2, indexInDay: 1, shift: 'D', ptIn: 11, ptVent: '', fte: 2.83, noOtRn: 2, noOtTn: '', noOtPn: '', otRn: 1, otTn: '', otPn: '', extraOt: '', diff: -0.83, prod1: 58.93, t1: 7, t2: 4, t3: '', t4: '', t5: '', total: 11, prod2: 73.81 },
    { key: '2-E', date: 2, indexInDay: 2, shift: 'E', ptIn: 13, ptVent: '', fte: 2.93, noOtRn: 2, noOtTn: '', noOtPn: '', otRn: '', otTn: '', otPn: '', extraOt: '', diff: -0.93, prod1: 104.46, t1: 8, t2: 5, t3: '', t4: '', t5: '', total: 13, prod2: 132.14 },
  ];

  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState<string | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. ดึงรายชื่อหอผู้ป่วย
  useEffect(() => {
    const fetchWards = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) return;
        const response = await axios.get('/api/v1/wardsV1', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data) {
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

  // 2. จำลองการดึงข้อมูลตารางเมื่อเปลี่ยนหอผู้ป่วย หรือ เดือน
  useEffect(() => {
    if (!selectedWard) {
      setTableData([]);
      return;
    }
    setLoading(true);
    
    // จำลองการเปลี่ยนข้อมูลตามตึกและเดือนที่เลือก (ให้เห็นการทำงาน)
    setTimeout(() => {
      const seed = (selectedWard.charCodeAt(selectedWard.length - 1) % 5) + selectedMonth.month();
      const mockDataForWard = defaultData.map(item => ({
        ...item,
        ptIn: (item.ptIn as number) + seed,
        total: (item.total as number) + seed,
      }));
      setTableData(mockDataForWard);
      setLoading(false);
    }, 400); // จำลอง delay โหลด API
  }, [selectedWard, selectedMonth]);

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6 max-w-full mx-auto">
        <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <Title level={4} className="text-[#006b5f]! m-0">
              ตารางเวรและภาระงาน (FTE)
            </Title>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 whitespace-nowrap">เลือกหอผู้ป่วย:</span>
              <Select 
                size="middle"
                value={selectedWard}
                className="w-48"
                onChange={(value) => setSelectedWard(value)}
                placeholder="กำลังโหลดข้อมูล..."
                options={wards.map(w => ({ label: w.ward_name, value: w.his_code }))}
                showSearch
                optionFilterProp="label"
              />
              <span className="text-gray-600 whitespace-nowrap ml-2">ประจำเดือน:</span>
              <DatePicker 
                picker="month" 
                size="middle"
                value={selectedMonth} 
                onChange={(date) => setSelectedMonth(date || dayjs())} 
                format="MM/YYYY"
                allowClear={false}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <Table 
              columns={columns} 
              dataSource={tableData} 
              bordered 
              size="small" 
              pagination={false} 
              scroll={{ x: 'max-content' }} 
              rowClassName={(record) => 'hover:bg-gray-50'}
              loading={loading}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ScheduleTableAntd;