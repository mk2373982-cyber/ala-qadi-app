import { describe, expect, it } from 'vitest';
import type { Debt, Gam3eya, RecurringTransaction, Transaction } from '@/lib/db';
import { daysUntilDueDate, getUpcomingDueItems, isUpcomingDueDate } from '@/lib/upcoming-due';

const TODAY = '2026-11-27';

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 1,
    type: 'on_me',
    personName: 'أحمد',
    totalAmount: 500,
    paidAmount: 100,
    isCompleted: false,
    createdAt: 1,
    ...overrides,
  };
}

function makeGroup(overrides: Partial<Gam3eya> = {}): Gam3eya {
  return {
    id: 1,
    name: 'جمعية الشارع',
    monthlyAmount: 1000,
    totalMonths: 10,
    myTurnMonth: 4,
    paidMonths: 2,
    startDate: '2026-01',
    isCollected: false,
    status: 'active',
    ...overrides,
  };
}

function makeRule(overrides: Partial<RecurringTransaction> = {}): RecurringTransaction {
  return {
    id: 1,
    name: 'إيجار',
    type: 'expense',
    amount: 2000,
    category: 'أقساط ومستحقات',
    walletId: 1,
    dayOfMonth: 1,
    nextDueDate: '2026-12-01',
    isActive: true,
    createdAt: 1,
    ...overrides,
  };
}

describe('isUpcomingDueDate', () => {
  const today = TODAY;

  it('includes dates within the next 7 days (inclusive of today)', () => {
    expect(isUpcomingDueDate(today, today)).toBe(true);
    expect(isUpcomingDueDate('2026-12-04', today)).toBe(true); // +7
  });

  it('excludes dates further than 7 days out', () => {
    expect(isUpcomingDueDate('2026-12-05', today)).toBe(false); // +8
    expect(isUpcomingDueDate('2027-01-01', today)).toBe(false);
  });

  it('keeps overdue dates inside the current month', () => {
    expect(isUpcomingDueDate('2026-11-01', today)).toBe(true);
    expect(isUpcomingDueDate('2026-11-26', today)).toBe(true);
  });

  it('drops overdue dates from earlier months', () => {
    expect(isUpcomingDueDate('2026-10-31', today)).toBe(false);
    expect(isUpcomingDueDate('2026-10-15', today)).toBe(false);
  });

  it('handles invalid dates without throwing', () => {
    expect(isUpcomingDueDate('garbage', today)).toBe(false);
  });
});

describe('daysUntilDueDate', () => {
  it('counts forward and backward in whole days', () => {
    expect(daysUntilDueDate('2026-12-04', TODAY)).toBe(7);
    expect(daysUntilDueDate('2026-11-27', TODAY)).toBe(0);
    expect(daysUntilDueDate('2026-11-01', TODAY)).toBe(-26);
  });
});

