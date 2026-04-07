'use client';

import 'regenerator-runtime/runtime';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { message, Button, Card, Tag } from 'antd';
import { AudioOutlined, AudioMutedOutlined, DeleteOutlined } from '@ant-design/icons';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import Navbar from '../components/Navbar';
import ActivityChart from './ActivityChart';

const Main = () => {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();

  // 1. จัดการเรื่อง Hydration และ Auth
  useEffect(() => {
    setIsClient(true); // บอกว่าตอนนี้อยู่บน Browser แล้วนะ

    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    if (!token) {
      message.error('เซสชันหมดอายุ หรือยังไม่ได้เข้าสู่ระบบ');
      router.push('/');
    }
  }, [router]);

  // 2. ถ้ายังโหลดหน้าเว็บ (SSR) ไม่เสร็จ ให้แสดง Loading เปล่าๆ ไปก่อน
  if (!isClient) {
    return <div className="bg-slate-50 min-h-screen"><Navbar /></div>;
  }

  // 3. เช็ค Support หลังจากที่มั่นใจว่าเป็น Client-side แล้ว
  if (!browserSupportsSpeechRecognition) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <Navbar />
        <div className="max-w-xl mx-auto mt-20 p-6 bg-white rounded-lg shadow text-center">
          <Tag color="error" className="mb-4">Browser Not Supported</Tag>
          <p className="text-slate-600">
            ดูเหมือน Browser นี้จะไม่รองรับ Web Speech API <br />
            <b>คำแนะนำ:</b> โปรดใช้ Google Chrome หรือ Microsoft Edge ในการทดสอบบน localhost ครับ
          </p>
        </div>
      </div>
    );
  }

  const startListening = () => {
    SpeechRecognition.startListening({ 
      continuous: true, 
      language: 'th-TH' 
    });
    message.success('กำลังฟังเสียงภาษาไทย...');
  };

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Voice to Text</h1>
          <p className="text-slate-500">ทดสอบระบบบันทึกเสียงบน Localhost</p>
        </header>

        <Card className="shadow-xl rounded-2xl border-none">
          <div className="flex flex-col items-center py-6">
            
            {/* สถานะและปุ่มไมค์ */}
            <div className="relative mb-6">
              <Button 
                type={listening ? "primary" : "default"}
                danger={listening}
                shape="circle"
                onClick={listening ? SpeechRecognition.stopListening : startListening}
                icon={listening ? <AudioOutlined /> : <AudioMutedOutlined />}
                style={{ width: 100, height: 100, fontSize: 40 }}
                className={`flex items-center justify-center shadow-lg transition-transform active:scale-95 ${listening ? 'animate-pulse' : ''}`}
              />
              {listening && (
                <span className="absolute top-0 right-0 flex h-6 w-6">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-6 w-6 bg-red-500"></span>
                </span>
              )}
            </div>

            <div className="text-center mb-8">
              <p className={`text-lg font-semibold ${listening ? 'text-blue-600' : 'text-slate-400'}`}>
                {listening ? "ระบบกำลังตั้งใจฟัง..." : "กดปุ่มเพื่อเริ่มพูด"}
              </p>
            </div>

            {/* พื้นที่แสดงข้อความ */}
            <div className="w-full relative group">
              <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl min-h-[200px] transition-all group-hover:border-blue-200">
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                   <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transcript</span>
                   {transcript && (
                     <Button 
                        type="text" 
                        size="small" 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={resetTranscript}
                     >ล้างข้อความ</Button>
                   )}
                </div>
                <p className="text-xl text-slate-700 leading-relaxed">
                  {transcript || <span className="text-slate-300 italic">ผลลัพธ์จะแสดงที่นี่...</span>}
                </p>
              </div>
            </div>

          </div>
        </Card>

        <ActivityChart />

        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-blue-700">
            <b>Tips สำหรับ Localhost:</b> <br />
            1. ตรวจสอบว่าได้เสียบไมโครโฟนเรียบร้อยแล้ว <br />
            2. หากกดเริ่มแล้วไม่มีอะไรเกิดขึ้น ให้เช็ค "รูปแม่กุญแจ" หน้า URL และกด <b>Allow Microphone</b>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Main;