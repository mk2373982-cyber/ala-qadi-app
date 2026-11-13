'use client';

import React, { useState, useEffect } from 'react';
import { db, Transaction, Debt, Gam3eya, SavingsAsset, WalletAccount, seedDefaultWalletsOnce } from '@/lib/db';
import {
  Wallet,
  BellRing,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  HandCoins,
  Landmark,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  Clock3,
  CreditCard,
  Smartphone,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { TabType } from '../Navigation';
import { askForConfirmation } from '@/lib/confirm-action';
import { FinancialPlans } from '@/components/views/FinancialPlans';

interface DashboardViewProps {
  userId: string;
  onOpenAddModal: () => void;
  onNavigate: (tab: TabType) => void;
}

function daysUntilDue(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.UTC(year, month - 1, day) - todayUtc) / 86_400_000);
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userId,
  onOpenAddModal,
  onNavigate,
}) => {
  const getLocalMonthKey = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };
  const [currentMonthStr, setCurrentMonthStr] = useState(getLocalMonthKey);
  const [currentMonthTransactions, setCurrentMonthTransactions] = useState<Transaction[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [totalDebtsToMe, setTotalDebtsToMe] = useState(0);
  const [totalDebtsOnMe, setTotalDebtsOnMe] = useState(0);
  const [debtsDueThisMonth, setDebtsDueThisMonth] = useState<Debt[]>([]);
  const [dueDebtReminders, setDueDebtReminders] = useState<Debt[]>([]);
  const [debtMonthOffset, setDebtMonthOffset] = useState<0 | 1>(0);
  const [activeGam3eyat, setActiveGam3eyat] = useState<Gam3eya[]>([]);
  const [totalSavingsValue, setTotalSavingsValue] = useState(0);
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [editingWalletId, setEditingWalletId] = useState<number | null>(null);
  const [walletName, setWalletName] = useState('');
  const [walletKind, setWalletKind] = useState<WalletAccount['kind']>('cash');
  const [walletOpeningBalance, setWalletOpeningBalance] = useState('0');
  const [monthlyBudgetLimit, setMonthlyBudgetLimit] = useState<number>(0);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudgetInput, setTempBudgetInput] = useState('');

  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const selectedDebtMonthStr = debtMonthOffset === 0 ? currentMonthStr : nextMonthStr;
  const selectedDebtMonthLabel = new Date(
    Number(selectedDebtMonthStr.slice(0, 4)),
    Number(selectedDebtMonthStr.slice(5, 7)) - 1,
    1
  ).toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

  const loadData = async () => {
    await seedDefaultWalletsOnce(userId);
    // Current month transactions
    const all = await db.transactions.toArray();
    const monthTx = all.filter((t) => t.date.startsWith(currentMonthStr));
    setCurrentMonthTransactions(monthTx);

    // Recent 6 transactions
    const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
    setRecentTransactions(sorted);
    setWallets(await db.wallets.toArray());

    // Debts
    const debts = await db.debts.filter((d) => !d.isCompleted).toArray();
    setDueDebtReminders(debts.filter((debt) => debt.type === 'on_me' && debt.dueDate && daysUntilDue(debt.dueDate) <= 3));
    setDebtsDueThisMonth(
      debts
        .filter((debt) => debt.type === 'on_me' && (debt.dueDate?.startsWith(currentMonthStr) || debt.dueDate?.startsWith(nextMonthStr)))
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    );
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
  }, [currentMonthStr, userId]);

  useEffect(() => {
    const refreshMonth = () => {
      setCurrentMonthStr(getLocalMonthKey());
      void db.debts.filter((debt) => !debt.isCompleted && debt.type === 'on_me').toArray()
        .then((debts) => setDueDebtReminders(debts.filter((debt) => debt.dueDate && daysUntilDue(debt.dueDate) <= 3)))
        .catch((error) => console.warn('Could not refresh upcoming debt reminders.', error));
    };
    const interval = window.setInterval(refreshMonth, 60_000);
    window.addEventListener('focus', refreshMonth);
    document.addEventListener('visibilitychange', refreshMonth);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshMonth);
      document.removeEventListener('visibilitychange', refreshMonth);
    };
  }, []);

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
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeftInMonth = Math.max(1, daysInCurrentMonth - now.getDate() + 1);
  const dailyAvailableBudget = monthlyBudgetLimit > 0
    ? Math.floor(Math.max(0, remainingBudget) / daysLeftInMonth)
    : 0;
  const projectedMonthExpense = Math.round((currentMonthExpense / Math.max(1, now.getDate())) * daysInCurrentMonth);
  const projectedBudgetOverrun = monthlyBudgetLimit > 0 && projectedMonthExpense > monthlyBudgetLimit;
  const totalWalletBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const selectedMonthDebts = debtsDueThisMonth.filter((debt) => debt.dueDate?.startsWith(selectedDebtMonthStr));
  const currentMonthDebts = debtsDueThisMonth.filter((debt) => debt.dueDate?.startsWith(currentMonthStr));
  const nextMonthDebts = debtsDueThisMonth.filter((debt) => debt.dueDate?.startsWith(nextMonthStr));
  const getDueTotal = (debts: Debt[]) => debts.reduce(
    (sum, debt) => sum + Math.max(0, debt.totalAmount - debt.paidAmount),
    0
  );

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

  const openWalletAdd = () => {
    setEditingWalletId(null);
    setWalletName('');
    setWalletOpeningBalance('0');
    setWalletKind('cash');
    setIsWalletModalOpen(true);
  };

  const openWalletEdit = (wallet: WalletAccount) => {
    setEditingWalletId(wallet.id ?? null);
    setWalletName(wallet.name);
    setWalletKind(wallet.kind);
    setWalletOpeningBalance(String(wallet.balance));
    setIsWalletModalOpen(true);
  };

  const handleSaveWallet = async (event: React.FormEvent) => {
    event.preventDefault();
    const balance = Number(walletOpeningBalance);
    if (!walletName.trim() || !Number.isFinite(balance)) return;
    if (editingWalletId !== null) {
      await db.wallets.update(editingWalletId, { name: walletName.trim(), kind: walletKind, balance });
    } else {
      await db.wallets.add({ name: walletName.trim(), kind: walletKind, balance, createdAt: Date.now() });
    }
    setWallets(await db.wallets.toArray());
    setIsWalletModalOpen(false);
    setEditingWalletId(null);
  };

  const handleDeleteWallet = async (wallet: WalletAccount) => {
    if (wallet.id === undefined) return;
    const linkedTransactions = await db.transactions.where('walletId').equals(wallet.id).count();
    const confirmed = await askForConfirmation({
      title: 'حذف المكان المالي',
      message: linkedTransactions
        ? `سيتم حذف «${wallet.name}» وفصلها عن ${linkedTransactions} معاملة سابقة. المعاملات نفسها ستظل محفوظة. هل تريد المتابعة؟`
        : `هل تريد حذف «${wallet.name}»؟`,
      itemName: wallet.name,
      confirmLabel: 'حذف المكان',
      tone: 'danger',
    });
    if (!confirmed) return;

    await db.transaction('rw', [db.transactions, db.wallets], async () => {
      const transactions = await db.transactions.where('walletId').equals(wallet.id!).toArray();
      await Promise.all(transactions.map((transaction) => db.transactions.update(transaction.id!, { walletId: undefined })));
      await db.wallets.delete(wallet.id!);
    });
    setWallets(await db.wallets.toArray());
    setIsWalletModalOpen(false);
  };

  const walletKindInfo: Record<WalletAccount['kind'], { label: string; Icon: typeof Wallet; color: string }> = {
    cash: { label: 'نقدي', Icon: Wallet, color: 'bg-emerald-100 text-emerald-800' },
    card: { label: 'بطاقة بنكية', Icon: CreditCard, color: 'bg-sky-100 text-sky-800' },
    mobile: { label: 'محفظة موبايل', Icon: Smartphone, color: 'bg-rose-100 text-rose-700' },
    other: { label: 'مكان آخر', Icon: Landmark, color: 'bg-amber-100 text-amber-800' },
  };
  const walletBeingEdited = wallets.find((wallet) => wallet.id === editingWalletId);

  return (
    <div className="space-y-5 pb-16">
      {dueDebtReminders.length > 0 && (
        <section role="status" aria-live="polite" className="overflow-hidden rounded-3xl border border-orange-300 bg-gradient-to-br from-orange-50 via-white to-rose-50 shadow-sm">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
              {dueDebtReminders.some((debt) => debt.dueDate && daysUntilDue(debt.dueDate) <= 0)
                ? <AlertTriangle className="h-5 w-5" />
                : <BellRing className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-orange-950">تنبيه: مواعيد سداد قريبة</h2>
              <p className="mt-1 text-[11px] leading-5 text-orange-900">ديون عليك مستحقة خلال ٣ أيام أو متأخرة. راجع المبلغ وموعد السداد.</p>
            </div>
            <button type="button" onClick={() => onNavigate('debts')} className="shrink-0 rounded-xl bg-orange-700 px-3 py-2 text-[10px] font-black text-white shadow-sm">عرض الديون</button>
          </div>
          <div className="divide-y divide-orange-100 border-t border-orange-100 bg-white/70 px-4 sm:px-5">
            {dueDebtReminders.slice(0, 3).map((debt) => {
              const days = daysUntilDue(debt.dueDate!);
              const dueLabel = days < 0 ? `متأخر ${Math.abs(days)} يوم` : days === 0 ? 'مستحق اليوم' : `بعد ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
              return (
                <div key={debt.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-slate-800">{debt.personName}</p>
                    <p className={`mt-0.5 text-[10px] font-bold ${days <= 0 ? 'text-rose-700' : 'text-orange-800'}`}>{dueLabel} · {new Date(`${debt.dueDate}T00:00:00`).toLocaleDateString('ar-EG')}</p>
                  </div>
                  <p className="shrink-0 text-xs font-black text-slate-900" dir="ltr">{Math.max(0, debt.totalAmount - debt.paidAmount).toLocaleString('ar-EG')} ج.م</p>
                </div>
              );
            })}
            {dueDebtReminders.length > 3 && <p className="py-2 text-[10px] font-bold text-slate-500">و {dueDebtReminders.length - 3} مواعيد أخرى قريبة</p>}
          </div>
        </section>
      )}

      {/* Unified money overview */}
      <section className="overflow-hidden rounded-[28px] border border-emerald-200 bg-gradient-to-br from-[#f0f8f3] via-white to-[#e7f4ed] shadow-[0_14px_40px_-28px_rgba(5,94,62,0.42)]">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-md shadow-emerald-900/15">
                <Wallet className="h-5 w-5" />
              </div>
            <div className="min-w-0 flex-1">
                <h2 className="text-base font-black text-slate-900">ملخص أموالي</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">اضغط على أي مكان لتعديل بياناته</p>
              </div>
            </div>
            <button type="button" onClick={openWalletAdd} className="flex shrink-0 items-center justify-center gap-1 rounded-xl bg-emerald-800 px-2.5 py-2.5 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-emerald-900 sm:gap-1.5 sm:px-4 sm:text-xs">
              <Plus className="h-4 w-4" /> إضافة مكان
            </button>
          </div>

          <div className="relative mt-4 overflow-hidden rounded-[22px] bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 px-4 py-4 text-white shadow-lg shadow-emerald-950/15 sm:px-5">
            <div className="pointer-events-none absolute -left-8 -top-12 h-36 w-36 rounded-full border-[18px] border-white/5" />
            <div className="relative flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-emerald-100">إجمالي رصيدك الحالي</div>
                <div className="mt-1 text-2xl font-black tracking-tight sm:text-3xl" dir="ltr">{totalWalletBalance.toLocaleString('ar-EG')} <span className="text-sm font-bold text-emerald-100">ج.م</span></div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-center backdrop-blur-sm">
                <div className="text-lg font-black leading-none">{wallets.length.toLocaleString('ar-EG')}</div>
                <div className="mt-1 text-[9px] font-semibold text-emerald-100">أماكن مالية</div>
              </div>
            </div>
          </div>

          {wallets.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
              {wallets.map((wallet) => {
                const info = walletKindInfo[wallet.kind];
                const Icon = info.Icon;
                return (
                  <button type="button" aria-label={`تعديل ${wallet.name}`} onClick={() => openWalletEdit(wallet)} className="min-w-0 rounded-2xl border border-white/90 bg-white/90 p-2 text-right shadow-sm ring-1 ring-emerald-950/[0.035] transition hover:border-emerald-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:p-3">
                    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${info.color}`}><Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="truncate text-[9px] font-bold text-slate-500 sm:text-[10px]">{info.label}</div>
                        <div className="mt-0.5 truncate text-[10px] font-black text-slate-800 sm:text-xs">{wallet.name}</div>
                      </div>
                    </div>
                    <div className="mt-2 truncate text-[11px] font-black text-slate-950 sm:mt-3 sm:text-sm" dir="ltr">{wallet.balance.toLocaleString('ar-EG')} <span className="text-[9px] font-bold text-slate-500 sm:text-[10px]">ج.م</span></div>
                  </button>
                );
              })}
            </div>
          ) : (
            <button type="button" onClick={openWalletAdd} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-white/75 px-4 py-5 text-center text-xs font-bold text-emerald-900 transition hover:bg-white">
              <Plus className="h-4 w-4" /> أضف أول مكان لأموالك، مثل الكاش أو الفيزا أو محفظة الموبايل
            </button>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 border-y border-emerald-200 py-3">
            <div className="rounded-xl bg-white/70 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800"><ArrowDownLeft className="h-3.5 w-3.5" /> دخل الشهر</div>
              <div className="mt-1 text-sm font-black text-slate-800">{currentMonthIncome.toLocaleString('ar-EG')} ج.م</div>
            </div>
            <div className="rounded-xl bg-white/70 p-2.5">
              <div className="flex items-center gap-1 text-[10px] font-bold text-rose-700"><ArrowUpRight className="h-3.5 w-3.5" /> مصروف الشهر</div>
              <div className="mt-1 text-sm font-black text-slate-800">{currentMonthExpense.toLocaleString('ar-EG')} ج.م</div>
            </div>
          </div>

          <div className="pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-800">
                <TrendingDown className="h-4 w-4 text-emerald-700" />
                <span className="text-xs font-black">ميزانية الشهر</span>
              </div>
              {!isEditingBudget ? (
                <button onClick={() => setIsEditingBudget(true)} className="text-[11px] font-bold text-emerald-800 hover:underline">
                  {monthlyBudgetLimit > 0 ? 'تعديل الميزانية' : 'تحديد ميزانية'}
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <input type="number" min="0" placeholder="المبلغ" value={tempBudgetInput} onChange={(event) => setTempBudgetInput(event.target.value)} className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs" />
                  <button onClick={handleSaveBudget} className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-bold text-white">حفظ</button>
                  <button onClick={() => setIsEditingBudget(false)} className="rounded-lg bg-white px-2 py-1 text-xs text-slate-600">إلغاء</button>
                </div>
              )}
            </div>
            {monthlyBudgetLimit > 0 ? (
              <>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-600">
                  <span>المصروف {currentMonthExpense.toLocaleString('ar-EG')} من {monthlyBudgetLimit.toLocaleString('ar-EG')} ج.م</span>
                  <span className={`shrink-0 font-bold ${remainingBudget < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
                    {remainingBudget >= 0 ? `متبقي ${remainingBudget.toLocaleString('ar-EG')}` : `تجاوزت ${Math.abs(remainingBudget).toLocaleString('ar-EG')}`}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${budgetPercentage >= 95 ? 'bg-rose-500' : budgetPercentage >= 75 ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${budgetPercentage}%` }} /></div>
              </>
            ) : <div className="text-[10px] text-slate-500">حدد سقف إنفاقك الشهري لمتابعة المصروفات هنا.</div>}
          </div>
        </div>
        <button type="button" onClick={onOpenAddModal} className="flex w-full items-center justify-center gap-2 bg-emerald-700 px-4 py-3.5 text-sm font-black text-white transition hover:bg-emerald-800">
          <Plus className="h-4 w-4" /> تسجيل حركة
        </button>
      </section>

      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsWalletModalOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="wallet-dialog-title" className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-emerald-100 bg-[#f8fbf9] shadow-2xl sm:rounded-[28px]">
            <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800"><Wallet className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <h3 id="wallet-dialog-title" className="truncate text-sm font-black text-slate-900">{editingWalletId === null ? 'إضافة مكان مالي' : 'تعديل المكان المالي'}</h3>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">حدّث الاسم والنوع والرصيد الحالي</p>
                </div>
              </div>
              <button type="button" aria-label="إغلاق" onClick={() => setIsWalletModalOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </header>

            <div className="overflow-y-auto p-4 sm:p-5">
              <form onSubmit={handleSaveWallet} className="space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
                  <div className="mb-4 flex items-center gap-2 text-xs font-black text-emerald-950"><Wallet className="h-4 w-4" /> بيانات المكان</div>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="wallet-name" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">اسم واضح للمكان</label>
                      <input id="wallet-name" required maxLength={32} value={walletName} onChange={(event) => setWalletName(event.target.value)} placeholder="مثال: كاش البيت، فيزا البنك، فودافون كاش" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" />
                    </div>
                    <div>
                      <label htmlFor="wallet-kind" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">نوع المكان</label>
                      <select id="wallet-kind" value={walletKind} onChange={(event) => setWalletKind(event.target.value as WalletAccount['kind'])} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"><option value="cash">كاش</option><option value="card">فيزا / بطاقة بنكية</option><option value="mobile">محفظة موبايل</option><option value="other">مكان آخر</option></select>
                    </div>
                    <div>
                      <label htmlFor="wallet-balance" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">{editingWalletId === null ? 'الرصيد الموجود الآن' : 'الرصيد الحالي'}</label>
                      <div className="relative">
                        <input id="wallet-balance" required type="number" step="0.01" value={walletOpeningBalance} onChange={(event) => setWalletOpeningBalance(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-14 pr-3.5 text-sm font-bold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" dir="ltr" />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">ج.م</span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-[10px] leading-5 text-sky-900">الحركات الجديدة ستضيف أو تخصم من الرصيد تلقائيًا. تعديل الرصيد هنا يصحح الرصيد الحالي ولا يغيّر سجل معاملاتك السابقة.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="submit" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-800 py-3.5 text-sm font-black text-white shadow-md shadow-emerald-900/10 transition hover:bg-emerald-900 active:scale-[0.99]"><Pencil className="h-4 w-4" />{editingWalletId === null ? 'حفظ المكان' : 'حفظ التعديلات'}</button>
                  {walletBeingEdited && <button type="button" onClick={() => void handleDeleteWallet(walletBeingEdited)} className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"><Trash2 className="h-4 w-4" />حذف</button>}
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      <section className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${projectedBudgetOverrun ? 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50' : 'border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50'}`}>
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${projectedBudgetOverrun ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-800'}`}>
            {projectedBudgetOverrun ? <AlertTriangle className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-900">أصرف كام النهارده؟</h2>
            {monthlyBudgetLimit > 0 ? (
              <>
                <p className={`mt-1 text-2xl font-black ${projectedBudgetOverrun ? 'text-rose-800' : 'text-emerald-800'}`} dir="ltr">
                  {dailyAvailableBudget.toLocaleString('ar-EG')} <span className="text-xs">ج.م / يوم</span>
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-600">
                  متوسط مقترح من المتبقي في الميزانية على {daysLeftInMonth.toLocaleString('ar-EG')} يوم حتى نهاية الشهر.
                </p>
                {projectedBudgetOverrun && (
                  <p className="mt-2 rounded-xl border border-rose-200 bg-white/80 px-3 py-2 text-[11px] font-bold leading-5 text-rose-800">
                    بمعدل صرفك الحالي، متوقع تتجاوز الميزانية بحوالي {Math.max(0, projectedMonthExpense - monthlyBudgetLimit).toLocaleString('ar-EG')} ج.م. قلّل متوسط الصرف اليومي عشان تقرّب من خطتك.
                  </p>
                )}
                {!projectedBudgetOverrun && remainingBudget >= 0 && (
                  <p className="mt-1 text-[10px] font-semibold text-emerald-800">أنت داخل حدود الميزانية حتى الآن.</p>
                )}
              </>
            ) : (
              <>
                <p className="mt-1 text-xs leading-5 text-slate-600">حدد ميزانيتك الشهرية، وهقولك متوسط الصرف اليومي المناسب ومتى تكون قريبًا من تجاوزها.</p>
                <button type="button" onClick={() => setIsEditingBudget(true)} className="mt-2 rounded-xl bg-sky-800 px-3 py-2 text-[11px] font-black text-white">حدد ميزانية الشهر</button>
              </>
            )}
          </div>
        </div>
      </section>

      <FinancialPlans onRefresh={loadData} />

      {/* Debts due this month or next month */}
      <section className="overflow-hidden rounded-3xl border border-orange-200 bg-gradient-to-br from-white via-white to-orange-50/70 shadow-sm">
        <div className="flex items-center gap-3 border-b border-orange-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800">الديون المستحقة عليّ</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {selectedDebtMonthLabel} · حسب تاريخ الاستحقاق
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 px-5 pt-4">
          {([0, 1] as const).map((offset) => {
            const monthDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
            const monthDebts = offset === 0 ? currentMonthDebts : nextMonthDebts;
            const monthTotal = getDueTotal(monthDebts);
            const isSelected = debtMonthOffset === offset;
            return (
              <button
                key={offset}
                type="button"
                onClick={() => setDebtMonthOffset(offset)}
                aria-pressed={isSelected}
                className={`rounded-2xl border p-3 text-right transition active:scale-[0.98] ${isSelected ? 'border-orange-500 bg-orange-600 text-white shadow-md shadow-orange-600/15' : 'border-orange-100 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/60'}`}
              >
                <span className={`block text-[10px] font-bold ${isSelected ? 'text-orange-100' : 'text-slate-500'}`}>
                  {offset === 0 ? 'هذا الشهر' : 'الشهر القادم'} · {monthDate.toLocaleDateString('ar-EG', { month: 'long' })}
                </span>
                <span className="mt-1 block text-sm font-black" dir="ltr">{monthTotal.toLocaleString('ar-EG')} ج.م</span>
                <span className={`mt-1 block text-[10px] ${isSelected ? 'text-orange-100' : 'text-slate-400'}`}>
                  {monthDebts.length.toLocaleString('ar-EG')} {monthDebts.length === 1 ? 'دين مستحق' : 'ديون مستحقة'}
                </span>
              </button>
            );
          })}
        </div>
        {selectedMonthDebts.length ? (
          <div className="divide-y divide-orange-100/80 px-5">
            {selectedMonthDebts.map((debt) => (
              <div key={debt.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-extrabold text-slate-800">{debt.personName}</div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    موعد السداد{' '}
                    {new Date(`${debt.dueDate}T00:00:00`).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div className="shrink-0 text-left">
                  <div className="text-xs font-black text-slate-800" dir="ltr">
                    {Math.max(0, debt.totalAmount - debt.paidAmount).toLocaleString('ar-EG')} ج.م
                  </div>
                  {debt.paidAmount > 0 && <div className="mt-1 text-[10px] text-slate-400">بعد السداد الجزئي</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-5 py-5 text-center text-xs text-slate-500">
            لا توجد ديون عليك غير مكتملة بتاريخ استحقاق في {selectedDebtMonthLabel}.
          </div>
        )}
        <button
          type="button"
          onClick={() => onNavigate('debts')}
          className="flex w-full items-center justify-center gap-1 border-t border-orange-100 px-4 py-3 text-xs font-bold text-brand-700 transition hover:bg-brand-50/60"
        >
          عرض كل الديون <ChevronLeft className="h-4 w-4" />
        </button>
      </section>

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
                      {tx.walletId !== undefined && wallets.find((wallet) => wallet.id === tx.walletId)
                        ? `${wallets.find((wallet) => wallet.id === tx.walletId)?.name} • `
                        : ''}
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
