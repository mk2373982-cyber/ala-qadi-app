'use client';

import React, { useState, useEffect } from 'react';
import { db, Transaction, Debt, Gam3eya, SavingsAsset, Budget } from '@/lib/db';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  HandCoins,
  Landmark,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertTriangle,
  ChevronLeft,
} from 'lucide-react';
import { TabType } from '../Navigation';

interface DashboardViewProps {
  onOpenAddModal: () => void;
  onNavigate: (tab: TabType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenAddModal,
  onNavigate,
}) => {
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [totalDebtsToMe, setTotalDebtsToMe] = useState(0);
  const [totalDebtsOnMe, setTotalDebtsOnMe] = useState(0);
  const [activeGam3eyat, setActiveGam3eyat] = useState<Gam3eya[]>([]);
  const [totalSavingsValue, setTotalSavingsValue] = useState(0);
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState<number>(0);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudgetInput, setTempBudgetInput] = useState('');

  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM

  const loadData = async () => {
    // Current month transactions
    const all = await db.transactions.toArray();
    const monthTx = all.filter((t) => t.date.startsWith(currentMonthStr));
    setCurrentMonthTransactions(monthTx);

    // Recent 6 transactions
    const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
    setRecentTransactions(sorted);

    // Debts
    const debts = await db.debts.filter((d) => !d.isCompleted).toArray();
    const toMe = debts
      .filter((d) => d.type === 'to_me')
      .reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0);
    const onMe = debts
      .filter((d) => d.type === 'on_me')
      .reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0);
    setTotalDebtsToMe(toMe);
    setTotalDebtsOnMe(onMe);

    // Gam3eyat
    const gList = await db.gam3eyat.filter((g) => g.status === 'active').toArray();
    setActiveGam3eyat(gList);

    // Savings
    const savings = await db.savings.toArray();
    const sValue = savings.reduce((sum, s) => {
      const price = s.currentPricePerUnit || s.buyPricePerUnit || 0;
      return sum + s.quantity * price;
    }, 0);
    setTotalSavingsValue(sValue);

    // Budget
    const b = await db.budgets.where('category').equals('TOTAL').first();
    if (b) {
      setMonthlyBudgetLimit(b.monthlyLimit);
      setTempBudgetInput(b.monthlyLimit.toString());
    }
  };

  useEffect(() => {
    loadData();
  }, [currentMonthStr]);

  // Totals
  const currentMonthIncome = currentMonthTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const currentMonthExpense = currentMonthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = currentMonthIncome - currentMonthExpense;

  // Budget calculations
  const budgetPercentage =
    monthlyBudgetLimit > 0
      ? Math.min(Math.round((currentMonthExpense / monthlyBudgetLimit) * 100), 100)
      : 0;
  const remainingBudget = monthlyBudgetLimit > 0 ? monthlyBudgetLimit - currentMonthExpense : 0;

  const handleSaveBudget = async () => {
    const limit = parseFloat(tempBudgetInput);
    if (!isNaN(limit) && limit >= 0) {
      const existing = await db.budgets.where('category').equals('TOTAL').first();
      if (existing && existing.id) {
        await db.budgets.update(existing.id, { monthlyLimit: limit });
      } else {
        await db.budgets.add({ category: 'TOTAL', monthlyLimit: limit });
      }
      setMonthlyBudgetLimit(limit);
      setIsEditingBudget(false);
    }
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Top Welcome / Main Balance Card */}
      <div className="bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-800 rounded-3xl p-6 sm:p-7 text-white shadow-xl shadow-brand-900/10 relative overflow-hidden">
        <div className="absolute top-0 -left-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-100 text-xs font-medium mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                ملخص شهر {new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="text-sm text-brand-200">الصافي المتبقي في جيبك هذا الشهر</div>
            <div className="text-3xl sm:text-4xl font-black mt-1 font-mono tracking-tight flex items-baseline gap-2">
              <span>{netBalance.toLocaleString('ar-EG')}</span>
              <span className="text-base font-normal opacity-80">جنيه</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white text-brand-800 hover:bg-brand-50 active:scale-95 font-bold text-xs sm:text-sm shadow-md transition-all"
            >
              <Plus className="w-4 h-4 text-brand-600" />
              <span>تسجيل مصروف أو دخل</span>
            </button>
          </div>
        </div>

        {/* Quick Month Metrics inside Main Card */}
        <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-white/15">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-emerald-200">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-brand-200">إجمالي الدخل</div>
              <div className="font-bold text-base font-mono">
                {currentMonthIncome.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-rose-200">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-brand-200">إجمالي المصاريف</div>
              <div className="font-bold text-base font-mono">
                {currentMonthExpense.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Budget Tracker Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">ميزانية الشهر</h3>
              <p className="text-[11px] text-slate-400">حدد سقفاً لمصاريفك لتوفير المال</p>
            </div>
          </div>

          {!isEditingBudget ? (
            <button
              onClick={() => setIsEditingBudget(true)}
              className="text-xs text-brand-600 font-bold hover:underline"
            >
              {monthlyBudgetLimit > 0 ? 'تعديل السقف' : '+ تحديد ميزانية'}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="الميزانية"
                value={tempBudgetInput}
                onChange={(e) => setTempBudgetInput(e.target.value)}
                className="w-24 px-2 py-1 text-xs rounded-lg border border-slate-300 font-bold"
              />
              <button
                onClick={handleSaveBudget}
                className="px-2 py-1 bg-brand-600 text-white rounded-lg text-xs font-bold"
              >
                حفظ
              </button>
              <button
                onClick={() => setIsEditingBudget(false)}
                className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs"
              >
                إلغاء
              </button>
            </div>
          )}
        </div>

        {monthlyBudgetLimit > 0 ? (
          <div>
            <div className="flex justify-between items-baseline text-xs mb-1.5 font-medium">
              <span className="text-slate-500">
                صرفت {currentMonthExpense.toLocaleString('ar-EG')} من أصل {monthlyBudgetLimit.toLocaleString('ar-EG')} ج.م
              </span>
              <span
                className={`font-bold font-mono ${
                  remainingBudget < 0
                    ? 'text-rose-600'
                    : remainingBudget < monthlyBudgetLimit * 0.2
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {remainingBudget >= 0
                  ? `متبقي: ${remainingBudget.toLocaleString('ar-EG')} ج.م`
                  : `تجاوزت بـ ${Math.abs(remainingBudget).toLocaleString('ar-EG')} ج.م`}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetPercentage >= 95
                    ? 'bg-rose-500'
                    : budgetPercentage >= 75
                    ? 'bg-amber-500'
                    : 'bg-brand-500'
                }`}
                style={{ width: `${budgetPercentage}%` }}
              />
            </div>
            {budgetPercentage >= 90 && (
              <div className="flex items-center gap-1 text-[11px] text-rose-600 font-medium mt-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>تنبيه: اقتربت من استهلاك كامل ميزانيتك المحددة للشهر!</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-2 text-xs text-slate-400">
            لم تحدد سقفاً للمصروفات بعد. اضغط على تحديد ميزانية بالأعلى لمراقبة إنفاقك.
          </div>
        )}
      </div>

      {/* 3 Quick Cards: Debts, Gam3eyat, Gold */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Debts Card */}
        <div
          onClick={() => onNavigate('debts')}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-300 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <HandCoins className="w-4 h-4" />
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-300" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">ليّا وعليّا (الديون)</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xs text-emerald-600 font-bold">
                ليّا: {totalDebtsToMe.toLocaleString('ar-EG')}
              </span>
              <span className="text-xs text-rose-600 font-bold">
                عليّا: {totalDebtsOnMe.toLocaleString('ar-EG')}
              </span>
            </div>
          </div>
        </div>

        {/* Gam3eyat Card */}
        <div
          onClick={() => onNavigate('gam3eya_gold')}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-300 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-300" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">الجمعيات النشطة</div>
            <div className="mt-1 font-bold text-sm text-slate-800">
              {activeGam3eyat.length > 0
                ? `${activeGam3eyat.length} جمعيات جارية`
                : 'لا توجد جمعيات نشطة'}
            </div>
          </div>
        </div>

        {/* Gold & Savings Card */}
        <div
          onClick={() => onNavigate('gam3eya_gold')}
          className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-300 cursor-pointer transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
            <ChevronLeft className="w-4 h-4 text-slate-300" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">محفظة الذهب والمدخرات</div>
            <div className="mt-1 font-bold text-sm text-slate-800 font-mono">
              {totalSavingsValue > 0
                ? `${totalSavingsValue.toLocaleString('ar-EG')} ج.م`
                : 'أضف مدخراتك'}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-slate-800">آخر المعاملات المسجلة</h3>
          <button
            onClick={() => onNavigate('transactions')}
            className="text-xs text-brand-600 font-bold hover:underline"
          >
            عرض الكل ({currentMonthTransactions.length})
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            لم تسجل أي معاملات بعد. اضغط على "تسجيل معاملة" للبدء الآن!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                      tx.type === 'expense'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {tx.type === 'expense' ? '−' : '+'}
                  </div>
                  <div>
                    <div className="font-bold text-xs sm:text-sm text-slate-800">{tx.category}</div>
                    <div className="text-[11px] text-slate-400">
                      {tx.note ? `${tx.note} • ` : ''}
                      {tx.date}
                    </div>
                  </div>
                </div>

                <div
                  className={`font-bold font-mono text-sm sm:text-base ${
                    tx.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {tx.type === 'expense' ? '-' : '+'}
                  {tx.amount.toLocaleString('ar-EG')} ج.م
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
