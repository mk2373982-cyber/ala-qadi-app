'use client';

import React, { useState, useEffect } from 'react';
import {
  db,
  Transaction,
  Debt,
  Gam3eya,
  WalletAccount,
  seedDefaultWalletsOnce,
} from '@/lib/db';
import {
  Wallet,
  BellRing,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Landmark,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Clock3,
  CreditCard,
  Smartphone,
  Repeat2,
  Target,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { TabType } from '../Navigation';
import { askForConfirmation } from '@/lib/confirm-action';
import { FinancialPlans } from '@/components/views/FinancialPlans';
import { formatAmount, formatCurrency, formatDate } from '@/lib/formatters';

interface PlansSummary {
  goalCount: number;
  goalsSaved: number;
  recurringCount: number;
  recurringTotal: number;
}

const EMPTY_PLANS_SUMMARY: PlansSummary = {
  goalCount: 0,
  goalsSaved: 0,
  recurringCount: 0,
  recurringTotal: 0,
};

interface DashboardViewProps {
  userId: string;
  userName?: string;
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
  userName,
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
  const [expandedDebtMonth, setExpandedDebtMonth] = useState<0 | 1 | null>(null);
  const [activeGam3eyat, setActiveGam3eyat] = useState<Gam3eya[]>([]);
  const [totalSavingsValue, setTotalSavingsValue] = useState(0);
  const [totalGoldValue, setTotalGoldValue] = useState(0);
  const [plansSummary, setPlansSummary] = useState<PlansSummary>(EMPTY_PLANS_SUMMARY);
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
  const selectedDebtMonthStr = expandedDebtMonth === 1 ? nextMonthStr : currentMonthStr;
  const selectedDebtMonthLabel = new Date(
    Number(selectedDebtMonthStr.slice(0, 4)),
    Number(selectedDebtMonthStr.slice(5, 7)) - 1,
    1,
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
    setDueDebtReminders(
      debts.filter(
        (debt) => debt.type === 'on_me' && debt.dueDate && daysUntilDue(debt.dueDate) <= 3,
      ),
    );
    setDebtsDueThisMonth(
      debts
        .filter(
          (debt) =>
            debt.type === 'on_me' &&
            (debt.dueDate?.startsWith(currentMonthStr) || debt.dueDate?.startsWith(nextMonthStr)),
        )
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')),
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
    setTotalGoldValue(
      savings
        .filter((asset) => asset.type === 'gold_21' || asset.type === 'gold_24')
        .reduce(
          (sum, asset) =>
            sum + asset.quantity * (asset.currentPricePerUnit || asset.buyPricePerUnit || 0),
          0,
        ),
    );

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
      void db.debts
        .filter((debt) => !debt.isCompleted && debt.type === 'on_me')
        .toArray()
        .then((debts) =>
          setDueDebtReminders(
            debts.filter((debt) => debt.dueDate && daysUntilDue(debt.dueDate) <= 3),
          ),
        )
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
  const currentMonthExpense = currentMonthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const currentMonthIncome = currentMonthTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  // Budget calculations
  const remainingBudget = monthlyBudgetLimit > 0 ? monthlyBudgetLimit - currentMonthExpense : 0;
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeftInMonth = Math.max(1, daysInCurrentMonth - now.getDate() + 1);
  const dailyAvailableBudget =
    monthlyBudgetLimit > 0 ? Math.floor(Math.max(0, remainingBudget) / daysLeftInMonth) : 0;
  const projectedMonthExpense = Math.round(
    (currentMonthExpense / Math.max(1, now.getDate())) * daysInCurrentMonth,
  );
  const projectedBudgetOverrun =
    monthlyBudgetLimit > 0 && projectedMonthExpense > monthlyBudgetLimit;
  const totalWalletBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);
  const selectedMonthDebts =
    expandedDebtMonth === null
      ? []
      : debtsDueThisMonth.filter((debt) => debt.dueDate?.startsWith(selectedDebtMonthStr));
  const currentMonthDebts = debtsDueThisMonth.filter((debt) =>
    debt.dueDate?.startsWith(currentMonthStr),
  );
  const nextMonthDebts = debtsDueThisMonth.filter((debt) => debt.dueDate?.startsWith(nextMonthStr));
  const getDueTotal = (debts: Debt[]) =>
    debts.reduce((sum, debt) => sum + Math.max(0, debt.totalAmount - debt.paidAmount), 0);

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
      await db.wallets.update(editingWalletId, {
        name: walletName.trim(),
        kind: walletKind,
        balance,
      });
    } else {
      await db.wallets.add({
        name: walletName.trim(),
        kind: walletKind,
        balance,
        createdAt: Date.now(),
      });
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
      await Promise.all(
        transactions.map((transaction) =>
          db.transactions.update(transaction.id!, { walletId: undefined }),
        ),
      );
      await db.wallets.delete(wallet.id!);
    });
    setWallets(await db.wallets.toArray());
    setIsWalletModalOpen(false);
  };

  const walletKindInfo: Record<
    WalletAccount['kind'],
    { label: string; Icon: typeof Wallet; color: string }
  > = {
    cash: { label: 'نقدي', Icon: Wallet, color: 'bg-emerald-100 text-emerald-800' },
    card: { label: 'بطاقة بنكية', Icon: CreditCard, color: 'bg-sky-100 text-sky-800' },
    mobile: { label: 'محفظة موبايل', Icon: Smartphone, color: 'bg-rose-100 text-rose-700' },
    other: { label: 'مكان آخر', Icon: Landmark, color: 'bg-amber-100 text-amber-800' },
  };
  const walletBeingEdited = wallets.find((wallet) => wallet.id === editingWalletId);

  return (
    <div className="space-y-4 pb-4 sm:space-y-5">
      <header className="flex items-end justify-between gap-3 px-1 pt-1">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black text-slate-900 sm:text-xl">
            أهلاً {userName?.trim().split(/\s+/)[0] || 'بيك'}
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-600">
            {formatDate(`${currentMonthStr}-01`, { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <p className="pb-0.5 text-[10px] text-slate-500">خلّي قراراتك على قدّك</p>
      </header>

      {/* Unified money overview */}
      <section className="space-y-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-800 text-white">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-slate-900">ملخص أموالي</h3>
                <p className="mt-0.5 text-[10px] text-slate-600">رصيدك الحالي على كل الأماكن</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openWalletAdd}
              aria-label="إضافة مكان مالي"
              className="flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-extrabold text-emerald-950 transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 sm:gap-1.5 sm:px-4 sm:text-xs"
            >
              <Plus className="h-4 w-4" /> إضافة مكان
            </button>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-emerald-900 px-4 py-4 text-white sm:px-5">
            <div className="relative flex items-end justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold text-emerald-100">
                  إجمالي رصيدك الحالي
                </div>
                <div
                  className="mt-1 text-2xl font-black tracking-tight tabular-nums sm:text-3xl"
                  dir="ltr"
                >
                  {formatCurrency(totalWalletBalance)}
                </div>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-center">
                <div className="text-lg font-black leading-none">
                  {formatAmount(wallets.length)}
                </div>
                <div className="mt-1 text-[9px] font-semibold text-emerald-100">أماكن مالية</div>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
            <article className="rounded-xl border border-rose-100 bg-rose-50/70 p-3">
              <p className="text-[10px] font-bold text-rose-900">مصروف الشهر</p>
              <p className="mt-1 text-sm font-black tabular-nums text-rose-950" dir="ltr">
                {formatCurrency(currentMonthExpense)}
              </p>
            </article>
            <article className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
              <p className="text-[10px] font-bold text-emerald-900">دخل الشهر</p>
              <p className="mt-1 text-sm font-black tabular-nums text-emerald-950" dir="ltr">
                {formatCurrency(currentMonthIncome)}
              </p>
            </article>
          </div>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <Plus aria-hidden="true" className="h-5 w-5" /> إضافة حركة
          </button>

          {wallets.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
              {wallets.map((wallet) => {
                const info = walletKindInfo[wallet.kind];
                const Icon = info.Icon;
                return (
                  <button
                    type="button"
                    aria-label={`تعديل ${wallet.name}`}
                    onClick={() => openWalletEdit(wallet)}
                    className="min-w-0 rounded-2xl border border-white/90 bg-white/90 p-2 text-right shadow-sm ring-1 ring-emerald-950/[0.035] transition hover:border-emerald-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:p-3"
                  >
                    <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${info.color}`}
                      >
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="truncate text-[9px] font-bold text-slate-500 sm:text-[10px]">
                          {info.label}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] font-black text-slate-800 sm:text-xs">
                          {wallet.name}
                        </div>
                      </div>
                    </div>
                    <div
                      className="mt-2 truncate text-[11px] font-black text-slate-950 sm:mt-3 sm:text-sm"
                      dir="ltr"
                    >
                      {formatCurrency(wallet.balance)}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <button
              type="button"
              onClick={openWalletAdd}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300 bg-white/75 px-4 py-5 text-center text-xs font-bold text-emerald-900 transition hover:bg-white"
            >
              <Plus className="h-4 w-4" /> أضف أول مكان لأموالك، مثل الكاش أو الفيزا أو محفظة
              الموبايل
            </button>
          )}
        </div>
      </section>

      <section aria-labelledby="quick-summary-title" className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 id="quick-summary-title" className="text-sm font-black text-slate-900">
              ملخص سريع
            </h2>
            <p className="mt-0.5 text-[10px] text-slate-500">أهم أرقامك وأقرب التزاماتك</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <article className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm sm:p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Clock3 aria-hidden="true" className="h-4 w-4" />
              </span>
              <h3 className="text-[11px] font-black text-slate-800">الديون المستحقة</h3>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([0, 1] as const).map((offset) => {
                const monthDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
                const monthDebts = offset === 0 ? currentMonthDebts : nextMonthDebts;
                const monthTotal = getDueTotal(monthDebts);
                const isSelected = expandedDebtMonth === offset;
                return (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => setExpandedDebtMonth(isSelected ? null : offset)}
                    aria-expanded={isSelected}
                    aria-controls={isSelected ? 'due-debt-details' : undefined}
                    className={`min-w-0 rounded-xl px-2 py-2 text-right transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${
                      isSelected ? 'bg-emerald-100 text-emerald-950' : 'bg-slate-50 text-slate-800 hover:bg-emerald-50'
                    }`}
                  >
                    <span className="block truncate text-[9px] font-semibold text-slate-600">
                      {offset === 0 ? 'الحالي' : 'القادم'} ·{' '}
                      {monthDate.toLocaleDateString('ar-EG', { month: 'short' })}
                    </span>
                    <span className="mt-1 block truncate text-[10px] font-black tabular-nums" dir="ltr">
                      {formatCurrency(monthTotal)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[9px] font-semibold text-slate-500">
              عليّا {formatAmount(totalDebtsOnMe)} ج.م · ليّا {formatAmount(totalDebtsToMe)} ج.م
            </p>
            <button
              type="button"
              onClick={() => onNavigate('debts')}
              className="mt-2 min-h-8 text-[10px] font-bold text-emerald-800 underline decoration-emerald-200 underline-offset-2"
            >
              عرض كل الديون
            </button>
          </article>

          <button
            type="button"
            onClick={() => document.getElementById('savings-goals')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="min-h-32 rounded-2xl border border-slate-200/70 bg-white p-3 text-right shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 sm:p-4"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Target aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="mt-2 block text-[11px] font-black text-slate-800">أهداف الادخار</span>
            <span className="mt-1 block truncate text-xs font-black tabular-nums text-slate-900" dir="ltr">
              {formatCurrency(plansSummary.goalsSaved)}
            </span>
            <span className="mt-1 block text-[9px] text-slate-500">
              {formatAmount(plansSummary.goalCount)} {plansSummary.goalCount === 1 ? 'هدف' : 'أهداف'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => document.getElementById('recurring-transactions')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="min-h-32 rounded-2xl border border-slate-200/70 bg-white p-3 text-right shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 sm:p-4"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Repeat2 aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="mt-2 block text-[11px] font-black text-slate-800">المتكرر</span>
            <span className="mt-1 block truncate text-xs font-black tabular-nums text-slate-900" dir="ltr">
              {formatCurrency(plansSummary.recurringTotal)}
            </span>
            <span className="mt-1 block text-[9px] text-slate-500">
              {formatAmount(plansSummary.recurringCount)} معاملة نشطة
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('gam3eya_gold')}
            className="min-h-32 rounded-2xl border border-slate-200/70 bg-white p-3 text-right shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 sm:p-4"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Landmark aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="mt-2 block text-[11px] font-black text-slate-800">الجمعيات</span>
            <span className="mt-1 block text-xs font-black text-slate-900">
              {formatAmount(activeGam3eyat.length)} جمعية نشطة
            </span>
            <span className="mt-1 block text-[9px] text-slate-500">عرض التفاصيل</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('gam3eya_gold')}
          className="min-h-32 rounded-2xl border border-slate-200/70 bg-white p-3 text-right shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 sm:p-4"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Landmark aria-hidden="true" className="h-4 w-4" />
            </span>
            <span className="mt-2 block text-[11px] font-black text-slate-800">الذهب والأصول</span>
            <span className="mt-1 block truncate text-xs font-black tabular-nums text-slate-900" dir="ltr">
              {formatCurrency(totalGoldValue)}
            </span>
            <span className="mt-1 block truncate text-[9px] text-slate-500">
              إجمالي الأصول {formatCurrency(totalSavingsValue)}
            </span>
          </button>
        </div>
      </section>

      {dueDebtReminders.length > 0 && (
        <section
          role="status"
          aria-live="polite"
          className="overflow-hidden rounded-3xl border border-orange-300 bg-gradient-to-br from-orange-50 via-white to-rose-50 shadow-sm"
        >
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
              {dueDebtReminders.some((debt) => debt.dueDate && daysUntilDue(debt.dueDate) <= 0) ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <BellRing className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-orange-950">تنبيه: مواعيد سداد قريبة</h2>
              <p className="mt-1 text-[11px] leading-5 text-orange-900">
                ديون عليك مستحقة خلال ٣ أيام أو متأخرة. راجع المبلغ وموعد السداد.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('debts')}
              className="shrink-0 rounded-xl bg-orange-700 px-3 py-2 text-[10px] font-black text-white shadow-sm"
            >
              عرض الديون
            </button>
          </div>
          <div className="divide-y divide-orange-100 border-t border-orange-100 bg-white/70 px-4 sm:px-5">
            {dueDebtReminders.slice(0, 3).map((debt) => {
              const days = daysUntilDue(debt.dueDate!);
              const dueLabel =
                days < 0
                  ? `متأخر ${Math.abs(days)} يوم`
                  : days === 0
                    ? 'مستحق اليوم'
                    : `بعد ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
              return (
                <div key={debt.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-slate-800">
                      {debt.personName}
                    </p>
                    <p
                      className={`mt-0.5 text-[10px] font-bold ${days <= 0 ? 'text-rose-700' : 'text-orange-800'}`}
                    >
                      {dueLabel} · {formatDate(debt.dueDate!)}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-black text-slate-900" dir="ltr">
                    {formatCurrency(Math.max(0, debt.totalAmount - debt.paidAmount))}
                  </p>
                </div>
              );
            })}
            {dueDebtReminders.length > 3 && (
              <p className="py-2 text-[10px] font-bold text-slate-500">
                و {dueDebtReminders.length - 3} مواعيد أخرى قريبة
              </p>
            )}
          </div>
        </section>
      )}

      {expandedDebtMonth !== null && (
        <section
          id="due-debt-details"
          aria-labelledby="due-debt-details-title"
          className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 id="due-debt-details-title" className="text-xs font-black text-slate-800">
              تفاصيل ديون {selectedDebtMonthLabel}
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('debts')}
              className="shrink-0 text-[10px] font-bold text-emerald-800 underline decoration-emerald-200 underline-offset-2"
            >
              كل الديون
            </button>
          </div>
          {selectedMonthDebts.length ? (
            <div className="mt-2 divide-y divide-slate-100">
              {selectedMonthDebts.map((debt) => (
                <div key={debt.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-extrabold text-slate-800">
                      {debt.personName}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      موعد السداد{' '}
                      {formatDate(debt.dueDate!, { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <div className="shrink-0 text-left">
                    <div className="text-xs font-black tabular-nums text-slate-800" dir="ltr">
                      {formatCurrency(Math.max(0, debt.totalAmount - debt.paidAmount))}
                    </div>
                    {debt.paidAmount > 0 && (
                      <div className="mt-1 text-[10px] text-slate-500">بعد السداد الجزئي</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-5 text-center text-xs text-slate-500">
              لا توجد ديون عليك غير مكتملة بتاريخ استحقاق في {selectedDebtMonthLabel}.
            </div>
          )}
        </section>
      )}

      {isWalletModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsWalletModalOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-dialog-title"
            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] border border-emerald-100 bg-[#f8fbf9] shadow-2xl sm:rounded-[28px]"
          >
            <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3
                    id="wallet-dialog-title"
                    className="truncate text-sm font-black text-slate-900"
                  >
                    {editingWalletId === null ? 'إضافة مكان مالي' : 'تعديل المكان المالي'}
                  </h3>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    حدّث الاسم والنوع والرصيد الحالي
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                onClick={() => setIsWalletModalOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="overflow-y-auto p-4 sm:p-5">
              <form onSubmit={handleSaveWallet} className="space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
                  <div className="mb-4 flex items-center gap-2 text-xs font-black text-emerald-950">
                    <Wallet className="h-4 w-4" /> بيانات المكان
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="wallet-name"
                        className="mb-1.5 block text-[11px] font-extrabold text-slate-700"
                      >
                        اسم واضح للمكان
                      </label>
                      <input
                        id="wallet-name"
                        required
                        maxLength={32}
                        value={walletName}
                        onChange={(event) => setWalletName(event.target.value)}
                        placeholder="مثال: كاش البيت، فيزا البنك، فودافون كاش"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="wallet-kind"
                        className="mb-1.5 block text-[11px] font-extrabold text-slate-700"
                      >
                        نوع المكان
                      </label>
                      <select
                        id="wallet-kind"
                        value={walletKind}
                        onChange={(event) =>
                          setWalletKind(event.target.value as WalletAccount['kind'])
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      >
                        <option value="cash">كاش</option>
                        <option value="card">فيزا / بطاقة بنكية</option>
                        <option value="mobile">محفظة موبايل</option>
                        <option value="other">مكان آخر</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="wallet-balance"
                        className="mb-1.5 block text-[11px] font-extrabold text-slate-700"
                      >
                        {editingWalletId === null ? 'الرصيد الموجود الآن' : 'الرصيد الحالي'}
                      </label>
                      <div className="relative">
                        <input
                          id="wallet-balance"
                          required
                          type="number"
                          step="0.01"
                          value={walletOpeningBalance}
                          onChange={(event) => setWalletOpeningBalance(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-14 pr-3.5 text-sm font-bold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                          dir="ltr"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                          ج.م
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="rounded-xl bg-sky-50 px-3 py-2.5 text-[10px] leading-5 text-sky-900">
                  الحركات الجديدة ستضيف أو تخصم من الرصيد تلقائيًا. تعديل الرصيد هنا يصحح الرصيد
                  الحالي ولا يغيّر سجل معاملاتك السابقة.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]"
                  >
                    <Pencil className="h-4 w-4" />
                    {editingWalletId === null ? 'حفظ المكان' : 'حفظ التعديلات'}
                  </button>
                  {walletBeingEdited && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteWallet(walletBeingEdited)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      <section
        className={`rounded-3xl border p-4 shadow-sm sm:p-5 ${projectedBudgetOverrun ? 'border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50' : 'border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50'}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${projectedBudgetOverrun ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-800'}`}
          >
            {projectedBudgetOverrun ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <TrendingDown className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-900">أصرف كام النهارده؟</h2>
            {monthlyBudgetLimit > 0 ? (
              <>
                <p
                  className={`mt-1 text-2xl font-black ${projectedBudgetOverrun ? 'text-rose-800' : 'text-emerald-800'}`}
                  dir="ltr"
                >
                  {dailyAvailableBudget.toLocaleString('ar-EG')}{' '}
                  <span className="text-xs">ج.م / يوم</span>
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-600">
                  متوسط مقترح من المتبقي في الميزانية على {daysLeftInMonth.toLocaleString('ar-EG')}{' '}
                  يوم حتى نهاية الشهر.
                </p>
                {projectedBudgetOverrun && (
                  <p className="mt-2 rounded-xl border border-rose-200 bg-white/80 px-3 py-2 text-[11px] font-bold leading-5 text-rose-800">
                    بمعدل صرفك الحالي، متوقع تتجاوز الميزانية بحوالي{' '}
                    {Math.max(0, projectedMonthExpense - monthlyBudgetLimit).toLocaleString(
                      'ar-EG',
                    )}{' '}
                    ج.م. قلّل متوسط الصرف اليومي عشان تقرّب من خطتك.
                  </p>
                )}
                {!projectedBudgetOverrun && remainingBudget >= 0 && (
                  <p className="mt-1 text-[10px] font-semibold text-emerald-800">
                    أنت داخل حدود الميزانية حتى الآن.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  حدد ميزانيتك الشهرية، وهقولك متوسط الصرف اليومي المناسب ومتى تكون قريبًا من
                  تجاوزها.
                </p>
                {!isEditingBudget && (
                  <button
                    type="button"
                    onClick={() => {
                      setTempBudgetInput('');
                      setIsEditingBudget(true);
                    }}
                    className="mt-2 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white transition-colors hover:bg-emerald-700"
                  >
                    حدد ميزانية الشهر
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        {isEditingBudget ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-sky-200 bg-white/80 p-3">
            <label
              htmlFor="dashboard-monthly-budget"
              className="w-full text-[10px] font-bold text-slate-700"
            >
              ميزانيتك للشهر بالجنيه
            </label>
            <input
              id="dashboard-monthly-budget"
              type="number"
              min="0"
              value={tempBudgetInput}
              onChange={(event) => setTempBudgetInput(event.target.value)}
              placeholder="اكتب المبلغ"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold outline-none focus:border-sky-600"
            />
            <button
              type="button"
              onClick={() => void handleSaveBudget()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-700"
            >
              حفظ
            </button>
            <button
              type="button"
              onClick={() => setIsEditingBudget(false)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"
            >
              إلغاء
            </button>
          </div>
        ) : monthlyBudgetLimit > 0 ? (
          <button
            type="button"
            onClick={() => {
              setTempBudgetInput(String(monthlyBudgetLimit));
              setIsEditingBudget(true);
            }}
            className="mt-3 text-[11px] font-bold text-sky-900 underline decoration-sky-300 underline-offset-4"
          >
            تعديل ميزانية الشهر
          </button>
        ) : null}
      </section>

      <FinancialPlans onRefresh={loadData} onSummaryChange={setPlansSummary} />

      {/* Recent Transactions List */}
      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-sm text-slate-800">آخر المعاملات المسجلة</h2>
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="min-h-10 rounded-lg px-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            عرض الكل
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            لم تسجل أي معاملات بعد. اضغط على "تسجيل معاملة" للبدء الآن!
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTransactions.slice(0, 3).map((tx) => (
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
                    <div className="text-[11px] text-slate-600">
                      <span className="font-bold">{tx.type === 'expense' ? 'مصروف' : 'دخل'}</span>
                      {tx.note ? ` · ${tx.note}` : ''}
                      {tx.walletId !== undefined &&
                      wallets.find((wallet) => wallet.id === tx.walletId)
                        ? ` · ${wallets.find((wallet) => wallet.id === tx.walletId)?.name}`
                        : ''}
                      {' · '}
                      {formatDate(tx.date)}
                    </div>
                  </div>
                </div>

                <div
                  className={`font-bold font-mono text-sm sm:text-base ${
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
