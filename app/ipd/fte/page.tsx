"use client"
import React, { useState, useEffect } from 'react';
import { Table, Card, Select, Typography, DatePicker, message } from 'antd';
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
          // ใช้ rowSpanForDay จากข้อมูลจริง หรือ fallback เป็น 3
          return { rowSpan: record.rowSpanForDay || 3 }; 
        }
        return { rowSpan: 0 }; // แถวอื่นๆ ให้ถูกซ่อนไป
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
      title: 'ยอด ที่ไม่ on ventilator',
      children: [
        { title: 'ปกติ', dataIndex: 'ptNormal', key: 'ptNormal', align: 'center', width: 50 },
        { title: 'O2', dataIndex: 'ptO2', key: 'ptO2', align: 'center', width: 50 },
        { title: 'HFNC', dataIndex: 'ptHfnc', key: 'ptHfnc', align: 'center', width: 50 },
      ]
    },
    {
      title: 'ยอด\n ventilator  C/S',
      dataIndex: 'ptVent',
      key: 'ptVent',
      align: 'center',
      width: 70,
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
          title: 'OT 8 hr',
          children: [
            { title: 'RN', dataIndex: 'ot8Rn', key: 'ot8Rn', align: 'center', width: 40, className: 'text-red-500' },
            { title: 'TN', dataIndex: 'ot8Tn', key: 'ot8Tn', align: 'center', width: 40, className: 'text-blue-500' },
            { title: 'PN', dataIndex: 'ot8Pn', key: 'ot8Pn', align: 'center', width: 40, className: 'text-blue-500' },
          ],
        },
        {
          title: 'OT 4 hr',
          children: [
            { title: 'RN', dataIndex: 'ot4Rn', key: 'ot4Rn', align: 'center', width: 40, className: 'text-red-500' },
            { title: 'TN', dataIndex: 'ot4Tn', key: 'ot4Tn', align: 'center', width: 40, className: 'text-blue-500' },
            { title: 'PN', dataIndex: 'ot4Pn', key: 'ot4Pn', align: 'center', width: 40, className: 'text-blue-500' },
          ],
        },
      ],
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

  // 2. ดึงข้อมูลตารางเมื่อเปลี่ยนหอผู้ป่วย หรือ เดือน
  useEffect(() => {
    if (!selectedWard || !selectedMonth) {
      setTableData([]);
      return;
    }
    
    const fetchFteData = async () => {
      setLoading(true);
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        
        const payload = {
          ward: String(selectedWard),
          month: selectedMonth.format('YYYY-MM') // เช่น '2026-03'
        };
        
        const response = await axios.post('/api/v1/nurse/fte-by-ward', payload, { headers });
        
        if (response.data && response.data.success) {
          const rawData = response.data.data || [];
          
          // จัดกลุ่มตามวัน เพื่อทำ rowSpan ให้ถูกต้อง
          const daysMap: Record<string, any[]>  = {};
          rawData.forEach((item: any) => {
            if (!daysMap[item.shift_date]) daysMap[item.shift_date] = [];
            daysMap[item.shift_date].push(item);
          });
          
          let finalData: any[] = [];
          Object.keys(daysMap).sort().forEach(dateKey => {
            const shiftsForDay = daysMap[dateKey].sort((a: any, b: any) => a.shift_id - b.shift_id);
            shiftsForDay.forEach((item: any, index: number) => {
              finalData.push({
                key: `${item.shift_date}-${item.shift_id}`,
                date: dayjs(item.shift_date).date(),
                indexInDay: index,
                rowSpanForDay: index === 0 ? shiftsForDay.length : 0,
                shift: item.shift_name === 'ดึก' ? 'N' : item.shift_name === 'เช้า' ? 'D' : 'E',
                ptNormal: item.normal_count,
                ptO2: item.o2_count,
                ptHfnc: item.hfnc_count,
                ptVent: item.crisis_count,
                fte: item.fte,
                t1: item.severity_1,
                t2: item.severity_2,
                t3: item.severity_3,
                t4: item.severity_4,
                t5: item.severity_5,
                total: item.total_count,
                prod1: item.general_score,
                prod2: item.crisis_score,
                noOtRn: item.RN_NOT_OT ?? 0,
                noOtTn: item.TN_NOT_OT ?? 0,
                noOtPn: item.PN_NOT_OT ?? 0,
                ot4Rn: item.RN_OT4 ?? 0,
                ot4Tn: item.TN_OT4 ?? 0,
                ot4Pn: item.PN_OT4 ?? 0,
                ot8Rn: item.RN_OT8 ?? 0,
                ot8Tn: item.TN_OT8 ?? 0,
                ot8Pn: item.PN_OT8 ?? 0,
                diff: 0
              });
            });
          });
          
          setTableData(finalData);
        } else {
           setTableData([]);
        }
      } catch (error) {
        console.error("Error fetching fte data:", error);
        message.error("เกิดข้อผิดพลาดในการดึงข้อมูล FTE");
        setTableData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFteData();
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