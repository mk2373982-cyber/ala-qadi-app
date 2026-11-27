import { db } from '@/lib/db';

export type RecurringAction = 'record' | 'skip';

function daysBetween(fromDate: string, toDate: string) {
  const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
  const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) /
      86_400_000,
  );
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextMonthlyCycleDate(currentDate: string, dayOfMonth?: number) {
  const [year, month, day] = currentDate.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new Error('تاريخ الدورة الشهرية غير صالح.');
  }
  const nextMonthFirst = new Date(Date.UTC(year, month, 1));
  const nextYear = nextMonthFirst.getUTCFullYear();
  const nextMonth = nextMonthFirst.getUTCMonth() + 1; // 1-based
  // Day 0 of the following 0-based month index = last day of `nextMonth`.
  const lastDayOfNextMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();

  // Honor the rule's stored day-of-month so schedules keep their chosen day
  // (e.g. the 15th) instead of drifting to the 1st. End-of-month clamping:
  // a rule on the 31st lands on the 30th in 30-day months and on Feb 28/29
  // (leap year) in February. Fall back to the cycle date's own day when the
  // stored value is missing or invalid, then to the 1st.
  const requestedDay =
    Number.isFinite(dayOfMonth) && dayOfMonth! >= 1
      ? Math.round(dayOfMonth!)
      : Number.isFinite(day) && day >= 1
        ? day
        : 1;
  const clampedDay = Math.min(requestedDay, lastDayOfNextMonth);
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export async function applyRecurringOccurrence(
  ruleId: number,
  action: RecurringAction,
  walletIdOverride?: number,
) {
  return db.transaction('rw', [db.recurringTransactions, db.transactions, db.wallets], async () => {
    const rule = await db.recurringTransactions.get(ruleId);
    if (!rule || !rule.isActive) throw new Error('المعاملة المتكررة غير موجودة أو متوقفة.');
    const today = getLocalDateString();
    if (rule.nextDueDate > today && daysBetween(today, rule.nextDueDate) > 7) {
      throw new Error('الموعد لسه أكتر من أسبوع.');
    }

    if (action === 'record') {
      const walletId = walletIdOverride ?? rule.walletId;
      const wallet = await db.wallets.get(walletId);
      if (!wallet?.id)
        throw new Error('المكان المالي المختار غير موجود. عدّل المعاملة المتكررة واختر مكانًا آخر.');
      if (!Number.isFinite(rule.amount) || rule.amount <= 0)
        throw new Error('مبلغ المعاملة المتكررة غير صالح. عدّلها قبل التسجيل.');

      await db.transactions.add({
        type: rule.type,
        amount: rule.amount,
        category: rule.category,
        note: [rule.name, rule.note].filter(Boolean).join(' · '),
        date: today,
        createdAt: Date.now(),
        walletId: wallet.id,
      });
      await db.wallets.update(wallet.id, {
        balance: wallet.balance + (rule.type === 'income' ? rule.amount : -rule.amount),
      });
    }

    const cycleDate = rule.nextDueDate > today ? rule.nextDueDate : today;
    // Recompute from the rule's stored day-of-month, not from the (possibly
    // clamped) cycle date, so a February 28 occurrence still returns to the
    // 31st in March and drifted schedules self-heal on the next occurrence.
    const followingDate = getNextMonthlyCycleDate(cycleDate, rule.dayOfMonth);
    const completedMonth = action === 'record' ? today.slice(0, 7) : undefined;
    await db.recurringTransactions.update(ruleId, {
      nextDueDate: followingDate,
      ...(completedMonth ? { lastCompletedMonth: completedMonth } : {}),
    });
    return {
      action,
      transactionDate: action === 'record' ? today : rule.nextDueDate,
      nextDueDate: followingDate,
      name: rule.name,
    };
  });
}
