"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";
import { saveVendorSession, type VendorProfile } from "./lib/vendorAuth";

/**
 * โหมดการเข้าระบบ
 *
 * สองฝั่งยิงไปคนละ endpoint คนละฐานบัญชี และเข้าไปคนละหน้า
 * ทำเป็นแท็บที่เห็นชัดตลอดเวลา ไม่ใช่สวิตช์เล็กๆ เพราะถ้าผู้ใช้ไม่รู้ว่า
 * ตัวเองอยู่โหมดไหน จะกรอกบัญชีเจ้าหน้าที่ส่งไปที่ endpoint ของบริษัท
 * แล้วได้ข้อความว่ารหัสผ่านไม่ถูกต้องทั้งที่รหัสผ่านถูก
 */
type LoginMode = "staff" | "vendor";

const MODES: { key: LoginMode; label: string; hint: string }[] = [
  { key: "staff", label: "เจ้าหน้าที่โรงพยาบาล", hint: "ใช้บัญชีเดียวกับระบบบุคลากร" },
  { key: "vendor", label: "บริษัทผู้รับจ้างทำอาหาร", hint: "ใช้บัญชีที่โรงพยาบาลออกให้" },
];

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
  token?: string;
  data?: UserProfile;
  /* โหมด OTP เปิดอยู่: รหัสผ่านถูกแล้ว ต้องกรอก OTP จาก LINE หมอพร้อมก่อนถึงจะได้ token */
  otp_required?: boolean;
  otp_token?: string;
  destination?: string;
  expires_in?: number;
  resend_after?: number;
}

/** ขั้นที่สองของการเข้าระบบเจ้าหน้าที่ (MFA) */
interface OtpStep {
  token: string;
  destination: string;
  /** เวลาที่ OTP ตัวล่าสุดหมดอายุ / ขอใหม่ได้ (ms) */
  expiresAt: number;
  resendAt: number;
}

