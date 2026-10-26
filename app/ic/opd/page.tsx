'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, DatePicker, Table, message, Tag } from 'antd';
import { tableLoading } from '@/app/components/Skeletons';
import type { ColumnsType } from 'antd/es/table';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import Navbar from '../../components/Navbar';
import { PiVirusBold } from 'react-icons/pi';
import { LabResultModal } from '@/app/components/ic/LabResult';

// Set locale to Thai
dayjs.extend(buddhistEra);
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

/** คอลัมน์วันที่ของผลเพาะเชื้อทุกตัว ใช้หาว่าผู้ป่วยรายนี้เจอเชื้อครั้งล่าสุดเมื่อไหร่ */
const INFECTION_DATE_KEYS = ['cre_date', 'vre_date', 'mrsa_date', 'escr_date', 'mdr_date'] as const;

/**
 * จำนวนวันจากวันที่พบเชื้อ ถึงวันที่ผู้ป่วยมารับบริการ
 *
 * นับเทียบกับวันที่มาตรวจ ไม่ใช่เทียบกับวันนี้ เพราะหน้านี้ย้อนไปดูวันอื่นได้
 * ถ้านับจากวันนี้ พอเปิดดูข้อมูลของเดือนที่แล้วจะเห็นว่าทุกรายพบเชื้อมา 30 วันขึ้นไป
 * ซึ่งไม่ได้บอกอะไรเลย ส่วนการนับเทียบวันที่มาตรวจตรงกับเกณฑ์ที่ใช้ดึงข้อมูลพอดี
 * คือช่วงเฝ้าระวัง 90 วันก่อนวันมารับบริการ ตัวเลขจึงอ่านได้ว่าอยู่ตรงไหนของช่วงนั้น
 *
 * เมื่อดูข้อมูลของวันนี้ซึ่งเป็นค่าเริ่มต้น ตัวเลขนี้เท่ากับ "กี่วันที่แล้ว" พอดี
 *
 * ตัดเวลาออกทั้งสองฝั่งก่อนลบ เพราะผลแล็บมีเวลาติดมาด้วย
 * ถ้าไม่ตัด ผลที่ออกตอนเย็นจะนับขาดไปหนึ่งวันแบบไม่มีเหตุผลให้ผู้ใช้เข้าใจ
 */
const daysBefore = (date: string | null, ref: string | null): number | null => {
    if (!date || !ref) return null;
    const d = dayjs(date);
    const r = dayjs(ref);
    if (!d.isValid() || !r.isValid()) return null;
    return r.startOf('day').diff(d.startOf('day'), 'day');
};

/** ข้อความบอกความห่าง แยกคำสำหรับ 0 กับ 1 วันเพราะอ่านแล้วเข้าใจกว่าตัวเลข */
const agoLabel = (n: number | null): string => {
    if (n === null) return '-';
    if (n < 0) return `หลังมาตรวจ ${Math.abs(n)} วัน`;  // ผลออกหลังวันมาตรวจ ต้องเห็นว่าผิดปกติ ไม่ใช่ซ่อนเป็นติดลบ
    if (n === 0) return 'วันเดียวกัน';
    if (n === 1) return 'ก่อน 1 วัน';
    return `ก่อน ${n} วัน`;
};

/** วันที่พบเชื้อครั้งล่าสุดของผู้ป่วยหนึ่งราย — null ถ้าไม่มีผลบวกสักตัว */
const latestInfectionDate = (p: OpdInfectionPatient): string | null => {
    const found = INFECTION_DATE_KEYS
        .map(k => p[k])
        .filter((d): d is string => !!d && dayjs(d).isValid());
    if (found.length === 0) return null;
    return found.reduce((a, b) => (dayjs(b).isAfter(dayjs(a)) ? b : a));
};

