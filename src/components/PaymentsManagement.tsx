import React, { useState } from 'react';
import { CreditCard, Plus, Power, Trash2 } from 'lucide-react';
import { PaymentMethod } from '../types';

interface PaymentsManagementProps {
  methods: PaymentMethod[];
  onUpdateMethods: (methods: PaymentMethod[]) => void;
}

export const PaymentsManagement: React.FC<PaymentsManagementProps> = ({
  methods,
  onUpdateMethods,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<PaymentMethod['type']>('promptpay');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const typeLabels: Record<PaymentMethod['type'], string> = {
    promptpay: 'พร้อมเพย์ (PromptPay)',
    'bank-transfer': 'โอนผ่านบัญชีธนาคาร',
    'credit-card': 'บัตรเครดิต / เดบิต',
    wallet: 'ทรูมันนี่ / วอลเล็ท',
  };

  const handleAddMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !accountName.trim() || !accountNumber.trim()) return;

    const item: PaymentMethod = {
      id: `pay-${Date.now()}`,
      name: name.trim(),
      type,
      bankName: bankName.trim() || undefined,
      accountName: accountName.trim(),
      accountNumber: accountNumber.trim(),
      active: true,
      createdAt: new Date().toISOString().split('T')[0],
    };

    onUpdateMethods([item, ...methods]);
    setName('');
    setBankName('');
    setAccountName('');
    setAccountNumber('');
  };

  const handleToggle = (id: string) => {
    onUpdateMethods(methods.map((m) => (m.id === id ? { ...m, active: !m.active } : m)));
  };

  const handleDelete = (id: string) => {
    onUpdateMethods(methods.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-[#212529]">
          วิธีชำระเงิน
        </h1>
        <p className="text-sm text-[#6C757D] mt-1">
          กำหนดช่องทางรับชำระค่าสมาชิกและสถานะการเปิดใช้งาน
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 h-fit">
          <h2 className="text-base font-bold text-[#212529] mb-4">เพิ่มช่องทางชำระเงิน</h2>
          <form onSubmit={handleAddMethod} className="space-y-4 text-sm">
            <div>
              <label htmlFor="pay-name" className="block text-[#495057] font-medium mb-1">
                ชื่อช่องทาง *
              </label>
              <input
                id="pay-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="เช่น พร้อมเพย์หลัก"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/30 focus:border-[#0D6EFD]"
                required
              />
            </div>

            <div>
              <label htmlFor="pay-type" className="block text-[#495057] font-medium mb-1">
                ประเภท
              </label>
              <select
                id="pay-type"
                value={type}
                onChange={(e) => setType(e.target.value as PaymentMethod['type'])}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/30 focus:border-[#0D6EFD]"
              >
                <option value="promptpay">พร้อมเพย์ (PromptPay)</option>
                <option value="bank-transfer">โอนผ่านบัญชีธนาคาร</option>
                <option value="credit-card">บัตรเครดิต / เดบิต</option>
                <option value="wallet">ทรูมันนี่ / วอลเล็ท</option>
              </select>
            </div>

            {type === 'bank-transfer' && (
              <div>
                <label htmlFor="pay-bank" className="block text-[#495057] font-medium mb-1">
                  ชื่อธนาคาร
                </label>
                <input
                  id="pay-bank"
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="เช่น กสิกรไทย, ไทยพาณิชย์"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/30 focus:border-[#0D6EFD]"
                />
              </div>
            )}

            <div>
              <label htmlFor="pay-account-name" className="block text-[#495057] font-medium mb-1">
                ชื่อบัญชี *
              </label>
              <input
                id="pay-account-name"
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="กรอกชื่อบัญชีผู้รับเงิน"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/30 focus:border-[#0D6EFD]"
                required
              />
            </div>

            <div>
              <label htmlFor="pay-account-no" className="block text-[#495057] font-medium mb-1">
                เลขบัญชี / เบอร์พร้อมเพย์ *
              </label>
              <input
                id="pay-account-no"
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="กรอกเลขบัญชีหรือเบอร์โทร"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[#212529] font-mono focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/30 focus:border-[#0D6EFD]"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#0D6EFD] hover:bg-[#0B5ED7] text-white font-medium py-2.5 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มวิธีชำระเงิน</span>
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#212529]">
              ช่องทางที่เปิดให้บริการ ({methods.length.toLocaleString()})
            </h2>
          </div>

          <div className="divide-y divide-slate-200">
            {methods.length === 0 ? (
              <div className="py-12 px-4 text-center text-[#6C757D] text-sm">
                <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                ยังไม่มีช่องทางชำระเงินในระบบ กรอกข้อมูลจากแบบฟอร์มด้านซ้ายเพื่อเพิ่มรายการแรก
              </div>
            ) : (
              methods.map((method) => (
                <div
                  key={method.id}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div>
                    <div className="font-semibold text-[#212529] text-sm flex items-center gap-2">
                      <span>{method.name}</span>
                      <span className="text-xs font-normal text-[#6C757D]">
                        · {typeLabels[method.type]}
                      </span>
                    </div>
                    <div className="text-xs text-[#6C757D] mt-1">
                      {method.bankName ? `${method.bankName} · ` : ''}
                      {method.accountName} ·{' '}
                      <span className="font-mono text-[#212529]">{method.accountNumber}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleToggle(method.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                        method.active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{method.active ? 'เปิดใช้งาน' : 'ปิดชั่วคราว'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(method.id)}
                      aria-label={`ลบ ${method.name}`}
                      className="p-1.5 text-slate-400 hover:text-[#DC3545] hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
