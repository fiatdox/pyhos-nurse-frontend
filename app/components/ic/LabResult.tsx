'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Modal } from 'antd';
import axios from 'axios';
import { PiArrowSquareOutBold } from 'react-icons/pi';
import { FormSkeleton } from '@/app/components/Skeletons';
import { rtfToText } from '@/app/lib/labRtf';

/**
 * ผลแล็บจาก HIS (lab_head.result_rtf) ตามเลข lab order
 *
 * หน้า /ic/lab/[id] กับหน้าต่างผลแล็บในหน้า IC ใช้ตัวดึงและตัวแสดงผลชุดเดียวกัน
 * แก้การอ่าน RTF ที่เดียวแล้วได้ทั้งสองที่
 */

const authHeaders = (): Record<string, string> | null => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : null;
};

export function useLabResult(labNo: string | null) {
    const router = useRouter();
    const [attempt, setAttempt] = useState(0);
    /*
      ผลผูกกับคำขอที่ได้มา (เลข lab + รอบที่กดลองใหม่) แล้วค่อยเทียบกับคำขอปัจจุบัน
      ผลของเลขอื่นหรือรอบก่อนจึงไม่โผล่ปน และกำลังโหลด = ยังไม่มีผลของคำขอนี้
    */
    const key = labNo ? `${labNo}#${attempt}` : null;
    const [result, setResult] = useState<{ key: string; text: string; error: string | null } | null>(null);

    useEffect(() => {
        if (!labNo || !key) return;
        let stale = false;
        const headers = authHeaders();
        if (!headers) { router.push('/'); return; }

        axios.get(`/api/v1/ic/labno/${encodeURIComponent(labNo)}`, { headers })
            .then(res => {
                if (stale) return;
                if (!res.data?.success) { setResult({ key, text: '', error: 'ไม่สามารถดึงข้อมูล Lab ได้' }); return; }
                const rows = res.data.data;
                const row = Array.isArray(rows) ? rows[0] : rows;
                setResult({ key, text: rtfToText(typeof row === 'string' ? row : row?.result_rtf), error: null });
            })
            .catch(err => {
                if (stale) return;
                if (axios.isAxiosError(err) && err.response?.status === 401) { router.push('/'); return; }
                setResult({ key, text: '', error: 'เกิดข้อผิดพลาดในการดึงข้อมูล Lab' });
            });

        return () => { stale = true; };
    }, [labNo, key, router]);

    const current = result && result.key === key ? result : null;
    const retry = useCallback(() => setAttempt(a => a + 1), []);
    return { text: current?.text ?? '', loading: !!key && !current, error: current?.error ?? null, retry };
}

/** ตัวผลแล็บ ใช้ฟอนต์ความกว้างเท่ากันเพราะ HIS จัดคอลัมน์ผลด้วยการเว้นวรรคและแท็บ */
export function LabResultText({ text, loading, error, retry }: ReturnType<typeof useLabResult>) {
    if (loading && !text) return <FormSkeleton rows={10} />;
    if (error) {
        return (
            <Alert type="error" showIcon message={error}
                action={<Button size="small" onClick={retry}>ลองใหม่</Button>} />
        );
    }
    if (!text) return <div className="text-center text-gray-400 py-10">ไม่พบข้อมูลผล Lab</div>;
    return (
        <div className="bg-gray-50 p-4 md:p-5 rounded-xl border border-gray-200 text-sm font-mono text-gray-800 whitespace-pre-wrap leading-relaxed overflow-x-auto [tab-size:8]">
            {text}
        </div>
    );
}

interface ModalProps {
    /** null = ปิดหน้าต่าง */
    labNo: string | null;
    /** ข้อความใต้หัวเรื่อง เช่น ชื่อเชื้อกับวันที่ ให้รู้ว่ากดมาจากช่องไหน */
    subtitle?: ReactNode;
    onClose: () => void;
}

export function LabResultModal({ labNo, subtitle, onClose }: ModalProps) {
    const result = useLabResult(labNo);
    return (
        <Modal
            open={!!labNo}
            onCancel={onClose}
            width={860}
            destroyOnHidden
            title={
                <div>
                    <div className="text-emerald-700">ผลการตรวจ Lab · Order No: {labNo}</div>
                    {subtitle && <div className="text-xs font-normal text-gray-500 mt-0.5">{subtitle}</div>}
                </div>
            }
            footer={[
                <Button key="tab" icon={<PiArrowSquareOutBold />} href={labNo ? `/ic/lab/${encodeURIComponent(labNo)}` : undefined} target="_blank">
                    เปิดในแท็บใหม่
                </Button>,
                <Button key="close" type="primary" onClick={onClose}>ปิด</Button>,
            ]}
            styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
        >
            <LabResultText {...result} />
        </Modal>
    );
}