describe('getUpcomingDueItems', () => {
  const emptyTransactions: Transaction[] = [];

  it('includes an active recurring rule due within the window', () => {
    const items = getUpcomingDueItems({
      debts: [],
      recurring: [makeRule()],
      gam3eyat: [],
      transactions: emptyTransactions,
      today: TODAY,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'recurring',
      recordId: 1,
      amount: 2000,
      dueDate: '2026-12-01',
      direction: 'expense',
      walletId: 1,
    });
  });

  it('excludes inactive, non-positive, and far-future recurring rules', () => {
    const items = getUpcomingDueItems({
      debts: [],
      recurring: [
        makeRule({ id: 2, isActive: false }),
        makeRule({ id: 3, amount: 0 }),
        makeRule({ id: 4, nextDueDate: '2027-05-01' }),
      ],
      gam3eyat: [],
      transactions: emptyTransactions,
      today: TODAY,
    });
    expect(items).toHaveLength(0);
  });

  it('includes an unpaid gam3eya installment due this month', () => {
    const items = getUpcomingDueItems({
      debts: [],
      recurring: [],
      gam3eyat: [makeGroup()],
      transactions: emptyTransactions,
      today: TODAY,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'gam3eya-installment',
      cycleMonth: '2026-11',
      amount: 1000,
      direction: 'expense',
    });
  });

  it('uses the start month for a future-start gam3eya', () => {
    const items = getUpcomingDueItems({
      debts: [],
      recurring: [],
      gam3eyat: [makeGroup({ startDate: '2026-12' })],
      transactions: emptyTransactions,
      today: TODAY,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'gam3eya-installment', cycleMonth: '2026-12' });
  });

  it('excludes installments already paid or skipped this cycle', () => {
    const paid = getUpcomingDueItems({
      debts: [],
      recurring: [],
      gam3eyat: [makeGroup({ lastInstallmentPaidMonth: '2026-11' })],
      transactions: emptyTransactions,
      today: TODAY,
    });
    expect(paid).toHaveLength(0);

    const skipped = getUpcomingDueItems({
      debts: [],
      recurring: [],
      gam3eyat: [makeGroup({ lastInstallmentSkippedMonth: '2026-11' })],
      transactions: emptyTransactions,
      today: TODAY,
    });
    expect(skipped).toHaveLength(0);
  });

  it('excludes installments covered by a matching transaction note this cycle', () => {
    const items = getUpcomingDueItems({
      debts: [],
      recurring: [],
      gam3eyat: [makeGroup()],
      transactions: [
        {
          id: 9,
          type: 'expense',
          amount: 1000,
          category: 'جمعيات شهرية',
          note: 'قسط شهر (3 من 10) - جمعية الشارع',
          date: '2026-11-10',
          createdAt: 1,
        },
      ],
      today: TODAY,
    });
    expect(items).toHaveLength(0);
  });

  it('excludes fully paid gam3eyat and malformed groups', () => {
    const items = getUpcomingDueItems({
      debts: [],
      recurring: [],
      gam3eyat: [
        makeGroup({ id: 2, paidMonths: 10, totalMonths: 10 }),
        makeGroup({ id: 3, monthlyAmount: 0 }),
        makeGroup({ id: 4, status: 'completed' }),
        makeGroup({ id: 5, startDate: 'bad-date' }),
      ],
      transactions: emptyTransactions,
      today: TODAY,
    });
    expect(items).toHaveLength(0);
  });

  it('includes the payout month as income with the full amount', () => {
    // Start 2026-01, turn month 11 → payout month 2026-11, due date 2026-11-01.
    const items = getUpcomingDueItems({
      debts: [],
      recurring: [],
      gam3eyat: [makeGroup({ myTurnMonth: 11 })],
      transactions: emptyTransactions,
      today: TODAY,
    });
    const payouts = items.filter((item) => item.kind === 'gam3eya-payout');
    expect(payouts).toHaveLength(1);
    expect(payouts[0]).toMatchObject({
      kind: 'gam3eya-payout',
      cycleMonth: '2026-11',
      amount: 10000,
      direction: 'income',
    });
    // The same group still owes its current-cycle installment alongside the payout.
    expect(items.some((item) => item.kind === 'gam3eya-installment')).toBe(true);
  });

  it('excludes collected or skipped payouts', () => {
    const collected = getUpcomingDueItems({
      debts: [],
      recurring: [],
      gam3eyat: [makeGroup({ myTurnMonth: 11, isCollected: true })],
      transactions: emptyTransactions,
      today: TODAY,
    });
    expect(collected.filter((item) => item.kind === 'gam3eya-payout')).toHaveLength(0);

    const skipped = getUpcomingDueItems({
      debts: [],
      recurring: [],
      gam3eyat: [makeGroup({ myTurnMonth: 11, lastPayoutSkippedMonth: '2026-11' })],
      transactions: emptyTransactions,
      today: TODAY,
    });
    expect(skipped.filter((item) => item.kind === 'gam3eya-payout')).toHaveLength(0);
  });

  it('includes an on-me debt due within the window with its remaining amount', () => {
    const items = getUpcomingDueItems({
      debts: [makeDebt({ dueDate: '2026-12-01' })],
      recurring: [],
      gam3eyat: [],
      transactions: emptyTransactions,
      today: TODAY,
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'debt',
      amount: 400,
      dueDate: '2026-12-01',
      direction: 'expense',
    });
  });

  it('excludes completed, skipped, to-me, and stale-due-date debts', () => {
    const items = getUpcomingDueItems({
      debts: [
        makeDebt({ id: 2, isCompleted: true, dueDate: '2026-12-01' }),
        makeDebt({ id: 3, skippedDueDate: '2026-12-01', dueDate: '2026-12-01' }),
        makeDebt({ id: 4, type: 'to_me', dueDate: '2026-12-01' }),
        makeDebt({ id: 5, dueDate: undefined }),
      ],
      recurring: [],
      gam3eyat: [],
      transactions: emptyTransactions,
      today: TODAY,
    });
    expect(items).toHaveLength(0);
  });

  it('sorts items by due date ascending', () => {
    const items = getUpcomingDueItems({
      debts: [makeDebt({ id: 2, dueDate: '2026-12-03' })],
      recurring: [makeRule({ nextDueDate: '2026-12-01' })],
      gam3eyat: [makeGroup({ myTurnMonth: 11 })], // 2026-11-01
      transactions: emptyTransactions,
      today: TODAY,
    });
    // The gam3eya contributes both its installment and its payout on 2026-11-01.
    expect(items.map((item) => item.dueDate)).toEqual([
      '2026-11-01',
      '2026-11-01',
      '2026-12-01',
      '2026-12-03',
    ]);
  });
});
