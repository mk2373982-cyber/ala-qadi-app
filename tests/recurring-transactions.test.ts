import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyRecurringOccurrence,
  getLocalDateString,
  getNextMonthlyCycleDate,
} from '@/lib/recurring-transactions';
import { db } from '@/lib/db';

describe('getNextMonthlyCycleDate', () => {
  it('preserves the rule day-of-month in the next month', () => {
    expect(getNextMonthlyCycleDate('2026-01-15', 15)).toBe('2026-02-15');
    expect(getNextMonthlyCycleDate('2026-12-15', 15)).toBe('2027-01-15');
  });

  it('clamps to the last day of shorter months', () => {
    expect(getNextMonthlyCycleDate('2026-01-31', 31)).toBe('2026-02-28');
    expect(getNextMonthlyCycleDate('2026-08-31', 31)).toBe('2026-09-30');
    expect(getNextMonthlyCycleDate('2026-04-30', 30)).toBe('2026-05-30');
  });

  it('clamps to February 29 in leap years', () => {
    expect(getNextMonthlyCycleDate('2024-01-31', 31)).toBe('2024-02-29');
    expect(getNextMonthlyCycleDate('2028-01-31', 31)).toBe('2028-02-29');
    expect(getNextMonthlyCycleDate('2100-01-31', 31)).toBe('2100-02-28'); // century, not leap
  });

  it('recovers the stored day after a clamped month', () => {
    // A February 28 occurrence must return to the 31st in March.
    expect(getNextMonthlyCycleDate('2026-02-28', 31)).toBe('2026-03-31');
  });

  it('advances an overdue cycle from the current month using the stored day', () => {
    expect(getNextMonthlyCycleDate('2026-01-20', 5)).toBe('2026-02-05');
  });

  it('falls back to the cycle date day when the stored day is invalid', () => {
    expect(getNextMonthlyCycleDate('2026-01-15', NaN)).toBe('2026-02-15');
    expect(getNextMonthlyCycleDate('2026-01-15', 0)).toBe('2026-02-15');
  });

  it('clamps out-of-range large day values to the month length', () => {
    expect(getNextMonthlyCycleDate('2026-01-15', 32)).toBe('2026-02-28');
  });

  it('rejects a malformed cycle date', () => {
    expect(() => getNextMonthlyCycleDate('garbage', 5)).toThrow();
  });
});

describe('applyRecurringOccurrence', () => {
  beforeEach(async () => {
    await Promise.all([
      db.transactions.clear(),
      db.wallets.clear(),
      db.recurringTransactions.clear(),
    ]);
  });

  async function seedRule(overrides: Partial<{ dayOfMonth: number; nextDueDate: string }> = {}) {
    const today = getLocalDateString();
    const walletId = await db.wallets.add({
      name: 'كاش',
      kind: 'cash',
      balance: 1000,
      createdAt: Date.now(),
    });
    const ruleId = await db.recurringTransactions.add({
      name: 'إيجار الشقة',
      type: 'expense',
      amount: 2000,
      category: 'أقساط ومستحقات',
      walletId,
      dayOfMonth: overrides.dayOfMonth ?? 15,
      nextDueDate: overrides.nextDueDate ?? today,
      isActive: true,
      createdAt: Date.now(),
    });
    return { walletId, ruleId, today };
  }

  it('records the occurrence, updates the wallet atomically, and keeps the stored day', async () => {
    const { walletId, ruleId, today } = await seedRule({ dayOfMonth: 15 });

    const result = await applyRecurringOccurrence(ruleId, 'record');

    expect(result.action).toBe('record');
    expect(result.transactionDate).toBe(today);
    expect(result.nextDueDate).toBe(getNextMonthlyCycleDate(today, 15));

    const wallet = await db.wallets.get(walletId);
    expect(wallet?.balance).toBe(1000 - 2000);

    const transactions = await db.transactions.toArray();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      type: 'expense',
      amount: 2000,
      walletId,
      date: today,
    });

    const rule = await db.recurringTransactions.get(ruleId);
    expect(rule?.lastCompletedMonth).toBe(today.slice(0, 7));
  });

  it('advances an overdue rule with end-of-month clamping', async () => {
    // Rule due on the 1st but recorded late in the month; stored day 31.
    const today = getLocalDateString();
    const { ruleId } = await seedRule({ dayOfMonth: 31, nextDueDate: `${today.slice(0, 7)}-01` });

    const result = await applyRecurringOccurrence(ruleId, 'record');

    expect(result.nextDueDate).toBe(getNextMonthlyCycleDate(today, 31));
    const rule = await db.recurringTransactions.get(ruleId);
    expect(rule?.nextDueDate).toBe(result.nextDueDate);
  });

  it('credits income occurrences into the wallet', async () => {
    const today = getLocalDateString();
    const walletId = await db.wallets.add({
      name: 'محفظة',
      kind: 'mobile',
      balance: 500,
      createdAt: Date.now(),
    });
    const ruleId = await db.recurringTransactions.add({
      name: 'راتب',
      type: 'income',
      amount: 700,
      category: 'الراتب الأساسي',
      walletId,
      dayOfMonth: 10,
      nextDueDate: today,
      isActive: true,
      createdAt: Date.now(),
    });

    await applyRecurringOccurrence(ruleId, 'record');

    expect((await db.wallets.get(walletId))?.balance).toBe(1200);
    const [transaction] = await db.transactions.toArray();
    expect(transaction?.type).toBe('income');
  });

  it('skips an occurrence without touching wallets or creating transactions', async () => {
    const { walletId, ruleId, today } = await seedRule({ dayOfMonth: 15 });

    const result = await applyRecurringOccurrence(ruleId, 'skip');

    expect(result.action).toBe('skip');
    expect(result.nextDueDate).toBe(getNextMonthlyCycleDate(today, 15));
    expect(await db.transactions.count()).toBe(0);
    expect((await db.wallets.get(walletId))?.balance).toBe(1000);
    const rule = await db.recurringTransactions.get(ruleId);
    expect(rule?.lastCompletedMonth).toBeUndefined();
  });

  it('aborts safely when the wallet no longer exists', async () => {
    const { ruleId } = await seedRule();
    const today = getLocalDateString();
    await db.wallets.clear();

    await expect(applyRecurringOccurrence(ruleId, 'record', 999)).rejects.toThrow(
      'المكان المالي المختار غير موجود',
    );
    expect(await db.transactions.count()).toBe(0);
    const rule = await db.recurringTransactions.get(ruleId);
    expect(rule?.nextDueDate).toBe(today); // unchanged (transaction rolled back)
  });

  it('rejects occurrences more than a week ahead of schedule', async () => {
    const today = getLocalDateString();
    const day = Number(today.slice(8, 10));
    const farFuture = getNextMonthlyCycleDate(today, day); // ~1 month out
    const { ruleId } = await seedRule({ nextDueDate: farFuture });

    await expect(applyRecurringOccurrence(ruleId, 'record')).rejects.toThrow(
      'الموعد لسه أكتر من أسبوع',
    );
    expect(await db.transactions.count()).toBe(0);
  });

  it('rejects inactive rules', async () => {
    const { ruleId } = await seedRule();
    await db.recurringTransactions.update(ruleId, { isActive: false });

    await expect(applyRecurringOccurrence(ruleId, 'record')).rejects.toThrow('متوقفة');
  });
});
