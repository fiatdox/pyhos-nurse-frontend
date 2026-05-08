"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";

interface UserProfile {
  id: number;
  username: string;
  name: string;
  mission_name: string;
  major_name: string;
  position_name: string;
}

interface LoginResponse {
  success: boolean;
  token: string;
  data: UserProfile;
}

const IconUser = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
);

const IconLock = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  </svg>
);

const IconCross = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

const IconAlert = () => (
  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
  </svg>
);

const BG_URL =
  "https://images.unsplash.com/photo-1725870953863-4ad4db0acfc2?q=80&w=1170&auto=format&fit=crop";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await axios.post<LoginResponse>("/api/v1/auth/login", {
        username,
        password,
      });

      const { success, token, data: userProfile } = response.data;

      if (success) {
        document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 8}`;
        sessionStorage.setItem("user_profile", JSON.stringify(userProfile));
        router.push("/main");
      } else {
        setError("Login Failed: Invalid response from server.");
      }
    } catch (err: any) {
      console.error("Login Error:", err);
      if (err.response) {
        if (err.response.status === 401) {
          const serverMsg = err.response.data?.message;
          const errorMsg = serverMsg || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
          setError(errorMsg);
          Swal.fire({ icon: "error", title: "เข้าสู่ระบบไม่สำเร็จ", text: errorMsg, confirmButtonText: "ตกลง" });
        } else if (err.response.status === 404) {
          setError("ไม่พบ API (404) ตรวจสอบการตั้งค่า Rewrites หรือ URL Backend");
        } else {
          setError(`เกิดข้อผิดพลาด (${err.response.status})`);
        }
      } else if (err.request) {
        setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ (Network Error)");
      } else {
        setError("เกิดข้อผิดพลาดในการส่งคำขอ");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans">

      {/* ── Left panel (desktop only) ── */}
      <div
        className="hidden lg:flex w-1/2 relative flex-col justify-between p-12"
        style={{ backgroundImage: `url(${BG_URL})`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        {/* overlay gradient */}
        <div className="absolute inset-0 bg-linear-to-br from-[#003d36]/90 via-[#006b5f]/70 to-black/60" />

        {/* top branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
            <IconCross />
          </div>
          <span className="text-white font-bold text-lg tracking-wide">PYHOS-NURSE</span>
        </div>

        {/* center quote */}
        <div className="relative z-10">
          <h1 className="text-5xl font-bold text-white leading-tight mb-4">
            ระบบบริหารจัดการพยาบาล
          </h1>
          <p className="text-xl text-teal-200 mb-6">โรงพยาบาลพะเยา</p>
          <div className="h-1 w-16 rounded-full bg-teal-400" />
        </div>

        {/* bottom caption */}
        <div className="relative z-10">
          <p className="text-white/50 text-sm">Phayao Hospital · Nursing Management System</p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div
        className="flex-1 relative flex items-center justify-center p-6"
        style={{
          backgroundColor: "#0f1117",
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      >
        {/* mobile background */}
        <div
          className="lg:hidden absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${BG_URL})` }}
        >
          <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/60 to-black/80" />
        </div>

        {/* card */}
        <div className="relative z-10 w-full max-w-sm">
          {/* mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600/30 border border-teal-500/40 backdrop-blur-sm mb-4">
              <IconCross />
            </div>
            <h1 className="text-3xl font-bold text-white">PYHOS-NURSE</h1>
            <p className="text-teal-300 mt-1 text-sm">โรงพยาบาลพะเยา</p>
          </div>

          {/* form card */}
          <div className="bg-white/5 lg:bg-[#1a1d27] backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="hidden lg:block mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal-600/20 border border-teal-500/30 mb-5">
                <span className="text-teal-400"><IconCross /></span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">เข้าสู่ระบบ</h2>
              <p className="text-gray-400 text-sm">กรุณากรอกชื่อผู้ใช้และรหัสผ่าน</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* error */}
              {error && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                  <IconAlert />
                  <span>{error}</span>
                </div>
              )}

              {/* username */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">ชื่อผู้ใช้</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                    <IconUser />
                  </span>
                  <input
                    type="text"
                    placeholder="กรอกชื่อผู้ใช้"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* password */}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5 font-medium">รหัสผ่าน</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                    <IconLock />
                  </span>
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="กรอกรหัสผ่าน"
                    className="w-full pl-11 pr-11 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all shadow-lg
                    bg-linear-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400
                    text-white disabled:opacity-50 disabled:cursor-wait
                    hover:shadow-teal-500/25 hover:shadow-xl active:scale-[0.98]"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      กำลังเข้าสู่ระบบ...
                    </span>
                  ) : (
                    "เข้าสู่ระบบ"
                  )}
                </button>
              </div>
            </form>
          </div>

          <p className="text-center text-white/25 text-xs mt-6">
            Phayao Hospital · Nursing Management System
          </p>
        </div>
      </div>
    </div>
  );
}
