'use client';

import React, { useState, useEffect } from 'react';
import { db, Category, DEFAULT_CATEGORIES } from '@/lib/db';
import { X, Check, Plus, Tag } from 'lucide-react';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Load categories
  useEffect(() => {
    if (isOpen) {
      db.categories
        .filter((c) => c.type === type)
        .toArray()
        .then((cats) => {
          setCategories(cats);
          if (cats.length > 0 && !category) {
            setCategory(cats[0].name);
          }
        });
    }
  }, [isOpen, type]);

  // When type changes, update category selection
  const handleTypeChange = (newType: 'expense' | 'income') => {
    setType(newType);
    db.categories
      .filter((c) => c.type === newType)
      .toArray()
      .then((cats) => {
        setCategories(cats);
        if (cats.length > 0) {
          setCategory(cats[0].name);
        }
      });
  };

  const handleAddNewCategory = async () => {
    if (!newCatName.trim()) return;
    const addedId = await db.categories.add({
      name: newCatName.trim(),
      type: type,
      icon: 'Tag',
      color: type === 'expense' ? '#f43f5e' : '#10b981',
    });
    const refreshed = await db.categories.filter((c) => c.type === type).toArray();
    setCategories(refreshed);
    setCategory(newCatName.trim());
    setNewCatName('');
    setIsAddingNewCategory(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('يرجى كتابة مبلغ صحيح');
      return;
    }

    if (!category) {
      alert('يرجى اختيار تصنيف');
      return;
    }

    await db.transactions.add({
      type,
      amount: numAmount,
      category,
      note: note.trim() || undefined,
      date,
      createdAt: Date.now(),
    });

    // Reset and close
    setAmount('');
    setNote('');
    onSaved();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
          <h3 className="font-bold text-base text-slate-800">تسجيل معاملة جديدة</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Type Toggle: Expense / Income */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                type === 'expense'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              مصروف (خرج مني)
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              دخل (دخل لي)
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">المبلغ (جنيه)</label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.01"
                required
                autoFocus
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-2xl font-black text-slate-800 px-4 py-3 rounded-2xl border-2 border-slate-200 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 text-center dir-ltr"
              />
              <span className="absolute left-4 top-4 text-xs font-bold text-slate-400">ج.م</span>
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-600">التصنيف</label>
              <button
                type="button"
                onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                className="text-[11px] text-brand-700 hover:underline flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3 h-3" />
                <span>إضافة تصنيف جديد</span>
              </button>
            </div>

            {isAddingNewCategory && (
              <div className="flex gap-2 mb-2 p-2 rounded-xl bg-slate-50 border border-slate-200">
                <input
                  type="text"
                  placeholder="اسم التصنيف الجديد..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={handleAddNewCategory}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold"
                >
                  حفظ
                </button>
              </div>
            )}

            {/* Chips */}
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50/50">
              {categories.map((c) => {
                const isSelected = category === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setCategory(c.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm scale-95'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{c.name}</span>
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Note in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">التاريخ</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50/50"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ملاحظة (اختياري)</label>
              <input
                type="text"
                placeholder="تفاصيل إضافية..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50/50"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-brand-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>حفظ المعاملة</span>
          </button>
        </form>
      </div>
    </div>
  );
};
