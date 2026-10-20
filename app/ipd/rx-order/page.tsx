'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import {
    Alert, App, Button, Card, Checkbox, DatePicker, Empty, Image, Input, Modal, Radio, Segmented, Select, Spin,
    Table, Tag, TimePicker, Tooltip, Typography, Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SortOrder } from 'antd/es/table/interface';
import type { UploadFile } from 'antd/es/upload/interface';
import {
    PiPaperPlaneTiltBold, PiUploadSimpleBold, PiArrowsClockwiseBold, PiWarningBold,
    PiBroadcastBold, PiPlugsBold, PiTrashBold, PiFilePdfBold, PiNotePencilBold, PiEyeBold,
    PiMagnifyingGlassBold, PiPackageBold, PiSquaresFourBold, PiRowsBold, PiCheckCircleBold,
} from 'react-icons/pi';
import Navbar from '../../components/Navbar';
import { useRxSocket, createBeeper } from '../../lib/rxSocket';
import type { HnSource } from '../../lib/hnReader';
import { SHIFTS, shiftRange, type ShiftKey } from '../../lib/rxShifts';
import { PRIORITY, PriorityDot, type RxPriority } from '../../lib/rxPriority';
import { TubeFeedTag } from '../../lib/rxTubeFeed';
import { RxDay, byTime } from '../../lib/rxDate';
import RxBoard, { BoardCard, type BoardColumn } from '../../components/RxBoard';
import RxFileViewer, { type RxFile } from '../../components/RxFileViewer';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Text } = Typography;
const { TextArea } = Input;

interface Ward { ward: number; ward_name: string }

/**
 * สถานะการนอนของเลขหนึ่ง เซิร์ฟเวอร์เรียงคำตอบตามนี้มาให้แล้ว
 * admitted_here = นอนหอนี้ · admitted = นอนหออื่น · discharged = เพิ่งจำหน่าย · none = ไม่ได้นอนอยู่
 */
type Admission = 'admitted_here' | 'admitted' | 'discharged' | 'none';

/** หนึ่งเลขที่อ่านได้จากภาพ และยืนยันกับ HIS แล้วว่ามีคนไข้คนนี้จริง */
interface HnMatch {
    hn: string;
    ptname: string;
    an: string | null;
    ward_name: string | null;
    admission: Admission;
    /** วันจำหน่าย YYYY-MM-DD มีเฉพาะ discharged */
    discharged_at: string | null;
    source: HnSource;
}

/**
 * ป้ายสถานะการนอน
 *
 * ป้ายนี้คือเหตุผลที่ต้องดูการนอนก่อน เลข HN ของโรงพยาบาลเรียงแน่นเกือบเต็ม
 * ตัวเลขอะไรบนใบ (วันที่ เลขเตียง) ก็ไปตรงกับคนไข้จริงสักคนได้ ชื่อที่ขึ้นมาจึงดูถูกต้องเสมอ
 * สิ่งเดียวที่บอกได้ว่าเป็นเลขหลงคือคนนั้นไม่ได้นอนอยู่ จึงต้องเห็นชัดก่อนกดเลือก
 */
const admissionTag = (a: Admission | undefined, wardName: string | null, dchAt: string | null) => {
    if (a === 'admitted_here') return { color: 'green', text: 'นอนหอนี้' };
    if (a === 'admitted') return { color: 'gold', text: `นอน${wardName ? ` ${wardName}` : 'หออื่น'}` };
    if (a === 'discharged') {
        return { color: 'default', text: `จำหน่ายแล้ว${dchAt ? ` ${dayjs(dchAt).format('D MMM')}` : ''}` };
    }
    if (a === 'none') return { color: 'red', text: 'ไม่ได้นอนอยู่' };
    return null;
};

interface HnRead {
    /** ทุกเลขที่อ่านได้ รวมเลขที่หาไม่เจอใน HIS ด้วย เวลาอ่านผิดจะได้เห็นว่าผิดเป็นอะไร */
    read: string[];
    matches: HnMatch[];
    his_down?: boolean;
    ocr_failed?: boolean;
    ocr_unavailable?: boolean;
}

/**
 * ไฟล์หนึ่งรายการที่รอส่ง พร้อม HN ของมันเอง
 *
 * HN ผูกกับไฟล์ ไม่ใช่ผูกกับฟอร์ม เพราะในทางปฏิบัติพยาบาลสแกนทีละปึก
 * แล้วค่อยส่งทีเดียว แต่ละแผ่นเป็นคนละคน ถ้ามีช่อง HN ช่องเดียวทั้งฟอร์ม
 * ใบที่สองเป็นต้นไปจะติดเลขของคนแรกไปด้วย ซึ่งอันตรายกว่าไม่มีเลขเสียอีก
 */
interface Entry {
    uid: string;
    name: string;
    file: File;
    /** มาจากหน้าที่เท่าไรของไฟล์ต้นทาง — มีเฉพาะ PDF ที่ถูกแยกหน้า */
    page?: number;
    /** จำนวนหน้าทั้งหมดของไฟล์ต้นทาง */
    pages?: number;
    /** ภาพย่อหน้าแรก ว่าง = ยังทำไม่เสร็จ */
    thumb: string;
    reading: boolean;
    /** เลขที่อ่านได้จากไฟล์นี้และยืนยันกับ HIS แล้วว่ามีคนไข้จริง */
    matches: HnMatch[];
    /** ทุกเลขที่อ่านได้ รวมเลขที่หาไม่เจอใน HIS ไว้บอกว่าอ่านผิดเป็นอะไร */
    read: string[];
    readNote: string;
    hn: string;
    /** admission ว่าง = ไม่รู้สถานะ (เช่นโหมดส่งซ้ำที่เอาข้อมูลมาจากใบเดิม) */
    patient: {
        ptname: string;
        an: string | null;
        admission?: Admission;
        ward_name?: string | null;
        discharged_at?: string | null;
    } | null;
    source: 'manual' | HnSource;
    looking: boolean;
    hisDown: boolean;
}

/**
 * จำนวนรายการที่ส่งได้ต่อหนึ่งครั้ง
 * PDF หลายหน้าถูกนับเป็นหน้าละหนึ่งรายการ เพราะแต่ละหน้าอาจเป็นคนละผู้ป่วย
 */
const MAX_ENTRIES = 10;

interface RxEvent { action: string; actor_name: string | null; at: string }

/** ชื่อไทยของเหตุการณ์ในประวัติ ให้หอเห็นว่าห้องยาทำอะไรกับใบไปแล้วบ้าง */
const ACTION_LABEL: Record<string, string> = {
    submit: 'หอส่งใบ', ack: 'ห้องยารับ', complete: 'คีย์ลง HIS เสร็จ',
    prepare: 'จัดยาเสร็จ พร้อมให้มารับ', pickup: 'ตึกมารับยาแล้ว', close: 'ปิดเรื่อง',
    /* ชื่อผู้ทำอยู่ข้างหลังอยู่แล้ว ไม่ระบุว่าเป็นห้องยา เพราะตอนนี้หอก็เปิดดูได้ */
    reject: 'ส่งกลับ', view_file: 'เปิดดูไฟล์',
};

const SOURCE_LABEL: Record<HnSource, string> = {
    pdf_text: 'อ่านจากข้อความในไฟล์',
    barcode: 'อ่านจากบาร์โค้ด',
    ocr: 'อ่านจากตัวเลขในภาพ',
};

interface RxOrder {
    rx_order_id: string;
    ward: number;
    ward_name: string | null;
    hn: string | null;
    an: string | null;
    patient_name: string | null;
    hn_source: string;
    his_verified: boolean;
    priority: RxPriority;
    status: 'submitted' | 'acknowledged' | 'completed' | 'prepared'
        | 'picked_up' | 'rejected' | 'closed';
    note: string | null;
    reject_reason: string | null;
    submitted_by_name: string;
    submitted_at: string;
    ack_by_name: string | null;
    completed_by_name: string | null;
    prepared_by_name: string | null;
    closed_by_name: string | null;
    /** ใบนี้เป็นฉบับแก้ของใบเลขไหน (ใบเดิมถูกห้องยาส่งกลับ) */
    resend_of: string | null;
    /** ผู้ป่วยได้รับอาหารทางสายยาง */
    tube_feed: boolean;
    rejected_by_name: string | null;
    file_count: number;
    waiting_seconds: number;
}

/** เกินเท่านี้ถือว่าห้องยายังไม่รับนานผิดปกติ ต่างกันตามความด่วน */
const STALE_SECONDS = { stat: 5 * 60, discharge: 10 * 60, routine: 20 * 60 };

/*
  คำบอกสถานะฝั่งหอเขียนจากมุมของคนรอ ไม่ใช่มุมของคนทำ
  ห้องยาเห็น "คีย์เสร็จ" แต่หอต้องการรู้ว่า "ไปรับได้หรือยัง" ซึ่งเป็นคนละคำถาม
*/
const STATUS: Record<RxOrder['status'], { label: string; color: string }> = {
    submitted: { label: 'รอห้องยารับ', color: 'gold' },
    acknowledged: { label: 'ห้องยารับแล้ว', color: 'blue' },
    completed: { label: 'คีย์แล้ว กำลังจัดยา', color: 'purple' },
    prepared: { label: 'ยาพร้อม ไปรับได้', color: 'green' },
    picked_up: { label: 'รับยาแล้ว', color: 'default' },
    rejected: { label: 'ส่งกลับให้แก้', color: 'red' },
    closed: { label: 'ปิดเรื่องแล้ว', color: 'default' },
};

