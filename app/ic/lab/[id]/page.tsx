'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import { Card, message, Spin, Table, Tag } from 'antd';
import axios from 'axios';

// ฟังก์ชันสำหรับทำความสะอาด RTF Tag ให้เหลือแค่ข้อความปกติ
function removeRTFContent(inputText: string): string {
  if (!inputText) return '';

  // 1. ตัดส่วน Header ของ RTF ทิ้งไป (ตั้งแต่ \rtf1 จนถึง \fs ตามด้วยตัวเลข)
  // จะช่วยลบข้อมูลฟอนต์ เช่น Courier MonoThai ออกไปได้อย่างหมดจด
  let text = inputText.replace(/\{?\\rtf1[\s\S]*?\\fs\d+\s*/gi, '');

  // 2. ถ้ามี \fonttbl หลงเหลืออยู่ (กรณีไม่มี \fs ปิดท้าย) ให้ตัดทิ้งเช่นกัน
  text = text.replace(/\{\\fonttbl[\s\S]*?\}/gi, '');
  text = text.replace(/\\fonttbl[\s\S]*?(?=\\[a-z])/gi, '');

  // 3. แปลงแท็กขึ้นบรรทัดใหม่และ Tab ของ RTF ให้เป็น Text ปกติ
  text = text.replace(/\\par\b\s*/g, '\n')
                      .replace(/\\line\b\s*/g, '\n')
                      .replace(/\\tab\b\s*/g, '\t');

  let cleaned = '';
  let inGroup = 0;
  let skipGroup = 0;

  // วนลูปอ่านทีละตัวอักษรเพื่อตัด Tag RTF ออกอย่างแม่นยำ
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      inGroup++;
      // ตรวจสอบ Group ที่ไม่ต้องการแสดงผล เช่น fonttbl, colortbl
      let nextText = text.substring(i, i + 15);
      if (
        nextText.startsWith('{\\fonttbl') || 
        nextText.startsWith('{\\colortbl') || 
        nextText.startsWith('{\\stylesheet') || 
        nextText.startsWith('{\\info') || 
        nextText.startsWith('{\\*')
      ) {
         if (skipGroup === 0) skipGroup = inGroup;
      }
    } else if (text[i] === '}') {
      if (skipGroup === inGroup) {
        skipGroup = 0;
      }
      if (inGroup > 0) inGroup--;
    } else if (text[i] === '\\') {
      i++; // ข้ามเครื่องหมาย \
      if (i >= text.length) break;

      if (text[i] === '\\' || text[i] === '{' || text[i] === '}') {
        if (skipGroup === 0) cleaned += text[i];
      } else if (text[i] === '~') {
        if (skipGroup === 0) cleaned += ' ';
      } else if (text[i] === '-' || text[i] === '_') {
        if (skipGroup === 0) cleaned += '-';
      } else if (text[i] === '\'') {
        i += 2; // ข้ามรหัสอักขระ Hex เช่น \'e0
      } else if (/[a-zA-Z]/.test(text[i])) {
        // ข้ามชื่อ Tag และตัวเลขที่ตามมา
        while (i < text.length && /[a-zA-Z0-9-]/.test(text[i])) {
          i++;
        }
        // ถ้ามีช่องว่างต่อท้าย Tag ให้ข้ามไปด้วย
        if (i < text.length && text[i] === ' ') {
          // skip space
        } else {
          i--; // ถอยกลับ 1 ตำแหน่งให้ลูปนอกทำงานต่อ
        }
      } else {
        // ตัวอักษรพิเศษอื่นๆ
        if (skipGroup === 0) cleaned += text[i];
      }
    } else {
      if (skipGroup === 0) {
        cleaned += text[i];
      }
    }
  }

  // จัดการบรรทัดว่างที่เยอะเกินไป และแปลง Entity HTML เผื่อไว้
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  cleaned = cleaned.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"');

  return cleaned;
}

interface LabSection {
  type: 'text' | 'mic-table';
  content: string;
  dataSource?: any[];
}

