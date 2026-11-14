'use client';

import React, { useState } from 'react';
import { db } from '@/lib/db';
import { X, Check, Landmark, Sparkles } from 'lucide-react';

interface AddSavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const AddSavingsModal: React.FC<AddSavingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [type, setType] = useState<'gold_21' | 'gold_24' | 'usd' | 'cash_cert'>('gold_21');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const qty = parseFloat(quantity) || 0;
  const cPrice = parseFloat(currentPrice) || parseFloat(buyPrice) || 0;
  const bPrice = parseFloat(buyPrice) || 0;
  const totalValue = qty * cPrice;
  const totalCost = qty * bPrice;
  const profitLoss = totalValue - totalCost;

  const unitLabel = type === 'usd' ? 'دولار' : type === 'cash_cert' ? 'جنيه' : 'جرام';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('يرجى إدخال اسم الأصل أو القطعة');
      return;
    }
    if (qty <= 0) {
      alert('يرجى تحديد كمية صحيحة');
      return;
    }

    await db.savings.add({
      type,
      name: name.trim(),
      quantity: qty,
      buyPricePerUnit: bPrice,
      currentPricePerUnit: cPrice,
      date,
      note: note.trim() || undefined,
    });

    setName('');
    setQuantity('');
    setBuyPrice('');
    setCurrentPrice('');
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-base text-slate-800">إضافة أصل أو مدخرات (ذهب / عملة)</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Asset Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">نوع الأصل</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('gold_21')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                  type === 'gold_21'
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ذهب عيار 21
              </button>
              <button
                type="button"
                onClick={() => setType('gold_24')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                  type === 'gold_24'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ذهب عيار 24 (سبائك)
              </button>
              <button
                type="button"
                onClick={() => setType('usd')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                  type === 'usd'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                دولار أمريكي (USD)
              </button>
              <button
                type="button"
                onClick={() => setType('cash_cert')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                  type === 'cash_cert'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                شهادة بنكية / وديعة
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">اسم أو وصف القطعة</label>
            <input
              type="text"
              required
              placeholder="مثال: سبيكة BTC 10 جرام، أو جنيه ذهب..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-500 bg-slate-50/50"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                الكمية ({unitLabel})
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                placeholder="10"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 text-center dir-ltr focus:outline-none focus:border-brand-500 bg-slate-50/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                سعر الشراء للوحدة
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 text-center dir-ltr focus:outline-none focus:border-brand-500 bg-slate-50/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                السعر الحالي للوحدة
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 text-center dir-ltr focus:outline-none focus:border-brand-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Value and profit summary */}
          {totalValue > 0 && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-500">القيمة الإجمالية المقدرة: </span>
                <span className="font-bold text-slate-900 font-mono">
                  {totalValue.toLocaleString('ar-EG')} ج.م
                </span>
              </div>
              {bPrice > 0 && (
                <div
                  className={`font-bold font-mono ${
                    profitLoss >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {profitLoss >= 0 ? '+' : ''}
                  {profitLoss.toLocaleString('ar-EG')} ج.م
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ الاقتناء</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظة</label>
              <input
                type="text"
                placeholder="فاتورة، مكان الحفظ..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50/50"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>حفظ في محفظة المدخرات</span>
          </button>
        </form>
      </div>
    </div>
  );
};
