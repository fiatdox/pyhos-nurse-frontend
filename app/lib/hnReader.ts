'use client';

/**
 * อ่านเลข HN จากไฟล์ที่พยาบาลแนบ
 *
 * ทำงานสามชั้น เรียงตามความน่าเชื่อถือ ไม่ใช่ตามความง่าย
 *   1. ชั้นข้อความใน PDF — ได้ตัวเลขตรงจากไฟล์ ไม่มีการเดารูปตัวอักษร
 *   2. บาร์โค้ด — ถอดได้หรือถอดไม่ได้ไปเลย ไม่มีผลลัพธ์ที่ "ใกล้เคียงแต่ผิด"
 *   3. OCR — ตัวสุดท้าย ส่งภาพไปให้เซิร์ฟเวอร์อ่าน เป็นชั้นเดียวที่มีโอกาสอ่านผิดทั้งที่ดูเหมือนถูก
 *
 * สองชั้นแรกทำในเบราว์เซอร์เพราะมีภาพอยู่ในมือแล้ว ส่วน OCR อยู่ที่เซิร์ฟเวอร์
 * เพื่อไม่ต้องเอาโมเดลขนาดเกือบ 9 MB ไปวางให้ทุกเครื่องโหลดก่อนใช้งาน
 *
 * ทุกชั้นได้แค่ "ข้อเสนอ" คนที่ถือกระดาษต้นฉบับเป็นคนยืนยันเสมอ
 */

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import {
    BinaryBitmap, DecodeHintType, HTMLCanvasElementLuminanceSource, HybridBinarizer, MultiFormatReader,
} from '@zxing/library';

/* ไฟล์ worker ถูกรวมเข้า build ไม่ได้ดึงจาก CDN เครือข่ายโรงพยาบาลออกอินเทอร์เน็ตไม่ได้ */
GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

export type HnSource = 'pdf_text' | 'barcode' | 'ocr';

export interface HnReadInput {
    /** เลขที่อ่านได้เองในเบราว์เซอร์ ว่าง = ต้องให้เซิร์ฟเวอร์ทำ OCR */
    candidates: string[];
    source: HnSource | null;
    /** ภาพสำหรับส่งไปทำ OCR — ไม่มีเฉพาะตอนอ่านจากชั้นข้อความของ PDF ได้ (เจอบาร์โค้ดก็ยังส่ง เพราะบาร์โค้ดอาจไม่ใช่ HN) */
    image: Blob | null;
    /** ภาพเฉพาะบริเวณที่ HN มักอยู่ (แถบล่างสุด + แถบบนสุด เต็มความกว้าง ต่อกันเป็นภาพเดียว) เซิร์ฟเวอร์อ่านส่วนนี้ก่อน */
    roi: Blob | null;
}

/**
 * บริเวณที่ HN มักอยู่บนใบ order ของที่นี่: แถบล่างสุดของใบ (ล่าง 15% ≈ 4.5 ซม.) และแถบบนสุด (บน 20% ≈ 6 ซม.) เต็มความกว้าง
 * เต็มความกว้างเพื่อให้ใบที่ HN อยู่ซ้าย/กลาง/ขวาก็อ่านเจอในรอบแรก ไม่ต้องถอยไปอ่านทั้งหน้า
 * ตัดสองแถบมาต่อกันเป็นภาพเดียว (แถบล่างไว้บน เพราะ HN อยู่ล่างบ่อยกว่า OCR อ่านจากบนลงล่าง เลขจากแถบล่างจึงได้ที่นั่งก่อน)
 * คั่นด้วยแถบขาว ไม่ให้ OCR ต่อบรรทัดของสองแถบเข้าด้วยกัน
 * ไม่อ่านส่วนกลางใบ (65%) ในรอบแรก จึงไม่ติดตัวเลขกลางใบ (วันที่/เวลาที่เขียนท้ายรายการยา) ใบที่ HN อยู่กลางใบไม่ได้อ่านพลาด แค่ช้าลง เพราะเซิร์ฟเวอร์ถอยไปอ่านทั้งหน้าเอง
 */
