'use client';

import React, { useState, useEffect } from 'react';
import { Table, Card, Select, Tag, Input, Button, Space } from 'antd';
import axios from 'axios';
import type { ColumnsType } from 'antd/es/table';
import { VscSearch } from "react-icons/vsc";
import Navbar from '../../components/Navbar';

interface PatientRecord {
  hn: string;
  an: string;
  name: string;
  age: number;
  bed: string;
  right: string; // สิทธิการรักษา
  status: string;
  admitDate: string;
}

interface Ward {
  ward: string;
  name: string;
}

const { Option } = Select;

export default function PatientList() {
  const [selectedWard, setSelectedWard] = useState<string>();
  const [searchText, setSearchText] = useState('');
  const [wards, setWards] = useState<Ward[]>([]);

  // Mock Data: รายชื่อผู้ป่วย
  const allPatients: Record<string, PatientRecord[]> = {
    '02': [ // ศัลยกรรมชาย
      { hn: '66000123', an: '67000456', name: 'นายสมชาย รักดี', age: 45, bed: '01', right: 'UC', status: 'Active', admitDate: '01/03/2567' },
      { hn: '66000199', an: '67000999', name: 'นายวิชัย ใจกล้า', age: 50, bed: '02', right: 'เบิกจ่ายตรง', status: 'Active', admitDate: '05/03/2567' },
      { hn: '66000200', an: '67001000', name: 'นายประสิทธิ์ คิดรอบคอบ', age: 62, bed: '03', right: 'SSS', status: 'Active', admitDate: '04/03/2567' },
    ],
    '03': [ // ศัลยกรรมหญิง
      { hn: '66000124', an: '67000457', name: 'นางสาวสมหญิง จริงใจ', age: 32, bed: '01', right: 'SSS', status: 'Active', admitDate: '02/03/2567' },
      { hn: '66000155', an: '67000555', name: 'นางวันเพ็ญ สวยงาม', age: 48, bed: '05', right: 'UC', status: 'Observation', admitDate: '06/03/2567' },
    ],
    '22': [ // อายุรกรรม 1
      { hn: '66000125', an: '67000458', name: 'นายมั่นคง ยืนยง', age: 75, bed: '10', right: 'UC', status: 'Serious', admitDate: '28/02/2567' },
      { hn: '66000126', an: '67000459', name: 'นายบุญมี มั่งคั่ง', age: 68, bed: '11', right: 'เบิกจ่ายตรง', status: 'Active', admitDate: '01/03/2567' },
    ],
    '18': [ // ADMIT CENTER
      { hn: '66000300', an: '67002000', name: 'เด็กชายกล้าหาญ ชาญชัย', age: 8, bed: 'Wait', right: 'UC', status: 'Waiting', admitDate: '07/03/2567' },
    ],
  };

  useEffect(() => {
    const fetchWards = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) return;

        // เรียก API ไปที่ /api/v1/wards (ผ่าน Proxy) พร้อมแนบ Token
        const response = await axios.get('/api/v1/wards', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.data) {
          // รองรับ response ทั้งแบบ Array ตรงๆ และแบบมี field data
          const wardList = Array.isArray(response.data) ? response.data : response.data.data || [];
          setWards(wardList);
          
          if (wardList.length > 0) {
             setSelectedWard(String(wardList[0].ward));
          }
        }
      } catch (error) {
        console.error("Error fetching wards:", error);
      }
    };
    fetchWards();
  }, []);

  const handleWardChange = (value: string) => {
    setSelectedWard(value);
  };

  // Filter patients based on ward and search text
  const filteredPatients = (allPatients[selectedWard || ''] || []).filter(p => 
    p.name.includes(searchText) || p.hn.includes(searchText)
  );

  const columns: ColumnsType<PatientRecord> = [
    { title: 'เตียง', dataIndex: 'bed', key: 'bed', width: 80, align: 'center', sorter: (a, b) => a.bed.localeCompare(b.bed) },
    { title: 'HN', dataIndex: 'hn', key: 'hn', width: 100 },
    { title: 'AN', dataIndex: 'an', key: 'an', width: 100 },
    { 
      title: 'ชื่อ-สกุล', 
      dataIndex: 'name', 
      key: 'name',
      render: (text) => <span className="font-semibold text-[#006b5f]">{text}</span>
    },
    { title: 'อายุ', dataIndex: 'age', key: 'age', width: 70, align: 'center' },
    { title: 'สิทธิ', dataIndex: 'right', key: 'right', width: 100 },
    { title: 'วันที่ Admit', dataIndex: 'admitDate', key: 'admitDate', width: 120 },
    { 
      title: 'สถานะ', 
      dataIndex: 'status', 
      key: 'status', 
      width: 100,
      align: 'center',
      render: (status) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
      )
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
                placeholder="กำลังโหลดข้อมูล..."
                
              >
                {wards.map(w => <Option key={w.ward} value={w.ward}>{w.name}</Option>)}
              </Select>
              
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
            className="[&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
          />
        </Card>
      </div>
    </div>
  );
}