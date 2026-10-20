'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
    Card, Button, Table, Tag, DatePicker, Typography, Empty, Input, Tooltip, Select, Alert,
} from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import Navbar from '../../components/Navbar';
import { colorOfResistance } from '../../components/ic/resistance';
import {
    PiFileXlsBold, PiMagnifyingGlassBold, PiCalendarCheckBold, PiPhoneBold, PiWarningBold,
} from 'react-icons/pi';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;

interface FollowupRow {
    id: number;
    app_date: string;
    app_time: string | null;
    hn: string;
    ptname: string | null;
    sex: string | null;
    age: number | null;
    hometel: string | null;
    informtel: string | null;
    worktel: string | null;
    department: string | null;
    spcname: string | null;
    app_cause: string | null;
    app_status: string | null;
    confirm_date: string;
    lab_no: string;
    specimen: string | null;
    organism: string;
    resistance: string;
    result_count: number;
    days_since: number;
    days_left: number;
}

interface Summary {
    date: string;
    surveillance_days: number;
    appointments: number;
    patients: number;
    departments: number;
    ending_soon: number;
    repeat_positive: number;
    by_resistance: { name: string; count: number }[];
}

const HEADERS = [
    'เวลานัด', 'HN', 'ชื่อ-สกุล', 'เพศ', 'อายุ', 'คลินิก/หน่วยงาน', 'สาขา', 'สาเหตุที่นัด',
    'วันที่พบเชื้อ', 'ผ่านมา (วัน)', 'เหลือ (วัน)', 'เลขที่ Lab', 'สิ่งส่งตรวจ',
    'เชื้อก่อโรค', 'กลุ่มการดื้อยา', 'จำนวนผลที่พบ', 'โทรศัพท์',
];

/*
  แถบสีของวันที่เหลือก่อนพ้นเฝ้าระวัง
  เหลือน้อย = ใกล้ปิดเคส ต้องเก็บให้ครบก่อนหลุด จึงเน้นสีแดง
  ไม่ได้แปลว่าอาการหนักกว่า แต่แปลว่าเวลาเหลือน้อยกว่า
*/
const daysLeftColor = (d: number) => (d <= 7 ? 'red' : d <= 30 ? 'orange' : 'green');

const phonesOf = (r: FollowupRow) =>
    [r.hometel, r.informtel, r.worktel].filter(Boolean).join(' / ');

