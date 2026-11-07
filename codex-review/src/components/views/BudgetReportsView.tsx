'use client';

import React, { useState, useEffect } from 'react';
import { db, Transaction } from '@/lib/db';
import { exportTransactionsToCSV } from '@/lib/export-import';
import { PieChart, Printer, Download, Calendar, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';

export const BudgetReportsView: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    db.transactions.toArray().then((all) => {
      setTransactions(all.filter((t) => t.date.startsWith(selectedMonth)));
    });
  }, [selectedMonth]);

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

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm no-print">
        <div>
          <h2 className="text-lg font-black text-slate-800">التقارير والتحليل الشهري</h2>
          <p className="text-xs text-slate-500">نظرة واضحة على أين تذهب أموالك شهرياً وكيف توفر</p>
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
        <p className="text-sm text-slate-600 mt-1">كشف حساب شهر: {selectedMonth}</p>
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