const HN_REGIONS = [
    { x: 0, y: 0.85, w: 1, h: 0.15 },   // ล่าง
    { x: 0, y: 0, w: 1, h: 0.2 },       // บน (≈ 6 ซม. ของ A4 หัวใบบางแบบ HN อยู่ลึกกว่าแถบล่าง)
];

/** ตัวเลขเล็กเกินไป OCR อ่านพลาดง่าย ขยายภาพที่ตัดให้ด้านกว้างอย่างน้อยเท่านี้ */
const ROI_MIN_WIDTH = 1800;

const cropHnRegion = (src: HTMLCanvasElement): HTMLCanvasElement => {
    const sw = src.width;
    const up = Math.min(2, Math.max(1, ROI_MIN_WIDTH / sw));
    const gap = Math.round(40 * up);
    const parts = HN_REGIONS.map(r => ({
        sx: src.width * r.x, sy: src.height * r.y, sw: src.width * r.w, sh: src.height * r.h,
    }));
    const height = parts.reduce((t, p) => t + p.sh * up, 0) + gap * (parts.length - 1);
    const out = canvasOf(sw * up, height);
    const ctx = out.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.imageSmoothingQuality = 'high';
        let y = 0;
        for (const p of parts) {
            ctx.drawImage(src, p.sx, p.sy, p.sw, p.sh, 0, y, p.sw * up, p.sh * up);
            y += p.sh * up + gap;
        }
    }
    return out;
};

/**
 * ด้านยาวสุดของภาพที่ส่งไปอ่าน
 * สแกน A4 ที่ 300 dpi สูงราว 3500 px ย่อลงมาเท่านี้ยังเหลือความละเอียดพอให้อ่านเลขตัวเล็ก
 * แต่ไฟล์เล็กลงเกินครึ่ง ส่งผ่าน LAN ของโรงพยาบาลได้ไว
 */
const MAX_SIDE = 3000;

const digitRuns = (text: string): string[] =>
    [...text.matchAll(/\d{4,14}/g)].map(m => m[0]);

const canvasOf = (w: number, h: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w));
    canvas.height = Math.max(1, Math.round(h));
    return canvas;
};

/** ย่อให้ด้านยาวสุดไม่เกินที่กำหนด ภาพที่เล็กกว่านั้นอยู่แล้วไม่ต้องแตะ ขยายขึ้นไม่ช่วยให้อ่านดีขึ้น */
const scaleFor = (w: number, h: number, maxSide = MAX_SIDE) => Math.min(1, maxSide / Math.max(w, h));

/** ย่อจากผืนที่วาดไว้แล้ว ไม่ต้องสั่ง pdf.js วาดหน้าเดิมซ้ำอีกรอบเพื่อทำภาพเล็ก */
const shrink = (src: HTMLCanvasElement, maxSide: number): string => {
    const s = scaleFor(src.width, src.height, maxSide);
    const small = canvasOf(src.width * s, src.height * s);
    small.getContext('2d')?.drawImage(src, 0, 0, small.width, small.height);
    return small.toDataURL('image/jpeg', 0.75);
};

const imageToCanvas = async (file: File, maxSide = MAX_SIDE): Promise<HTMLCanvasElement> => {
    const bitmap = await createImageBitmap(file);
    const s = scaleFor(bitmap.width, bitmap.height, maxSide);
    const canvas = canvasOf(bitmap.width * s, bitmap.height * s);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
};

/**
 * หน้าแรกของ PDF
 * คืนชั้นข้อความมาด้วย ถ้า PDF มาจากระบบที่พิมพ์เป็นไฟล์ตรง ๆ จะได้เลขที่ถูกต้องแน่นอน
 * สแกนเนอร์ที่โรงพยาบาลใช้ให้ PDF ที่ข้างในเป็นภาพล้วน ชั้นนี้จึงมักว่าง
 */
