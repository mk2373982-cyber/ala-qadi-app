'use client';

import React, { useState, useEffect } from 'react';
import { db, Transaction, Category, WalletAccount } from '@/lib/db';
import { exportTransactionsToCSV } from '@/lib/export-import';
import { askForConfirmation } from '@/lib/confirm-action';
import { formatCurrency, formatDate } from '@/lib/formatters';
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
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const loadData = async () => {
    const all = await db.transactions.toArray();
    setTransactions(all);
    const cats = await db.categories.toArray();
    setCategories(cats);
    setWallets(await db.wallets.toArray());
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
    await db.transaction('rw', [db.transactions, db.wallets], async () => {
      await db.transactions.delete(id);
      if (transaction.walletId !== undefined) {
        const wallet = await db.wallets.get(transaction.walletId);
        if (wallet?.id) {
          await db.wallets.update(wallet.id, {
            balance:
              wallet.balance +
              (transaction.type === 'income' ? -transaction.amount : transaction.amount),
          });
        }
      }
    });
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

  const totalIncome = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-4 pb-4">
      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-800">سجل المعاملات</h2>
          <p className="text-xs text-slate-500">تتبع تفاصيل كل قرش صرفته أو دخل لك</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportTransactionsToCSV()}
            aria-label="تصدير الحركات إلى ملف CSV"
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
            title="تصدير ملف إكسيل CSV"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>تصدير إكسيل</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
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
              aria-label="ابحث في الحركات"
              type="text"
              placeholder="بحث في التصنيف أو الملاحظات…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50"
            />
          </div>

          {/* Month filter */}
          <div className="relative">
            <input
              aria-label="اختر شهر الحركات"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-brand-500 bg-slate-50"
            />
          </div>

          {/* Category filter */}
          <div>
            <select
              aria-label="اختر تصنيف الحركات"
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
            type="button"
            onClick={() => setFilterType('all')}
            aria-pressed={filterType === 'all'}
            className={`min-h-11 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${
              filterType === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            الكل ({transactions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('expense')}
            aria-pressed={filterType === 'expense'}
            className={`min-h-11 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-700 ${
              filterType === 'expense'
                ? 'bg-rose-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            المصروفات فقط
          </button>
          <button
            type="button"
            onClick={() => setFilterType('income')}
            aria-pressed={filterType === 'income'}
            className={`min-h-11 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="bg-rose-50 border border-rose-200/80 p-3.5 rounded-2xl flex items-center justify-between gap-2">
          <div className="text-xs text-rose-700 font-bold">إجمالي المصروف المفلتر:</div>
          <div
            className="shrink-0 font-black tabular-nums text-rose-900 text-sm sm:text-base"
            dir="ltr"
          >
            {formatCurrency(totalExpense)}
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200/80 p-3.5 rounded-2xl flex items-center justify-between gap-2">
          <div className="text-xs text-emerald-700 font-bold">إجمالي الدخل المفلتر:</div>
          <div
            className="shrink-0 font-black tabular-nums text-emerald-900 text-sm sm:text-base"
            dir="ltr"
          >
            {formatCurrency(totalIncome)}
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
                className="flex min-w-0 items-center justify-between gap-2 rounded-xl p-2 py-3 transition-colors hover:bg-slate-50/50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
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
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-xs text-slate-800 sm:text-sm">
                      {tx.category}
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden text-[11px] text-slate-500">
                      <span className="shrink-0">{formatDate(tx.date)}</span>
                      {tx.walletId !== undefined &&
                        wallets.find((wallet) => wallet.id === tx.walletId) && (
                          <span className="truncate">
                            • {wallets.find((wallet) => wallet.id === tx.walletId)?.name}
                          </span>
                        )}
                      {tx.note && <span className="truncate">• {tx.note}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
                  <div
                    className={`min-w-0 text-left text-[12px] font-bold tabular-nums sm:text-base ${
                      tx.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                    }`}
                  >
                    <span className="block text-[9px] font-bold text-slate-700">
                      {tx.type === 'expense' ? 'مصروف' : 'دخل'}
                    </span>
                    <span dir="ltr">
                      {tx.type === 'expense' ? '−' : '+'}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(tx.id)}
                    title="حذف المعاملة"
                    aria-label={`حذف حركة ${tx.type === 'expense' ? 'مصروف' : 'دخل'} ${formatCurrency(tx.amount)} بتاريخ ${formatDate(tx.date)}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-700"
                  >
                    <Trash2 aria-hidden="true" className="w-4 h-4" />
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
