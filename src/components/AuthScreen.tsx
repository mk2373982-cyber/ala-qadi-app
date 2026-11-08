'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Lock, Phone, User, ShieldCheck, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    await login('01012345678', '123');
    setLoading(false);
  };

  return (
    <div className="app-theme min-h-screen bg-gradient-to-b from-brand-100/70 via-[#f3f8f4] to-[#e6f0e8] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Banner */}
        <div className="text-center mb-6">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 items-center justify-center text-white shadow-xl shadow-brand-500/20 mb-3">
            <span className="font-black text-2xl">قـ</span>
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">على قدي</h1>
          <p className="text-sm text-slate-600 mt-1">إدارة مالية شخصية تحفظ سجلاتك على جهازك وتعمل دون اتصال بعد تسجيل الدخول</p>
        </div>

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
                <label className="block text-xs font-bold text-slate-600 mb-1.5">الاسم بالكامل</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد محمد"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-sm bg-slate-50/50"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">رقم الهاتف أو الواتساب</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input
                  type="tel"
                  required
                  placeholder="010XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-sm bg-slate-50/50 font-mono text-right"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 text-sm bg-slate-50/50"
                />
              </div>
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
        </div>

        {/* Demo Fast Access Link */}
        <div className="mt-4 text-center">
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="text-xs text-brand-700 hover:text-brand-900 bg-brand-50 hover:bg-brand-100 border border-brand-200 px-3 py-1.5 rounded-full inline-flex items-center gap-1 font-semibold transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>تجربة التطبيق بحساب تجريبي فوري</span>
          </button>
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
