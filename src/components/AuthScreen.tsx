'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { Lock, Phone, User, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [signupOffer, setSignupOffer] = useState<{ available: boolean; endsAt: string | null } | null>(null);
  const [isRegister, setIsRegister] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const openRegistration = sessionStorage.getItem('ala_qaddi_open_registration') === '1';
    if (openRegistration) {
      sessionStorage.removeItem('ala_qaddi_open_registration');
      setIsRegister(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/auth/signup-offer', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((offer) => { if (active && offer) setSignupOffer(offer); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isRegister) {
      if (!name.trim()) {
        setError('يرجى كتابة اسمك');
        setLoading(false);
        return;
      }
      const res = await register(name, phone, password);
      if (!res.success) {
        setError(res.error || 'فشل التسجيل');
      }
    } else {
      const res = await login(phone, password);
      if (!res.success) {
        setError(res.error || 'فشل تسجيل الدخول');
      }
    }

    setLoading(false);
  };

  return (
    <div className="app-theme min-h-screen bg-gradient-to-b from-brand-100/70 via-[#f3f8f4] to-[#e6f0e8] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <Image
            src="/icon-192.png"
            alt="أيقونة تطبيق على قدي"
            width={64}
            height={64}
            priority
            className="mx-auto mb-3 h-16 w-16 rounded-2xl object-cover shadow-xl shadow-brand-500/20"
          />
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">على قدي</h1>
          <p className="text-sm text-slate-600 mt-1">إدارة مالية شخصية تحفظ سجلاتك على جهازك وتعمل دون اتصال بعد تسجيل الدخول</p>
        </div>

        {signupOffer?.available && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-white/90 p-4 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2 text-sm font-black text-emerald-900">
              <Sparkles className="h-4 w-4 text-amber-500" /> فترة إطلاق مجانية للجميع
            </div>
            {signupOffer.endsAt && <p className="mt-1 text-[11px] text-emerald-800">متاحة حتى {new Date(signupOffer.endsAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</p>}
            <p className="mt-1 text-[11px] leading-5 text-slate-600">الاستفادة تنتهي في نفس موعد نهاية العرض لكل الحسابات، ولا تتجدد بإنشاء حساب جديد. اشترك خلال أول ١٠ أيام من تسجيلك لتحصل على نصف سعر الاشتراك السنوي.</p>
          </div>
        )}
        {signupOffer && !signupOffer.available && (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white/90 p-4 text-center shadow-sm">
            <div className="text-sm font-black text-slate-800">انتهت فترة الإطلاق المجانية</div>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">يمكنك إنشاء حساب وتقديم طلب اشتراك من داخل التطبيق.</p>
          </div>
        )}

        {/* Auth Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200/80 p-6 sm:p-8">
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                !isRegister
                  ? 'bg-white text-brand-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                isRegister
                  ? 'bg-white text-brand-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              حساب جديد
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label htmlFor="register-name" className="block text-xs font-bold text-slate-600 mb-1.5">الاسم بالكامل</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  <input
                    id="register-name"
                    type="text"
                    required
                    autoComplete="name"
                    maxLength={80}
                    placeholder="مثال: أحمد محمد"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-sm bg-slate-50/50"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-phone" className="block text-xs font-bold text-slate-600 mb-1.5">رقم الهاتف أو الواتساب</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input
                  id="auth-phone"
                  type="tel"
                  required
                  minLength={isRegister ? 11 : undefined}
                  maxLength={isRegister ? 11 : 32}
                  pattern={isRegister ? '01[0125][0-9]{8}' : undefined}
                  title={isRegister ? 'اكتب رقم موبايل مصري صحيح مكوّنًا من 11 رقمًا ويبدأ بـ 010 أو 011 أو 012 أو 015' : undefined}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="010XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-sm bg-slate-50/50 font-mono text-right"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-xs font-bold text-slate-600 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  minLength={isRegister ? 8 : undefined}
                  maxLength={128}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-sm bg-slate-50/50"
                />
              </div>
              {isRegister && <p className="mt-1 text-[11px] text-slate-500">استخدم 8 أحرف على الأقل.</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-98 text-white font-bold text-sm shadow-md shadow-brand-600/20 transition-all flex items-center justify-center gap-2 mt-2"
            >
              <span>{loading ? 'جاري المعالجة...' : isRegister ? 'إنشاء حساب جديد' : 'دخول للتطبيق'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Value Prop Badges */}
          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-brand-600" />
              <span>سجلاتك المالية على جهازك</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-brand-600" />
              <span>تعمل السجلات دون اتصال</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-brand-600" />
              <span>ديون وأقساط وجمعيات</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-brand-600" />
              <span>تتبع مدخرات الذهب</span>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-600">
            يلزم الإنترنت لتسجيل الدخول أول مرة. بعد ذلك، سجلاتك المالية المحفوظة على هذا الجهاز متاحة دون اتصال.
          </p>
        </div>

        {/* Admin Link at the very bottom */}
        <div className="mt-6 text-center text-xs text-slate-400">
          هل أنت صاحب التطبيق؟{' '}
          <a href="/admin" className="text-slate-600 hover:text-brand-600 font-semibold underline">
            لوحة تحكم المسؤول
          </a>
        </div>
      </div>
    </div>
  );
};
