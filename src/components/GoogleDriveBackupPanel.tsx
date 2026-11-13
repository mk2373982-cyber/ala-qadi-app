'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, CloudUpload, Copy, Download, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  BackupRecoveryKeyRequiredError,
  InvalidBackupRecoveryKeyError,
} from '@/lib/drive-backup-crypto';
import {
  applyPreparedDriveRestore,
  acknowledgeDriveRecoveryKey,
  createDriveRecoveryKey,
  disableDriveAutoBackup,
  enableDriveAutoBackup,
  getDriveBackupInfo,
  getDriveBackupState,
  prepareDriveRestore,
  resumePendingDriveBackup,
  setDriveAccessToken,
  uploadBackupToDrive,
  type DriveBackupInfo,
  type DriveBackupState,
  type PreparedDriveRestore,
} from '@/lib/drive-backup';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (options: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (options?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
let googleIdentityLoad: Promise<void> | null = null;

function loadGoogleIdentity() {
  if (typeof window === 'undefined') return Promise.reject(new Error('المتصفح غير متاح.'));
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (googleIdentityLoad) return googleIdentityLoad;

  googleIdentityLoad = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => {
          existing.remove();
          reject(new Error('تعذر تحميل خدمة Google.'));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('تعذر تحميل خدمة Google.'));
    };
    document.head.appendChild(script);
  }).finally(() => {
    googleIdentityLoad = null;
  });

  return googleIdentityLoad;
}

function friendlyOAuthError(code: string) {
  if (code === 'popup_closed_by_user') {
    return 'تم إغلاق نافذة Google قبل اكتمال الإذن. اضغط وحاول مرة أخرى.';
  }
  if (code === 'access_denied') return 'لم يتم منح Google إذن الوصول إلى مساحة النسخ الخاصة.';
  if (code === 'popup_failed_to_open') {
    return 'المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة وحاول مرة أخرى.';
  }
  return 'تعذر إكمال ربط Google. حاول مرة أخرى.';
}

const LATEST_SLOT_LABELS: Record<string, string> = {
  transactions: 'الحركات',
  categories: 'التصنيفات',
  budgets: 'الميزانيات',
  debts: 'الديون والسلف',
  gam3eyat: 'الجمعيات',
  savings: 'الذهب والأصول',
  wallets: 'أماكن الفلوس',
  savingsGoals: 'أهداف الادخار',
  recurringTransactions: 'الالتزامات المتكررة',
};

function latestBackupTimestamp(info: DriveBackupInfo) {
  return (
    [info.current?.modifiedTime, info.previous?.modifiedTime]
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || null
  );
}

function latestBackupSlot(info: DriveBackupInfo): 'current' | 'previous' | null {
  if (!info.current) return info.previous ? 'previous' : null;
  if (!info.previous) return 'current';
  const currentTime = info.current.modifiedTime ? Date.parse(info.current.modifiedTime) : 0;
  const previousTime = info.previous.modifiedTime ? Date.parse(info.previous.modifiedTime) : 0;
  return previousTime > currentTime ? 'previous' : 'current';
}

const INITIAL_STATE: DriveBackupState = {
  connected: false,
  autoBackup: false,
  pending: false,
  lastBackup: null,
  lastError: '',
  recoveryKeyAvailable: false,
  recoveryKeyAcknowledged: false,
};

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('ar-EG') : 'لا توجد نسخة بعد';