const pdfFirstPage = async (file: File, maxSide = MAX_SIDE): Promise<{ text: string; canvas: HTMLCanvasElement }> => {
    const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await task.promise;
    try {
        const page = await pdf.getPage(1);
        const content = await page.getTextContent();
        const text = content.items
            .map(it => ('str' in it ? it.str : ''))
            .join(' ');

        /*
          หน่วยของ PDF เป็นพอยต์ A4 จึงกว้างแค่ 595 ต้องขยายขึ้นให้ได้ความละเอียดพอจะอ่าน
          ไม่ใช่ย่อลงเหมือนภาพถ่าย จึงไม่ได้ใช้ scaleFor ที่นี่
        */
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: maxSide / Math.max(base.width, base.height) });
        const canvas = canvasOf(viewport.width, viewport.height);
        const ctx = canvas.getContext('2d');
        if (ctx) await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        return { text, canvas };
    } finally {
        /* คืน worker ของ pdf.js ทันที ไม่ปล่อยค้างไว้ต่อหนึ่งไฟล์ที่แนบ */
        void task.destroy();
    }
};

/** ถอดบาร์โค้ดจากภาพบนผืนผ้าใบ ไม่เจอถือว่าไม่มี ไม่ใช่ข้อผิดพลาด */
const readBarcode = (canvas: HTMLCanvasElement): string[] => {
    /*
      @zxing/library 0.23 พิมพ์ console.warn "MultiFormatReader: non-ReaderException from reader: NotFoundException"
      ทุกครั้งที่ตัวอ่านแต่ละแบบหาบาร์โค้ดไม่เจอ (NotFoundException ของมันเองไม่ผ่าน instanceof ReaderException)
      ไม่ใช่ข้อผิดพลาด แต่ Next dev ส่งต่อไปขึ้นใน terminal ทุกไฟล์ที่แนบ จนกลบข้อความที่สำคัญจริง
      จึงกรองเฉพาะข้อความนี้ระหว่างถอดบาร์โค้ด (decode ทำงานแบบ synchronous คืนค่าเดิมทันทีใน finally)
    */
    const warn = console.warn;
    console.warn = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].startsWith('MultiFormatReader: non-ReaderException')) return;
        warn(...args);
    };
    try {
        const bitmap = new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(canvas)));
        /* ค้นให้ละเอียดขึ้น ยอมช้าได้ บาร์โค้ดบนใบสแกนมักเอียงและอยู่มุมใดมุมหนึ่งของหน้า */
        const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]]);
        return digitRuns(new MultiFormatReader().decode(bitmap, hints).getText());
    } catch {
        // ไม่เจอบาร์โค้ดเป็นเรื่องปกติ ใบที่สแกนมาส่วนใหญ่ไม่มี ไม่ใช่ข้อผิดพลาด
        return [];
    } finally {
        console.warn = warn;
    }
};

export const prepareHnRead = async (file: File): Promise<HnReadInput> => {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const { text, canvas } = isPdf
        ? await pdfFirstPage(file)
        : { text: '', canvas: await imageToCanvas(file) };

    const fromText = digitRuns(text);
    if (fromText.length > 0) return { candidates: fromText, source: 'pdf_text', image: null, roi: null };

    const toJpeg = (c: HTMLCanvasElement) => new Promise<Blob | null>(resolve =>
        c.toBlob(b => resolve(b), 'image/jpeg', 0.85));
    const [blob, roi] = await Promise.all([toJpeg(canvas), toJpeg(cropHnRegion(canvas))]);

    /*
      เจอบาร์โค้ดแล้วยังส่งภาพไปด้วย ไม่หยุดตรงนี้
      บาร์โค้ดบนใบหลายแบบไม่ใช่ HN (เช่นเลขใบสั่ง 12 หลักเหนือชื่อผู้ป่วย) ส่วน HN พิมพ์ไว้อีกที่เป็น "HN 000XXXXXX"
      เซิร์ฟเวอร์เช็กเลขบาร์โค้ดกับ HIS ก่อน ถ้าเป็นผู้ป่วยหอนี้ก็ไม่อ่านภาพ ไม่ใช่ค่อยอ่านแถบ HN ต่อ
    */
    const fromBarcode = readBarcode(canvas);
    if (fromBarcode.length > 0) return { candidates: fromBarcode, source: 'barcode', image: blob, roi };

    return { candidates: [], source: null, image: blob, roi };
};

