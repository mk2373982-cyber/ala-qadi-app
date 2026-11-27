import { describe, expect, it } from 'vitest';
import { csvSafeCell, findInvalidImportTable } from '@/lib/export-import';

describe('csvSafeCell (spreadsheet formula injection)', () => {
  it('neutralizes cells that begin with formula trigger characters', () => {
    expect(csvSafeCell('=HYPERLINK("http://x","y")')).toBe('\'=HYPERLINK("http://x","y")');
    expect(csvSafeCell('+201000000000')).toBe("'+201000000000");
    expect(csvSafeCell('-باقي 100 جنيه')).toBe("'-باقي 100 جنيه");
    expect(csvSafeCell('@cmd /c calc')).toBe("'@cmd /c calc");
  });

  it('detects triggers hidden behind leading whitespace', () => {
    expect(csvSafeCell('  =cmd')).toBe("'=cmd");
    expect(csvSafeCell('\t+100')).toBe("'+100");
  });

  it('leaves ordinary Arabic text and numbers untouched', () => {
    expect(csvSafeCell('دفع شهر يناير')).toBe('دفع شهر يناير');
    expect(csvSafeCell('بقسط')).toBe('بقسط');
    expect(csvSafeCell('')).toBe('');
  });
});

const validTransaction = {
  id: 1,
  type: 'expense',
  amount: 50,
  category: 'مواصلات',
  date: '2026-01-02',
  createdAt: 1767000000000,
  walletId: 1,
};

const validData = {
  transactions: [validTransaction],
  categories: [{ id: 1, name: 'مواصلات', type: 'expense', icon: 'Car', color: '#06b6d4' }],
  budgets: [{ id: 1, category: 'TOTAL', monthlyLimit: 5000 }],
  debts: [
    {
      id: 1,
      type: 'on_me',
      personName: 'أحمد',
      totalAmount: 300,
      paidAmount: 100,
      isCompleted: false,
      createdAt: 1767000000000,
    },
  ],
  gam3eyat: [
    {
      id: 1,
      name: 'جمعية الشارع',
      monthlyAmount: 1000,
      totalMonths: 10,
      myTurnMonth: 4,
      paidMonths: 2,
      startDate: '2026-01',
      isCompleted: false,
      status: 'active',
    },
  ],
  savings: [
    {
      id: 1,
      type: 'gold_21',
      name: 'ليرة',
      quantity: 8,
      buyPricePerUnit: 3000,
      currentPricePerUnit: 4200,
      date: '2026-01-02',
    },
  ],
  wallets: [{ id: 1, name: 'كاش', kind: 'cash', balance: 1500, createdAt: 1767000000000 }],
  savingsGoals: [
    { id: 1, name: 'هاتف', targetAmount: 20000, savedAmount: 5000, createdAt: 1767000000000 },
  ],
  recurringTransactions: [
    {
      id: 1,
      name: 'إيجار',
      type: 'expense',
      amount: 2000,
      category: 'أقساط',
      walletId: 1,
      dayOfMonth: 5,
      nextDueDate: '2026-02-05',
      isActive: true,
      createdAt: 1767000000000,
    },
  ],
};

// Rows are typed loosely so tests can assign deliberately invalid values.
type MutableData = { [K in keyof typeof validData]: Record<string, unknown>[] };

function rows(value: unknown): MutableData {
  return structuredClone(value) as MutableData;
}

describe('findInvalidImportTable (JSON restore validation)', () => {
  it('accepts a fully valid payload', () => {
    expect(findInvalidImportTable(structuredClone(validData))).toBeNull();
  });

  it('accepts partial payloads and ignores unknown tables (forward compatibility)', () => {
    expect(findInvalidImportTable({ transactions: [validTransaction] })).toBeNull();
    expect(findInvalidImportTable({ someFutureTable: [{ anything: true }] })).toBeNull();
  });

  it('rejects wrong amount types and negative amounts', () => {
    const bad = rows(validData);
    bad.transactions[0].amount = 'abc';
    expect(findInvalidImportTable(bad)).toContain('المعاملات');

    const negative = rows(validData);
    negative.transactions[0].amount = -5;
    expect(findInvalidImportTable(negative)).not.toBeNull();
    expect(findInvalidImportTable(negative)).toContain('المعاملات');
  });

  it('rejects malformed dates', () => {
    const bad = rows(validData);
    bad.transactions[0].date = '02/01/2026';
    expect(findInvalidImportTable(bad)).toContain('المعاملات');

    const badMonth = rows(validData);
    badMonth.gam3eyat[0].startDate = '2026/01';
    expect(findInvalidImportTable(badMonth)).toContain('الجمعيات');
  });

  it('rejects wrong id types but accepts absent ids (Dexie assigns them)', () => {
    const stringId = rows(validData);
    stringId.wallets[0].id = '1';
    expect(findInvalidImportTable(stringId)).toContain('الأماكن المالية');

    const missingId = rows(validData);
    delete missingId.savingsGoals[0].id;
    expect(findInvalidImportTable(missingId)).toBeNull();
  });

  it('rejects invalid enum values and booleans', () => {
    const badEnum = rows(validData);
    badEnum.gam3eyat[0].status = 'paused';
    expect(findInvalidImportTable(badEnum)).toContain('الجمعيات');

    const badBool = rows(validData);
    badBool.recurringTransactions[0].isActive = 'yes';
    expect(findInvalidImportTable(badBool)).toContain('المعاملات المتكررة');
  });

  it('rejects non-array tables, primitive rows, and non-object payloads', () => {
    const notArray = rows(validData);
    (notArray as Record<string, unknown>).debts = { oops: true };
    expect(findInvalidImportTable(notArray)).toContain('الديون');

    const primitive = rows(validData);
    primitive.budgets[0] = 42 as unknown as Record<string, unknown>;
    expect(findInvalidImportTable(primitive)).toContain('الميزانيات');

    expect(findInvalidImportTable('nope')).not.toBeNull();
    expect(findInvalidImportTable(null)).not.toBeNull();
  });
});
