import { db, type DriveBackupKey } from '@/lib/db';
import {
  createRecoveryKey,
  decodeDriveBackup,
  encryptBackup,
  importRecoveryKey,
  type LocalBackup,
} from '@/lib/drive-backup-crypto';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const CURRENT_BACKUP_FILE_NAME = 'ala-qaddi-backup.json';
const PREVIOUS_BACKUP_FILE_NAME = 'ala-qaddi-backup-previous.json';
const LEGACY_CURRENT_BACKUP_FILE_NAME = 'ala-qaddi-auto-backup.json';
const LEGACY_PREVIOUS_BACKUP_FILE_NAME = 'ala-qaddi-auto-backup-previous.json';
const LEGACY_AUTO_KEY = 'ala_qaddi_drive_auto';
const STATUS_EVENT = 'ala-qaddi-drive-backup-status';

export type BackupSlot = 'current' | 'previous';
type DriveFile = {
  id: string;
  name: string;
  modifiedTime?: string;
  appProperties?: Record<string, string>;
};
type BackupFileInfo = { modifiedTime: string | null; encrypted: boolean };
export type DriveBackupInfo = { current: BackupFileInfo | null; previous: BackupFileInfo | null };
export type DriveBackupCounts = Record<string, number>;
export type PreparedDriveRestore = {
  userId: string;
  backup: LocalBackup;
  encrypted: boolean;
  recoveryKey: CryptoKey | null;
  counts: DriveBackupCounts;
};
export type DriveBackupState = {
  connected: boolean;
  autoBackup: boolean;
  pending: boolean;
  lastBackup: string | null;
  lastError: string;
  recoveryKeyAvailable: boolean;
  recoveryKeyAcknowledged: boolean;
};

let accessToken = '';
let activeUserId: string | null = null;
let activeRecoveryKey: CryptoKey | null = null;
let recoveryKeyAcknowledged = false;
let pendingTimer: ReturnType<typeof setTimeout> | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let uploadInFlight: Promise<string | null> | null = null;
let uploadRequested = false;
const hookedDatabases = new WeakSet<object>();
let backupListenersInstalled = false;
let contextGeneration = 0;
let localRevision = 0;
let retryAttempt = 0;

const scopedKey = (kind: string, userId = activeUserId) =>
  `ala_qaddi_drive_${kind}_${userId || 'anonymous'}`;
const getStorage = (key: string) => {
  try {
    return typeof window === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
};
const setStorage = (key: string, value: string) => {
  try {
    if (typeof window !== 'undefined') localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable */
  }
};
const removeStorage = (key: string) => {
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(key);
  } catch {
    /* storage may be unavailable */
  }
};

function dispatchStatus() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STATUS_EVENT));
}

function isAutoBackupEnabled() {
  return Boolean(activeUserId && getStorage(scopedKey('auto')) === 'true');
}

function isPending() {
  return Boolean(activeUserId && getStorage(scopedKey('pending')) === 'true');
}

function setPending() {
  if (!activeUserId) return;
  setStorage(scopedKey('pending'), 'true');
  dispatchStatus();
}

function clearPending(exportDate: string) {
  if (!activeUserId) return;
  removeStorage(scopedKey('pending'));
  setStorage(scopedKey('last_backup'), exportDate);
  removeStorage(scopedKey('error'));
  retryAttempt = 0;
  dispatchStatus();
}

function setBackupError(error: unknown) {
  const message = error instanceof Error ? error.message : 'تعذر حفظ النسخة الاحتياطية.';
  if (activeUserId) setStorage(scopedKey('error'), message);
  dispatchStatus();
}

function migrateLegacyLocalSettings(userId: string) {
  const autoKey = scopedKey('auto', userId);
  if (getStorage(autoKey) === null && getStorage(LEGACY_AUTO_KEY) !== null) {
    setStorage(autoKey, getStorage(LEGACY_AUTO_KEY) || 'false');
    removeStorage(LEGACY_AUTO_KEY);
  }
  const legacyEmail = getStorage('ala_qaddi_drive_email');
  if (legacyEmail && getStorage(scopedKey('email', userId)) === null) {
    setStorage(scopedKey('email', userId), legacyEmail);
    removeStorage('ala_qaddi_drive_email');
  }
  const legacyLastBackup = getStorage('ala_qaddi_drive_backup_at');
  if (legacyLastBackup && getStorage(scopedKey('last_backup', userId)) === null) {
    setStorage(scopedKey('last_backup', userId), legacyLastBackup);
    removeStorage('ala_qaddi_drive_backup_at');
  }
}

