'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import dayjs, { type Dayjs } from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import 'dayjs/locale/th';
import {
    Alert, App, Button, Card, DatePicker, Empty, Input, Modal, Segmented, Select,
    Table, Tag, TimePicker, Tooltip, Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SortOrder } from 'antd/es/table/interface';
import {
    PiArrowsClockwiseBold, PiCheckCircleBold, PiHandGrabbingBold, PiArrowUUpLeftBold,
    PiWarningBold, PiSpeakerHighBold, PiSpeakerSlashBold, PiBroadcastBold, PiPlugsBold,
    PiClockCountdownBold, PiPackageBold, PiMagnifyingGlassBold, PiSquaresFourBold, PiRowsBold,
    PiQuestionBold, PiShieldCheckBold,
} from 'react-icons/pi';
import { getUserProfile } from '../../lib/auth';
import { usePharmacy } from '../PharmacyShell';
import RxFileViewer, { type RxFile } from '../../components/RxFileViewer';
import { useRxSocket, createBeeper, type RxOrderEvent } from '../../lib/rxSocket';
import { SHIFTS, shiftRange, type ShiftKey } from '../../lib/rxShifts';
import { PRIORITY, PRIORITY_ORDER, PriorityDot, type RxPriority } from '../../lib/rxPriority';
import { TubeFeedTag } from '../../lib/rxTubeFeed';
import { RxDay, byTime } from '../../lib/rxDate';
import RxBoard, { BoardCard, type BoardColumn } from '../../components/RxBoard';

dayjs.extend(buddhistEra);
dayjs.locale('th');

const { Text } = Typography;
const { TextArea } = Input;

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
    /** ใบนี้เป็นฉบับแก้ของใบเลขไหน ว่าง = ใบส่งครั้งแรก */
    resend_of: string | null;
    /** ผู้ป่วยได้รับอาหารทางสายยาง ต้องเตรียมยาให้ใช้ทางสายได้ */
    tube_feed: boolean;
    file_count: number;
    waiting_seconds: number;
}

interface RxEvent { action: string; actor_name: string | null; at: string }

/** ข้อมูลเพิ่มที่มากับรายละเอียดใบ ไม่มีในรายการคิว */
interface RxDetail { prev_reject_reason: string | null; prev_rejected_at: string | null }

/** เกินเท่านี้ถือว่าค้างผิดปกติ ต่างกันตามความด่วน */
const STALE_SECONDS = { stat: 5 * 60, discharge: 10 * 60, routine: 20 * 60 };

/*
  แท็บกรองสถานะ เรียงตามลำดับงานจากซ้ายไปขวา

  "ค้างอยู่" ยังหมายถึงใบที่ยังไม่ได้คีย์เหมือนเดิม ไม่รวมใบที่คีย์แล้วรอจัดยา
  เพราะใบที่คีย์เสร็จก่อนจะมีขั้น "จัดยาเสร็จ" ในระบบ ถูกปิดงานไปแล้วจริง ๆ
  ถ้าเหมารวมย้อนหลัง ใบเก่าทั้งหมดจะเด้งกลับมาค้างในวันที่อัปเดตระบบ
*/
const STATUS_VIEWS = {
    'ค้างอยู่': ['submitted', 'acknowledged'],
    'รอจัดยา': ['completed'],
    'พร้อมให้มารับ': ['prepared'],
    'ส่งกลับ': ['rejected'],
    /* ปิดแล้วไม่ได้หายไปไหน ยังเปิดดูย้อนหลังและค้นด้วย HN ได้ แค่ไม่กวนคิวที่ต้องทำ */
    'จบแล้ว': ['picked_up', 'closed'],
    'ทั้งหมด': null,
} as const;

type StatusView = keyof typeof STATUS_VIEWS;

const STATUS: Record<RxOrder['status'], { label: string; color: string }> = {
    submitted: { label: 'รอรับ', color: 'gold' },
    acknowledged: { label: 'รับแล้ว กำลังคีย์', color: 'blue' },
    completed: { label: 'คีย์แล้ว รอจัดยา', color: 'purple' },
    prepared: { label: 'จัดยาเสร็จ รอมารับ', color: 'green' },
    picked_up: { label: 'ตึกรับยาแล้ว', color: 'default' },
    rejected: { label: 'ส่งกลับแล้ว', color: 'red' },
    closed: { label: 'ปิดเรื่องแล้ว', color: 'default' },
};

/* ที่มาของเลข HN บอกว่าต้องตรวจกับภาพละเอียดแค่ไหน */
const HN_SOURCE: Record<string, { label: string; color: string }> = {
    barcode: { label: 'บาร์โค้ด', color: 'green' },
    pdf_text: { label: 'ข้อความใน PDF', color: 'green' },
    ocr: { label: 'OCR', color: 'orange' },
    manual: { label: 'พิมพ์เอง', color: 'orange' },
};

const ACTION_LABEL: Record<string, string> = {
    submit: 'หอส่งใบ', ack: 'ห้องยารับ', complete: 'คีย์ลง HIS เสร็จ',
    prepare: 'จัดยาเสร็จ พร้อมให้มารับ', pickup: 'ตึกมารับยาแล้ว', close: 'ปิดเรื่อง',
    resend: 'หอส่งฉบับแก้',
    reject: 'ส่งกลับ', view_file: 'เปิดดูไฟล์',
};

/** ปิดเสียงเป็นการตั้งค่าประจำเครื่อง เครื่องหลังเคาน์เตอร์กับเครื่องในห้องประชุมไม่เหมือนกัน */
const SOUND_KEY = 'rx_pharmacy_sound';
/** โหมดแสดงผลก็เป็นของประจำเครื่องเหมือนกัน จอใหญ่หน้าเคาน์เตอร์กับโน้ตบุ๊กเหมาะกันคนละแบบ */
const VIEW_KEY = 'rx_pharmacy_view';

/**
 * ลำดับคอลัมน์บนกระดาน = ลำดับงานจริงจากซ้ายไปขวา
 * ใบเดินทางเดียว ใบที่อยู่ขวาสุดคือใบที่ใกล้จบที่สุด ยกเว้นช่องส่งกลับซึ่งเป็นทางแยก
 *
 * ไม่มีคอลัมน์ของใบที่จบแล้ว (ตึกรับยาไปแล้ว / ปิดเรื่องแล้ว) โดยตั้งใจ
 * กระดานมีไว้ตอบว่า "ยังเหลืออะไรต้องทำ" ของที่ส่งมอบไปแล้วไม่ใช่คำตอบของคำถามนั้น
 * ถ้าอยากดูย้อนหลังให้ไปที่แท็บ "จบแล้ว" ในโหมดตาราง
 */
const BOARD_ORDER = ['submitted', 'acknowledged', 'completed', 'prepared', 'rejected'] as const;

/** สีหัวคอลัมน์ ใช้โทนเดียวกับป้ายสถานะในตาราง คนจะได้ไม่ต้องจำสองชุด (เฉพาะสถานะที่มีคอลัมน์) */
const BOARD_TINT: Record<(typeof BOARD_ORDER)[number], string> = {
    submitted: '#faad14',
    /* เลือกเฉดกลางที่อ่านออกทั้งพื้นขาวและพื้น #141414 แทนเฉดเข้มซึ่งจมหายในโหมดมืด */
    acknowledged: '#4096ff',
    completed: '#9254de',
    prepared: '#52c41a',
    rejected: '#ff4d4f',
};

/** ข้อความยืนยันหลังกดแต่ละคำสั่ง รวมไว้ที่เดียว ปุ่มบนการ์ดกับในหน้าต่างจะได้พูดเหมือนกัน */
const ACT_DONE: Record<string, string> = {
    ack: 'รับใบสั่งยาแล้ว',
    complete: 'บันทึกว่าคีย์ลง HIS แล้ว',
    prepare: 'แจ้งหอแล้วว่ายาพร้อมให้มารับ',
    pickup: 'บันทึกว่าตึกรับยาไปแล้ว ใบออกจากคิว',
    close: 'ปิดเรื่องแล้ว ใบออกจากคิว',
    reject: 'ส่งกลับให้หอแล้ว',
};

