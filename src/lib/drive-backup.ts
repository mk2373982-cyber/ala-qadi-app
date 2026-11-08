import { db } from '@/lib/db';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const BACKUP_FILE_NAME = 'ala-qaddi-auto-backup.json';
let accessToken = '';
let pendingTimer: ReturnType<typeof setTimeout> | undefined;
let uploadInFlight: Promise<void> | null = null;
let hooksInstalled = false;

export interface LocalBackup {
  appName: string;
  version: string;
  exportDate: string;
  data: Record<string, unknown[]>;
}

export const setDriveAccessToken = (token: string) => { accessToken = token; };
export const clearDriveAccessToken = () => { accessToken = ''; };

const getLocalBackup = async (): Promise<LocalBackup> => ({
  appName: 'على قدي',
  version: '1.0',
  exportDate: new Date().toISOString(),
  data: {
    transactions: await db.transactions.toArray(),
    categories: await db.categories.toArray(),
    budgets: await db.budgets.toArray(),
    debts: await db.debts.toArray(),
    gam3eyat: await db.gam3eyat.toArray(),
    savings: await db.savings.toArray(),
    wallets: await db.wallets.toArray(),
  },
});

const driveRequest = async (url: string, init: RequestInit = {}) => {
  if (!accessToken) throw new Error('اتصل بحساب Google Drive أولًا');
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...init.headers },
  });
  if (!response.ok) {
    if (response.status === 401) clearDriveAccessToken();
    throw new Error(response.status === 401 ? 'انتهت صلاحية اتصال Google؛ أعد ربط الحساب.' : 'تعذر الوصول إلى نسخة Google Drive.');
  }
  return response;
};

const findBackup = async () => {
  const query = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${BACKUP_FILE_NAME}' and trashed=false`,
    fields: 'files(id,name,modifiedTime)',
    pageSize: '1',
  });
  const response = await driveRequest(`${DRIVE_API}/files?${query}`);
  const result = await response.json() as { files?: Array<{ id: string; modifiedTime?: string }> };
  return result.files?.[0];
};

const multipartBody = (metadata: object, backup: LocalBackup) => {
  const boundary = `ala_qaddi_${crypto.randomUUID()}`;
  const body = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`,
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(backup)}`,
    `--${boundary}--`,
  ].join('\r\n');
  return { boundary, body };
};

export async function uploadBackupToDrive() {
  if (uploadInFlight) return uploadInFlight;
  uploadInFlight = (async () => {
    const existing = await findBackup();
    const backup = await getLocalBackup();
    const metadata = existing
      ? { name: BACKUP_FILE_NAME }
      : { name: BACKUP_FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' };
    const { boundary, body } = multipartBody(metadata, backup);
    const endpoint = existing
      ? `${DRIVE_API}/files/${encodeURIComponent(existing.id)}?uploadType=multipart`
      : `${DRIVE_API}/files?uploadType=multipart`;
    await driveRequest(endpoint, {
      method: existing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    localStorage.setItem('ala_qaddi_drive_backup_at', backup.exportDate);
    window.dispatchEvent(new Event('ala-qaddi-drive-backup-status'));
  })().finally(() => { uploadInFlight = null; });
  return uploadInFlight;
}

export function scheduleAutomaticDriveBackup() {
  if (typeof window === 'undefined' || localStorage.getItem('ala_qaddi_drive_auto') !== 'true' || !accessToken) return;
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    void uploadBackupToDrive().catch((error) => {
      console.warn('Automatic Google Drive backup failed:', error);
      window.dispatchEvent(new Event('ala-qaddi-drive-backup-status'));
    });
  }, 1800);
}

/** Watches local financial tables so every committed edit schedules a Drive backup. */
export function installDriveBackupHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  const tables = [db.transactions, db.categories, db.budgets, db.debts, db.gam3eyat, db.savings, db.wallets];
  for (const table of tables) {
    table.hook('creating', () => { scheduleAutomaticDriveBackup(); });
    table.hook('updating', () => { scheduleAutomaticDriveBackup(); });
    table.hook('deleting', () => { scheduleAutomaticDriveBackup(); });
  }
}

export async function restoreBackupFromDrive() {
  const file = await findBackup();
  if (!file) throw new Error('لا توجد نسخة سابقة في Google Drive لهذا التطبيق.');
  const response = await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media`);
  const backup = await response.json() as LocalBackup;
  if (backup.appName !== 'على قدي' || !backup.data) throw new Error('ملف النسخة الاحتياطية غير صالح.');

  const data = backup.data;
  await db.transaction('rw', [db.transactions, db.categories, db.budgets, db.debts, db.gam3eyat, db.savings, db.wallets], async () => {
    await Promise.all([db.transactions.clear(), db.categories.clear(), db.budgets.clear(), db.debts.clear(), db.gam3eyat.clear(), db.savings.clear(), db.wallets.clear()]);
    if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions as never[]);
    if (data.categories?.length) await db.categories.bulkAdd(data.categories as never[]);
    if (data.budgets?.length) await db.budgets.bulkAdd(data.budgets as never[]);
    if (data.debts?.length) await db.debts.bulkAdd(data.debts as never[]);
    if (data.gam3eyat?.length) await db.gam3eyat.bulkAdd(data.gam3eyat as never[]);
    if (data.savings?.length) await db.savings.bulkAdd(data.savings as never[]);
    if (data.wallets?.length) await db.wallets.bulkAdd(data.wallets as never[]);
  });
  window.dispatchEvent(new Event('ala-qaddi-drive-backup-status'));
  return backup.exportDate;
}

export async function getDriveBackupInfo() {
  const file = await findBackup();
  return file ? { modifiedTime: file.modifiedTime || null } : null;
}