const InfectionControlPage = () => {
  const [patients, setPatients] = useState<OpdInfectionPatient[]>([]);
  const [loading, setLoading] = useState(true);
  /* ค่าเริ่มต้นคือวันนี้ตามเครื่องผู้ใช้ ถ้าไม่ส่งไป เซิร์ฟเวอร์ก็เติมวันนี้ให้เหมือนกัน */
  const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
  /*
    คุมเลขหน้าเอง เพราะคอลัมน์ลำดับต้องนับต่อจากหน้าก่อนหน้า
    ถ้าปล่อยให้ตารางคุมเอง จะได้ index ของหน้าปัจจุบัน แล้วหน้า 2 จะเริ่มที่ 1 ใหม่
  */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  /* ผลแล็บที่เปิดดูอยู่ null = ปิด */
  const [lab, setLab] = useState<{ labNo: string; subtitle: string } | null>(null);
  const router = useRouter();

  const fetchData = useCallback(async (d: dayjs.Dayjs) => {
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

        const patientResponse = await axios.get('/api/v1/ic/opd-patient-history-daily', {
          headers,
          params: { date: d.format('YYYY-MM-DD') },
        });

        if (patientResponse.data.success && Array.isArray(patientResponse.data.data)) {
          const patientData = patientResponse.data.data;
          setPatients(patientData);
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
  }, [router]);

  useEffect(() => {
    fetchData(date);
    /* ยิงครั้งเดียวตอนเปิดหน้า การเปลี่ยนวันที่สั่งดึงเองในตัวเลือกวันที่ */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderInfectionInfo = (infectionName: string | null, infectionDate: string | null, labNo: string | null, visitDate: string | null, ptname: string) => {
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
            {dayjs(infectionDate).format('DD/MM/BB')}
            <span className="text-gray-400"> · {agoLabel(daysBefore(infectionDate, visitDate))}</span>
          </span>
        )}
      </div>
    );

    if (labNo) {
      /* เปิดผลเป็นหน้าต่างบนหน้าเดิม ไม่ต้องสลับแท็บไปมาระหว่างไล่ดูหลายราย */
      const subtitle = [ptname, infectionName, infectionDate && `ผลวันที่ ${dayjs(infectionDate).format('DD/MM/BB')}`].filter(Boolean).join(' · ');
      return (
        <button type="button" onClick={() => setLab({ labNo, subtitle })}
          className="block w-full h-full text-left rounded focus-visible:outline-2 focus-visible:outline-emerald-600">
          {content}
        </button>
      );
    }

    return content;
  };

  const columns: ColumnsType<OpdInfectionPatient> = [
    {
      title: 'ลำดับ', key: 'seq', width: 64, align: 'center', fixed: 'left',
      /* นับตามลำดับที่เห็นบนจอ บวกออฟเซ็ตของหน้า เรียงใหม่แล้วเลขก็ยังไล่ 1..n ตามที่ตาเห็น */
      render: (_, __, index) => (
        <span className="text-gray-400">{(page - 1) * pageSize + index + 1}</span>
      ),
    },
    // { title: 'VN', dataIndex: 'vn', key: 'vn', width: 120, fixed: 'left' },
    { title: 'HN', dataIndex: 'hn', key: 'hn', width: 110, fixed: 'left' },
    { 
      title: 'วันที่รับบริการ', 
      dataIndex: 'vstdate', 
      key: 'vstdate',
      width: 120,
      render: (text) => dayjs(text).format('DD/MM/BBBB')
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
    { title: 'CRE', key: 'cre', width: 180, render: (_, record) => renderInfectionInfo(record.cre, record.cre_date, record.labno_cre, record.vstdate, record.ptname) },
    { title: 'VRE', key: 'vre', width: 180, render: (_, record) => renderInfectionInfo(record.vre, record.vre_date, record.labno_vre, record.vstdate, record.ptname) },
    { title: 'MRSA', key: 'mrsa', width: 180, render: (_, record) => renderInfectionInfo(record.mrsa, record.mrsa_date, record.labno_mrsa, record.vstdate, record.ptname) },
    { title: 'ESCR', key: 'escr', width: 180, render: (_, record) => renderInfectionInfo(record.escr, record.escr_date, record.labno_escr, record.vstdate, record.ptname) },
    { title: 'MDR', key: 'mdr', width: 180, render: (_, record) => renderInfectionInfo(record.mdr, record.mdr_date, record.labno_mdr, record.vstdate, record.ptname) },
    {
      title: 'ตรวจพบล่าสุด', key: 'latest', width: 190, align: 'center',
      /*
        เรียงจากรายที่เพิ่งพบเชื้อก่อนมาตรวจไม่นานขึ้นก่อน
        รายที่ไม่มีผลบวกเลยให้ไปอยู่ท้ายเสมอ ไม่ใช่ปนอยู่กลางตารางตามค่าว่าง
        ซึ่งจะทำให้ดูเหมือนตกสำรวจ
      */
      sorter: (a, b) => {
        const da = daysBefore(latestInfectionDate(a), a.vstdate);
        const db = daysBefore(latestInfectionDate(b), b.vstdate);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      },
      render: (_, record) => {
        const found = latestInfectionDate(record);
        const n = daysBefore(found, record.vstdate);
        if (n === null) return <span className="text-gray-300">-</span>;
        /* ยิ่งพบใกล้วันมาตรวจ ยิ่งต้องสะดุดตา เพราะยังอยู่ต้นช่วงเฝ้าระวัง */
        const color = n <= 7 ? 'red' : n <= 30 ? 'orange' : 'default';
        return (
          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
            <Tag color={color} className="m-0! font-semibold">{agoLabel(n)}</Tag>
            <span className="text-[11px] text-gray-400">{dayjs(found).format('DD/MM/BB')}</span>
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
                {/*
                  หัวเรื่องเดิมเขียนว่า "ย้อนหลัง 90 วัน" ซึ่งอ่านแล้วเข้าใจว่าเป็นรายชื่อ
                  ผู้มารับบริการตลอด 90 วัน แต่คิวรีดึงเฉพาะผู้ที่มาในวันเดียว
                  ส่วน 90 วันคือช่วงที่ย้อนไปหาผลเพาะเชื้อของคนเหล่านั้น
                  พอเลือกวันได้แล้วยิ่งต้องเขียนให้ตรง ไม่งั้นจะอ่านตัวเลขผิดความหมาย
                */}
                <h2 className="text-xl font-bold text-emerald-700 m-0">ผู้ป่วยนอกติดเชื้อดื้อยา</h2>
                <p className="text-sm text-gray-500 m-0">
                  ผู้มารับบริการวันที่ {date.format('D MMMM BBBB')} ที่มีผลเพาะเชื้อย้อนหลัง 90 วัน
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">วันที่:</span>
              <DatePicker
                value={date}
                onChange={d => { if (d) { setDate(d); setPage(1); fetchData(d); } }}
                format="DD/MM/BBBB"
                allowClear={false}
                /* กันเลือกวันในอนาคต เพราะยังไม่มีใครมารับบริการ ผลที่ได้คือตารางว่างเสมอ */
                maxDate={dayjs()}
                disabled={loading}
              />
              <Button onClick={() => { const t = dayjs(); setDate(t); setPage(1); fetchData(t); }} disabled={loading}>
                วันนี้
              </Button>
            </div>
          </div>

          <Table 
            columns={columns} 
            dataSource={patients} 
            rowKey="vn"
            {...tableLoading(loading, patients)}
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