/**
 * แปลงผลแล็บที่ HIS เก็บเป็น RTF (lab_head.result_rtf) ให้เหลือข้อความธรรมดา
 *
 * ตัวเดิมข้าม \'xx ทิ้งทั้งหมด แต่ RTF เก็บอักษรไทยเป็น \'xx ตามโค้ดเพจ 874
 * ข้อความภาษาไทยในผลจึงหายไปเงียบ ๆ ตัวนี้ถอดรหัสตาม \ansicpgNNN ของเอกสาร
 * และรองรับ \uN (ยูนิโค้ด) ซึ่งตามด้วยอักษรสำรองที่ต้องข้ามตามค่า \ucN
 *
 * ข้อความที่ไม่ได้ขึ้นต้นด้วย {\rtf ถือว่าเป็นข้อความธรรมดาอยู่แล้ว คืนตามเดิม
 */

/** กลุ่มที่เป็นข้อมูลประกอบเอกสาร ไม่ใช่เนื้อหา */
const SKIP_DESTINATIONS = new Set([
    'fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer',
    'headerl', 'headerr', 'footerl', 'footerr', 'listtable', 'listoverridetable', 'rsidtbl', 'generator',
]);

const decoderFor = (codepage: number): TextDecoder => {
    try {
        return new TextDecoder(`windows-${codepage}`);
    } catch {
        return new TextDecoder('windows-874');
    }
};

export function rtfToText(input: string | null | undefined): string {
    if (!input) return '';
    if (!/^\s*\{\\rtf/.test(input)) return decodeEntities(input.replace(/\r\n?/g, '\n').trim());

    let decoder = decoderFor(874);
    let out = '';
    let bytes: number[] = [];
    const flush = () => {
        if (bytes.length) { out += decoder.decode(new Uint8Array(bytes)); bytes = []; }
    };
    const emit = (s: string, skip: boolean) => {
        if (skip) return;
        flush();
        out += s;
    };

    /* แต่ละกลุ่ม { } จำว่าข้ามเนื้อหาไหม และ \uc ของกลุ่มนั้น */
    const stack: { skip: boolean; uc: number }[] = [];
    let skip = false;
    let uc = 1;
    /* จำนวนอักษรสำรองที่ต้องข้ามหลัง \uN */
    let pendingSkip = 0;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];

        if (ch === '{') {
            stack.push({ skip, uc });
            pendingSkip = 0;
            continue;
        }
        if (ch === '}') {
            const prev = stack.pop();
            if (prev) { skip = prev.skip; uc = prev.uc; }
            pendingSkip = 0;
            continue;
        }
        if (ch === '\r' || ch === '\n') continue; // ขึ้นบรรทัดในซอร์ส RTF ไม่ใช่เนื้อหา

        if (ch !== '\\') {
            if (pendingSkip > 0) { pendingSkip--; continue; }
            emit(ch, skip);
            continue;
        }

        // เครื่องหมายควบคุม
        const next = input[i + 1];
        if (next === undefined) break;

        if (next === '\'') {
            const hex = input.substr(i + 2, 2);
            i += 3;
            if (pendingSkip > 0) { pendingSkip--; continue; }
            if (!skip && /^[0-9a-f]{2}$/i.test(hex)) bytes.push(parseInt(hex, 16));
            continue;
        }
        if (next === '*') { skip = true; i++; continue; }
        if (!/[a-z]/i.test(next)) {
            i++;
            if (pendingSkip > 0) { pendingSkip--; continue; }
            if (next === '\\' || next === '{' || next === '}') emit(next, skip);
            else if (next === '~') emit(' ', skip);
            else if (next === '_') emit('-', skip);
            // \- (ตัดคำได้) และอื่น ๆ ไม่มีผลต่อข้อความ
            continue;
        }

        // คำควบคุม: \word[-N] ตามด้วยช่องว่างหนึ่งตัวได้
        const m = /^([a-z]+)(-?\d+)?( ?)/i.exec(input.slice(i + 1, i + 40));
        if (!m) continue;
        i += m[0].length;
        const word = m[1];
        const arg = m[2] !== undefined ? Number(m[2]) : null;

        if (SKIP_DESTINATIONS.has(word)) { skip = true; continue; }
        switch (word) {
            case 'ansicpg': if (arg) { flush(); decoder = decoderFor(arg); } break;
            case 'uc': uc = arg ?? 1; break;
            case 'u':
                if (arg !== null) {
                    emit(String.fromCharCode(arg < 0 ? arg + 65536 : arg), skip);
                    pendingSkip = uc;
                }
                break;
            case 'par': case 'line': case 'row': case 'page': case 'sect': emit('\n', skip); break;
            case 'tab': case 'cell': emit('\t', skip); break;
            case 'emdash': emit('—', skip); break;
            case 'endash': emit('–', skip); break;
            case 'bullet': emit('•', skip); break;
            case 'lquote': emit('‘', skip); break;
            case 'rquote': emit('’', skip); break;
            case 'ldblquote': emit('“', skip); break;
            case 'rdblquote': emit('”', skip); break;
        }
    }
    flush();

    return decodeEntities(out
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim());
}

/* ตัวเดิมแปลง entity เผื่อผลบางรายการถูกเก็บแบบเข้ารหัส HTML มา คงไว้เหมือนเดิม */
const decodeEntities = (s: string) =>
    s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
