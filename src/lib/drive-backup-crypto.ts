const APP_NAME = 'على قدي';
const ENVELOPE_FORMAT = 'ala-qaddi-drive-backup';
const ENVELOPE_VERSION = 2;
const AUTHENTICATED_CONTEXT = new TextEncoder().encode('ala-qaddi-drive-backup:v2');
const BACKUP_TABLES = [
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

export interface LocalBackup {
  appName: string;
  version: string;
  exportedAt: string;
  exportDate: string;
  data: Record<string, unknown[]>;
}

export interface EncryptedDriveBackup {
  appName: typeof APP_NAME;
  format: typeof ENVELOPE_FORMAT;
  formatVersion: typeof ENVELOPE_VERSION;
  version: string;
  exportedAt: string;
  exportDate: string;
  algorithm: 'AES-GCM-128';
  iv: string;
  ciphertext: string;
}

export class BackupRecoveryKeyRequiredError extends Error {
  constructor() {
    super('أدخل مفتاح الاسترداد الموجود لديك لفتح النسخة المشفرة.');
    this.name = 'BackupRecoveryKeyRequiredError';
  }
}

export class InvalidBackupRecoveryKeyError extends Error {
  constructor() {
    super('مفتاح الاسترداد غير صحيح أو النسخة تالفة؛ لم تتغير بيانات الجهاز.');
    this.name = 'InvalidBackupRecoveryKeyError';
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateLocalBackup(value: unknown): LocalBackup {
  if (!isRecord(value) || value.appName !== APP_NAME || !isRecord(value.data)) {
    throw new Error('النسخة الاحتياطية غير صالحة أو لا تخص تطبيق على قدي.');
  }

  const data: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    const entries = value.data[table];
    if (entries !== undefined && !Array.isArray(entries)) {
      throw new Error('محتوى النسخة غير مكتمل؛ لم تتغير بيانات الجهاز.');
    }
    data[table] = (entries as unknown[] | undefined) ?? [];
  }

  const exportedAt =
    typeof value.exportedAt === 'string'
      ? value.exportedAt
      : typeof value.exportDate === 'string'
        ? value.exportDate
        : new Date().toISOString();

  return {
    appName: APP_NAME,
    version: typeof value.version === 'string' ? value.version : 'legacy',
    exportedAt,
    exportDate: typeof value.exportDate === 'string' ? value.exportDate : exportedAt,
    data,
  };
}

export async function createRecoveryKey() {
  const raw = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  return { key, recoveryCode: bytesToBase64Url(raw) };
}

export async function importRecoveryKey(recoveryCode: string) {
  const raw = base64UrlToBytes(recoveryCode);
  if (raw.length !== 16) throw new InvalidBackupRecoveryKeyError();
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptBackup(
  backup: LocalBackup,
  key: CryptoKey,
): Promise<EncryptedDriveBackup> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(backup));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: AUTHENTICATED_CONTEXT, tagLength: 128 },
    key,
    plaintext,
  );

  return {
    appName: APP_NAME,
    format: ENVELOPE_FORMAT,
    formatVersion: ENVELOPE_VERSION,
    version: backup.version,
    exportedAt: backup.exportedAt,
    exportDate: backup.exportDate,
    algorithm: 'AES-GCM-128',
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function decodeDriveBackup(
  raw: unknown,
  key?: CryptoKey,
): Promise<{ backup: LocalBackup; encrypted: boolean }> {
  let envelope = raw;
  if (typeof raw === 'string') {
    if (raw.length > 25_000_000) throw new Error('حجم النسخة أكبر من الحد المسموح.');
    try {
      envelope = JSON.parse(raw) as unknown;
    } catch {
      throw new Error('ملف النسخة الاحتياطية تالف.');
    }
  }

  if (isRecord(envelope) && envelope.format === ENVELOPE_FORMAT) {
    if (!key) throw new BackupRecoveryKeyRequiredError();
    if (
      envelope.appName !== APP_NAME ||
      envelope.formatVersion !== ENVELOPE_VERSION ||
      envelope.algorithm !== 'AES-GCM-128' ||
      typeof envelope.iv !== 'string' ||
      typeof envelope.ciphertext !== 'string'
    ) {
      throw new Error('صيغة النسخة المشفرة غير مدعومة.');
    }
    try {
      const plaintext = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: base64UrlToBytes(envelope.iv),
          additionalData: AUTHENTICATED_CONTEXT,
          tagLength: 128,
        },
        key,
        base64UrlToBytes(envelope.ciphertext),
      );
      const decoded = JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
      return { backup: validateLocalBackup(decoded), encrypted: true };
    } catch {
      throw new InvalidBackupRecoveryKeyError();
    }
  }

  return { backup: validateLocalBackup(envelope), encrypted: false };
}
