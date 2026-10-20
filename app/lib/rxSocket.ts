'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * การแจ้งเตือนแบบทันทีของระบบใบสั่งยา
 *
 * ใช้ WebSocket ของเบราว์เซอร์ตรง ๆ คู่กับ .ws() ที่มากับ Elysia
 * ไม่ได้ใช้ไลบรารีเพิ่ม สิ่งเดียวที่ต้องเขียนเองคือการต่อใหม่เมื่อสายหลุด
 * ซึ่งอยู่ในไฟล์นี้ทั้งหมดแล้ว
 *
 * **สัญญาณที่ได้รับเป็นแค่ตัวสะกิด ไม่ใช่ข้อมูล**
 * ทุกครั้งที่ได้สัญญาณหรือเพิ่งต่อติด ต้องไปดึงรายการจริงผ่าน REST เสมอ
 * ถ้าเอาค่าจากสัญญาณมาวาดตรง ๆ แล้ววันหนึ่งสัญญาณหายไปหนึ่งใบ
 * (เน็ตสะดุด แท็บถูกพักการทำงาน) หน้าจอจะค้างผิดโดยไม่มีอะไรมาแก้ให้ถูก
 */

export interface RxOrderEvent {
    rx_order_id: string;
    ward: number;
    status: 'submitted' | 'acknowledged' | 'completed' | 'prepared'
        | 'picked_up' | 'rejected' | 'closed';
    priority: 'routine' | 'discharge' | 'stat';
    by_name: string;
    at: string;
    reason?: string;
}

type Room = { kind: 'pharmacy' } | { kind: 'ward'; ward: number | undefined };

interface Options {
    room: Room;
    /** เรียกเมื่อมีใบใหม่ (ห้องยาเท่านั้นที่สนใจ) */
    onNew?: (e: RxOrderEvent) => void;
    /** เรียกเมื่อสถานะใบเปลี่ยน */
    onStatus?: (e: RxOrderEvent) => void;
    /** เรียกทุกครั้งที่ต่อติด เพื่อให้หน้าจอไปดึงรายการใหม่ ปิดช่องว่างระหว่างที่หลุด */
    onReconnect?: () => void;
}

/** ส่ง ping เองเป็นระยะ ให้ proxy ที่ตัดสายเงียบ ๆ เมื่อไม่มีข้อมูลรู้ว่ายังใช้งานอยู่ */
const PING_MS = 25000;
/** หน่วงก่อนต่อใหม่ เพิ่มขึ้นเรื่อย ๆ ไม่ให้ถล่มเซิร์ฟเวอร์ตอนมันเพิ่งล่ม */
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 15000;

/**
 * ที่อยู่ของ WebSocket
 *
 * ต่อตรงไปที่ backend เมื่อมี NEXT_PUBLIC_API_URL เพราะการอัปเกรดเป็น WebSocket
 * ผ่าน rewrite ของ Next ตอนพัฒนาไม่รับประกันว่าจะผ่าน
 * WebSocket ไม่ติดเรื่อง CORS จึงต่อข้ามพอร์ตได้โดยไม่ต้องตั้งอะไรเพิ่ม
 * บนเครื่องจริงที่มี nginx รวมโดเมนไว้แล้ว ค่านี้ชี้กลับมาโดเมนเดียวกันอยู่ดี
 */
const socketUrl = (): string => {
    const api = process.env.NEXT_PUBLIC_API_URL;
    const base = api && api.startsWith('http')
        ? api
        : (typeof window !== 'undefined' ? window.location.origin : '');
    return base.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws/rx';
};

