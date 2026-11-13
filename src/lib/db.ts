import Dexie, { type Table } from 'dexie';

export interface Transaction {
  id?: number;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  note?: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
  walletId?: number;
}

export interface WalletAccount {
  id?: number;
  name: string;
  kind: 'cash' | 'card' | 'mobile' | 'other';
  balance: number;
  createdAt: number;
}

export interface Category {
  id?: number;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  isDefault?: boolean;
}

export interface Budget {
  id?: number;
  category: string; // category name or 'TOTAL'
  monthlyLimit: number;
}

export interface Debt {
  id?: number;
  type: 'to_me' | 'on_me'; // to_me = فلوس ليّا برة, on_me = ديون عليّا
  personName: string;
  totalAmount: number;
  paidAmount: number;
  note?: string;
  dueDate?: string;
  isCompleted: boolean;
  createdAt: number;
}

export interface Gam3eya {
  id?: number;
  name: string;
  monthlyAmount: number;
  totalMonths: number;
  myTurnMonth: number; // الشهر الذي ستقبض فيه
  paidMonths: number;
  startDate: string; // YYYY-MM
  isCollected: boolean; // هل قبضت جمعيتك أم لسه
  status: 'active' | 'completed';
}

export interface SavingsAsset {
  id?: number;
  type: 'gold_21' | 'gold_24' | 'usd' | 'cash_cert';
  name: string;
  quantity: number; // جرامات الذهب أو عدد الدولارات
  buyPricePerUnit: number;
  currentPricePerUnit: number;
  note?: string;
  date: string;
}

export interface SavingsGoal {
  id?: number;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate?: string;
  createdAt: number;
}

export interface RecurringTransaction {
  id?: number;
  name: string;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  note?: string;
  walletId: number;
  dayOfMonth: number;
  nextDueDate: string;
  lastCompletedMonth?: string;
  isActive: boolean;
  createdAt: number;
}

export interface DriveBackupKey {
  userId: string;
  key: CryptoKey;
  recoveryAcknowledged: boolean;
  createdAt: string;
}

const LEGACY_DATABASE_NAME = 'AlaQaddiLocalDB';
const LEGACY_DATABASE_OWNER_KEY = 'ala_qaddi_legacy_database_owner';

export class AlaQaddiDatabase extends Dexie {
  transactions!: Table<Transaction>;
  categories!: Table<Category>;
  budgets!: Table<Budget>;
  debts!: Table<Debt>;
  gam3eyat!: Table<Gam3eya>;
  savings!: Table<SavingsAsset>;
  wallets!: Table<WalletAccount>;
  driveBackupKeys!: Table<DriveBackupKey>;
  savingsGoals!: Table<SavingsGoal>;
  recurringTransactions!: Table<RecurringTransaction>;

  constructor(databaseName = LEGACY_DATABASE_NAME) {
    super(databaseName);
    this.version(1).stores({
      transactions: '++id, type, category, date, createdAt',
      categories: '++id, name, type',
      budgets: '++id, category',
      debts: '++id, type, personName, isCompleted, dueDate',
      gam3eyat: '++id, name, status',
      savings: '++id, type',
    });
    this.version(2).stores({
      transactions: '++id, type, category, date, createdAt, walletId',
      categories: '++id, name, type',
      budgets: '++id, category',
      debts: '++id, type, personName, isCompleted, dueDate',
      gam3eyat: '++id, name, status',
      savings: '++id, type',
      wallets: '++id, name, kind, createdAt',
    });
    this.version(3).stores({
      transactions: '++id, type, category, date, createdAt, walletId',
      categories: '++id, name, type',
      budgets: '++id, category',
      debts: '++id, type, personName, isCompleted, dueDate',
      gam3eyat: '++id, name, status',
      savings: '++id, type',
      wallets: '++id, name, kind, createdAt',
      driveBackupKeys: '&userId',
    });
    this.version(4).stores({
      transactions: '++id, type, category, date, createdAt, walletId',
      categories: '++id, name, type',
      budgets: '++id, category',
      debts: '++id, type, personName, isCompleted, dueDate',
      gam3eyat: '++id, name, status',
      savings: '++id, type',
      wallets: '++id, name, kind, createdAt',
      driveBackupKeys: '&userId',
      savingsGoals: '++id, name, targetDate, createdAt',
      recurringTransactions: '++id, type, category, walletId, nextDueDate, isActive, createdAt',
    });
  }
}

