'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Segmented, Spin } from 'antd';
import {
    PiMagnifyingGlassPlusBold, PiMagnifyingGlassMinusBold, PiArrowClockwiseBold, PiPrinterBold,
} from 'react-icons/pi';

/**
 * ช่องดูไฟล์ใบสั่งยา
 *
 * ใช้ร่วมกันทั้งหน้าห้องยาและหน้าหอผู้ป่วย เพราะการดึงไฟล์มีรายละเอียดที่พลาดแล้วเงียบ
 * (ต้องแนบ header เอง · ต้องคืนหน่วยความจำ · ต้องกันภาพที่มาช้าทับภาพปัจจุบัน)
 * ถ้าเขียนสองที่ วันหนึ่งจะมีที่หนึ่งถูกแก้แล้วอีกที่ไม่ถูกแก้
 */

export interface RxFile {
    rx_file_id: number;
    file_no: number;
    original_name: string;
    mime_type: string;
    byte_size: number;
}

interface Props {
    orderId: string;
    files: RxFile[];
    /** ความสูงของกล่องดูไฟล์ ปล่อยว่างแล้วจะยืดเต็มพื้นที่ที่พ่อให้มา */
    className?: string;
}

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function RxFileViewer({ orderId, files, className = '' }: Props) {
    const [idx, setIdx] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [rotate, setRotate] = useState(0);

    /*
      ไฟล์สแกนต้องดึงด้วย fetch แล้วแปลงเป็น object URL ไม่ใช่ชี้ src ไปที่ API ตรง ๆ
      เพราะ <img> กับ <iframe> ส่ง header Authorization ไปกับคำขอไม่ได้ ปลายทางจึงตอบ 401
      ทางที่ง่ายกว่าคือให้ปลายทางรับ token จาก cookie แต่นั่นเท่ากับเปิดให้หน้าเว็บอื่น
      ฝัง <img> ชี้มาที่ไฟล์ผู้ป่วยแล้วได้ภาพไปเลย เพราะเบราว์เซอร์แนบ cookie ไปเองทุกครั้ง
    */
    const [src, setSrc] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);
    const blobRef = useRef('');
    /* นับลำดับคำขอ กันภาพของหน้าที่กดไว้ก่อนมาถึงช้ากว่าแล้วทับหน้าที่กำลังดูอยู่ */
    const reqRef = useRef(0);

    /* คืนหน่วยความจำของ object URL ภาพสแกนใบละ ~200KB ถ้าไม่คืนจะค้างสะสมทั้งเวร */
    const release = useCallback(() => {
        if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = ''; }
    }, []);

    const load = useCallback(async (file?: RxFile) => {
        const my = ++reqRef.current;
        release();
        setSrc('');
        setErr('');
        if (!file) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/v1/rx/orders/${orderId}/files/${file.rx_file_id}`,
                { headers: authHeaders() });
            if (!res.ok) {
                throw new Error(res.status === 401
                    ? 'หมดเวลาเข้าใช้งาน กรุณาเข้าระบบใหม่'
                    : `เปิดไฟล์ไม่สำเร็จ (${res.status})`);
            }
            const url = URL.createObjectURL(await res.blob());
            /* มีคำขอใหม่แซงมาแล้ว ทิ้งของรอบนี้ทันที ไม่งั้นหน่วยความจำรั่วเงียบ ๆ */
            if (my !== reqRef.current) { URL.revokeObjectURL(url); return; }
            blobRef.current = url;
            setSrc(url);
        } catch (e) {
            if (my === reqRef.current) setErr(e instanceof Error ? e.message : 'เปิดไฟล์ไม่สำเร็จ');
        } finally {
            if (my === reqRef.current) setLoading(false);
        }
    }, [orderId, release]);

    /* เปลี่ยนใบหรือได้รายการไฟล์มาแล้ว ให้เปิดหน้าแรกทันที ไม่ต้องรอให้กดอะไรอีก */
    useEffect(() => {
        setIdx(0);
        setZoom(1);
        setRotate(0);
        void load(files[0]);
        return release;
    }, [orderId, files, load, release]);

    const current = files[idx];
    const isPdf = current?.mime_type === 'application/pdf';

    /**
     * พิมพ์ภาพที่กำลังดูอยู่
     *
     * ใช้ iframe ซ่อนไว้ ไม่เปิดหน้าต่างใหม่ เพราะตัวกันป๊อปอัปของเบราว์เซอร์
     * จะบล็อกหน้าต่างที่เปิดจากปุ่มเงียบ ๆ แล้วคนกดจะคิดว่าเครื่องพิมพ์เสีย
     *
     * ไม่เขียน HTML เป็นข้อความแล้วแทรกชื่อไฟล์ลงไป เพราะชื่อไฟล์มาจากเครื่องสแกนของผู้ใช้
     * สร้างเป็นโหนดแล้วตั้งค่าผ่านพรอพเพอร์ตี้แทน ชื่อแปลก ๆ จึงเป็นได้แค่ข้อความ
     *
     * พิมพ์ตามมุมที่หมุนไว้ แต่ไม่พิมพ์ตามระดับซูม
     * ซูมมีไว้ดูรายละเอียดบนจอ ส่วนกระดาษมีขนาดตายตัวอยู่แล้ว ย่อให้พอดีหน้าเสมอ
     */
    const printImage = useCallback(() => {
        if (!src || isPdf) return;

        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
        document.body.appendChild(frame);

        const doc = frame.contentDocument;
        if (!doc) { frame.remove(); return; }

        /* หมุน 90 หรือ 270 แล้วด้านกว้างกับด้านสูงสลับกัน ขอบเขตที่ใช้จำกัดขนาดจึงต้องสลับตาม */
        const turned = rotate % 180 !== 0;
        const style = doc.createElement('style');
        style.textContent = `
            @page { margin: 8mm; }
            html, body { margin: 0; height: 100%; }
            body { display: grid; place-items: center; }
            img {
                max-width: ${turned ? '100vh' : '100%'};
                max-height: ${turned ? '100vw' : '100%'};
                transform: rotate(${rotate}deg);
            }
        `;
        doc.head.appendChild(style);
        doc.title = current?.original_name || 'ใบสั่งยา';

        const img = doc.createElement('img');
        img.alt = '';
        const go = () => {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
            /* รอให้กล่องพิมพ์อ่านเนื้อหาเสร็จก่อนค่อยถอด iframe ทิ้ง ถอดเร็วไปจะได้หน้าว่าง */
            setTimeout(() => frame.remove(), 2000);
        };
        img.onload = go;
        img.onerror = () => frame.remove();
        img.src = src;
        doc.body.appendChild(img);
    }, [src, rotate, isPdf, current]);

    return (
        <div className={`flex flex-col bg-slate-100 dark:bg-[#1f1f1f] ${className}`}>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200">
                {files.length > 1 && (
                    <Segmented
                        size="small"
                        value={idx}
                        onChange={v => {
                            setIdx(Number(v)); setZoom(1); setRotate(0);
                            void load(files[Number(v)]);
                        }}
                        options={files.map((f, i) => ({ label: `หน้า ${f.file_no}`, value: i }))}
                    />
                )}
                <div className="ml-auto flex items-center gap-1">
                    <Button size="small" icon={<PiMagnifyingGlassMinusBold />}
                        onClick={() => setZoom(z => Math.max(0.4, z - 0.25))} />
                    <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <Button size="small" icon={<PiMagnifyingGlassPlusBold />}
                        onClick={() => setZoom(z => Math.min(4, z + 0.25))} />
                    <Button size="small" icon={<PiArrowClockwiseBold />}
                        onClick={() => setRotate(r => (r + 90) % 360)} />
                    {/*
                      ปุ่มพิมพ์มีเฉพาะไฟล์ภาพ
                      PDF ไม่ต้องมี เพราะตัวอ่าน PDF ของเบราว์เซอร์มีปุ่มพิมพ์ของตัวเองอยู่แล้ว
                      ใส่เพิ่มจะกลายเป็นปุ่มพิมพ์สองปุ่มที่ทำงานคนละแบบในกรอบเดียวกัน
                    */}
                    {!isPdf && src && !err && (
                        <Button size="small" icon={<PiPrinterBold />} onClick={printImage}>
                            พิมพ์
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-3">
                {/*
                  ยังไม่มีภาพและยังไม่มีข้อผิดพลาด = กำลังจะโหลด ต้องนับเป็นช่วงรอด้วย
                  เพราะ React วาดรอบแรกก่อน effect จะได้ทำงาน ถ้าดูแค่ค่า loading
                  จะมีหนึ่งเฟรมที่ src ยังว่างแล้ว <img src=""> ทำให้เบราว์เซอร์
                  ไปโหลดที่อยู่ของหน้าปัจจุบันซ้ำมาเป็นรูป
                */}
                {!current || loading || (!src && !err) ? (
                    <div className="h-full grid place-items-center"><Spin /></div>
                ) : err ? (
                    <div className="h-full grid place-items-center p-4">
                        <Alert
                            type="error" showIcon className="max-w-md"
                            title="เปิดไฟล์ไม่สำเร็จ" description={err}
                            action={<Button size="small" onClick={() => void load(current)}>ลองอีกครั้ง</Button>}
                        />
                    </div>
                ) : current.mime_type === 'application/pdf' ? (
                    /* PDF ให้เบราว์เซอร์เปิดเอง ไม่ต้องโหลดตัวอ่านเพิ่ม ปุ่มซูม/หมุนจึงใช้กับภาพเท่านั้น */
                    <iframe src={src} className="w-full h-full border-0 bg-white" title="ใบสั่งยา" />
                ) : (
                    <div className="grid place-items-center min-h-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={src}
                            alt={`ใบสั่งยา หน้า ${current.file_no}`}
                            style={{
                                transform: `scale(${zoom}) rotate(${rotate}deg)`,
                                transformOrigin: 'center',
                                transition: 'transform .15s',
                            }}
                            className="max-w-full bg-white shadow"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
