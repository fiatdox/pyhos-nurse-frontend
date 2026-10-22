'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Result } from 'antd';
import { PiArrowLeftBold, PiCompassBold, PiHouseBold } from 'react-icons/pi';
import Navbar from './Navbar';

/*
  คนที่มาถึงหน้านี้ส่วนใหญ่เปิดจากที่คั่นหน้าหรือลิงก์เก่า (เช่นหน้าที่ถูกยกเลิกไปแล้ว)
  จึงบอกตรงๆ ว่าเกิดอะไรขึ้น โชว์ที่อยู่ที่เปิดมา (เอาไปแจ้งผู้ดูแลได้) และมีทางกลับที่ใช้ได้จริง

  เจ้าหน้าที่เห็นแถบบนตามปกติ จะได้ไปต่อจากเมนูได้เลย
  บริษัทผู้รับจ้างไม่เห็นแถบบนของเจ้าหน้าที่ (เมนูไม่ใช่ของเขา และ API ฝั่งนั้นใช้ token ของเขาไม่ได้)
  ปุ่มกลับหน้าหลักจึงพาไปหน้าแรกของแต่ละฝั่ง
*/
export default function NotFoundView() {
    const pathname = usePathname() ?? '';
    const router = useRouter();
    const vendor = pathname.startsWith('/vendor');
    const home = vendor ? '/vendor/report' : '/main';

    const back = () => {
        // เปิดตรงจากที่คั่นหน้าในแท็บใหม่ จะไม่มีหน้าก่อนหน้าให้ย้อน
        if (window.history.length > 1) router.back();
        else router.push(home);
    };

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            {!vendor && <Navbar />}
            <div className="px-4 py-12 md:py-20 flex justify-center">
                <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl">
                    <Result
                        icon={
                            <div className="mx-auto grid place-items-center w-20 h-20 rounded-full bg-[#006b5f]/10 text-(--brand-text)">
                                <PiCompassBold className="w-10 h-10" />
                            </div>
                        }
                        title={
                            <div className="flex flex-col gap-1">
                                <span className="text-5xl font-bold text-(--brand-text) leading-none">404</span>
                                <span className="text-xl font-semibold">ไม่พบหน้าที่ต้องการ</span>
                            </div>
                        }
                        subTitle={
                            <div className="flex flex-col items-center gap-3">
                                <span>
                                    ลิงก์อาจพิมพ์ผิด หรือหน้านี้ถูกย้ายหรือยกเลิกไปแล้ว
                                    ถ้าเปิดจากที่คั่นหน้า (bookmark) ให้เข้าจากเมนูแทน
                                </span>
                                {pathname && (
                                    <code className="max-w-full truncate rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                        {pathname}
                                    </code>
                                )}
                            </div>
                        }
                        extra={
                            <div className="flex flex-wrap justify-center gap-2">
                                <Link href={home}>
                                    <Button type="primary" icon={<PiHouseBold />}>กลับหน้าหลัก</Button>
                                </Link>
                                <Button icon={<PiArrowLeftBold />} onClick={back}>ย้อนกลับ</Button>
                            </div>
                        }
                    />
                </div>
            </div>
        </div>
    );
}
