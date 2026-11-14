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
  remainingAutoBackups: number;
};

export type CloudBackupStatus = {
  backup: BackupPayload | null;
  updatedAt: string | null;
  remainingAutoBackups: number;
};

export type SaveCloudBackupResult = {
  updatedAt: string | null;
  remainingAutoBackups: number;
  skipped: boolean;
};

const LAST_CLOUD_BACKUP_KEY = 'ala_qaddi_cloud_backup_last_';
const REMAINING_AUTO_BACKUPS_KEY = 'ala_qaddi_cloud_backup_remaining_';
const AUTO_BACKUP_LOCK_KEY = 'ala_qaddi_cloud_backup_auto_lock_';
const AUTO_BACKUP_ENABLED_KEY = 'ala_qaddi_cloud_backup_auto_enabled_';
const AUTO_BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const AUTO_BACKUP_LOCK_MS = 5 * 60 * 1000;
export const CLOUD_BACKUP_STATUS_EVENT = 'ala-qaddi-cloud-backup-status';
export const CLOUD_AUTO_BACKUP_PREFERENCE_EVENT = 'ala-qaddi-cloud-backup-preference';
const automaticBackupRuns = new Map<string, Promise<boolean>>();

function userStorageKey(prefix: string, userId: string) {
  return `${prefix}${encodeURIComponent(userId)}`;
}

export function getCloudAutoBackupEnabled(userId: string) {
  try {
    return window.localStorage.getItem(userStorageKey(AUTO_BACKUP_ENABLED_KEY, userId)) === '1';
  } catch {
    return false;
  }
}

export function setCloudAutoBackupEnabled(userId: string, enabled: boolean) {
  try {
    window.localStorage.setItem(
      userStorageKey(AUTO_BACKUP_ENABLED_KEY, userId),
      enabled ? '1' : '0',
    );
    window.dispatchEvent(
      new CustomEvent(CLOUD_AUTO_BACKUP_PREFERENCE_EVENT, {
        detail: { userId, enabled },
      }),
    );
    return true;
  } catch {
    return false;
  }
}

function readLocalBackupDate(userId: string) {
  try {
    const value = window.localStorage.getItem(userStorageKey(LAST_CLOUD_BACKUP_KEY, userId));
    const timestamp = value ? Date.parse(value) : Number.NaN;
    return Number.isFinite(timestamp) && timestamp <= Date.now() + 5 * 60 * 1000
      ? timestamp
      : null;
  } catch {
    return null;
  }
}

function storeLocalBackupDate(userId: string, updatedAt: string) {
  try {
    window.localStorage.setItem(userStorageKey(LAST_CLOUD_BACKUP_KEY, userId), updatedAt);
  } catch {
    // The cloud backup should still succeed when local browser storage is unavailable.
  }
}

function storeRemainingAutoBackups(userId: string, remaining: number) {
  try {
    window.localStorage.setItem(
      userStorageKey(REMAINING_AUTO_BACKUPS_KEY, userId),
      String(Math.max(0, Math.min(4, Math.trunc(remaining)))),
    );
  } catch {
    // The Settings readout can be refreshed from the server next time it is online.
  }
}

function announceCloudBackupStatus(
  userId: string,
  updatedAt: string | null,
  remainingAutoBackups: number,
) {
  try {
    window.dispatchEvent(
      new CustomEvent(CLOUD_BACKUP_STATUS_EVENT, {
        detail: { userId, updatedAt, remainingAutoBackups },
      }),
    );
  } catch {
    // Backup persistence does not depend on the optional in-page status event.
  }
}

export function getCachedRemainingAutoBackups(userId: string) {
  try {
    const cached = window.localStorage.getItem(
      userStorageKey(REMAINING_AUTO_BACKUPS_KEY, userId),
    );
    if (cached === null || !/^\d+$/.test(cached)) return null;
    const remaining = Number(cached);
    return Number.isInteger(remaining) && remaining <= 4 ? remaining : null;
  } catch {
    return null;
  }
}

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

