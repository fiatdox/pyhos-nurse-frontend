'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Card, Select, Input, Button, Tag } from 'antd';
import Swal from 'sweetalert2';
import type { ColumnsType } from 'antd/es/table';
import { DatePicker } from 'antd';
import axios from 'axios';
import dayjs, { Dayjs } from 'dayjs';
import { VscSearch, VscRefresh } from 'react-icons/vsc';
import Navbar from '../../components/Navbar';

const { RangePicker } = DatePicker;

interface DischargeRecord {
  admission_list_id: number;
  an: string;
  hn: string;
  patient_name: string;
  ward: string;
  bedno: string;
  reg_datetime: string;
  discharge_datetime: string;
  move_to_ward: string | null;
  los: number;
  status: string;
  discharge_type_name: string;
  status_name: string;
}

interface Ward {
  ward: number;
  ward_name: string;
  his_code: string;
}


const dischargeTypeColor: Record<string, string> = {
  'จำหน่าย': 'green',
  'ย้ายออก': 'blue',
  'REFER': 'orange',
};

export default function DischargePage() {
  const [selectedWard, setSelectedWard] = useState<string | undefined>();
  const [wards, setWards] = useState<Ward[]>([]);
  const [records, setRecords] = useState<DischargeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([null, null]);

  useEffect(() => {
    const fetchWards = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.get('/api/v1/wardsV1', { headers });
        const wardList = Array.isArray(response.data) ? response.data : response.data.data || [];
        setWards(wardList);
      } catch {
        // ใช้ mock ต่อถ้า API ไม่พร้อม
      }
    };
    fetchWards();
  }, []);

  const fetchRecords = useCallback(async () => {
    if (!selectedWard) return;
    setLoading(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const body = {
        ward: selectedWard,
        date_from: dateRange[0] ? dateRange[0].format('YYYY-MM-DD') : null,
        date_to: dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : null,
      };
      const res = await axios.post('/api/v1/patient-discharge-by-ward', body, { headers });
      setRecords(res.data.data || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [selectedWard, dateRange]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleCancelDischarge = (record: DischargeRecord) => {
    Swal.fire({
      icon: 'warning',
      title: 'ยืนยันการยกเลิก DC',
      text: `ยกเลิกการจำหน่าย ${record.patient_name} (AN: ${record.an})?`,
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#006b5f',
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
    }).then(async result => {
      if (!result.isConfirmed) return;
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        await axios.post('/api/v1/cancel-discharge', { admission_list_id: record.admission_list_id }, { headers });
        Swal.fire({ icon: 'success', title: 'สำเร็จ', text: 'ยกเลิก DC เรียบร้อยแล้ว', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
        fetchRecords();
      } catch (error: any) {
        Swal.fire({ icon: 'error', title: `ผิดพลาด (${error?.response?.status ?? 'Network Error'})`, text: 'เกิดข้อผิดพลาดในการยกเลิก DC', confirmButtonColor: '#006b5f', confirmButtonText: 'ตกลง' });
      }
    });
  };

  const filtered = records.filter(r => {
    const matchSearch = !searchText ||
      r.patient_name.includes(searchText) ||
      r.hn.includes(searchText) ||
      r.an.includes(searchText);

    const matchDate = (() => {
      if (!dateRange[0] || !dateRange[1]) return true;
      const d = dayjs(r.discharge_datetime);
      return d.isAfter(dateRange[0].startOf('day').subtract(1, 'ms')) &&
             d.isBefore(dateRange[1].endOf('day').add(1, 'ms'));
    })();

    const matchWard = !selectedWard || true; // TODO: กรองตาม ward จาก API

    return matchSearch && matchDate && matchWard;
  });

  const columns: ColumnsType<DischargeRecord> = [
    { title: 'HN', dataIndex: 'hn', key: 'hn', width: 100 },
    { title: 'AN', dataIndex: 'an', key: 'an', width: 100 },
    {
      title: 'ชื่อ-สกุล', dataIndex: 'patient_name', key: 'patient_name',
      render: t => <span className="font-semibold text-[#006b5f]">{t}</span>,
    },
    { title: 'เตียง', dataIndex: 'bedno', key: 'bedno', width: 80, align: 'center' },
    // {
    //   title: 'วันที่ Admit', dataIndex: 'reg_datetime', key: 'reg_datetime', width: 150,
    //   render: t => t ? dayjs(t).format('DD/MM/YYYY HH:mm') : '-',
    // },
    {
      title: 'วันที่จำหน่าย', dataIndex: 'discharge_datetime', key: 'discharge_datetime', width: 150,
      render: t => t ? dayjs(t).format('DD/MM/YYYY HH:mm') : '-',
    },
    {
      title: 'ประเภทการจำหน่าย', dataIndex: 'discharge_type_name', key: 'discharge_type_name', width: 150, align: 'center',
      render: t => <Tag color={dischargeTypeColor[t] || 'default'}>{t}</Tag>,
    },
    {
      title: 'วันนอน (LOS)', dataIndex: 'los', key: 'los', width: 110, align: 'center',
      render: v => <span className="font-bold text-[#006b5f]">{v} วัน</span>,
    },

    // { title: 'สถานะ', dataIndex: 'status_name', key: 'status_name', width: 150, render: t => t || '-' },
    // { title: 'ย้ายไปตึก', dataIndex: 'move_to_ward', key: 'move_to_ward', width: 100, align: 'center', render: t => t || '-' },
    
    {
      title: 'ดำเนินการ', key: 'action', width: 130, align: 'center',
      render: (_, record) => (
        <Button
          danger
          onClick={() => handleCancelDischarge(record)}
        >
          ยกเลิก DC
        </Button>
      ),
    },
  ];

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6">
        <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h2 className="text-xl font-bold text-[#006b5f] m-0 whitespace-nowrap">รายชื่อผู้ป่วยที่จำหน่าย</h2>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              <Select
                value={selectedWard}
                style={{ width: 180 }}
                onChange={setSelectedWard}
                placeholder="เลือกหอผู้ป่วย"
                allowClear
                options={wards.map(w => ({ label: w.ward_name, value: w.his_code }))}
              />

              <RangePicker
                value={dateRange}
                onChange={v => setDateRange(v ? [v[0], v[1]] : [null, null])}
                format="DD/MM/YYYY"
                placeholder={['วันที่เริ่ม', 'วันที่สิ้นสุด']}
              />

              <Input
                prefix={<VscSearch className="text-gray-400" />}
                placeholder="ค้นหา HN / AN / ชื่อ"
                style={{ width: 200 }}
                onChange={e => setSearchText(e.target.value)}
              />

              <Button icon={<VscRefresh />} onClick={fetchRecords} loading={loading}>
                รีเฟรช
              </Button>
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={filtered}
            rowKey="admission_list_id"
            pagination={{ pageSize: 10 }}
            size="middle"
            loading={loading}
            locale={{ emptyText: 'ไม่พบข้อมูล' }}
            className="[&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]! [&_.ant-table-thead_.ant-table-cell]:text-white! [&_.ant-table-thead_.ant-table-cell]:font-semibold!"
          />
        </Card>
      </div>
    </div>
  );
}
