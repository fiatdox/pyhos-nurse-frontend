'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Card, Button, Table, DatePicker, Typography, Empty, Select, Segmented, Tag, Modal, Spin } from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import Navbar from '../../components/Navbar';
import type { PivotPDFProps } from './PivotPDF';
import { PiTableBold, PiFileXlsBold, PiMagnifyingGlassBold, PiFilePdfBold } from 'react-icons/pi';
import { formatMoney } from '../../lib/money';

// @react-pdf/renderer แตะ API ของเบราว์เซอร์ตั้งแต่ตอน import จึงต้องปิด ssr
const PivotPDFViewer = dynamic(() => import('./PDFViewerClient').then(m => m.PivotPDFViewer), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full"><Spin size="large" /></div>,
});
const PivotPDFDownloadBtn = dynamic(() => import('./PDFViewerClient').then(m => m.PivotPDFDownloadBtn), { ssr: false });

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface Fact {
    ward: string;
    ward_name: string;
    meal: number;
    meal_name: string;
    food_type_id: number;
    food_type_name: string;
    order_date: string;
    qty: number;
}

/*
  มิติที่สลับเป็นแถวหรือคอลัมน์ได้

  sort กำหนดลำดับที่ต้องการให้แสดง ไม่ใช่เรียงตามตัวอักษร
  เพราะมื้อต้องเรียง เช้า-กลางวัน-เย็น และประเภทต้องเรียง สามัญ-พิเศษ-VIP
  ถ้าเรียงตามชื่อจะสลับกันมั่วและอ่านเทียบกันไม่ได้
*/
const DIMENSIONS = {
    ward: { label: 'หอผู้ป่วย', key: (f: Fact) => f.ward_name, sort: (f: Fact) => f.ward_name },
    meal: { label: 'มื้อ', key: (f: Fact) => `มื้อ${f.meal_name}`, sort: (f: Fact) => String(f.meal).padStart(3, '0') },
    type: { label: 'ประเภท', key: (f: Fact) => f.food_type_name, sort: (f: Fact) => String(f.food_type_id).padStart(3, '0') },
    date: { label: 'วันที่', key: (f: Fact) => dayjs(f.order_date).format('DD/MM/BB'), sort: (f: Fact) => f.order_date },
    month: { label: 'เดือน', key: (f: Fact) => dayjs(f.order_date).format('MM/BBBB'), sort: (f: Fact) => f.order_date.slice(0, 7) },
} as const;

type DimKey = keyof typeof DIMENSIONS;

const DIM_OPTIONS = (Object.keys(DIMENSIONS) as DimKey[]).map(k => ({ label: DIMENSIONS[k].label, value: k }));

/** ค่าที่ต้องเรียงลำดับได้ ใช้คู่ (ค่าเรียง, ค่าที่แสดง) กันชื่อซ้ำจากคนละลำดับ */
interface Member { sort: string; label: string; }

interface FoodType { food_type_id: number; food_type_name: string; }

interface CostRow {
    food_type_id: number;
    food_type_name: string;
    /** ถาดที่งานโภชนาการรับมอบแล้ว คิดเงินได้ */
    meals: number;
    /** สั่งแล้วแต่ยังไม่มีใครกดรับ ยังไม่เข้ายอดเงิน */
    pending_meals: number;
    price_per_day: number | null;
    meals_per_day: number | null;
    effective_from: string | null;
    effective_to: string | null;
    contract_note: string | null;
    amount: number | null;
    has_price: boolean;
}

/**
 * รายชื่อสมาชิกของมิติหนึ่ง
 *
 * ประเภทอาหารอ่านจากทะเบียน ไม่ใช่จากข้อมูลที่มีในช่วงนั้น
 * เพื่อให้ สามัญ / พิเศษ / VIP ขึ้นครบทุกครั้ง แม้เดือนนั้นไม่มีใครสั่ง VIP เลย
 * ช่องที่เป็นศูนย์คือข้อมูล ไม่ใช่ช่องว่างเปล่า ถ้าคอลัมน์หายไปทั้งคอลัมน์
 * คนอ่านจะแยกไม่ออกว่า "ไม่มีใครสั่ง" กับ "ระบบไม่ได้นับให้"
 */