export async function setDriveBackupUserId(userId: string | null) {
  if (activeUserId !== userId) clearDriveAccessToken();
  const generation = ++contextGeneration;
  activeUserId = userId;
  activeRecoveryKey = null;
  recoveryKeyAcknowledged = false;

  if (!userId) {
    dispatchStatus();
    return;
  }

  migrateLegacyLocalSettings(userId);
  try {
    const record = await db.driveBackupKeys.get(userId);
    if (generation !== contextGeneration) return;
    if (record) {
      activeRecoveryKey = record.key;
      recoveryKeyAcknowledged = record.recoveryAcknowledged;
    }
  } catch (error) {
    console.warn('Could not load the local Drive recovery key.', error);
  }
  dispatchStatus();
  if (isAutoBackupEnabled() && isPending()) schedulePendingUpload(0);
}

export function setDriveAccessToken(token: string) {
  accessToken = token;
  dispatchStatus();
}

export function clearDriveAccessToken() {
  accessToken = '';
  dispatchStatus();
}

export function getDriveBackupState(): DriveBackupState {
  return {
    connected: Boolean(accessToken),
    autoBackup: isAutoBackupEnabled(),
    pending: isPending(),
    lastBackup: activeUserId ? getStorage(scopedKey('last_backup')) : null,
    lastError: activeUserId ? getStorage(scopedKey('error')) || '' : '',
    recoveryKeyAvailable: Boolean(activeRecoveryKey),
    recoveryKeyAcknowledged,
  };
}

export async function createDriveRecoveryKey() {
  if (!activeUserId) throw new Error('سجّل الدخول إلى حساب على قدي أولًا.');
  const created = await createRecoveryKey();
  const record: DriveBackupKey = {
    userId: activeUserId,
    key: created.key,
    recoveryAcknowledged: false,
    createdAt: new Date().toISOString(),
  };
  await db.driveBackupKeys.put(record);
  activeRecoveryKey = created.key;
  recoveryKeyAcknowledged = false;
  dispatchStatus();
  return created.recoveryCode;
}

export async function acknowledgeDriveRecoveryKey() {
  if (!activeUserId || !activeRecoveryKey) throw new Error('أنشئ مفتاح الاسترداد أولًا.');
  const record = await db.driveBackupKeys.get(activeUserId);
  if (!record) throw new Error('تعذر حفظ مفتاح الاسترداد على هذا الجهاز.');
  record.recoveryAcknowledged = true;
  await db.driveBackupKeys.put(record);
  recoveryKeyAcknowledged = true;
  setStorage(scopedKey('auto'), 'true');
  setPending();
  dispatchStatus();
  schedulePendingUpload(0);
}

export async function enableDriveAutoBackup() {
  if (!activeUserId || !activeRecoveryKey || !recoveryKeyAcknowledged) {
    throw new Error('أنشئ مفتاح الاسترداد واحفظه أولًا لتفعيل النسخ المشفر.');
  }
  setStorage(scopedKey('auto'), 'true');
  setPending();
  schedulePendingUpload(0);
  dispatchStatus();
}

export function disableDriveAutoBackup() {
  if (activeUserId) setStorage(scopedKey('auto'), 'false');
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = undefined;
  dispatchStatus();
}

export function resumePendingDriveBackup() {
  if (isPending() && isAutoBackupEnabled()) schedulePendingUpload(0);
}

async function driveRequest(url: string, init: RequestInit = {}) {
  if (!accessToken) throw new Error('اربط Google Drive لمتابعة النسخ التلقائي.');
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, ...init.headers },
    });
  } catch {
    throw new Error('تعذر الاتصال بـGoogle Drive. ستظل النسخة معلّقة حتى رجوع الإنترنت.');
  }
  if (!response.ok) {
    if (response.status === 401) {
      clearDriveAccessToken();
      throw new Error('انتهت صلاحية اتصال Google. اضغط النسخ أو الاسترداد وأعد السماح بالاتصال.');
    }
    if (response.status === 403) {
      throw new Error('حساب Google لم يمنح إذن مساحة التطبيق الخاصة في Drive. أعد ربط الحساب.');
    }
    throw new Error('تعذر الوصول إلى Google Drive. تحقق من الإنترنت وحاول مرة أخرى.');
  }
  return response;
}

