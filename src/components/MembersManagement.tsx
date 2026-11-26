import React, { useState } from 'react';
import { Plus, Search, Trash2, Users } from 'lucide-react';
import { Member } from '../types';

interface MembersManagementProps {
  members: Member[];
  onUpdateMembers: (members: Member[]) => void;
}

export const MembersManagement: React.FC<MembersManagementProps> = ({
  members,
  onUpdateMembers,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plan, setPlan] = useState<Member['plan']>('standard');

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const newMember: Member = {
      id: `mem-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      plan,
      status: 'active',
      joinedAt: new Date().toISOString().split('T')[0],
    };

    onUpdateMembers([newMember, ...members]);
    setName('');
    setEmail('');
    setPhone('');
    setPlan('standard');
  };

  const handleToggleStatus = (id: string) => {
    onUpdateMembers(
      members.map((m) =>
        m.id === id ? { ...m, status: m.status === 'active' ? 'suspended' : 'active' } : m
      )
    );
  };

  const handleDelete = (id: string) => {
    onUpdateMembers(members.filter((m) => m.id !== id));
  };

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const planLabels: Record<Member['plan'], string> = {
    free: 'ทั่วไป',
    standard: 'มาตรฐาน',
    vip: 'VIP',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#212529]">
          สมาชิก
        </h1>
        <p className="text-sm text-[#6C757D] mt-1">
          จัดการรายชื่อสมาชิก แพ็กเกจ และสถานะการใช้งาน
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Member Form */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 h-fit">
          <h2 className="text-base font-bold text-[#212529] mb-4">เพิ่มสมาชิกใหม่</h2>
          <form onSubmit={handleAddMember} className="space-y-4 text-sm">
            <div>
              <label htmlFor="member-name" className="block text-[#495057] font-medium mb-1">
                ชื่อ-นามสกุล *
              </label>
              <input
                id="member-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="กรอกชื่อสมาชิก"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/30 focus:border-[#0D6EFD]"
                required
              />
            </div>

            <div>
              <label htmlFor="member-email" className="block text-[#495057] font-medium mb-1">
                อีเมล *
              </label>
              <input
                id="member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="member@example.com"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/30 focus:border-[#0D6EFD]"
                required
              />
            </div>

            <div>
              <label htmlFor="member-phone" className="block text-[#495057] font-medium mb-1">
                เบอร์โทรศัพท์
              </label>
              <input
                id="member-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08x-xxx-xxxx"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/30 focus:border-[#0D6EFD]"
              />
            </div>

            <div>
              <label htmlFor="member-plan" className="block text-[#495057] font-medium mb-1">
                แพ็กเกจสมาชิก
              </label>
              <select
                id="member-plan"
                value={plan}
                onChange={(e) => setPlan(e.target.value as Member['plan'])}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/30 focus:border-[#0D6EFD]"
              >
                <option value="free">ทั่วไป (Free)</option>
                <option value="standard">มาตรฐาน (Standard)</option>
                <option value="vip">วีไอพี (VIP)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium py-2.5 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>บันทึกสมาชิก</span>
            </button>
          </form>
        </div>

        {/* Members List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#212529]">
              รายชื่อสมาชิก ({members.length.toLocaleString()})
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อหรืออีเมล..."
                className="w-full bg-[#F8F9FA] border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-[#212529] focus:outline-none focus:border-[#0D6EFD] focus:bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#F8F9FA] border-b border-slate-200 text-[#212529] font-bold">
                  <th className="py-3 px-4 sm:px-5 whitespace-nowrap">สมาชิก</th>
                  <th className="py-3 px-4 whitespace-nowrap">แพ็กเกจ</th>
                  <th className="py-3 px-4 whitespace-nowrap">สถานะ</th>
                  <th className="py-3 px-4 whitespace-nowrap">วันที่สมัคร</th>
                  <th className="py-3 px-4 sm:px-5 text-right whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 px-4 text-center text-[#6C757D]">
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      {members.length === 0
                        ? 'ยังไม่มีสมาชิกในระบบ เพิ่มสมาชิกคนแรกได้จากแบบฟอร์มด้านซ้าย'
                        : 'ไม่พบสมาชิกที่ตรงกับคำค้นหา'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 sm:px-5">
                        <div className="font-semibold text-[#212529]">{member.name}</div>
                        <div className="text-xs text-[#6C757D]">
                          {member.email}
                          {member.phone ? ` · ${member.phone}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#495057] whitespace-nowrap">
                        {planLabels[member.plan]}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(member.id)}
                          className={`text-xs font-medium cursor-pointer hover:underline ${
                            member.status === 'active' ? 'text-emerald-700' : 'text-[#DC3545]'
                          }`}
                        >
                          {member.status === 'active' ? 'ใช้งานปกติ' : 'ระงับชั่วคราว'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-[#6C757D] tabular-nums whitespace-nowrap">
                        {member.joinedAt}
                      </td>
                      <td className="py-3 px-4 sm:px-5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(member.id)}
                          aria-label={`ลบสมาชิก ${member.name}`}
                          className="p-1.5 text-slate-400 hover:text-[#DC3545] hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