const dimMembers = (facts: Fact[], dim: DimKey, types: FoodType[]): Member[] => {
    if (dim === 'type') {
        return types.map(t => ({ sort: String(t.food_type_id).padStart(3, '0'), label: t.food_type_name }));
    }
    const map = new Map<string, Member>();
    for (const f of facts) {
        const sort = DIMENSIONS[dim].sort(f);
        map.set(sort, { sort, label: DIMENSIONS[dim].key(f) });
    }
    return [...map.values()].sort((a, b) => a.sort.localeCompare(b.sort));
};

/* สองมิติจับคู่กันครบทุกแบบ ไม่ใช่เฉพาะคู่ที่มีข้อมูล มื้อเย็น × VIP จึงมีช่องของตัวเองเสมอ */
const collect = (facts: Fact[], dims: DimKey[], types: FoodType[]): Member[] => {
    if (dims.length === 0) return [];
    let out: Member[] = [{ sort: '', label: '' }];
    for (const d of dims) {
        const members = dimMembers(facts, d, types);
        out = out.flatMap(o => members.map(m => ({
            sort: o.sort ? `${o.sort} ${m.sort}` : m.sort,
            label: o.label ? `${o.label} · ${m.label}` : m.label,
        })));
    }
    return out;
};

const factKey = (f: Fact, dims: DimKey[]) => dims.map(d => DIMENSIONS[d].sort(f)).join(' ');

