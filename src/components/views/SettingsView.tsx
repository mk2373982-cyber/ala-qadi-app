'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { exportAllDataAsJSON, importDataFromJSON } from '@/lib/export-import';
import { db, seedDefaultCategoriesIfEmpty } from '@/lib/db';
import { askForConfirmation } from '@/lib/confirm-action';
import { SupabaseBackupPanel } from '@/components/SupabaseBackupPanel';
import {
  Download,
  Upload,
  ShieldCheck,
  Smartphone,
  Trash2,
  RefreshCw,
  User,
  Phone,
  Calendar,
  CheckCircle,
  LogOut,
  Send,
} from 'lucide-react';

type PublicPaymentConfig = { whatsappNumber: string; pricingNote: string; instapayLink: string };

export const SettingsView: React.FC<{
  onShowOnboarding?: () => void;
  onDataRestored?: () => void;
}> = ({ onShowOnboarding, onDataRestored }) => {
  const { user, daysRemaining, refreshStatus, isOnline, logout, trialMinutesRemaining } = useAuth();
  const [importing, setImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PublicPaymentConfig | null>(null);

  useEffect(() => {
    fetch('/api/public/config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPaymentConfig(data))
      .catch(() => {});
  }, []);

  const isRegisteredTrial = Boolean(user?.isTrial && !user.trialExpiresAt && user.startDate);
  const annualOfferDeadline = isRegisteredTrial ? new Date(user!.startDate!) : null;
  if (annualOfferDeadline) annualOfferDeadline.setDate(annualOfferDeadline.getDate() + 10);
  const annualOfferIsOpen = Boolean(
    annualOfferDeadline && Date.now() <= annualOfferDeadline.getTime(),
  );

  const handleExport = async () => {
    await exportAllDataAsJSON();
    setStatusMessage('تم تحميل ملف النسخة الاحتياطية بنجاح.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmed = await askForConfirmation({
      title: 'تأكيد استرجاع النسخة',
      message:
        'استرجاع النسخة الاحتياطية سيستبدل بياناتك الحالية بالبيانات الموجودة في الملف المحدد. هل تريد المتابعة؟',
      itemName: file.name,
      confirmLabel: 'استرجاع النسخة',
      tone: 'primary',
    });
    if (!confirmed) {
      e.target.value = '';
      return;
    }

    setImporting(true);
    const result = await importDataFromJSON(file);
    setImporting(false);
    setStatusMessage(result.message);
    if (result.success) onDataRestored?.();
    e.target.value = '';
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleClearAllData = async () => {
    const confirmed = await askForConfirmation({
      title: 'تأكيد مسح جميع البيانات',
      message:
        'سيتم حذف المعاملات والديون والجمعيات والأصول وأهداف الادخار والمعاملات المتكررة والميزانيات والتصنيفات المخصصة. ستبقى أماكن الفلوس بأسمائها وأنواعها، لكن أرصدتها ستصبح صفرًا.',
      itemName: 'كل البيانات المالية مع الاحتفاظ بأماكن الفلوس',
      confirmLabel: 'مسح كل البيانات',
    });
    if (!confirmed) return;
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
      ],
      async () => {
        await Promise.all([
          db.transactions.clear(),
          db.categories.clear(),
          db.budgets.clear(),
          db.debts.clear(),
          db.gam3eyat.clear(),
          db.savings.clear(),
          db.savingsGoals.clear(),
          db.recurringTransactions.clear(),
        ]);
        await db.wallets.toCollection().modify({ balance: 0 });
      },
    );
    await seedDefaultCategoriesIfEmpty();
    setStatusMessage(
      'تم مسح البيانات والميزانيات، وإعادة التصنيفات الافتراضية. أماكن الفلوس موجودة وأرصدتها صفر.',
    );
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <h2 className="text-lg font-bold text-slate-900">الإعدادات</h2>
        {onShowOnboarding && (
          <button
            type="button"
            onClick={onShowOnboarding}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100"
          >
            عرض دليل استخدام التطبيق
          </button>
        )}
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Account & License Card */}
      <div className="space-y-4 rounded-2xl bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">بيانات الحساب والاشتراك</h3>
            </div>
          </div>

          <button
            onClick={() => refreshStatus()}
            disabled={!isOnline}
            className="flex items-center gap-1 text-xs text-brand-600 font-bold hover:underline disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>فحص التحديث</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          <div className="flex items-center gap-3 py-3">
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400">الاسم المسجل</div>
              <div className="text-xs font-bold text-slate-800">{user?.name}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3">
            <Phone className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400">رقم الهاتف</div>
              <div className="text-xs font-bold tabular-nums text-slate-800">
                {user?.phone || 'غير مطلوب'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400">نوع الباقة</div>
              <div className="text-xs font-bold text-brand-700">
                {user?.isTrial
                  ? trialMinutesRemaining !== null
                    ? 'تجربة ضيف قصيرة'
                    : 'شهر مجاني'
                  : user?.plan === 'lifetime'
                    ? 'اشتراك دائم (مدى الحياة)'
                    : user?.plan === '1_year'
                      ? 'اشتراك سنوي'
                      : 'اشتراك شهري'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400">الصلاحية</div>
              <div className="text-xs font-bold text-slate-800">
                {user?.isTrial && trialMinutesRemaining !== null
                  ? `تجربة الضيف: متبقي ${Math.floor(trialMinutesRemaining / 60)} ساعة و${trialMinutesRemaining % 60} دقيقة`
                  : daysRemaining === null
                    ? 'نشط دائماً'
                    : `متبقي ${daysRemaining} يوم`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {user && isRegisteredTrial && user.endDate && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <h3 className="text-sm font-bold text-emerald-950">عرض الاشتراك السنوي بنصف السعر</h3>
          <p className="mt-1 text-xs leading-5 text-emerald-900">
            {annualOfferIsOpen
              ? `خصم ٥٠٪ متاح إذا تم الدفع قبل ${annualOfferDeadline?.toLocaleDateString('ar-EG')}.`
              : `انتهت مهلة الخصم. إذا كان الدفع تم خلال أول ١٠ أيام، أرسل الإيصال للمسؤول للمراجعة.`}{' '}
            الشهر المجاني يستمر ٣٠ يومًا. بعد مراجعة التحويل، يفعّل المسؤول الباقة السنوية.
          </p>
          {paymentConfig?.pricingNote && (
            <p className="mt-2 rounded-xl bg-white/80 p-3 text-xs font-bold leading-5 text-slate-700">
              {paymentConfig.pricingNote}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {paymentConfig?.instapayLink &&
              /^https:\/\/ipn\.eg\//i.test(paymentConfig.instapayLink) && (
                <a
                  href={paymentConfig.instapayLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  التحويل عبر InstaPay
                </a>
              )}
            {paymentConfig?.whatsappNumber && (
              <a
                href={`https://wa.me/${paymentConfig.whatsappNumber.replace(/\D/g, '')}?text=${encodeURIComponent(`مرحباً، أريد الاشتراك السنوي بعرض نصف السعر. الاسم: ${user.name}، رقم الهاتف: ${user.phone}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
              >
                <Send className="h-3.5 w-3.5" /> إرسال الإيصال للمسؤول
              </a>
            )}
          </div>
        </section>
      )}

      {/* Backup and Restore Card */}
      <div className="space-y-4 rounded-2xl bg-white p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">النسخ الاحتياطي ونقل البيانات</h3>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {/* Export */}
          <button
            onClick={handleExport}
            className="flex w-full items-center gap-3 py-3 text-right transition-colors hover:bg-slate-50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-800">تنزيل نسخة احتياطية</div>
            </div>
          </button>

          {/* Import */}
          <label className="flex w-full cursor-pointer items-center gap-3 py-3 text-right transition-colors hover:bg-slate-50">
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              disabled={importing}
              className="hidden"
            />
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-800">
                {importing ? 'جاري الاسترجاع...' : 'استرجاع من ملف احتياطي'}
              </div>
            </div>
          </label>
        </div>
      </div>

      {user?.id && (
        <SupabaseBackupPanel
          key={user.id}
          userId={user.id}
          isOnline={isOnline}
          isTrial={Boolean(user.isTrial)}
          onDataRestored={onDataRestored}
        />
      )}

      {/* PWA Mobile Installation Guide */}
      <div className="space-y-3 rounded-2xl bg-white p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">تثبيت التطبيق على شاشة هاتفك (PWA)</h3>
            <p className="text-[11px] text-slate-400">
              يفتح كتطبيق ويب مثبت؛ تحتاج المزامنة والتحقق من الاشتراك إلى الإنترنت
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 pt-1">
          <div className="space-y-1.5 py-3 sm:pl-3">
            <div className="font-bold text-slate-800 text-xs">لهواتف أندرويد (Chrome):</div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500">
              <li>اضغط على زر الخيارات (⋮) أعلى يمين المتصفح.</li>
              <li>
                اختر <span className="font-bold text-slate-700">"تثبيت التطبيق"</span> أو{' '}
                <span className="font-bold text-slate-700">"إضافة إلى الشاشة الرئيسية"</span>.
              </li>
              <li>سيظهر لك أيقونة "على قدي" على هاتفك كأي تطبيق رسمي!</li>
            </ol>
          </div>

          <div className="space-y-1.5 py-3 sm:pr-3">
            <div className="font-bold text-slate-800 text-xs">لهواتف آيفون (iPhone Safari):</div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500">
              <li>اضغط على زر المشاركة (Share) أسفل الشاشة.</li>
              <li>
                اختر{' '}
                <span className="font-bold text-slate-700">
                  "إضافة إلى الصفحة الرئيسية (Add to Home Screen)"
                </span>
                .
              </li>
              <li>اضغط "إضافة (Add)" وسيفتح معك كأنه تطبيق من متجر آبل.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Logout Card */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center">
        <div>
          <h4 className="font-bold text-sm text-slate-800">تسجيل الخروج من الحساب</h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user?.isTrial && (
            <button
              type="button"
              onClick={() => {
                try {
                  sessionStorage.setItem('ala_qaddi_open_registration', '1');
                } catch {}
                logout();
              }}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <User className="h-4 w-4" />
              <span>إنشاء حساب والاحتفاظ بالبيانات</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem('ala_qaddi_user');
                sessionStorage.clear();
              } catch (e) {}
              logout();
              if (typeof window !== 'undefined') {
                window.location.replace('/');
                window.location.reload();
              }
            }}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            <span>تسجيل خروج الآن</span>
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-rose-50/50 rounded-3xl p-5 border border-rose-200 space-y-2">
        <h4 className="font-bold text-xs text-rose-800">منطقة الحذر: مسح البيانات</h4>
        <p className="text-[11px] text-rose-600">
          إذا أردت البدء من الصفر وتصفير كافة المعاملات والديون المحفوظة على هذا الجهاز.
        </p>
        <button
          onClick={handleClearAllData}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-300 font-bold text-xs transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>تصفير ومسح جميع البيانات المحلية</span>
        </button>
      </div>
    </div>
  );
};