const finishStaffLogin = (token: string, profile: UserProfile | undefined) => {
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 8}`;
  sessionStorage.setItem("user_profile", JSON.stringify(profile ?? {}));
};

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

const IconBuilding = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>
);

/*
  สีในหน้านี้เขียนเป็นค่าคงที่ ไม่ใช้ text-gray-* / text-slate-* / teal-*

  หน้านี้เป็นพื้นมืดตายตัวทั้งสองโหมด (#0f1117 กับ #1a1d27) แต่ globals.css
  กลับด้านเฉดสีกลางทั้งชุดเมื่อ <html> มีคลาส .dark เฉดเดียวกันจึงให้ค่าคนละสี
  คนละโหมด ผลคือ text-gray-500 เหลือความต่าง 3.5:1 ในโหมดสว่าง
  ส่วน hover:text-gray-200 เหลือ 1.4:1 ในโหมดมืด คือหายไปเลยตอนเอาเมาส์ชี้

  เฉดเขียวก็กลับด้านเหมือนกัน teal-200 ในโหมดมืดคือ #144848 ซึ่งเข้มกว่า
  ม่านเขียวที่อยู่ข้างหลัง เหลือความต่างแค่ 1.6:1 คำว่า "โรงพยาบาลพะเยา" จึงหายไป

  ค่าคงที่ไม่ผูกกับโหมด พื้นหลังตรงนี้ก็ไม่เปลี่ยน สิ่งที่เห็นจึงเหมือนกันทุกเครื่อง
*/

const BG_URL =
  "https://images.unsplash.com/photo-1725870953863-4ad4db0acfc2?q=80&w=1170&auto=format&fit=crop";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [mode, setMode] = useState<LoginMode>("staff");
  const [otp, setOtp] = useState<OtpStep | null>(null);

  const router = useRouter();

  /*
    ล้างช่องกรอกทุกครั้งที่สลับแท็บ

    ถ้าไม่ล้าง ผู้ใช้ที่กรอกไว้แล้วสลับแท็บจะกดส่งต่อทันทีโดยไม่ทันดู
    แล้วบัญชีของฝั่งหนึ่งจะถูกส่งไปให้อีกฝั่งตรวจ ซึ่งไม่มีทางผ่าน
    และตัวนับรหัสผ่านผิดของฝั่งบริษัทจะเพิ่มขึ้นฟรีๆ จนบัญชีถูกล็อก
  */
  const switchMode = (next: LoginMode) => {
    if (next === mode) return;
    setMode(next);
    setError("");
    setUsername("");
    setPassword("");
    setOtp(null);
  };

  const activeMode = MODES.find(m => m.key === mode)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mode === "vendor") {
        const response = await axios.post("/api/v1/vendor/login", { username, password });
        if (response.data?.success) {
          // เก็บคนละคุกกี้กับของเจ้าหน้าที่ ดู lib/vendorAuth
          saveVendorSession(response.data.token, response.data.data as VendorProfile);
          router.push("/vendor/report");
        } else {
          setError("เข้าระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        }
        return;
      }

      const response = await axios.post<LoginResponse>("/api/v1/auth/login", {
        username,
        password,
      });

      const { success, token, data: userProfile } = response.data;

      if (success && response.data.otp_required && response.data.otp_token) {
        /* รหัสผ่านถูก แต่โหมด OTP เปิดอยู่ — ล้างรหัสผ่านออกจากหน้าจอ แล้วไปขั้นกรอก OTP */
        const now = Date.now();
        setPassword("");
        setOtp({
          token: response.data.otp_token,
          destination: response.data.destination ?? "LINE OA หมอพร้อม",
          expiresAt: now + (response.data.expires_in ?? 300) * 1000,
          resendAt: now + (response.data.resend_after ?? 60) * 1000,
        });
      } else if (success && token) {
        finishStaffLogin(token, userProfile);
        router.push("/main");
      } else {
        setError("Login Failed: Invalid response from server.");
      }
    } catch (err) {
      console.error("Login Error:", err);

      // แยกชนิดด้วย axios.isAxiosError แทนการประกาศ any ให้ตัวตรวจชนิดยังทำงานได้
      if (!axios.isAxiosError(err)) {
        setError("เกิดข้อผิดพลาดในการส่งคำขอ");
      } else if (err.response) {
        const data = err.response.data as { message?: string } | undefined;
        if (mode === "staff" && data && "code" in data && typeof (data as { code?: unknown }).code === "string"
          && String((data as { code: string }).code).startsWith("OTP_")) {
          /* ส่ง OTP ไม่ได้ / ไม่มีเลขบัตร / ขอถี่เกิน — ข้อความจากเซิร์ฟเวอร์บอกสาเหตุครบแล้ว */
          const msg = data.message ?? "ส่งรหัส OTP ไม่สำเร็จ";
          setError(msg);
          Swal.fire({ icon: "warning", title: "ยืนยันตัวตนด้วย OTP ไม่สำเร็จ", text: msg, confirmButtonText: "ตกลง" });
        } else if (err.response.status === 423) {
          // บัญชีบริษัทถูกล็อกเพราะกรอกรหัสผ่านผิดหลายครั้ง ข้อความจากเซิร์ฟเวอร์บอกครบแล้ว
          const msg = data?.message ?? "บัญชีถูกล็อกชั่วคราว";
          setError(msg);
          Swal.fire({ icon: "warning", title: "บัญชีถูกล็อก", text: msg, confirmButtonText: "ตกลง" });
        } else if (err.response.status === 401) {
          const serverMsg = data?.message;
          const errorMsg = serverMsg || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
          setError(errorMsg);
          /*
            เตือนเรื่องแท็บด้วย เพราะเป็นสาเหตุที่เจอบ่อยที่สุดเมื่อกรอกถูกแล้วยังเข้าไม่ได้
            ข้อความหลักยังไม่บอกว่าผิดที่ชื่อผู้ใช้หรือรหัสผ่าน เพื่อไม่ให้คนนอก
            ไล่หาได้ว่าบัญชีไหนมีอยู่จริง การบอกเรื่องแท็บไม่ได้เปิดเผยอะไรเพิ่ม
          */
          Swal.fire({
            icon: "error",
            title: "เข้าสู่ระบบไม่สำเร็จ",
            text: errorMsg,
            footer: mode === "vendor"
              ? "ถ้านี่เป็นบัญชีเจ้าหน้าที่โรงพยาบาล ให้สลับไปแท็บ “เจ้าหน้าที่โรงพยาบาล”"
              : "ถ้านี่เป็นบัญชีของบริษัทผู้รับจ้าง ให้สลับไปแท็บ “บริษัทผู้รับจ้างทำอาหาร”",
            confirmButtonText: "ตกลง",
          });
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
          <span className="text-white font-bold text-lg tracking-wide">PYHOS x NIS</span>
        </div>

        {/* center quote */}
        <div className="relative z-10">
          <h1 className="text-5xl font-bold text-white leading-tight mb-4">
            {/* ตัดบรรทัดเองตามความหมาย ปล่อยเบราว์เซอร์ตัดจะได้ "...ทางการ / พยาบาล" ซึ่งอ่านเป็นคำว่า "ทางการ" */}
            <span className="block whitespace-nowrap">ระบบสารสนเทศ</span>
            <span className="block whitespace-nowrap">ทางการพยาบาล</span>
          </h1>
          <p className="text-xl text-[#ccfbf1] mb-6">โรงพยาบาลพะเยา</p>
          <div className="h-1 w-16 rounded-full bg-[#2dd4bf]" />
        </div>

        {/* bottom caption */}
        <div className="relative z-10">
          <p className="text-white/75 text-sm">Phayao Hospital · Nursing Information System</p>
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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0d9488]/30 border border-[#14b8a6]/40 backdrop-blur-sm mb-4">
              <IconCross />
            </div>
            <h1 className="text-3xl font-bold text-white">PYHOS x NIS</h1>
            <p className="text-[#99f6e4] mt-1 text-sm">
              {mode === "staff" ? "โรงพยาบาลพะเยา" : activeMode.label}
            </p>
          </div>

          {/* form card */}
          <div className="bg-white/5 lg:bg-[#1a1d27] backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="hidden lg:block mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#0d9488]/20 border border-[#14b8a6]/30 mb-5">
                <span className="text-[#2dd4bf]">{mode === "staff" ? <IconCross /> : <IconBuilding />}</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">เข้าสู่ระบบ</h2>
              <p className="text-white/70 text-sm">{activeMode.hint}</p>
            </div>

            {/*
              แท็บต้องเห็นชัดว่าอันไหนถูกเลือกอยู่ ไม่ใช่ต่างกันแค่สีจางๆ
              เพราะการเลือกผิดทำให้เข้าระบบไม่ได้โดยไม่มีคำอธิบายที่ตรงสาเหตุ
            */}
            <div className="grid grid-cols-2 gap-1 p-1 mb-5 rounded-xl bg-white/5 border border-white/10">
              {MODES.map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => switchMode(m.key)}
                  disabled={isLoading}
                  aria-pressed={mode === m.key}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                    mode === m.key
                      ? "bg-[#0f766e] text-white shadow-lg shadow-black/40"
                      : "text-white/65 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {otp ? (
              <OtpForm
                step={otp}
                username={username}
                onBack={() => { setOtp(null); setError(""); }}
                onResent={next => setOtp(next)}
                onDone={(token, profile) => { finishStaffLogin(token, profile); router.push("/main"); }}
              />
            ) : (
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
                <label className="block text-sm text-white/70 mb-1.5 font-medium">ชื่อผู้ใช้</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50">
                    <IconUser />
                  </span>
                  <input
                    type="text"
                    placeholder="กรอกชื่อผู้ใช้"
                    name={mode === "staff" ? "username" : "vendor-username"}
                    autoComplete="username"
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/50 text-sm focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]/50 transition-all"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              {/* password */}
              <div>
                <label className="block text-sm text-white/70 mb-1.5 font-medium">รหัสผ่าน</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50">
                    <IconLock />
                  </span>
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="กรอกรหัสผ่าน"
                    name={mode === "staff" ? "password" : "vendor-password"}
                    autoComplete="current-password"
                    className="w-full pl-11 pr-11 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/50 text-sm focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]/50 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
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
                    bg-linear-to-r from-[#115e59] to-[#0f766e] hover:from-[#13746b] hover:to-[#14857a]
                    text-white disabled:opacity-50 disabled:cursor-wait
                    hover:shadow-[#14b8a6]/25 hover:shadow-xl active:scale-[0.98]"
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
            )}

            {mode === "vendor" && (
              <p className="text-center text-white/60 text-xs mt-5 leading-relaxed">
                กรอกรหัสผ่านผิดติดกัน 5 ครั้ง บัญชีจะถูกล็อก 15 นาที
                <br />
                ลืมรหัสผ่านหรือบัญชีถูกล็อก ติดต่องานโภชนาการของโรงพยาบาล
              </p>
            )}
          </div>

          <p className="text-center text-white/55 text-xs mt-6">
            Phayao Hospital · Nursing Information System
          </p>
        </div>
      </div>
    </div>
  );
}

/** นับถอยหลังเป็นวินาที (อัปเดตทุกวินาที) */
function useSecondsLeft(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/**
 * ขั้นที่สอง: กรอก OTP 6 หลักที่ส่งไป LINE OA หมอพร้อม
 * ไม่เก็บรหัสผ่านไว้ในหน้าจอแล้ว กดกลับ = เริ่มใส่รหัสผ่านใหม่
 */
function OtpForm({ step, username, onBack, onResent, onDone }: {
  step: OtpStep;
  username: string;
  onBack: () => void;
  onResent: (next: OtpStep) => void;
  onDone: (token: string, profile: UserProfile | undefined) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const expiresIn = useSecondsLeft(step.expiresAt);
  const resendIn = useSecondsLeft(step.resendAt);

  const serverMsg = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const d = err.response?.data as { message?: string; code?: string } | undefined;
      /* ขั้นกลางหมดอายุ / ผิดเกิน — ต้องกลับไปใส่รหัสผ่านใหม่ */
      if (d?.code === "OTP_SESSION_EXPIRED") {
        Swal.fire({ icon: "warning", title: "กรุณาเข้าระบบใหม่", text: d.message, confirmButtonText: "ตกลง" });
        onBack();
        return null;
      }
      return d?.message ?? fallback;
    }
    return fallback;
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    setBusy(true);
    try {
      const res = await axios.post<LoginResponse>("/api/v1/auth/login/otp", { otp_token: step.token, code });
      if (res.data?.success && res.data.token) onDone(res.data.token, res.data.data);
      else setError("ยืนยันไม่สำเร็จ กรุณาลองใหม่");
    } catch (err) {
      const m = serverMsg(err, "ยืนยัน OTP ไม่สำเร็จ");
      if (m) { setError(m); setCode(""); }
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(""); setInfo("");
    setResending(true);
    try {
      const res = await axios.post<{ expires_in?: number; resend_after?: number }>(
        "/api/v1/auth/login/otp/resend", { otp_token: step.token });
      const now = Date.now();
      onResent({
        ...step,
        expiresAt: now + (res.data.expires_in ?? 300) * 1000,
        resendAt: now + (res.data.resend_after ?? 60) * 1000,
      });
      setCode("");
      setInfo("ส่งรหัสใหม่แล้ว รหัสเดิมใช้ไม่ได้อีก");
    } catch (err) {
      const m = serverMsg(err, "ขอรหัสใหม่ไม่สำเร็จ");
      if (m) setError(m);
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={verify} className="space-y-4">
      <div className="rounded-xl bg-[#0d9488]/15 border border-[#14b8a6]/30 p-3.5 text-sm text-white/85 leading-relaxed">
        <div className="font-semibold text-white mb-0.5">ยืนยันตัวตนด้วย OTP</div>
        ส่งรหัส 6 หลักไปที่ <b className="text-[#5eead4]">{step.destination}</b> แล้ว
        <div className="text-white/60 text-xs mt-1">ผู้ใช้ {username} · เปิด LINE แล้วดูข้อความจากหมอพร้อม</div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <IconAlert />
          <span>{error}</span>
        </div>
      )}
      {info && !error && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">{info}</div>
      )}

      <div>
        <label htmlFor="otp-code" className="block text-sm text-white/70 mb-1.5 font-medium">รหัส OTP</label>
        <input
          id="otp-code"
          name="one-time-code"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          placeholder="••••••"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-center text-2xl tracking-[0.5em] tabular-nums focus:outline-none focus:border-[#14b8a6] focus:ring-1 focus:ring-[#14b8a6]/50"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={busy}
          required
        />
        <div className={`text-xs mt-1.5 ${expiresIn > 0 ? "text-white/60" : "text-red-300"}`}>
          {expiresIn > 0 ? `รหัสหมดอายุใน ${mmss(expiresIn)} นาที` : "รหัสหมดอายุแล้ว กรุณากดขอรหัสใหม่"}
        </div>
      </div>

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all shadow-lg
          bg-linear-to-r from-[#115e59] to-[#0f766e] hover:from-[#13746b] hover:to-[#14857a]
          text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        {busy ? "กำลังตรวจสอบ..." : "ยืนยัน OTP"}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="text-white/65 hover:text-white">
          ← กลับไปหน้าเข้าระบบ
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={resendIn > 0 || resending}
          className="text-[#5eead4] hover:text-white disabled:text-white/40 disabled:cursor-not-allowed"
        >
          {resendIn > 0 ? `ขอรหัสใหม่ได้ใน ${resendIn} วิ` : resending ? "กำลังส่ง..." : "ขอรหัสใหม่"}
        </button>
      </div>
    </form>
  );
}
