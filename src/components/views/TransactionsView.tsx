'use client';

import React, { useState, useEffect } from 'react';
import { db, Transaction, Category } from '@/lib/db';
import { exportTransactionsToCSV } from '@/lib/export-import';
import { askForConfirmation } from '@/lib/confirm-action';
import {
  Search,
  Filter,
  Download,
  Trash2,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
} from 'lucide-react';

interface TransactionsViewProps {
  onOpenAddModal: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ onOpenAddModal }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  const loadData = async () => {
    const all = await db.transactions.toArray();
    setTransactions(all);
    const cats = await db.categories.toArray();
    setCategories(cats);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id?: number) => {
    if (id === undefined) return;
    const transaction = transactions.find((item) => item.id === id);
    if (!transaction) return;
    const confirmed = await askForConfirmation({
      title: 'تأكيد حذف المعاملة',
      message: 'هل أنت متأكد من حذف هذه المعاملة؟ لا يمكن التراجع عن الحذف.',
      itemName: `${transaction.category} · ${transaction.amount.toLocaleString('ar-EG')} ج.م`,
    });
    if (!confirmed) return;
    await db.transactions.delete(id);
    loadData();
  };

  // Filter transactions
  const filtered = transactions.filter((t) => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (selectedMonth && !t.date.startsWith(selectedMonth)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCat = t.category.toLowerCase().includes(q);
      const matchNote = (t.note || '').toLowerCase().includes(q);
      if (!matchCat && !matchNote) return false;
    }
    return true;
  });

  // Sort descending by date & created
  filtered.sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.createdAt - a.createdAt;
  });

  const totalExpense = filtered
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const totalIncome = filtered
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-4 pb-16">
      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-800">سجل المعاملات</h2>
          <p className="text-xs text-slate-500">تتبع تفاصيل كل قرش صرفته أو دخل لك</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportTransactionsToCSV()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            title="تصدير ملف إكسيل CSV"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>تصدير إكسيل</span>
          </button>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>معاملة جديدة</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="بحث في التصنيف أو الملاحظات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50"
            />
          </div>

          {/* Month filter */}
          <div className="relative">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50"
            />
          </div>

          {/* Category filter */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50"
            >
              <option value="all">كل التصنيفات</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Type Filter Buttons */}
        <div className="flex gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل ({transactions.length})
          </button>
          <button
            onClick={() => setFilterType('expense')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'expense'
                ? 'bg-rose-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            المصروفات فقط
          </button>
          <button
            onClick={() => setFilterType('income')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === 'income'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الدخل فقط
          </button>
        </div>
      </div>

      {/* Filtered Metrics Strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-rose-50 border border-rose-200/80 p-3.5 rounded-2xl flex items-center justify-between">
          <div className="text-xs text-rose-700 font-bold">إجمالي المصروف المفلتر:</div>
          <div className="font-mono font-black text-rose-800 text-sm sm:text-base">
            {totalExpense.toLocaleString('ar-EG')} ج.م
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200/80 p-3.5 rounded-2xl flex items-center justify-between">
          <div className="text-xs text-emerald-700 font-bold">إجمالي الدخل المفلتر:</div>
          <div className="font-mono font-black text-emerald-800 text-sm sm:text-base">
            {totalIncome.toLocaleString('ar-EG')} ج.م
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            لا توجد معاملات تطابق عوامل التصفية الحالية.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((tx) => (
              <div
                key={tx.id}
                className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 p-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      tx.type === 'expense'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {tx.type === 'expense' ? (
                      <ArrowUpRight className="w-5 h-5 text-rose-500" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-800">
                      {tx.category}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span>{tx.date}</span>
                      {tx.note && <span>• {tx.note}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`font-mono font-bold text-sm sm:text-base ${
                      tx.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    {tx.type === 'expense' ? '-' : '+'}
                    {tx.amount.toLocaleString('ar-EG')} ج.م
                  </div>

                  <button
                    onClick={() => handleDelete(tx.id)}
                    title="حذف المعاملة"
                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
