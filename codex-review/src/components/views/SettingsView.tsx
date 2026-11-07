'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { exportAllDataAsJSON, importDataFromJSON } from '@/lib/export-import';
import { db } from '@/lib/db';
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
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { user, daysRemaining, refreshStatus, isOnline, logout } = useAuth();
  const [importing, setImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExport = async () => {
    await exportAllDataAsJSON();
    setStatusMessage('تم تحميل ملف النسخة الاحتياطية بنجاح.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !confirm(
        'تنبيه: استرجاع النسخة الاحتياطية سيقوم باستبدال البيانات الحالية بالبيانات الموجودة في الملف. هل تود المتابعة؟'
      )
    ) {
      e.target.value = '';
      return;
    }

    setImporting(true);
    const result = await importDataFromJSON(file);
    setImporting(false);
    setStatusMessage(result.message);
    e.target.value = '';
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleClearAllData = async () => {
    if (
      confirm(
        'تحذير شديد: هل أنت متأكد من مسح جميع المعاملات والديون والجمعيات المسجلة على هذا الجهاز؟ هذا الإجراء لا يمكن التراجع عنه إلا بوجود نسخة احتياطية!'
      )
    ) {
      await db.transactions.clear();
      await db.debts.clear();
      await db.gam3eyat.clear();
      await db.savings.clear();
      setStatusMessage('تم مسح جميع البيانات المحلية بنجاح.');
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Top Header Card */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-black text-slate-800">الإعدادات والنسخ الاحتياطي</h2>
        <p className="text-xs text-slate-500">حماية بياناتك، معلومات الاشتراك، وتثبيت التطبيق على الموبايل</p>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Account & License Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">بيانات الحساب والاشتراك</h3>
              <p className="text-[11px] text-slate-400">حالة ترخيصك في على قدي</p>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400">الاسم المسجل</div>
              <div className="text-xs font-bold text-slate-800">{user?.name}</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
            <Phone className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400">رقم الهاتف</div>
              <div className="text-xs font-bold text-slate-800 font-mono">{user?.phone}</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400">نوع الباقة</div>
              <div className="text-xs font-bold text-brand-700">
                {user?.plan === 'lifetime'
                  ? 'اشتراك دائم (مدى الحياة)'
                  : user?.plan === '1_year'
                  ? 'اشتراك سنوي'
                  : 'اشتراك شهري'}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-[10px] text-slate-400">الصلاحية</div>
              <div className="text-xs font-bold text-slate-800">
                {daysRemaining === null ? 'نشط دائماً' : `متبقي ${daysRemaining} يوم`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backup and Restore Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">النسخ الاحتياطي ونقل البيانات</h3>
            <p className="text-[11px] text-slate-400">
              احتفظ بنسخة من بياناتك في ملف مشفر لنقلها لأي جهاز آخر
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Export */}
          <button
            onClick={handleExport}
            className="p-4 rounded-2xl border border-slate-200 hover:border-brand-500 bg-slate-50 hover:bg-brand-50/50 text-right transition-all flex flex-col justify-between"
          >
            <div className="w-8 h-8 rounded-xl bg-white text-brand-600 flex items-center justify-center shadow-sm mb-2">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-800">تنزيل نسخة احتياطية</div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                يحفظ كل معاملاتك وديونك في ملف JSON على هاتفك أو جهازك
              </p>
            </div>
          </button>

          {/* Import */}
          <label className="p-4 rounded-2xl border border-slate-200 hover:border-brand-500 bg-slate-50 hover:bg-brand-50/50 text-right transition-all flex flex-col justify-between cursor-pointer">
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              disabled={importing}
              className="hidden"
            />
            <div className="w-8 h-8 rounded-xl bg-white text-blue-600 flex items-center justify-center shadow-sm mb-2">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-800">
                {importing ? 'جاري الاسترجاع...' : 'استرجاع من ملف احتياطي'}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                اختر ملف النسخة الاحتياطية لاستعادة كافة حساباتك فوراً
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* PWA Mobile Installation Guide */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">تثبيت التطبيق على شاشة هاتفك (PWA)</h3>
            <p className="text-[11px] text-slate-400">ليفتح كتطبيق أصلي سريع بدون متجر وبدون إنترنت</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 pt-1">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="font-bold text-slate-800 text-xs">لهواتف أندرويد (Chrome):</div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500">
              <li>اضغط على زر الخيارات (⋮) أعلى يمين المتصفح.</li>
              <li>اختر <span className="font-bold text-slate-700">"تثبيت التطبيق"</span> أو <span className="font-bold text-slate-700">"إضافة إلى الشاشة الرئيسية"</span>.</li>
              <li>سيظهر لك أيقونة "على قدي" على هاتفك كأي تطبيق رسمي!</li>
            </ol>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="font-bold text-slate-800 text-xs">لهواتف آيفون (iPhone Safari):</div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-500">
              <li>اضغط على زر المشاركة (Share) أسفل الشاشة.</li>
              <li>اختر <span className="font-bold text-slate-700">"إضافة إلى الصفحة الرئيسية (Add to Home Screen)"</span>.</li>
              <li>اضغط "إضافة (Add)" وسيفتح معك كأنه تطبيق من متجر آبل.</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Logout Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-sm text-slate-800">تسجيل الخروج من الحساب</h4>
          <p className="text-xs text-slate-400 mt-0.5">الخروج من حسابك ({user?.name}) والعودة لشاشة الدخول</p>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل خروج الآن</span>
        </button>
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