export default function FoodPivotPage() {
    const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf('month'),
        dayjs().endOf('month'),
    ]);
    const [facts, setFacts] = useState<Fact[]>([]);
    const [foodTypes, setFoodTypes] = useState<FoodType[]>([]);
    const [cost, setCost] = useState<CostRow[]>([]);
    const [costTotal, setCostTotal] = useState(0);
    const [costUnpriced, setCostUnpriced] = useState(0);
    const [costPending, setCostPending] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [printing, setPrinting] = useState(false);
    // แนวตั้งเป็นค่าเริ่มต้นตามที่ใช้กันปกติ สลับเป็นแนวนอนได้ตอนคอลัมน์เยอะจนอ่านยาก
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

    // ค่าเริ่มต้นตามที่ใช้บ่อยที่สุด: แถวเป็นตึก คอลัมน์เป็นมื้อแล้วแตกเป็นประเภท
    const [rowDims, setRowDims] = useState<DimKey[]>(['ward']);
    const [colDims, setColDims] = useState<DimKey[]>(['meal', 'type']);
    const [showZero, setShowZero] = useState<'ซ่อน' | 'แสดง'>('แสดง');

    const authHeaders = useCallback((): Record<string, string> => {
        const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.post('/api/v1/nutrition/food-pivot', {
                date1: range[0].format('YYYY-MM-DD'),
                date2: range[1].format('YYYY-MM-DD'),
            }, { headers: authHeaders() });
            if (res.data?.success) {
                setFacts(res.data.data.rows ?? []);
                setFoodTypes(res.data.data.food_types ?? []);
                setCost(res.data.data.cost ?? []);
                setCostTotal(res.data.data.cost_total ?? 0);
                setCostUnpriced(res.data.data.cost_unpriced_meals ?? 0);
                setCostPending(res.data.data.cost_pending_meals ?? 0);
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
    }, [range, authHeaders]);

    /*
      สร้างตารางไขว้ฝั่งหน้าจอ ข้อมูลดิบถูกดึงมาครบแล้ว
      สลับแกนจึงไม่ต้องรอเซิร์ฟเวอร์ กดเปลี่ยนมุมมองแล้วเห็นผลทันที
    */
    const pivot = useMemo(() => {
        const rowMembers = collect(facts, rowDims, foodTypes);
        const colMembers = collect(facts, colDims, foodTypes);

        const cell = new Map<string, number>();
        for (const f of facts) {
            const k = `${factKey(f, rowDims)}${factKey(f, colDims)}`;
            cell.set(k, (cell.get(k) ?? 0) + f.qty);
        }

        const data = rowMembers.map(rm => {
            const row: Record<string, string | number> = { __key: rm.sort, __label: rm.label };
            let total = 0;
            for (const cm of colMembers) {
                const v = cell.get(`${rm.sort}${cm.sort}`) ?? 0;
                row[cm.sort] = v;
                total += v;
            }
            row.__total = total;
            return row;
        // แถวที่ไม่มียอดเลยตัดทิ้ง ต่างจากคอลัมน์ที่ต้องเห็นครบทุกประเภทเพื่อเทียบกัน
        }).filter(r => Number(r.__total) > 0);

        // ยอดรวมท้ายคอลัมน์ คิดจากข้อมูลเดียวกัน ไม่ได้บวกจากตัวเลขที่ปัดมาแล้ว
        const colTotals = new Map<string, number>();
        for (const cm of colMembers) {
            colTotals.set(cm.sort, data.reduce((s, r) => s + Number(r[cm.sort] ?? 0), 0));
        }

        /*
          ค่าเริ่มต้นแสดงคอลัมน์ที่เป็นศูนย์ไว้ เพราะประเภทที่ไม่มีคนสั่งก็ต้องเห็นว่าเป็นศูนย์
          ปุ่มซ่อนมีไว้ตอนกางเป็นรายวันทั้งเดือน ซึ่งคอลัมน์จะเยอะจนอ่านยาก
        */
        const visibleCols = showZero === 'แสดง'
            ? colMembers
            : colMembers.filter(cm => (colTotals.get(cm.sort) ?? 0) > 0);

        return {
            rowMembers,
            colMembers: visibleCols,
            data,
            colTotals,
            grandTotal: data.reduce((s, r) => s + Number(r.__total), 0),
        };
    }, [facts, foodTypes, rowDims, colDims, showZero]);

    /*
      คอลัมน์สองชั้นเมื่อเลือกสองมิติ เช่น มื้อเช้า → สามัญ / พิเศษ / VIP
      ป้ายชั้นบนคือมิติแรก ชั้นล่างคือมิติที่สอง อ่านง่ายกว่าเอาสองคำมาต่อกันในบรรทัดเดียว
    */
    const columns: TableColumnsType<Record<string, string | number>> = useMemo(() => {
        const head: TableColumnsType<Record<string, string | number>> = [{
            title: rowDims.map(d => DIMENSIONS[d].label).join(' · '),
            dataIndex: '__label',
            key: '__label',
            fixed: 'left',
            width: 200,
            render: (v: string) => <span className="font-semibold">{v}</span>,
        }];

        const valueCol = (cm: Member, title: string) => ({
            title,
            dataIndex: cm.sort,
            key: cm.sort,
            width: 92,
            align: 'right' as const,
            render: (v: number) => v > 0
                ? <span className="font-medium">{v.toLocaleString('th-TH')}</span>
                : <span className="text-gray-300">-</span>,
        });

        if (colDims.length === 2) {
            const groups = new Map<string, Member[]>();
            for (const cm of pivot.colMembers) {
                const top = cm.label.split(' · ')[0] ?? '';
                groups.set(top, [...(groups.get(top) ?? []), cm]);
            }
            for (const [top, members] of groups) {
                head.push({
                    title: <span className="font-bold">{top}</span>,
                    key: top,
                    children: members.map(cm => valueCol(cm, cm.label.split(' · ').slice(1).join(' · '))),
                });
            }
        } else {
            for (const cm of pivot.colMembers) head.push(valueCol(cm, cm.label));
        }

        head.push({
            title: 'รวม', dataIndex: '__total', key: '__total', width: 100, align: 'right', fixed: 'right',
            render: (v: number) => <span className="font-bold text-[#006b5f]">{Number(v).toLocaleString('th-TH')}</span>,
        });

        return head;
    }, [pivot.colMembers, rowDims, colDims]);

    const exportExcel = () => {
        if (pivot.data.length === 0) {
            Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูลให้ส่งออก', timer: 2000, showConfirmButton: false });
            return;
        }

        const rowLabel = rowDims.map(d => DIMENSIONS[d].label).join(' · ');
        const width = pivot.colMembers.length + 2;
        const pad = (n: number) => Array(Math.max(0, width - n)).fill('');

        // สองชั้นก็ส่งออกสองแถวหัวตาราง ให้หน้าตาในไฟล์ตรงกับบนจอ
        const headerRows: (string | number)[][] = [];
        if (colDims.length === 2) {
            const top: (string | number)[] = [rowLabel];
            const bottom: (string | number)[] = [''];
            let prev = '';
            for (const cm of pivot.colMembers) {
                const parts = cm.label.split(' · ');
                const t = parts[0] ?? '';
                top.push(t === prev ? '' : t);
                prev = t;
                bottom.push(parts.slice(1).join(' · '));
            }
            top.push('รวม');
            bottom.push('');
            headerRows.push(top, bottom);
        } else {
            headerRows.push([rowLabel, ...pivot.colMembers.map(c => c.label), 'รวม']);
        }

        const body = pivot.data.map(r => [
            String(r.__label),
            ...pivot.colMembers.map(cm => Number(r[cm.sort] ?? 0)),
            Number(r.__total),
        ]);

        const totalRow = [
            'รวมทั้งสิ้น',
            ...pivot.colMembers.map(cm => pivot.colTotals.get(cm.sort) ?? 0),
            pivot.grandTotal,
        ];

        // สรุปค่าใช้จ่ายต่อท้ายในชีตเดียวกัน คนรับไฟล์จะได้ไม่ต้องเปิดสองไฟล์มาเทียบ
        const costRows: (string | number)[][] = cost.length === 0 ? [] : [
            [],
            ['สรุปค่าใช้จ่ายตามประเภท (ถาดที่รับแล้ว × ราคาตามประเภท ÷ มื้อต่อวัน)', ...pad(1)],
            ['ประเภท', 'ถาดที่รับแล้ว', 'รอรับ', 'ราคาตามประเภท', 'มื้อ/วัน', 'การคำนวณ', 'เป็นเงิน'],
            ...cost.map(c => [
                c.food_type_name,
                c.meals,
                c.pending_meals,
                c.has_price ? Number(c.price_per_day) : 'ยังไม่ตั้งราคา',
                c.meals_per_day ?? '',
                c.has_price ? `${c.meals} x ${c.price_per_day} / ${c.meals_per_day}` : '',
                c.amount ?? '',
            ]),
            ['รวมทั้งสิ้น', cost.reduce((s, c) => s + c.meals, 0), costPending, '', '', '', costTotal],
        ];

        const ws = XLSX.utils.aoa_to_sheet([
            ['ตารางไขว้ยอดการสั่งอาหาร (จำนวนมื้อ)', ...pad(1)],
            [`ช่วงวันที่ ${range[0].format('DD/MM/BBBB')} - ${range[1].format('DD/MM/BBBB')}`, ...pad(1)],
            [`แถว: ${rowLabel} · คอลัมน์: ${colDims.map(d => DIMENSIONS[d].label).join(' · ')}`, ...pad(1)],
            [`ออกรายงานเมื่อ ${dayjs().format('DD/MM/BBBB HH:mm')} น.`, ...pad(1)],
            [],
            ...headerRows,
            ...body,
            [],
            totalRow,
            ...costRows,
        ]);
        ws['!cols'] = [{ wch: 26 }, ...pivot.colMembers.map(() => ({ wch: 11 })), { wch: 11 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ตารางไขว้');
        XLSX.writeFile(wb, `ตารางไขว้อาหาร_${range[0].format('YYYY-MM-DD')}_ถึง_${range[1].format('YYYY-MM-DD')}.xlsx`);
    };

    /*
      ส่งตารางที่คิดเสร็จแล้วเข้าไปใน PDF ไม่ให้เอกสารไปคิดไขว้เอง
      กระดาษกับจอจะได้เป็นตัวเลขชุดเดียวกันเสมอ รวมทั้งการซ่อนคอลัมน์ที่เป็นศูนย์
    */
    const pdfProps: PivotPDFProps = useMemo(() => ({
        rangeLabel: `${range[0].format('DD/MM/BBBB')} - ${range[1].format('DD/MM/BBBB')}`,
        printedAt: dayjs().format('DD/MM/BBBB HH:mm'),
        rowLabel: rowDims.map(d => DIMENSIONS[d].label).join(' · '),
        colLabel: colDims.length > 0 ? colDims.map(d => DIMENSIONS[d].label).join(' · ') : 'ไม่แยก',
        colMembers: pivot.colMembers.map(cm => ({ sort: cm.sort, label: cm.label })),
        twoLevel: colDims.length === 2,
        rows: pivot.data.map(r => ({
            label: String(r.__label),
            values: pivot.colMembers.map(cm => Number(r[cm.sort] ?? 0)),
            total: Number(r.__total),
        })),
        colTotals: pivot.colMembers.map(cm => pivot.colTotals.get(cm.sort) ?? 0),
        grandTotal: pivot.grandTotal,
        cost: cost.map(c => ({
            food_type_id: c.food_type_id,
            food_type_name: c.food_type_name,
            meals: c.meals,
            pending_meals: c.pending_meals,
            price_per_day: c.price_per_day,
            meals_per_day: c.meals_per_day,
            contract_note: c.contract_note,
            amount: c.amount,
            has_price: c.has_price,
        })),
        costTotal,
        costUnpricedMeals: costUnpriced,
        costPendingMeals: costPending,
        orientation,
    }), [range, rowDims, colDims, pivot, cost, costTotal, costUnpriced, costPending, orientation]);

    // กันเลือกมิติเดียวกันทั้งแถวและคอลัมน์ จะได้ตารางที่อ่านไม่ได้ความ
    const rowOptions = DIM_OPTIONS.map(o => ({ ...o, disabled: colDims.includes(o.value) }));
    const colOptions = DIM_OPTIONS.map(o => ({ ...o, disabled: rowDims.includes(o.value) }));

    return (
        <div className="bg-slate-50 dark:bg-[#141414] min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-full mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#006b5f] p-2.5 rounded-xl shadow-md">
                                <PiTableBold className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <Title level={4} className="m-0!">ตารางไขว้ยอดการสั่งอาหาร</Title>
                                <Text type="secondary" className="text-sm">
                                    สลับแกนได้เอง นับเป็นจำนวนมื้อ ไม่รวมรายการที่ถูกยกเลิก
                                </Text>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">ช่วงวันที่</label>
                                <RangePicker
                                    value={range}
                                    onChange={d => d?.[0] && d?.[1] && setRange([d[0], d[1]])}
                                    format="DD/MM/BBBB"
                                    allowClear={false}
                                    presets={[
                                        { label: 'เดือนนี้', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                                        { label: 'เดือนที่แล้ว', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                                        { label: '3 เดือนล่าสุด', value: [dayjs().subtract(2, 'month').startOf('month'), dayjs().endOf('month')] },
                                    ]}
                                />
                            </div>
                            <Button
                                type="primary"
                                icon={<PiMagnifyingGlassBold />}
                                loading={loading}
                                onClick={fetchData}
                                className="bg-[#006b5f] hover:bg-[#005a50] border-none shadow-md"
                            >
                                ดึงข้อมูล
                            </Button>
                            <Button icon={<PiFileXlsBold />} onClick={exportExcel} disabled={pivot.data.length === 0}>
                                ส่งออก Excel
                            </Button>
                            <Button icon={<PiFilePdfBold />} onClick={() => setPrinting(true)} disabled={pivot.data.length === 0}>
                                รายงาน PDF
                            </Button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-[#1f1f1f] p-4 rounded-xl border border-gray-200 dark:border-gray-700 mb-4 flex flex-wrap items-end gap-5">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">แถว</label>
                            <Select
                                mode="multiple"
                                value={rowDims}
                                onChange={v => v.length > 0 && setRowDims(v.slice(0, 2))}
                                options={rowOptions}
                                style={{ minWidth: 220 }}
                                maxCount={2}
                                placeholder="เลือกมิติของแถว"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">คอลัมน์</label>
                            <Select
                                mode="multiple"
                                value={colDims}
                                onChange={v => setColDims(v.slice(0, 2))}
                                options={colOptions}
                                style={{ minWidth: 260 }}
                                maxCount={2}
                                placeholder="เลือกมิติของคอลัมน์"
                                allowClear
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">คอลัมน์ที่ยอดเป็นศูนย์</label>
                            <Segmented
                                value={showZero}
                                onChange={v => setShowZero(v as 'ซ่อน' | 'แสดง')}
                                options={['ซ่อน', 'แสดง']}
                            />
                        </div>
                        {searched && (
                            <div className="ml-auto text-right">
                                <div className="text-xs text-gray-500">ยอดรวมทั้งตาราง</div>
                                <div className="text-2xl font-bold text-[#006b5f] leading-none">
                                    {pivot.grandTotal.toLocaleString('th-TH')}
                                    <span className="text-xs font-normal text-gray-400 ml-1">มื้อ</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {searched && pivot.data.length > 0 && (
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Tag color="green">แถว: {rowDims.map(d => DIMENSIONS[d].label).join(' · ')}</Tag>
                            <Tag color="blue">
                                คอลัมน์: {colDims.length > 0 ? colDims.map(d => DIMENSIONS[d].label).join(' · ') : 'ไม่แยก'}
                            </Tag>
                            <Text type="secondary" className="text-xs">
                                {pivot.data.length} แถว × {pivot.colMembers.length} คอลัมน์
                            </Text>
                        </div>
                    )}

                    <Table
                        rowKey="__key"
                        columns={columns}
                        dataSource={pivot.data}
                        loading={loading}
                        size="small"
                        bordered
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        locale={{
                            emptyText: (
                                <Empty
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    description={searched ? 'ช่วงที่เลือกไม่มีการสั่งอาหาร' : 'เลือกช่วงวันที่แล้วกดดึงข้อมูล'}
                                />
                            ),
                        }}
                        summary={() => pivot.data.length > 0 ? (
                            <Table.Summary fixed>
                                <Table.Summary.Row className="bg-teal-50 dark:bg-[#113536]">
                                    <Table.Summary.Cell index={0}>
                                        <span className="font-bold">รวมทั้งสิ้น</span>
                                    </Table.Summary.Cell>
                                    {pivot.colMembers.map((cm, i) => (
                                        <Table.Summary.Cell key={cm.sort} index={i + 1} align="right">
                                            <span className="font-bold">
                                                {(pivot.colTotals.get(cm.sort) ?? 0).toLocaleString('th-TH')}
                                            </span>
                                        </Table.Summary.Cell>
                                    ))}
                                    <Table.Summary.Cell index={pivot.colMembers.length + 1} align="right">
                                        <span className="text-lg font-bold text-[#006b5f]">
                                            {pivot.grandTotal.toLocaleString('th-TH')}
                                        </span>
                                    </Table.Summary.Cell>
                                </Table.Summary.Row>
                            </Table.Summary>
                        ) : null}
                    />

                    {/*
                      สรุปค่าใช้จ่ายท้ายตาราง แสดงสูตรทั้งบรรทัด ไม่ใช่เฉพาะผลลัพธ์
                      คนตรวจจะได้เห็นว่าตัวเลขมาจากถาดเท่าไหร่ ราคาเท่าไหร่ โดยไม่ต้องเปิดหน้าอื่น
                    */}
                    {searched && cost.length > 0 && (
                        <div className="mt-5 border-t-2 border-gray-200 dark:border-gray-700 pt-4">
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                                <Text strong className="text-base">สรุปค่าใช้จ่ายตามประเภท</Text>
                                <Text type="secondary" className="text-xs">
                                    จำนวนถาด × ราคาตามประเภท ÷ จำนวนมื้อต่อวัน
                                </Text>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-[#262626] text-xs">
                                            <th className="px-3 py-2 text-left font-semibold">ประเภท</th>
                                            <th className="px-3 py-2 text-right font-semibold">ถาดที่รับแล้ว</th>
                                            <th className="px-3 py-2 text-right font-semibold">ราคาตามประเภท</th>
                                            <th className="px-3 py-2 text-center font-semibold">÷ มื้อ/วัน</th>
                                            <th className="px-3 py-2 text-left font-semibold">การคำนวณ</th>
                                            <th className="px-3 py-2 text-right font-semibold">เป็นเงิน (บาท)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cost.map(c => (
                                            <tr key={`${c.food_type_id}-${c.effective_from ?? 'none'}`} className="border-b border-gray-100 dark:border-gray-800">
                                                <td className="px-3 py-2">
                                                    <span className="font-semibold">{c.food_type_name}</span>
                                                    {c.contract_note && (
                                                        <span className="block text-[11px] text-gray-400">{c.contract_note}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold">
                                                    {c.meals.toLocaleString('th-TH')}
                                                    {c.pending_meals > 0 && (
                                                        <span className="block text-[11px] font-normal text-orange-500">
                                                            รอรับ {c.pending_meals.toLocaleString('th-TH')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {c.has_price ? formatMoney(c.price_per_day) : <Tag color="red">ยังไม่ตั้งราคา</Tag>}
                                                </td>
                                                <td className="px-3 py-2 text-center text-gray-500">
                                                    {c.meals_per_day ?? '-'}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-500">
                                                    {c.has_price
                                                        ? `${c.meals} × ${formatMoney(c.price_per_day)} ÷ ${c.meals_per_day}`
                                                        : 'คิดไม่ได้'}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {c.amount === null
                                                        ? <span className="text-gray-300">-</span>
                                                        : <span className="text-base font-bold text-[#006b5f]">{formatMoney(c.amount)}</span>}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-teal-50 dark:bg-[#113536]">
                                            <td className="px-3 py-2.5 font-bold">รวมทั้งสิ้น</td>
                                            <td className="px-3 py-2.5 text-right font-bold">
                                                {cost.reduce((s, c) => s + c.meals, 0).toLocaleString('th-TH')}
                                                {costPending > 0 && (
                                                    <span className="block text-[11px] font-normal text-orange-500">
                                                        รอรับ {costPending.toLocaleString('th-TH')}
                                                    </span>
                                                )}
                                            </td>
                                            <td colSpan={3}></td>
                                            <td className="px-3 py-2.5 text-right">
                                                <span className="text-lg font-bold text-[#006b5f]">{formatMoney(costTotal)}</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {costUnpriced > 0 && (
                                <Text type="danger" className="block mt-2 text-xs">
                                    มี {costUnpriced.toLocaleString('th-TH')} ถาดที่คิดเงินไม่ได้เพราะยังไม่ได้ตั้งราคา — ยอดรวมด้านบนยังไม่รวมส่วนนี้
                                </Text>
                            )}

                            {costPending > 0 && (
                                <Text type="warning" className="block mt-2 text-xs">
                                    มี {costPending.toLocaleString('th-TH')} ถาดที่สั่งแล้วแต่งานโภชนาการยังไม่กดรับ — ยังไม่เข้ายอดเงินด้านบน
                                    {cost.every(c => c.meals === 0) && ' ยอดจึงเป็น 0 บาท ต้องไปกดรับที่หน้ารับยอดอาหารก่อน'}
                                </Text>
                            )}

                            <Text type="secondary" className="block mt-2 text-xs">
                                คิดเฉพาะถาดที่งานโภชนาการรับมอบแล้ว ไม่ขึ้นกับแกนที่สลับอยู่ · ไม่รวมรายการงดอาหารและรายการที่ถูกยกเลิก
                                · ตารางไขว้ด้านบนนับตามที่สั่ง จึงมากกว่ายอดที่คิดเงินได้
                            </Text>
                        </div>
                    )}
                </Card>
            </div>

            {/*
              เปิด PDF ในกล่องแทนหน้าใหม่ จะได้สลับแกนแล้วพิมพ์ซ้ำได้โดยไม่หลุดจากตาราง
              destroyOnHidden เพราะ PDFViewer สร้าง blob ใหม่ทุกครั้ง ถ้าค้างไว้จะกินหน่วยความจำสะสม
            */}
            <Modal
                open={printing}
                onCancel={() => setPrinting(false)}
                width="95%"
                style={{ top: 16 }}
                styles={{ body: { height: 'calc(100vh - 180px)', padding: 0 } }}
                destroyOnHidden
                title={
                    <div className="flex flex-wrap items-center gap-3 pr-8">
                        <span className="font-semibold text-[var(--brand-text)]">
                            ตารางไขว้ยอดการสั่งอาหาร · {pdfProps.rangeLabel}
                        </span>
                        <Segmented
                            size="small"
                            value={orientation}
                            onChange={v => setOrientation(v as 'portrait' | 'landscape')}
                            options={[
                                { label: 'แนวตั้ง', value: 'portrait' },
                                { label: 'แนวนอน', value: 'landscape' },
                            ]}
                        />
                        {/* คอลัมน์เกิน 20 บนแนวตั้งจะเหลือช่องละราว 12 พอยต์ ต้องบอกไว้ก่อนสั่งพิมพ์ */}
                        {orientation === 'portrait' && pivot.colMembers.length > 20 && (
                            <Text type="warning" className="text-xs font-normal">
                                {pivot.colMembers.length} คอลัมน์บนแนวตั้งจะแน่นมาก แนะนำแนวนอน
                            </Text>
                        )}
                    </div>
                }
                footer={[
                    <Button key="close" onClick={() => setPrinting(false)}>ปิด</Button>,
                    <PivotPDFDownloadBtn
                        key="download"
                        {...pdfProps}
                        fileName={`ตารางไขว้อาหาร_${range[0].format('YYYY-MM-DD')}_ถึง_${range[1].format('YYYY-MM-DD')}.pdf`}
                    />,
                ]}
            >
                {printing && <PivotPDFViewer {...pdfProps} />}
            </Modal>
        </div>
    );
}
