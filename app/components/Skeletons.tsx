'use client';

import type { ReactNode } from 'react';
import { Card, Skeleton } from 'antd';

/*
  โครงร่างระหว่างโหลด (antd Skeleton) ที่ใช้ร่วมกันทั้งระบบ

  ใช้ตอน "ยังไม่มีอะไรให้ดูเลย" แทนไอคอนหมุนกลางพื้นที่ว่าง
  คนเห็นรูปร่างของสิ่งที่กำลังจะขึ้น หน้าไม่กระโดดตอนข้อมูลมาถึง
  และไม่เห็นคำว่า "ไม่มีข้อมูล" แวบขึ้นมาก่อนข้อมูลจริง ซึ่งชวนให้เข้าใจผิดว่าไม่มีจริงๆ

  ตอนโหลดซ้ำทั้งที่มีข้อมูลอยู่บนจอแล้ว ยังใช้ไอคอนหมุนทับของเดิมเหมือนเดิม
  เพราะคนยังอ่านของเดิมได้ระหว่างรอ เอาโครงร่างมาแทนจะลบของที่กำลังอ่านอยู่ทิ้ง
*/

/** แถวของตารางที่กำลังโหลด — วางใต้หัวตารางจริง */
export const TableRowsSkeleton = ({ rows = 6 }: { rows?: number }) => (
    <Skeleton active title={false} paragraph={{ rows, width: '100%' }} className="py-2" />
);

/**
 * ใช้แทน loading={...} ของ antd Table: <Table {...tableLoading(loading, rows)} />
 *
 * โหลดครั้งแรก (ยังไม่มีแถว) → หัวตารางจริง + แถวโครงร่าง แทนไอคอนหมุนทับคำว่า "ไม่มีข้อมูล"
 * โหลดซ้ำ (มีแถวอยู่แล้ว) → ไอคอนหมุนของตารางเหมือนเดิม
 * ตารางที่มีข้อความตอนว่างของตัวเอง ส่งมาเป็นตัวที่สาม ไม่งั้นจะได้ข้อความมาตรฐานของ antd แทน
 */
export const tableLoading = (loading: boolean, rows: readonly unknown[] | null | undefined, emptyText?: ReactNode) => {
    const first = loading && !rows?.length;
    return {
        loading: loading && !first,
        locale: { emptyText: first ? <TableRowsSkeleton /> : emptyText },
    };
};

/** ตารางทั้งก้อน — ใช้เมื่อหน้ายังไม่วาดตารางเลยระหว่างโหลด */
export const TableSkeleton = ({ rows = 8 }: { rows?: number }) => (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <Skeleton.Input active block size="small" />
        <TableRowsSkeleton rows={rows} />
    </div>
);

/** กล่องทึบเต็มพื้นที่ แทนกราฟ ภาพ หรือเอกสาร PDF ที่ยังวาดไม่เสร็จ */
export const BlockSkeleton = ({ height = '100%' }: { height?: number | string }) => (
    <Skeleton.Node
        active
        styles={{ root: { display: 'block', width: '100%', height }, content: { width: '100%', height: '100%' } }}
    >
        {null}
    </Skeleton.Node>
);

/** แบบฟอร์ม/บันทึก หรือรายการสั้นในโมดัลและลิ้นชัก */
export const FormSkeleton = ({ rows = 8 }: { rows?: number }) => (
    <div className="py-4">
        <Skeleton active paragraph={{ rows }} />
    </div>
);

/**
 * หน้าวิเคราะห์ — แถวตัวเลขสรุป + การ์ดกราฟ เรียงแบบเดียวกับหน้า dashboard จริง
 * kpiGrid ส่งคลาส grid ของหน้านั้นมา โครงร่างจะได้ตัดแถวตรงกับของจริง
 */
export const DashboardSkeleton = ({ kpis = 4, charts = 4, kpiGrid = 'grid-cols-2 md:grid-cols-4' }: {
    kpis?: number; charts?: number; kpiGrid?: string;
}) => (
    <div className="flex flex-col gap-4">
        {kpis > 0 && (
            <div className={`grid gap-2 ${kpiGrid}`}>
                {Array.from({ length: kpis }, (_, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
                        <Skeleton active title={{ width: '70%' }} paragraph={{ rows: 1, width: '45%' }} />
                    </div>
                ))}
            </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: charts }, (_, i) => (
                <Card key={i} size="small" title={<Skeleton.Input active size="small" />}>
                    <BlockSkeleton height={260} />
                </Card>
            ))}
        </div>
    </div>
);

/** ทั้งหน้าระหว่างเปลี่ยนหน้า (loading.tsx) — หัวเรื่อง แถบตัวกรอง และตาราง */
export const PageSkeleton = () => (
    <div className="p-4 md:p-6 flex flex-col gap-4">
        <Skeleton.Input active size="large" style={{ width: 280, maxWidth: '100%' }} />
        <div className="flex flex-wrap gap-2">
            {[220, 160, 120].map(w => <Skeleton.Input key={w} active style={{ width: w }} />)}
        </div>
        <TableSkeleton rows={10} />
    </div>
);
