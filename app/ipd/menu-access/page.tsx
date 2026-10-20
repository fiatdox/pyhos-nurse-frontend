'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Alert, App, Button, Card, Empty, Popconfirm, Spin, Switch, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PiArrowsCounterClockwiseBold, PiFloppyDiskBold, PiSlidersHorizontalBold } from 'react-icons/pi';
import Navbar from '../../components/Navbar';
import { ALL_ITEMS, GROUPS, MENU_ACCESS_ITEM, defaultGroupsOf, type MenuGroup } from '../../lib/menu';
import { useMenuAccess } from '../../lib/useMenuAccess';

const { Text, Title } = Typography;

/**
 * สิทธิ์การมองเห็นเมนูรายกลุ่ม
 *
 * ตารางนี้ตอบคำถามเดียว: "กลุ่มไหนเห็นเมนูไหน"
 * ไม่ใช่การกันข้อมูล คนที่รู้ URL ยังพิมพ์เข้าหน้านั้นได้ และ endpoint ฝั่งเซิร์ฟเวอร์
 * ยังตรวจสิทธิ์ของตัวเองเหมือนเดิมทุกตัว การปิดเมนูคือการจัดหน้าจอให้ตรงกับงานที่ทำ
 * ไม่ใช่มาตรการความปลอดภัย ถ้าเขียนไว้ไม่ชัดตรงนี้ จะมีคนเข้าใจผิดแล้วใช้มันกันข้อมูลจริง
 */

interface MatrixRow { menu_key: string; group_key: string; visible: boolean; updated_by_name: string | null; updated_at: string | null }

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

interface Row {
    key: string;
    section: string;
    label: string;
    href: string;
    /** ค่าที่แสดงอยู่ตอนนี้ของแต่ละกลุ่ม */
    now: Record<MenuGroup, boolean>;
    /** ค่าเริ่มต้นจากโค้ด ใช้บอกว่าแถวไหนถูกแก้จากของเดิม */
    base: Record<MenuGroup, boolean>;
}

