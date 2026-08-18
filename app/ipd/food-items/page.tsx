'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    Card, Button, Table, Tag, Input, Checkbox, Typography, Switch, Empty, Radio, Alert, Tooltip,
} from 'antd';
import type { TableColumnsType } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import Swal from 'sweetalert2';
import Navbar from '../../components/Navbar';
import { PiForkKnifeBold, PiPlusBold, PiMagnifyingGlassBold } from 'react-icons/pi';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Title, Text } = Typography;

/*
  ประเภทห้อง เรียงตามลำดับเดียวกับฝั่งเซิร์ฟเวอร์
  ชื่อเมนูจะถูกสร้างเป็น 'ชื่อที่กรอก (ประเภท)' หนึ่งแถวต่อหนึ่งประเภทที่ติ๊ก
  เพราะครัวคิดต้นทุนและจัดถาดแยกตามประเภทห้อง
*/
const FOOD_CLASSES = ['สามัญ', 'พิเศษ', 'VIP'] as const;
type FoodClass = typeof FOOD_CLASSES[number];

const CLASS_COLOR: Record<string, string> = {
    'สามัญ': 'green',
    'พิเศษ': 'blue',
    'VIP': 'gold',
    'งดอาหาร (NPO)': 'default',
};

/** ตัดวงเล็บประเภทที่ผู้ใช้พิมพ์ติดมาท้ายชื่อ ให้ตัวอย่างบนหน้าจอตรงกับที่เซิร์ฟเวอร์จะบันทึกจริง */
const stripClassSuffix = (name: string) =>
    name.replace(/\s*\(\s*(สามัญ|พิเศษ|VIP)\s*\)\s*$/i, '').trim();

const normalizeName = (name: string) => name.replace(/\s+/g, '').toLowerCase();

interface FoodItem {
    food_item_id: number;
    food_name: string;
    food_type_id: number | null;
    food_type_name: string | null;
    is_active: boolean;
    created_at: string | null;
    created_by_name: string | null;
    updated_at: string | null;
    updated_by_name: string | null;
    order_count: number;
}