export let db = new AlaQaddiDatabase();

let databaseSwitchQueue: Promise<void> = Promise.resolve();

function databaseNameForUser(userId: string | null) {
  return userId
    ? `AlaQaddiLocalDB_user_${encodeURIComponent(userId)}`
    : 'AlaQaddiLocalDB_guest';
}

async function migrateLegacyDataIfOwned(target: AlaQaddiDatabase, userId: string, accountCreatedAt?: string, lockHeld = false) {
  if (typeof window === 'undefined' || !accountCreatedAt) return;
  if (!lockHeld && typeof navigator !== 'undefined' && navigator.locks?.request) {
    await navigator.locks.request('ala-qaddi-legacy-database-migration', { mode: 'exclusive' }, () =>
      migrateLegacyDataIfOwned(target, userId, accountCreatedAt, true));
    return;
  }
  let existingOwner: string | null;
  try {
    existingOwner = window.localStorage.getItem(LEGACY_DATABASE_OWNER_KEY);
  } catch {
    return;
  }
  if (existingOwner && existingOwner !== userId) return;

  const legacy = db.name === LEGACY_DATABASE_NAME ? db : new AlaQaddiDatabase(LEGACY_DATABASE_NAME);
  await legacy.open();
  try {
    const [transactions, categories, budgets, debts, gam3eyet, savings, wallets, allBackupKeys, savingsGoals, recurringTransactions] = await Promise.all([
      legacy.transactions.toArray(), legacy.categories.toArray(), legacy.budgets.toArray(), legacy.debts.toArray(),
      legacy.gam3eyat.toArray(), legacy.savings.toArray(), legacy.wallets.toArray(), legacy.driveBackupKeys.toArray(),
      legacy.savingsGoals.toArray(), legacy.recurringTransactions.toArray(),
    ]);
    const driveBackupKeys = allBackupKeys.filter((record) => record.userId === userId);
    const legacyRows = [transactions, categories, budgets, debts, gam3eyet, savings, wallets, driveBackupKeys, savingsGoals, recurringTransactions];
    if (!legacyRows.some((rows) => rows.length > 0)) return;

    // Only let an account that predates this device's first financial entry claim
    // the unscoped database. New/demo accounts therefore start with an empty DB.
    const timestamps = [
      ...transactions.map((row) => row.createdAt),
      ...debts.map((row) => row.createdAt),
      ...wallets.map((row) => row.createdAt),
      ...savingsGoals.map((row) => row.createdAt),
      ...recurringTransactions.map((row) => row.createdAt),
      ...savings.map((row) => Date.parse(`${row.date}T00:00:00`)),
    ].filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);
    const accountTimestamp = Date.parse(accountCreatedAt);
    if (!timestamps.length || !Number.isFinite(accountTimestamp) || accountTimestamp > Math.min(...timestamps)) return;

    const targetTables = [target.transactions, target.categories, target.budgets, target.debts, target.gam3eyat, target.savings, target.wallets, target.driveBackupKeys, target.savingsGoals, target.recurringTransactions];
    await target.transaction('rw', targetTables, async () => {
      const currentCounts = await Promise.all(targetTables.map((table) => table.count()));
      if (currentCounts.some((count) => count > 0)) return;
      if (transactions.length) await target.transactions.bulkAdd(transactions);
      if (categories.length) await target.categories.bulkAdd(categories);
      if (budgets.length) await target.budgets.bulkAdd(budgets);
      if (debts.length) await target.debts.bulkAdd(debts);
      if (gam3eyet.length) await target.gam3eyat.bulkAdd(gam3eyet);
      if (savings.length) await target.savings.bulkAdd(savings);
      if (wallets.length) await target.wallets.bulkAdd(wallets);
      if (driveBackupKeys.length) await target.driveBackupKeys.bulkAdd(driveBackupKeys);
      if (savingsGoals.length) await target.savingsGoals.bulkAdd(savingsGoals);
      if (recurringTransactions.length) await target.recurringTransactions.bulkAdd(recurringTransactions);
    });
    try {
      window.localStorage.setItem(LEGACY_DATABASE_OWNER_KEY, userId);
    } catch {
      // Financial data has already been copied safely; IndexedDB remains authoritative.
    }
  } finally {
    if (legacy !== db) legacy.close();
  }
}