export async function fetchCloudBackup(userId?: string): Promise<CloudBackupStatus> {
  await migrateExistingSessionCookie();
  const response = await fetch('/api/backup', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const result = (await response.json().catch(() => null)) as {
    backup?: unknown;
    updatedAt?: unknown;
    remainingAutoBackups?: unknown;
    error?: string;
  } | null;
  if (!response.ok) {
    throw new Error(result?.error || 'تعذر تحميل النسخة الاحتياطية.');
  }
  if (result === null) {
    return { backup: null, updatedAt: null, remainingAutoBackups: 4 };
  }

  const updatedAt =
    typeof result.updatedAt === 'string' && Number.isFinite(Date.parse(result.updatedAt))
      ? result.updatedAt
      : null;
  const remainingAutoBackups =
    typeof result.remainingAutoBackups === 'number' &&
    Number.isInteger(result.remainingAutoBackups) &&
    result.remainingAutoBackups >= 0 &&
    result.remainingAutoBackups <= 4
      ? result.remainingAutoBackups
      : 4;
  if (result.backup !== null && result.backup !== undefined && !updatedAt) {
    throw new Error('بيانات النسخة الاحتياطية غير مكتملة.');
  }
  if (result.backup == null && result.updatedAt != null) {
    throw new Error('بيانات النسخة الاحتياطية غير مكتملة.');
  }

  const status = {
    backup: result.backup == null ? null : validateCloudBackup(result.backup),
    updatedAt,
    remainingAutoBackups,
  };
  if (userId) {
    storeRemainingAutoBackups(userId, remainingAutoBackups);
    if (updatedAt) storeLocalBackupDate(userId, updatedAt);
  }
  return status;
}

export async function saveCloudBackup(
  backup: BackupPayload,
  userId: string,
  mode: 'manual' | 'auto' = 'manual',
): Promise<SaveCloudBackupResult> {
  await migrateExistingSessionCookie();
  const response = await fetch('/api/backup', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...backup, mode }),
  });
  const result = (await response.json().catch(() => null)) as {
    updatedAt?: unknown;
    remainingAutoBackups?: unknown;
    skipped?: unknown;
    error?: string;
  } | null;
  if (response.status === 429 && result?.skipped === true) {
    storeRemainingAutoBackups(userId, 0);
    announceCloudBackupStatus(userId, null, 0);
    return { updatedAt: null, remainingAutoBackups: 0, skipped: true };
  }
  if (!response.ok) throw new Error(result?.error || 'تعذر حفظ النسخة الاحتياطية.');
  if (
    !result ||
    typeof result.updatedAt !== 'string' ||
    !Number.isFinite(Date.parse(result.updatedAt))
  ) {
    throw new Error('لم يصل تأكيد حفظ النسخة الاحتياطية.');
  }
  const remainingAutoBackups =
    typeof result.remainingAutoBackups === 'number' &&
    Number.isInteger(result.remainingAutoBackups) &&
    result.remainingAutoBackups >= 0 &&
    result.remainingAutoBackups <= 4
      ? result.remainingAutoBackups
      : 4;
  storeLocalBackupDate(userId, result.updatedAt);
  storeRemainingAutoBackups(userId, remainingAutoBackups);
  announceCloudBackupStatus(userId, result.updatedAt, remainingAutoBackups);
  return { updatedAt: result.updatedAt, remainingAutoBackups, skipped: false };
}

async function performWeeklyCloudBackup(userId: string): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    !navigator.onLine ||
    !getCloudAutoBackupEnabled(userId)
  ) {
    return false;
  }

  const now = Date.now();
  const lockKey = userStorageKey(AUTO_BACKUP_LOCK_KEY, userId);
  const lockValue = String(now);
  let lockStored = false;
  try {
    const currentLock = Number(window.localStorage.getItem(lockKey));
    if (Number.isFinite(currentLock) && Math.abs(now - currentLock) < AUTO_BACKUP_LOCK_MS) {
      return false;
    }
    window.localStorage.setItem(lockKey, lockValue);
    lockStored = true;
  } catch {
    // The in-memory promise below still prevents duplicate requests in this tab.
  }

  try {
    if (!(await hasMeaningfulLocalData()) || !navigator.onLine) return false;

    const status = await fetchCloudBackup(userId);
    if (!navigator.onLine || status.remainingAutoBackups <= 0) return false;

    const localLastBackupAt = readLocalBackupDate(userId);
    const remoteLastBackupAt = status.updatedAt ? Date.parse(status.updatedAt) : null;
    const lastBackupAt =
      remoteLastBackupAt !== null && Number.isFinite(remoteLastBackupAt)
        ? Math.max(localLastBackupAt ?? 0, remoteLastBackupAt)
        : localLastBackupAt;

    if (lastBackupAt !== null && now - lastBackupAt < AUTO_BACKUP_INTERVAL_MS) return false;

    const backup = await createLocalBackup();
    if (!navigator.onLine || !getCloudAutoBackupEnabled(userId)) return false;
    const result = await saveCloudBackup(backup, userId, 'auto');
    return !result.skipped;
  } catch {
    // Auto-backup stays silent on network, session, or storage errors.
    return false;
  } finally {
    if (lockStored) {
      try {
        if (window.localStorage.getItem(lockKey) === lockValue) {
          window.localStorage.removeItem(lockKey);
        }
      } catch {
        // A leftover lock expires automatically after five minutes.
      }
    }
  }
}

export function runWeeklyCloudBackup(userId: string): Promise<boolean> {
  const existing = automaticBackupRuns.get(userId);
  if (existing) return existing;

  const run: Promise<boolean> =
    typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function'
      ? new Promise<boolean>((resolve) => {
          void navigator.locks
            .request<void>(
              `ala-qaddi-weekly-cloud-backup:${userId}`,
              { mode: 'exclusive', ifAvailable: true },
              async (lock) => {
                if (!lock) {
                  resolve(false);
                  return;
                }
                try {
                  resolve(await performWeeklyCloudBackup(userId));
                } catch {
                  resolve(false);
                }
              },
            )
            .catch(() => resolve(false));
        })
      : performWeeklyCloudBackup(userId);
  automaticBackupRuns.set(userId, run);
  void run.finally(() => {
    if (automaticBackupRuns.get(userId) === run) automaticBackupRuns.delete(userId);
  });
  return run;
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
