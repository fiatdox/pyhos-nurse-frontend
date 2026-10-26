'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Table, message, Tag, Select } from 'antd';
import { tableLoading } from '@/app/components/Skeletons';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import Navbar from '../../components/Navbar';
import { PiVirusBold } from 'react-icons/pi';
import { LabResultModal } from '@/app/components/ic/LabResult';

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

/** คอลัมน์วันที่ของผลเพาะเชื้อทุกตัว ใช้หาว่าผู้ป่วยรายนี้เจอเชื้อครั้งล่าสุดเมื่อไหร่ */
const INFECTION_DATE_KEYS = ['cre_date', 'vre_date', 'mrsa_date', 'escr_date', 'mdr_date'] as const;

/**
 * จำนวนวันนับจากวันนี้ย้อนกลับไปถึงวันที่กำหนด
 *
 * ตัดเวลาออกทั้งสองฝั่งก่อนลบ เพราะผลแล็บมีเวลาติดมาด้วย
 * ถ้าไม่ตัด ผลที่ออกเมื่อวานตอนเย็นจะนับเป็น 0 วันในตอนเช้า แล้วเป็น 1 วันในตอนบ่าย
 * ของวันเดียวกัน ซึ่งทำให้ตัวเลขบนจอเปลี่ยนเองโดยที่ข้อมูลไม่ได้เปลี่ยน
 */
const daysAgo = (date: string | null): number | null => {
    if (!date) return null;
    const d = dayjs(date);
    if (!d.isValid()) return null;
    return dayjs().startOf('day').diff(d.startOf('day'), 'day');
};

/** ข้อความบอกความห่างจากวันนี้ แยกคำสำหรับวันนี้/เมื่อวานเพราะอ่านแล้วเข้าใจกว่าเลข 0 กับ 1 */
const agoLabel = (n: number | null): string => {
    if (n === null) return '-';
    if (n < 0) return `อีก ${Math.abs(n)} วัน`;   // วันที่ล่วงหน้า = ข้อมูลผิด ต้องเห็นว่าผิด ไม่ใช่ซ่อนเป็นติดลบ
    if (n === 0) return 'วันนี้';
    if (n === 1) return 'เมื่อวาน';
    return `${n} วันที่แล้ว`;
};

/** วันที่พบเชื้อครั้งล่าสุดของผู้ป่วยหนึ่งราย — null ถ้าไม่มีผลบวกสักตัว */
const latestInfectionDate = (p: InfectionPatient): string | null => {
    const found = INFECTION_DATE_KEYS
        .map(k => p[k])
        .filter((d): d is string => !!d && dayjs(d).isValid());
    if (found.length === 0) return null;
    return found.reduce((a, b) => (dayjs(b).isAfter(dayjs(a)) ? b : a));
};

