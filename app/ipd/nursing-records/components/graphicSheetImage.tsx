'use client';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Dayjs } from 'dayjs';
import { SheetSvg, type Sheet, type Patient } from './GraphicSheet';

/**
 * วาดฟอร์มปรอทหนึ่งใบ (7 วัน) เป็นภาพ PNG — ใช้ใส่ใน PDF สรุปเวชระเบียน (react-pdf วาด SVG ของ DOM ไม่ได้)
 *
 * ใช้ตัววาดตัวเดียวกับหน้าจอ (SheetSvg) ใบใน PDF จึงตรงกับที่เห็นบนจอทุกเส้น
 * SVG ที่แปลงเป็นภาพโหลดฟอนต์ของหน้าเว็บไม่ได้ จึงฝังฟอนต์ Sarabun (base64) ไว้ในตัว SVG เอง
 * วาดที่ความละเอียด 3 เท่าของ viewBox (กว้าง 3000 px) พิมพ์ A4 แล้วตัวเลขเล็ก ๆ ยังคม
 */

let fontCss: Promise<string> | null = null;
const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
/** @font-face ของ Sarabun ปกติ/หนา แบบฝังในตัว (โหลดครั้งเดียว ใช้ซ้ำทุกใบ) */
const sarabunCss = () => {
  fontCss ??= Promise.all(['Regular', 'Bold'].map(async w => {
    const res = await fetch(`/fonts/Sarabun/Sarabun-${w}.ttf`);
    return toBase64(await res.arrayBuffer());
  })).then(([reg, bold]) =>
    `@font-face{font-family:'SarabunEmbed';font-weight:400;src:url(data:font/ttf;base64,${reg}) format('truetype');}`
    + `@font-face{font-family:'SarabunEmbed';font-weight:700;src:url(data:font/ttf;base64,${bold}) format('truetype');}`)
    .catch(() => '');
  return fontCss;
};

export async function renderGraphicSheetPng(props: {
  sheet: Sheet; start: Dayjs; admitDate: Dayjs | null; patient: Patient | null;
}, scale = 3): Promise<{ dataUrl: string; width: number; height: number }> {
  // วาด SheetSvg ลงกล่องที่ไม่ได้แปะในหน้า แล้วเอา markup ออกมา
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(<SheetSvg {...props} />));
  let svg = host.innerHTML;
  root.unmount();

  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const vw = vb ? Number(vb[1]) : 1000, vh = vb ? Number(vb[2]) : 1400;
  const css = await sarabunCss();
  svg = svg
    .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${vw * scale}" height="${vh * scale}" `)
    // ตัวแปร CSS ของหน้าเว็บไม่มีในภาพ — ชี้ไปที่ฟอนต์ที่ฝังไว้แทน
    .replace(/font-family:[^;"]*/, "font-family:'SarabunEmbed', Sarabun, sans-serif")
    .replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`);

  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = vw * scale;
  canvas.height = vh * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas ใช้ไม่ได้');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL('image/png'), width: vw, height: vh };
}