export default function FoodItemsPage() {
    const [items, setItems] = useState<FoodItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);

    const [foodName, setFoodName] = useState('');
    const [classes, setClasses] = useState<FoodClass[]>([]);

    const [keyword, setKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    const authHeaders = useCallback((): Record<string, string> => {
        const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
        return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
    }, []);

    const errorText = (error: unknown) => axios.isAxiosError(error)
        ? error.response?.data?.message ?? 'กรุณาลองใหม่อีกครั้ง'
        : 'กรุณาลองใหม่อีกครั้ง';

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/v1/nutrition/food-items', { headers: authHeaders() });
            if (res.data?.success) setItems(res.data.data ?? []);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'ดึงรายการเมนูไม่สำเร็จ', text: errorText(error), timer: 3000, showConfirmButton: false });
        } finally {
            setLoading(false);
        }
    }, [authHeaders]);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const baseName = stripClassSuffix(foodName);

    /*
      ชื่อเต็มที่จะได้จริง แสดงให้เห็นก่อนกดบันทึก
      คนใช้มักไม่รู้ว่าระบบเติมวงเล็บให้เอง ถ้าไม่โชว์จะพิมพ์วงเล็บมาเองแล้วได้ชื่อซ้อน
    */
    const preview = useMemo(
        () => FOOD_CLASSES.filter(c => classes.includes(c)).map(c => ({ cls: c, name: `${baseName} (${c})` })),
        [baseName, classes],
    );

    // เตือนตั้งแต่ยังไม่กดบันทึก ว่าประเภทไหนมีอยู่แล้ว จะได้ไม่ต้องเดาว่าทำไมระบบข้ามให้
    const existingNames = useMemo(() => new Set(items.map(i => normalizeName(i.food_name))), [items]);
    const dupClasses = preview.filter(p => existingNames.has(normalizeName(p.name))).map(p => p.cls);

    const handleCreate = async () => {
        if (!baseName) {
            Swal.fire({ icon: 'warning', title: 'กรุณากรอกชื่ออาหาร', timer: 2000, showConfirmButton: false });
            return;
        }
        if (classes.length === 0) {
            Swal.fire({ icon: 'warning', title: 'กรุณาเลือกประเภทอย่างน้อยหนึ่งประเภท', timer: 2000, showConfirmButton: false });
            return;
        }

        setSaving(true);
        try {
            const res = await axios.post('/api/v1/nutrition/food-items',
                { food_name: baseName, classes },
                { headers: authHeaders() });
            if (res.data?.success) {
                Swal.fire({ icon: 'success', title: res.data.message, timer: 2500, showConfirmButton: false });
                setFoodName('');
                setClasses([]);
                await fetchItems();
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'เพิ่มเมนูไม่สำเร็จ', text: errorText(error) });
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (row: FoodItem, next: boolean) => {
        /*
          ปิดเมนูที่เคยมีคนสั่งไปแล้วเป็นเรื่องปกติ (เลิกทำเมนูนั้น) แต่ต้องถามก่อน
          เพราะเมนูจะหายจากหน้าสั่งอาหารทันที ส่วนรายการเก่ายังอยู่ครบ ไม่มีการลบแถว
        */
        if (!next && row.order_count > 0) {
            const confirm = await Swal.fire({
                icon: 'question',
                title: 'ปิดใช้งานเมนูนี้?',
                html: `<div style="text-align:left">
                        <b>${row.food_name}</b><br/>
                        เคยถูกสั่งไปแล้ว <b>${row.order_count.toLocaleString('th-TH')}</b> รายการ<br/>
                        เมนูจะหายจากหน้าสั่งอาหาร แต่รายการเดิมยังอยู่ครบ
                       </div>`,
                showCancelButton: true,
                confirmButtonText: 'ปิดใช้งาน',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#d97706',
            });
            if (!confirm.isConfirmed) return;
        }

        setTogglingId(row.food_item_id);
        try {
            const res = await axios.patch('/api/v1/nutrition/food-items/active',
                { food_item_id: row.food_item_id, is_active: next },
                { headers: authHeaders() });
            if (res.data?.success) {
                setItems(prev => prev.map(i => i.food_item_id === row.food_item_id ? { ...i, is_active: next } : i));
                Swal.fire({ icon: 'success', title: res.data.message, timer: 1500, showConfirmButton: false });
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'แก้ไขไม่สำเร็จ', text: errorText(error) });
        } finally {
            setTogglingId(null);
        }
    };

    const filtered = useMemo(() => {
        const kw = keyword.trim().toLowerCase();
        return items.filter(i => {
            if (statusFilter === 'active' && !i.is_active) return false;
            if (statusFilter === 'inactive' && i.is_active) return false;
            return !kw || String(i.food_name).toLowerCase().includes(kw);
        });
    }, [items, keyword, statusFilter]);

    const activeCount = items.filter(i => i.is_active).length;

    const columns: TableColumnsType<FoodItem> = [
        {
            title: 'ชื่ออาหาร', dataIndex: 'food_name', key: 'food_name',
            render: (v: string, r) => (
                <span className={r.is_active ? 'font-medium' : 'text-gray-400 line-through'}>{v}</span>
            ),
        },
        {
            // อ่านจาก food_type_id ที่บันทึกไว้จริง ไม่ใช่แกะจากวงเล็บในชื่อ
            title: 'ประเภท', dataIndex: 'food_type_name', key: 'food_type_name', width: 130, align: 'center',
            filters: [...FOOD_CLASSES, 'งดอาหาร (NPO)'].map(c => ({ text: c, value: c })),
            onFilter: (v, r) => r.food_type_name === v,
            render: (v: string | null) => v
                ? <Tag color={CLASS_COLOR[v] ?? 'default'}>{v}</Tag>
                : <span className="text-gray-300">ไม่ระบุ</span>,
        },
        {
            title: 'ยอดสั่งสะสม', dataIndex: 'order_count', key: 'order_count', width: 120, align: 'right',
            sorter: (a, b) => a.order_count - b.order_count,
            render: (v: number) => v > 0
                ? <span className="font-semibold text-[#006b5f]">{v.toLocaleString('th-TH')}</span>
                : <span className="text-gray-300">0</span>,
        },
        {
            title: 'ผู้เพิ่ม', key: 'created', width: 180,
            render: (_, r) => r.created_by_name
                ? <div className="text-xs leading-tight">
                    <div>{r.created_by_name}</div>
                    <div className="text-gray-400">{r.created_at ? dayjs(r.created_at).format('DD/MM/BBBB HH:mm') : ''}</div>
                </div>
                : <span className="text-gray-300 text-xs">ข้อมูลเดิม</span>,
        },
        {
            title: 'ใช้งาน', key: 'is_active', width: 100, align: 'center', fixed: 'right',
            render: (_, r) => (
                <Tooltip title={r.is_active ? 'ปิดแล้วจะไม่ขึ้นในหน้าสั่งอาหาร' : 'เปิดให้เลือกในหน้าสั่งอาหาร'}>
                    <Switch
                        size="small"
                        checked={r.is_active}
                        loading={togglingId === r.food_item_id}
                        onChange={next => handleToggle(r, next)}
                    />
                </Tooltip>
            ),
        },
    ];

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-6 max-w-full mx-auto">
                <Card className="shadow-xl rounded-2xl border-none">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="bg-[#006b5f] p-2.5 rounded-xl shadow-md">
                            <PiForkKnifeBold className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <Title level={4} className="m-0!">จัดการรายการเมนูอาหาร</Title>
                            <Text type="secondary" className="text-sm">
                                กรอกชื่ออาหารหนึ่งครั้ง แล้วติ๊กประเภทห้อง ระบบจะสร้างเมนูพร้อมวงเล็บประเภทให้ครบทุกช่องที่เลือก
                            </Text>
                        </div>
                    </div>

                    {/* ─── ฟอร์มเพิ่มเมนู ─── */}
                    <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 mb-5">
                        <div className="flex flex-wrap items-end gap-5">
                            <div className="grow min-w-[260px]">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">ชื่ออาหาร</label>
                                <Input
                                    value={foodName}
                                    onChange={e => setFoodName(e.target.value)}
                                    onPressEnter={handleCreate}
                                    placeholder="เช่น ข้าวต้มปลา (ไม่ต้องใส่วงเล็บประเภท)"
                                    maxLength={100}
                                    showCount
                                    allowClear
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1">ประเภทห้อง</label>
                                <Checkbox.Group
                                    value={classes}
                                    onChange={v => setClasses(v as FoodClass[])}
                                    options={FOOD_CLASSES.map(c => ({ label: c, value: c }))}
                                    className="pt-1"
                                />
                            </div>

                            <Button
                                type="primary"
                                icon={<PiPlusBold />}
                                loading={saving}
                                onClick={handleCreate}
                                disabled={!baseName || classes.length === 0}
                                className="bg-[#006b5f] hover:bg-[#005a50] border-none shadow-md"
                            >
                                เพิ่มเมนู
                            </Button>
                        </div>

                        {preview.length > 0 && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="text-xs text-gray-500">ชื่อที่จะบันทึก:</span>
                                {preview.map(p => (
                                    <Tag
                                        key={p.cls}
                                        color={dupClasses.includes(p.cls) ? 'default' : CLASS_COLOR[p.cls]}
                                        className={dupClasses.includes(p.cls) ? 'line-through opacity-60' : ''}
                                    >
                                        {p.name}
                                    </Tag>
                                ))}
                            </div>
                        )}

                        {dupClasses.length > 0 && (
                            <Alert
                                type="warning"
                                showIcon
                                className="mt-3"
                                message={`มีเมนูนี้อยู่แล้วในประเภท ${dupClasses.join(', ')} — ระบบจะข้ามให้ ไม่สร้างซ้ำ`}
                            />
                        )}
                    </div>

                    {/* ─── ทะเบียนเมนู ─── */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <Input
                                value={keyword}
                                onChange={e => setKeyword(e.target.value)}
                                placeholder="ค้นหาชื่ออาหาร"
                                prefix={<PiMagnifyingGlassBold className="text-gray-400" />}
                                allowClear
                                style={{ width: 260 }}
                            />
                            <Radio.Group
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                optionType="button"
                                buttonStyle="solid"
                                options={[
                                    { label: 'ทั้งหมด', value: 'all' },
                                    { label: 'เปิดใช้งาน', value: 'active' },
                                    { label: 'ปิดใช้งาน', value: 'inactive' },
                                ]}
                            />
                        </div>
                        <Text type="secondary" className="text-sm">
                            ทั้งหมด {items.length.toLocaleString('th-TH')} เมนู · เปิดใช้งาน {activeCount.toLocaleString('th-TH')} เมนู
                        </Text>
                    </div>

                    <Table
                        rowKey="food_item_id"
                        columns={columns}
                        dataSource={filtered}
                        loading={loading}
                        size="small"
                        bordered
                        scroll={{ x: 'max-content' }}
                        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `รวม ${t.toLocaleString('th-TH')} รายการ` }}
                        locale={{ emptyText: <Empty description="ไม่พบรายการเมนู" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                    />

                    <Text type="secondary" className="block mt-3 text-xs">
                        เมนูที่เคยถูกสั่งไปแล้วจะปิดใช้งานได้ แต่ลบไม่ได้ เพราะใบสรุปและฉลากของวันเก่ายังอ้างถึงชื่อเมนูนั้นอยู่
                    </Text>
                </Card>
            </div>
        </div>
    );
}