async function listDriveBackupFiles() {
  const query = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name,modifiedTime,appProperties)',
    pageSize: '100',
    q: 'trashed = false',
  });
  const response = await driveRequest(`${DRIVE_API}/files?${query}`);
  const result = (await response.json()) as { files?: DriveFile[] };
  const names = new Set([
    CURRENT_BACKUP_FILE_NAME,
    PREVIOUS_BACKUP_FILE_NAME,
    LEGACY_CURRENT_BACKUP_FILE_NAME,
    LEGACY_PREVIOUS_BACKUP_FILE_NAME,
  ]);
  return (result.files || []).filter((file) => names.has(file.name));
}

function fileForSlot(files: DriveFile[], slot: BackupSlot) {
  const names =
    slot === 'current'
      ? [CURRENT_BACKUP_FILE_NAME, LEGACY_CURRENT_BACKUP_FILE_NAME]
      : [PREVIOUS_BACKUP_FILE_NAME, LEGACY_PREVIOUS_BACKUP_FILE_NAME];
  return names.map((name) => files.find((file) => file.name === name)).find(Boolean);
}

function latestDriveBackupFile(files: DriveFile[]) {
  return [...files].sort((left, right) => {
    const leftTime = left.modifiedTime ? Date.parse(left.modifiedTime) : 0;
    const rightTime = right.modifiedTime ? Date.parse(right.modifiedTime) : 0;
    return rightTime - leftTime;
  })[0];
}