export const GoogleDriveBackupPanel: React.FC<{ onDataRestored?: () => void }> = ({
  onDataRestored,
}) => {
  const { user } = useAuth();
  const [state, setState] = useState(INITIAL_STATE);
  const [backupInfo, setBackupInfo] = useState<DriveBackupInfo>({ current: null, previous: null });
  const [googleEmail, setGoogleEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [restoreSlot, setRestoreSlot] = useState<'current' | 'previous' | 'latest' | null>(null);
  const [preparedRestore, setPreparedRestore] = useState<PreparedDriveRestore | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshLocalState = useCallback(() => {
    const nextState = getDriveBackupState();
    setState(nextState);
    setGoogleEmail(user?.id ? localStorage.getItem(`ala_qaddi_drive_email_${user.id}`) || '' : '');
    if (!nextState.connected) {
      setBackupInfo({ current: null, previous: null });
    }
  }, [user?.id]);

  const refreshRemoteInfo = useCallback(async () => {
    if (!getDriveBackupState().connected) return;
    try {
      const info = await getDriveBackupInfo();
      setBackupInfo(info);
      const latest = latestBackupTimestamp(info) || getDriveBackupState().lastBackup;
      setState((current) => ({ ...current, lastBackup: latest }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر قراءة حالة النسخ الاحتياطي.');
    }
  }, []);

  useEffect(() => {
    if (CLIENT_ID) void loadGoogleIdentity().catch(() => {});
  }, []);

  useEffect(() => {
    refreshLocalState();
    const update = () => refreshLocalState();
    window.addEventListener('ala-qaddi-drive-backup-status', update);
    window.addEventListener('online', update);
    return () => {
      window.removeEventListener('ala-qaddi-drive-backup-status', update);
      window.removeEventListener('online', update);
    };
  }, [refreshLocalState]);

  const startRecoverySetup = async () => {
    try {
      const code = await createDriveRecoveryKey();
      setRecoveryCode(code);
      setCopied(false);
      setShowRecoveryCode(true);
      setMessage('احفظ مفتاح الاسترداد قبل تشغيل أول نسخة مشفرة.');
      refreshLocalState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر إنشاء مفتاح الاسترداد.');
    }
  };

  const authorizeDrive = async () => {
    if (getDriveBackupState().connected) {
      const info = await getDriveBackupInfo();
      setBackupInfo(info);
      const latest = latestBackupTimestamp(info);
      if (latest) setState((current) => ({ ...current, lastBackup: latest }));
      return info;
    }
    if (!CLIENT_ID) {
      throw new Error('يلزم إعداد NEXT_PUBLIC_GOOGLE_CLIENT_ID لربط Google Drive.');
    }
    await loadGoogleIdentity();
    if (!window.google?.accounts.oauth2) throw new Error('خدمة Google غير متاحة الآن.');

    const token = await new Promise<string>((resolve, reject) => {
      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope:
          'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email',
        callback: (response) => {
          if (response.access_token) resolve(response.access_token);
          else reject(new Error(friendlyOAuthError(response.error || '')));
        },
      });
      tokenClient.requestAccessToken({});
    });

    setDriveAccessToken(token);
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
    if (typeof userInfo?.email === 'string' && user?.id) {
      setGoogleEmail(userInfo.email);
      try {
        localStorage.setItem(`ala_qaddi_drive_email_${user.id}`, userInfo.email);
      } catch {
        // The email is only a display convenience; the Drive token remains in memory.
      }
    }

    const info = await getDriveBackupInfo();
    setBackupInfo(info);
    const latest = latestBackupTimestamp(info);
    if (latest) setState((current) => ({ ...current, lastBackup: latest }));
    refreshLocalState();
    return info;
  };

  const connectDrive = async () => {
    setBusy(true);
    setMessage('');
    try {
      const info = await authorizeDrive();
      const localState = getDriveBackupState();
      const hasRemoteBackup = Boolean(info.current || info.previous);

      if (!hasRemoteBackup && !localState.recoveryKeyAcknowledged) {
        await startRecoverySetup();
      } else if (hasRemoteBackup && !localState.recoveryKeyAcknowledged) {
        if (info.current?.encrypted || info.previous?.encrypted) {
          setMessage('وجدنا نسخة مشفرة. اختر الاسترداد وأدخل مفتاح الاسترداد المحفوظ لديك.');
        } else {
          setMessage('وجدنا نسخة قديمة غير مشفرة. استرجعها أولًا لإعداد النسخ المشفر.');
        }
      } else if (localState.autoBackup && localState.recoveryKeyAcknowledged) {
        resumePendingDriveBackup();
        setMessage('تم ربط Google Drive. سيُستكمل أي رفع معلّق.');
      } else {
        setMessage('تم ربط Google Drive. تقدر تنسخ أو تسترد بياناتك من هنا.');
      }
      refreshLocalState();
      await refreshRemoteInfo();
      refreshLocalState();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر ربط حساب Google.');
      refreshLocalState();
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async (enabled: boolean) => {
    setMessage('');
    if (!enabled) {
      disableDriveAutoBackup();
      setMessage('تم إيقاف النسخ التلقائي. النسختان الحاليتان على Drive لم تُحذفا.');
      refreshLocalState();
      return;
    }
    if (!state.connected) {
      setMessage('اربط Google Drive أولًا.');
      return;
    }
    if (!state.recoveryKeyAcknowledged) {
      if (backupInfo.current || backupInfo.previous) {
        setMessage('استرجع النسخة الموجودة أولًا، أو احفظ مفتاح الاسترداد قبل تفعيل النسخ.');
      } else {
        await startRecoverySetup();
      }
      return;
    }
    try {
      await enableDriveAutoBackup();
      setMessage('النسخ التلقائي مفعل. سيُرفع أي تعديل معلق الآن أو عند رجوع الاتصال.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تشغيل النسخ التلقائي.');
    }
    refreshLocalState();
  };

  const handleBackupNow = async () => {
    setBusy(true);
    setMessage('');
    try {
      const info = await authorizeDrive();
      const localState = getDriveBackupState();
      if (!localState.recoveryKeyAcknowledged) {
        if (info.current || info.previous) {
          setMessage(
            'توجد نسخة على هذا الحساب. استردها بمفتاحها أولًا قبل إنشاء مفتاح جديد أو استبدال النسخة.',
          );
        } else {
          await startRecoverySetup();
        }
        return;
      }

      const exportedAt = await uploadBackupToDrive();
      if (!exportedAt) {
        setMessage(
          'النسخة لسه ما اترفعتش. هتفضل معلقة لحد ما الإنترنت واتصال Google يبقوا متاحين.',
        );
        return;
      }
      setState((current) => ({ ...current, lastBackup: exportedAt }));
      setMessage(`آخر نسخة احتياطية: ${formatDate(exportedAt)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ النسخة.');
    } finally {
      setBusy(false);
      refreshLocalState();
      await refreshRemoteInfo();
      refreshLocalState();
    }
  };

  const handlePrepareRestore = async (slot: 'current' | 'previous' | 'latest') => {
    setBusy(true);
    setMessage('');
    try {
      const info = await authorizeDrive();
      const selectedSlot = slot === 'latest' ? latestBackupSlot(info) : slot;
      if (!selectedSlot || !info[selectedSlot]) {
        setMessage('لا توجد نسخة احتياطية محفوظة على هذا الحساب بعد');
        return;
      }

      const targetInfo = info[selectedSlot];
      const localState = getDriveBackupState();
      if (targetInfo.encrypted && !localState.recoveryKeyAvailable && !recoveryInput.trim()) {
        setRestoreSlot(selectedSlot);
        setMessage('اكتب مفتاح الاسترداد المحفوظ عند إعداد النسخة المشفرة على الجهاز القديم.');
        return;
      }

      const prepared = await prepareDriveRestore(slot, recoveryInput.trim() || undefined);
      setPreparedRestore(prepared);
      setRestoreSlot(null);
    } catch (error) {
      if (
        error instanceof BackupRecoveryKeyRequiredError ||
        error instanceof InvalidBackupRecoveryKeyError
      ) {
        setRestoreSlot(slot);
        setMessage('اكتب مفتاح الاسترداد المحفوظ على الجهاز القديم لفتح النسخة المشفرة.');
      } else {
        setMessage(
          error instanceof Error ? error.message : 'تعذر تحميل النسخة. لم تتغير بيانات الجهاز.',
        );
      }
    } finally {
      setBusy(false);
      refreshLocalState();
    }
  };

  const handleApplyRestore = async () => {
    if (!preparedRestore) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await applyPreparedDriveRestore(preparedRestore);
      setPreparedRestore(null);
      setRecoveryInput('');
      setRestoreSlot(null);
      setMessage('تم استرداد بياناتك بنجاح');
      onDataRestored?.();

      if (!result.encrypted) {
        const code = await createDriveRecoveryKey();
        setRecoveryCode(code);
        setCopied(false);
        setShowRecoveryCode(true);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'تعذر استرداد النسخة. بيانات الجهاز لم تتغير.',
      );
    } finally {
      setBusy(false);
      refreshLocalState();
      await refreshRemoteInfo();
    }
  };

  const acknowledgeRecovery = async () => {
    setBusy(true);
    try {
      await acknowledgeDriveRecoveryKey();
      setShowRecoveryCode(false);
      setRecoveryCode('');
      setMessage('تم حفظ حالة مفتاح الاسترداد. بدأ رفع النسخة المشفرة تلقائيًا.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تفعيل النسخ المشفر.');
    } finally {
      setBusy(false);
      refreshLocalState();
    }
  };

  const copyRecoveryCode = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setMessage('تم نسخ مفتاح الاسترداد. احفظه في مكان آمن خارج الهاتف.');
    } catch {
      setMessage('تعذر النسخ التلقائي؛ حدّد مفتاح الاسترداد وانسخه يدويًا.');
    }
  };

  return (
    <>
      <section className="space-y-4 rounded-3xl border border-sky-200 bg-gradient-to-br from-white to-sky-50/70 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Cloud className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-slate-800">نسخك واستردادك على Google Drive</h3>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              البيانات تظل على جهازك، ويُرفع إلى مساحة التطبيق ملف مشفر لا يمكن فتحه دون مفتاح
              الاسترداد.
            </p>
            {googleEmail && (
              <p className="mt-1 truncate text-xs font-bold text-sky-800" dir="ltr">
                {googleEmail}
              </p>
            )}
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-3">
          <span>
            <span className="block text-xs font-bold text-slate-800">
              نسخ تلقائي عند تحديث البيانات
            </span>
            <span className="mt-1 block text-[10px] leading-4 text-slate-500">
              يحفظ التعديلات المعلقة عند اتصال الإنترنت والتطبيق مفتوح. قد تحتاج لإعادة ربط Google
              بعد فتح التطبيق أو انتهاء صلاحية الاتصال.
            </span>
          </span>
          <input
            type="checkbox"
            checked={state.autoBackup}
            onChange={(event) => {
              void toggleAuto(event.target.checked);
            }}
            className="h-4 w-4 accent-sky-700"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void connectDrive();
            }}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {state.connected ? 'تحديث حالة Google Drive' : 'ربط حساب Google'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void handleBackupNow();
            }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sky-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            <CloudUpload className="h-4 w-4" />
            نسخ احتياطي لحساب جوجل
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-sky-100 bg-white p-3 text-[11px] text-slate-600 sm:grid-cols-2">
          <p>
            <span className="font-bold text-slate-800">آخر نسخة احتياطية:</span>{' '}
            {formatDate(state.lastBackup || latestBackupTimestamp(backupInfo))}
          </p>
          <p>
            <span className="font-bold text-slate-800">النسخة السابقة:</span>{' '}
            {formatDate(backupInfo.previous?.modifiedTime)}
          </p>
          {state.pending && (
            <p className="font-bold text-amber-700 sm:col-span-2">
              يوجد تعديل محفوظ على الجهاز ينتظر الرفع.
            </p>
          )}
          {!state.connected && state.autoBackup && (
            <p className="font-bold text-sky-800 sm:col-span-2">
              اربط Google Drive عند فتح التطبيق لمتابعة النسخ المعلق.
            </p>
          )}
          {state.lastError && (
            <p role="status" className="text-rose-700 sm:col-span-2">
              {state.lastError}
            </p>
          )}
        </div>

        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold text-slate-800">استرجاع إلى هذا الجهاز</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void handlePrepareRestore('latest');
              }}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              استرداد النسخة من جوجل
            </button>
            {backupInfo.previous && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void handlePrepareRestore('previous');
                }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                النسخة السابقة
              </button>
            )}
          </div>
          {restoreSlot && (
            <div className="space-y-2 rounded-xl bg-sky-50 p-3">
              <label
                htmlFor="drive-recovery-input"
                className="block text-[11px] font-bold text-slate-700"
              >
                مفتاح الاسترداد
              </label>
              <input
                id="drive-recovery-input"
                type="text"
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                value={recoveryInput}
                onChange={(event) => setRecoveryInput(event.target.value)}
                placeholder="الصق المفتاح الذي حفظته"
                className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-mono tracking-wide"
              />
              <button
                type="button"
                disabled={busy || !recoveryInput.trim()}
                onClick={() => {
                  void handlePrepareRestore(restoreSlot);
                }}
                className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                تحقق واسترجع
              </button>
            </div>
          )}
        </div>

        {state.recoveryKeyAvailable && !state.recoveryKeyAcknowledged && !showRecoveryCode && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
            يلزم إعداد مفتاح استرداد جديد قبل رفع نسخة مشفرة؛ المفتاح السابق لم يُحفظ بعد.
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void startRecoverySetup();
              }}
              className="mt-2 block font-black underline"
            >
              إنشاء مفتاح استرداد جديد
            </button>
          </div>
        )}

        {message && (
          <p
            role="status"
            className="rounded-xl border border-sky-100 bg-white/80 p-3 text-[11px] leading-5 text-slate-700"
          >
            {message}
          </p>
        )}
        {busy && (
          <p className="flex items-center gap-1.5 text-[10px] text-sky-700">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> جارٍ الاتصال...
          </p>
        )}
      </section>

      {preparedRestore && (
        <div
          className="fixed inset-0 z-[105] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setPreparedRestore(null);
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="drive-restore-title"
            aria-describedby="drive-restore-description"
            className="max-h-[90dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div>
              <h2 id="drive-restore-title" className="text-lg font-black text-slate-900">
                تأكيد استرداد النسخة
              </h2>
              <p id="drive-restore-description" className="mt-1 text-xs leading-5 text-slate-600">
                هيتم استبدال البيانات الموجودة على الجهاز ببيانات النسخة دي. راجع التاريخ وعدد
                السجلات قبل التأكيد.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm">
              <span className="font-bold text-emerald-950">تاريخ النسخة: </span>
              <span className="tabular-nums text-emerald-900">
                {formatDate(preparedRestore.backup.exportedAt || preparedRestore.backup.exportDate)}
              </span>
              <p className="mt-1 text-[11px] text-emerald-800">
                رقم النسخة {preparedRestore.backup.version}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(preparedRestore.counts).map(([table, count]) => (
                <div
                  key={table}
                  className="flex min-h-14 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="text-[11px] font-semibold text-slate-600">
                    {LATEST_SLOT_LABELS[table] || table}
                  </span>
                  <span className="text-sm font-black tabular-nums text-slate-900">
                    {count.toLocaleString('ar-EG')}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPreparedRestore(null)}
                className="min-h-11 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void handleApplyRestore();
                }}
                className="min-h-11 flex-1 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                تأكيد واسترداد
              </button>
            </div>
          </section>
        </div>
      )}

      {showRecoveryCode && recoveryCode && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="drive-recovery-title"
            className="w-full max-w-md space-y-4 rounded-3xl bg-white p-5 shadow-2xl"
          >
            <div>
              <h2 id="drive-recovery-title" className="text-lg font-black text-slate-900">
                احفظ مفتاح استرداد بياناتك
              </h2>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                استخدمه على موبايل جديد لاستعادة النسخة المشفرة. لا يتم رفع المفتاح إلى Google ولا
                يمكن إظهاره مرة أخرى.
              </p>
            </div>
            <div
              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center font-mono text-lg font-black tracking-wider text-slate-900"
              dir="ltr"
            >
              {recoveryCode}
            </div>
            <button
              type="button"
              onClick={() => {
                void copyRecoveryCode();
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs font-bold text-sky-800"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'تم النسخ' : 'نسخ مفتاح الاسترداد'}
            </button>
            <p className="rounded-xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
              احتفظ به خارج الهاتف. إذا فقدت الهاتف والمفتاح معًا، لن يمكن فك تشفير النسخة.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void acknowledgeRecovery();
              }}
              className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              حفظت المفتاح، شغّل النسخ المشفر
            </button>
          </section>
        </div>
      )}
    </>
  );
};
