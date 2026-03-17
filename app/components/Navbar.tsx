'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from 'antd';
import {
    VscSignOut,
    VscAccount,
    VscSettingsGear,
    VscChecklist
} from "react-icons/vsc";
import { GrSchedulePlay, GrUserAdd, GrWheelchairActive, GrWorkshop } from 'react-icons/gr';
import { SiWikibooks } from 'react-icons/si';
import { IoFastFoodOutline } from 'react-icons/io5';
import { TbReportSearch } from 'react-icons/tb';
import Link from 'next/link';
import { CgPerformance } from 'react-icons/cg';
import { LiaHospital } from 'react-icons/lia';
import { PiVirusBold } from 'react-icons/pi';

const Navbar = () => {
    const [openLeft, setOpenLeft] = useState(false);
    const [openRight, setOpenRight] = useState(false);
    const router = useRouter();

    const showLeftDrawer = () => setOpenLeft(true);
    const onCloseLeft = () => setOpenLeft(false);

    const showRightDrawer = () => setOpenRight(true);
    const onCloseRight = () => setOpenRight(false);

    const handleLogout = () => {
        // ลบ cookie token โดยตั้ง expire เป็นอดีต
        document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        // ล้างค่าใน sessionStorage
        sessionStorage.clear();
        // Redirect ไปยังหน้า Login
        router.push('/');
    };

    return (
        <nav className="bg-[#006b5f] shadow-lg">
            <div className="max-w-full mx-auto px-2 sm:px-6 lg:px-8">
                <div className="relative flex items-center justify-between h-16">
                    {/* Hamburger Menu (Left) - Visible on Mobile only */}
                    <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                        <button
                            onClick={showLeftDrawer}
                            className="p-2 rounded-md text-white hover:text-gray-200 hover:bg-white/10 focus:outline-none"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center sm:items-stretch sm:justify-start">
                        {/* Hamburger Menu (Left) */}
                        <div className="hidden sm:flex items-center mr-2">
                            <button
                                onClick={showLeftDrawer}
                                className="p-2 rounded-md text-white hover:text-gray-200 hover:bg-white/10 focus:outline-none"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                </svg>
                            </button>
                        </div>

                        <div className="shrink-0 flex items-center">

                            <span className="ml-2 text-xl font-bold text-white">PYHOS x Nurse</span>

                        </div>
                        <div className="hidden sm:block sm:ml-6">
                            <div className="flex space-x-4">
                                <Link href="#" className="text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium">Home</Link>
                                {/* Products Dropdown Trigger */}
                                <div className="group">
                                    <button className="text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                                        ระบบงาน
                                        <svg className="ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    {/* Mega Menu */}
                                    <div className="absolute left-0 top-16 w-full bg-white border-b border-gray-200 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 before:absolute before:-top-4 before:h-4 before:w-full">
                                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-6">
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Software</h3>
                                                    <ul className="space-y-3">
                                                        <li><Link href="#" className="text-gray-600 hover:text-indigo-600">IC : Infection Controls</Link></li>
                                                        <li><Link href="#" className="text-gray-600 hover:text-indigo-600">Mobile Apps</Link></li>
                                                        <li><Link href="#" className="text-gray-600 hover:text-indigo-600">Desktop Software</Link></li>
                                                        <li><Link href="#" className="text-gray-600 hover:text-indigo-600">Enterprise Solutions</Link></li>
                                                        <li><Link href="#" className="text-gray-600 hover:text-indigo-600">API Services</Link></li>
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Hardware</h3>
                                                    <ul className="space-y-3">
                                                        <li><Link href="#" className="text-gray-600 hover:text-indigo-600">Laptops</Link></li>
                                                        <li><Link href="#" className="text-gray-600 hover:text-indigo-600">Desktops</Link></li>
                                                        <li><Link href="#" className="text-gray-600 hover:text-indigo-600">Tablets</Link></li>
                                                        <li><Link href="#" className="text-gray-600 hover:text-indigo-600">Accessories</Link></li>
                                                        <li><Link href="#" className="text-gray-600 hover:text-indigo-600">Networking</Link></li>
                                                    </ul>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Featured</h3>
                                                    <div className="bg-gray-100 p-4 rounded-lg">
                                                        <img src="https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=2065&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Featured Product" className="rounded-lg mb-3" />
                                                        <h4 className="font-medium text-gray-900">New Release</h4>
                                                        <p className="text-sm text-gray-600 mb-2">Check out our latest product offering with advanced
                                                            features.</p>
                                                        <Link href="#" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Learn more →</Link>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <Link href="#" className="text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium">FTE</Link>
                                <Link href="#" className="text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium">Dashboard</Link>
                                <Link href="#" className="text-white hover:bg-white/10 px-3 py-2 rounded-md text-sm font-medium">Contact</Link>
                            </div>
                        </div>
                    </div>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                        {/* User Icon (Right) */}
                        <button
                            onClick={showRightDrawer}
                            className="p-2 rounded-full text-white hover:text-gray-200 hover:bg-white/10 focus:outline-none"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Left Drawer (Menu) */}
            <Drawer
                title={<span className="text-white font-bold text-lg">Menu</span>}
                placement="left"
                onClose={onCloseLeft}
                open={openLeft}
                className="[&_.ant-drawer-body]:p-0 [&_.ant-drawer-content]:bg-transparent [&_.ant-drawer-header]:bg-[#005a50] [&_.ant-drawer-header]:border-b-white/10 [&_.ant-drawer-close]:text-white"
                styles={{ body: { padding: 0 }, mask: { backgroundColor: 'rgba(0, 0, 0, 0.2)' }, wrapper: { boxShadow: 'none' } }}
            >
                <div className="flex flex-col h-full bg-linear-to-b from-[#005a50] to-[#008f7f] p-4 text-white">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 p-2 font-bold border-t border-b border-white/10 mb-2">
                            <VscAccount className="w-5 h-5" />
                            <span>IPD</span>
                        </div>
                        <Link href="/ipd/register" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <GrUserAdd  className="w-5 h-5 text-white" />
                            <span>รับผู้ป่วย / รับย้าย</span>
                           </div>
                        </Link>
                        <Link href="/ipd/patients" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <SiWikibooks  className="w-5 h-5 text-white" />
                            <span>ทะเบียนผู้ป่วย</span>
                           </div>
                        </Link>
                        <Link href="#" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <GrWheelchairActive  className="w-5 h-5 text-white" />
                            <span>จำหน่ายผู้ป่วย / ย้ายออก</span>
                           </div>
                        </Link>
                        <Link href="#" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <IoFastFoodOutline  className="w-5 h-5 text-white" />
                            <span>สั่งอาหาร</span>
                           </div>
                        </Link>
                        <Link href="#" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <VscChecklist  className="w-5 h-5 text-white" />
                            <span>สรุปยอดผู้ป่วยรายเวร / FTE</span>
                           </div>
                        </Link>
                        <Link href="/ipd/shift-configs" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <GrSchedulePlay    className="w-5 h-5 text-white" />
                            <span>ตารางการปฏิบัติงาน</span>
                           </div>
                        </Link>
                        <Link href="#" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <TbReportSearch   className="w-5 h-5 text-white" />
                            <span>รายงาน</span>
                           </div>
                        </Link>
                        <div className="flex items-center gap-3 p-2 font-bold border-t border-b border-white/10 mb-2 mt-4">
                            <PiVirusBold className="w-5 h-5" />
                            <span>IC : Infection Controls</span>
                        </div>
                        <Link href="/ic/opd" onClick={onCloseLeft}>
                           <div className=" flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <TbReportSearch   className="w-5 h-5 text-white" />
                            <span>OPD Daily</span>
                           </div>
                        </Link>
                        <Link href="/ic/ipd" onClick={onCloseLeft}>
                           <div className=" flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <TbReportSearch   className="w-5 h-5 text-white" />
                            <span>IPD Daily</span>
                           </div>
                        </Link>
                         <Link href="/ic/follow-up" onClick={onCloseLeft}>
                           <div className=" flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <TbReportSearch   className="w-5 h-5 text-white" />
                            <span>ติดตามผู้ป่วยผ่าตัด(T814,A499)</span>
                           </div>
                        </Link>
                        <Link href="/ic/dashboard" onClick={onCloseLeft}>
                           <div className=" flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <TbReportSearch   className="w-5 h-5 text-white" />
                            <span>IC Dashboard</span>
                           </div>
                        </Link>
                        {/* <div className="flex items-center gap-3 p-2 mt-3 font-bold border-t border-b border-white/10 mb-0">
                            <VscAccount className="w-5 h-5" />
                            <span>OPD</span>
                        </div>
                        <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors">
                            <TbReportSearch   className="w-5 h-5" />
                            <span>รายงาน</span>
                        </div>
                        <div className="flex items-center gap-3 p-2 mt-3 font-bold border-t border-b border-white/10 mb-0">
                            <VscAccount className="w-5 h-5" />
                            <span>ER</span>
                        </div>
                        <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors">
                            <TbReportSearch   className="w-5 h-5" />
                            <span>บันทึกข้อมูลสถิติการรักษา</span>
                        </div>
                        <div className="flex items-center gap-3 p-2 mt-3 font-bold border-t border-b border-white/10 mb-2">
                            <VscAccount className="w-5 h-5" />
                            <span>OR</span>
                        </div> */}
                    </div>

                </div>
            </Drawer>

            {/* Right Drawer (User Profile) */}
            <Drawer
                title={<span className="text-white font-bold text-lg">User Profile</span>}
                placement="right"
                onClose={onCloseRight}
                open={openRight}
                className="[&_.ant-drawer-body]:p-0 [&_.ant-drawer-content]:bg-transparent [&_.ant-drawer-header]:bg-[#005a50] [&_.ant-drawer-header]:border-b-white/10 [&_.ant-drawer-close]:text-white"
                styles={{ body: { padding: 0 }, mask: { backgroundColor: 'rgba(0, 0, 0, 0.2)' }, wrapper: { boxShadow: 'none' } }}
            >
                <div className="flex flex-col h-full bg-linear-to-b from-[#005a50] to-[#008f7f] p-4 text-white">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 p-2 font-bold border-b border-white/10 mb-2">
                            <VscAccount className="w-5 h-5" />
                            <span>User Information</span>
                        </div>
                        <Link href="#" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <CgPerformance    className="w-5 h-5 text-white" />
                            <span>Performance ของฉัน</span>
                           </div>
                        </Link>
                        <Link href="/ipd/ward-staffs" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <LiaHospital    className="w-5 h-5 text-white" />
                            <span>ตั้งค่าหอผู้ป่วยปฏิบัติงาน</span>
                           </div>
                        </Link>
                        <Link href="#" onClick={onCloseLeft}>
                           <div className="flex items-center gap-3 p-2 hover:bg-white/10 rounded cursor-pointer transition-colors text-white">
                            <GrWorkshop   className="w-5 h-5 text-white" />
                            <span>ตั้งค่าเจ้าหน้าปฏิบัติงานในหอผู้ป่วย</span>
                           </div>
                        </Link>

                    </div>
                    <button onClick={handleLogout} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded text-red-100 hover:text-white transition-colors w-full text-left mt-auto">
                        <VscSignOut className="w-5 h-5" />
                        <span>ออกจากระบบ</span>
                    </button>
                </div>
            </Drawer>
        </nav>
    )
}

export default Navbar