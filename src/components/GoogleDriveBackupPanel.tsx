'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, CloudUpload, Copy, Download, RefreshCw, ShieldCheck } from 'lucide-react';
import { askForConfirmation } from '@/lib/confirm-action';
import { useAuth } from '@/context/AuthContext';
import {
  acknowledgeDriveRecoveryKey,
  clearDriveAccessToken,
  createDriveRecoveryKey,
  disableDriveAutoBackup,
  enableDriveAutoBackup,
  getDriveBackupInfo,
  getDriveBackupState,
  restoreBackupFromDrive,
  resumePendingDriveBackup,
  setDriveAccessToken,
  uploadBackupToDrive,
  type DriveBackupInfo,
  type DriveBackupState,
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

export const GoogleDriveBackupPanel: React.FC = () => {
  const { user } = useAuth();
  const [state, setState] = useState(INITIAL_STATE);
  const [backupInfo, setBackupInfo] = useState<DriveBackupInfo>({ current: null, previous: null });
  const [googleEmail, setGoogleEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [restoreSlot, setRestoreSlot] = useState<'current' | 'previous' | null>(null);
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
      const latest = info.current?.modifiedTime || getDriveBackupState().lastBackup;
      setState((current) => ({ ...current, lastBackup: latest }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر قراءة حالة النسخ الاحتياطي.');
    }
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

  const connectDrive = async () => {
    if (!CLIENT_ID) {
      setMessage('يلزم إعداد NEXT_PUBLIC_GOOGLE_CLIENT_ID من Google Cloud قبل ربط Drive.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (!window.google?.accounts.oauth2) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>(
            'script[data-google-identity]',
          );
          if (existing) {
            if (existing.dataset.loaded === 'true') {
              resolve();
              return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('تعذر تحميل خدمة Google')), {
              once: true,
            });
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
          script.onerror = () => reject(new Error('تعذر تحميل خدمة Google'));
          document.head.appendChild(script);
        });
      }
      if (!window.google?.accounts.oauth2) throw new Error('خدمة Google غير متاحة الآن.');

      const token = await new Promise<string>((resolve, reject) => {
        const tokenClient = window.google!.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope:
            'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email',
          callback: (response) =>
            response.access_token
              ? resolve(response.access_token)
              : reject(new Error(response.error || 'لم يكتمل ربط الحساب')),
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
        localStorage.setItem(`ala_qaddi_drive_email_${user.id}`, userInfo.email);
      }

      const info = await getDriveBackupInfo();
      setBackupInfo(info);
      const localState = getDriveBackupState();
      const hasRemoteBackup = Boolean(info.current || info.previous);

      if (!hasRemoteBackup && !localState.recoveryKeyAcknowledged) {
        await startRecoverySetup();
      } else if (hasRemoteBackup && !localState.recoveryKeyAcknowledged) {
        if (info.current?.encrypted || info.previous?.encrypted) {
          setMessage('وجدنا نسخة مشفرة. اختر استرجاعها وأدخل مفتاح الاسترداد المحفوظ لديك.');
        } else {
          setMessage(
            'وجدنا نسخة قديمة غير مشفرة. استرجعها أولًا؛ بعدها ستحصل على مفتاح النسخ المشفر.',
          );
        }
      } else if (localState.autoBackup && localState.recoveryKeyAcknowledged) {
        resumePendingDriveBackup();
        setMessage('تم ربط Google Drive. سيُستكمل أي رفع معلّق.');
      } else {
        setMessage('تم ربط Google Drive. النسخ التلقائي متوقف؛ يمكنك تشغيله من المفتاح أدناه.');
      }
      refreshLocalState();
      await refreshRemoteInfo();
      refreshLocalState();
    } catch (error) {
      clearDriveAccessToken();
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
      await uploadBackupToDrive();
      setMessage('تم حفظ نسخة مشفرة حديثة على Google Drive.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ النسخة.');
    } finally {
      setBusy(false);
      refreshLocalState();
      await refreshRemoteInfo();
      refreshLocalState();
    }
  };

  const handleRestore = async (slot: 'current' | 'previous') => {
    const targetInfo = backupInfo[slot];
    if (!targetInfo) return;
    const needsRecoveryKey = targetInfo.encrypted && !state.recoveryKeyAvailable;
    if (needsRecoveryKey && !recoveryInput.trim()) {
      setRestoreSlot(slot);
      setMessage('اكتب مفتاح الاسترداد المحفوظ عند إعداد النسخة المشفرة.');
      return;
    }

    const confirmed = await askForConfirmation({
      title: slot === 'current' ? 'استرجاع أحدث نسخة' : 'استرجاع النسخة السابقة',
      message:
        'سيتم استبدال بيانات هذا الجهاز بمحتوى النسخة المختارة. أكمل فقط إذا أردت استعادة هذه النسخة.',
      itemName: `${slot === 'current' ? 'النسخة الحالية' : 'النسخة السابقة'} — ${formatDate(targetInfo.modifiedTime)}`,
      confirmLabel: 'استرجاع النسخة',
      tone: 'primary',
    });
    if (!confirmed) return;

    setBusy(true);
    setMessage('');
    try {
      const result = await restoreBackupFromDrive(
        slot,
        needsRecoveryKey ? recoveryInput.trim() : undefined,
      );
      setRecoveryInput('');
      setRestoreSlot(null);
      if (result.encrypted) {
        setMessage('تم استرجاع النسخة المشفرة. أعد تحميل التطبيق لعرض كل البيانات المسترجعة.');
      } else {
        setMessage('تم استرجاع النسخة القديمة. احفظ الآن مفتاح الاسترداد لتشغيل النسخ المشفر.');
        const code = await createDriveRecoveryKey();
        setRecoveryCode(code);
        setCopied(false);
        setShowRecoveryCode(true);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'تعذر استرجاع النسخة. لم يتم تغيير بيانات الجهاز.',
      );
    } finally {
      setBusy(false);
      refreshLocalState();
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
            <h3 className="text-sm font-black text-slate-800">نسخة مشفرة على Google Drive</h3>
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
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {state.connected ? 'إعادة ربط Google Drive' : 'ربط حساب Google'}
          </button>
          <button
            type="button"
            disabled={busy || !state.connected || !state.recoveryKeyAcknowledged}
            onClick={() => {
              void handleBackupNow();
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-xs font-bold text-sky-800 disabled:opacity-50"
          >
            <CloudUpload className="h-4 w-4" />
            نسخ الآن
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-2xl border border-sky-100 bg-white p-3 text-[11px] text-slate-600 sm:grid-cols-2">
          <p>
            <span className="font-bold text-slate-800">أحدث نسخة:</span>{' '}
            {formatDate(state.lastBackup || backupInfo.current?.modifiedTime)}
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

        {(backupInfo.current || backupInfo.previous) && (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold text-slate-800">استرجاع إلى هذا الجهاز</p>
            <div className="flex flex-wrap gap-2">
              {backupInfo.current && (
                <button
                  type="button"
                  disabled={busy || !state.connected}
                  onClick={() => {
                    void handleRestore('current');
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  أحدث نسخة
                </button>
              )}
              {backupInfo.previous && (
                <button
                  type="button"
                  disabled={busy || !state.connected}
                  onClick={() => {
                    void handleRestore('previous');
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
                    void handleRestore(restoreSlot);
                  }}
                  className="w-full rounded-lg bg-sky-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  تحقق واسترجع
                </button>
              </div>
            )}
          </div>
        )}

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
              className="w-full rounded-xl bg-sky-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              حفظت المفتاح، شغّل النسخ المشفر
            </button>
          </section>
        </div>
      )}
    </>
  );
};
