'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { db, getDebtPaidAmount, getDebtRemainingAmount, WalletAccount } from '@/lib/db';
import { applyRecurringOccurrence, getLocalDateString } from '@/lib/recurring-transactions';
import { daysUntilDueDate, getUpcomingDueItems, UpcomingDueItem } from '@/lib/upcoming-due';
import { AlertTriangle, BellRing, Check, Clock3, SkipForward, Wallet } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface UpcomingDueAlertsProps {
  onRefresh: () => Promise<void>;
  wallets: WalletAccount[];
}

function formatDueDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short' }).format(parsed);
}

function dueDescription(dueDate: string, today: string) {
  const daysUntil = daysUntilDueDate(dueDate, today);
  if (daysUntil === null) return formatDueDate(dueDate);
  if (daysUntil < 0) return `متأخر ${Math.abs(daysUntil)} يوم`;
  if (daysUntil === 0) return 'مستحق النهارده';
  return `خلال ${daysUntil} ${daysUntil === 1 ? 'يوم' : 'أيام'}`;
}

export const UpcomingDueAlerts: React.FC<UpcomingDueAlertsProps> = ({ onRefresh, wallets }) => {
  const [items, setItems] = useState<UpcomingDueItem[]>([]);
  const [today, setToday] = useState(() => getLocalDateString());
  const [pendingItem, setPendingItem] = useState<UpcomingDueItem | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState('');
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [pickerError, setPickerError] = useState('');

  const refresh = useCallback(async () => {
    const currentDate = getLocalDateString();
    const currentMonthTransactions = db.transactions
      .where('date')
      .startsWith(currentDate.slice(0, 7));
    const [debtRows, recurringRows, gam3eyaRows, transactionRows] = await Promise.all([
      db.debts.toArray(),
      db.recurringTransactions.toArray(),
      db.gam3eyat.where('status').equals('active').toArray(),
      currentMonthTransactions.toArray(),
    ]);
    setToday(currentDate);
    setItems(
      getUpcomingDueItems({
        debts: debtRows,
        recurring: recurringRows,
        gam3eyat: gam3eyaRows,
        transactions: transactionRows,
        today: currentDate,
      }),
    );
  }, []);

  useEffect(() => {
    void refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refresh]);

  const refreshAfterAction = async () => {
    await Promise.all([onRefresh(), refresh()]);
  };

  const recordGam3eyaInstallment = async (
    item: Extract<UpcomingDueItem, { kind: 'gam3eya-installment' }>,
    walletId: number,
  ) => {
    await db.transaction('rw', [db.gam3eyat, db.transactions, db.wallets], async () => {
      const group = await db.gam3eyat.get(item.recordId);
      const wallet = await db.wallets.get(walletId);
      if (!group || group.status !== 'active' || group.paidMonths >= group.totalMonths) {
        throw new Error('الجمعية مش محتاجة قسطًا جديدًا دلوقتي.');
      }
      if (group.startDate > item.cycleMonth) throw new Error('موعد قسط الجمعية اتغير. حدّث الصفحة.');
      if (!wallet?.id) throw new Error('المكان المالي المختار مش موجود. اختار مكانًا تاني.');

      const cycleTransactions = await db.transactions
        .where('date')
        .startsWith(item.cycleMonth)
        .toArray();
      const installmentAlreadyPaid =
        group.lastInstallmentPaidMonth === item.cycleMonth ||
        cycleTransactions.some(
          (transaction) =>
            transaction.type === 'expense' &&
            transaction.category === 'جمعيات شهرية' &&
            transaction.note?.endsWith(` - ${group.name}`),
        );
      if (installmentAlreadyPaid) throw new Error('قسط الجمعية اتسجل بالفعل في الدورة دي.');

      const nextPaidMonths = group.paidMonths + 1;
      const isCompleted = nextPaidMonths >= group.totalMonths;
      await db.gam3eyat.update(item.recordId, {
        paidMonths: nextPaidMonths,
        lastInstallmentPaidMonth: item.cycleMonth,
        lastInstallmentSkippedMonth: undefined,
        status: isCompleted ? 'completed' : 'active',
      });
      await db.transactions.add({
        type: 'expense',
        amount: group.monthlyAmount,
        category: 'جمعيات شهرية',
        note: `قسط شهر (${nextPaidMonths} من ${group.totalMonths}) - ${group.name}`,
        date: getLocalDateString(),
        createdAt: Date.now(),
        walletId: wallet.id,
      });
      await db.wallets.update(wallet.id, { balance: wallet.balance - group.monthlyAmount });
    });
  };

  const recordGam3eyaPayout = async (
    item: Extract<UpcomingDueItem, { kind: 'gam3eya-payout' }>,
    walletId: number,
  ) => {
    await db.transaction('rw', [db.gam3eyat, db.transactions, db.wallets], async () => {
      const group = await db.gam3eyat.get(item.recordId);
      const wallet = await db.wallets.get(walletId);
      if (!group || group.status !== 'active' || group.isCollected) {
        throw new Error('دور الجمعية اتقبض بالفعل أو لم يعد نشطًا.');
      }
      if (!wallet?.id) throw new Error('المكان المالي المختار مش موجود. اختار مكانًا تاني.');

      const payout = group.monthlyAmount * group.totalMonths;
      if (!Number.isFinite(payout) || payout <= 0) throw new Error('مبلغ قبض الجمعية غير صالح.');
      await db.gam3eyat.update(item.recordId, {
        isCollected: true,
        lastPayoutSkippedMonth: undefined,
      });
      await db.transactions.add({
        type: 'income',
        amount: payout,
        category: 'قبض جمعية',
        note: `قبض دور جمعية: ${group.name}`,
        date: getLocalDateString(),
        createdAt: Date.now(),
        walletId: wallet.id,
      });
      await db.wallets.update(wallet.id, { balance: wallet.balance + payout });
    });
  };

  const recordDebtPayment = async (
    item: Extract<UpcomingDueItem, { kind: 'debt' }>,
    walletId: number,
  ) => {
    await db.transaction('rw', [db.debts, db.transactions, db.wallets], async () => {
      const debt = await db.debts.get(item.recordId);
      const wallet = await db.wallets.get(walletId);
      if (!debt || debt.type !== 'on_me' || debt.isCompleted || debt.dueDate !== item.dueDate) {
        throw new Error('بيانات الدين أو موعده اتغير. حدّث الصفحة وحاول تاني.');
      }
      if (!wallet?.id) throw new Error('المكان المالي المختار مش موجود. اختار مكانًا تاني.');

      const remaining = getDebtRemainingAmount(debt);
      if (remaining <= 0) throw new Error('الدين مسدد بالفعل.');
      await db.debts.update(item.recordId, {
        paidAmount: getDebtPaidAmount(debt) + remaining,
        isCompleted: true,
        skippedDueDate: undefined,
      });
      await db.transactions.add({
        type: 'expense',
        amount: remaining,
        category: 'أقساط ومستحقات',
        note: `سداد دين لـ ${debt.personName}`,
        date: getLocalDateString(),
        createdAt: Date.now(),
        walletId: wallet.id,
      });
      await db.wallets.update(wallet.id, { balance: wallet.balance - remaining });
    });
  };

  const recordDueItem = async (item: UpcomingDueItem, walletId: number) => {
    setBusyItemId(item.id);
    setActionError('');
    setPickerError('');
    try {
      if (item.kind === 'recurring') {
        await applyRecurringOccurrence(item.recordId, 'record', walletId);
      } else if (item.kind === 'gam3eya-installment') {
        await recordGam3eyaInstallment(item, walletId);
      } else if (item.kind === 'gam3eya-payout') {
        await recordGam3eyaPayout(item, walletId);
      } else {
        await recordDebtPayment(item, walletId);
      }
      setPendingItem(null);
      await refreshAfterAction();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر تسجيل الاستحقاق.';
      if (pendingItem) setPickerError(message);
      else setActionError(message);
      await refresh();
    } finally {
      setBusyItemId(null);
    }
  };

  const beginRecording = (item: UpcomingDueItem) => {
    const defaultWallet = wallets.find((wallet) => wallet.id === item.walletId);
    if (defaultWallet?.id) {
      void recordDueItem(item, defaultWallet.id);
      return;
    }
    setPendingItem(item);
    setSelectedWalletId(wallets[0]?.id === undefined ? '' : String(wallets[0].id));
    setPickerError('');
  };

  const skipDueItem = async (item: UpcomingDueItem) => {
    setBusyItemId(item.id);
    setActionError('');
    try {
      if (item.kind === 'recurring') {
        await applyRecurringOccurrence(item.recordId, 'skip');
      } else if (item.kind === 'gam3eya-installment') {
        await db.transaction('rw', db.gam3eyat, async () => {
          const group = await db.gam3eyat.get(item.recordId);
          if (!group || group.status !== 'active') throw new Error('الجمعية مش نشطة.');
          if (group.lastInstallmentPaidMonth === item.cycleMonth) {
            throw new Error('قسط الجمعية اتسجل بالفعل في الدورة دي.');
          }
          await db.gam3eyat.update(item.recordId, {
            lastInstallmentSkippedMonth: item.cycleMonth,
          });
        });
      } else if (item.kind === 'gam3eya-payout') {
        await db.transaction('rw', db.gam3eyat, async () => {
          const group = await db.gam3eyat.get(item.recordId);
          if (!group || group.isCollected) throw new Error('دور الجمعية اتقبض بالفعل.');
          await db.gam3eyat.update(item.recordId, { lastPayoutSkippedMonth: item.cycleMonth });
        });
      } else {
        await db.transaction('rw', db.debts, async () => {
          const debt = await db.debts.get(item.recordId);
          if (!debt || debt.isCompleted || debt.dueDate !== item.dueDate) {
            throw new Error('بيانات الدين أو موعده اتغير. حدّث الصفحة وحاول تاني.');
          }
          await db.debts.update(item.recordId, { skippedDueDate: item.dueDate });
        });
      }
      setPendingItem(null);
      await refreshAfterAction();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'تعذر تخطي هذا الموعد.');
      await refresh();
    } finally {
      setBusyItemId(null);
    }
  };

  if (!items.length) return null;

  return (
    <>
      <section
        aria-labelledby="upcoming-due-alerts-title"
        className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/80 shadow-sm"
      >
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            {items.some((item) => daysUntilDueDate(item.dueDate, today)! < 0) ? (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <BellRing className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="upcoming-due-alerts-title" className="text-xs font-black text-amber-950">
              استحقاقات الأسبوع
            </h2>
            <p className="mt-1 text-[10px] leading-4 text-amber-900">
              عندك {items.length.toLocaleString('ar-EG')} استحقاق قريب أو متأخر خلال الشهر الحالي.
            </p>
          </div>
          <Clock3 className="mt-1 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        </div>

        <div className="divide-y divide-amber-100 border-t border-amber-200/80 bg-white/80">
          {items.map((item) => {
            const needsPicker =
              item.kind !== 'recurring' || !wallets.some((wallet) => wallet.id === item.walletId);
            const busy = busyItemId === item.id;
            return (
              <article key={item.id} className="p-3.5 sm:px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-slate-900">{item.name}</p>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {item.sourceLabel} · {dueDescription(item.dueDate, today)} ·{' '}
                      {formatDueDate(item.dueDate)}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-xs font-black tabular-nums text-slate-900"
                    dir="ltr"
                  >
                    {formatCurrency(item.amount)}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => beginRecording(item)}
                    className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-[10px] font-black text-white transition-colors hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.direction === 'income' ? 'تم الاستلام' : 'تم الدفع'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void skipDueItem(item)}
                    className="inline-flex min-h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
                    تخطي
                  </button>
                  {needsPicker && wallets.length === 0 && (
                    <span className="self-center text-[10px] text-amber-900">
                      أضف مكانًا ماليًا لتسجيل الحركة.
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {actionError && (
          <p
            role="alert"
            className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-[10px] font-bold text-rose-700"
          >
            {actionError}
          </p>
        )}
      </section>

      {pendingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="due-wallet-picker-title"
            className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                <Wallet className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 id="due-wallet-picker-title" className="text-sm font-black text-slate-800">
                اختار مكان الحركة
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              {pendingItem.direction === 'income' ? 'هنضيف المبلغ إلى' : 'هنخصم المبلغ من'} «
              {pendingItem.name}».
            </p>
            {wallets.length ? (
              <label className="block text-[11px] font-bold text-slate-700">
                المكان المالي
                <select
                  value={selectedWalletId}
                  onChange={(event) => setSelectedWalletId(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold"
                >
                  {wallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} · {formatCurrency(wallet.balance)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                أضف مكانًا ماليًا من ملخص أموالك الأول.
              </p>
            )}
            {pickerError && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700"
              >
                {pickerError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!wallets.length || busyItemId === pendingItem.id || !selectedWalletId}
                onClick={() => void recordDueItem(pendingItem, Number(selectedWalletId))}
                className="min-h-11 flex-1 rounded-xl bg-emerald-700 px-3 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {busyItemId === pendingItem.id ? 'جاري الحفظ...' : 'تأكيد وتحديث الرصيد'}
              </button>
              <button
                type="button"
                disabled={busyItemId === pendingItem.id}
                onClick={() => {
                  setPendingItem(null);
                  setPickerError('');
                }}
                className="min-h-11 rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
};
