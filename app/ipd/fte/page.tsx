"use client"
import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Select, Typography, DatePicker, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Navbar from '../../components/Navbar';
import axios from 'axios';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title } = Typography;

interface Ward {
  ward: number;
  ward_name: string;
  his_code: string;
  general?: number;
  crisis?: number;
}

const bold = (val: number | string) => (Number(val) > 0 ? <strong>{val}</strong> : <span>{val}</span>);

const NUMERIC_FIELDS = [
  'ptNormal', 'ptO2', 'ptHfnc', 'ptVent', 'fte',
  'noOtRn', 'noOtTn', 'noOtPn',
  'ot8Rn', 'ot8Tn', 'ot8Pn',
  'ot4Rn', 'ot4Tn', 'ot4Pn',
  'diff', 'prod1',
  't1', 't2', 't3', 't4', 't5',
  'total', 'prod2',
] as const;

type NumericField = typeof NUMERIC_FIELDS[number];

const SHIFT_COLORS: Record<string, string> = { N: '#e6f7ff', D: '#fff7e6', E: '#fff1f0' };
const SHIFT_LABELS: Record<string, string> = { N: 'รวมเวรดึก (N)', D: 'รวมเวรเช้า (D)', E: 'รวมเวรบ่าย (E)' };

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
        { title: 'ปกติ', dataIndex: 'ptNormal', key: 'ptNormal', align: 'center', width: 50, render: bold },
        { title: 'O2', dataIndex: 'ptO2', key: 'ptO2', align: 'center', width: 50, render: bold },
        { title: 'HFNC', dataIndex: 'ptHfnc', key: 'ptHfnc', align: 'center', width: 50, render: bold },
      ]
    },
    {
      title: 'ยอด\n ventilator  C/S',
      dataIndex: 'ptVent',
      key: 'ptVent',
      align: 'center',
      width: 70,
      render: bold,
    },
    {
      title: 'FTE',
      dataIndex: 'fte',
      key: 'fte',
      align: 'center',
      width: 60,
      render: bold,
    },
    {
      title: 'ขึ้นตามตารางเวร',
      children: [
        {
          title: 'ไม่ใช่ OT',
          children: [
            { title: 'RN', dataIndex: 'noOtRn', key: 'noOtRn', align: 'center', width: 40, className: 'text-red-500', render: bold },
            { title: 'TN', dataIndex: 'noOtTn', key: 'noOtTn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
            { title: 'PN', dataIndex: 'noOtPn', key: 'noOtPn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
          ],
        },
        {
          title: 'OT 8 hr',
          children: [
            { title: 'RN', dataIndex: 'ot8Rn', key: 'ot8Rn', align: 'center', width: 40, className: 'text-red-500', render: bold },
            { title: 'TN', dataIndex: 'ot8Tn', key: 'ot8Tn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
            { title: 'PN', dataIndex: 'ot8Pn', key: 'ot8Pn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
          ],
        },
        {
          title: 'OT 4 hr',
          children: [
            { title: 'RN', dataIndex: 'ot4Rn', key: 'ot4Rn', align: 'center', width: 40, className: 'text-red-500', render: bold },
            { title: 'TN', dataIndex: 'ot4Tn', key: 'ot4Tn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
            { title: 'PN', dataIndex: 'ot4Pn', key: 'ot4Pn', align: 'center', width: 40, className: 'text-blue-500', render: bold },
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
        <span style={{ color: val < 0 ? 'red' : 'inherit', fontWeight: val !== 0 ? 'bold' : 'normal' }}>{val}</span>
      ),
    },
    {
      title: 'product',
      dataIndex: 'prod1',
      key: 'prod1',
      align: 'center',
      width: 80,
      onCell: () => ({ style: { backgroundColor: '#f0f5ff' } }),
      render: bold,
    },
    {
      title: 'ประเภทผู้ป่วย',
      children: [
        { title: '1', dataIndex: 't1', key: 't1', align: 'center', width: 40, render: bold },
        { title: '2', dataIndex: 't2', key: 't2', align: 'center', width: 40, render: bold },
        { title: '3', dataIndex: 't3', key: 't3', align: 'center', width: 40, render: bold },
        { title: '4', dataIndex: 't4', key: 't4', align: 'center', width: 40, render: bold },
        { title: '5', dataIndex: 't5', key: 't5', align: 'center', width: 40, render: bold },
      ],
    },
    {
      title: 'รวม',
      dataIndex: 'total',
      key: 'total',
      align: 'center',
      width: 60,
      onCell: () => ({ style: { backgroundColor: '#d9f7be', fontWeight: 'bold' } }),
      render: bold,
    },
    {
      title: 'product\nตาม\nประเภท',
      dataIndex: 'prod2',
      key: 'prod2',
      align: 'center',
      width: 80,
      render: bold,
    },
  ];



  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState<string | undefined>();
  const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const wardConfig = useMemo(() => {
    const w = wards.find(x => x.his_code === selectedWard);
    return { general: w?.general, crisis: w?.crisis };
  }, [wards, selectedWard]);

  // 1. ดึงรายชื่อหอผู้ป่วย
  useEffect(() => {
    const fetchWards = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) return;
        const response = await axios.get('/api/v1/system/wardsV1', {
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

          const daysMap: Record<string, any[]> = {};
          rawData.forEach((item: any) => {
            const dateKey = item.record_date;
            if (!daysMap[dateKey]) daysMap[dateKey] = [];
            daysMap[dateKey].push(item);
          });

          let finalData: any[] = [];
          Object.keys(daysMap).sort().forEach(dateKey => {
            const shiftsForDay = daysMap[dateKey].sort((a: any, b: any) => a.shift_type_id - b.shift_type_id);
            shiftsForDay.forEach((item: any, index: number) => {
              finalData.push({
                key: `${item.record_date}-${item.shift_type_id}`,
                date: dayjs(item.record_date).date(),
                indexInDay: index,
                rowSpanForDay: index === 0 ? shiftsForDay.length : 0,
                shift: item.shift_name === 'ดึก' ? 'N' : item.shift_name === 'เช้า' ? 'D' : 'E',
                ptNormal: parseInt(item.normal) || 0,
                ptO2: parseInt(item.o2) || 0,
                ptHfnc: parseInt(item.hfnc) || 0,
                ptVent: parseInt(item.vent_cs) || 0,
                fte: parseFloat(item.final_score) || 0,
                t1: parseInt(item.severity_level_1) || 0,
                t2: parseInt(item.severity_level_2) || 0,
                t3: parseInt(item.severity_level_3) || 0,
                t4: parseInt(item.severity_level_4) || 0,
                t5: parseInt(item.severity_level_5) || 0,
                total: parseInt(item.total) || 0,
                prod1: parseFloat(item.total_score) || 0,
                prod2: parseFloat(item.final_score) || 0,
                // _n=ดึก(1), _m=เช้า(2), _a=บ่าย(3)
                ...(item.shift_type_id === 1 ? {
                  noOtRn: parseInt(item.rn_n) || 0,
                  noOtTn: parseInt(item.rt_n) || 0,
                  noOtPn: parseInt(item.pn_n) || 0,
                  ot8Rn: parseInt(item.rn_n_ot8) || 0,
                  ot8Tn: parseInt(item.rt_n_ot8) || 0,
                  ot8Pn: parseInt(item.pn_n_ot8) || 0,
                  ot4Rn: parseInt(item.rn_n_ot4) || 0,
                  ot4Tn: parseInt(item.rt_n_ot4) || 0,
                  ot4Pn: parseInt(item.pn_n_ot4) || 0,
                } : item.shift_type_id === 2 ? {
                  noOtRn: parseInt(item.rn_m) || 0,
                  noOtTn: parseInt(item.rt_m) || 0,
                  noOtPn: parseInt(item.pn_m) || 0,
                  ot8Rn: parseInt(item.rn_m_ot8) || 0,
                  ot8Tn: parseInt(item.rt_m_ot8) || 0,
                  ot8Pn: parseInt(item.pn_m_ot8) || 0,
                  ot4Rn: parseInt(item.rn_m_ot4) || 0,
                  ot4Tn: parseInt(item.rt_m_ot4) || 0,
                  ot4Pn: parseInt(item.pn_m_ot4) || 0,
                } : {
                  noOtRn: parseInt(item.rn_a) || 0,
                  noOtTn: parseInt(item.rt_a) || 0,
                  noOtPn: parseInt(item.pn_a) || 0,
                  ot8Rn: parseInt(item.rn_a_ot8) || 0,
                  ot8Tn: parseInt(item.rt_a_ot8) || 0,
                  ot8Pn: parseInt(item.pn_a_ot8) || 0,
                  ot4Rn: parseInt(item.rn_a_ot4) || 0,
                  ot4Tn: parseInt(item.rt_a_ot4) || 0,
                  ot4Pn: parseInt(item.pn_a_ot4) || 0,
                }),
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
        setTableData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFteData();
  }, [selectedWard, selectedMonth]);

  const summaryRows = useMemo(() => {
    const dayCount = tableData.filter(r => r.shift === 'N').length || 1;

    const byShift = ['N', 'D', 'E'].map(shift => {
      const rows = tableData.filter(r => r.shift === shift);
      const row: Record<string, number | string> = { shift };
      NUMERIC_FIELDS.forEach(f => {
        row[f] = rows.reduce((acc, r) => acc + (Number(r[f]) || 0), 0);
      });
      return row;
    });

    const avgRow: Record<string, number | string> = { shift: 'เฉลี่ย/วัน' };
    NUMERIC_FIELDS.forEach(f => {
      const total = tableData.reduce((acc, r) => acc + (Number(r[f]) || 0), 0);
      avgRow[f] = parseFloat((total / 3 / dayCount).toFixed(2));
    });

    return [...byShift, avgRow];
  }, [tableData]);

  const handleExportExcel = () => {
    const wardObj = wards.find(w => w.his_code === selectedWard);
    const wardName = wardObj?.ward_name || selectedWard || 'ward';
    const monthStr = selectedMonth.format('YYYY-MM');

    const HEADERS = [
      'วันที่', 'เวร',
      'ปกติ', 'O2', 'HFNC', 'Vent C/S', 'FTE',
      'ไม่OT-RN', 'ไม่OT-TN', 'ไม่OT-PN',
      'OT8-RN', 'OT8-TN', 'OT8-PN',
      'OT4-RN', 'OT4-TN', 'OT4-PN',
      '-ขาด/+เกิน', 'product',
      'ประเภท1', 'ประเภท2', 'ประเภท3', 'ประเภท4', 'ประเภท5',
      'รวม', 'productตามประเภท',
    ];

    const toRow = (r: Record<string, any>) => [
      r.date ?? '', r.shift ?? '',
      ...NUMERIC_FIELDS.map(f => r[f] ?? 0),
    ];

    const dataRows = tableData.map(toRow);
    const blankRow = Array(HEADERS.length).fill('');
    const summaryHeaderRow = ['--- สรุปทั้งเดือน ---', ...Array(HEADERS.length - 1).fill('')];
    const summaryDataRows = summaryRows.map(r => [SHIFT_LABELS[r.shift as string] || r.shift, '', ...NUMERIC_FIELDS.map(f => r[f] ?? 0)]);

    const configRows = [
      [`ค่าน้ำหนักผู้ป่วยทั่วไปต่อพยาบาล 1 คน = ${wardConfig.general ?? '-'}`, ...Array(HEADERS.length - 1).fill('')],
      [`ค่าน้ำหนักผู้ป่วย on ventilator หรือ C/S ต่อพยาบาล 1 คน = ${wardConfig.crisis ?? '-'}`, ...Array(HEADERS.length - 1).fill('')],
      blankRow,
    ];

    const wsData = [...configRows, HEADERS, ...dataRows, blankRow, summaryHeaderRow, ...summaryDataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = HEADERS.map(() => ({ wch: 12 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FTE');
    XLSX.writeFile(wb, `FTE_${wardName}_${monthStr}.xlsx`);
  };

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
              <Button
                size="middle"
                onClick={handleExportExcel}
                disabled={tableData.length === 0}
                style={{ backgroundColor: '#217346', borderColor: '#217346', color: '#fff' }}
              >
                ส่งออก Excel
              </Button>
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
              rowClassName={() => 'hover:bg-gray-50'}
              title={() => (
                <div className="flex flex-col gap-0.5 text-sm font-medium text-white">
                  <span>
                    ค่าน้ำหนักผู้ป่วยทั่วไปต่อพยาบาล 1 คน&nbsp;=&nbsp;
                    <strong>{wardConfig.general ?? '-'}</strong>
                  </span>
                  <span>
                    ค่าน้ำหนักผู้ป่วย on ventilator หรือ C/S ต่อพยาบาล 1 คน&nbsp;=&nbsp;
                    <strong>{wardConfig.crisis ?? '-'}</strong>
                  </span>
                </div>
              )}
              loading={loading}
              className="
                [&_.ant-table-title]:bg-[#006b5f]!
                [&_.ant-table-title]:border-b-0!
                [&_.ant-table-thead_.ant-table-cell]:bg-[#006b5f]!
                [&_.ant-table-thead_.ant-table-cell]:text-white!
                [&_.ant-table-thead_.ant-table-cell]:font-semibold!
                [&_.ant-table-thead_.ant-table-cell]:border-[#005a50]!
                [&_.ant-table-thead>tr:nth-child(2)_.ant-table-cell]:bg-[#00897b]!
                [&_.ant-table-thead>tr:nth-child(3)_.ant-table-cell]:bg-[#26a69a]!
              "
              summary={() => (
                <Table.Summary fixed="bottom">
                  {summaryRows.map((row, rowIdx) => {
                    const isAvg = row.shift === 'เฉลี่ย/วัน';
                    const bg = isAvg ? '#f6ffed' : SHIFT_COLORS[row.shift as string] || '#fafafa';
                    const label = isAvg ? 'เฉลี่ย/วัน' : SHIFT_LABELS[row.shift as string];
                    return (
                      <Table.Summary.Row key={rowIdx} style={{ backgroundColor: bg }}>
                        <Table.Summary.Cell index={0} colSpan={2} align="center">
                          <strong style={{ color: isAvg ? '#389e0d' : '#006b5f' }}>{label}</strong>
                        </Table.Summary.Cell>
                        {NUMERIC_FIELDS.map((f, fi) => {
                          const val = Number(row[f]);
                          return (
                            <Table.Summary.Cell key={f} index={fi + 2} align="center">
                              {val > 0
                                ? <strong>{Number.isInteger(val) ? val : val.toFixed(2)}</strong>
                                : <span style={{ color: '#ccc' }}>-</span>}
                            </Table.Summary.Cell>
                          );
                        })}
                      </Table.Summary.Row>
                    );
                  })}
                </Table.Summary>
              )}
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ScheduleTableAntd;