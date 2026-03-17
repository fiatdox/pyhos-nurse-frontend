'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, message, Tag, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import Navbar from '../../components/Navbar';
import { PiVirusBold } from 'react-icons/pi';

const { Option } = Select;

// Set locale to Thai
dayjs.locale('th');

// Interface for the patient infection data
interface InfectionPatient {
  an: string;
  hn: string;
  ptname: string;
  bedno: string;
  incdoctor: string;
  wname: string;
  ds: number;
  cre: string | null;
  cre_date: string | null;
  cre_labno: string | null;
  vre: string | null;
  vre_date: string | null;
  vre_labno: string | null;
  mrsa: string | null;
  mrsa_date: string | null;
  mrsa_labno: string |null;
  escr: string | null;
  escr_date: string | null;
  escr_labno: string | null;
  mdr: string | null;
  mdr_date: string | null;
  mdr_labno: string | null;
}

interface Ward {
  ward: string;
  name: string;
}

const InfectionControlPage = () => {
  const [patients, setPatients] = useState<InfectionPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState<string | undefined>();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) {
          message.error('ไม่พบ Token สำหรับการยืนยันตัวตน');
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        const [patientResponse, wardResponse] = await Promise.all([
          axios.get('/api/v1/ic/ipd-patient-history-daily', { headers }).catch(() => ({ data: { success: false, data: [] } })),
          axios.get('/api/v1/wards', { headers }).catch(() => ({ data: { data: [] } }))
        ]);

        if (patientResponse.data.success && Array.isArray(patientResponse.data.data)) {
          setPatients(patientResponse.data.data);
        } else {
          message.error('รูปแบบข้อมูลผู้ป่วยไม่ถูกต้อง หรือดึงข้อมูลล้มเหลว');
          setPatients([]);
        }

        const wardList = Array.isArray(wardResponse.data) ? wardResponse.data : wardResponse.data.data || [];
        setWards(wardList);

      } catch (error) {
        console.error("Error fetching infection data:", error);
        message.error('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วยติดเชื้อ');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredPatients = selectedWard
    ? patients.filter(p => {
        const selectedWardName = wards.find(w => w.ward === selectedWard)?.name;
        return p.wname === selectedWardName;
      })
    : patients;

  const renderInfectionInfo = (infectionName: string | null, infectionDate: string | null) => {
    if (!infectionName) {
      return <span className="text-gray-400">-</span>;
    }
    return (
      <div className="flex flex-col items-start">
        <Tag color="volcano" className="font-semibold whitespace-normal text-left leading-normal py-0.5">{infectionName}</Tag>
        {infectionDate && (
          <span className="text-xs text-gray-500 mt-1">
            {dayjs(infectionDate).format('DD/MM/YY')}
          </span>
        )}
      </div>
    );
  };

  const columns: ColumnsType<InfectionPatient> = [
    { title: 'AN', dataIndex: 'an', key: 'an', width: 90, fixed: 'left' },
    // { title: 'HN', dataIndex: 'hn', key: 'hn', width: 110, fixed: 'left' },
    { 
      title: 'ชื่อ-สกุล', 
      dataIndex: 'ptname', 
      key: 'ptname',
      width: 200,
      fixed: 'left',
      render: (text) => <span className="font-semibold text-emerald-800">{text}</span>
    },
    { title: 'เตียง', dataIndex: 'bedno', key: 'bedno', width: 80, align: 'center' },
    { title: 'หอผู้ป่วย', dataIndex: 'wname', key: 'wname', width: 160 },
    { title: 'แพทย์', dataIndex: 'incdoctor', key: 'incdoctor', width: 170 },
    { 
      title: 'วันนอน', 
      dataIndex: 'ds', 
      key: 'ds', 
      width: 70, 
      align: 'center',
      render: (ds) => `${ds}`
    },
    { title: 'CRE', key: 'cre', width: 180, render: (_, record) => renderInfectionInfo(record.cre, record.cre_date) },
    { title: 'VRE', key: 'vre', width: 180, render: (_, record) => renderInfectionInfo(record.vre, record.vre_date) },
    { title: 'MRSA', key: 'mrsa', width: 180, render: (_, record) => renderInfectionInfo(record.mrsa, record.mrsa_date) },
    { title: 'ESCR', key: 'escr', width: 180, render: (_, record) => renderInfectionInfo(record.escr, record.escr_date) },
    { title: 'MDR', key: 'mdr', width: 180, render: (_, record) => renderInfectionInfo(record.mdr, record.mdr_date) },
  ];

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6 max-w-full mx-auto">
        <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-700 p-2 rounded-xl">
                <PiVirusBold className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-emerald-700 m-0">ผู้ป่วยติดเชื้อในโรงพยาบาล (ย้อนหลัง 90 วัน)</h2>
                <p className="text-sm text-gray-500 m-0">Hospital-Acquired Infection (HAI) - Last 90 Days</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">หอผู้ป่วย:</span>
              <Select
                allowClear
                showSearch
                placeholder="ทั้งหมด"
                optionFilterProp="children"
                onChange={(value) => setSelectedWard(value)}
                style={{ width: 200 }}
                value={selectedWard}
              >
                {wards.map(ward => <Option key={ward.ward} value={ward.ward}>{ward.name}</Option>)}
              </Select>
            </div>
          </div>

          <Table 
            columns={columns} 
            dataSource={filteredPatients} 
            rowKey="an"
            loading={loading}
            pagination={{ pageSize: 15, showSizeChanger: true }}
            size='small'
            scroll={{ x: 'max-content' }}
            className="[&_.ant-table-thead_.ant-table-cell]:bg-emerald-700! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
          />
        </Card>
      </div>
    </div>
  );
};

export default InfectionControlPage;