/**
 * ภาพตัวอย่างของไฟล์ที่แนบ
 *
 * ทำจากหน้าแรกเสมอ ทั้งภาพถ่ายและ PDF จึงเห็นเหมือนกันว่าแนบอะไรไป
 * ใช้ pdf.js ตัวเดียวกับที่ใช้อ่าน HN อยู่แล้ว ไม่ได้เพิ่มไลบรารีเพื่อการนี้
 *
 * คืนเป็น data URL ไม่ใช่ object URL เพราะภาพย่อขนาดนี้เล็กมาก
 * และไม่ต้องมีใครคอยคืนหน่วยความจำให้ถูกจังหวะ
 */
export const fileThumbnail = async (file: File, maxSide = 560): Promise<string> => {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const canvas = isPdf
        ? (await pdfFirstPage(file, maxSide)).canvas
        : await imageToCanvas(file, maxSide);
    return canvas.toDataURL('image/jpeg', 0.75);
};

/** หนึ่งหน้าของ PDF ที่แปลงเป็นภาพแล้ว */
export interface PageImage {
    /** ลำดับหน้า เริ่มที่ 1 */
    page: number;
    /** จำนวนหน้าทั้งหมดของไฟล์ */
    pages: number;
    /** ภาพของหน้านี้ ใช้ส่งเป็นไฟล์แนบแทนหน้านั้น */
    blob: Blob;
    /** ภาพย่อไว้แสดงในรายการ */
    thumb: string;
    /** ชั้นข้อความของหน้านี้ ถ้ามี จะได้เลข HN ที่ไม่ต้องเดาจากรูปตัวอักษร */
    text: string;
}

/**
 * แยก PDF หลายหน้าออกเป็นภาพรายหน้า
 *
 * ทำแบบนี้เพราะใบสั่งยาที่สแกนรวมมาในไฟล์เดียวมักเป็นคนละผู้ป่วยกันคนละหน้า
 * ถ้าส่งทั้งไฟล์ไปกับใบของผู้ป่วยคนแรก ห้องยาจะเห็นข้อมูลของคนอื่นติดไปด้วย
 * และตรวจย้อนหลังไม่ได้ว่าหน้าไหนเป็นของใคร
 *
 * ผลที่ได้เป็นภาพ ไม่ใช่ PDF ที่ถูกตัดหน้า เพราะการตัดหน้าจริงต้องใช้ไลบรารีเขียน PDF อีกตัว
 * ส่วนใบที่สแกนมานั้นข้างในเป็นภาพอยู่แล้ว การแปลงเป็นภาพจึงไม่ได้เสียอะไรไป
 */
export const splitPages = async (file: File, maxSide = MAX_SIDE): Promise<PageImage[]> => {
    const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const pdf = await task.promise;
    try {
        const out: PageImage[] = [];
        /* ทำทีละหน้าตามลำดับ ไม่ทำพร้อมกัน ผืนผ้าใบขนาด 3000 px กินหน่วยความจำหน้าละหลายสิบ MB */
        for (let n = 1; n <= pdf.numPages; n++) {
            const page = await pdf.getPage(n);
            const content = await page.getTextContent();
            const text = content.items.map(it => ('str' in it ? it.str : '')).join(' ');

            const base = page.getViewport({ scale: 1 });
            const viewport = page.getViewport({ scale: maxSide / Math.max(base.width, base.height) });
            const canvas = canvasOf(viewport.width, viewport.height);
            const ctx = canvas.getContext('2d');
            if (ctx) await page.render({ canvas, canvasContext: ctx, viewport }).promise;

            const blob = await new Promise<Blob | null>(resolve =>
                canvas.toBlob(b => resolve(b), 'image/jpeg', 0.85));
            if (!blob) continue;

            out.push({ page: n, pages: pdf.numPages, blob, thumb: shrink(canvas, 560), text });
        }
        return out;
    } finally {
        void task.destroy();
    }
};

/** นับจำนวนหน้าอย่างเดียว ไม่ต้องวาดภาพ ใช้ตอนอยากรู้ก่อนว่าจะแตกเป็นกี่รายการ */
export const countPdfPages = async (file: File): Promise<number> => {
    const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
        return (await task.promise).numPages;
    } finally {
        void task.destroy();
    }
};
