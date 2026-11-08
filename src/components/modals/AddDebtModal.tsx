'use client';

import React, { useEffect, useState } from 'react';
import { db, Debt } from '@/lib/db';
import { X, Check, HandCoins } from 'lucide-react';

interface AddDebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialType?: 'to_me' | 'on_me';
  initialDebt?: Debt | null;
}

export const AddDebtModal: React.FC<AddDebtModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialType = 'to_me',
  initialDebt = null,
}) => {
  const [type, setType] = useState<'to_me' | 'on_me'>(initialType);
  const [personName, setPersonName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setType(initialDebt?.type ?? initialType);
    setPersonName(initialDebt?.personName ?? '');
    setTotalAmount(initialDebt?.totalAmount.toString() ?? '');
    setPaidAmount(initialDebt?.paidAmount.toString() ?? '0');
    setDueDate(initialDebt?.dueDate ?? '');
    setNote(initialDebt?.note ?? '');
  }, [isOpen, initialDebt, initialType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseFloat(totalAmount);
    const paid = parseFloat(paidAmount || '0');

    if (!personName.trim()) {
      alert('يرجى إدخال اسم الشخص أو الجهة');
      return;
    }

    if (isNaN(total) || total <= 0) {
      alert('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (isNaN(paid) || paid < 0 || paid > total) {
      alert('يرجى التأكد أن المبلغ المسدد لا يتجاوز إجمالي الدين');
      return;
    }

    const debtValues = {
      type,
      personName: personName.trim(),
      totalAmount: total,
      paidAmount: paid,
      dueDate: dueDate || undefined,
      note: note.trim() || undefined,
      isCompleted: paid >= total,
    };

    if (initialDebt?.id) {
      await db.debts.update(initialDebt.id, debtValues);
    } else {
      await db.debts.add({ ...debtValues, createdAt: Date.now() });
    }

    setPersonName('');
    setTotalAmount('');
    setPaidAmount('0');
    setDueDate('');
    setNote('');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-brand-600" />
            <h3 className="font-bold text-base text-slate-800">{initialDebt ? 'تعديل بيانات الدين' : 'إضافة دين أو مستحق جديد'}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Toggle To Me vs On Me */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('to_me')}
              className={`py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                type === 'to_me'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              فلوس ليّا (سلفته لحد)
            </button>
            <button
              type="button"
              onClick={() => setType('on_me')}
              className={`py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                type === 'on_me'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ديون عليّا (ملتزم بيه)
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              {type === 'to_me' ? 'اسم الشخص المستلف' : 'اسم الدائن أو الجهة'}
            </label>
            <input
              type="text"
              required
              placeholder="مثال: محمد علي، أو قسط الثلاجة..."
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 bg-slate-50/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">المبلغ الإجمالي</label>
              <input
                type="number"
                step="any"
                min="1"
                required
                placeholder="0.00"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:border-brand-500 text-center dir-ltr bg-slate-50/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">تم سداد منه حتى الآن</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:border-brand-500 text-center dir-ltr bg-slate-50/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">موعد السداد المتوقع (اختياري)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظة</label>
              <input
                type="text"
                placeholder="تفاصيل الاتفاق..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50/50"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-brand-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>{initialDebt ? 'حفظ التعديلات' : 'حفظ في السجل'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
