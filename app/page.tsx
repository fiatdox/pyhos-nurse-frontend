"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";

interface UserProfile {
  loginname: string;
  name: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  data: UserProfile;
}

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  const router = useRouter();

  useEffect(() => {
    // ตรวจสอบ Token จาก Cookie แทน sessionStorage
    const getCookie = (name: string) => {
      return document.cookie.split('; ').find(row => row.startsWith(name + '='))?.split('=')[1];
    };
    if (getCookie('token')) {
      router.push("/main");
    }
  }, [router]);

  // ฟังก์ชัน Helper สำหรับสร้าง Cookie (ปลอดภัยกว่าและรองรับ Next.js Middleware)
  const setAuthCookie = (token: string, days: number = 1) => {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "; expires=" + date.toUTCString();
    // Secure: บังคับ HTTPS, SameSite=Lax: ป้องกัน CSRF พื้นฐาน
    document.cookie = "token=" + (token || "") + expires + "; path=/; Secure; SameSite=Lax";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // ใช้ Relative Path เพื่อให้วิ่งผ่าน Next.js Rewrites (แก้ปัญหา CORS และ Network Error)
      const response = await axios.post<LoginResponse>("/api/v1/login", {
        username,
        password,
      });

      const { success, token, data: userProfile } = response.data;

      // บาง API อาจส่ง code เป็น string หรือ number เช็คให้ดี
      if (success && token) {
        // เปลี่ยนจาก sessionStorage เป็น Cookie
        setAuthCookie(token);
        
        // user_profile อาจเก็บใน sessionStorage ได้เพราะไม่ใช่ข้อมูลลับขั้นวิกฤตเท่า token
        sessionStorage.setItem("user_profile", JSON.stringify(userProfile));
        router.push("/main");
      } else {
        setError("Login Failed: Invalid response from server.");
      }

    } catch (err: any) {
      console.error("Login Error:", err);
      
      if (err.response) {
        if (err.response.status === 401) {
           // บางที API ส่ง message มาใน err.response.data.message
           const serverMsg = err.response.data?.message;
           const errorMsg = serverMsg || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
           setError(errorMsg);
           
           Swal.fire({
             icon: 'error',
             title: 'เข้าสู่ระบบไม่สำเร็จ',
             text: errorMsg,
             confirmButtonText: 'ตกลง'
           });
        } else if (err.response.status === 404) {
           setError("ไม่พบ API (404) ตรวจสอบการตั้งค่า Rewrites หรือ URL Backend");
        } else {
           setError(`เกิดข้อผิดพลาด (${err.response.status})`);
        }
      } else if (err.request) {
        // Server ไม่ตอบสนอง (Network Error)
        setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ (Network Error)");
      } else {
        setError("เกิดข้อผิดพลาดในการส่งคำขอ");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="min-h-screen flex items-stretch text-white">
      {/* ... (ส่วน UI คงเดิมตามที่คุณเขียนมา สวยแล้วครับ) ... */}
       <div
        className="lg:flex w-1/2 hidden bg-gray-500 bg-no-repeat bg-cover relative items-center"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1725870953863-4ad4db0acfc2?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)",
        }}
      >
        <div className="absolute bg-black opacity-60 inset-0 z-0" />
        <div className="w-full px-24 z-10">
          <h1 className="text-5xl font-bold text-left tracking-wide">
            PYHOS-NURSE
          </h1>
          <p className="text-3xl my-4">Phayao Hospital</p>
        </div>
      </div>

      <div
        className="lg:w-1/2 w-full flex items-center justify-center text-center md:px-16 px-0 z-0 relative"
        style={{ backgroundColor: "#161616" }}
      >
        <div className="absolute lg:hidden z-10 inset-0 bg-gray-500 bg-no-repeat bg-cover items-center" 
             style={{ backgroundImage: "url(https://images.unsplash.com/photo-1725870953863-4ad4db0acfc2?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)" }}>
          <div className="absolute bg-black opacity-60 inset-0 z-0" />
        </div>

        <div className="w-full py-6 z-20">
          <form onSubmit={handleSubmit} className="sm:w-2/3 w-full px-4 lg:px-0 mx-auto">
            
            <div className="lg:hidden mb-8">
                <h1 className="text-4xl font-bold drop-shadow-md">PYHOS-NURSE</h1>
                <p className="text-xl text-gray-200">Phayao Hospital</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-900/60 border border-red-500 text-red-100 rounded-lg text-sm flex items-center gap-3">
                 <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                 {error}
              </div>
            )}

            <div className="pb-2 pt-4">
              <input
                type="text"
                placeholder="Username"
                className="block w-full p-4 text-lg rounded-lg bg-black/80 border border-gray-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all placeholder-gray-400"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="pb-2 pt-4">
              <input
                type="password"
                placeholder="Password"
                className="block w-full p-4 text-lg rounded-lg bg-black/80 border border-gray-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all placeholder-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="px-4 pb-2 pt-8">
              <button
                type="submit"
                disabled={isLoading}
                className={`uppercase block w-full p-4 text-lg rounded-full font-semibold tracking-wider transition-all shadow-lg
                  ${isLoading 
                    ? "bg-emerald-900 text-gray-400 cursor-wait" 
                    : "bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/30"
                  }`}
              >
                {isLoading ? "กำลังเข้าสู่ระบบ..." : "Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}