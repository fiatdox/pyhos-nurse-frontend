'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '../../components/Navbar';
import { Card, Table, DatePicker, Button, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/th';

const { RangePicker } = DatePicker;
dayjs.locale('th');

// กำหนด Interface สำหรับข้อมูลในตาราง
interface FollowUpRecord {
  vn: string;
  hn: string;
  ptname: string;
  icd10: string;
  diagtype: string;
  cc: string;
  vstdate: string;
  opd_operation: string | null;
  opd_operation_name: string | null;
  dd: number | null;
  ipd_operation: string | null;
  ipd_operation_name: string | null;
  dd1: number | null;
}

const Page = () => {
  const [data, setData] = useState<FollowUpRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>([
    dayjs().subtract(30, 'day'), // ค่าเริ่มต้นย้อนหลัง 30 วัน
    dayjs()
  ]);

  const fetchData = async () => {
    if (!dates || !dates[0] || !dates[1]) {
      message.warning('กรุณาเลือกช่วงวันที่ก่อนค้นหา');
      return;
    }

    setLoading(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      if (!token) {
        message.error('ไม่พบ Token สำหรับการยืนยันตัวตน');
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        date1: dates[0].format('YYYY-MM-DD'),
        date2: dates[1].format('YYYY-MM-DD')
      };
      
      const response = await axios.post('/api/v1/ic/operation-followup', payload, { headers });

      if (response.data && response.data.success) {
        setData(response.data.data);
      } else {
        message.error('ไม่สามารถดึงข้อมูลได้');
      }
    } catch (error) {
      console.error('Error fetching followup data:', error);
      message.error('เกิดข้อผิดพลาดในการดึงข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // กำหนดคอลัมน์ของตาราง
  const columns: ColumnsType<FollowUpRecord> = [
    { title: 'No.', key: 'no', render: (text, record, index) => index + 1, width: 60, align: 'center', fixed: 'left' },
    { title: 'วันที่', dataIndex: 'vstdate', key: 'vstdate', width: 110, fixed: 'left', render: (text) => text ? dayjs(text).format('DD/MM/YYYY') : '-' },
    { title: 'HN', dataIndex: 'hn', key: 'hn', width: 100, fixed: 'left' },
    { title: 'Patient Name', dataIndex: 'ptname', key: 'ptname', width: 200, fixed: 'left', render: (text) => <span className="font-semibold text-emerald-800">{text}</span> },
    { title: 'icd10', dataIndex: 'icd10', key: 'icd10', width: 80 },
    { title: 'type', dataIndex: 'diagtype', key: 'diagtype', width: 60, align: 'center' },
    { title: 'cc', dataIndex: 'cc', key: 'cc', width: 280 },
    { title: 'Day', dataIndex: 'dd', key: 'dd', width: 60, align: 'center' },
    { title: 'OPD OR DATE', dataIndex: 'opd_operation', key: 'opd_operation', width: 120, render: (text) => text ? dayjs(text).format('DD/MM/YYYY') : '-' },
    { title: 'OPD Operation name', dataIndex: 'opd_operation_name', key: 'opd_operation_name', width: 220 },
    { title: 'Day', dataIndex: 'dd1', key: 'dd1', width: 60, align: 'center' },
    { title: 'IPD OR DATE', dataIndex: 'ipd_operation', key: 'ipd_operation', width: 120, render: (text) => text ? dayjs(text).format('DD/MM/YYYY') : '-' },
    { title: 'IPD Operation name', dataIndex: 'ipd_operation_name', key: 'ipd_operation_name', width: 220 },
  ];

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6 max-w-full mx-auto">
        <Card className="shadow-xl rounded-2xl border-none">
          
          {/* ส่วนหัวและตัวกรองข้อมูล */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-6 gap-4">
            <div>
              <h2 className="text-xl font-bold text-emerald-700 m-0">ข้อมูลรายชื่อผู้ป่วยที่มารับบริการ T814,A499 และเข้ารับบริการผ่าตัด</h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-600">วันที่รับบริการ:</span>
              <RangePicker 
                format="DD/MM/YYYY" 
                value={dates}
                onChange={(vals) => setDates(vals as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
              />
              <Button 
                type="primary" 
                className="bg-emerald-600 hover:bg-emerald-700" 
                icon={<SearchOutlined />}
                onClick={fetchData}
              >
                ค้นหา
              </Button>
            </div>
          </div>

          {/* ตารางแสดงผล */}
          <Table 
            columns={columns} 
            dataSource={data} 
            rowKey="vn"
            loading={loading}
            scroll={{ x: 'max-content' }}
            size="small"
            className="[&_.ant-table-thead_.ant-table-cell]:bg-emerald-700! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
          />
        </Card>
      </div>
    </div>
  );
};

export default Page;