export default function MenuAccessPage() {
    const { message } = App.useApp();
    const router = useRouter();
    const access = useMenuAccess();

    const [overrides, setOverrides] = useState<Record<string, Partial<Record<MenuGroup, boolean>>>>({});
    const [changed, setChanged] = useState<Record<string, Partial<Record<MenuGroup, boolean>>>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [stamp, setStamp] = useState<{ by: string | null; at: string | null }>({ by: null, at: null });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/v1/system/menu-access/matrix', { headers: authHeaders() });
            const rows: MatrixRow[] = res.data?.data?.rows ?? [];
            const map: Record<string, Partial<Record<MenuGroup, boolean>>> = {};
            let latest: { by: string | null; at: string | null } = { by: null, at: null };
            for (const r of rows) {
                map[r.menu_key] = { ...(map[r.menu_key] ?? {}), [r.group_key as MenuGroup]: r.visible };
                if (r.updated_at && (!latest.at || r.updated_at > latest.at)) {
                    latest = { by: r.updated_by_name, at: r.updated_at };
                }
            }
            setOverrides(map);
            setChanged({});
            setStamp(latest);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 401) router.push('/');
            else if (axios.isAxiosError(err) && err.response?.status === 403) { /* หน้าจอบอกเองด้านล่าง */ }
            else message.error('อ่านตารางสิทธิ์ไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    }, [router, message]);

    useEffect(() => { load(); }, [load]);

    const rows: Row[] = useMemo(() => ALL_ITEMS.map(({ section, item }) => {
        const base = {} as Record<MenuGroup, boolean>;
        const now = {} as Record<MenuGroup, boolean>;
        const defaults = defaultGroupsOf(section, item);
        for (const g of GROUPS) {
            base[g.key] = defaults.includes(g.key);
            const saved = overrides[item.key]?.[g.key];
            const edited = changed[item.key]?.[g.key];
            now[g.key] = edited ?? saved ?? base[g.key];
        }
        return { key: item.key, section: section.heading, label: item.label, href: item.href, now, base };
    }), [overrides, changed]);

    const pending = useMemo(
        () => Object.values(changed).reduce((n, g) => n + Object.keys(g).length, 0),
        [changed]);

    const toggle = (menuKey: string, group: MenuGroup, value: boolean) => {
        setChanged(prev => ({ ...prev, [menuKey]: { ...(prev[menuKey] ?? {}), [group]: value } }));
    };

    const save = async () => {
        const items = Object.entries(changed).flatMap(([menu_key, groups]) =>
            Object.entries(groups).map(([group_key, visible]) => ({ menu_key, group_key, visible: !!visible })));
        if (items.length === 0) return;
        setSaving(true);
        try {
            await axios.post('/api/v1/system/menu-access', { items }, { headers: authHeaders() });
            message.success(`บันทึกแล้ว ${items.length} รายการ · คนที่เปิดหน้าอยู่จะเห็นผลเมื่อโหลดหน้าใหม่`);
            await load();
        } catch (err) {
            const res = axios.isAxiosError(err) ? err.response : undefined;
            message.error((res?.data as { message?: string } | undefined)?.message ?? 'บันทึกไม่สำเร็จ');
        } finally {
            setSaving(false);
        }
    };

    const resetAll = async () => {
        try {
            await axios.post('/api/v1/system/menu-access/reset', {}, { headers: authHeaders() });
            message.success('คืนค่าเริ่มต้นทั้งหมดแล้ว');
            await load();
        } catch { message.error('คืนค่าเริ่มต้นไม่สำเร็จ'); }
    };

    const columns: ColumnsType<Row> = [
        {
            /*
              หมวดซ้ำทุกแถวในหมวดเดียวกัน ใช้ rowSpan รวมช่อง
              ตารางนี้ยาวกว่าหนึ่งจอ ถ้าไม่มีหัวหมวดคั่น จะไม่รู้ว่ากำลังตั้งค่าเมนูของงานไหนอยู่
            */
            title: 'หมวด', key: 'sec', width: 150, fixed: 'left',
            onCell: (r) => {
                const all = rows.filter(x => x.section === r.section);
                return { rowSpan: all[0]?.key === r.key ? all.length : 0 };
            },
            render: (_, r) => <span className="font-semibold text-gray-500">{r.section}</span>,
        },
        {
            title: 'เมนู', key: 'm', width: 300, fixed: 'left',
            render: (_, r) => (
                <div className="leading-tight">
                    <div className="font-semibold">{r.label}</div>
                    <div className="text-xs text-gray-400">{r.href}</div>
                </div>
            ),
        },
        ...GROUPS.map(g => ({
            title: (
                <Tooltip title={g.hint}>
                    <span className="whitespace-nowrap">{g.label}</span>
                </Tooltip>
            ),
            key: g.key,
            width: 132,
            align: 'center' as const,
            render: (_: unknown, r: Row) => {
                const dirty = changed[r.key]?.[g.key] !== undefined;
                const custom = r.now[g.key] !== r.base[g.key];
                return (
                    <div className="flex flex-col items-center gap-1">
                        <Switch
                            size="small"
                            checked={r.now[g.key]}
                            onChange={v => toggle(r.key, g.key, v)}
                        />
                        {/* บอกว่าแถวนี้ถูกแก้จากค่าเริ่มต้น ไม่งั้นสวิตช์ทั้งตารางหน้าตาเหมือนกันหมด */}
                        {dirty
                            ? <span className="text-[11px] text-orange-500">ยังไม่บันทึก</span>
                            : custom ? <span className="text-[11px] text-blue-500">แก้ไว้</span> : null}
                    </div>
                );
            },
        })),
    ];

    if (!access.ready || loading) {
        return (
            <>
                <Navbar />
                <div className="p-6 grid place-items-center"><Spin /></div>
            </>
        );
    }

    if (!access.isAdmin) {
        return (
            <>
                <Navbar />
                <div className="p-4 max-w-3xl mx-auto">
                    <Alert
                        type="error"
                        showIcon
                        title="หน้านี้สำหรับผู้ดูแลระบบเท่านั้น"
                        description="บัญชีที่มีบทบาท ADMIN ในทะเบียนบุคลากรเท่านั้นที่เปลี่ยนสิทธิ์เมนูได้ · เซิร์ฟเวอร์ปฏิเสธคำขอจากบัญชีอื่นอยู่แล้ว ไม่ใช่แค่ซ่อนหน้านี้"
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <div className="p-4 flex flex-col gap-4 max-w-[1200px] mx-auto">
                <Card size="small">
                    <div className="flex flex-wrap items-center gap-3">
                        <Title level={4} className="m-0! flex items-center gap-2">
                            <PiSlidersHorizontalBold /> {MENU_ACCESS_ITEM.label}
                        </Title>
                        {stamp.at && (
                            <Text type="secondary" className="text-xs">
                                แก้ไขล่าสุด {stamp.at}{stamp.by ? ` โดย ${stamp.by}` : ''}
                            </Text>
                        )}
                        <div className="ml-auto flex items-center gap-2">
                            <Popconfirm
                                title="คืนค่าเริ่มต้นทั้งหมด"
                                description="ลบสิ่งที่ตั้งไว้ทุกเมนูทุกกลุ่ม กลับไปใช้ค่าที่มากับระบบ"
                                okText="คืนค่า" cancelText="ยกเลิก"
                                onConfirm={resetAll}
                            >
                                <Button icon={<PiArrowsCounterClockwiseBold />}>คืนค่าเริ่มต้น</Button>
                            </Popconfirm>
                            <Button
                                type="primary" icon={<PiFloppyDiskBold />}
                                disabled={pending === 0} loading={saving} onClick={save}
                            >
                                บันทึก{pending > 0 ? ` (${pending})` : ''}
                            </Button>
                        </div>
                    </div>

                    <Alert
                        className="mt-3"
                        type="info"
                        showIcon
                        title="นี่คือการซ่อนเมนู ไม่ใช่การกันข้อมูล"
                        description="ปิดแล้วเมนูจะไม่ขึ้นบนแถบบน ลิ้นชักซ้าย และแถบข้าง แต่คนที่รู้ URL ยังเปิดหน้านั้นได้ · การกันข้อมูลจริงอยู่ที่เซิร์ฟเวอร์ซึ่งตรวจสิทธิ์ทุกครั้งที่อ่านหรือเขียนอยู่แล้ว"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                        {GROUPS.map(g => (
                            <Tooltip key={g.key} title={g.hint}>
                                <Tag className="m-0!">{g.label}</Tag>
                            </Tooltip>
                        ))}
                        <Text type="secondary" className="text-xs">
                            กลุ่มมาจากกลุ่มงานในทะเบียนบุคลากร · คนย้ายหน่วยแล้วเมนูเปลี่ยนตามเอง ไม่ต้องมาแก้ที่นี่
                        </Text>
                    </div>
                </Card>

                <Card size="small">
                    <Table
                        rowKey="key"
                        columns={columns}
                        dataSource={rows}
                        size="small"
                        bordered
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีเมนูในสารบัญ" /> }}
                        sticky
                    />
                </Card>
            </div>
        </>
    );
}