async function downloadDriveFile(fileId: string) {
  const response = await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`);
  return response.text();
}

const fileSlotName = (slot: BackupSlot) =>
  slot === 'current' ? CURRENT_BACKUP_FILE_NAME : PREVIOUS_BACKUP_FILE_NAME;

function multipartBody(metadata: object, content: string) {
  const boundary = `ala_qaddi_${crypto.randomUUID()}`;
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`,
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}`,
    `--${boundary}--`,
  ].join('\r\n');
  return { boundary, body };
}

async function writeDriveFile(
  existing: DriveFile | undefined,
  slot: BackupSlot,
  content: string,
  encrypted: boolean,
) {
  const name = fileSlotName(slot);
  const appProperties = { format: encrypted ? 'encrypted-v2' : 'legacy-json' };
  const metadata = existing
    ? { name, appProperties }
    : { name, parents: ['appDataFolder'], mimeType: 'application/json', appProperties };
  const { boundary, body } = multipartBody(metadata, content);
  const endpoint = existing
    ? `${DRIVE_API}/files/${encodeURIComponent(existing.id)}?uploadType=multipart`
    : `${DRIVE_API}/files?uploadType=multipart`;
  await driveRequest(endpoint, {
    method: existing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

async function makeLocalBackup(): Promise<LocalBackup> {
  const exportedAt = new Date().toISOString();
  // driveBackupKeys holds a device-local, non-exportable CryptoKey. The restore flow
  // derives it again only after the user supplies the recovery code, so it stays local.
  return {
    appName: 'على قدي',
    version: '3.0',
    exportedAt,
    exportDate: exportedAt,
    data: {
      transactions: await db.transactions.toArray(),
      categories: await db.categories.toArray(),
      budgets: await db.budgets.toArray(),
      debts: await db.debts.toArray(),
      gam3eyat: await db.gam3eyat.toArray(),
      savings: await db.savings.toArray(),
      wallets: await db.wallets.toArray(),
      savingsGoals: await db.savingsGoals.toArray(),
      recurringTransactions: await db.recurringTransactions.toArray(),
    },
  };
}

async function writeEncryptedSnapshot() {
  if (!activeUserId || !activeRecoveryKey || !recoveryKeyAcknowledged) {
    throw new Error('مفتاح الاسترداد غير جاهز؛ لم يتم رفع أي بيانات.');
  }
  const currentBackup = await makeLocalBackup();
  const encrypted = await encryptBackup(currentBackup, activeRecoveryKey);
  const serialized = JSON.stringify(encrypted);
  const files = await listDriveBackupFiles();
  const currentFile = fileForSlot(files, 'current');
  const previousFile = fileForSlot(files, 'previous');

  // Preserve the exact previous current payload before replacing it.
  if (currentFile) {
    const oldContent = await downloadDriveFile(currentFile.id);
    let oldEncrypted = false;
    try {
      oldEncrypted = JSON.parse(oldContent)?.format === 'ala-qaddi-drive-backup';
      if (oldEncrypted) await decodeDriveBackup(oldContent, activeRecoveryKey);
    } catch {
      throw new Error(
        'مفتاح الاسترداد الحالي لا يطابق نسخة Drive. استرجع النسخة بمفتاحها الصحيح قبل الرفع.',
      );
    }
    await writeDriveFile(previousFile, 'previous', oldContent, oldEncrypted);
  }
  await writeDriveFile(currentFile, 'current', serialized, true);
  return currentBackup.exportedAt;
}

async function performUploadLoop(): Promise<string | null> {
  let lastSuccessfulBackup: string | null = null;
  while (uploadRequested) {
    uploadRequested = false;
    if (!activeUserId || !accessToken || !activeRecoveryKey || !recoveryKeyAcknowledged) {
      return lastSuccessfulBackup;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) return lastSuccessfulBackup;

    const uploadedRevision = localRevision;
    const exportDate = await writeEncryptedSnapshot();
    lastSuccessfulBackup = exportDate;
    if (localRevision === uploadedRevision) {
      clearPending(exportDate);
    } else {
      setPending();
      uploadRequested = true;
    }
  }
  return lastSuccessfulBackup;
}

export function uploadBackupToDrive(): Promise<string | null> {
  if (!activeUserId) return Promise.reject(new Error('سجّل الدخول إلى حساب على قدي أولًا.'));
  if (!accessToken) return Promise.reject(new Error('اربط Google Drive لمتابعة النسخ.'));
  if (!activeRecoveryKey || !recoveryKeyAcknowledged)
    return Promise.reject(new Error('مفتاح الاسترداد غير جاهز.'));
  setPending();
  uploadRequested = true;
  if (uploadInFlight) return uploadInFlight;

  uploadInFlight = performUploadLoop()
    .catch((error) => {
      setPending();
      setBackupError(error);
      throw error;
    })
    .finally(() => {
      uploadInFlight = null;
      if (uploadRequested && isAutoBackupEnabled()) schedulePendingUpload(1800);
    });
  return uploadInFlight;
}

function schedulePendingUpload(delay: number) {
  if (!activeUserId || !isAutoBackupEnabled() || !isPending()) return;
  if (!accessToken || !activeRecoveryKey || !recoveryKeyAcknowledged) {
    dispatchStatus();
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    dispatchStatus();
    return;
  }
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(
    () => {
      pendingTimer = undefined;
      void uploadBackupToDrive().catch((error) => {
        retryAttempt += 1;
        const delays = [2_000, 5_000, 15_000, 30_000, 60_000];
        if (
          retryAttempt <= delays.length &&
          accessToken &&
          typeof navigator !== 'undefined' &&
          navigator.onLine
        ) {
          if (retryTimer) clearTimeout(retryTimer);
          retryTimer = setTimeout(() => schedulePendingUpload(0), delays[retryAttempt - 1]);
        }
        console.warn('Automatic Google Drive backup failed; pending marker was retained.', error);
      });
    },
    Math.max(0, delay),
  );
}

export function scheduleAutomaticDriveBackup() {
  if (typeof window === 'undefined' || !isAutoBackupEnabled()) return;
  localRevision += 1;
  setPending();
  schedulePendingUpload(1800);
}

function handleConnectivityReturn() {
  if (isPending() && isAutoBackupEnabled()) schedulePendingUpload(0);
}

export function installDriveBackupHooks() {
  if (typeof window === 'undefined') return;
  const activeDatabase = db;
  if (hookedDatabases.has(activeDatabase)) return;
  hookedDatabases.add(activeDatabase);

  const tables = [
    activeDatabase.transactions,
    activeDatabase.categories,
    activeDatabase.budgets,
    activeDatabase.debts,
    activeDatabase.gam3eyat,
    activeDatabase.savings,
    activeDatabase.wallets,
    activeDatabase.savingsGoals,
    activeDatabase.recurringTransactions,
  ];
  for (const table of tables) {
    table.hook('creating', () => {
      scheduleAutomaticDriveBackup();
    });
    table.hook('updating', () => {
      scheduleAutomaticDriveBackup();
    });
    table.hook('deleting', () => {
      scheduleAutomaticDriveBackup();
    });
  }
  if (!backupListenersInstalled) {
    backupListenersInstalled = true;
    window.addEventListener('online', handleConnectivityReturn);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleConnectivityReturn();
    });
  }
}

export async function getDriveBackupInfo(): Promise<DriveBackupInfo> {
  if (!accessToken) return { current: null, previous: null };
  const files = await listDriveBackupFiles();
  const info = (file: DriveFile | undefined): BackupFileInfo | null =>
    file
      ? {
          modifiedTime: file.modifiedTime || null,
          encrypted: file.appProperties?.format === 'encrypted-v2',
        }
      : null;
  return {
    current: info(fileForSlot(files, 'current')),
    previous: info(fileForSlot(files, 'previous')),
  };
}

export async function prepareDriveRestore(
  slot: BackupSlot | 'latest' = 'latest',
  recoveryCode?: string,
): Promise<PreparedDriveRestore> {
  if (!activeUserId) throw new Error('سجّل الدخول إلى حساب على قدي أولًا.');
  const files = await listDriveBackupFiles();
  const file = slot === 'latest' ? latestDriveBackupFile(files) : fileForSlot(files, slot);
  if (!file) throw new Error('لا توجد نسخة احتياطية محفوظة على هذا الحساب بعد');

  const rawContent = await downloadDriveFile(file.id);
  let candidateKey = activeRecoveryKey;
  if (recoveryCode) candidateKey = await importRecoveryKey(recoveryCode);
  const decoded = await decodeDriveBackup(rawContent, candidateKey || undefined);
  const counts = Object.fromEntries(
    Object.entries(decoded.backup.data).map(([table, rows]) => [table, rows.length]),
  );

  return {
    userId: activeUserId,
    backup: decoded.backup,
    encrypted: decoded.encrypted,
    recoveryKey: candidateKey,
    counts,
  };
}

export async function applyPreparedDriveRestore(prepared: PreparedDriveRestore) {
  if (!activeUserId) throw new Error('سجّل الدخول إلى حساب على قدي أولًا.');
  if (prepared.userId !== activeUserId) {
    throw new Error('تغير الحساب أثناء الاسترداد. أعد تحميل النسخة من الحساب الحالي.');
  }

  // The decrypted backup is fully validated before atomically replacing device data.
  const data = prepared.backup.data;
  await db.transaction(
    'rw',
    [
      db.transactions,
      db.categories,
      db.budgets,
      db.debts,
      db.gam3eyat,
      db.savings,
      db.wallets,
      db.savingsGoals,
      db.recurringTransactions,
      db.driveBackupKeys,
    ],
    async () => {
      await Promise.all([
        db.transactions.clear(),
        db.categories.clear(),
        db.budgets.clear(),
        db.debts.clear(),
        db.gam3eyat.clear(),
        db.savings.clear(),
        db.wallets.clear(),
        db.savingsGoals.clear(),
        db.recurringTransactions.clear(),
      ]);
      if (data.transactions.length) await db.transactions.bulkAdd(data.transactions as never[]);
      if (data.categories.length) await db.categories.bulkAdd(data.categories as never[]);
      if (data.budgets.length) await db.budgets.bulkAdd(data.budgets as never[]);
      if (data.debts.length) await db.debts.bulkAdd(data.debts as never[]);
      if (data.gam3eyat.length) await db.gam3eyat.bulkAdd(data.gam3eyat as never[]);
      if (data.savings.length) await db.savings.bulkAdd(data.savings as never[]);
      if (data.wallets.length) await db.wallets.bulkAdd(data.wallets as never[]);
      if (data.savingsGoals.length) await db.savingsGoals.bulkAdd(data.savingsGoals as never[]);
      if (data.recurringTransactions.length)
        await db.recurringTransactions.bulkAdd(data.recurringTransactions as never[]);

      if (prepared.encrypted && prepared.recoveryKey) {
        await db.driveBackupKeys.put({
          userId: activeUserId!,
          key: prepared.recoveryKey,
          recoveryAcknowledged: true,
          createdAt: new Date().toISOString(),
        });
      }
    },
  );

  if (prepared.encrypted && prepared.recoveryKey) {
    activeRecoveryKey = prepared.recoveryKey;
    recoveryKeyAcknowledged = true;
    setStorage(scopedKey('auto'), 'true');
  }
  const exportedAt = prepared.backup.exportedAt || prepared.backup.exportDate;
  setStorage(scopedKey('last_backup'), exportedAt);
  removeStorage(scopedKey('pending'));
  removeStorage(scopedKey('error'));
  dispatchStatus();
  return { exportDate: exportedAt, encrypted: prepared.encrypted, counts: prepared.counts };
}

export async function restoreBackupFromDrive(slot: BackupSlot, recoveryCode?: string) {
  const prepared = await prepareDriveRestore(slot, recoveryCode);
  return applyPreparedDriveRestore(prepared);
}