export default function OpdInfectionFollowupPage() {
    const [date, setDate] = useState<dayjs.Dayjs>(dayjs());
    const [rows, setRows] = useState<FollowupRow[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [groupFilter, setGroupFilter] = useState<string | null>(null);

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
            const res = await axios.post('/api/v1/ic/opd-infection-followup',
                { date: date.format('YYYY-MM-DD') },
                { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' } });

            if (res.data?.success) {
                setRows(res.data.data ?? []);
                setSummary(res.data.summary ?? null);
                setSearched(true);
            }
        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง'
                : 'กรุณาลองใหม่อีกครั้ง';
            Swal.fire({ icon: 'error', title: 'ดึงข้อมูลไม่สำเร็จ', text: message, timer: 3000, showConfirmButton: false });
        } finally {
            setLoading(false);
        }
    }, [date]);

    // กรองฝั่งหน้าจอ ข้อมูลถูกดึงมาครบแล้ว พิมพ์ค้นหาจึงไม่ต้องรอเซิร์ฟเวอร์
    const filtered = useMemo(() => rows.filter(r => {
        if (groupFilter && r.resistance !== groupFilter) return false;
        if (!keyword.trim()) return true;
        const k = keyword.trim().toLowerCase();
        return [r.hn, r.ptname, r.organism, r.department, r.spcname, r.lab_no]
            .some(v => String(v ?? '').toLowerCase().includes(k));
    }), [rows, keyword, groupFilter]);

    const toRow = (r: FollowupRow) => [
        r.app_time ?? '', r.hn, r.ptname ?? '', r.sex ?? '', r.age ?? '',
        r.department ?? '', r.spcname ?? '', r.app_cause ?? '',
        r.confirm_date, r.days_since, r.days_left, r.lab_no, r.specimen ?? '',
        r.organism, r.resistance, r.result_count, phonesOf(r),
    ];

    const exportExcel = () => {
        if (filtered.length === 0) {
            Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูลให้ส่งออก', timer: 2000, showConfirmButton: false });
            return;
        }

        const blank = Array(HEADERS.length).fill('');
        const pad = (n: number) => Array(HEADERS.length - n).fill('');
        const titleRows = [
            ['ผู้ป่วยนอกที่มีนัด และยังอยู่ในช่วงเฝ้าระวังเชื้อดื้อยา', ...pad(1)],
            [`วันนัด ${date.format('DD/MM/BBBB')} · ช่วงเฝ้าระวัง ${summary?.surveillance_days ?? 90} วันนับจากวันที่พบเชื้อ`, ...pad(1)],
            [`รวม ${filtered.length} นัด`, `ผู้ป่วย ${new Set(filtered.map(r => r.hn)).size} ราย`, ...pad(2)],
            [`ออกรายงานเมื่อ ${dayjs().format('DD/MM/BBBB HH:mm')} น.`, ...pad(1)],
            blank,
        ];

        const groupCount = new Map<string, number>();
        for (const r of filtered) groupCount.set(r.resistance, (groupCount.get(r.resistance) ?? 0) + 1);
        const summaryRows = [
            blank,
            ['--- สรุปตามกลุ่มการดื้อยา ---', ...pad(1)],
            ...[...groupCount.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => [name, count, ...pad(2)]),
        ];

        const ws = XLSX.utils.aoa_to_sheet([...titleRows, HEADERS, ...filtered.map(toRow), ...summaryRows]);
        ws['!cols'] = [
            { wch: 9 }, { wch: 11 }, { wch: 26 }, { wch: 6 }, { wch: 6 }, { wch: 24 }, { wch: 18 }, { wch: 18 },
            { wch: 13 }, { wch: 11 }, { wch: 10 }, { wch: 13 }, { wch: 13 },
            { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 24 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ติดตาม OPD');
        XLSX.writeFile(wb, `ติดตามผู้ป่วยนอกเชื้อดื้อยา_${date.format('YYYY-MM-DD')}.xlsx`);
    };

    const columns: TableColumnsType<FollowupRow> = [
        {
            title: 'เวลานัด', dataIndex: 'app_time', key: 'app_time', width: 85, align: 'center', fixed: 'left',
            sorter: (a, b) => String(a.app_time ?? '').localeCompare(String(b.app_time ?? '')),
            render: (v: string) => v ? <span className="font-semibold">{v} น.</span> : <span className="text-gray-300">-</span>,
        },
        {
            title: 'HN / ชื่อ-สกุล', key: 'patient', width: 230, fixed: 'left',
            render: (_, r) => (
                <div className="leading-tight">
                    <div className="font-semibold">{r.ptname || '-'}</div>
                    <div className="text-xs text-gray-500">
                        HN {r.hn}{r.sex ? ` · ${r.sex}` : ''}{r.age !== null ? ` · ${r.age} ปี` : ''}
                    </div>
                </div>
            ),
        },
        {
            title: 'คลินิกที่นัด', key: 'department', width: 210,
            render: (_, r) => (
                <div className="leading-tight">
                    <div>{r.department || '-'}</div>
                    {r.spcname && <div className="text-xs text-gray-400">{r.spcname}</div>}
                </div>
            ),
        },
        {
            title: 'เชื้อที่พบ', key: 'organism', width: 250,
            render: (_, r) => (
                <div className="leading-tight">
                    <div className="italic">{r.organism}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Tag color={colorOfResistance(r.resistance)} className="m-0">{r.resistance}</Tag>
                        {r.result_count > 1 && (
                            <Tooltip title={`พบเชื้อ ${r.result_count} ครั้งในช่วงเฝ้าระวัง`}>
                                <Tag className="m-0" color="default">ซ้ำ {r.result_count} ครั้ง</Tag>
                            </Tooltip>
                        )}
                    </div>
                </div>
            ),
        },
        {
            title: 'วันที่พบเชื้อ', dataIndex: 'confirm_date', key: 'confirm_date', width: 115, align: 'center',
            sorter: (a, b) => a.confirm_date.localeCompare(b.confirm_date),
            render: (d: string) => dayjs(d).format('DD/MM/BBBB'),
        },
        {
            title: 'เฝ้าระวังคงเหลือ', dataIndex: 'days_left', key: 'days_left', width: 140, align: 'center',
            defaultSortOrder: 'ascend',
            sorter: (a, b) => a.days_left - b.days_left,
            render: (v: number, r) => (
                <Tooltip title={`พบเชื้อมาแล้ว ${r.days_since} วัน จากช่วงเฝ้าระวัง ${summary?.surveillance_days ?? 90} วัน`}>
                    <Tag color={daysLeftColor(v)} className="m-0 font-semibold">เหลือ {v} วัน</Tag>
                </Tooltip>
            ),
        },
        {
            title: 'เลขที่ Lab', key: 'lab', width: 130,
            render: (_, r) => (
                <div className="leading-tight">
                    <div className="text-xs">{r.lab_no}</div>
                    {r.specimen && <div className="text-xs text-gray-400">{r.specimen}</div>}
                </div>
            ),
        },
        {
            title: 'โทรศัพท์', key: 'tel', width: 160,
            render: (_, r) => {
                const tel = phonesOf(r);
                return tel
                    ? <span className="text-xs"><PiPhoneBold className="inline mr-1 text-gray-400" />{tel}</span>
                    : <span className="text-gray-300 text-xs">ไม่มีเบอร์ติดต่อ</span>;
            },
        },
        {
            title: 'สาเหตุที่นัด', dataIndex: 'app_cause', key: 'app_cause', width: 170,
            render: (v: string) => v || <span className="text-gray-300">-</span>,
        },
    ];

    const groupOptions = (summary?.by_resistance ?? []).map(g => ({
        label: `${g.name} (${g.count})`,
        value: g.name,
    }));

    return (
        <div className="bg-slate-50 dark:bg-[#141414] min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-full mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#006b5f] p-2.5 rounded-xl shadow-md">
                                <PiCalendarCheckBold className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <Title level={4} className="m-0!">ติดตามผู้ป่วยนอกเชื้อดื้อยา (เฝ้าระวัง 90 วัน)</Title>
                                <Text type="secondary" className="text-sm">
                                    เลือกวันนัดล่วงหน้า เพื่อดูว่าวันนั้นจะมีผู้ป่วยที่ยังอยู่ในช่วงเฝ้าระวังมาตามนัดกี่ราย
                                </Text>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">วันนัด</label>
                                <DatePicker
                                    value={date}
                                    onChange={d => d && setDate(d)}
                                    format="DD/MM/BBBB"
                                    allowClear={false}
                                    presets={[
                                        { label: 'วันนี้', value: dayjs() },
                                        { label: 'พรุ่งนี้', value: dayjs().add(1, 'day') },
                                        { label: 'อีก 7 วัน', value: dayjs().add(7, 'day') },
                                        { label: 'อีก 30 วัน', value: dayjs().add(30, 'day') },
                                    ]}
                                />
                            </div>
                            <Button
                                type="primary"
                                icon={<PiMagnifyingGlassBold />}
                                loading={loading}
                                onClick={fetchReport}
                                className="bg-[#006b5f] hover:bg-[#005a50] border-none shadow-md"
                            >
                                ค้นหา
                            </Button>
                            <Button
                                icon={<PiFileXlsBold />}
                                onClick={exportExcel}
                                disabled={filtered.length === 0}
                            >
                                ส่งออก Excel
                            </Button>
                        </div>
                    </div>

                    {/* ── สรุปหัวรายงาน ── */}
                    {summary && searched && (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                            <StatBox label="นัดทั้งหมด" value={summary.appointments} unit="นัด" tone="teal" />
                            <StatBox label="ผู้ป่วย" value={summary.patients} unit="ราย" tone="blue" />
                            <StatBox label="คลินิกที่เกี่ยวข้อง" value={summary.departments} unit="แห่ง" tone="violet" />
                            <StatBox label="ใกล้ครบเฝ้าระวัง (≤7 วัน)" value={summary.ending_soon} unit="นัด" tone="red" />
                            <StatBox label="พบเชื้อซ้ำหลายครั้ง" value={summary.repeat_positive} unit="นัด" tone="orange" />
                        </div>
                    )}

                    {searched && rows.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <Input
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                                placeholder="ค้นหา HN / ชื่อ / เชื้อ / คลินิก"
                                prefix={<PiMagnifyingGlassBold className="text-gray-400" />}
                                allowClear
                                style={{ width: 280 }}
                            />
                            <Select
                                value={groupFilter}
                                onChange={setGroupFilter}
                                options={groupOptions}
                                placeholder="กรองตามกลุ่มการดื้อยา"
                                allowClear
                                style={{ width: 240 }}
                            />
                            <Text type="secondary" className="text-sm">
                                แสดง {filtered.length.toLocaleString('th-TH')} จาก {rows.length.toLocaleString('th-TH')} นัด
                            </Text>
                        </div>
                    )}

                    {/*
                      ต้องบอกข้อจำกัดไว้บนหน้าจอ ไม่ใช่แค่ในโค้ด
                      ถ้าคนใช้เข้าใจว่านี่คือรายชื่อทั้งหมดของวันนั้น จะพลาดคนที่เดินเข้ามาเองโดยไม่มีนัด
                    */}
                    {searched && (
                        <Alert
                            type="info"
                            showIcon
                            icon={<PiWarningBold />}
                            className="mb-3"
                            title="รายการนี้มาจากตารางนัดหมาย จึงไม่รวมผู้ป่วยที่เดินเข้ามาเองโดยไม่มีนัด — ใช้คู่กับหน้า OPD Daily ที่ดูจากการมารับบริการจริง"
                        />
                    )}

                    <Table
                        rowKey="id"
                        columns={columns}
                        dataSource={filtered}
                        loading={loading}
                        size="small"
                        bordered
                        scroll={{ x: 'max-content' }}
                        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `รวม ${t.toLocaleString('th-TH')} นัด` }}
                        locale={{
                            emptyText: (
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description={searched
                                        ? 'วันที่เลือกไม่มีผู้ป่วยที่อยู่ในช่วงเฝ้าระวังมาตามนัด'
                                        : 'เลือกวันนัดแล้วกดค้นหา'}
                                />
                            ),
                        }}
                    />
                </Card>
            </div>
        </div>
    );
}

const TONE: Record<string, string> = {
    teal: 'from-teal-500 to-emerald-600',
    blue: 'from-blue-500 to-indigo-600',
    violet: 'from-violet-500 to-purple-600',
    red: 'from-rose-500 to-red-600',
    orange: 'from-amber-500 to-orange-600',
};

function StatBox({ label, value, unit, tone }: { label: string; value: number; unit: string; tone: string }) {
    return (
        <div className={`bg-linear-to-br ${TONE[tone]} rounded-xl p-3 text-white shadow-md`}>
            <p className="text-white/75 text-[11px] font-medium mb-1 leading-tight">{label}</p>
            <p className="m-0 text-2xl font-bold leading-none">
                {value.toLocaleString('th-TH')}
                <span className="text-xs font-normal ml-1">{unit}</span>
            </p>
        </div>
    );
}