/** โหมดแสดงผลของรายการที่ส่งไปแล้ว จำไว้ที่เครื่อง เหมือนหอที่เลือกไว้ */
const VIEW_KEY = 'rx_ward_view';

/*
  ลำดับคอลัมน์บนกระดาน = ลำดับที่ใบเดินทางจริง ส่งกลับเป็นทางแยกจึงอยู่ท้ายสุด
  ใบที่รับยาไปแล้วหรือปิดเรื่องแล้วไม่มีคอลัมน์ เพราะกระดานตอบว่า "ยังเหลืออะไร"
  ของที่รับไปแล้วไม่ใช่คำตอบของคำถามนั้น (ยังดูย้อนหลังได้ในโหมดตาราง)
*/
const BOARD_ORDER = ['submitted', 'acknowledged', 'completed', 'prepared', 'rejected'] as const;

/** สีหัวคอลัมน์ ใช้โทนเดียวกับป้ายสถานะในตาราง (เฉพาะสถานะที่มีคอลัมน์) */
const BOARD_TINT: Record<(typeof BOARD_ORDER)[number], string> = {
    submitted: '#faad14',
    /* เลือกเฉดกลางที่อ่านออกทั้งพื้นขาวและพื้น #141414 แทนเฉดเข้มซึ่งจมหายในโหมดมืด */
    acknowledged: '#4096ff',
    completed: '#9254de',
    prepared: '#52c41a',
    rejected: '#ff4d4f',
};