export const useRxSocket = ({ room, onNew, onStatus, onReconnect }: Options) => {
    const [connected, setConnected] = useState(false);
    /*
      เก็บ callback ไว้ใน ref เพราะหน้าจอสร้างฟังก์ชันใหม่ทุกรอบที่วาด
      ถ้าผูกเข้ากับ useEffect ตรง ๆ จะตัดแล้วต่อใหม่ทุกครั้งที่ state เปลี่ยน
    */
    const cb = useRef({ onNew, onStatus, onReconnect });
    cb.current = { onNew, onStatus, onReconnect };

    const roomKey = room.kind === 'pharmacy' ? 'pharmacy' : `ward:${room.ward ?? ''}`;

    useEffect(() => {
        if (room.kind === 'ward' && !room.ward) return;

        const token = document.cookie.split('; ').find(r => r.startsWith('token='))?.split('=')[1];
        if (!token) return;

        let ws: WebSocket | null = null;
        let ping: ReturnType<typeof setInterval> | null = null;
        let retry: ReturnType<typeof setTimeout> | null = null;
        let delay = RETRY_MIN_MS;
        /* ธงนี้บอกว่าหน้าถูกปิดไปแล้ว จะได้ไม่ต่อใหม่หลังคอมโพเนนต์ถูกถอด */
        let closed = false;

        const connect = () => {
            if (closed) return;
            ws = new WebSocket(socketUrl());

            ws.onopen = () => {
                // ส่ง token เป็นข้อความแรก ไม่ใส่ใน URL เพราะ URL ติดไปกับ log ของ proxy
                ws?.send(JSON.stringify({ type: 'auth', token }));
            };

            ws.onmessage = ev => {
                let msg: { type?: string } & Partial<RxOrderEvent>;
                try { msg = JSON.parse(String(ev.data)); } catch { return; }

                switch (msg.type) {
                    case 'ready':
                        /* ยืนยันตัวตนผ่านแล้วค่อยขอเข้าห้อง เซิร์ฟเวอร์ไม่รับ join ก่อน auth */
                        ws?.send(JSON.stringify(room.kind === 'pharmacy'
                            ? { type: 'join', room: 'pharmacy' }
                            : { type: 'join', room: 'ward', ward: room.ward }));
                        break;
                    case 'joined':
                        setConnected(true);
                        delay = RETRY_MIN_MS;
                        // เข้าห้องแล้วต้องดึงของใหม่ทันที ช่วงที่หลุดไปอาจมีใบเข้ามาโดยไม่มีสัญญาณถึง
                        cb.current.onReconnect?.();
                        break;
                    case 'order:new':
                        cb.current.onNew?.(msg as RxOrderEvent);
                        break;
                    case 'order:status':
                        cb.current.onStatus?.(msg as RxOrderEvent);
                        break;
                    default:
                        break;
                }
            };

            ws.onclose = () => {
                setConnected(false);
                if (closed) return;
                /* ถอยห่างขึ้นเรื่อย ๆ แต่ไม่เกินเพดาน เซิร์ฟเวอร์ที่เพิ่งรีสตาร์ทจะได้ไม่โดนถล่ม */
                retry = setTimeout(connect, delay);
                delay = Math.min(delay * 2, RETRY_MAX_MS);
            };

            // ปล่อยให้ onclose จัดการต่อใหม่ที่เดียว ไม่ต้องแยกเส้นทาง
            ws.onerror = () => { ws?.close(); };
        };

        connect();
        ping = setInterval(() => {
            if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, PING_MS);

        return () => {
            closed = true;
            if (ping) clearInterval(ping);
            if (retry) clearTimeout(retry);
            ws?.close();
        };
        // roomKey ครอบคลุมทั้งชนิดห้องและเลขตึกแล้ว ใช้ตัวเดียวพอ
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomKey]);

    return { connected };
};

/**
 * เสียงเตือน
 *
 * เสียงหลักคือไฟล์ prop.mp3 ใน public เสิร์ฟจากโดเมนเดียวกับหน้าเว็บ
 * ไม่ต้องออกอินเทอร์เน็ต ซึ่งเครือข่ายโรงพยาบาลออกไม่ได้อยู่แล้ว
 *
 * ยังเก็บเสียงสังเคราะห์ไว้เป็นตัวสำรอง เผื่อไฟล์หายหลัง deploy
 * หรือเบราว์เซอร์เล่น mp3 ไม่ได้ เสียงเตือนที่หายไปเงียบ ๆ
 * อันตรายกว่าเสียงที่ผิดแบบ เพราะไม่มีใครรู้ว่ามีใบค้างอยู่
 *
 * เบราว์เซอร์ห้ามเล่นเสียงจนกว่าผู้ใช้จะคลิกอะไรสักอย่างในหน้าก่อน
 * หน้าคิวจึงมีปุ่ม "เปิดเสียงเตือน" ให้กดหนึ่งครั้งตอนเริ่มเวร
 */

/** ไฟล์เสียงแจ้งเตือน — proxy.ts ยกเว้น /assets ไว้แล้ว จึงไม่ถูกเด้งไปหน้าเข้าระบบ */
const SOUND_URL = '/assets/sounds/prop.mp3';

/** ชนิดของเสียง ใช้กับเสียงสำรองเท่านั้น ไฟล์เสียงมีไฟล์เดียวใช้ร่วมกันทุกเหตุการณ์ */
export type Chime = 'routine' | 'stat' | 'reject';

interface Tone {
    /** ความถี่ของแต่ละเสียง (Hz) ไล่ขึ้น = งานเข้า ไล่ลง = ถูกส่งกลับ */
    notes: number[];
    /** ระยะห่างระหว่างเสียง เสียงก่อนยังไม่จบตอนเสียงถัดไปเริ่ม จึงฟังเป็นเสียงเดียวที่ไหลต่อกัน */
    step: number;
    /** หางเสียงแต่ละตัว หน่วยวินาที */
    hold: number;
    /** ความดังสูงสุด 1 = เต็มสเกล เกิน 0.5 เริ่มมีเสียงแตกเมื่อหลายเสียงทับกัน */
    peak: number;
    /** เล่นซ้ำทั้งชุด ใช้กับใบด่วนเท่านั้น */
    repeat?: number;
}

const TONES: Record<Chime, Tone> = {
    /* ใบปกติ: ติ่ง-ดิ่ง-ดิ้ง ไล่ขึ้น E5 G#5 C6 เป็นคอร์ดเมเจอร์ ฟังเป็นเสียงเรียกไม่ใช่เสียงเตือนภัย */
    routine: { notes: [659.25, 830.61, 1046.5], step: 0.2, hold: 1.3, peak: 0.42 },
    /* ใบด่วน: เสียงสูงกว่า ถี่กว่า และซ้ำสองชุด ต่างจากใบปกติชัดเจนตั้งแต่เสียงแรก */
    stat: { notes: [987.77, 1244.5, 1567.98], step: 0.16, hold: 1.1, peak: 0.45, repeat: 2 },
    /* ใบถูกส่งกลับ: ไล่ลง B5 G5 D#5 เสียงตกบอกว่าเป็นเรื่องที่ต้องกลับไปแก้ */
    reject: { notes: [987.77, 783.99, 622.25], step: 0.22, hold: 1.5, peak: 0.45 },
};

export const createBeeper = () => {
    /*
      ห้ามแตะ window หรือ Audio ในตัวฟังก์ชันนี้ หน้าจอเรียกตั้งแต่ตอน render
      ซึ่งรันที่ฝั่งเซิร์ฟเวอร์ด้วย ของพวกนี้จึงต้องสร้างตอนถูกเรียกใช้จริงเท่านั้น
    */
    let ctx: AudioContext | null = null;
    let audio: HTMLAudioElement | null = null;
    /** ไฟล์เสียงใช้ไม่ได้จริง (หาย/เล่นไม่ได้) ตั้งแล้วไม่ลองใหม่ ไม่งั้นจะรอ timeout ทุกครั้งที่มีใบเข้า */
    let fileBroken = false;
    /*
      เบราว์เซอร์ปฏิเสธเพราะยังไม่มีใครแตะหน้าจอ จะคืน NotAllowedError
      ต้องแยกออกจากความผิดพลาดอื่น ไม่งั้นจะไปตัดสินว่าไฟล์เสียแล้วเลิกใช้ถาวร
      ทั้งที่แค่ยังไม่ถึงเวลาที่เล่นได้
    */
    const isBlocked = (err: unknown) => (err as { name?: string } | null)?.name === 'NotAllowedError';

    const ensureAudio = () => {
        if (!audio) {
            audio = new Audio(SOUND_URL);
            audio.preload = 'auto';
            /* โหลดไม่ได้ตั้งแต่ตอนเตรียม จะได้รู้ก่อนถึงเวลาต้องใช้จริง */
            audio.addEventListener('error', () => { fileBroken = true; });
        }
        return audio;
    };

    const ensureCtx = () => {
        if (!ctx) {
            const C = window.AudioContext
                ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!C) return null;
            ctx = new C();
        }
        if (ctx.state === 'suspended') void ctx.resume();
        return ctx;
    };

    /**
     * ปลุกระบบเสียง ต้องเรียกจากในเหตุการณ์คลิกของผู้ใช้
     * เล่นไฟล์แล้วหยุดทันทีในจังหวะที่กดปุ่ม เบราว์เซอร์จะอนุญาตให้เล่นเองได้หลังจากนี้
     * และเตรียม AudioContext ไว้ด้วย เผื่อต้องใช้เสียงสำรอง
     */
    const unlock = async (): Promise<boolean> => {
        const c = ensureCtx();
        if (c) {
            const g = c.createGain();
            g.gain.value = 0;
            g.connect(c.destination);
            const o = c.createOscillator();
            o.connect(g);
            o.start();
            o.stop(c.currentTime + 0.01);
        }

        const a = ensureAudio();
        try {
            await a.play();
            a.pause();
            a.currentTime = 0;
        } catch (err) {
            /* ถูกบล็อกเพราะยังไม่มีใครแตะหน้าจอ ไม่ใช่ไฟล์เสีย ยังลองใหม่ได้ */
            if (!isBlocked(err)) fileBroken = true;
            /* เสียงสำรองยังใช้ได้ถ้า AudioContext ปลุกติด ถือว่าพร้อมบางส่วน */
            return c !== null && c.state === 'running';
        }
        return true;
    };

    /**
     * หนึ่งเสียงของเสียงสำรอง
     *
     * ใช้ triangle ไม่ใช่ sine เพราะมีฮาร์มอนิกมากกว่า จึงทะลุเสียงรบกวน
     * ในห้องยาได้ดีกว่าที่ความดังเท่ากัน และยังไม่บาดหูเหมือน square
     *
     * ความดังไล่แบบ exponential ไม่ใช่ linear เพราะหูคนรับความดังเป็นอัตราส่วน
     * การลดแบบ linear จะฟังเหมือนเสียงถูกตัดหายไปกลางทาง ไม่ใช่เสียงกระดิ่งที่ค่อย ๆ จบ
     */
    const note = (c: AudioContext, freq: number, at: number, hold: number, peak: number) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        o.connect(g);
        g.connect(c.destination);
        /* ห้ามไล่ exponential ไปที่ 0 (ค่าต้องเป็นบวก) ใช้ค่าที่เงียบจนไม่ได้ยินแทน */
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
        /*
          ไล่ลงถึงแค่ 0.8% ของยอดเมื่อครบ hold แล้วค่อยตัดท้าย
          ถ้าไล่ลงไปจนเงียบสนิทในรอบเดียว ช่วงต้นจะดิ่งเร็วมากจนหางที่ได้ยินสั้นกว่าค่า hold หลายเท่า
        */
        g.gain.exponentialRampToValueAtTime(peak * 0.008, at + hold);
        g.gain.exponentialRampToValueAtTime(0.0001, at + hold + 0.08);
        o.start(at);
        o.stop(at + hold + 0.13);
    };

    /** เสียงสำรองเมื่อไฟล์ใช้ไม่ได้ สังเคราะห์เองจึงไม่มีอะไรให้หายหรือโหลดไม่ขึ้น */
    const synth = (kind: Chime) => {
        const c = ensureCtx();
        if (!c) return;
        const t = TONES[kind];
        /* เผื่อเวลาเล็กน้อยก่อนเริ่ม ตั้งเวลาย้อนหลังจะทำให้เสียงแรกขาด */
        const start = c.currentTime + 0.02;
        const span = t.notes.length * t.step + 0.25;
        for (let r = 0; r < (t.repeat ?? 1); r++) {
            t.notes.forEach((f, i) => note(c, f, start + r * span + i * t.step, t.hold, t.peak));
        }
    };

    const chime = (kind: Chime = 'routine') => {
        if (!fileBroken) {
            const a = ensureAudio();
            /*
              เริ่มใหม่จากต้นทุกครั้ง ไม่ปล่อยให้เสียงซ้อนกัน
              ตอนใบเข้ารัว ๆ เสียงที่ทับกันหลายชั้นจะกลายเป็นเสียงกวนจนแยกไม่ออกว่ามีใบเข้า
            */
            try { a.currentTime = 0; } catch { /* ยังโหลดไม่เสร็จ เล่นต่อจากตำแหน่งเดิมได้ */ }
            void a.play()
                .catch(err => {
                    /*
                      ถูกบล็อกเพราะยังไม่มีใครแตะหน้าจอ ไม่ใช่ไฟล์เสีย
                      ห้ามตั้ง fileBroken ไม่งั้นพอผู้ใช้แตะหน้าจอแล้วจะยังใช้เสียงสำรองตลอดไป
                    */
                    if (!isBlocked(err)) fileBroken = true;
                    synth(kind);
                });
            return;
        }
        synth(kind);
    };

    return { unlock, chime };
};
