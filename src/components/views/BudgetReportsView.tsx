'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { db, Transaction } from '@/lib/db';
import { exportTransactionsToCSV } from '@/lib/export-import';
import { Printer, Download, TrendingDown, TrendingUp, DollarSign, BarChart3, Lightbulb, ReceiptText } from 'lucide-react';

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const BudgetReportsView: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => monthKey(new Date()));
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    let active = true;
    db.transactions.toArray().then((all) => { if (active) setAllTransactions(all); });
    return () => { active = false; };
  }, []);

  const transactions = useMemo(
    () => allTransactions.filter((transaction) => transaction.date.startsWith(selectedMonth)),
    [allTransactions, selectedMonth],
  );

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // Breakdown by category for expenses
  const categoryMap: { [cat: string]: number } = {};
  transactions
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    });

  const categoryBreakdown = Object.entries(categoryMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const monthlyTrend = useMemo(() => {
    const selectedDate = new Date(`${selectedMonth}-01T00:00:00`);
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - (5 - index), 1);
      const key = monthKey(date);
      const monthTransactions = allTransactions.filter((transaction) => transaction.date.startsWith(key));
      return {
        key,
        label: date.toLocaleDateString('ar-EG', { month: 'short' }),
        income: monthTransactions.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + transaction.amount, 0),
        expense: monthTransactions.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0),
      };
    });
  }, [allTransactions, selectedMonth]);
  const chartMax = Math.max(1, ...monthlyTrend.flatMap((month) => [month.income, month.expense]));
  const selectedMonthLabel = new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm no-print">
        <div>
          <h2 className="text-lg font-black text-slate-800">التقارير والتحليل الشهري</h2>
          <p className="text-xs text-slate-500">ملخص شهري يساعدك تعرف دخلت كام، صرفت فين، وإيه اتجاه مصروفاتك</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month selector */}
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none focus:border-brand-500"
          />

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            title="طباعة التقرير أو حفظه كـ PDF"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة / PDF</span>
          </button>

          <button
            onClick={() => exportTransactionsToCSV()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all"
          >
            <Download className="w-4 h-4" />
            <span>إكسيل</span>
          </button>
        </div>
      </div>

      {/* Printable Report Header (visible on print) */}
      <div className="hidden print:block p-4 border-b border-slate-300 text-center mb-6">
        <h1 className="text-2xl font-black text-slate-900">تقرير الإدارة المالية - تطبيق على قدي</h1>
        <p className="text-sm text-slate-600 mt-1">كشف حساب شهر: {selectedMonthLabel}</p>
      </div>

      {/* Monthly Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">إجمالي الدخل في الشهر</div>
            <div className="text-xl font-black font-mono text-emerald-700 mt-0.5">
              {totalIncome.toLocaleString('ar-EG')} ج.م
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">إجمالي المصروفات في الشهر</div>
            <div className="text-xl font-black font-mono text-rose-700 mt-0.5">
              {totalExpense.toLocaleString('ar-EG')} ج.م
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">صافي التوفير (الادخار)</div>
            <div
              className={`text-xl font-black font-mono mt-0.5 ${
                netSavings >= 0 ? 'text-brand-800' : 'text-rose-600'
              }`}
            >
              {netSavings.toLocaleString('ar-EG')} ج.م
            </div>
            {totalIncome > 0 && (
              <div className="text-[11px] text-slate-400">
                معدل الادخار: {savingsRate}% من الدخل
              </div>
            )}
          </div>
        </div>
      </div>

      {transactions.length > 0 && categoryBreakdown[0] && (
        <section className={`flex items-start gap-3 rounded-3xl border p-4 shadow-sm ${netSavings < 0 ? 'border-rose-200 bg-rose-50 text-rose-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${netSavings < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}><Lightbulb className="h-4 w-4" /></span>
          <div>
            <h3 className="text-xs font-black">ملخص يساعدك تاخد قرار</h3>
            <p className="mt-1 text-[11px] leading-5">
              {netSavings < 0
                ? `مصروفاتك زادت عن دخلك بـ ${Math.abs(netSavings).toLocaleString('ar-EG')} ج.م في ${selectedMonthLabel}. أعلى بند صرف هو ${categoryBreakdown[0].category} (${categoryBreakdown[0].percentage}٪).`
                : `أعلى بند صرف في ${selectedMonthLabel} هو ${categoryBreakdown[0].category}: ${categoryBreakdown[0].amount.toLocaleString('ar-EG')} ج.م (${categoryBreakdown[0].percentage}٪ من مصروفاتك).`}
            </p>
          </div>
        </section>
      )}

      {/* Six-month income and expense comparison */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-slate-900"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-800"><BarChart3 className="h-4 w-4" /></span><h3 className="text-sm font-black">اتجاه الدخل والمصروف</h3></div>
            <p className="mt-2 text-[10px] text-slate-500">مقارنة آخر ٦ شهور حتى {selectedMonthLabel}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5 pt-1 text-[9px] font-bold text-slate-600 sm:flex-row sm:gap-3">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />الدخل</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-rose-400" />المصروف</span>
          </div>
        </div>
        {allTransactions.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">سجّل أول حركة عشان يظهر اتجاه الدخل والمصروف هنا.</div>
        ) : (
          <div role="img" aria-label="رسم بياني يقارن إجمالي الدخل والمصروف خلال آخر ستة أشهر" className="mt-5 grid grid-cols-6 gap-2 border-b border-slate-100 pb-2" dir="ltr">
            {monthlyTrend.map((month) => (
              <div key={month.key} className="flex min-w-0 flex-col items-center">
                <div className="flex h-32 w-full items-end justify-center gap-1 border-b border-slate-100 bg-gradient-to-t from-slate-50/80 to-white px-1">
                  <div title={`الدخل ${month.label}: ${month.income.toLocaleString('ar-EG')} ج.م`} className="w-3 rounded-t-md bg-emerald-500 transition-[height] duration-500 sm:w-5" style={{ height: `${month.income > 0 ? Math.max(4, (month.income / chartMax) * 100) : 0}%` }} />
                  <div title={`المصروف ${month.label}: ${month.expense.toLocaleString('ar-EG')} ج.م`} className="w-3 rounded-t-md bg-rose-400 transition-[height] duration-500 sm:w-5" style={{ height: `${month.expense > 0 ? Math.max(4, (month.expense / chartMax) * 100) : 0}%` }} />
                </div>
                <span className="mt-2 truncate text-[9px] font-bold text-slate-500">{month.label}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-1.5 text-[9px] text-slate-400"><ReceiptText className="h-3.5 w-3.5" />حرّك المؤشر فوق أي عمود لمعرفة المبلغ المسجل.</div>
      </section>

      {/* Category Breakdown (Where does money go?) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
        <h3 className="font-bold text-sm text-slate-800 mb-1">توزيع المصروفات حسب البنود</h3>
        <p className="text-xs text-slate-400 mb-5">
          نسبة كل تصنيف من إجمالي مصروفات هذا الشهر ({totalExpense.toLocaleString('ar-EG')} ج.م)
        </p>

        {categoryBreakdown.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            لا توجد مصروفات مسجلة لهذا الشهر.
          </div>
        ) : (
          <div className="space-y-4">
            {categoryBreakdown.map((cat, idx) => (
              <div key={cat.category} className="space-y-1.5">
                <div className="flex justify-between items-baseline text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-700">{cat.category}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-900">
                      {cat.amount.toLocaleString('ar-EG')} ج.م
                    </span>
                    <span className="text-slate-400 text-[11px]">({cat.percentage}%)</span>
                  </div>
                </div>

                <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