const authHeaders = () => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function RxOrderPage() {
    /*
      เรียก message ผ่าน App.useApp() ไม่ใช้ตัว static ที่ import มาตรง ๆ
      ตัว static ถูกสร้างนอกต้นไม้ของ React จึงไม่เห็น ConfigProvider
      กล่องข้อความจะเป็นธีมสว่างทับหน้าจอโหมดมืด และฟอนต์กลับไปเป็นตัวสำรอง
    */
    const { message } = App.useApp();

    const router = useRouter();
    const [wards, setWards] = useState<Ward[]>([]);
    const [ward, setWard] = useState<number | undefined>();
    const [priority, setPriority] = useState<RxOrder['priority']>('routine');
    /*
      ผู้ป่วยที่ให้อาหารทางสายยาง เก็บเป็นชุดของ HN ไม่ได้เก็บไว้ทีละไฟล์
      เพราะไฟล์ที่ HN เดียวกันถูกรวมเป็นใบเดียว ถ้าเก็บทีละไฟล์จะเกิดกรณีหน้าหนึ่งติ๊ก
      อีกหน้าไม่ติ๊ก แล้วไม่รู้ว่าใบนั้นใช่หรือไม่ใช่ ผูกกับ HN แล้วติ๊กที่ไหนก็ติดทั้งคน
    */
    const [tubeHns, setTubeHns] = useState<Set<string>>(() => new Set());
    const toggleTube = (hn: string, on: boolean) => setTubeHns(prev => {
        const next = new Set(prev);
        if (on) next.add(hn); else next.delete(hn);
        return next;
    });
    const [note, setNote] = useState('');
    /** ไฟล์ที่รอส่ง แต่ละรายการมี HN ของตัวเอง */
    const [entries, setEntries] = useState<Entry[]>([]);
    /** uid ของไฟล์ที่รับไว้แล้ว กันรับซ้ำเมื่อ antd ส่งรายการเดิมมาหลายรอบ */
    const seenUids = useRef<Set<string>>(new Set());

    /*
      หน้าต่างดูใบที่ส่งไปแล้ว
      หอต้องเปิดดูได้ด้วย ไม่ใช่ห้องยาเท่านั้น เพราะเวลาห้องยาโทรมาถามว่า
      "ตัวที่สามเขียนว่าอะไร" คนที่หอต้องเปิดภาพเดียวกันดูพร้อมกันได้
    */
    const [viewing, setViewing] = useState<RxOrder | null>(null);
    const [viewFiles, setViewFiles] = useState<RxFile[]>([]);
    const [viewEvents, setViewEvents] = useState<RxEvent[]>([]);

    /* ตัวกรองของตารางด้านล่าง ดูย้อนหลังได้ทีละวัน/ทีละเวร */
    const [listDate, setListDate] = useState<Dayjs>(() => dayjs());
    const [listShift, setListShift] = useState<ShiftKey>('ทั้งวัน');
    const [listCustom, setListCustom] = useState<[Dayjs, Dayjs] | null>(null);

    const listRange = useMemo(
        () => shiftRange(listDate, listShift, listCustom), [listDate, listShift, listCustom]);
    const listIsToday = listDate.isSame(dayjs(), 'day');
    /* ค้นด้วย HN: ตัวที่กำลังพิมพ์ กับตัวที่กดค้นแล้ว แยกกันเพื่อไม่ยิงทุกตัวอักษร */
    const [listHnInput, setListHnInput] = useState('');
    const [listHn, setListHn] = useState('');
    /* null = ลำดับจากเซิร์ฟเวอร์ · ค้น HN แล้วผลข้ามเดือน จึงเรียงใหม่สุดขึ้นก่อนให้เลย */
    const [listSort, setListSort] = useState<SortOrder>(null);
    /** ตาราง = ไล่ทีละแถว · กระดาน = เห็นว่าใบของหอไปค้างอยู่ขั้นไหนของห้องยา */
    const [listView, setListView] = useState<'table' | 'board'>('table');
    useEffect(() => { setListSort(listHn ? 'descend' : null); }, [listHn]);

    useEffect(() => {
        try { if (localStorage.getItem(VIEW_KEY) === 'board') setListView('board'); } catch { /* โหมดส่วนตัว */ }
    }, []);
    const [sending, setSending] = useState(false);
    const [rows, setRows] = useState<RxOrder[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchOrders = useCallback(async (w?: number) => {
        if (!w) return;
        setLoading(true);
        try {
            const res = await axios.get('/api/v1/rx/orders', {
                headers: authHeaders(),
                params: {
                    ward: w,
                    /*
                      ค้นด้วย HN แล้วข้ามตัวกรองวันและเวร แต่ยังอยู่ในหอเดิมเสมอ
                      พยาบาลตามหาใบของผู้ป่วยในหอตัวเอง ไม่ใช่ค้นทั้งโรงพยาบาล
                    */
                    hn: listHn || undefined,
                    from: listHn ? undefined : listRange?.from,
                    to: listHn ? undefined : listRange?.to,
                },
            });
            setRows(res.data?.data ?? []);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 401) router.push('/');
        } finally {
            setLoading(false);
        }
    }, [router, listRange, listHn]);

    useEffect(() => {
        (async () => {
            try {
                const res = await axios.get('/api/v1/system/wardsV1', { headers: authHeaders() });
                const list: Ward[] = (res.data?.data ?? []).map((w: { ward: number | string; ward_name: string }) => ({
                    ward: Number(w.ward), ward_name: w.ward_name,
                }));
                setWards(list);
                /*
                  ไม่เลือกหอให้ล่วงหน้า ปล่อยว่างให้พยาบาลเลือกเองทุกครั้ง
                  เครื่องในหอถูกใช้ร่วมกันหลายคนและพยาบาลย้ายไปช่วยหออื่น
                  ถ้าจำหอล่าสุดไว้ ใบจะถูกส่งในนามหอที่คนก่อนหน้าเลือกค้างไว้โดยไม่มีใครสังเกต
                */
            } catch { /* ไม่มีรายการหอ ผู้ใช้ยังเลือกไม่ได้ แต่หน้าไม่ควรพัง */ }
        })();
        // โหลดรายการหอครั้งเดียวตอนเปิดหน้า ไม่ขึ้นกับอะไรอีก
    }, []);

    /* เปลี่ยนวันหรือเวรแล้วต้องดึงใหม่ ไม่งั้นตัวกรองขยับแต่ตารางไม่ขยับ */
    useEffect(() => { if (ward) fetchOrders(ward); }, [ward, fetchOrders]);

    const beeper = useRef(createBeeper());

    const { connected } = useRxSocket({
        room: { kind: 'ward', ward },
        onReconnect: () => fetchOrders(ward),
        onStatus: e => {
            fetchOrders(ward);
            if (e.status === 'acknowledged') {
                message.info(`ห้องยารับใบแล้ว · ${e.by_name}`);
            } else if (e.status === 'completed') {
                message.success(`ห้องยาคีย์ลง HIS แล้ว · ${e.by_name}`);
            } else if (e.status === 'prepared') {
                /*
                  ข้อความนี้แปลว่ามีคนต้องเดินไปห้องยา จึงค้างนานกว่าข้อความอื่น
                  แต่ยังไม่มีเสียง เสียงที่เคาน์เตอร์สงวนไว้ให้ใบที่ถูกส่งกลับเท่านั้น
                  ถ้าทุกใบมีเสียง เสียงจะกลายเป็นเสียงพื้นหลังที่ไม่มีใครหันไปมอง
                */
                message.success({ content: `ยาพร้อมให้มารับแล้ว · ${e.by_name}`, duration: 15 });
            } else if (e.status === 'picked_up') {
                message.success(`บันทึกแล้วว่ารับยาไปแล้ว · ${e.by_name}`);
            } else if (e.status === 'rejected') {
                /*
                  ใบถูกส่งกลับคือเรื่องเดียวที่หอต้องลงมือทำต่อทันที จึงมีเสียงและค้างจนกดปิด
                  สถานะอื่นไม่มีเสียง ไม่งั้นเคาน์เตอร์พยาบาลจะมีเสียงดังทั้งวันจนเลิกสนใจ
                */
                beeper.current.chime('reject');
                message.error({
                    content: `ห้องยาส่งใบกลับ: ${e.reason ?? 'ไม่ระบุเหตุผล'} (${e.by_name})`,
                    duration: 0,
                    onClick: () => message.destroy(),
                });
            }
        },
    });

    /* ถามเป็นระยะเป็นตาข่ายสำรอง เปิดเฉพาะตอนสายหลุด */
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        if (timer.current) clearInterval(timer.current);
        if (ward && !connected) timer.current = setInterval(() => fetchOrders(ward), 15000);
        return () => { if (timer.current) clearInterval(timer.current); };
    }, [ward, connected, fetchOrders]);

    const pickWard = (w: number) => {
        setWard(w);
        /* ไม่ต้องดึงตารางตรงนี้ ตัวที่เฝ้า ward อยู่จะดึงให้เอง ยิงสองรอบได้ผลเท่ากันแต่ช้ากว่า */
    };

    /** แก้ไขรายการเดียวโดยไม่แตะรายการอื่น */
    const patchEntry = useCallback((uid: string, patch: Partial<Entry>) => {
        setEntries(prev => prev.map(e => (e.uid === uid ? { ...e, ...patch } : e)));
    }, []);

    /**
     * อ่านเลข HN จากไฟล์หนึ่งรายการ
     *
     * สองชั้นแรก (ข้อความใน PDF / บาร์โค้ด) ทำในเบราว์เซอร์
     * ถ้าไม่ได้ผลจึงส่งภาพไปให้เซิร์ฟเวอร์ทำ OCR แล้วเซิร์ฟเวอร์ยืนยันกับ HIS ให้ในคำขอเดียว
     */
    const readEntry = useCallback(async (uid: string, file: File, pageText = '') => {
        patchEntry(uid, { reading: true, matches: [], read: [], readNote: '' });
        try {
            /* โหลดตัวอ่านตอนใช้จริงเท่านั้น ไลบรารีอ่าน PDF กับบาร์โค้ดรวมกันหลายร้อย KB */
            const { prepareHnRead } = await import('../../lib/hnReader');
            const prepared = await prepareHnRead(file);

            /*
              หน้าที่ถูกแยกออกมาเป็นภาพแล้ว ชั้นข้อความของมันหายไปกับการแปลง
              จึงส่งเลขที่อ่านได้จากชั้นข้อความของหน้านั้นมาด้วย ซึ่งแม่นกว่าการอ่านจากรูป
            */
            const fromText = [...pageText.matchAll(/\d{4,14}/g)].map(m => m[0]);
            const candidates = [...new Set([...fromText, ...prepared.candidates])];
            const source = fromText.length > 0 ? 'pdf_text' : prepared.source;

            const fd = new FormData();
            if (prepared.image) fd.append('file', prepared.image, 'page1.jpg');
            if (candidates.length > 0) {
                fd.append('candidates', candidates.join(','));
                if (source) fd.append('source', source);
            }
            /* ให้เซิร์ฟเวอร์รู้ว่าเป็นหอไหน คนที่นอนหอนี้จะได้ขึ้นเป็นคำตอบแรก */
            if (ward) fd.append('ward', String(ward));

            const res = await axios.post('/api/v1/rx/read-hn', fd, { headers: authHeaders() });
            const data = res.data as HnRead;
            const matches = data.matches ?? [];
            patchEntry(uid, {
                reading: false,
                matches,
                read: data.read ?? [],
                readNote: matches.length > 0 ? ''
                    : data.ocr_unavailable ? 'เซิร์ฟเวอร์ยังไม่ได้ติดตั้งไฟล์โมเดลสำหรับอ่านตัวเลข'
                        : data.his_down ? 'ติดต่อ HIS ไม่ได้ จึงยืนยันเลขที่อ่านได้ไม่ได้'
                            : (data.read ?? []).length > 0
                                ? `อ่านได้ ${(data.read ?? []).join(', ')} แต่ไม่ตรงกับ HN ใดใน HIS`
                                : 'ไม่พบตัวเลขที่เป็นรูป HN ในหน้าแรกของไฟล์',
            });
        } catch {
            /* อ่านไม่ได้ไม่ใช่เรื่องใหญ่ พยาบาลพิมพ์เองได้ตามเดิม จึงไม่ขึ้นกล่องแดงขัดจังหวะ */
            patchEntry(uid, { reading: false, readNote: 'อ่านไฟล์นี้ไม่สำเร็จ กรุณาพิมพ์ HN เอง' });
        }
    }, [patchEntry, ward]);

    /** รับเลขที่อ่านได้มาใส่ให้ไฟล์นั้น — เกิดจากการกดของผู้ใช้เท่านั้น */
    const acceptHn = (uid: string, m: HnMatch) => {
        patchEntry(uid, {
            hn: m.hn,
            patient: {
                ptname: m.ptname, an: m.an,
                admission: m.admission, ward_name: m.ward_name, discharged_at: m.discharged_at,
            },
            source: m.source,
            hisDown: false,
        });
    };

    /** ค้นชื่อจาก HN ที่พิมพ์เอง เซิร์ฟเวอร์เติมศูนย์ให้ครบเก้าหลักแล้วคืนเลขเต็มกลับมา */
    const lookupFor = useCallback(async (uid: string, value: string) => {
        const v = value.trim();
        patchEntry(uid, { patient: null, hisDown: false });
        if (!/^\d{1,20}$/.test(v)) return;
        patchEntry(uid, { looking: true });
        try {
            const res = await axios.get('/api/v1/rx/patient-lookup', { headers: authHeaders(), params: { hn: v, ward } });
            if (res.data?.his_down) patchEntry(uid, { hisDown: true });
            else if (res.data?.found) {
                /*
                  ใส่เลขที่เติมศูนย์ครบเก้าหลักกลับเข้าช่องให้เห็น
                  พยาบาลพิมพ์ 635972 แต่เลขจริงคือ 000635972 ต้องเห็นตรงกับที่ติดไปกับใบ
                */
                patchEntry(uid, {
                    patient: res.data.data,
                    hn: String(res.data.data?.hn ?? v),
                    source: 'manual',
                });
            }
        } catch {
            patchEntry(uid, { hisDown: true });
        } finally {
            patchEntry(uid, { looking: false });
        }
    }, [patchEntry, ward]);

    const blank = (uid: string, name: string, file: File, extra: Partial<Entry> = {}): Entry => ({
        uid, name, file,
        thumb: '',
        reading: false,
        matches: [],
        read: [],
        readNote: '',
        hn: '',
        patient: null,
        source: 'manual',
        looking: false,
        hisDown: false,
        ...extra,
    });

    /** เติมรายการเข้าไปโดยไม่ให้เกินเพดาน และบอกเมื่อมีของตกหล่น */
    const appendEntries = useCallback((added: Entry[]) => {
        setEntries(prev => {
            /*
              โหมดส่งซ้ำรู้อยู่แล้วว่าเป็นใบของใคร จึงใส่ HN ให้ทุกไฟล์ที่แนบเข้ามา
              ไม่ต้องรอระบบอ่านเลขจากภาพ และไม่เปิดให้เลือกคนใหม่
              เพราะฉบับแก้ของใบที่ถูกตีกลับ ต้องเป็นผู้ป่วยคนเดิมเสมอ ถ้าเป็นคนละคนคือใบใหม่
            */
            const fixed = resendLock.current
                ? added.map(e => ({
                    ...e,
                    hn: resendLock.current!.hn,
                    patient: resendLock.current!.patient,
                    source: 'manual' as const,
                }))
                : added;
            const room = MAX_ENTRIES - prev.length;
            if (room <= 0) {
                message.warning(`ส่งได้ครั้งละไม่เกิน ${MAX_ENTRIES} รายการ`);
                return prev;
            }
            if (fixed.length > room) {
                message.warning(`ส่งได้ครั้งละไม่เกิน ${MAX_ENTRIES} รายการ · รับไว้ ${room} รายการแรก`);
            }
            return [...prev, ...fixed.slice(0, room)];
        });
    }, [message]);

    /**
     * รับไฟล์ที่เพิ่งลากมาวาง
     *
     * PDF หลายหน้าถูกแยกเป็นหน้าละหนึ่งรายการ เพราะหนึ่งหน้ามักเป็นหนึ่งผู้ป่วย
     * จำนวน HN ที่ระบุได้จึงเท่ากับจำนวนหน้าโดยอัตโนมัติ ไม่ต้องมีกฎแยกไว้บังคับ
     */
    const onFiles = useCallback(async (list: UploadFile[]) => {
        for (const f of list) {
            const file = f.originFileObj as File | undefined;
            /*
              antd เรียกตัวนี้หนึ่งครั้งต่อหนึ่งไฟล์ และส่งรายการทั้งชุดมาด้วยทุกครั้ง
              ลากมาสองไฟล์จึงได้รายการเดิมสองรอบ ถ้าไม่กันไว้จะกลายเป็นสี่รายการ
              ต้องจำไว้ใน ref ไม่ใช่เทียบกับ entries เพราะ state ยังไม่ทันอัปเดตระหว่างสองรอบนั้น
            */
            if (!file || seenUids.current.has(f.uid)) continue;
            seenUids.current.add(f.uid);

            const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
            const lib = await import('../../lib/hnReader');

            if (isPdf) {
                /* นับหน้าก่อน จะได้ไม่ต้องวาดภาพทุกหน้าสำหรับไฟล์หน้าเดียว */
                let pages = 1;
                try { pages = await lib.countPdfPages(file); } catch { pages = 1; }

                if (pages > 1) {
                    const base = file.name.replace(/\.pdf$/i, '');
                    let split: Awaited<ReturnType<typeof lib.splitPages>> = [];
                    try { split = await lib.splitPages(file); } catch {
                        message.error(`แยกหน้าไฟล์ ${file.name} ไม่สำเร็จ`);
                        continue;
                    }
                    const added = split.map(pg => blank(
                        `${f.uid}#p${pg.page}`,
                        `${base} · หน้า ${pg.page}/${pg.pages}`,
                        new File([pg.blob], `${base}-p${pg.page}.jpg`, { type: 'image/jpeg' }),
                        { thumb: pg.thumb, page: pg.page, pages: pg.pages },
                    ));
                    appendEntries(added);
                    for (let i = 0; i < added.length; i++) {
                        void readEntry(added[i].uid, added[i].file, split[i].text);
                    }
                    continue;
                }
            }

            /* ไฟล์ภาพ หรือ PDF หน้าเดียว เก็บของเดิมไว้ทั้งไฟล์ ไม่แปลงอะไร */
            const entry = blank(f.uid, f.name, file);
            appendEntries([entry]);
            void lib.fileThumbnail(file)
                .then(url => patchEntry(entry.uid, { thumb: url }))
                .catch(() => { /* ทำภาพตัวอย่างไม่ได้ ไม่ใช่เหตุให้ส่งใบไม่ได้ */ });
            void readEntry(entry.uid, file);
        }
    }, [appendEntries, patchEntry, readEntry, message]);

    const [closing, setClosing] = useState(false);

    /*
      โหมดส่งอีกครั้ง

      เก็บใบเดิมไว้ทั้งใบ ไม่ใช่เก็บแค่เลข เพราะต้องเอา HN ชื่อ ความด่วน และเหตุผลที่ถูกตีกลับ
      มากรอกให้และแสดงบนจอ พยาบาลจะได้ไม่ต้องพิมพ์ใหม่แล้วพิมพ์ผิดคนละคนกับใบเดิม
      null = ส่งใบใหม่ตามปกติ
    */
    const [resendOf, setResendOf] = useState<RxOrder | null>(null);
    /* อ่านค่าล่าสุดจากใน callback ที่ไม่ได้ผูก resendOf ไว้เป็น dependency */
    const resendLock = useRef<{ hn: string; patient: { ptname: string; an: string } | null } | null>(null);

    const closeOrder = async (r: RxOrder) => {
        setClosing(true);
        try {
            await axios.post(`/api/v1/rx/orders/${r.rx_order_id}/close`, {}, { headers: authHeaders() });
            message.success('ปิดเรื่องแล้ว ใบนี้ออกจากคิวทั้งสองฝั่ง');
            setViewing(null);
            fetchOrders(ward);
        } catch (err) {
            const res = axios.isAxiosError(err) ? err.response : undefined;
            message.error((res?.data as { message?: string } | undefined)?.message ?? 'ปิดเรื่องไม่สำเร็จ');
        } finally {
            setClosing(false);
        }
    };

    /** กดจากใบที่ถูกส่งกลับ: เตรียมฟอร์มด้านบนให้พร้อม เหลือแค่ลากไฟล์ใหม่มาวาง */
    const startResend = (r: RxOrder) => {
        setResendOf(r);
        resendLock.current = {
            hn: r.hn ?? '',
            patient: r.patient_name ? { ptname: r.patient_name, an: r.an ?? '' } : null,
        };
        setViewing(null);
        setPriority(r.priority);
        /* ใบเดิมติ๊กสายยางไว้ ฉบับแก้ต้องติดไปด้วย ไม่งั้นห้องยาเตรียมยาเม็ดตามปกติให้คนเดิม */
        setTubeHns(r.tube_feed && r.hn ? new Set([r.hn]) : new Set());
        /* ล้างไฟล์ที่ค้างอยู่ก่อน ไม่ให้ไฟล์ของคนอื่นติดไปกับฉบับแก้ */
        setEntries([]);
        seenUids.current.clear();
        if (r.ward) setWard(r.ward);
        message.info('โหมดส่งอีกครั้ง — แนบไฟล์ที่สแกนใหม่ แล้วกดส่ง');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelResend = () => {
        setResendOf(null);
        resendLock.current = null;
        setTubeHns(new Set());
        setEntries([]);
        seenUids.current.clear();
    };

    const openView = async (r: RxOrder) => {
        setViewing(r);
        setViewFiles([]);
        setViewEvents([]);
        try {
            const res = await axios.get(`/api/v1/rx/orders/${r.rx_order_id}`, { headers: authHeaders() });
            setViewFiles(res.data?.data?.files ?? []);
            setViewEvents(res.data?.data?.events ?? []);
        } catch { message.error('เปิดไฟล์ไม่สำเร็จ'); }
    };

    const removeEntry = (uid: string) => setEntries(prev => prev.filter(e => e.uid !== uid));

    /**
     * จัดไฟล์เป็นใบสั่งยา
     *
     * ไฟล์ที่ HN เดียวกันรวมเป็นใบเดียว (ใบสั่งยาหลายหน้าของคนเดียวกัน)
     * ไฟล์ที่ยังไม่ระบุ HN แยกเป็นใบของตัวเองทุกไฟล์ ไม่จับรวมกัน
     * เพราะไม่รู้ว่าเป็นคนเดียวกันหรือเปล่า การเดาผิดแปลว่าสองคนถูกรวมเป็นใบเดียว
     */
    const groups = useMemo(() => {
        const map = new Map<string, Entry[]>();
        for (const e of entries) {
            const key = e.hn.trim() ? `hn:${e.hn.trim()}` : `file:${e.uid}`;
            map.set(key, [...(map.get(key) ?? []), e]);
        }
        return [...map.values()];
    }, [entries]);

    const unidentified = entries.filter(e => !e.hn.trim()).length;

    const send = async () => {
        if (!ward) { message.warning('กรุณาเลือกหอผู้ป่วย'); return; }
        if (entries.length === 0) { message.warning('กรุณาแนบไฟล์ใบสั่งยา'); return; }

        setSending(true);
        let done = 0;
        const failed: string[] = [];

        /*
          ส่งทีละใบตามลำดับ ไม่ยิงพร้อมกัน
          เครื่องสแกนในหอต่อผ่าน Wi-Fi การยิงสิบคำขอพร้อมกันพร้อมไฟล์ละไม่กี่ MB
          ทำให้บางคำขอหลุดกลางทาง แล้วจะไม่รู้ว่าใบไหนไม่ถึง
        */
        for (const group of groups) {
            const head = group[0];
            const fd = new FormData();
            fd.append('ward', String(ward));
            if (head.hn.trim()) fd.append('hn', head.hn.trim());
            if (head.patient?.an) fd.append('an', head.patient.an);
            if (head.patient?.ptname) fd.append('patient_name', head.patient.ptname);
            fd.append('hn_source', head.source);
            fd.append('priority', priority);
            if (note.trim()) fd.append('note', note.trim());
            /* เซิร์ฟเวอร์ตรวจเองว่าใบนี้เป็นของหอนี้และถูกส่งกลับจริง แล้วปิดใบเดิมให้ */
            if (resendOf) fd.append('resend_of', resendOf.rx_order_id);
            if (head.hn.trim() && tubeHns.has(head.hn.trim())) fd.append('tube_feed', 'true');
            for (const e of group) fd.append('files', e.file);

            try {
                await axios.post('/api/v1/rx/orders', fd, { headers: authHeaders() });
                done += 1;
            } catch (err) {
                const msg = axios.isAxiosError(err)
                    ? (err.response?.data as { message?: string } | undefined)?.message
                    : undefined;
                failed.push(`${head.hn.trim() || head.name}: ${msg ?? 'ส่งไม่สำเร็จ'}`);
            }
        }

        setSending(false);

        if (done > 0) {
            message.success(resendOf
                ? `ส่งฉบับแก้แล้ว · ใบเดิมปิดเรื่องให้อัตโนมัติ`
                : `ส่งใบสั่งยาแล้ว ${done} ใบ`);
        }
        if (failed.length > 0) {
            /* บอกเป็นรายใบว่าอันไหนไม่ถึง ไม่ใช่บอกรวม ๆ ว่าล้มเหลว จะได้รู้ว่าต้องส่งอะไรซ้ำ */
            message.error({ content: `ส่งไม่สำเร็จ ${failed.length} ใบ — ${failed.join(' · ')}`, duration: 0 });
        }

        if (failed.length === 0) {
            setEntries([]); setNote(''); setPriority('routine');
            setTubeHns(new Set());
            seenUids.current.clear();
            setResendOf(null);
            resendLock.current = null;
        }
        fetchOrders(ward);
    };

    /* ตารางให้ antd เรียงเอง ส่วนกระดานต้องเรียงเองให้ตรงกับที่ผู้ใช้เลือกไว้ */
    const boardColumns: BoardColumn<RxOrder>[] = useMemo(() => {
        const sorted = listSort
            ? [...rows].sort((a, b) => (listSort === 'ascend' ? 1 : -1) * byTime(a, b))
            : rows;
        return BOARD_ORDER.map(st => ({
            key: st,
            title: STATUS[st].label,
            tint: BOARD_TINT[st],
            items: sorted.filter(r => r.status === st),
            empty: st === 'rejected' ? 'ไม่มีใบที่ต้องแก้' : undefined,
        }));
    }, [rows, listSort]);

    const columns: ColumnsType<RxOrder> = [
        {
            /* ช่องเดียวที่กดเรียงได้ เรียงแล้วได้ทั้งวันและเวลา เพราะสองอย่างนี้คือค่าเดียวกัน */
            title: 'วันที่', key: 'd', width: 92,
            sorter: byTime,
            sortOrder: listSort,
            sortDirections: ['descend', 'ascend'],
            showSorterTooltip: { title: 'กดเพื่อเรียงตามวันและเวลาที่ส่ง' },
            render: (_, r) => <RxDay value={r.submitted_at} />,
        },
        {
            title: 'เวลาส่ง', dataIndex: 'submitted_at', key: 't', width: 86,
            render: (v: string) => (
                <div className="text-sm font-semibold tabular-nums">{dayjs(v).format('HH:mm')}</div>
            ),
        },
        {
            title: 'ผู้ป่วย', key: 'p', width: 210,
            render: (_, r) => (
                <div className="leading-tight">
                    <div className="font-semibold">{r.patient_name || <span className="text-gray-500">ไม่ระบุชื่อ</span>}</div>
                    {r.tube_feed && <TubeFeedTag compact className="mt-0.5" />}
                    <div className="text-xs text-gray-500">
                        HN {r.hn || '-'}{r.an ? ` · AN ${r.an}` : ''}
                    </div>
                </div>
            ),
        },
        {
            title: 'ด่วน', dataIndex: 'priority', key: 'pr', width: 96, align: 'center',
            /*
              ทุกใบมีจุดสีเสมอ รวมใบปกติ ถ้าแสดงเฉพาะใบด่วน ช่องว่างจะกลายเป็น
              ความหมายที่ต้องตีความว่า "ว่างแปลว่าปกติ หรือข้อมูลหาย"
              ใบปกติไม่ใช้ Tag เพราะป้ายสามสีเรียงกันทั้งคอลัมน์จะแย่งสายตากันเอง
            */
            render: (v: RxOrder['priority']) => v === 'routine'
                ? (
                    <span className="inline-flex items-center justify-center gap-1.5 text-xs">
                        <PriorityDot color={PRIORITY[v].dot} />
                        ปกติ
                    </span>
                )
                : <Tag color={PRIORITY[v].color} className="m-0! font-bold">{PRIORITY[v].short}</Tag>,
        },
        { title: 'ไฟล์', dataIndex: 'file_count', key: 'f', width: 60, align: 'center' },
        {
            title: 'สถานะ', key: 's', width: 230,
            render: (_, r) => {
                const stale = r.status === 'submitted' && r.waiting_seconds > STALE_SECONDS[r.priority];
                return (
                    <div className="leading-tight">
                        <Tag
                            color={STATUS[r.status].color}
                            className="m-0! font-semibold"
                            /* ใบที่ยาพร้อมแล้วคือใบเดียวที่หอต้องลุกไปทำอะไร จึงมีไอคอนกำกับ */
                            icon={r.status === 'prepared' ? <PiPackageBold className="inline mr-1" /> : undefined}
                        >
                            {STATUS[r.status].label}
                        </Tag>
                        {r.ack_by_name && r.status !== 'rejected' && (
                            <div className="text-xs text-gray-500 mt-1">รับโดย {r.ack_by_name}</div>
                        )}
                        {r.completed_by_name && (
                            <div className="text-xs text-gray-500">คีย์โดย {r.completed_by_name}</div>
                        )}
                        {r.prepared_by_name && (
                            <div className="text-xs text-gray-500">จัดยาโดย {r.prepared_by_name}</div>
                        )}
                        {stale && (
                            <Tooltip title="ห้องยายังไม่กดรับ หากเร่งด่วนให้โทรแจ้งห้องยาโดยตรง">
                                <div className="text-xs text-orange-500 font-semibold mt-1">
                                    <PiWarningBold className="inline mr-1" />
                                    รอมาแล้ว {Math.floor(r.waiting_seconds / 60)} นาที
                                </div>
                            </Tooltip>
                        )}
                    </div>
                );
            },
        },
        {
            title: '', key: 'view', width: 110, align: 'center',
            render: (_, r) => (
                <Button size="small" icon={<PiEyeBold />} onClick={() => openView(r)}>
                    ดูไฟล์ ({r.file_count})
                </Button>
            ),
        },
        {
            title: 'เหตุผลที่ส่งกลับ', dataIndex: 'reject_reason', key: 'rr',
            render: (v: string | null, r) => v
                ? <span className="text-red-500 text-xs">{v}{r.rejected_by_name ? ` (${r.rejected_by_name})` : ''}</span>
                : <span className="text-gray-500">-</span>,
        },
    ];

    const wardOptions = useMemo(
        () => wards.map(w => ({ label: w.ward_name, value: w.ward })), [wards]);

    return (
        <div className="bg-slate-50 dark:bg-[#141414] min-h-screen font-sans">
            <Navbar />
            <div className="p-4 max-w-7xl mx-auto flex flex-col gap-4">

                <Card size="small" title={resendOf ? 'ส่งใบสั่งยาอีกครั้ง (ฉบับแก้)' : 'ส่งใบสั่งยาให้ห้องยา'}>
                    {/*
                      แถบนี้ต้องอยู่บนสุดและปิดไม่ได้ เพราะโหมดส่งซ้ำเปลี่ยนความหมายของทั้งฟอร์ม
                      ไฟล์ที่แนบจะถูกผูกกับผู้ป่วยคนเดิมโดยไม่ถามอีก ถ้าคนกดไม่รู้ว่าอยู่โหมดนี้
                      แล้วลากใบของคนอื่นมาวาง ใบนั้นจะถูกส่งในชื่อผู้ป่วยคนเดิมทันที
                    */}
                    {resendOf && (
                        <Alert
                            className="mb-3"
                            type="warning"
                            showIcon
                            title={`กำลังส่งฉบับแก้ของใบที่ห้องยาส่งกลับ · ${resendOf.patient_name ?? 'ไม่ระบุชื่อ'} HN ${resendOf.hn ?? '-'}`}
                            description={
                                <div className="leading-snug">
                                    <div>
                                        เหตุผลที่ถูกส่งกลับ:{' '}
                                        <span className="text-red-500 font-semibold">
                                            {resendOf.reject_reason || 'ไม่ระบุ'}
                                        </span>
                                        {resendOf.rejected_by_name ? ` (${resendOf.rejected_by_name})` : ''}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        ไฟล์ที่แนบใหม่จะถูกผูกกับผู้ป่วยคนนี้ให้เอง · ส่งสำเร็จแล้วใบเดิมจะปิดเรื่องอัตโนมัติ
                                    </div>
                                </div>
                            }
                            action={
                                <Button size="small" onClick={cancelResend}>
                                    ออกจากโหมดนี้
                                </Button>
                            }
                        />
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-3">
                            {/*
                              หอผู้ป่วยอยู่ในฟอร์ม ไม่ใช่ตัวกรองของหน้า
                              เพราะค่านี้ถูกบันทึกติดไปกับใบสั่งยา ไม่ใช่แค่ใช้กรองสิ่งที่เห็น
                              คนส่งต้องเห็นว่ากำลังส่งในนามหอไหนขณะที่กดส่ง ไม่ใช่ตั้งไว้ที่อื่นแล้วลืม
                            */}
                            <div>
                                <Text className="text-xs text-gray-500 block mb-1">
                                    หอผู้ป่วยที่ส่ง <span className="text-red-500">*</span>
                                </Text>
                                <Select
                                    placeholder="เลือกหอผู้ป่วย"
                                    options={wardOptions}
                                    value={ward}
                                    onChange={pickWard}
                                    showSearch
                                    optionFilterProp="label"
                                    className="w-full"
                                    status={ward ? undefined : 'warning'}
                                />
                                {!ward && (
                                    <div className="text-xs text-orange-500 mt-1">
                                        ต้องเลือกหอก่อนจึงจะส่งได้ · ระบบจะจำหอที่เลือกไว้ให้ครั้งต่อไป
                                    </div>
                                )}
                            </div>

                            <Alert
                                type="info"
                                showIcon
                                title="HN ระบุทีละไฟล์"
                                description="แนบไฟล์แล้วระบบจะอ่าน HN ของแต่ละไฟล์ให้ · ไฟล์ที่ HN เดียวกันจะถูกรวมเป็นใบเดียว"
                            />

                            <div>
                                <Text className="text-xs text-gray-500 block mb-1">ความเร่งด่วน</Text>
                                <Radio.Group value={priority} onChange={e => setPriority(e.target.value)}
                                    optionType="button" buttonStyle="solid">
                                    <Radio.Button value="routine">ปกติ</Radio.Button>
                                    <Radio.Button value="discharge">ยากลับบ้าน</Radio.Button>
                                    <Radio.Button value="stat">STAT</Radio.Button>
                                </Radio.Group>
                                {priority === 'discharge' && (
                                    <div className="text-xs text-orange-500 mt-1">
                                        ห้องยาจะเห็นว่ามีผู้ป่วยรออยู่ และจะขึ้นเตือนเมื่อค้างเกิน 10 นาที
                                    </div>
                                )}
                            </div>

                        </div>

                        <div className="flex flex-col gap-3">
                            <Upload.Dragger
                                multiple
                                /*
                                  ให้ antd ลืมไฟล์ทันทีที่รับมา แล้วเราถือรายการเอง
                                  เพราะ PDF หนึ่งไฟล์อาจกลายเป็นหลายรายการ ซึ่งไม่ตรงกับรายการของ antd
                                */
                                fileList={[]}
                                showUploadList={false}
                                /* คืน false เพื่อไม่ให้ antd ยิงอัปโหลดเอง เราส่งพร้อมข้อมูลอื่นทีเดียวตอนกดส่ง */
                                beforeUpload={() => false}
                                onChange={info => { void onFiles(info.fileList); }}
                                accept=".pdf,.jpg,.jpeg,.png"
                            >
                                <p className="text-3xl text-[#006b5f]"><PiUploadSimpleBold className="inline" /></p>
                                <p className="font-semibold">ลากไฟล์มาวาง หรือคลิกเพื่อเลือก</p>
                                <p className="text-xs text-gray-500">PDF / JPG / PNG ไม่เกิน 20 MB ต่อไฟล์ สูงสุด 10 ไฟล์</p>
                            </Upload.Dragger>

                            {/*
                              หนึ่งแถวต่อหนึ่งไฟล์ ภาพอยู่ติดกับช่อง HN ของมันเอง
                              คนกรอกจะได้เทียบภาพกับเลขในแถวเดียวกัน ไม่ต้องจำว่าไฟล์ที่สามคือใบของใคร

                              เลขที่อ่านได้เป็น "ข้อเสนอ" ระบบไม่เติมให้เอง
                              คนที่ถือกระดาษต้นฉบับอยู่ในมือเป็นคนเดียวที่ยืนยันได้ว่าตรงกัน
                            */}
                            {entries.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <Text className="text-xs text-gray-500">
                                        ไฟล์ที่จะส่ง {entries.length} ไฟล์ · กดที่ภาพเพื่อดูเต็มจอ
                                    </Text>

                                    <Image.PreviewGroup>
                                        {entries.map((e, i) => (
                                            <div
                                                key={e.uid}
                                                className="flex gap-3 p-2 rounded-lg border border-gray-200"
                                            >
                                                <div className="relative w-16 shrink-0">
                                                    <div className="aspect-3/4 rounded overflow-hidden border
                                                        border-gray-200 bg-white grid place-items-center">
                                                        {e.thumb ? (
                                                            <Image
                                                                src={e.thumb}
                                                                alt={e.name}
                                                                className="object-cover w-full h-full"
                                                                rootClassName="w-full h-full"
                                                            />
                                                        ) : <Spin size="small" />}
                                                    </div>
                                                    <div className="absolute top-0.5 left-0.5 bg-black/60 text-white
                                                        text-[10px] px-1 rounded">
                                                        {i + 1}
                                                    </div>
                                                    {/^.+\.pdf$/i.test(e.name) && (
                                                        <div className="absolute top-0.5 right-0.5 text-white bg-black/60 rounded p-0.5">
                                                            <PiFilePdfBold size={10} />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-500 truncate flex-1">
                                                            {e.name}
                                                        </span>
                                                        {e.pages && e.pages > 1 && (
                                                            <Tag className="m-0! text-[11px]!">
                                                                หน้า {e.page}/{e.pages}
                                                            </Tag>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeEntry(e.uid)}
                                                            className="text-gray-500 hover:text-red-500 transition-colors"
                                                            aria-label={`เอา ${e.name} ออก`}
                                                        >
                                                            <PiTrashBold size={14} />
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            size="small"
                                                            value={e.hn}
                                                            onChange={ev => patchEntry(e.uid, {
                                                                hn: ev.target.value, source: 'manual', patient: null,
                                                            })}
                                                            onBlur={ev => lookupFor(e.uid, ev.target.value)}
                                                            onPressEnter={ev => lookupFor(e.uid, (ev.target as HTMLInputElement).value)}
                                                            placeholder="HN ของไฟล์นี้"
                                                            className="max-w-[170px]"
                                                            status={e.hn.trim() ? undefined : 'warning'}
                                                            allowClear
                                                        />
                                                        {e.looking && <Spin size="small" />}
                                                        {e.patient && (() => {
                                                            /*
                                                              คนที่ไม่ได้นอนอยู่ ชื่อเป็นสีส้ม ไม่ใช่สีเขียวแบบ "ยืนยันแล้ว"
                                                              ชื่อที่ขึ้นมาเป็นคนจริงเสมอ สีเขียวจะทำให้เชื่อว่าถูกคนทั้งที่อาจเป็นเลขหลง
                                                            */
                                                            const tag = admissionTag(e.patient.admission,
                                                                e.patient.ward_name ?? null, e.patient.discharged_at ?? null);
                                                            const doubt = e.patient.admission === 'none';
                                                            return (
                                                                <span className="flex items-center gap-1.5 min-w-0">
                                                                    <span className={`text-xs font-semibold truncate
                                                                        ${doubt ? 'text-orange-600' : 'text-emerald-600'}`}>
                                                                        {e.patient.ptname || 'ไม่มีชื่อในทะเบียน'}
                                                                        {e.patient.an ? ` · AN ${e.patient.an}` : ''}
                                                                    </span>
                                                                    {tag && (
                                                                        <Tag color={tag.color} className="m-0! text-[11px]! shrink-0">
                                                                            {tag.text}
                                                                        </Tag>
                                                                    )}
                                                                </span>
                                                            );
                                                        })()}
                                                        {e.hn.trim() && e.source !== 'manual' && (
                                                            <Tag color="blue" className="m-0! text-[11px]!">
                                                                {SOURCE_LABEL[e.source as HnSource]}
                                                            </Tag>
                                                        )}
                                                    </div>

                                                    {/*
                                                      ขึ้นหลังจากได้ชื่อผู้ป่วยแล้วเท่านั้น
                                                      ก่อนหน้านั้นยังไม่รู้ว่าเป็นใคร ติ๊กไปก็ไม่รู้ว่าติ๊กให้คนไหน
                                                    */}
                                                    {e.patient && e.hn.trim() && (
                                                        <Checkbox
                                                            checked={tubeHns.has(e.hn.trim())}
                                                            onChange={ev => toggleTube(e.hn.trim(), ev.target.checked)}
                                                            className="text-xs! self-start"
                                                        >
                                                            ผู้ป่วยได้รับอาหารทางสายยาง (NG-Tube)
                                                        </Checkbox>
                                                    )}

                                                    {e.reading && (
                                                        <span className="text-xs text-gray-500">
                                                            <Spin size="small" /> กำลังอ่าน HN จากไฟล์นี้...
                                                        </span>
                                                    )}

                                                    {/* เลขที่อ่านได้ กดเลือกได้ทีละเลข ไม่กดก็พิมพ์เองได้ */}
                                                    {!e.reading && e.matches.length > 0 && (
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <span className="text-[11px] text-gray-500 shrink-0">
                                                                {e.matches.length === 1 ? 'อ่านได้:' : `อ่านได้ ${e.matches.length} เลข เลือกเอง:`}
                                                            </span>
                                                            {e.matches.map(m => (
                                                                <button
                                                                    key={m.hn}
                                                                    type="button"
                                                                    onClick={() => acceptHn(e.uid, m)}
                                                                    className={`text-xs px-2 py-1 rounded border transition-colors
                                                                        ${e.hn === m.hn
                                                                            ? 'border-[#006b5f] bg-[#006b5f]/10 text-[#006b5f] font-semibold'
                                                                            : 'border-gray-300 hover:border-[#006b5f]'}
                                                                        ${m.admission === 'none' && e.hn !== m.hn ? 'opacity-70 border-dashed' : ''}`}
                                                                >
                                                                    <span className="tabular-nums">{m.hn}</span>
                                                                    <span className="ml-1.5 opacity-80">
                                                                        {m.ptname || 'ไม่มีชื่อในทะเบียน'}
                                                                    </span>
                                                                    {(() => {
                                                                        const tag = admissionTag(m.admission, m.ward_name, m.discharged_at);
                                                                        return tag && (
                                                                            <Tag color={tag.color} className="m-0! ml-1.5! text-[10px]! leading-4! px-1!">
                                                                                {tag.text}
                                                                            </Tag>
                                                                        );
                                                                    })()}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {!e.reading && e.matches.length === 0 && e.readNote && (
                                                        <span className="text-[11px] text-orange-500">{e.readNote}</span>
                                                    )}

                                                    {e.hisDown && (
                                                        <span className="text-[11px] text-orange-500">
                                                            ค้นชื่อจาก HIS ไม่ได้ตอนนี้ — ยังส่งใบได้ ห้องยาจะอ่านจากภาพ
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </Image.PreviewGroup>
                                </div>
                            )}
                        </div>
                    </div>

                    {/*
                      สองช่องนี้แยกกันคนละกล่อง เพราะเป็นคนละเรื่องกัน
                      ซ้ายคือสิ่งที่ต้องกรอก ขวาคือสิ่งที่ต้องอ่าน
                      เดิมคำเตือนพาดเต็มความกว้างใต้ทุกอย่าง จนกลายเป็นข้อความที่ถูกข้ามไปทุกครั้ง
                    */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                        <div className="rounded-lg border border-gray-200 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <PiNotePencilBold className="text-[#006b5f]" />
                                <Text className="font-semibold text-sm">หมายเหตุถึงห้องยา</Text>
                                <Text className="text-xs text-gray-500">ไม่บังคับ</Text>
                            </div>
                            <TextArea
                                rows={3}
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="เช่น ขอด่วน ผู้ป่วยรอกลับบ้าน / ยาตัวที่สามเขียนทับ อ่านยาก"
                                maxLength={300}
                                showCount
                            />
                        </div>

                        <Alert
                            type="warning"
                            showIcon
                            title="สแกนหนึ่งผู้ป่วยต่อหนึ่งใบ"
                            description="ถ้าสแกนหลายคนรวมไฟล์เดียว ห้องยาจะเห็นข้อมูลผู้ป่วยรายอื่นไปด้วย และตรวจสอบย้อนหลังว่าใบไหนของใครไม่ได้ · แนะนำตั้งเครื่องสแกน 300 dpi ขาวดำ"
                        />
                    </div>

                    {/* สรุปว่าจะกลายเป็นกี่ใบ ก่อนกด ไม่ใช่รู้ตอนส่งไปแล้ว */}
                    {entries.length > 0 && (
                        <div className="mt-4 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-semibold">
                                จะสร้าง {groups.length} ใบ จาก {entries.length} ไฟล์
                            </span>
                            {groups.filter(g => g.length > 1).map(g => (
                                <Tag key={g[0].uid} className="m-0!">
                                    {g[0].hn} รวม {g.length} ไฟล์
                                </Tag>
                            ))}
                            {(() => {
                                const n = groups.filter(g => g[0].hn.trim() && tubeHns.has(g[0].hn.trim())).length;
                                return n > 0 && (
                                    <span className="text-xs text-gray-500">
                                        <TubeFeedTag compact /> {n} ใบ
                                    </span>
                                );
                            })()}
                            {unidentified > 0 && (
                                <span className="text-orange-500 text-xs">
                                    มี {unidentified} ไฟล์ที่ยังไม่ระบุ HN · จะแยกเป็นใบละไฟล์
                                    และห้องยาต้องอ่านเลขจากภาพเอง
                                </span>
                            )}
                        </div>
                    )}

                    <Button
                        type="primary" size="large" icon={<PiPaperPlaneTiltBold />}
                        onClick={send} loading={sending} disabled={!ward || entries.length === 0}
                        className="w-full mt-3"
                    >
                        ส่งให้ห้องยา{entries.length > 0 ? ` (${groups.length} ใบ)` : ''}
                    </Button>
                </Card>

                <Card
                    size="small"
                    title={
                        <div className="flex items-center gap-2">
                            <span>ใบที่ส่ง{listIsToday ? 'วันนี้' : 'ย้อนหลัง'}</span>
                            {ward && <Tag className="m-0!">{wards.find(w => w.ward === ward)?.ward_name}</Tag>}
                            <span className="text-gray-500 font-normal">({rows.length})</span>
                        </div>
                    }
                    extra={
                        <div className="flex items-center gap-2">
                            <Tooltip title={connected
                                ? 'ต่อกับเซิร์ฟเวอร์อยู่ สถานะจากห้องยาจะขึ้นเองทันที'
                                : 'สายหลุด กำลังถามเซิร์ฟเวอร์เป็นระยะแทน และต่อใหม่ให้อัตโนมัติ'}>
                                <Tag color={connected ? 'green' : 'orange'} className="m-0! flex items-center gap-1">
                                    {connected ? <PiBroadcastBold /> : <PiPlugsBold />}
                                    {connected ? 'สด' : 'สายหลุด'}
                                </Tag>
                            </Tooltip>
                            <Button size="small" icon={<PiArrowsClockwiseBold />}
                                onClick={() => fetchOrders(ward)} loading={loading} disabled={!ward}>
                                รีเฟรช
                            </Button>
                        </div>
                    }
                >
                    {/* ตัวกรองเรียงตามลำดับที่คนคิด: วันไหน แล้วช่วงไหนของวัน แล้วค่อยตามหาเป็นรายคน */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 shrink-0">วันที่</span>
                            <DatePicker
                                value={listDate}
                                onChange={d => { if (d) setListDate(d); }}
                                format="DD/MM/BBBB"
                                allowClear={false}
                                /* วันข้างหน้ายังไม่มีใบ เลือกไปก็ได้ตารางว่างเสมอ */
                                maxDate={dayjs()}
                                size="small"
                            />
                            <Button size="small" onClick={() => setListDate(d => d.subtract(1, 'day'))}>
                                ก่อนหน้า
                            </Button>
                            <Button size="small" onClick={() => setListDate(d => d.add(1, 'day'))} disabled={listIsToday}>
                                ถัดไป
                            </Button>
                            <Button size="small" type="link" onClick={() => setListDate(dayjs())} disabled={listIsToday}>
                                วันนี้
                            </Button>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 shrink-0">ช่วงเวลา</span>
                            <Segmented
                                size="small"
                                value={listShift}
                                onChange={v => setListShift(v as ShiftKey)}
                                options={Object.keys(SHIFTS)}
                            />
                            {listShift === 'กำหนดเอง' && (
                                <TimePicker.RangePicker
                                    size="small"
                                    format="HH:mm"
                                    minuteStep={15}
                                    value={listCustom}
                                    onChange={v => setListCustom(v && v[0] && v[1] ? [v[0], v[1]] : null)}
                                    placeholder={['ตั้งแต่', 'ถึง']}
                                />
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 shrink-0">ค้นหา</span>
                            <Input.Search
                                size="small"
                                value={listHnInput}
                                onChange={e => {
                                    setListHnInput(e.target.value);
                                    /* ล้างช่องแล้วกลับไปดูตามวัน/เวรทันที ไม่ต้องกดค้นซ้ำ */
                                    if (!e.target.value.trim()) setListHn('');
                                }}
                                onSearch={v => setListHn(v.replace(/\D/g, ''))}
                                allowClear
                                placeholder="HN เช่น 635972"
                                enterButton={<PiMagnifyingGlassBold />}
                                className="w-44"
                                inputMode="numeric"
                            />
                        </div>

                        {/* โหมดแสดงผล จำไว้ที่เครื่อง เหมือนหอที่เลือกไว้ */}
                        <Segmented
                            size="small"
                            value={listView}
                            onChange={v => {
                                const next = v as typeof listView;
                                setListView(next);
                                try { localStorage.setItem(VIEW_KEY, next); } catch { /* โหมดส่วนตัว */ }
                            }}
                            options={[
                                { value: 'table', label: <span className="px-1 inline-flex items-center gap-1"><PiRowsBold /> ตาราง</span> },
                                { value: 'board', label: <span className="px-1 inline-flex items-center gap-1"><PiSquaresFourBold /> กระดาน</span> },
                            ]}
                        />

                        {/* ค้นอยู่ = ตารางไม่ใช่ของวันที่เลือกแล้ว ต้องบอก ไม่ปล่อยให้สงสัยว่าใบเก่าโผล่มาได้ยังไง */}
                        {listHn && (
                            <Tag color="blue" className="m-0! flex items-center gap-2">
                                ค้น HN {listHn} ทุกวันในหอนี้ · พบ {rows.length} ใบ
                                <Button size="small" type="link" className="p-0! h-auto!"
                                    onClick={() => { setListHn(''); setListHnInput(''); }}>
                                    ล้าง
                                </Button>
                            </Tag>
                        )}
                    </div>

                    {listView === 'board' ? (
                        <RxBoard
                            columns={boardColumns}
                            cardKey={r => r.rx_order_id}
                            height="calc(100vh - 420px)"
                            renderCard={r => {
                                const stale = r.status === 'submitted'
                                    && r.waiting_seconds > STALE_SECONDS[r.priority];
                                return (
                                    <BoardCard accent={PRIORITY[r.priority].dot} onClick={() => openView(r)}>
                                        <div className="flex items-center gap-1.5 text-xs">
                                            {r.priority === 'routine' ? (
                                                <span className="inline-flex items-center gap-1.5 text-gray-500">
                                                    <PriorityDot color={PRIORITY[r.priority].dot} />
                                                    ปกติ
                                                </span>
                                            ) : (
                                                <Tag color={PRIORITY[r.priority].color} className="m-0! text-[11px] font-bold">
                                                    {PRIORITY[r.priority].short}
                                                </Tag>
                                            )}
                                            <span className="ml-auto tabular-nums text-gray-500">
                                                {dayjs(r.submitted_at).format('D MMM HH:mm')}
                                            </span>
                                        </div>

                                        <div className="font-semibold mt-1 leading-tight">
                                            {r.patient_name || <span className="text-gray-500 font-normal">ไม่ระบุชื่อ</span>}
                                        </div>
                                        {r.tube_feed && <TubeFeedTag compact className="mt-1" />}
                                        <div className="text-xs text-gray-500 tabular-nums">
                                            HN {r.hn || '-'}{r.an ? ` · AN ${r.an}` : ''}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                            <Tag className="m-0! text-[11px]">{r.file_count} ไฟล์</Tag>
                                            {r.prepared_by_name && (
                                                <Tag color="green" className="m-0! text-[11px]">
                                                    <PiPackageBold className="inline mr-1" />ไปรับได้
                                                </Tag>
                                            )}
                                        </div>

                                        {/* ใบที่ห้องยายังไม่รับและรอนานผิดปกติ คือใบที่หอต้องโทรตาม */}
                                        {stale && (
                                            <div className="text-xs text-orange-500 font-semibold mt-1.5">
                                                <PiWarningBold className="inline mr-0.5" />
                                                ห้องยายังไม่รับ · รอ {Math.floor(r.waiting_seconds / 60)} นาที
                                            </div>
                                        )}

                                        {r.status === 'rejected' && r.reject_reason && (
                                            <div className="text-xs text-red-500 mt-1.5 line-clamp-2">
                                                {r.reject_reason}
                                            </div>
                                        )}
                                    </BoardCard>
                                );
                            }}
                        />
                    ) : (
                    <Table
                        rowKey="rx_order_id"
                        columns={columns}
                        dataSource={rows}
                        loading={loading}
                        size="small"
                        bordered
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        onChange={(_p, _f, sorter) => {
                            setListSort(Array.isArray(sorter) ? null : sorter.order ?? null);
                        }}
                        rowClassName={r => r.status === 'rejected'
                            ? 'bg-red-50 dark:bg-[#2a1215]'
                            /* ยาพร้อมแล้ว = มีของรออยู่ที่ห้องยา ต้องเห็นจากหางตาโดยไม่ต้องอ่านทีละแถว
                               ใบที่รับมาแล้วหรือปิดแล้วไม่ย้อมสี จะได้เหลือสีไว้ให้ใบที่ยังต้องทำ */
                            : r.status === 'prepared' ? 'bg-green-50 dark:bg-[#162312]' : ''}
                        locale={{
                            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={!ward
                                    ? 'เลือกหอผู้ป่วยด้านบนเพื่อดูใบที่ส่งไปแล้ว'
                                    : listIsToday && listShift === 'ทั้งวัน'
                                        ? 'วันนี้หอนี้ยังไม่ได้ส่งใบสั่งยา'
                                        : 'ช่วงเวลาที่เลือกไม่มีใบสั่งยาของหอนี้'} />,
                        }}
                    />
                    )}
                </Card>
            </div>

            <Modal
                open={!!viewing}
                onCancel={() => setViewing(null)}
                footer={null}
                width="92%"
                /* กลางจอ ไม่ใช่ชิดบนตามค่าเริ่มต้นของ antd */
                centered
                destroyOnHidden
                styles={{ body: { height: 'calc(100vh - 170px)', padding: 0 } }}
                title={viewing && (
                    <div className="flex flex-wrap items-center gap-2 pr-8">
                        {viewing.priority !== 'routine' && (
                            <Tag color={PRIORITY[viewing.priority].color} className="m-0! font-bold">
                                {PRIORITY[viewing.priority].short}
                            </Tag>
                        )}
                        {viewing.tube_feed && <TubeFeedTag />}
                        <span className="font-semibold">{viewing.patient_name || 'ไม่ระบุชื่อ'}</span>
                        <span className="text-xs text-gray-500">
                            HN {viewing.hn || '-'}{viewing.an ? ` · AN ${viewing.an}` : ''}
                        </span>
                        <Tag color={STATUS[viewing.status].color} className="m-0!">
                            {STATUS[viewing.status].label}
                        </Tag>
                    </div>
                )}
            >
                {viewing && (
                    <div className="flex h-full">
                        <RxFileViewer
                            orderId={viewing.rx_order_id}
                            files={viewFiles}
                            className="flex-1 min-w-0"
                        />

                        <div className="w-72 shrink-0 border-l border-gray-200
                            p-3 flex flex-col gap-3 overflow-auto">
                            <div>
                                <Text className="text-xs text-gray-500">ส่งเมื่อ</Text>
                                <div className="text-sm">
                                    {dayjs(viewing.submitted_at).format('D MMM BBBB HH:mm')} น.
                                </div>
                                <div className="text-xs text-gray-500">โดย {viewing.submitted_by_name}</div>
                            </div>

                            {viewing.note && (
                                <div>
                                    <Text className="text-xs text-gray-500">หมายเหตุถึงห้องยา</Text>
                                    <div className="text-sm">{viewing.note}</div>
                                </div>
                            )}

                            {/*
                              หอกดปิดเรื่องได้เอง เพราะหอเป็นคนรู้ว่าแก้แล้วส่งใบใหม่ไปหรือยัง
                              ใบเดิมไม่ได้ถูกลบ แค่ออกจากคิว ยังค้นด้วย HN เจอ
                            */}
                            {viewing.status === 'rejected' && (
                                <div className="flex flex-col gap-2">
                                    {/* ทางหลัก: สแกนใหม่แล้วส่งซ้ำ ใบเดิมปิดให้เองตอนส่งสำเร็จ */}
                                    <Button
                                        block type="primary"
                                        icon={<PiUploadSimpleBold />}
                                        onClick={() => startResend(viewing)}
                                    >
                                        ส่งอีกครั้ง (สแกนใหม่)
                                    </Button>
                                    {/* ทางรอง: ไม่ส่งซ้ำแล้ว เช่น แพทย์ยกเลิกคำสั่ง */}
                                    <Button
                                        block
                                        icon={<PiCheckCircleBold />}
                                        loading={closing}
                                        onClick={() => closeOrder(viewing)}
                                    >
                                        ไม่ส่งซ้ำ ปิดเรื่องนี้
                                    </Button>
                                </div>
                            )}

                            {viewing.reject_reason && (
                                <Alert
                                    type="error"
                                    showIcon
                                    title="ห้องยาส่งกลับให้แก้"
                                    description={
                                        <span className="text-xs">
                                            {viewing.reject_reason}
                                            {viewing.rejected_by_name ? ` (${viewing.rejected_by_name})` : ''}
                                        </span>
                                    }
                                />
                            )}

                            {!viewing.his_verified && (
                                <Alert
                                    type="warning"
                                    showIcon
                                    title="HN ยังไม่ได้ยืนยันกับ HIS"
                                    description={<span className="text-xs">ห้องยาต้องอ่านเลขจากภาพเอง</span>}
                                />
                            )}

                            <div>
                                <Text className="text-xs text-gray-500">ประวัติการดำเนินการ</Text>
                                <div className="flex flex-col gap-1 mt-1">
                                    {viewEvents.length === 0 ? (
                                        <span className="text-xs text-gray-500">ยังไม่มีความเคลื่อนไหว</span>
                                    ) : viewEvents.map((ev, i) => (
                                        <div key={i} className="text-xs leading-tight">
                                            <span className="text-gray-500">{ev.at}</span>{' '}
                                            <span className="font-semibold">
                                                {ACTION_LABEL[ev.action] ?? ev.action}
                                            </span>
                                            {ev.actor_name ? <span className="text-gray-500"> · {ev.actor_name}</span> : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
