'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BACKUP_TABLE_LABELS,
  BACKUP_TABLES,
  countBackupRecords,
  createLocalBackup,
  fetchCloudBackup,
  hasMeaningfulLocalData,
  restoreCloudBackup,
  saveCloudBackup,
  type CloudBackup,
} from '@/lib/supabase-backup';
import { CloudDownload, CloudUpload, DatabaseBackup, RefreshCw } from 'lucide-react';

type BackupProps = {
  userId: string;
  isOnline: boolean;
  onDataRestored?: () => void;
};

function formatBackupDate(value: string) {
  return new Date(value).toLocaleString('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function RestoreConfirmation({
  backup,
  busy,
  onCancel,
  onConfirm,
}: {
  backup: CloudBackup;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const counts = countBackupRecords(backup.backup);
  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="supabase-restore-title"
        aria-describedby="supabase-restore-description"
        className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <div>
          <h2 id="supabase-restore-title" className="text-lg font-black text-slate-900">
            تأكيد استرداد النسخة
          </h2>
          <p id="supabase-restore-description" className="mt-1 text-xs leading-5 text-slate-600">
            استرداد النسخة هيستبدل البيانات الموجودة على الجهاز. راجع التاريخ وعدد السجلات قبل
            التأكيد.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm">
          <span className="font-bold text-emerald-950">تاريخ النسخة: </span>
          <span className="tabular-nums text-emerald-900">
            {formatBackupDate(backup.backup.exportedAt)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BACKUP_TABLES.map((table) => (
            <div
              key={table}
              className="flex min-h-14 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <span className="text-[11px] font-semibold text-slate-600">
                {BACKUP_TABLE_LABELS[table]}
              </span>
              <span className="text-sm font-black tabular-nums text-slate-900">
                {counts[table].toLocaleString('ar-EG')}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="min-h-11 flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {busy ? 'جاري الاسترداد...' : 'تأكيد واسترداد'}
          </button>
        </div>
      </section>
    </div>
  );
}

export function SupabaseBackupPanel({ userId, isOnline, onDataRestored }: BackupProps) {
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [preparedRestore, setPreparedRestore] = useState<CloudBackup | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isOnline) return;

    void fetchCloudBackup()
      .then((backup) => {
        if (!cancelled && backup) setLastSaved(backup.updatedAt);
      })
      .catch(() => {
        // A not-yet-signed-in trial account has no server session for cloud backup.
      });

    return () => {
      cancelled = true;
    };
  }, [isOnline, userId]);

  const handleSave = async () => {
    if (!isOnline) {
      setStatusMessage('احفظ نسخة على حسابك عند الاتصال بالإنترنت، أو نزّل ملفًا احتياطيًا الآن.');
      return;
    }
    setBusy(true);
    setStatusMessage('');
    try {
      const backup = await createLocalBackup();
      const updatedAt = await saveCloudBackup(backup);
      setLastSaved(updatedAt);
      setStatusMessage('تم حفظ النسخة على حسابك بنجاح.');
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'تعذر حفظ النسخة الاحتياطية. حاول مرة أخرى.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePrepareRestore = async () => {
    if (!isOnline) {
      setStatusMessage('استرداد النسخة من حسابك يحتاج اتصالًا بالإنترنت.');
      return;
    }
    setBusy(true);
    setStatusMessage('');
    try {
      const backup = await fetchCloudBackup();
      if (!backup) {
        setStatusMessage('لا توجد نسخة احتياطية محفوظة على هذا الحساب بعد');
        return;
      }
      setLastSaved(backup.updatedAt);
      setPreparedRestore(backup);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'تعذر تحميل النسخة الاحتياطية. حاول مرة أخرى.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleApplyRestore = async () => {
    if (!preparedRestore) return;
    setBusy(true);
    try {
      await restoreCloudBackup(preparedRestore.backup);
      setPreparedRestore(null);
      setStatusMessage('تم استرداد بياناتك بنجاح');
      onDataRestored?.();
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'تعذر استرداد النسخة. لم يتم استبدال بياناتك.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="space-y-4 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <DatabaseBackup aria-hidden="true" className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">نسخة احتياطية على حسابك</h3>
            <p className="text-[11px] text-slate-500">
              احتفظ ببياناتك واسترجعها على أي جهاز بعد تسجيل الدخول
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50"
          >
            {busy ? (
              <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload aria-hidden="true" className="h-4 w-4" />
            )}
            حفظ نسخة احتياطية على حسابي
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePrepareRestore()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-50"
          >
            <CloudDownload aria-hidden="true" className="h-4 w-4" />
            استرداد النسخة من حسابي
          </button>
        </div>

        <p className="text-[11px] text-slate-500" aria-live="polite">
          {lastSaved
            ? 'آخر نسخة: ' + formatBackupDate(lastSaved)
            : 'النسخة السحابية متاحة بعد تسجيل الدخول مع الاتصال بالإنترنت.'}
        </p>
        {statusMessage && (
          <p
            role="status"
            className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700"
          >
            {statusMessage}
          </p>
        )}
      </section>

      {preparedRestore && (
        <RestoreConfirmation
          backup={preparedRestore}
          busy={busy}
          onCancel={() => setPreparedRestore(null)}
          onConfirm={() => void handleApplyRestore()}
        />
      )}
    </>
  );
}

export function CloudRestorePrompt({ userId, isOnline, onDataRestored }: BackupProps) {
  const [backup, setBackup] = useState<CloudBackup | null>(null);
  const [preparedRestore, setPreparedRestore] = useState<CloudBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const findBackup = async () => {
      if (!isOnline || (await hasMeaningfulLocalData())) return;
      const dismissedKey = 'ala_qaddi_cloud_restore_dismissed_' + userId;
      try {
        if (sessionStorage.getItem(dismissedKey) === '1') return;
      } catch {}

      try {
        const result = await fetchCloudBackup();
        if (!cancelled && result) setBackup(result);
      } catch {
        // A local-only trial account may not have a signed server session.
      }
    };

    void findBackup().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOnline, userId]);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem('ala_qaddi_cloud_restore_dismissed_' + userId, '1');
    } catch {}
    setHidden(true);
  }, [userId]);

  const handleApplyRestore = async () => {
    if (!preparedRestore) return;
    setBusy(true);
    try {
      await restoreCloudBackup(preparedRestore.backup);
      setPreparedRestore(null);
      setBackup(null);
      dismiss();
      onDataRestored?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'تعذر استرداد النسخة. لم يتم استبدال بياناتك.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!backup || hidden) return null;
  return (
    <>
      <aside className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-5xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950">
        <div className="min-w-0">
          <p className="text-sm font-black">لقينا نسخة بيانات محفوظة على حسابك</p>
          <p className="mt-0.5 text-xs text-sky-800">
            آخر نسخة: {formatBackupDate(backup.updatedAt)}
          </p>
          {message && (
            <p role="status" className="mt-1 text-xs text-rose-700">
              {message}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPreparedRestore(backup)}
            className="min-h-10 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            استرداد بياناتك السابقة
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="إخفاء اقتراح استرداد النسخة"
            className="min-h-10 rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100"
          >
            لاحقًا
          </button>
        </div>
      </aside>
      {preparedRestore && (
        <RestoreConfirmation
          backup={preparedRestore}
          busy={busy}
          onCancel={() => setPreparedRestore(null)}
          onConfirm={() => void handleApplyRestore()}
        />
      )}
    </>
  );
}
