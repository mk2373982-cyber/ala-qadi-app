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

export function getNextMonthlyCycleDate(currentDate: string) {
  const [year, month] = currentDate.split('-').map(Number);
  const nextMonthFirst = new Date(Date.UTC(year, month, 1));
  const nextYear = nextMonthFirst.getUTCFullYear();
  const nextMonth = String(nextMonthFirst.getUTCMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}-01`;
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
    const followingDate = getNextMonthlyCycleDate(cycleDate);
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