const authHeaders = (): Record<string, string> => {
    const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function PharmacyQueuePage() {
    /*
      เรียก message ผ่าน App.useApp() ไม่ใช้ตัว static ที่ import มาตรง ๆ
      ตัว static ถูกสร้างนอกต้นไม้ของ React จึงไม่เห็น ConfigProvider
      กล่องข้อความจะเป็นธีมสว่างทับหน้าจอโหมดมืด และฟอนต์กลับไปเป็นตัวสำรอง
    */
    const { message, notification } = App.useApp();

    const router = useRouter();
    const { wards, wardList, setWards, priorities, setPending } = usePharmacy();
    const [rows, setRows] = useState<RxOrder[]>([]);
    const [loading, setLoading] = useState(false);

    /* ตัวกรองของหน้า วันที่เริ่มที่วันนี้เสมอ เปิดจอมาต้องเห็นงานของเวรที่กำลังทำอยู่ */
    const [date, setDate] = useState<Dayjs>(() => dayjs());
    const [shift, setShift] = useState<ShiftKey>('ทั้งวัน');
    const [custom, setCustom] = useState<[Dayjs, Dayjs] | null>(null);
    const [statusView, setStatusView] = useState<StatusView>('ค้างอยู่');
    /** กรองตามระดับความเร่งด่วน 'all' = ทุกระดับ */
    const [priorityView, setPriorityView] = useState<'all' | RxPriority>('all');
    /* จำนวนใบใหม่ที่เข้ามาระหว่างที่กำลังดูย้อนหลัง ไม่ดึงมาทับหน้าจอเอง */
    const [missed, setMissed] = useState(0);

    /*
      ค้นด้วย HN แยกเป็นสองค่า: ตัวที่กำลังพิมพ์ กับตัวที่กดค้นแล้ว
      ไม่ยิงทุกตัวอักษรที่พิมพ์ เพราะเลข HN พิมพ์ได้เก้าหลัก = เก้าคำค้นที่ไม่มีใครอยากได้
    */
    const [hnInput, setHnInput] = useState('');
    const [hn, setHn] = useState('');

    /** ตาราง = ไล่ทีละแถว · กระดาน = เห็นว่างานกองอยู่ขั้นไหน */
    const [view, setView] = useState<'table' | 'board'>('table');

    const isToday = date.isSame(dayjs(), 'day');
    /*
      ดูย้อนหลังอยู่ = ห้ามให้ใบใหม่มาสลับหน้าจอเอง คนกำลังไล่ตรวจของเก่าอยู่
      ระหว่างค้น HN ก็เช่นกัน ผลการค้นข้ามวันอยู่แล้ว ใบใหม่ที่เด้งเข้ามาจะทำให้หาที่เดิมไม่เจอ
    */
    const live = isToday && !hn;

    /*
      คำแนะนำการใช้งาน ขึ้นเองครั้งแรกของแต่ละบัญชี ไม่ใช่ครั้งแรกของเครื่อง
      เครื่องในห้องยาใช้ร่วมกันหลายคน ถ้าจำเป็นรายเครื่อง คนที่สองที่มานั่งเครื่องเดิมจะไม่เคยเห็นเลย

      อ่านค่าที่จำไว้ผ่าน useSyncExternalStore รอบเซิร์ฟเวอร์ถือว่าเคยเห็นแล้ว (ไม่มี localStorage)
      หน้าต่างจึงไม่โผล่ในรอบนั้นแล้วหายไปตอนอยู่ในเบราว์เซอร์
    */
    const introKey = `rx_queue_intro_seen:${String(getUserProfile()?.username ?? '')}`;
    const introSeen = useSyncExternalStore(
        () => () => {},
        () => { try { return localStorage.getItem(introKey) === '1'; } catch { return true; } },
        () => true,
    );
    const [introDismissed, setIntroDismissed] = useState(false);
    const [introAsked, setIntroAsked] = useState(false);
    const introOpen = introAsked || (!introSeen && !introDismissed);
    const closeIntro = () => {
        try { localStorage.setItem(introKey, '1'); } catch { /* โหมดส่วนตัว ก็แค่ขึ้นอีกครั้งรอบหน้า */ }
        setIntroDismissed(true);
        setIntroAsked(false);
    };

    const range = useMemo(() => shiftRange(date, shift, custom), [date, shift, custom]);

    const [open, setOpen] = useState<RxOrder | null>(null);
    const [files, setFiles] = useState<RxFile[]>([]);
    const [events, setEvents] = useState<RxEvent[]>([]);
    const [detail, setDetail] = useState<RxDetail | null>(null);
    const [busy, setBusy] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [reason, setReason] = useState('');
    /*
      เสียงเตือนเปิดไว้ตั้งแต่แรก เพราะเครื่องห้องยาเปิดหน้านี้ค้างไว้ทั้งเวร
      ถ้าต้องกดเปิดเองทุกครั้งที่เปิดจอ วันที่ลืมกดคือวันที่ใบด่วนค้างอยู่เงียบ ๆ
      ปิดได้และจำค่าไว้ที่เครื่อง สำหรับเครื่องที่ไม่ควรมีเสียง
    */
    const [sound, setSound] = useState(true);
    /*
      เบราว์เซอร์ยังห้ามเล่นเสียงจนกว่าจะมีคนแตะหน้าจอก่อนหนึ่งครั้ง
      จึงต้องแยก "ผู้ใช้เปิดเสียงไว้" ออกจาก "เสียงเล่นได้จริงแล้ว"
      ไม่งั้นจะขึ้นว่าเสียงเปิดอยู่ทั้งที่ไม่มีเสียงออกสักครั้ง
    */
    const [audioReady, setAudioReady] = useState(false);
    const beeper = useRef(createBeeper());

    const armSound = useCallback(async () => {
        const ok = await beeper.current.unlock();
        setAudioReady(ok);
        return ok;
    }, []);

    useEffect(() => {
        try { if (localStorage.getItem(SOUND_KEY) === 'off') setSound(false); } catch { /* โหมดส่วนตัว */ }
        try { if (localStorage.getItem(VIEW_KEY) === 'board') setView('board'); } catch { /* โหมดส่วนตัว */ }
    }, []);

    /*
      ปลุกระบบเสียงเองตั้งแต่ครั้งแรกที่ผู้ใช้แตะหน้าจอ ไม่ว่าจะแตะอะไร
      เจ้าหน้าที่ต้องคลิกอะไรสักอย่างอยู่แล้วตอนเริ่มเวร จึงแทบไม่มีใครต้องกดปุ่มเสียงเอง
    */
    useEffect(() => {
        if (!sound || audioReady) return;
        const arm = () => { void armSound(); };
        window.addEventListener('pointerdown', arm, { once: true });
        window.addEventListener('keydown', arm, { once: true });
        return () => {
            window.removeEventListener('pointerdown', arm);
            window.removeEventListener('keydown', arm);
        };
    }, [sound, audioReady, armSound]);

    const fetchRows = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/v1/rx/orders', {
                headers: authHeaders(),
                params: {
                    /* ว่าง = ไม่ส่งพารามิเตอร์ = เซิร์ฟเวอร์คืนทุกตึก */
                    wards: wards.length > 0 ? wards.join(',') : undefined,
                    priorities: priorities.length > 0 ? priorities.join(',') : undefined,
                    /* ค้น HN แล้วไม่ส่งช่วงเวลา ให้เซิร์ฟเวอร์หาข้ามวันให้ (ดู rxOrderController) */
                    hn: hn || undefined,
                    from: hn ? undefined : range?.from,
                    to: hn ? undefined : range?.to,
                },
            });
            const all: RxOrder[] = res.data?.data ?? [];
            setRows(all);
            setMissed(0);
            /*
              ตัวเลขบนแถบข้างคือ "ค้างอยู่ตอนนี้" ไม่ใช่ค้างของวันที่เลือกดู
              ถ้าเอาของเมื่อวานไปใส่ จะกลายเป็นตัวเลขที่ไม่มีความหมายกับงานตรงหน้า
            */
            if (live) setPending(all.filter(r => r.status === 'submitted' || r.status === 'acknowledged').length);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 401) router.push('/');
        } finally {
            setLoading(false);
        }
    }, [wards, priorities, hn, range, live, router, setPending]);

    useEffect(() => { fetchRows(); }, [fetchRows]);

    /*
      เครื่องถูกตั้งให้รับเฉพาะบางระดับแล้ว ตัวกรองชั่วคราวในหน้าต้องคืนค่า
      ไม่งั้นค่าที่เลือกค้างไว้ก่อนหน้าจะกรองซ้อนอีกชั้นโดยที่ตัวกรองนั้นถูกซ่อนไปแล้ว
    */
    useEffect(() => { if (priorities.length > 0) setPriorityView('all'); }, [priorities]);

    /*
      การเรียงของตาราง null = ใช้ลำดับคิวจากเซิร์ฟเวอร์ (ยังไม่ปิดงานก่อน แล้วด่วน แล้วเก่าก่อน)
      ซึ่งเป็นลำดับที่ควรทำงานจริง ไม่ใช่ลำดับเวลาล้วน จึงไม่ตั้งค่าเรียงไว้ตั้งแต่แรก
    */
    const [timeSort, setTimeSort] = useState<SortOrder>(null);

    /* ค้น HN แล้วผลลัพธ์ข้ามเดือน ลำดับคิวไม่มีความหมายอีกต่อไป เรียงใหม่สุดขึ้นก่อนให้เลย */
    useEffect(() => { setTimeSort(hn ? 'descend' : null); }, [hn]);

    /* ประกาศไว้เหนือตัวแจ้งเตือน เพราะกล่องเตือนมีปุ่มเปิดดูที่เรียกตัวนี้ */
    const openOrder = useCallback(async (r: RxOrder) => {
        setOpen(r); setFiles([]); setEvents([]); setDetail(null);
        try {
            const res = await axios.get(`/api/v1/rx/orders/${r.rx_order_id}`, { headers: authHeaders() });
            setFiles(res.data?.data?.files ?? []);
            setEvents(res.data?.data?.events ?? []);
            setDetail(res.data?.data ?? null);
        } catch { message.error('เปิดรายละเอียดไม่สำเร็จ'); }
    }, [message]);

    /**
     * แจ้งเตือนมุมขวาบนเมื่อมีใบใหม่
     *
     * ดึงรายละเอียดจาก REST ไม่ได้เอาจากสัญญาณที่ส่งมา
     * เพราะสัญญาณตั้งใจไม่ใส่ชื่อกับ HN ของผู้ป่วยไว้ (ดู realtime.ts)
     * ข้อมูลผู้ป่วยจึงเดินทางผ่านช่องทางที่ตรวจสิทธิ์ทุกครั้งเท่านั้น
     */
    const notifyNew = useCallback(async (e: RxOrderEvent) => {
        let info: Partial<RxOrder> = {};
        try {
            const res = await axios.get(`/api/v1/rx/orders/${e.rx_order_id}`, { headers: authHeaders() });
            info = (res.data?.data ?? {}) as Partial<RxOrder>;
        } catch {
            /* ดึงรายละเอียดไม่ได้ ยังต้องเตือนอยู่ดี แค่บอกได้น้อยลง ไม่ใช่เงียบไปเฉย ๆ */
        }

        const stat = e.priority === 'stat';
        const urgent = e.priority !== 'routine';
        notification.open({
            key: `rx-${e.rx_order_id}`,
            placement: 'topRight',
            type: stat ? 'error' : urgent ? 'warning' : 'info',
            title: (
                <span className="font-semibold">
                    {urgent && (
                        <Tag color={PRIORITY[e.priority].color} className="m-0! mr-2 font-bold">
                            {PRIORITY[e.priority].short}
                        </Tag>
                    )}
                    ใบสั่งยาใหม่
                </span>
            ),
            description: (
                <div className="leading-snug">
                    <div className="font-semibold">
                        {info.patient_name || <span className="text-gray-500 font-normal">ไม่ระบุชื่อ</span>}
                    </div>
                    <div className="text-xs tabular-nums">HN {info.hn || '-'}</div>
                    <div className="text-xs text-gray-500">
                        จาก {info.ward_name || `ตึก ${e.ward}`} · ส่งโดย {e.by_name}
                    </div>
                </div>
            ),
            /* เปิดดูได้จากกล่องเตือนเลย ใบด่วนจะได้ไม่ต้องไปหาแถวในตารางก่อน */
            actions: info.rx_order_id ? (
                <Button
                    size="small"
                    type="primary"
                    onClick={() => {
                        notification.destroy(`rx-${e.rx_order_id}`);
                        void openOrder(info as RxOrder);
                    }}
                >
                    เปิดดู
                </Button>
            ) : undefined,
            /* ใบด่วนที่สุดค้างจนกว่าจะกดปิด ที่เหลือหายเองเพื่อไม่ให้บังจอทั้งเวร */
            duration: stat ? 0 : urgent ? 20 : 8,
        });
    }, [notification, openOrder]);

    /*
      ใบที่เครื่องนี้ไม่ได้รับ ไม่ต้องส่งเสียงหรือรีเฟรช ไม่งั้นจะดังทั้งวันเพราะใบของคนอื่น
      กรองสองแกนเหมือนที่ส่งไปให้เซิร์ฟเวอร์: ตึกที่รับ และความด่วนที่รับ
    */
    const mine = useCallback((e: RxOrderEvent) =>
        (wards.length === 0 || wards.includes(e.ward))
        && (priorities.length === 0 || priorities.includes(e.priority)),
    [wards, priorities]);

    const { connected } = useRxSocket({
        room: { kind: 'pharmacy' },
        onReconnect: fetchRows,
        onNew: e => {
            if (!mine(e)) return;
            /* ใบด่วนใช้เสียงต่างจากใบปกติ สูงกว่าและซ้ำสองชุด แยกออกได้โดยไม่ต้องมองจอ */
            if (sound) beeper.current.chime(e.priority === 'stat' ? 'stat' : 'routine');
            void notifyNew(e);
            /*
              เสียงดังทุกกรณี แต่หน้าจอไม่สลับเองตอนกำลังดูย้อนหลัง
              ใบด่วนที่เข้ามายังต้องรู้ ส่วนจะเปลี่ยนไปดูเมื่อไหร่ให้คนตัดสินใจ
            */
            if (live) fetchRows(); else setMissed(n => n + 1);
        },
        onStatus: e => { if (mine(e) && live) fetchRows(); },
    });

    /*
      ถามเป็นระยะเป็นแค่ตาข่ายสำรอง เปิดเฉพาะตอนสายหลุด
      ถ้าเปิดไว้ตลอดทั้งที่สายยังดี จะเป็นการยิงคิวรีทิ้งเปล่าทั้งวัน
      และหยุดถามระหว่างเปิดดูเอกสาร ไม่งั้นตารางข้างหลังเปลี่ยนระหว่างที่กำลังคีย์อยู่
    */
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        if (timer.current) clearInterval(timer.current);
        if (!open && !connected && live) timer.current = setInterval(fetchRows, 10000);
        return () => { if (timer.current) clearInterval(timer.current); };
    }, [open, connected, live, fetchRows]);

    /*
      ยิงคำสั่งกับใบใดก็ได้ ไม่ผูกกับใบที่เปิดอยู่
      เพราะบนกระดาน ปุ่มอยู่บนการ์ดโดยไม่ต้องเปิดใบก่อน
    */
    const [cardBusy, setCardBusy] = useState<string | null>(null);

    const quickAct = async (r: RxOrder, path: 'ack' | 'complete' | 'prepare' | 'pickup' | 'close') => {
        setCardBusy(r.rx_order_id);
        try {
            await axios.post(`/api/v1/rx/orders/${r.rx_order_id}/${path}`, {}, { headers: authHeaders() });
            message.success(ACT_DONE[path] ?? 'บันทึกแล้ว');
            fetchRows();
        } catch (err) {
            const res = axios.isAxiosError(err) ? err.response : undefined;
            message.error((res?.data as { message?: string } | undefined)?.message
                ?? (res?.status === 409 ? 'ใบนี้ถูกเครื่องอื่นรับไปแล้ว' : 'ดำเนินการไม่สำเร็จ'));
            if (res?.status === 409) fetchRows();
        } finally {
            setCardBusy(null);
        }
    };

    const act = async (path: string, body?: Record<string, unknown>) => {
        if (!open) return;
        setBusy(true);
        try {
            await axios.post(`/api/v1/rx/orders/${open.rx_order_id}/${path}`, body ?? {}, { headers: authHeaders() });
            message.success(ACT_DONE[path] ?? 'ส่งกลับให้หอแล้ว');
            /*
              กดรับแล้วยังอยู่ในใบเดิม เพราะต้องอ่านใบต่อเพื่อคีย์
              กดคีย์เสร็จก็ยังอยู่ ปุ่มถัดไปคือ "จัดยาเสร็จ" ซึ่งบางครั้งกดต่อกันเลย
            */
            if (path === 'ack') setOpen({ ...open, status: 'acknowledged' });
            else if (path === 'complete') setOpen({ ...open, status: 'completed' });
            else setOpen(null);
            fetchRows();
        } catch (err) {
            const res = axios.isAxiosError(err) ? err.response : undefined;
            /* 409 = เครื่องอื่นชิงไปก่อน ต้องบอกให้ชัดว่าไม่ใช่ความผิดพลาดของระบบ */
            message.error((res?.data as { message?: string } | undefined)?.message
                ?? (res?.status === 409 ? 'ใบนี้ถูกเครื่องอื่นรับไปแล้ว' : 'ดำเนินการไม่สำเร็จ'));
            if (res?.status === 409) { setOpen(null); fetchRows(); }
        } finally {
            setBusy(false);
            setRejecting(false);
            setReason('');
        }
    };

    /**
     * ตารางคิว
     *
     * รวมข้อมูลที่อ่านพร้อมกันเสมอไว้ในช่องเดียว (ชื่อ+HN+ที่มาของเลข)
     * แทนที่จะแยกเป็นคอลัมน์ละอย่าง คอลัมน์ยิ่งเยอะสายตายิ่งต้องกวาดไกล
     * บนจอห้องยาที่มองจากระยะหนึ่งเมตร การกวาดสายตาคือสิ่งที่ทำให้อ่านช้า
     */
    const columns: ColumnsType<RxOrder> = [
        {
            /*
              คอลัมน์แรกสุด เพราะเป็นสิ่งที่สายตาต้องเจอก่อนตอนกวาดคิว
              ทุกแถวมีจุดสีเสมอ รวมใบปกติด้วย ถ้าแสดงเฉพาะใบด่วน ช่องว่างจะกลายเป็น
              ความหมายที่ต้องตีความ ("ว่างแปลว่าปกติ หรือแปลว่าข้อมูลหาย")
            */
            title: 'ด่วน', key: 'pr', width: 104, align: 'center',
            render: (_, r) => (
                <div className="flex items-center justify-center gap-1.5 leading-tight">
                    <PriorityDot color={PRIORITY[r.priority].dot} />
                    <span className={`text-xs ${r.priority === 'routine' ? 'text-gray-500' : 'font-semibold'}`}>
                        {PRIORITY[r.priority].short}
                    </span>
                </div>
            ),
        },
        {
            /*
              วันที่แยกเป็นช่องของตัวเอง ไม่ใช่ตัวเล็กใต้เวลา
              เพราะตอนค้น HN ทั้งตารางคือใบข้ามเดือน วันที่กลายเป็นสิ่งที่ต้องอ่านก่อนเวลา
              และหัวช่องนี้เป็นที่เดียวที่กดเรียงได้ เรียงแล้วได้ทั้งวันและเวลาไปพร้อมกัน
            */
            title: 'วันที่', key: 'd', width: 96,
            sorter: byTime,
            sortOrder: timeSort,
            sortDirections: ['descend', 'ascend'],
            showSorterTooltip: { title: 'กดเพื่อเรียงตามวันและเวลาที่ส่ง · กดครบรอบเพื่อกลับไปเรียงตามคิว' },
            render: (_, r) => <RxDay value={r.submitted_at} />,
        },
        {
            title: 'เวลา', key: 't', width: 104,
            render: (_, r) => {
                /* ใบที่คีย์แล้วแต่ยังไม่จัดยาก็ยังนับเวลาอยู่ เพราะหอยังมารับไม่ได้ */
                const open = r.status === 'submitted' || r.status === 'acknowledged' || r.status === 'completed';
                const stale = r.status === 'submitted' && r.waiting_seconds > STALE_SECONDS[r.priority];
                return (
                    <div className="leading-tight">
                        <div className="text-base font-semibold tabular-nums">
                            {dayjs(r.submitted_at).format('HH:mm')}
                        </div>
                        {/* นับเวลารอเฉพาะใบที่ยังไม่ปิด ใบเก่าที่ปิดไปแล้วตัวเลขนี้ไม่มีความหมาย */}
                        {open && (
                            <div className={`text-xs ${stale ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                                {stale && <PiWarningBold className="inline mr-0.5" />}
                                รอ {Math.floor(r.waiting_seconds / 60)} นาที
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'ผู้ป่วย', key: 'p',
            render: (_, r) => {
                const src = HN_SOURCE[r.hn_source] ?? HN_SOURCE.manual;
                return (
                    <div className="leading-tight py-0.5">
                        <div className="text-base font-semibold">
                            {/*
                              ป้ายนี้สำคัญกว่าที่เห็น ถ้าไม่มี ห้องยาจะเห็นใบของคนเดิมสองใบในวันเดียว
                              แล้วแยกไม่ออกว่าเป็นฉบับแก้ หรือเป็นออร์เดอร์ที่สองจริง ซึ่งแปลว่าจ่ายยาซ้ำได้
                            */}
                            {r.resend_of && (
                                <Tag color="purple" className="m-0! mr-1.5 align-middle font-semibold">ฉบับแก้</Tag>
                            )}
                            {r.patient_name || <span className="text-gray-500 font-normal">ไม่ระบุชื่อ</span>}
                        </div>
                        {r.tube_feed && <TubeFeedTag compact className="mt-0.5" />}
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-sm tabular-nums">HN {r.hn || '-'}</span>
                            {r.an && <span className="text-xs text-gray-500">AN {r.an}</span>}
                            <Tag color={src.color} className="m-0! text-[11px]!">{src.label}</Tag>
                            {!r.his_verified && (
                                <Tooltip title="ค้น HN นี้ใน HIS ไม่พบ หรือ HIS ติดต่อไม่ได้ตอนที่หอส่ง — ต้องตรวจกับภาพต้นฉบับ">
                                    <Tag color="red" className="m-0! text-[11px]!">ยังไม่ยืนยันกับ HIS</Tag>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            title: 'หอผู้ป่วย', dataIndex: 'ward_name', key: 'w', width: 150,
            render: (v: string | null) => <span className="text-sm">{v || '-'}</span>,
        },
        {
            title: 'สถานะ', key: 's', width: 180,
            render: (_, r) => (
                <div className="leading-tight">
                    <Tag color={STATUS[r.status].color} className="m-0! font-semibold">
                        {STATUS[r.status].label}
                    </Tag>
                    {/* ใครถืองานอยู่ สำคัญพอ ๆ กับสถานะ เวลามีหลายเครื่องช่วยกันรับ */}
                    {(r.ack_by_name || r.completed_by_name || r.prepared_by_name || r.closed_by_name) && (
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {r.closed_by_name || r.prepared_by_name || r.completed_by_name || r.ack_by_name}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: '', key: 'go', width: 118, fixed: 'right',
            render: (_, r) => (
                <Button
                    type={r.status === 'submitted' ? 'primary' : 'default'}
                    onClick={() => openOrder(r)}
                >
                    เปิดดู ({r.file_count})
                </Button>
            ),
        },
    ];

    /* นับจากชุดที่ดึงมาแล้ว ไม่ต้องยิงถามเซิร์ฟเวอร์อีกรอบต่อหนึ่งช่อง */
    const counts = useMemo(() => ({
        submitted: rows.filter(r => r.status === 'submitted').length,
        acknowledged: rows.filter(r => r.status === 'acknowledged').length,
        completed: rows.filter(r => r.status === 'completed').length,
        prepared: rows.filter(r => r.status === 'prepared').length,
        done: rows.filter(r => r.status === 'picked_up' || r.status === 'closed').length,
        rejected: rows.filter(r => r.status === 'rejected').length,
        stat: rows.filter(r => r.priority === 'stat' && r.status === 'submitted').length,
        discharge: rows.filter(r => r.priority === 'discharge' && r.status === 'submitted').length,
        /*
          นับจากชุดที่ผ่านตัวกรองสถานะแล้ว ตัวเลขบนปุ่มจึงตรงกับจำนวนที่จะได้เห็นจริง
          บนกระดานไม่มีตัวกรองสถานะ จึงนับทุกสถานะเหมือนที่กระดานแสดง
        */
        byPriority: Object.fromEntries(PRIORITY_ORDER.map(k =>
            [k, rows.filter(r => r.priority === k
                && (view === 'board' || !STATUS_VIEWS[statusView]
                    ? true
                    : (STATUS_VIEWS[statusView] as readonly string[]).includes(r.status))).length],
        )) as Record<RxOrder['priority'], number>,
    }), [rows, statusView, view]);

    const shown = useMemo(() => {
        /*
          บนกระดาน สถานะคือคอลัมน์อยู่แล้ว ถ้ายังกรองตามแท็บสถานะอีกชั้น
          จะเหลือคอลัมน์เดียวที่มีการ์ด ที่เหลือว่างหมด ซึ่งไม่มีใครตั้งใจ
        */
        const allow = view === 'board' ? null : STATUS_VIEWS[statusView];
        const byStatus = allow ? rows.filter(r => (allow as readonly string[]).includes(r.status)) : rows;
        return priorityView === 'all' ? byStatus : byStatus.filter(r => r.priority === priorityView);
    }, [rows, statusView, priorityView, view]);

    /* ตารางให้ antd เรียงเอง ส่วนกระดานต้องเรียงเองให้ตรงกับที่ผู้ใช้เลือกไว้ */
    const boardColumns: BoardColumn<RxOrder>[] = useMemo(() => {
        const sorted = timeSort
            ? [...shown].sort((a, b) => (timeSort === 'ascend' ? 1 : -1) * byTime(a, b))
            : shown;
        return BOARD_ORDER.map(st => ({
            key: st,
            title: STATUS[st].label,
            tint: BOARD_TINT[st],
            items: sorted.filter(r => r.status === st),
            empty: st === 'submitted' ? 'ไม่มีใบรอรับ' : undefined,
        }));
    }, [shown, timeSort]);

    return (
        <div className="flex flex-col gap-4">
            <Card size="small">
                {/*
                  ตัวกรองเรียงตามลำดับที่คนคิด: วันไหน → ช่วงไหนของวัน → ตึกไหน → สถานะไหน
                  วางบรรทัดเดียวกันทั้งหมดเพื่อให้เห็นเงื่อนไขที่กำลังใช้อยู่ครบในแถวเดียว
                */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 shrink-0">วันที่</span>
                        <DatePicker
                            value={date}
                            onChange={d => { if (d) setDate(d); }}
                            format="DD/MM/BBBB"
                            allowClear={false}
                            /* วันข้างหน้ายังไม่มีใบ เลือกไปก็ได้ตารางว่างเสมอ */
                            maxDate={dayjs()}
                        />
                        {/* ปุ่มเดินทีละวัน ใช้ไล่ดูย้อนหลังได้โดยไม่ต้องเปิดปฏิทินทุกครั้ง */}
                        <Button size="small" onClick={() => setDate(d => d.subtract(1, 'day'))}>
                            ก่อนหน้า
                        </Button>
                        <Button size="small" onClick={() => setDate(d => d.add(1, 'day'))} disabled={isToday}>
                            ถัดไป
                        </Button>
                        <Button size="small" type="link" onClick={() => setDate(dayjs())} disabled={isToday}>
                            วันนี้
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 shrink-0">ช่วงเวลา</span>
                        <Segmented
                            value={shift}
                            onChange={v => setShift(v as ShiftKey)}
                            options={Object.keys(SHIFTS)}
                        />
                        {shift === 'กำหนดเอง' && (
                            <TimePicker.RangePicker
                                format="HH:mm"
                                minuteStep={15}
                                value={custom}
                                onChange={v => setCustom(v && v[0] && v[1] ? [v[0], v[1]] : null)}
                                placeholder={['ตั้งแต่', 'ถึง']}
                            />
                        )}
                    </div>

                    {/*
                      ค้นด้วย HN อยู่แถวเดียวกับตัวกรองวัน แต่ทำงานคนละแบบ
                      ตัวกรองคือ "ดูช่วงไหน" ส่วนการค้นคือ "ตามหาใบของคนนี้" ซึ่งข้ามทุกช่วงเวลา
                      จึงมีแถบบอกสถานะการค้นใต้ตัวกรอง ไม่ปล่อยให้เดาว่าทำไมใบนอกช่วงถึงโผล่มา
                    */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 shrink-0">ค้นหา</span>
                        <Input.Search
                            value={hnInput}
                            onChange={e => {
                                setHnInput(e.target.value);
                                /* ล้างช่องแล้วกลับไปดูคิวตามวัน/เวรทันที ไม่ต้องกดค้นซ้ำ */
                                if (!e.target.value.trim()) setHn('');
                            }}
                            onSearch={v => setHn(v.replace(/\D/g, ''))}
                            allowClear
                            placeholder="HN เช่น 635972"
                            enterButton={<PiMagnifyingGlassBold />}
                            className="w-48"
                            inputMode="numeric"
                        />
                    </div>

                    <div className="flex items-center gap-2 min-w-[220px]">
                        <span className="text-xs text-gray-500 shrink-0">ตึก</span>
                        <Select
                            mode="multiple"
                            allowClear
                            value={wards}
                            onChange={setWards}
                            options={wardList.map(w => ({ label: w.ward_name, value: w.ward }))}
                            placeholder="ทุกตึก"
                            maxTagCount="responsive"
                            optionFilterProp="label"
                            className="flex-1 min-w-[150px]"
                        />
                    </div>

                    <Tooltip title={connected
                        ? 'ต่อกับเซิร์ฟเวอร์อยู่ ใบใหม่จะขึ้นเองทันที'
                        : 'สายหลุด กำลังถามเซิร์ฟเวอร์ทุก 10 วินาทีแทน และต่อใหม่ให้อัตโนมัติ'}>
                        <Tag
                            color={connected ? 'green' : 'orange'}
                            className="m-0! ml-auto flex items-center gap-1"
                            icon={connected ? <PiBroadcastBold /> : <PiPlugsBold />}
                        >
                            {connected ? 'เชื่อมต่อแล้ว' : 'สายหลุด · ใช้การถามเป็นระยะ'}
                        </Tag>
                    </Tooltip>

                    <Button
                        type={sound ? 'default' : 'primary'}
                        icon={sound ? <PiSpeakerHighBold /> : <PiSpeakerSlashBold />}
                        onClick={async () => {
                            const next = !sound;
                            setSound(next);
                            try { localStorage.setItem(SOUND_KEY, next ? 'on' : 'off'); } catch { /* โหมดส่วนตัว */ }
                            if (next) {
                                /* เปิดแล้วเล่นให้ฟังหนึ่งครั้ง เป็นการยืนยันว่าลำโพงดังจริง ไม่ใช่แค่ไอคอนเปลี่ยน */
                                const ok = await armSound();
                                if (ok) beeper.current.chime('routine');
                                else message.warning('เบราว์เซอร์นี้ยังไม่ยอมให้เล่นเสียง');
                            }
                        }}
                    >
                        {sound ? (audioReady ? 'เสียงเตือนเปิดอยู่' : 'เสียงรออนุญาต') : 'เปิดเสียงเตือน'}
                    </Button>

                    {/*
                      โหมดแสดงผล จำไว้ที่เครื่อง
                      ตาราง = ไล่ทีละแถว หาใบเฉพาะเจาะจงเร็วกว่า
                      กระดาน = เห็นทั้งเวรในภาพเดียวว่างานไปกองอยู่ขั้นไหน
                    */}
                    <Segmented
                        value={view}
                        onChange={v => {
                            const next = v as typeof view;
                            setView(next);
                            try { localStorage.setItem(VIEW_KEY, next); } catch { /* โหมดส่วนตัว */ }
                        }}
                        options={[
                            { value: 'table', label: <span className="px-1 inline-flex items-center gap-1.5"><PiRowsBold /> ตาราง</span> },
                            { value: 'board', label: <span className="px-1 inline-flex items-center gap-1.5"><PiSquaresFourBold /> กระดาน</span> },
                        ]}
                    />

                    <Button icon={<PiArrowsClockwiseBold />} onClick={fetchRows} loading={loading}>
                        รีเฟรช
                    </Button>
                    <Tooltip title="วิธีใช้งานคิวใบสั่งยา">
                        <Button icon={<PiQuestionBold />} onClick={() => setIntroAsked(true)} aria-label="วิธีใช้งาน" />
                    </Tooltip>
                </div>

                {/*
                  ตัวเลขสรุปอยู่เหนือตาราง ไม่ใช่ในตาราง
                  เจ้าหน้าที่มองจอจากระยะหนึ่งเมตรต้องรู้ทันทีว่ามีงานค้างกี่ใบ ด่วนกี่ใบ
                  โดยไม่ต้องกวาดสายตาอ่านทีละแถว
                */}
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                    {/* บนกระดาน สถานะเป็นคอลัมน์อยู่แล้ว แท็บชุดนี้จึงไม่มีงานทำ */}
                    {view === 'table' && <Segmented
                        value={statusView}
                        onChange={v => setStatusView(v as StatusView)}
                        options={(Object.keys(STATUS_VIEWS) as StatusView[]).map(k => ({
                            value: k,
                            label: (
                                <span className="px-1">
                                    {k}
                                    <span className="ml-1.5 opacity-60">
                                        {k === 'ค้างอยู่' ? counts.submitted + counts.acknowledged
                                            : k === 'รอจัดยา' ? counts.completed
                                                : k === 'พร้อมให้มารับ' ? counts.prepared
                                                    : k === 'ส่งกลับ' ? counts.rejected
                                                        : k === 'จบแล้ว' ? counts.done : rows.length}
                                    </span>
                                </span>
                            ),
                        }))}
                    />}

                    {/*
                      กรองตามระดับความเร่งด่วน
                      เวลางานล้น เจ้าหน้าที่จะกด STAT เพื่อเคลียร์ของด่วนก่อน
                      แล้วค่อยกลับมาดูทั้งหมด ตัวเลขบนปุ่มบอกว่าเหลือกี่ใบในแต่ละระดับ

                      ถ้าเครื่องนี้ถูกตั้งให้รับเฉพาะบางระดับไว้แล้ว ตัวกรองนี้จะหายไป
                      เหลือป้ายบอกแทน เพราะตัวกรองสองชั้นที่ทำเรื่องเดียวกัน
                      จะทำให้คนเข้าใจว่า "ไม่มีใบ" ทั้งที่ตัวเองกรองซ้อนกันอยู่สองที่
                    */}
                    {priorities.length > 0 ? (
                        <Tooltip title="ตั้งไว้ที่แถบข้าง เปลี่ยนได้ที่ “ความด่วนที่เครื่องนี้รับ”">
                            <Tag color="blue" className="m-0! flex items-center gap-1.5 py-1">
                                เครื่องนี้รับเฉพาะ
                                {priorities.map(p => (
                                    <span key={p} className="inline-flex items-center gap-1 font-semibold">
                                        <PriorityDot color={PRIORITY[p].dot} />
                                        {PRIORITY[p].short}
                                    </span>
                                ))}
                            </Tag>
                        </Tooltip>
                    ) : (
                        <Segmented
                            value={priorityView}
                            onChange={v => setPriorityView(v as typeof priorityView)}
                            options={[
                                { value: 'all', label: <span className="px-1">ทุกระดับ</span> },
                                ...PRIORITY_ORDER.map(k => ({
                                    value: k,
                                    label: (
                                        <span className="px-1 inline-flex items-center gap-1.5">
                                            <PriorityDot color={PRIORITY[k].dot} />
                                            {PRIORITY[k].short}
                                            <span className="opacity-60">{counts.byPriority[k]}</span>
                                        </span>
                                    ),
                                })),
                            ]}
                        />
                    )}
                    {counts.acknowledged > 0 && (
                        <Tag color="blue" className="m-0!">กำลังคีย์ {counts.acknowledged} ใบ</Tag>
                    )}

                    <span className="text-xs text-gray-500 ml-auto">
                        {hn ? `ผลการค้นหา HN ${hn}`
                            : live ? 'กำลังดูของวันนี้' : `กำลังดูย้อนหลัง ${date.format('D MMM BBBB')}`}
                        {!hn && shift !== 'ทั้งวัน' && range && ` · ${range.from.slice(11)}-${range.to.slice(11)}`}
                    </span>
                </div>
            </Card>

            {/*
              กำลังค้น HN อยู่ ตารางจึงไม่ใช่คิวของเวรนี้แล้ว ต้องบอกให้ชัดว่ากำลังดูอะไรอยู่
              ไม่งั้นใบของเดือนก่อนที่โผล่มาจะถูกอ่านว่าเป็นงานค้างของวันนี้
            */}
            {hn && (
                <Alert
                    type="info"
                    showIcon
                    icon={<PiMagnifyingGlassBold />}
                    title={`ผลการค้นหา HN ${hn} · ทุกวันทุกเวร ไม่สนใจตัวกรองวันและช่วงเวลา · พบ ${rows.length} ใบ`}
                    action={
                        <Button size="small" type="primary" onClick={() => { setHn(''); setHnInput(''); }}>
                            กลับไปดูคิว
                        </Button>
                    }
                />
            )}

            {/* ดูย้อนหลังอยู่ ใบใหม่จึงไม่ขึ้นเอง ต้องบอกให้ชัด ไม่ใช่ปล่อยให้เข้าใจว่าคิวว่าง */}
            {!live && !hn && (
                <Alert
                    type="warning"
                    showIcon
                    icon={<PiClockCountdownBold />}
                    title={`กำลังดูข้อมูลย้อนหลัง ใบใหม่จะไม่ขึ้นเอง${missed > 0 ? ` · มีใบเข้ามาใหม่ ${missed} ใบ` : ''}`}
                    action={
                        <Button size="small" type="primary" onClick={() => { setDate(dayjs()); setShift('ทั้งวัน'); }}>
                            กลับมาดูคิววันนี้
                        </Button>
                    }
                />
            )}

            {/*
              เปิดเสียงไว้แต่เบราว์เซอร์ยังไม่อนุญาต ต้องบอกให้ชัด
              ไอคอนลำโพงที่ดูเหมือนเปิดอยู่ทั้งที่ไม่มีเสียง อันตรายกว่าไอคอนที่ปิดอยู่จริง ๆ
            */}
            {sound && !audioReady && (
                <Alert
                    type="warning"
                    showIcon
                    title="เสียงเตือนเปิดอยู่ แต่เบราว์เซอร์ยังไม่อนุญาตให้เล่น"
                    description="คลิกที่ใดก็ได้ในหน้านี้หนึ่งครั้งเพื่อเริ่มใช้เสียง (ข้อกำหนดของเบราว์เซอร์ ไม่ใช่ของระบบ)"
                    action={
                        <Button
                            size="small"
                            type="primary"
                            onClick={async () => {
                                if (await armSound()) beeper.current.chime('routine');
                                else message.warning('เบราว์เซอร์นี้ยังไม่ยอมให้เล่นเสียง');
                            }}
                        >
                            เริ่มใช้เสียง
                        </Button>
                    }
                />
            )}

            <Modal
                open={introOpen}
                onCancel={closeIntro}
                title={
                    <span className="inline-flex items-center gap-2">
                        <PiMagnifyingGlassBold className="text-(--brand-text)" />
                        ตรวจ HN กับภาพต้นฉบับทุกครั้งก่อนคีย์
                    </span>
                }
                footer={<Button type="primary" onClick={closeIntro}>เข้าใจแล้ว</Button>}
                width={520}
            >
                <ul className="list-none p-0 m-0 mt-3 flex flex-col gap-3 text-sm">
                    <li className="flex gap-3">
                        <PiBroadcastBold className="text-lg shrink-0 mt-0.5 text-(--brand-text)" />
                        <span>ใบใหม่ขึ้นเองทันทีเมื่อหอกดส่ง ไม่ต้องกดรีเฟรช</span>
                    </li>
                    <li className="flex gap-3">
                        <PiHandGrabbingBold className="text-lg shrink-0 mt-0.5 text-(--brand-text)" />
                        <span>กด <b>“รับ”</b> เพื่อจองงาน เครื่องอื่นจะเห็นว่าใบนี้มีคนรับแล้ว</span>
                    </li>
                    <li className="flex gap-3">
                        <PiShieldCheckBold className="text-lg shrink-0 mt-0.5 text-(--brand-text)" />
                        <span>การเปิดดูไฟล์ทุกครั้งถูกบันทึกไว้ตามข้อกำหนดข้อมูลผู้ป่วย</span>
                    </li>
                </ul>
                <p className="text-xs text-gray-500 mt-4 mb-0">
                    เปิดดูอีกครั้งได้ที่ปุ่ม <PiQuestionBold className="inline -mt-0.5" /> ข้างปุ่มรีเฟรช
                </p>
            </Modal>

            {view === 'board' ? (
                <RxBoard
                    columns={boardColumns}
                    cardKey={r => r.rx_order_id}
                    renderCard={r => {
                        const stale = r.status === 'submitted' && r.waiting_seconds > STALE_SECONDS[r.priority];
                        const waiting = r.status === 'submitted' || r.status === 'acknowledged'
                            || r.status === 'completed';
                        const next = r.status === 'submitted' ? { path: 'ack' as const, label: 'รับใบนี้' }
                            : r.status === 'acknowledged' ? { path: 'complete' as const, label: 'คีย์ลง HIS เสร็จ' }
                                : r.status === 'completed' ? { path: 'prepare' as const, label: 'จัดยาเสร็จ' }
                                    /* กดแล้วการ์ดหายจากกระดาน เพราะใบจบแล้ว ไม่ใช่งานที่ค้างอีกต่อไป */
                                    : r.status === 'prepared' ? { path: 'pickup' as const, label: 'ตึกมารับแล้ว' }
                                        : r.status === 'rejected' ? { path: 'close' as const, label: 'ปิดเรื่อง' }
                                            : null;
                        return (
                            <BoardCard accent={PRIORITY[r.priority].dot} onClick={() => openOrder(r)}>
                                <div className="flex items-center gap-1.5 text-xs">
                                    <PriorityDot color={PRIORITY[r.priority].dot} />
                                    <span className={r.priority === 'routine' ? 'text-gray-500' : 'font-semibold'}>
                                        {PRIORITY[r.priority].short}
                                    </span>
                                    <span className="ml-auto tabular-nums text-gray-500">
                                        {dayjs(r.submitted_at).format('HH:mm')}
                                    </span>
                                </div>

                                <div className="font-semibold mt-1 leading-tight">
                                    {r.resend_of && (
                                        <Tag color="purple" className="m-0! mr-1.5 text-[11px] font-semibold">ฉบับแก้</Tag>
                                    )}
                                    {r.patient_name || <span className="text-gray-500 font-normal">ไม่ระบุชื่อ</span>}
                                </div>
                                {r.tube_feed && <TubeFeedTag compact className="mt-1" />}
                                <div className="text-xs text-gray-500 tabular-nums">
                                    HN {r.hn || '-'}{r.an ? ` · AN ${r.an}` : ''}
                                </div>

                                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                    <Tag className="m-0! text-[11px]">{r.ward_name}</Tag>
                                    <Tag className="m-0! text-[11px]">{r.file_count} ไฟล์</Tag>
                                    {!r.his_verified && <Tag color="red" className="m-0! text-[11px]">ยังไม่ยืนยัน HIS</Tag>}
                                    {HN_SOURCE[r.hn_source] && (
                                        <Tag color={HN_SOURCE[r.hn_source].color} className="m-0! text-[11px]">
                                            {HN_SOURCE[r.hn_source].label}
                                        </Tag>
                                    )}
                                </div>

                                {/* เวลารอขึ้นเฉพาะใบที่ยังไม่จบ ใบที่จบแล้วตัวเลขนี้ไม่มีความหมาย */}
                                {waiting && (
                                    <div className={`text-xs mt-1.5 ${stale ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                                        {stale && <PiWarningBold className="inline mr-0.5" />}
                                        รอ {Math.floor(r.waiting_seconds / 60)} นาที
                                    </div>
                                )}

                                {r.status === 'rejected' && r.reject_reason && (
                                    <div className="text-xs text-red-500 mt-1.5 line-clamp-2">
                                        {r.reject_reason}
                                    </div>
                                )}

                                {/* ปุ่มบนการ์ดไม่ควรเปิดหน้าต่างดูใบไปด้วย จึงกันคลิกไม่ให้ไหลขึ้นไปถึงการ์ด */}
                                <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
                                    {next && (
                                        <Button
                                            size="small" type="primary" className="flex-1"
                                            loading={cardBusy === r.rx_order_id}
                                            onClick={() => quickAct(r, next.path)}
                                        >
                                            {next.label}
                                        </Button>
                                    )}
                                    <Button size="small" className={next ? '' : 'flex-1'} onClick={() => openOrder(r)}>
                                        เปิดดู
                                    </Button>
                                </div>
                            </BoardCard>
                        );
                    }}
                />
            ) : (
            <Card size="small">
                <Table
                    rowKey="rx_order_id"
                    columns={columns}
                    dataSource={shown}
                    loading={loading}
                    size="middle"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    onChange={(_p, _f, sorter) => {
                        /* เรียงได้ทีละช่อง ตัวที่ส่งกลับมาจึงเป็นก้อนเดียว ไม่ใช่รายการ */
                        setTimeSort(Array.isArray(sorter) ? null : sorter.order ?? null);
                    }}
                    /*
                      แถบสีด้านซ้ายแทนการระบายพื้นหลังทั้งแถว
                      พื้นหลังสีอ่อนเต็มแถวทำให้ตัวหนังสือจางลงและนับแถวยากเมื่อมีหลายใบติดกัน
                      ส่วนแถบข้างมองเห็นจากหางตาได้โดยไม่กินความคมของข้อความ
                    */
                    /*
                      แถบซ้าย = ความเร่งด่วน (แดง ส้ม เขียว) ชุดเดียวกับจุดในช่อง "ด่วน"
                      ส่วนสถานะมีป้ายสีของตัวเองอยู่แล้ว ไม่ต้องให้แถบซ้ายพูดซ้ำ
                      ใบที่ปิดงานแล้วไม่มีแถบ ความด่วนของใบที่จบไปแล้วไม่ใช่ข้อมูลที่ต้องรีบอ่าน
                      ยกเว้นใบที่ค้างเกินเวลา ซึ่งแดงทั้งแถบและพื้น เพราะเป็นเรื่องที่ต้องลงมือทันที
                    */
                    rowClassName={r =>
                        r.status === 'submitted' && r.waiting_seconds > STALE_SECONDS[r.priority]
                            ? 'border-l-4 border-l-red-500 bg-red-50/60 dark:bg-[#2a1215]'
                            : r.status !== 'submitted' && r.status !== 'acknowledged' && r.status !== 'completed'
                                ? 'border-l-4 border-l-transparent'
                                : r.priority === 'stat'
                                    ? 'border-l-4 border-l-red-400'
                                    : r.priority === 'discharge'
                                        ? 'border-l-4 border-l-orange-400'
                                        : 'border-l-4 border-l-green-400'
                    }
                    locale={{
                        emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={rows.length > 0
                                ? priorityView !== 'all'
                                    ? `ไม่มีใบระดับ “${PRIORITY[priorityView].label}” ที่สถานะ “${statusView}” ในช่วงที่เลือก`
                                    : `ไม่มีใบที่สถานะ “${statusView}”${hn ? ` ของ HN ${hn}` : ' ในช่วงที่เลือก'}`
                                : hn
                                    ? `ไม่พบใบของ HN ${hn} ${priorities.length > 0 || wards.length > 0
                                        ? '· เครื่องนี้ถูกตั้งให้รับเฉพาะบางใบ ใบของคนนี้อาจอยู่เครื่องอื่น'
                                        : '· ตรวจเลขอีกครั้ง ค้นด้วยเลขท้ายก็ได้'}`
                                    : live
                                    ? (wards.length > 0
                                        ? 'ยังไม่มีใบสั่งยาในตึกที่เลือก'
                                        : 'ยังไม่มีใบสั่งยาในช่วงเวลาที่เลือก')
                                    : 'วันและช่วงเวลาที่เลือกไม่มีใบสั่งยา'} />,
                    }}
                />
            </Card>
            )}

            <Modal
                open={!!open}
                onCancel={() => setOpen(null)}
                footer={null}
                width="95%"
                /* กลางจอ ไม่ใช่ชิดบนตามค่าเริ่มต้นของ antd จอห้องยาเป็นจอใหญ่ตั้งตรงหน้า */
                centered
                destroyOnHidden
                styles={{ body: { height: 'calc(100vh - 170px)', padding: 0 } }}
                title={open && (
                    <div className="flex flex-wrap items-center gap-2 pr-8">
                        {open.priority !== 'routine' && (
                            <Tag color={PRIORITY[open.priority].color} className="m-0! font-bold">
                                {PRIORITY[open.priority].short}
                            </Tag>
                        )}
                        {open.resend_of && <Tag color="purple" className="m-0! font-semibold">ฉบับแก้</Tag>}
                        {open.tube_feed && <TubeFeedTag />}
                        <span className="font-semibold">{open.patient_name || 'ไม่ระบุชื่อ'}</span>
                        <span className="text-xs text-gray-500">HN {open.hn || '-'}{open.an ? ` · AN ${open.an}` : ''}</span>
                        <Tag className="m-0!">{open.ward_name}</Tag>
                        {!open.his_verified && <Tag color="red" className="m-0!">ยังไม่ยืนยันกับ HIS</Tag>}
                    </div>
                )}
            >
                {open && (
                    <div className="flex h-full">
                        {/* ซ้าย: ภาพเอกสาร */}
                        <RxFileViewer
                            orderId={open.rx_order_id}
                            files={files}
                            className="flex-1 min-w-0"
                        />

                        {/* ขวา: ข้อมูลและปุ่มดำเนินการ */}
                        <div className="w-80 shrink-0 border-l border-gray-200 flex flex-col">
                            <div className="p-3 flex flex-col gap-3 overflow-auto flex-1">
                                <div>
                                    <Text className="text-xs text-gray-500">ส่งโดย</Text>
                                    <div className="text-sm">{open.submitted_by_name}</div>
                                    <div className="text-xs text-gray-500">
                                        {dayjs(open.submitted_at).format('D MMM BBBB HH:mm')} น.
                                    </div>
                                </div>

                                {/* บอกว่าใบก่อนหน้าถูกตีกลับเพราะอะไร จะได้ตรวจจุดนั้นก่อนเป็นอันดับแรก */}
                                {open.resend_of && (
                                    <Alert
                                        type="info" showIcon
                                        title="ใบนี้คือฉบับแก้ที่หอส่งมาใหม่"
                                        description={
                                            <span>
                                                ใบเดิมถูกส่งกลับ{detail?.prev_rejected_at ? ` เมื่อ ${detail.prev_rejected_at}` : ''}
                                                {detail?.prev_reject_reason
                                                    ? <> เพราะ <b>{detail.prev_reject_reason}</b></>
                                                    : ''} · ใบเดิมปิดเรื่องไปแล้ว ไม่ต้องจ่ายซ้ำ
                                            </span>
                                        }
                                    />
                                )}

                                {open.tube_feed && (
                                    <Alert
                                        type="info" showIcon
                                        title="ผู้ป่วยได้รับอาหารทางสายยาง"
                                        description="เตรียมยาให้ใช้ทางสายได้ · ยาเม็ดเคลือบหรือออกฤทธิ์นานบดไม่ได้ ต้องเปลี่ยนรูปแบบยา"
                                    />
                                )}

                                {open.note && (
                                    <Alert type="warning" showIcon title="หมายเหตุจากหอผู้ป่วย" description={open.note} />
                                )}

                                {!open.his_verified && (
                                    <Alert
                                        type="error" showIcon
                                        title="HN นี้ยังไม่ได้ยืนยันกับ HIS"
                                        description="ตอนที่หอส่งใบ ระบบค้น HN นี้ใน HIS ไม่พบ หรือติดต่อ HIS ไม่ได้ กรุณาตรวจเลขกับภาพต้นฉบับก่อนคีย์"
                                    />
                                )}

                                <div>
                                    <Text className="text-xs text-gray-500 block mb-1">ประวัติการดำเนินการ</Text>
                                    <div className="flex flex-col gap-1">
                                        {events.map((e, i) => (
                                            <div key={i} className="text-xs flex gap-2">
                                                <span className="text-gray-500 shrink-0">{e.at}</span>
                                                <span>{ACTION_LABEL[e.action] ?? e.action}</span>
                                                <span className="text-gray-500 truncate">{e.actor_name}</span>
                                            </div>
                                        ))}
                                        {events.length === 0 && <Text className="text-xs text-gray-500">กำลังโหลด...</Text>}
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 border-t border-gray-200 flex flex-col gap-2">
                                {rejecting ? (
                                    <>
                                        <TextArea
                                            rows={3} value={reason} onChange={e => setReason(e.target.value)}
                                            placeholder="เหตุผลที่ส่งกลับ เช่น ภาพไม่ชัด / ไม่มีลายเซ็นแพทย์"
                                            maxLength={300}
                                        />
                                        <div className="flex gap-2">
                                            <Button onClick={() => { setRejecting(false); setReason(''); }} className="flex-1">
                                                ยกเลิก
                                            </Button>
                                            <Button danger type="primary" loading={busy} className="flex-1"
                                                disabled={reason.trim().length < 3}
                                                onClick={() => act('reject', { reason: reason.trim() })}>
                                                ยืนยันส่งกลับ
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {open.status === 'submitted' && (
                                            <Button type="primary" size="large" icon={<PiHandGrabbingBold />}
                                                loading={busy} onClick={() => act('ack')}>
                                                รับใบนี้
                                            </Button>
                                        )}
                                        {open.status === 'acknowledged' && (
                                            <Button type="primary" size="large" icon={<PiCheckCircleBold />}
                                                loading={busy} onClick={() => act('complete')}
                                                style={{ background: '#15803d' }}>
                                                คีย์ลง HIS เรียบร้อย
                                            </Button>
                                        )}
                                        {/*
                                          ปุ่มนี้คือสิ่งที่หอรออยู่ กดแล้วหอเห็นทันทีว่าเดินมารับยาได้
                                          กดได้ตั้งแต่ยังไม่คีย์ เพราะบางใบจัดยาก่อนแล้วค่อยคีย์
                                          แต่ตอนยังไม่คีย์ให้เป็นปุ่มรอง ลำดับปกติคือคีย์ก่อน
                                        */}
                                        {(open.status === 'acknowledged' || open.status === 'completed') && (
                                            <Button
                                                type={open.status === 'completed' ? 'primary' : 'default'}
                                                size="large" icon={<PiPackageBold />}
                                                loading={busy} onClick={() => act('prepare')}
                                                style={open.status === 'completed' ? { background: '#15803d' } : undefined}
                                            >
                                                จัดยาเสร็จ พร้อมให้มารับ
                                            </Button>
                                        )}
                                        {(open.status === 'submitted' || open.status === 'acknowledged') && (
                                            <Button danger icon={<PiArrowUUpLeftBold />} onClick={() => setRejecting(true)}>
                                                ส่งกลับให้หอแก้
                                            </Button>
                                        )}
                                        {/* ขั้นสุดท้าย กดแล้วใบออกจากคิวทั้งของห้องยาและของหอ */}
                                        {open.status === 'prepared' && (
                                            <Button type="primary" size="large" icon={<PiHandGrabbingBold />}
                                                loading={busy} onClick={() => act('pickup')}>
                                                ตึกมารับยาแล้ว
                                            </Button>
                                        )}
                                        {open.status === 'rejected' && (
                                            <Button icon={<PiCheckCircleBold />} loading={busy} onClick={() => act('close')}>
                                                ปิดเรื่องนี้
                                            </Button>
                                        )}
                                        {(open.status === 'picked_up' || open.status === 'closed') && (
                                            <Tag color={STATUS[open.status].color} className="text-center py-1 m-0!">
                                                {STATUS[open.status].label}
                                            </Tag>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
