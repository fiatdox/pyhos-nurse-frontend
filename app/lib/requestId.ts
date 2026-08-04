/**
 * กุญแจกันส่งซ้ำ — หนึ่งใบต่อการกรอกหนึ่งครั้ง
 *
 * ส่งไปกับ payload แล้วเปลี่ยนใบใหม่เมื่อบันทึกสำเร็จ ฝั่ง server มี unique index
 * บนคอลัมน์นี้ ส่ง payload เดิมซ้ำกี่รอบ (กดรัว เน็ตค้างแล้ว retry กด back แล้วส่งใหม่)
 * ก็ได้ข้อมูลแถวเดียว
 *
 * crypto.randomUUID มีเฉพาะ secure context (https / localhost) จึงต้องมีทางสำรอง
 */
export const newRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