function parseLabToSections(text: string): LabSection[] {
  const sections: LabSection[] = [];
  let currentText = '';
  let tableData: any[] = [];
  let isTable = false;
  let allTables: any[][] = []; // สร้างตัวแปรมาเก็บตารางเพื่อรอนำไปต่อท้ายสุด

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentText += line + '\n'; // สะสมข้อความดั้งเดิมทุกบรรทัดไว้ด้วยกัน

    // ตรวจจับชื่อยาที่เว้นระยะด้วย จุด(.), Tab หรือ ช่องว่างที่มากกว่า 3 เคาะขึ้นไป
    const match = line.match(/^([A-Za-z0-9/\-\s()]+?)(?:\.{2,}|\t+|\s{3,})[\t\s]*(.*)$/);
    
    // ต้องแน่ใจว่าชื่อยามีตัวอักษรภาษาอังกฤษอยู่ด้วย (ป้องกันการจับบรรทัดอื่นมั่ว)
    if (match && /[A-Za-z]/.test(match[1])) {
        const drug = match[1].trim();
        const rest = match[2].trim();
        
        if (!rest) {
          if (tableData.length > 0) {
            allTables.push(tableData);
            tableData = [];
          }
          continue;
        }

        const rawTokens = rest.split(/[\t\s]+/);
        
        // เช็คให้ชัวร์ว่า token ส่วนใหญ่เป็นรูปแบบผลแล็บจริงๆ เช่น ตัวเลข, -, R, S, I
        const isLabValue = (t: string) => /^([<>=]*[0-9./]+|[RSI]|NS|SDD|-|[<>=]*[0-9./]+[RSI])$/i.test(t);

        if (rawTokens.every(isLabValue)) {
          const cols: string[] = [];
          
          // วนลูปเพื่อรวมตัวเลขกับตัวอักษร R, S, I ให้อยู่คอลัมน์เดียวกัน
          for (let t of rawTokens) {
            if (!t) continue;
            if (/^(R|S|I|NS|SDD)$/i.test(t) && cols.length > 0) {
              cols[cols.length - 1] += ' ' + t.toUpperCase();
            } else {
              const gluedMatch = t.match(/^([<>=]*[0-9./]+)(R|S|I|NS|SDD)$/i);
              if (gluedMatch) {
                cols.push(gluedMatch[1] + ' ' + gluedMatch[2].toUpperCase());
              } else {
                cols.push(t);
              }
            }
          }
          // เติมขีด (-) ให้ครบ 5 คอลัมน์ถ้าข้อมูลมาไม่ครบ
          while (cols.length < 5) cols.push('-');

          tableData.push({
            key: i,
            drug: drug,
            val1: cols[0],
            val2: cols[1],
            val3: cols[2],
            val4: cols[3],
            val5: cols[4],
          });
        } else {
          if (tableData.length > 0) {
            allTables.push(tableData);
            tableData = [];
          }
        }
    } else {
      if (tableData.length > 0) {
        allTables.push(tableData);
        tableData = [];
      }
    }
  }

  if (currentText) {
    sections.push({ type: 'text', content: currentText });
  }
  if (tableData.length > 0) {
    allTables.push(tableData);
  }

  // นำตารางทั้งหมดไปแสดงผลต่อท้ายสุด
  allTables.forEach(tData => {
    sections.push({ type: 'mic-table', content: '', dataSource: tData });
  });

  return sections;
}

