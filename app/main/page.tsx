'use client';

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation';
import { message } from 'antd';
import Navbar from '../components/Navbar'

const Main = () => {
  const router = useRouter();

  useEffect(() => {
    const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
    if (!token) {
      message.error('เซสชันหมดอายุ หรือยังไม่ได้เข้าสู่ระบบ');
      router.push('/');
    }
  }, [router]);

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
        <div className="text-bla max-w-full mx-auto px-2 sm:px-6 lg:px-8">
            <h1>Main Content</h1>
            <p>This is the main content area.</p>
        </div>
    </div>
  )
}

export default Main