const InfectionControlPage = () => {
  const [patients, setPatients] = useState<InfectionPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWard, setSelectedWard] = useState<string | undefined>();
  /*
    คุมเลขหน้าเอง เพราะคอลัมน์ลำดับต้องนับต่อจากหน้าก่อนหน้า
    ถ้าปล่อยให้ตารางคุมเอง จะได้ index ของหน้าปัจจุบัน แล้วหน้า 2 จะเริ่มที่ 1 ใหม่
  */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  /* ผลแล็บที่เปิดดูอยู่ null = ปิด */
  const [lab, setLab] = useState<{ labNo: string; subtitle: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) {
          message.error('ไม่พบ Token สำหรับการยืนยันตัวตน');
          router.push('/');
          setLoading(false);
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };

        const patientResponse = await axios.get('/api/v1/ic/ipd-patient-history-daily', { headers });

        if (patientResponse.data.success && Array.isArray(patientResponse.data.data)) {
          setPatients(patientResponse.data.data);
        } else {
          message.error('รูปแบบข้อมูลผู้ป่วยไม่ถูกต้อง หรือดึงข้อมูลล้มเหลว');
          setPatients([]);
        }

      } catch (error) {
        console.error("Error fetching infection data:", error);
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          message.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
          router.push('/');
        } else {
          message.error('เกิดข้อผิดพลาดในการดึงข้อมูลผู้ป่วยติดเชื้อ');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /**
   * สร้างรายการหอผู้ป่วยจากข้อมูลที่โหลดมาเอง ไม่ดึงจาก wardsV1
   * เพราะชื่อหอฝั่ง HIS กับฝั่ง PG สะกดไม่ตรงกัน (เช่น "หอผู้ป่วยหนัก 2(MICU2)" กับ "ผู้ป่วยหนัก 2")
   * ใช้ชื่อจากตารางเดียวกับที่แสดงผล ตัวกรองจึงตรงเสมอ
   */
  const wardOptions = [...new Set(patients.map(p => p.wname).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'th')
  );

  const filteredPatients = selectedWard
    ? patients.filter(p => p.wname === selectedWard)
    : patients;

  const renderInfectionInfo = (infectionName: string | null, infectionDate: string | null, labNo: string | null, ptname: string) => {
    if (!infectionName) {
      return <span className="text-gray-400">-</span>;
    }

    const content = (
      <div className={`flex flex-col items-start w-full h-full ${labNo ? 'group' : ''}`}>
        <Tag color="volcano" className={`font-semibold whitespace-normal text-left leading-normal py-0.5 ${labNo ? 'group-hover:opacity-80 cursor-pointer' : ''}`}>
          {infectionName}
        </Tag>
        {infectionDate && (
          <span className="text-xs text-gray-500 mt-1 leading-tight whitespace-nowrap">
            {dayjs(infectionDate).format('DD/MM/YY')}
            <span className="text-gray-400"> · {agoLabel(daysAgo(infectionDate))}</span>
          </span>
        )}
      </div>
    );

    if (labNo) {
      /* เปิดผลเป็นหน้าต่างบนหน้าเดิม ไม่ต้องสลับแท็บไปมาระหว่างไล่ดูหลายราย */
      const subtitle = [ptname, infectionName, infectionDate && `ผลวันที่ ${dayjs(infectionDate).format('DD/MM/YY')}`].filter(Boolean).join(' · ');
      return (
        <button type="button" onClick={() => setLab({ labNo, subtitle })}
          className="block w-full h-full text-left rounded focus-visible:outline-2 focus-visible:outline-emerald-600">
          {content}
        </button>
      );
    }

    return content;
  };

  const columns: ColumnsType<InfectionPatient> = [
    {
      title: 'ลำดับ', key: 'seq', width: 64, align: 'center', fixed: 'left',
      /* นับตามลำดับที่เห็นบนจอ บวกออฟเซ็ตของหน้า เรียงใหม่แล้วเลขก็ยังไล่ 1..n ตามที่ตาเห็น */
      render: (_, __, index) => (
        <span className="text-gray-400">{(page - 1) * pageSize + index + 1}</span>
      ),
    },
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
    { title: 'CRE', key: 'cre', width: 180, render: (_, record) => renderInfectionInfo(record.cre, record.cre_date, record.cre_labno, record.ptname) },
    { title: 'VRE', key: 'vre', width: 180, render: (_, record) => renderInfectionInfo(record.vre, record.vre_date, record.vre_labno, record.ptname) },
    { title: 'MRSA', key: 'mrsa', width: 180, render: (_, record) => renderInfectionInfo(record.mrsa, record.mrsa_date, record.mrsa_labno, record.ptname) },
    { title: 'ESCR', key: 'escr', width: 180, render: (_, record) => renderInfectionInfo(record.escr, record.escr_date, record.escr_labno, record.ptname) },
    { title: 'MDR', key: 'mdr', width: 180, render: (_, record) => renderInfectionInfo(record.mdr, record.mdr_date, record.mdr_labno, record.ptname) },
    {
      title: 'พบเชื้อล่าสุด', key: 'latest', width: 190, align: 'center',
      /*
        เรียงจากรายที่เพิ่งพบล่าสุดขึ้นก่อน รายที่ไม่มีผลบวกเลยให้ไปอยู่ท้ายเสมอ
        ไม่ใช่ปนอยู่กลางตารางตามค่าว่าง ซึ่งจะทำให้ดูเหมือนตกสำรวจ
      */
      sorter: (a, b) => {
        const da = daysAgo(latestInfectionDate(a));
        const db = daysAgo(latestInfectionDate(b));
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      },
      render: (_, record) => {
        const date = latestInfectionDate(record);
        const n = daysAgo(date);
        if (n === null) return <span className="text-gray-300">-</span>;
        /* ยิ่งเพิ่งพบยิ่งต้องสะดุดตา เพราะเป็นรายที่ยังต้องคุมการแพร่กระจายอยู่ */
        const color = n <= 7 ? 'red' : n <= 30 ? 'orange' : 'default';
        return (
          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
            <Tag color={color} className="m-0! font-semibold">{agoLabel(n)}</Tag>
            <span className="text-[11px] text-gray-400">{dayjs(date).format('DD/MM/YY')}</span>
          </div>
        );
      },
    },
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
                /* กลับหน้าแรกด้วย ไม่งั้นกรองแล้วเหลือหน้าเดียวแต่ยังค้างอยู่หน้า 3 จะเห็นตารางว่าง */
                onChange={(value) => { setSelectedWard(value); setPage(1); }}
                style={{ width: 200 }}
                value={selectedWard}
              >
                {wardOptions.map(name => <Option key={name} value={name}>{name}</Option>)}
              </Select>
            </div>
          </div>

          <Table 
            columns={columns} 
            dataSource={filteredPatients} 
            rowKey="an"
            {...tableLoading(loading, filteredPatients)}
            pagination={{
              current: page,
              pageSize,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} จาก ${total} ราย`,
              onChange: (p, size) => { setPage(p); setPageSize(size); },
            }}
            size='small'
            scroll={{ x: 'max-content' }}
            className="[&_.ant-table-thead_.ant-table-cell]:bg-emerald-700! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
          />
        </Card>
      </div>
      <LabResultModal labNo={lab?.labNo ?? null} subtitle={lab?.subtitle} onClose={() => setLab(null)} />
    </div>
  );
};

export default InfectionControlPage;