const LabResultPage = () => {
  const params = useParams();
  const router = useRouter();
  const labId = params?.id as string;

  const [labSections, setLabSections] = useState<LabSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLabResult = async () => {
      if (!labId) return;
      setLoading(true);
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (!token) {
          message.error('ไม่พบ Token สำหรับการยืนยันตัวตน');
          router.push('/');
          return;
        }

        const headers = { Authorization: `Bearer ${token}` };
        const response = await axios.get(`/api/v1/ic/labno/${labId}`, { headers });

        if (response.data && response.data.success) {
          let rawText = '';
          const data = response.data.data;
          
          // ค้นหาข้อความจาก Data Structure ที่อาจจะเป็น String, Array หรือ Object
          if (typeof data === 'string') {
            rawText = data;
          } else if (Array.isArray(data) && data.length > 0) {
            rawText = data[0].result_rtf || data[0].lab_order_result || data[0].result || data[0].lab_result || JSON.stringify(data[0]);
          } else if (typeof data === 'object' && data !== null) {
            rawText = data.result_rtf || data.lab_order_result || data.result || data.lab_result || JSON.stringify(data);
          }

          const processedText = removeRTFContent(rawText);
          const sections = parseLabToSections(processedText);
          setLabSections(sections);
        } else {
          message.error('ไม่สามารถดึงข้อมูล Lab ได้');
        }
      } catch (error: any) {
        console.error('Error fetching lab data:', error);
        if (error.response?.status === 401) {
          message.error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
          router.push('/');
        } else {
          message.error('เกิดข้อผิดพลาดในการดึงข้อมูล Lab');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLabResult();
  }, [labId, router]);

  // ฟังก์ชันช่วยแสดงผลในแต่ละคอลัมน์ให้อยู่กึ่งกลางและจัดแท็กสี
  const renderCell = (text: string) => {
    if (!text || text === '-') return <span className="text-gray-300">-</span>;
    
    const parts = text.split(' ');
    if (parts.length === 2) {
      const [mic, interp] = parts;
      let fullText = interp;
      let color = '';

      switch (interp) {
        case 'R': fullText = 'Resistant'; color = 'red'; break;
        case 'S': fullText = 'Susceptible'; color = 'green'; break;
        case 'I': fullText = 'Intermediate'; color = 'orange'; break;
        case 'NS': fullText = 'Nonsusceptible'; color = 'purple'; break;
        case 'SDD': fullText = 'Susceptible-dose dependent'; color = 'blue'; break;
      }
      
      return (
        <div className="flex flex-col 2xl:flex-row items-center justify-center gap-1">
          <span className="whitespace-nowrap font-medium">{mic}</span>
          <Tag color={color} className="m-0 text-center">{fullText}</Tag>
        </div>
      );
    }
    return <span>{text}</span>;
  };

  const tableColumns = [
    { title: 'Antimicrobial Agent', dataIndex: 'drug', key: 'drug', width: 220, render: (text: string) => <span className="font-semibold text-gray-700">{text}</span> },
    { title: '1', dataIndex: 'val1', key: 'val1', align: 'center' as const, render: renderCell },
    { title: '2', dataIndex: 'val2', key: 'val2', align: 'center' as const, render: renderCell },
    { title: '3', dataIndex: 'val3', key: 'val3', align: 'center' as const, render: renderCell },
    { title: '4', dataIndex: 'val4', key: 'val4', align: 'center' as const, render: renderCell },
    { title: '5', dataIndex: 'val5', key: 'val5', align: 'center' as const, render: renderCell },
  ];

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <div className="p-6 max-w-5xl mx-auto">
        <Card 
          className="shadow-xl rounded-2xl border-none"
          title={<span className="text-xl font-bold text-emerald-700">ผลการตรวจ Lab (Order No: {labId})</span>}
        >
          <Spin spinning={loading}>
            <div className="bg-gray-50 p-4 md:p-6 rounded-xl border border-gray-200 text-sm font-mono text-gray-800 shadow-inner min-h-100">
              {!loading && labSections.length === 0 && (
                <div className="text-center text-gray-400 py-10">ไม่พบข้อมูลผล Lab</div>
              )}
              {labSections.map((sec, idx) => {
                if (sec.type === 'text') {
                  return (
                    <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                      {sec.content}
                    </div>
                  );
                } 
              })}
            </div>
          </Spin>
        </Card>
      </div>
    </div>
  );
};

export default LabResultPage;