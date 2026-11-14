import { NextResponse } from 'next/server';
import {
  findUserById,
  getUserBackup,
  getUserIdFromSession,
  saveUserBackup,
} from '@/lib/server-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
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

type BackupPayload = {
  appName: 'على قدي';
  version: string;
  exportedAt: string;
  exportDate: string;
  data: Record<(typeof BACKUP_TABLES)[number], Record<string, unknown>[]>;
};

class BackupRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function readLimitedJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BACKUP_BYTES)) {
    throw new BackupRequestError('حجم النسخة أكبر من الحد المسموح (5 ميجابايت).', 413);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new BackupRequestError('بيانات النسخة غير موجودة.', 400);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BACKUP_BYTES) {
      await reader.cancel();
      throw new BackupRequestError('حجم النسخة أكبر من الحد المسموح (5 ميجابايت).', 413);
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) as unknown;
  } catch {
    throw new BackupRequestError('ملف النسخة غير صالح أو ليس بصيغة JSON.', 400);
  }
}

function validateBackup(value: unknown): BackupPayload {
  if (!isRecord(value) || value.appName !== 'على قدي' || !isRecord(value.data)) {
    throw new BackupRequestError('النسخة غير صالحة أو لا تخص تطبيق على قدي.', 400);
  }
  if (typeof value.version !== 'string' || !value.version.trim()) {
    throw new BackupRequestError('رقم إصدار النسخة غير صالح.', 400);
  }

  const exportedAt =
    typeof value.exportedAt === 'string'
      ? value.exportedAt
      : typeof value.exportDate === 'string'
        ? value.exportDate
        : '';
  if (!exportedAt || !Number.isFinite(Date.parse(exportedAt))) {
    throw new BackupRequestError('تاريخ النسخة غير صالح.', 400);
  }

  const data = {} as BackupPayload['data'];
  for (const table of BACKUP_TABLES) {
    const rows = value.data[table];
    if (!Array.isArray(rows) || rows.some((row) => !isRecord(row))) {
      throw new BackupRequestError('النسخة غير مكتملة أو تحتوي على بيانات غير صالحة.', 400);
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

function unauthenticatedResponse() {
  return NextResponse.json(
    { error: 'انتهت الجلسة، سجّل الدخول مرة أخرى.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: Request) {
  try {
    const userId = getUserIdFromSession(request);
    if (!userId) return unauthenticatedResponse();
    if (!(await findUserById(userId))) return unauthenticatedResponse();

    const backup = await getUserBackup(userId);
    return NextResponse.json(
      backup ? { backup: backup.backupData, updatedAt: backup.updatedAt } : null,
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'تعذر تحميل النسخة الاحتياطية. حاول مرة أخرى.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromSession(request);
    if (!userId) return unauthenticatedResponse();
    if (!(await findUserById(userId))) return unauthenticatedResponse();

    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return NextResponse.json(
        { error: 'صيغة الطلب غير مدعومة.' },
        { status: 415, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const payload = validateBackup(await readLimitedJson(request));
    const updatedAt = await saveUserBackup(userId, payload);
    return NextResponse.json({ updatedAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof BackupRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { error: 'تعذر حفظ النسخة الاحتياطية. حاول مرة أخرى.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
