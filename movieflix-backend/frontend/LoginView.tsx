import React, { useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  ArrowLeft,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { User as UserType } from '../types';
import { auth, ApiError } from '../services/adminApi';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import { FreedomLogo } from './FreedomLogo';

interface LoginViewProps {
  onLoginSuccess: (user: UserType, dualLogin?: boolean) => void;
  onGoToPublicSite: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onGoToPublicSite }) => {
  const { t, language } = useLanguage();
  // ไม่มีค่าเริ่มต้นของอีเมล/รหัสผ่านอีกต่อไป และไม่มีบัญชีทดสอบโชว์บนหน้าจอ
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'error' | 'warning' | 'success' } | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  const triggerAlert = (message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    setAlert({ message, type });
    if (type === 'error') {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const email = username.trim();
    if (!email || !password) {
      triggerAlert(
        language === 'th'
          ? 'กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน'
          : 'Please enter both email and password',
        'warning'
      );
      return;
    }

    setIsLoading(true);
    setAlert(null);

    try {
      // เซิร์ฟเวอร์เป็นคนตรวจรหัสผ่านและสิทธิ์ ไม่มีการเทียบรหัสในเบราว์เซอร์
      const u = await auth.login(email, password, needTotp ? totp.trim() : undefined);
      setPassword('');
      setTotp('');
      triggerAlert(
        language === 'th'
          ? `เข้าสู่ระบบสำเร็จในฐานะ [${u.displayName}] กำลังนำไปยังหน้าจัดการ...`
          : `Signed in as [${u.displayName}]! Redirecting...`,
        'success'
      );
      // หมายเหตุ: ปรับฟิลด์ให้ตรงกับชนิด User ใน types.ts ของโปรเจกต์ (ที่นี่ส่งสิทธิ์จริงจากเซิร์ฟเวอร์มาด้วย)
      const loggedInUser = {
        id: u.id,
        username: u.email,
        name: u.displayName,
        role: u.role,
        permissions: u.permissions,
        loginTime: new Date().toISOString(),
      } as unknown as UserType;
      setTimeout(() => onLoginSuccess(loggedInUser, false), 550);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'totp_required') {
        setNeedTotp(true);
        triggerAlert(err.message, 'warning');
      } else {
        // ข้อความจากเซิร์ฟเวอร์ (ไม่บอกว่าอีเมลหรือรหัสผ่านข้อใดผิด เพื่อกันการเดาอีเมล)
        triggerAlert(err instanceof ApiError ? err.message : (language === 'th' ? 'เกิดข้อผิดพลาด กรุณาลองใหม่' : 'Something went wrong'), 'error');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#0F0F0F] text-white min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden selection:bg-[#E50914] selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#E50914]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top right language switcher */}
      <div className="absolute top-6 right-6 z-20">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-6 fade-in flex flex-col items-center">
          <FreedomLogo size="xl" variant="full" showAdminBadge={true} className="mb-2" />
          <p className="text-gray-400 mt-1 text-sm">
            {language === 'th' ? 'ระบบจัดการภาพยนตร์และสตรีมมิ่ง — เข้าสู่ระบบ' : 'Cinema & Streaming Management — Sign In'}
          </p>
        </div>

        {/* Login Card */}
        <div
          id="loginBox"
          className={`bg-[#1A1A1A] rounded-2xl p-6 sm:p-8 shadow-2xl border border-white/10 ${
            isShaking ? 'shake ring-2 ring-red-500' : ''
          }`}
        >
          {/* Notification Alert Box */}
          {alert && (
            <div
              id="alertBox"
              className={`mb-5 p-3 rounded-lg text-center text-xs sm:text-sm font-medium transition-all ${
                alert.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : alert.type === 'warning'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {alert.message}
            </div>
          )}

          <form id="loginForm" onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-500" />
                  {language === 'th' ? 'อีเมล' : 'Email'}
                </span>
              </label>
              <input
                type="email"
                id="username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-[#0F0F0F] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E50914]/50 focus:border-[#E50914] transition-all font-mono"
                placeholder={language === 'th' ? 'กรอกอีเมลผู้ดูแล' : 'Enter admin email'}
                autoComplete="username"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-gray-500" />
                  {language === 'th' ? 'รหัสผ่าน' : 'Password'}
                </span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0F0F0F] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E50914]/50 focus:border-[#E50914] transition-all pr-12 font-mono"
                  placeholder={language === 'th' ? 'กรอกรหัสผ่าน' : 'Enter password'}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  id="togglePass"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 cursor-pointer"
                  title={showPassword ? (language === 'th' ? 'ซ่อนรหัสผ่าน' : 'Hide password') : (language === 'th' ? 'แสดงรหัสผ่าน' : 'Show password')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* รหัสยืนยัน 2 ชั้น: แสดงเฉพาะเมื่อบัญชีนี้เปิดใช้งาน */}
            {needTotp && (
              <div>
                <label htmlFor="totp" className="block text-sm font-medium text-gray-300 mb-2">
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-gray-500" />
                    {language === 'th' ? 'รหัสยืนยัน 6 หลัก (แอปยืนยันตัวตน)' : '6-digit authentication code'}
                  </span>
                </label>
                <input
                  type="text"
                  id="totp"
                  name="totp"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 bg-[#0F0F0F] border border-white/10 rounded-lg text-white tracking-[0.4em] text-center placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E50914]/50"
                  placeholder="000000"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                />
              </div>
            )}

            {/* ลืมรหัสผ่าน: ระบบไม่ส่งอีเมลอัตโนมัติ ให้ติดต่อเจ้าของเพื่อรีเซ็ต (ไม่แสดงข้อความหลอกว่าส่งแล้ว) */}
            <div className="flex items-center justify-end text-sm pt-1">
              <button
                type="button"
                onClick={() =>
                  triggerAlert(
                    language === 'th'
                      ? 'หากลืมรหัสผ่าน กรุณาติดต่อเจ้าของระบบเพื่อรีเซ็ตรหัสผ่านให้'
                      : 'If you forgot your password, please contact the site owner to reset it.',
                    'warning'
                  )
                }
                className="text-[#E50914] hover:text-[#ff3b47] transition-colors text-xs sm:text-sm font-medium cursor-pointer"
              >
                {language === 'th' ? 'ลืมรหัสผ่าน?' : 'Forgot Password?'}
              </button>
            </div>


            {/* Submit Button */}
            <button
              type="submit"
              id="loginBtn"
              disabled={isLoading}
              className="w-full bg-[#E50914] hover:bg-[#E50914]/90 disabled:opacity-75 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#E50914]/20 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span>{language === 'th' ? 'กำลังตรวจสอบ...' : 'Authenticating...'}</span>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </>
              ) : (
                <>
                  <span id="btnText">{language === 'th' ? 'เข้าสู่ระบบ (Sign In)' : 'Sign In'}</span>
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Back to Public Preview Website */}
        <p className="text-center text-sm text-gray-500 mt-5">
          <button
            onClick={onGoToPublicSite}
            className="hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {t.header.previewSite}
          </button>
        </p>
      </div>
    </div>
  );
};
