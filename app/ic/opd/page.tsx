'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, message, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import Navbar from '../../components/Navbar';
import { PiVirusBold } from 'react-icons/pi';

// Set locale to Thai
dayjs.locale('th');

// Interface for the patient infection data
interface OpdInfectionPatient {
  vn: string;
  hn: string;
  vstdate: string;
  ptname: string;
  department: string;
  spcname: string;
  cre: string | null;
  cre_date: string | null;
  labno_cre: string | null;
  vre: string | null;
  vre_date: string | null;
  labno_vre: string | null;
  mrsa: string | null;
  mrsa_date: string | null;
  labno_mrsa: string |null;
  escr: string | null;
  escr_date: string | null;
  labno_escr: string | null;
  mdr: string | null;
  mdr_date: string | null;
  labno_mdr: string | null;
}

const InfectionControlPage = () => {
  const [patients, setPatients] = useState<OpdInfectionPatient[]>([]);
  const [loading, setLoading] = useState(true);

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

        const patientResponse = await axios.get('/api/v1/ic/opd-patient-history-daily', { headers }).catch(() => ({ data: { success: false, data: [] } }));

        if (patientResponse.data.success && Array.isArray(patientResponse.data.data)) {
          const patientData = patientResponse.data.data;
          setPatients(patientData);
        } else {
          message.error('รูปแบบข้อมูลผู้ป่วยไม่ถูกต้อง หรือดึงข้อมูลล้มเหลว');
          setPatients([]);
        }

      } catch (error) {
        console.error("Error fetching infection data:", error);
        message.error('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วยติดเชื้อ');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  const columns: ColumnsType<OpdInfectionPatient> = [
    // { title: 'VN', dataIndex: 'vn', key: 'vn', width: 120, fixed: 'left' },
    { title: 'HN', dataIndex: 'hn', key: 'hn', width: 110, fixed: 'left' },
    { 
      title: 'วันที่รับบริการ', 
      dataIndex: 'vstdate', 
      key: 'vstdate',
      width: 120,
      render: (text) => dayjs(text).format('DD/MM/YYYY')
    },
    { 
      title: 'ชื่อ-สกุล', 
      dataIndex: 'ptname', 
      key: 'ptname',
      width: 200,
      fixed: 'left',
      render: (text) => <span className="font-semibold text-emerald-800">{text}</span>
    },
    { title: 'แผนก', dataIndex: 'department', key: 'department', width: 200 },
    { title: 'แผนกที่ตรวจ', dataIndex: 'spcname', key: 'spcname', width: 150 },
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
                <h2 className="text-xl font-bold text-emerald-700 m-0">ผู้ป่วยนอกติดเชื้อ (ย้อนหลัง 90 วัน)</h2>
                <p className="text-sm text-gray-500 m-0">Outpatient Department (OPD) Infection - Last 90 Days</p>
              </div>
            </div>
          </div>

          <Table 
            columns={columns} 
            dataSource={patients} 
            rowKey="vn"
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