export function activateUserDatabase(userId: string | null, accountCreatedAt?: string, allowLegacyMigration = false) {
  const operation = databaseSwitchQueue.then(async () => {
    const targetName = databaseNameForUser(userId);
    if (db.name !== targetName) {
      const previous = db;
      const next = new AlaQaddiDatabase(targetName);
      await next.open();
      db = next;
      previous.close();
    }
    if (userId && allowLegacyMigration) {
      await migrateLegacyDataIfOwned(db, userId, accountCreatedAt);
    }
    if (userId) await seedDefaultCategoriesIfEmpty();
  });
  databaseSwitchQueue = operation.catch(() => {});
  return operation;
}

// Default Egyptian / Arabic categories
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  // Expenses
  { name: 'مصاريف البيت والطلبات', type: 'expense', icon: 'Home', color: '#10b981', isDefault: true },
  { name: 'مواصلات وبنزين', type: 'expense', icon: 'Car', color: '#06b6d4', isDefault: true },
  { name: 'فواتير وكهرباء وغاز', type: 'expense', icon: 'Zap', color: '#f59e0b', isDefault: true },
  { name: 'علاج وصيدلية', type: 'expense', icon: 'Pill', color: '#ef4444', isDefault: true },
  { name: 'خروجات ومطاعم وترفيه', type: 'expense', icon: 'Coffee', color: '#8b5cf6', isDefault: true },
  { name: 'تسوق وملابس', type: 'expense', icon: 'ShoppingBag', color: '#ec4899', isDefault: true },
  { name: 'أقساط ومستحقات', type: 'expense', icon: 'CreditCard', color: '#f97316', isDefault: true },
  { name: 'جمعيات شهرية', type: 'expense', icon: 'Users', color: '#6366f1', isDefault: true },
  { name: 'مصاريف أخرى', type: 'expense', icon: 'MoreHorizontal', color: '#64748b', isDefault: true },
  
  // Incomes
  { name: 'الراتب الأساسي', type: 'income', icon: 'Briefcase', color: '#10b981', isDefault: true },
  { name: 'شغل حر / إضافي (فريلانس)', type: 'income', icon: 'Laptop', color: '#0ea5e9', isDefault: true },
  { name: 'قبض جمعية', type: 'income', icon: 'Gift', color: '#8b5cf6', isDefault: true },
  { name: 'استرداد سلفة أو دين', type: 'income', icon: 'RotateCcw', color: '#14b8a6', isDefault: true },
  { name: 'أرباح أو استثمار', type: 'income', icon: 'TrendingUp', color: '#f59e0b', isDefault: true },
  { name: 'دخل آخر', type: 'income', icon: 'PlusCircle', color: '#64748b', isDefault: true },
];

export async function seedDefaultCategoriesIfEmpty() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }
}

export async function seedDefaultWalletsOnce(userId: string) {
  if (typeof window === 'undefined' || !userId) return;
  const marker = `ala_qaddi_default_wallets_seeded_${userId}`;
  try {
    if (localStorage.getItem(marker) === 'true') return;
  } catch {
    // Continue with the wallet count check when browser storage is unavailable.
  }

  await db.transaction('rw', db.wallets, async () => {
    if (await db.wallets.count() === 0) {
      const createdAt = Date.now();
      await db.wallets.bulkAdd([
        { name: 'كاش', kind: 'cash', balance: 0, createdAt },
        { name: 'محفظة', kind: 'mobile', balance: 0, createdAt },
        { name: 'فيزا', kind: 'card', balance: 0, createdAt },
      ]);
    }
  });

  try {
    localStorage.setItem(marker, 'true');
  } catch {
    // Existing wallet rows still prevent duplicate defaults on the next load.
  }
}
