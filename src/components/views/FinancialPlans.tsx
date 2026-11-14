'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  db,
  type Category,
  type RecurringTransaction,
  type SavingsGoal,
  type WalletAccount,
} from '@/lib/db';
import { applyRecurringOccurrence, getLocalDateString } from '@/lib/recurring-transactions';
import { askForConfirmation } from '@/lib/confirm-action';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CircleCheck,
  Clock3,
  Pencil,
  Play,
  Plus,
  Repeat2,
  SkipForward,
  Target,
  Trash2,
  X,
} from 'lucide-react';

type PlanType = 'income' | 'expense';

interface FinancialPlansProps {
  onRefresh: () => Promise<void>;
  refreshToken?: number;
  onSummaryChange?: (summary: {
    goalCount: number;
    goalsSaved: number;
    recurringCount: number;
    recurringTotal: number;
    recurringDueThisMonth: number;
  }) => void;
}

const dateLabel = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const daysBetween = (fromDate: string, toDate: string) => {
  const [fy, fm, fd] = fromDate.split('-').map(Number);
  const [ty, tm, td] = toDate.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
};

const defaultGoalForm = { name: '', targetAmount: '', savedAmount: '0', targetDate: '' };
const defaultRuleForm = {
  name: '',
  type: 'expense' as PlanType,
  amount: '',
  category: '',
  note: '',
  walletId: '',
  nextDueDate: getLocalDateString(),
};

