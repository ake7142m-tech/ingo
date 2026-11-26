import React, { useState } from 'react';
import { ArrowLeftRight, Shield, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { User, UserRole } from '../types';

interface UsersManagementProps {
  users: User[];
  currentUser: User | null;
  dualSessions: User[];
  onUpdateUsers: (users: User[]) => void;
  onSwitchUser: (user: User) => void;
  onToggleDualUser?: () => void;
  onSetDualSessions?: (sessions: User[]) => void;
}

export const UsersManagement: React.FC<UsersManagementProps> = ({
  users,
  currentUser,
  onUpdateUsers,
  onSwitchUser,
}) => {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    const newUser: User = {
      id: `user-${Date.now()}`,
      username: username.trim().toLowerCase(),
      name: name.trim() || username.trim(),
      role,
      email: email.trim() || `${username.trim().toLowerCase()}@freedom.com`,
      password: password.trim(),
      avatar: '',
    };

    onUpdateUsers([...users, newUser]);
    setUsername('');
    setName('');
    setPassword('');
    setEmail('');
    setNotice(null);
  };

  const handleDeleteUser = (id: string) => {
    if (users.length <= 1) {
      setNotice('ไม่สามารถลบผู้ดูแลระบบทั้งหมดได้ ต้องมีอย่างน้อย 1 บัญชี');
      return;
    }
    setNotice(null);
    onUpdateUsers(users.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#212529]">
          ผู้ดูแลระบบ
        </h1>
        <p className="text-sm text-[#6C757D] mt-1">
          จัดการบัญชีผู้ดูแลระบบและสิทธิ์การเข้าถึงหลังบ้าน
        </p>
      </div>

      {notice && (
        <div className="bg-red-50 border border-red-200 text-[#DC3545] rounded-xl px-4 py-3 text-sm">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Admin Form */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/90 shadow-xs h-fit">
          <h2 className="text-base font-bold text-[#212529] mb-4">เพิ่มผู้ดูแลระบบ</h2>

          <form onSubmit={handleAddUser} className="space-y-4 text-sm">
            <div>
              <label htmlFor="admin-username" className="block text-[#495057] font-medium mb-1">
                ชื่อผู้ใช้ *
              </label>
              <input
                id="admin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="เช่น admin02"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD]"
                required
              />
            </div>

            <div>
              <label htmlFor="admin-name" className="block text-[#495057] font-medium mb-1">
                ชื่อที่แสดง
              </label>
              <input
                id="admin-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ผู้ดูแลระบบ"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD]"
              />
            </div>

            <div>
              <label htmlFor="admin-email" className="block text-[#495057] font-medium mb-1">
                อีเมล
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@freedom.com"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD]"
              />
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-[#495057] font-medium mb-1">
                รหัสผ่านเริ่มต้น *
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD]"
                required
              />
            </div>

            <div>
              <label htmlFor="admin-role" className="block text-[#495057] font-medium mb-1">
                บทบาท
              </label>
              <select
                id="admin-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/25 focus:border-[#0D6EFD]"
              >
                <option value="admin">ผู้ดูแลระบบสูงสุด (Admin)</option>
                <option value="staff">เจ้าหน้าที่ดูแลเนื้อหา (Staff)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium py-2.5 px-4 rounded-lg transition inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>เพิ่มบัญชีผู้ดูแล</span>
            </button>
          </form>
        </div>

        {/* Admin List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#212529]">
              บัญชีในระบบ ({users.length.toLocaleString()})
            </h2>
          </div>

          <div className="divide-y divide-slate-200">
            {users.map((user) => {
              const isCurrent = currentUser?.username === user.username;
              return (
                <div
                  key={user.id}
                  className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold uppercase border shrink-0 ${
                        isCurrent
                          ? 'bg-blue-50 border-[#0D6EFD]/40 text-[#0D6EFD]'
                          : 'bg-slate-100 border-slate-200 text-[#495057]'
                      }`}
                    >
                      {user.username.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-[#212529]">{user.username}</span>
                        {isCurrent && (
                          <span className="text-xs font-medium text-emerald-700">
                            · กำลังใช้งาน
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#6C757D] mt-0.5">
                        {user.name} · <span className="font-mono">{user.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto">
                    <span className="text-xs text-[#495057] inline-flex items-center gap-1">
                      {user.role === 'admin' ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-[#0D6EFD]" />
                          <span>Admin</span>
                        </>
                      ) : (
                        <>
                          <Shield className="w-3.5 h-3.5 text-slate-500" />
                          <span>Staff</span>
                        </>
                      )}
                    </span>

                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => onSwitchUser(user)}
                        className="text-xs bg-white hover:bg-slate-50 text-[#212529] border border-slate-300 px-3 py-1.5 rounded-lg transition cursor-pointer font-medium inline-flex items-center gap-1"
                      >
                        <ArrowLeftRight className="w-3 h-3 text-[#0D6EFD]" />
                        <span>สลับบัญชี</span>
                      </button>
                    )}

                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(user.id)}
                        aria-label={`ลบบัญชี ${user.username}`}
                        className="p-1.5 text-slate-400 hover:text-[#DC3545] hover:bg-red-50 rounded-md transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
