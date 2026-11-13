'use client';

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, BarChart3, CircleDollarSign, Wallet, X } from 'lucide-react';

const steps = [
  {
    icon: Wallet,
    title: 'ابدأ بأماكن أموالك',
    description:
      'هتلاقي أماكن جاهزة للكاش والمحفظة والفيزا. اضغط على المكان لتعديل اسمه أو رصيده، وزوّد مكانًا جديدًا لو محتاج.',
    hint: 'الرصيد هنا بيوضح فلوسك موجودة فين.',
  },
  {
    icon: CircleDollarSign,
    title: 'سجّل كل دخل ومصروف',
    description:
      'من زر الإضافة سجّل المبلغ والتفاصيل، وبعدها اختار المكان اللي دخلت فيه الفلوس أو اتصرفت منه.',
    hint: 'اختيار المكان الصحيح يحدّث رصيده تلقائيًا.',
  },
  {
    icon: Wallet,
    title: 'تابع الديون والالتزامات',
    description:
      'سجّل المبالغ اللي ليك أو عليك بمواعيدها. الالتزام المتكرر لا يخصم من رصيدك إلا لما تعلّم عليه إنه اتنفّذ.',
    hint: 'راجع المستحق هذا الشهر والشهر القادم قبل ما تقرر تصرف.',
  },
  {
    icon: BarChart3,
    title: 'حوّل الأرقام لقرارات',
    description:
      'افتح التقارير لمراجعة الدخل والمصروفات والاتجاهات، وحدد خطوة بسيطة تناسب ميزانيتك للشهر.',
    hint: 'بياناتك المالية محفوظة على هذا الجهاز، وتقدر تستخدم التطبيق دون اتصال بعد تسجيل الدخول.',
  },
];

export function OnboardingGuide({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const Icon = step.icon;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-b from-white to-emerald-50 shadow-2xl shadow-slate-950/25"
        dir="rtl"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-900">
            دليل البداية · {stepIndex + 1} من {steps.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق دليل الاستخدام"
            className="rounded-full p-2 text-slate-500 transition hover:bg-white hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-5">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-800/20">
            <Icon className="h-8 w-8" />
          </div>
          <h2 id="onboarding-title" className="text-2xl font-black tracking-tight text-slate-900">
            {step.title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">{step.description}</p>
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-white/80 px-4 py-3 text-xs font-semibold leading-6 text-emerald-950">
            {step.hint}
          </div>

          <div className="mt-6 flex items-center gap-3">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((current) => current - 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
              >
                <ArrowRight className="h-4 w-4" /> السابق
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                stepIndex === steps.length - 1 ? onClose() : setStepIndex((current) => current + 1)
              }
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/15 transition hover:bg-emerald-800"
            >
              {stepIndex === steps.length - 1 ? 'ابدأ استخدام التطبيق' : 'التالي'}
              {stepIndex < steps.length - 1 && <ArrowLeft className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full py-2 text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4"
          >
            تخطي الدليل
          </button>
        </div>
      </section>
    </div>
  );
}