export const FinancialPlans: React.FC<FinancialPlansProps> = ({
  onRefresh,
  onSummaryChange,
  refreshToken = 0,
}) => {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [rules, setRules] = useState<RecurringTransaction[]>([]);
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goalForm, setGoalForm] = useState(defaultGoalForm);
  const [goalEditingId, setGoalEditingId] = useState<number | null>(null);
  const [progressGoal, setProgressGoal] = useState<SavingsGoal | null>(null);
  const [progressAmount, setProgressAmount] = useState('');
  const [ruleForm, setRuleForm] = useState(defaultRuleForm);
  const [ruleEditingId, setRuleEditingId] = useState<number | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const [goalRows, ruleRows, walletRows, categoryRows] = await Promise.all([
      db.savingsGoals.toArray(),
      db.recurringTransactions.toArray(),
      db.wallets.toArray(),
      db.categories.toArray(),
    ]);
    setGoals(goalRows.sort((a, b) => a.createdAt - b.createdAt));
    setRules(ruleRows.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate)));
    setWallets(walletRows);
    setCategories(categoryRows);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshToken]);

  const totalSavedTowardGoals = goals.reduce((sum, goal) => sum + goal.savedAmount, 0);
  const today = getLocalDateString();
  useEffect(() => {
    const activeRules = rules.filter((rule) => rule.isActive);
    const recurringDueThisMonth = activeRules
      .filter((rule) => rule.type === 'expense' && rule.nextDueDate.startsWith(today.slice(0, 7)))
      .reduce((sum, rule) => sum + rule.amount, 0);
    onSummaryChange?.({
      goalCount: goals.length,
      goalsSaved: totalSavedTowardGoals,
      recurringCount: activeRules.length,
      recurringTotal: activeRules.reduce((sum, rule) => sum + rule.amount, 0),
      recurringDueThisMonth,
    });
  }, [goals, onSummaryChange, rules, today, totalSavedTowardGoals]);
  const currentCategories = useMemo(
    () => categories.filter((category) => category.type === ruleForm.type),
    [categories, ruleForm.type],
  );

  const openNewGoal = () => {
    setGoalEditingId(null);
    setGoalForm(defaultGoalForm);
    setGoalModalOpen(true);
  };

  const openEditGoal = (goal: SavingsGoal) => {
    if (goal.id === undefined) return;
    setGoalEditingId(goal.id);
    setGoalForm({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      savedAmount: String(goal.savedAmount),
      targetDate: goal.targetDate || '',
    });
    setGoalModalOpen(true);
  };

  const saveGoal = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetAmount = Number(goalForm.targetAmount);
    const savedAmount = Number(goalForm.savedAmount);
    if (
      !goalForm.name.trim() ||
      !Number.isFinite(targetAmount) ||
      targetAmount <= 0 ||
      !Number.isFinite(savedAmount) ||
      savedAmount < 0
    ) {
      setMessage('اكتب اسم الهدف ومبلغًا صحيحًا، وتأكد أن المبلغ المدخر صفر أو أكثر.');
      return;
    }

    if (goalEditingId === null) {
      await db.savingsGoals.add({
        name: goalForm.name.trim(),
        targetAmount,
        savedAmount,
        targetDate: goalForm.targetDate || undefined,
        createdAt: Date.now(),
      });
    } else {
      await db.savingsGoals.update(goalEditingId, {
        name: goalForm.name.trim(),
        targetAmount,
        savedAmount,
        targetDate: goalForm.targetDate || undefined,
      });
    }
    setGoalModalOpen(false);
    setMessage('تم حفظ هدف الادخار.');
    await refresh();
  };

  const addGoalProgress = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!progressGoal?.id) return;
    const amount = Number(progressAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMessage('اكتب مبلغًا صحيحًا لإضافته إلى تقدم الهدف.');
      return;
    }
    await db.savingsGoals.update(progressGoal.id, {
      savedAmount: progressGoal.savedAmount + amount,
    });
    setProgressGoal(null);
    setProgressAmount('');
    setMessage('اتحدّث تقدم هدفك. أرصدة المحافظ لم تتغير.');
    await refresh();
  };

  const deleteGoal = async (goal: SavingsGoal) => {
    if (goal.id === undefined) return;
    const confirmed = await askForConfirmation({
      title: 'حذف هدف الادخار',
      message: 'سيُحذف الهدف وتقدمه المسجل داخل التطبيق. أرصدة المحافظ لن تتغير.',
      itemName: goal.name,
      confirmLabel: 'حذف الهدف',
      tone: 'danger',
    });
    if (!confirmed) return;
    await db.savingsGoals.delete(goal.id);
    setMessage('تم حذف هدف الادخار.');
    await refresh();
  };

  const openNewRule = () => {
    setRuleEditingId(null);
    const firstWalletId = wallets[0]?.id === undefined ? '' : String(wallets[0].id);
    const firstCategory = categories.find((category) => category.type === 'expense')?.name || '';
    setRuleForm({ ...defaultRuleForm, category: firstCategory, walletId: firstWalletId });
    setRuleModalOpen(true);
  };

  const openEditRule = (rule: RecurringTransaction) => {
    if (rule.id === undefined) return;
    setRuleEditingId(rule.id);
    setRuleForm({
      name: rule.name,
      type: rule.type,
      amount: String(rule.amount),
      category: rule.category,
      note: rule.note || '',
      walletId: String(rule.walletId),
      nextDueDate: rule.nextDueDate,
    });
    setRuleModalOpen(true);
  };

  const saveRule = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(ruleForm.amount);
    const wallet = wallets.find((item) => String(item.id) === ruleForm.walletId);
    if (
      !ruleForm.name.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !ruleForm.category ||
      !wallet?.id ||
      !ruleForm.nextDueDate
    ) {
      setMessage('أكمل اسم المعاملة والمبلغ والتصنيف ومكان الفلوس والموعد.');
      return;
    }
    const dayOfMonth = Number(ruleForm.nextDueDate.slice(8, 10));
    const values = {
      name: ruleForm.name.trim(),
      type: ruleForm.type,
      amount,
      category: ruleForm.category,
      note: ruleForm.note.trim() || undefined,
      walletId: wallet.id,
      dayOfMonth,
      nextDueDate: ruleForm.nextDueDate,
    };
    if (ruleEditingId === null) {
      await db.recurringTransactions.add({ ...values, isActive: true, createdAt: Date.now() });
    } else {
      await db.recurringTransactions.update(ruleEditingId, values);
    }
    setRuleModalOpen(false);
    setMessage('تم حفظ المعاملة الشهرية. هتفضل تنتظر تأكيدك قبل التسجيل.');
    await refresh();
  };

  const runRecurring = async (rule: RecurringTransaction, action: 'record' | 'skip') => {
    if (rule.id === undefined) return;
    setBusyId(rule.id);
    setMessage('');
    try {
      const result = await applyRecurringOccurrence(rule.id, action);
      setMessage(
        action === 'record'
          ? `تم تسجيل «${result.name}» بتاريخ ${dateLabel(result.transactionDate)} وتحديث المكان المالي مرة واحدة.`
          : `تم تخطي موعد «${result.name}» بدون تغيير المعاملة أو رصيد المكان.`,
      );
      await refresh();
      if (action === 'record') await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تحديث المعاملة المتكررة.');
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const confirmRecurringCompletion = async (rule: RecurringTransaction) => {
    const isExpense = rule.type === 'expense';
    const confirmed = await askForConfirmation({
      title: isExpense ? 'هل دفعت المصروف فعلًا؟' : 'هل استلمت الدخل فعلًا؟',
      message: isExpense
        ? `تأكيدك هيسجل المصروف بتاريخ النهارده ويخصم ${rule.amount.toLocaleString('ar-EG')} ج.م من ${walletName(rule.walletId)}. إضافة الموعد وحدها لا تخصم أي مبلغ.`
        : `تأكيدك هيسجل الدخل بتاريخ النهارده ويضيف ${rule.amount.toLocaleString('ar-EG')} ج.م إلى ${walletName(rule.walletId)}. إضافة الموعد وحدها لا تغيّر أي رصيد.`,
      itemName: rule.name,
      confirmLabel: isExpense ? 'تم الدفع والخصم' : 'تم الاستلام والإضافة',
      tone: 'primary',
    });
    if (confirmed) await runRecurring(rule, 'record');
  };

  const toggleRule = async (rule: RecurringTransaction) => {
    if (rule.id === undefined) return;
    await db.recurringTransactions.update(rule.id, { isActive: !rule.isActive });
    setMessage(
      rule.isActive ? 'تم إيقاف المعاملة المتكررة مؤقتًا.' : 'تم استئناف المعاملة المتكررة.',
    );
    await refresh();
  };

  const deleteRule = async (rule: RecurringTransaction) => {
    if (rule.id === undefined) return;
    const confirmed = await askForConfirmation({
      title: 'حذف المعاملة المتكررة',
      message: 'سيُحذف موعدها القادم فقط. المعاملات التي سُجلت قبل كده هتفضل موجودة.',
      itemName: rule.name,
      confirmLabel: 'حذف المعاملة المتكررة',
      tone: 'danger',
    });
    if (!confirmed) return;
    await db.recurringTransactions.delete(rule.id);
    setMessage('تم حذف المعاملة المتكررة.');
    await refresh();
  };

  const walletName = (walletId: number) =>
    wallets.find((wallet) => wallet.id === walletId)?.name || 'مكان محذوف';

  return (
    <section className="space-y-4">
      {message && (
        <p
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold leading-5 text-emerald-900"
        >
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section id="savings-goals" className="scroll-mt-24 overflow-hidden rounded-2xl bg-white">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                  <Target className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">أهداف الادخار</h2>
              </div>
              {goals.length > 0 && (
                <button
                  type="button"
                  onClick={openNewGoal}
                  aria-label="إضافة هدف ادخار"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] text-slate-500">إجمالي الادخار</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900" dir="ltr">
                  {totalSavedTowardGoals.toLocaleString('ar-EG')}{' '}
                  <span className="text-xs font-semibold text-slate-500">ج.م</span>
                </p>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600">
                {goals.length.toLocaleString('ar-EG')} {goals.length === 1 ? 'هدف' : 'أهداف'}
              </span>
            </div>
          </div>

          {goals.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <p className="text-xs text-slate-600">مفيش أهداف ادخار مسجلة.</p>
              <button
                type="button"
                onClick={openNewGoal}
                className="min-h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
              >
                إنشاء أول هدف
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {goals.map((goal) => {
                const progress = Math.min(
                  100,
                  Math.round((goal.savedAmount / goal.targetAmount) * 100),
                );
                const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
                const completed = remaining === 0;
                return (
                  <article key={goal.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {completed && (
                            <CircleCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                          )}
                          <h3 className="truncate text-xs font-black text-slate-900">
                            {goal.name}
                          </h3>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {goal.targetDate
                            ? `هدفك قبل ${dateLabel(goal.targetDate)}`
                            : 'موعد الوصول حسب خطتك'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditGoal(goal)}
                          aria-label={`تعديل ${goal.name}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteGoal(goal)}
                          aria-label={`حذف ${goal.name}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <p className="text-sm font-black text-emerald-900" dir="ltr">
                        {goal.savedAmount.toLocaleString('ar-EG')}{' '}
                        <span className="text-[10px] font-bold text-slate-500">
                          من {goal.targetAmount.toLocaleString('ar-EG')} ج.م
                        </span>
                      </p>
                      <span className="text-[10px] font-black text-emerald-800">
                        {progress.toLocaleString('ar-EG')}٪
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-50"
                      role="progressbar"
                      aria-label={`تقدم ${goal.name}`}
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] text-slate-500">
                        {completed
                          ? 'وصلت لهدفك'
                          : `باقي ${remaining.toLocaleString('ar-EG')} ج.م`}
                      </p>
                      {!completed && (
                        <button
                          type="button"
                          onClick={() => {
                            setProgressGoal(goal);
                            setProgressAmount('');
                          }}
                          className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-900 hover:bg-emerald-100"
                        >
                          أضف ادخارًا
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="border-t border-slate-100 px-4 py-2.5 text-[9px] leading-4 text-slate-500">
            تسجيل الادخار هنا لا يغيّر رصيد المكان المالي.
          </p>
        </section>

        <section id="recurring-transactions" className="scroll-mt-24 overflow-hidden rounded-2xl bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Repeat2 className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">الدخل والمصروفات المتكررة</h2>
            </div>
            {rules.length > 0 && (
              <button
                type="button"
                onClick={openNewRule}
                aria-label="إضافة معاملة متكررة"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          {rules.filter((rule) => rule.isActive && rule.nextDueDate <= today).length > 0 && (
            <div className="divide-y divide-slate-100 border-b border-slate-100 bg-slate-50/60 px-4">
              {rules
                .filter((rule) => rule.isActive && rule.nextDueDate <= today)
                .map((rule) => {
                  const daysLate = daysBetween(rule.nextDueDate, today);
                  return (
                    <div
                      key={`due-${rule.id}`}
                      className="py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <div
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${rule.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-50 text-rose-700'}`}
                          >
                            {rule.type === 'income' ? (
                              <ArrowDownLeft className="h-4 w-4" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-black text-slate-900">
                              {rule.name}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-500">
                              {daysLate === 0
                                ? 'موعدها النهارده'
                                : `متأخرة ${daysLate} ${daysLate === 1 ? 'يوم' : 'أيام'}`}{' '}
                              · {dateLabel(rule.nextDueDate)}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`shrink-0 text-xs font-black ${rule.type === 'income' ? 'text-emerald-800' : 'text-slate-900'}`}
                          dir="ltr"
                        >
                          {rule.amount.toLocaleString('ar-EG')} ج.م
                        </p>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={
                            busyId === rule.id ||
                            !wallets.some((wallet) => wallet.id === rule.walletId)
                          }
                          onClick={() => void confirmRecurringCompletion(rule)}
                          aria-label={
                            rule.type === 'expense'
                              ? `تأكيد دفع ${rule.name} وخصمه من ${walletName(rule.walletId)}`
                              : `تأكيد استلام ${rule.name} وإضافته إلى ${walletName(rule.walletId)}`
                          }
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[10px] font-black text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <span className="flex h-4 w-4 items-center justify-center rounded border border-emerald-500 bg-white">
                            <Check className="h-3 w-3" />
                          </span>
                          {rule.type === 'expense' ? 'تم الدفع' : 'تم الاستلام'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === rule.id}
                          onClick={() => void runRecurring(rule, 'skip')}
                          className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-bold text-slate-600 disabled:opacity-50"
                        >
                          <SkipForward className="h-3.5 w-3.5" />
                          تخطي
                        </button>
                      </div>
                      {!wallets.some((wallet) => wallet.id === rule.walletId) && (
                        <p className="mt-2 text-[10px] font-bold text-rose-700">
                          المكان المالي المرتبط اتحذف. عدّل القاعدة واختر مكانًا جديدًا.
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {rules.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <p className="text-xs text-slate-600">مفيش معاملات متكررة.</p>
              <button
                type="button"
                onClick={openNewRule}
                className="min-h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700"
              >
                أضف معاملة شهرية
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rules.map((rule) => {
                const daysUntil = daysBetween(today, rule.nextDueDate);
                const completedThisMonth = rule.lastCompletedMonth === today.slice(0, 7);
                const dueDescription = !rule.isActive
                  ? 'متوقفة مؤقتًا'
                  : completedThisMonth
                    ? `تم التنفيذ هذا الشهر · تتجدد ${dateLabel(rule.nextDueDate)}`
                    : daysUntil <= 0
                      ? 'مستحقة للمراجعة'
                      : `الموعد ${dateLabel(rule.nextDueDate)}`;
                return (
                  <article
                    key={rule.id}
                    className={`flex items-center gap-3 px-4 py-3 ${!rule.isActive ? 'opacity-60' : ''}`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${completedThisMonth ? 'bg-emerald-100 text-emerald-800' : rule.type === 'income' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
                    >
                      {completedThisMonth ? (
                        <Check className="h-4 w-4" />
                      ) : rule.type === 'income' ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-extrabold text-slate-900">
                        {rule.name}
                      </p>
                      <p className="mt-0.5 truncate text-[9px] text-slate-500">
                        {dueDescription} · {walletName(rule.walletId)}
                      </p>
                    </div>
                    <p className="shrink-0 text-[10px] font-black text-slate-800" dir="ltr">
                      {rule.amount.toLocaleString('ar-EG')}
                    </p>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => openEditRule(rule)}
                        aria-label={`تعديل ${rule.name}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleRule(rule)}
                        aria-label={rule.isActive ? `إيقاف ${rule.name}` : `استئناف ${rule.name}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                      >
                        {rule.isActive ? (
                          <Clock3 className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteRule(rule)}
                        aria-label={`حذف ${rule.name}`}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="border-t border-slate-100 px-4 py-2.5 text-[9px] leading-4 text-slate-500">
            الرصيد يتغير لما تأكد الدفع أو الاستلام.
          </p>
        </section>
      </div>

      {goalModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGoalModalOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-dialog-title"
            className="w-full max-w-md overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
          >
            <header className="flex items-center justify-between border-b border-emerald-100 bg-emerald-950 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <h3 id="goal-dialog-title" className="text-sm font-black">
                    {goalEditingId === null ? 'هدف جديد' : 'تعديل هدف الادخار'}
                  </h3>
                  <p className="mt-0.5 text-[10px] text-emerald-100">كل خطوة صغيرة بتفرق</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGoalModalOpen(false)}
                aria-label="إغلاق"
                className="rounded-xl p-2 text-emerald-100 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <form onSubmit={saveGoal} className="space-y-3 p-5">
              <label className="block text-[11px] font-bold text-slate-700">
                اسم الهدف
                <input
                  required
                  maxLength={48}
                  value={goalForm.name}
                  onChange={(event) => setGoalForm({ ...goalForm, name: event.target.value })}
                  placeholder="مثال: موبايل جديد"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[11px] font-bold text-slate-700">
                  المبلغ المستهدف
                  <input
                    required
                    min="1"
                    step="0.01"
                    type="number"
                    value={goalForm.targetAmount}
                    onChange={(event) =>
                      setGoalForm({ ...goalForm, targetAmount: event.target.value })
                    }
                    placeholder="10000"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-600"
                    dir="ltr"
                  />
                </label>
                <label className="block text-[11px] font-bold text-slate-700">
                  المدخر حاليًا
                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={goalForm.savedAmount}
                    onChange={(event) =>
                      setGoalForm({ ...goalForm, savedAmount: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-600"
                    dir="ltr"
                  />
                </label>
              </div>
              <label className="block text-[11px] font-bold text-slate-700">
                تاريخ مستهدف (اختياري)
                <input
                  type="date"
                  min={today}
                  value={goalForm.targetDate}
                  onChange={(event) => setGoalForm({ ...goalForm, targetDate: event.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-600"
                />
              </label>
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[10px] leading-5 text-emerald-900">
                الهدف لمتابعة خطتك فقط؛ لا يضيف أو يخصم من المحافظ.
              </p>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700"
              >
                <Check className="h-4 w-4" />
                حفظ الهدف
              </button>
            </form>
          </section>
        </div>
      )}

      {progressGoal && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setProgressGoal(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="progress-dialog-title"
            className="w-full max-w-sm space-y-4 rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="progress-dialog-title" className="text-sm font-black text-slate-900">
                  أضف ادخارًا إلى «{progressGoal.name}»
                </h3>
                <p className="mt-1 text-[10px] text-slate-500">
                  المبلغ للمتابعة فقط ولن يغيّر رصيد المحافظ.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProgressGoal(null)}
                aria-label="إغلاق"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={addGoalProgress} className="space-y-3">
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                autoFocus
                value={progressAmount}
                onChange={(event) => setProgressAmount(event.target.value)}
                placeholder="المبلغ بالجنيه"
                className="w-full rounded-xl border border-emerald-200 px-3 py-3 text-center text-lg font-black outline-none focus:ring-4 focus:ring-emerald-500/10"
                dir="ltr"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700"
              >
                تحديث التقدم
              </button>
            </form>
          </section>
        </div>
      )}

      {ruleModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRuleModalOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="recurring-dialog-title"
            className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-[#f9fcfd] shadow-2xl sm:rounded-[28px]"
          >
            <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 text-slate-900">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Repeat2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 id="recurring-dialog-title" className="text-sm font-black">
                    {ruleEditingId === null ? 'معاملة شهرية متكررة' : 'تعديل المعاملة المتكررة'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                aria-label="إغلاق"
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <form onSubmit={saveRule} className="space-y-3 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() =>
                    setRuleForm({
                      ...ruleForm,
                      type: 'expense',
                      category:
                        categories.find((category) => category.type === 'expense')?.name || '',
                    })
                  }
                  className={`rounded-lg py-2.5 text-xs font-black ${ruleForm.type === 'expense' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500'}`}
                >
                  مصروف شهري
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRuleForm({
                      ...ruleForm,
                      type: 'income',
                      category:
                        categories.find((category) => category.type === 'income')?.name || '',
                    })
                  }
                  className={`rounded-lg py-2.5 text-xs font-black ${ruleForm.type === 'income' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
                >
                  دخل شهري
                </button>
              </div>
              <label className="block text-[11px] font-bold text-slate-700">
                اسم واضح
                <input
                  required
                  maxLength={48}
                  value={ruleForm.name}
                  onChange={(event) => setRuleForm({ ...ruleForm, name: event.target.value })}
                  placeholder={ruleForm.type === 'expense' ? 'مثال: إيجار البيت' : 'مثال: المرتب'}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[11px] font-bold text-slate-700">
                  المبلغ
                  <input
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={ruleForm.amount}
                    onChange={(event) => setRuleForm({ ...ruleForm, amount: event.target.value })}
                    placeholder="0.00"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
                    dir="ltr"
                  />
                </label>
                <label className="block text-[11px] font-bold text-slate-700">
                  أول موعد للتنفيذ
                  <input
                    required
                    type="date"
                    min={ruleEditingId === null ? today : undefined}
                    value={ruleForm.nextDueDate}
                    onChange={(event) =>
                      setRuleForm({ ...ruleForm, nextDueDate: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[11px] outline-none focus:border-emerald-600"
                  />
                </label>
              </div>
              <label className="block text-[11px] font-bold text-slate-700">
                التصنيف
                <select
                  required
                  value={ruleForm.category}
                  onChange={(event) => setRuleForm({ ...ruleForm, category: event.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
                >
                  <option value="">اختر التصنيف</option>
                  {currentCategories.map((category) => (
                    <option key={category.name} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] font-bold text-slate-700">
                {ruleForm.type === 'income' ? 'إضافة الدخل إلى' : 'الخصم من'}
                <select
                  required
                  value={ruleForm.walletId}
                  onChange={(event) => setRuleForm({ ...ruleForm, walletId: event.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
                >
                  <option value="">اختر مكان الفلوس</option>
                  {wallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] font-bold text-slate-700">
                ملاحظة (اختياري)
                <input
                  maxLength={100}
                  value={ruleForm.note}
                  onChange={(event) => setRuleForm({ ...ruleForm, note: event.target.value })}
                  placeholder="أي تفاصيل تساعدك تفتكر"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-600"
                />
              </label>
              <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] leading-5 text-slate-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ده موعدها الأول فقط. بعد ما تعلّمها «تم الدفع» أو «تم الاستلام»، تتجدد مع بداية الشهر
                القادم؛ ولن يتغير أي رصيد قبل تأكيدك.
              </p>
              <button
                type="submit"
                disabled={!wallets.length || !currentCategories.length}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                حفظ المعاملة المتكررة
              </button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
};
