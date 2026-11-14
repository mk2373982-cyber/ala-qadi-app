import { DEFAULT_CATEGORIES, db } from '@/lib/db';

export const BACKUP_TABLES = [
  // driveBackupKeys stores device-bound encryption keys and must remain local.
  'transactions',
  'categories',
  'budgets',
  'debts',
  'gam3eyat',
  'savings',
  'wallets',
  'savingsGoals',
  'recurringTransactions',
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];
export type BackupPayload = {
  appName: 'على قدي';
  version: string;
  exportedAt: string;
  exportDate: string;
  data: Record<BackupTableName, unknown[]>;
};

export type CloudBackup = {
  backup: BackupPayload;
  updatedAt: string;
};

export const BACKUP_TABLE_LABELS: Record<BackupTableName, string> = {
  transactions: 'الحركات',
  categories: 'التصنيفات',
  budgets: 'الميزانيات',
  debts: 'الديون',
  gam3eyat: 'الجمعيات',
  savings: 'الذهب والأصول',
  wallets: 'أماكن الفلوس',
  savingsGoals: 'أهداف الادخار',
  recurringTransactions: 'الالتزامات المتكررة',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function createLocalBackup(): Promise<BackupPayload> {
  const [
    transactions,
    categories,
    budgets,
    debts,
    gam3eyat,
    savings,
    wallets,
    savingsGoals,
    recurringTransactions,
  ] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.budgets.toArray(),
    db.debts.toArray(),
    db.gam3eyat.toArray(),
    db.savings.toArray(),
    db.wallets.toArray(),
    db.savingsGoals.toArray(),
    db.recurringTransactions.toArray(),
  ]);

  const exportedAt = new Date().toISOString();
  return {
    appName: 'على قدي',
    version: '3.0',
    exportedAt,
    exportDate: exportedAt,
    data: {
      transactions,
      categories,
      budgets,
      debts,
      gam3eyat,
      savings,
      wallets,
      savingsGoals,
      recurringTransactions,
    },
  };
}

export function validateCloudBackup(value: unknown): BackupPayload {
  if (!isRecord(value) || value.appName !== 'على قدي' || !isRecord(value.data)) {
    throw new Error('النسخة غير صالحة أو لا تخص تطبيق على قدي.');
  }

  const exportedAt =
    typeof value.exportedAt === 'string'
      ? value.exportedAt
      : typeof value.exportDate === 'string'
        ? value.exportDate
        : '';
  if (!exportedAt || !Number.isFinite(Date.parse(exportedAt))) {
    throw new Error('تاريخ النسخة غير صالح.');
  }
  if (typeof value.version !== 'string' || !value.version.trim()) {
    throw new Error('رقم إصدار النسخة غير صالح.');
  }

  const data = {} as BackupPayload['data'];
  for (const table of BACKUP_TABLES) {
    const rows = value.data[table];
    if (!Array.isArray(rows) || rows.some((row) => !isRecord(row))) {
      throw new Error('النسخة غير مكتملة أو تحتوي على بيانات غير صالحة.');
    }
    data[table] = rows;
  }

  return {
    appName: 'على قدي',
    version: value.version,
    exportedAt,
    exportDate:
      typeof value.exportDate === 'string' && Number.isFinite(Date.parse(value.exportDate))
        ? value.exportDate
        : exportedAt,
    data,
  };
}

export function countBackupRecords(backup: BackupPayload) {
  return Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, backup.data[table].length]),
  ) as Record<BackupTableName, number>;
}

export async function fetchCloudBackup(): Promise<CloudBackup | null> {
  await migrateExistingSessionCookie();
  const response = await fetch('/api/backup', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const result = (await response.json().catch(() => null)) as {
    backup?: unknown;
    updatedAt?: unknown;
    error?: string;
  } | null;
  if (!response.ok) {
    throw new Error(result?.error || 'تعذر تحميل النسخة الاحتياطية.');
  }
  if (result === null) return null;
  if (typeof result.updatedAt !== 'string' || !Number.isFinite(Date.parse(result.updatedAt))) {
    throw new Error('بيانات النسخة الاحتياطية غير مكتملة.');
  }
  return { backup: validateCloudBackup(result.backup), updatedAt: result.updatedAt };
}

export async function saveCloudBackup(backup: BackupPayload): Promise<string> {
  await migrateExistingSessionCookie();
  const response = await fetch('/api/backup', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backup),
  });
  const result = (await response.json().catch(() => null)) as {
    updatedAt?: unknown;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(result?.error || 'تعذر حفظ النسخة الاحتياطية.');
  if (!result || typeof result.updatedAt !== 'string') {
    throw new Error('لم يصل تأكيد حفظ النسخة الاحتياطية.');
  }
  return result.updatedAt;
}

async function migrateExistingSessionCookie() {
  try {
    await fetch('/api/auth/check-status', {
      method: 'POST',
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    // The backup request below will show the appropriate network or session error.
  }
}

export async function restoreCloudBackup(backup: BackupPayload) {
  const tables = [
    db.transactions,
    db.categories,
    db.budgets,
    db.debts,
    db.gam3eyat,
    db.savings,
    db.wallets,
    db.savingsGoals,
    db.recurringTransactions,
  ];

  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((table) => table.clear()));
    await db.transactions.bulkAdd(backup.data.transactions as never[]);
    await db.categories.bulkAdd(backup.data.categories as never[]);
    await db.budgets.bulkAdd(backup.data.budgets as never[]);
    await db.debts.bulkAdd(backup.data.debts as never[]);
    await db.gam3eyat.bulkAdd(backup.data.gam3eyat as never[]);
    await db.savings.bulkAdd(backup.data.savings as never[]);
    await db.wallets.bulkAdd(backup.data.wallets as never[]);
    await db.savingsGoals.bulkAdd(backup.data.savingsGoals as never[]);
    await db.recurringTransactions.bulkAdd(backup.data.recurringTransactions as never[]);
  });
}

export async function hasMeaningfulLocalData() {
  const [
    transactions,
    categories,
    budgets,
    debts,
    gam3eyat,
    savings,
    wallets,
    savingsGoals,
    recurringTransactions,
  ] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.budgets.toArray(),
    db.debts.toArray(),
    db.gam3eyat.toArray(),
    db.savings.toArray(),
    db.wallets.toArray(),
    db.savingsGoals.toArray(),
    db.recurringTransactions.toArray(),
  ]);

  const builtInCategories = new Set(
    DEFAULT_CATEGORIES.map((category) => category.type + ':' + category.name),
  );
  const hasCustomCategories = categories.some(
    (category) =>
      !category.isDefault || !builtInCategories.has(category.type + ':' + category.name),
  );
  const starterWallets = [
    ['كاش', 'cash'],
    ['محفظة', 'mobile'],
    ['فيزا', 'card'],
  ];
  const onlyEmptyStarterWallets =
    wallets.length === starterWallets.length &&
    wallets.every(
      (wallet) =>
        wallet.balance === 0 &&
        starterWallets.some(([name, kind]) => wallet.name === name && wallet.kind === kind),
    );
  const hasCustomWallets = wallets.length > 0 && !onlyEmptyStarterWallets;

  return Boolean(
    transactions.length ||
    budgets.length ||
    debts.length ||
    gam3eyat.length ||
    savings.length ||
    savingsGoals.length ||
    recurringTransactions.length ||
    hasCustomCategories ||
    hasCustomWallets,
  );
}
