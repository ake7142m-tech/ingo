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
  Shield,
  Film,
} from 'lucide-react';
import { User as UserType } from '../types';
import { INITIAL_USERS } from '../data/initialData';

interface LoginViewProps {
  onLoginSuccess: (user: UserType, dualLogin?: boolean) => void;
  onGoToPublicSite: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onGoToPublicSite }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<{ message: string; type: 'error' | 'warning' | 'success' } | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  const fillCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setAlert(null);
  };

  const triggerAlert = (message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    setAlert({ message, type });
    if (type === 'error') {
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 450);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      triggerAlert('กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน', 'warning');
      return;
    }

    setIsLoading(true);
    setAlert(null);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const foundUser = INITIAL_USERS.find(
      (u) => u.username.toLowerCase() === trimmedUser.toLowerCase() && u.password === password
    );

    if (foundUser) {
      triggerAlert(`เข้าสู่ระบบสำเร็จในฐานะ ${foundUser.name}`, 'success');
      const loggedInUser: UserType = {
        ...foundUser,
        loginTime: new Date().toISOString(),
      };
      setTimeout(() => {
        onLoginSuccess(loggedInUser, false);
      }, 300);
    } else {
      triggerAlert('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#F8F9FA] text-[#212529] min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#0D6EFD] text-white flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Film className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[#212529]">FREEDOM</h1>
          <p className="text-[#6C757D] mt-1 text-sm">เข้าสู่ระบบจัดการคลังหนัง</p>
        </div>

        <div
          className={`bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200 ${
            isShaking ? 'shake ring-2 ring-[#DC3545]/40' : ''
          }`}
        >
          {alert && (
            <div
              className={`mb-5 p-3 rounded-lg text-center text-xs sm:text-sm font-medium ${
                alert.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : alert.type === 'warning'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-red-50 text-[#DC3545] border border-red-200'
              }`}
            >
              {alert.message}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[#495057] mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>ชื่อผู้ใช้</span>
                </span>
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD] font-mono text-sm"
                placeholder="กรอกชื่อผู้ใช้"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#495057] mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>รหัสผ่าน</span>
                </span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD] pr-11 font-mono text-sm"
                  placeholder="กรอกรหัสผ่าน"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#212529] p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0D6EFD] hover:bg-[#0B5ED7] disabled:opacity-70 text-white font-medium py-2.5 px-4 rounded-lg transition inline-flex items-center justify-center gap-2 cursor-pointer text-sm"
            >
              {isLoading ? (
                <>
                  <span>กำลังตรวจสอบ...</span>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </>
              ) : (
                <>
                  <span>เข้าสู่ระบบ</span>
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillCredentials('admin', 'Admin123')}
              className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                username === 'admin'
                  ? 'bg-blue-50/70 border-[#0D6EFD] text-[#212529]'
                  : 'bg-[#F8F9FA] border-slate-200 hover:border-slate-300 text-[#495057]'
              }`}
            >
              <div className="font-semibold text-xs flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0D6EFD]" />
                <span>admin</span>
              </div>
              <div className="text-[11px] font-mono text-[#6C757D] mt-0.5">Admin123</div>
            </button>

            <button
              type="button"
              onClick={() => fillCredentials('staff', 'Staff456')}
              className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                username === 'staff'
                  ? 'bg-blue-50/70 border-[#0D6EFD] text-[#212529]'
                  : 'bg-[#F8F9FA] border-slate-200 hover:border-slate-300 text-[#495057]'
              }`}
            >
              <div className="font-semibold text-xs flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <span>staff</span>
              </div>
              <div className="text-[11px] font-mono text-[#6C757D] mt-0.5">Staff456</div>
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-[#6C757D] mt-5">
          <button
            type="button"
            onClick={onGoToPublicSite}
            className="hover:text-[#212529] transition-colors inline-flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ดูตัวอย่างหน้าเว็บ</span>
          </button>
        </p>
      </div>
    </div>
  );
};
