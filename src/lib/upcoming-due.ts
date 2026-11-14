import type { Debt, Gam3eya, RecurringTransaction, Transaction } from '@/lib/db';
import { getDebtRemainingAmount } from '@/lib/db';

type DueDirection = 'income' | 'expense';

interface DueItemBase {
  id: string;
  name: string;
  sourceLabel: string;
  amount: number;
  dueDate: string;
  direction: DueDirection;
  walletId?: number;
}

export type UpcomingDueItem =
  | (DueItemBase & { kind: 'recurring'; recordId: number })
  | (DueItemBase & { kind: 'gam3eya-installment'; recordId: number; cycleMonth: string })
  | (DueItemBase & { kind: 'gam3eya-payout'; recordId: number; cycleMonth: string })
  | (DueItemBase & { kind: 'debt'; recordId: number });

interface UpcomingDueInput {
  debts: Debt[];
  recurring: RecurringTransaction[];
  gam3eyat: Gam3eya[];
  transactions: Transaction[];
  today: string;
}

function daysBetween(fromDate: string, toDate: string) {
  const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
  const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
  if (![fromYear, fromMonth, fromDay, toYear, toMonth, toDay].every(Number.isFinite)) return null;
  const days = Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) /
      86_400_000,
  );
  return Number.isFinite(days) ? days : null;
}

export function isUpcomingDueDate(dueDate: string, today: string) {
  const daysUntil = daysBetween(today, dueDate);
  if (daysUntil === null) return false;
  if (daysUntil >= 0) return daysUntil <= 7;
  return dueDate >= `${today.slice(0, 7)}-01`;
}

function addMonthsToMonthKey(monthKey: string, monthsToAdd: number) {
  const [year, month] = monthKey.split('-').map(Number);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(monthsToAdd) ||
    month < 1 ||
    month > 12
  ) {
    return '';
  }
  const date = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function wasInstallmentPaidThisCycle(
  group: Gam3eya,
  cycleMonth: string,
  transactions: Transaction[],
) {
  return (
    group.lastInstallmentPaidMonth === cycleMonth ||
    transactions.some(
      (transaction) =>
        transaction.type === 'expense' &&
        transaction.category === 'جمعيات شهرية' &&
        transaction.date.startsWith(cycleMonth) &&
        transaction.note?.endsWith(` - ${group.name}`),
    )
  );
}

export function getUpcomingDueItems({
  debts,
  recurring,
  gam3eyat,
  transactions,
  today,
}: UpcomingDueInput): UpcomingDueItem[] {
  const currentMonth = today.slice(0, 7);
  const items: UpcomingDueItem[] = [];

  for (const rule of recurring) {
    if (
      !rule.id ||
      !rule.isActive ||
      !Number.isFinite(rule.amount) ||
      rule.amount <= 0 ||
      !isUpcomingDueDate(rule.nextDueDate, today)
    ) {
      continue;
    }
    items.push({
      id: `recurring-${rule.id}`,
      kind: 'recurring',
      recordId: rule.id,
      name: rule.name,
      sourceLabel: 'موعد متكرر',
      amount: rule.amount,
      dueDate: rule.nextDueDate,
      direction: rule.type,
      walletId: rule.walletId,
    });
  }

  for (const group of gam3eyat) {
    if (
      !group.id ||
      group.status !== 'active' ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(group.startDate) ||
      !Number.isFinite(group.monthlyAmount) ||
      group.monthlyAmount <= 0 ||
      !Number.isFinite(group.totalMonths) ||
      group.totalMonths <= 0 ||
      !Number.isFinite(group.paidMonths)
    ) {
      continue;
    }

    const installmentCycleMonth = group.startDate > currentMonth ? group.startDate : currentMonth;
    const installmentDueDate = `${installmentCycleMonth}-01`;
    if (
      group.paidMonths < group.totalMonths &&
      group.lastInstallmentSkippedMonth !== installmentCycleMonth &&
      !wasInstallmentPaidThisCycle(group, installmentCycleMonth, transactions) &&
      isUpcomingDueDate(installmentDueDate, today)
    ) {
      items.push({
        id: `gam3eya-installment-${group.id}`,
        kind: 'gam3eya-installment',
        recordId: group.id,
        cycleMonth: installmentCycleMonth,
        name: group.name,
        sourceLabel: 'قسط جمعية',
        amount: group.monthlyAmount,
        dueDate: installmentDueDate,
        direction: 'expense',
      });
    }

    const payoutCycleMonth = addMonthsToMonthKey(group.startDate, group.myTurnMonth - 1);
    const payoutDueDate = payoutCycleMonth ? `${payoutCycleMonth}-01` : '';
    if (
      !group.isCollected &&
      payoutCycleMonth &&
      group.lastPayoutSkippedMonth !== payoutCycleMonth &&
      isUpcomingDueDate(payoutDueDate, today)
    ) {
      items.push({
        id: `gam3eya-payout-${group.id}`,
        kind: 'gam3eya-payout',
        recordId: group.id,
        cycleMonth: payoutCycleMonth,
        name: group.name,
        sourceLabel: 'موعد قبض الجمعية',
        amount: group.monthlyAmount * group.totalMonths,
        dueDate: payoutDueDate,
        direction: 'income',
      });
    }
  }

  for (const debt of debts) {
    const remaining = getDebtRemainingAmount(debt);
    if (
      !debt.id ||
      debt.type !== 'on_me' ||
      debt.isCompleted ||
      !debt.dueDate ||
      debt.skippedDueDate === debt.dueDate ||
      !Number.isFinite(remaining) ||
      remaining <= 0 ||
      !isUpcomingDueDate(debt.dueDate, today)
    ) {
      continue;
    }
    items.push({
      id: `debt-${debt.id}`,
      kind: 'debt',
      recordId: debt.id,
      name: debt.personName,
      sourceLabel: 'دين مستحق عليك',
      amount: remaining,
      dueDate: debt.dueDate,
      direction: 'expense',
    });
  }

  return items.sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

export function daysUntilDueDate(dueDate: string, today: string) {
  return daysBetween(today, dueDate);
}
