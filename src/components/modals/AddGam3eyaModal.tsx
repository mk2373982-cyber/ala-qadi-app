'use client';

import React, { useState } from 'react';
import { db } from '@/lib/db';
import { X, Check, Users, Calculator } from 'lucide-react';

interface AddGam3eyaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const AddGam3eyaModal: React.FC<AddGam3eyaModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [totalMonths, setTotalMonths] = useState('10');
  const [myTurnMonth, setMyTurnMonth] = useState('1');
  const [paidMonths, setPaidMonths] = useState('0');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [isCollected, setIsCollected] = useState(false);

  if (!isOpen) return null;

  const mAmount = parseFloat(monthlyAmount) || 0;
  const tMonths = parseInt(totalMonths) || 1;
  const totalPayout = mAmount * tMonths;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('يرجى كتابة اسم الجمعية');
      return;
    }
    if (mAmount <= 0) {
      alert('يرجى تحديد القسط الشهري');
      return;
    }

    await db.gam3eyat.add({
      name: name.trim(),
      monthlyAmount: mAmount,
      totalMonths: tMonths,
      myTurnMonth: parseInt(myTurnMonth) || 1,
      paidMonths: parseInt(paidMonths) || 0,
      startDate,
      isCollected,
      status: 'active',
    });

    setName('');
    setMonthlyAmount('');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-base text-slate-800">إضافة جمعية شهرية جديدة</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              اسم أو وصف الجمعية
            </label>
            <input
              type="text"
              required
              placeholder="مثال: جمعية الشغل، جمعية الجهاز..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 bg-slate-50/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                القسط الشهري (جنيه)
              </label>
              <input
                type="number"
                min="10"
                required
                placeholder="مثال: 1000"
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:border-brand-500 text-center dir-ltr bg-slate-50/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                عدد الشهور (المدة)
              </label>
              <input
                type="number"
                min="2"
                max="60"
                required
                value={totalMonths}
                onChange={(e) => setTotalMonths(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:border-brand-500 text-center dir-ltr bg-slate-50/50"
              />
            </div>
          </div>

          {/* Computed Payout Banner */}
          {totalPayout > 0 && (
            <div className="p-3 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-between text-xs">
              <span className="text-brand-800 font-medium">مبلغ القبض الإجمالي المتوقع:</span>
              <span className="font-black text-brand-900 text-base font-mono">
                {totalPayout.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                دورك في القبض (رقم الشهر)
              </label>
              <input
                type="number"
                min="1"
                max={totalMonths}
                required
                value={myTurnMonth}
                onChange={(e) => setMyTurnMonth(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:border-brand-500 text-center dir-ltr bg-slate-50/50"
              />
              <span className="text-[10px] text-slate-400">مثال: 3 يعني هتقبض في الشهر الثالث</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                شهور مدفوعة مسبقاً
              </label>
              <input
                type="number"
                min="0"
                max={totalMonths}
                value={paidMonths}
                onChange={(e) => setPaidMonths(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:border-brand-500 text-center dir-ltr bg-slate-50/50"
              />
              <span className="text-[10px] text-slate-400">كم شهر دفعته حتى الآن</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">شهر البداية</label>
            <input
              type="month"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50/50"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isCollectedCheck"
              checked={isCollected}
              onChange={(e) => setIsCollected(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
            />
            <label
              htmlFor="isCollectedCheck"
              className="text-xs font-medium text-slate-700 cursor-pointer"
            >
              قبضت دوري بالفعل في هذه الجمعية
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-brand-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>حفظ الجمعية</span>
          </button>
        </form>
      </div>
    </div>
  );
};
