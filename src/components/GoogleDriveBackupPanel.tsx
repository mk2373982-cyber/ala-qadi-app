'use client';

import React, { useEffect, useState } from 'react';
import { Cloud, CloudUpload, Download, RefreshCw, ShieldCheck } from 'lucide-react';
import { askForConfirmation } from '@/lib/confirm-action';
import { clearDriveAccessToken, getDriveBackupInfo, restoreBackupFromDrive, setDriveAccessToken, uploadBackupToDrive } from '@/lib/drive-backup';

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

export const GoogleDriveBackupPanel: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [autoBackup, setAutoBackup] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refreshInfo = async () => {
    setLastBackup(localStorage.getItem('ala_qaddi_drive_backup_at'));
    if (isConnected) {
      try {
        const info = await getDriveBackupInfo();
        if (info?.modifiedTime) setLastBackup(info.modifiedTime);
      } catch {
        // Connection may need renewing; keep the last known local timestamp.
      }
    }
  };

  useEffect(() => {
    setAutoBackup(localStorage.getItem('ala_qaddi_drive_auto') === 'true');
    setGoogleEmail(localStorage.getItem('ala_qaddi_drive_email') || '');
    setLastBackup(localStorage.getItem('ala_qaddi_drive_backup_at'));
    const update = () => {
      setLastBackup(localStorage.getItem('ala_qaddi_drive_backup_at'));
      if (localStorage.getItem('ala_qaddi_drive_auto') === 'true' && !isConnected) {
        setMessage('اربط Google Drive عند فتح التطبيق لمواصلة النسخ التلقائي.');
      }
    };
    window.addEventListener('ala-qaddi-drive-backup-status', update);
    return () => window.removeEventListener('ala-qaddi-drive-backup-status', update);
  }, [isConnected]);

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
          const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('تعذر تحميل خدمة Google')), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.dataset.googleIdentity = 'true';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('تعذر تحميل خدمة Google'));
          document.head.appendChild(script);
        });
      }
      if (!window.google?.accounts.oauth2) throw new Error('خدمة Google غير متاحة الآن.');

      await new Promise<void>((resolve, reject) => {
        const tokenClient = window.google!.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email',
          callback: (response) => {
            if (!response.access_token) return reject(new Error(response.error || 'لم يكتمل ربط الحساب'));
            setDriveAccessToken(response.access_token);
            setIsConnected(true);
            void fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${response.access_token}` } })
              .then((res) => res.ok ? res.json() : null)
              .then((user) => {
                const email = typeof user?.email === 'string' ? user.email : '';
                setGoogleEmail(email);
                if (email) localStorage.setItem('ala_qaddi_drive_email', email);
              });
            resolve();
          },
        });
        tokenClient.requestAccessToken({ prompt: 'consent' });
      });

      localStorage.setItem('ala_qaddi_drive_auto', 'true');
      setAutoBackup(true);
      await uploadBackupToDrive();
      setMessage('تم ربط Google Drive وحفظ أول نسخة. ستُحدّث النسخة تلقائيًا عند تغيّر البيانات أثناء اتصال Drive.');
    } catch (error) {
      clearDriveAccessToken();
      setIsConnected(false);
      setMessage(error instanceof Error ? error.message : 'تعذر ربط Google Drive.');
    } finally {
      setBusy(false);
      await refreshInfo();
    }
  };

  const handleBackupNow = async () => {
    setBusy(true);
    setMessage('');
    try {
      await uploadBackupToDrive();
      setMessage('تم حفظ نسخة حديثة على Google Drive.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ النسخة.');
    } finally {
      setBusy(false);
      await refreshInfo();
    }
  };

  const handleRestore = async () => {
    const confirmed = await askForConfirmation({
      title: 'استرجاع النسخة من Google Drive',
      message: 'سيتم استبدال البيانات الموجودة على هذا الجهاز ببيانات آخر نسخة محفوظة على Drive. يفضل حفظ نسخة حالية أولًا.',
      itemName: googleEmail || 'حساب Google المتصل',
      confirmLabel: 'استرجاع النسخة',
      tone: 'primary',
    });
    if (!confirmed) return;
    setBusy(true);
    setMessage('');
    try {
      const date = await restoreBackupFromDrive();
      localStorage.setItem('ala_qaddi_drive_backup_at', date);
      setLastBackup(date);
      setMessage('تم استرجاع النسخة. أعد تحميل التطبيق لعرض كل البيانات المسترجعة.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر استرجاع النسخة.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = (enabled: boolean) => {
    if (!enabled) {
      localStorage.setItem('ala_qaddi_drive_auto', 'false');
      setAutoBackup(false);
      setMessage('تم إيقاف النسخ التلقائي. النسخة الموجودة على Drive لن تُحذف.');
      return;
    }
    if (!isConnected) {
      setMessage('اربط Google Drive أولًا لتفعيل النسخ التلقائي.');
      return;
    }
    localStorage.setItem('ala_qaddi_drive_auto', 'true');
    setAutoBackup(true);
    setMessage('النسخ التلقائي مفعل لهذا الجهاز أثناء اتصال Google Drive.');
  };

  return (
    <section className="rounded-3xl border border-sky-200 bg-gradient-to-br from-white to-sky-50/70 p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700"><Cloud className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-800">نسخة احتياطية على Google Drive</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">ملف خاص بالتطبيق داخل مساحة Drive، وليس في قاعدة بيانات على قدي. عند الاسترجاع سيستبدل بيانات هذا الجهاز.</p>
          {googleEmail && <p className="mt-1 truncate text-xs font-bold text-sky-800" dir="ltr">{googleEmail}</p>}
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-3">
        <span><span className="block text-xs font-bold text-slate-800">نسخ تلقائي عند تحديث البيانات</span><span className="mt-1 block text-[10px] text-slate-500">يعمل بعد ربط Drive، أثناء فتح التطبيق واتصال الإنترنت.</span></span>
        <input type="checkbox" checked={autoBackup} onChange={(event) => toggleAuto(event.target.checked)} className="h-4 w-4 accent-sky-700" />
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={connectDrive} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-60"><ShieldCheck className="h-4 w-4" />{isConnected ? 'إعادة ربط Google Drive' : 'ربط حساب Google'}</button>
        <button type="button" disabled={busy || !isConnected} onClick={handleBackupNow} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-xs font-bold text-sky-800 disabled:opacity-50"><CloudUpload className="h-4 w-4" />نسخ الآن</button>
        <button type="button" disabled={busy || !isConnected} onClick={handleRestore} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 disabled:opacity-50"><Download className="h-4 w-4" />استرجاع</button>
      </div>

      {lastBackup && <p className="text-[10px] text-slate-500">آخر نسخة محفوظة: {new Date(lastBackup).toLocaleString('ar-EG')}</p>}
      {message && <p role="status" className="rounded-xl border border-sky-100 bg-white/80 p-3 text-[11px] leading-5 text-slate-700">{message}</p>}
      {busy && <p className="flex items-center gap-1.5 text-[10px] text-sky-700"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> جارٍ الاتصال...</p>}
    </section>
  );
};
