'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Clock, AlertCircle, RefreshCw, Send, PhoneCall, LogOut, CheckCircle2 } from 'lucide-react';

interface PublicConfig {
  paymentPhone: string;
  paymentInstapay: string;
  instapayLink: string;
  whatsappNumber: string;
  pricingNote: string;
}

export const PendingScreen: React.FC = () => {
  const { user, refreshStatus, logout, isOnline } = useAuth();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activationCode, setActivationCode] = useState('');
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const activateWithCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !activationCode.trim()) return;
    setIsActivating(true);
    setPaymentMessage(null);
    try {
      const response = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, code: activationCode.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تعذر تفعيل الاشتراك');
      await refreshStatus();
      setPaymentMessage('تم تفعيل اشتراكك بنجاح.');
    } catch (error) {
      setPaymentMessage(error instanceof Error ? error.message : 'تعذر تفعيل الاشتراك');
    } finally {
      setIsActivating(false);
    }
  };

  useEffect(() => {
    fetch('/api/public/config')
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error('Error fetching payment config', err));
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshStatus();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const whatsappMessage = encodeURIComponent(
    `مرحباً، قمت بالتحويل لتفعيل حسابي في تطبيق (على قدي). أرفق صورة إيصال التحويل.\nالاسم: ${user?.name || ''}\nرقم الهاتف: ${user?.phone || ''}`
  );

  const whatsappLink = config?.whatsappNumber
    ? `https://wa.me/${config.whatsappNumber.replace(/\D/g, '')}?text=${whatsappMessage}`
    : '#';

  const isExpired = user?.status === 'expired';
  const isSuspended = user?.status === 'suspended';

  return (
    <div className="app-theme min-h-screen bg-[#f3f8f4] flex items-center justify-center p-4">
      <div className="min-w-0 max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 text-center relative overflow-hidden">
        {/* Top Decorative accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-brand-500 via-amber-400 to-brand-600" />

        {/* Icon status */}
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all">
          {isExpired ? (
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
          ) : isSuspended ? (
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center animate-pulse">
              <Clock className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Title & Welcome */}
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2">
          {isExpired
            ? 'انتهت فترة الاشتراك'
            : isSuspended
            ? 'الحساب موقوف حالياً'
            : 'حسابك في انتظار التفعيل'}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          أهلاً بك يا <span className="font-bold text-slate-700">{user?.name}</span>،{' '}
          {isExpired
            ? 'يرجى تجديد الاشتراك لمتابعة إدارة حساباتك بأمان.'
            : isSuspended
            ? 'يرجى التواصل مع المسؤول لمعرفة سبب إيقاف الحساب.'
            : 'تم تسجيل بياناتك بنجاح. لتفعيل حسابك والبدء، يرجى تحويل قيمة الاشتراك وإرسال الإشعار.'}
        </p>

        {/* Payment Details Box */}
        {config && (
          <div className="min-w-0 bg-slate-50 rounded-2xl p-4 border border-slate-200 text-right mb-6 space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              طرق التحويل والتفعيل المباشر
            </div>

            {config.pricingNote && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/60 text-xs text-amber-900 font-medium leading-relaxed">
                💡 {config.pricingNote}
              </div>
            )}

            {/* Vodafone Cash */}
            {config.paymentPhone && (
              <div className="flex min-w-0 items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-200">
                <button
                  onClick={() => copyToClipboard(config.paymentPhone, 'phone')}
                  className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                >
                  {copiedField === 'phone' ? 'تم النسخ ✓' : 'نسخ الرقم'}
                </button>
                <div className="min-w-0 max-w-[70%] overflow-hidden text-left">
                  <div className="text-xs text-slate-400">فودافون كاش / محفظة</div>
                  <div className="font-mono font-bold text-slate-800 text-sm dir-ltr">
                    {config.paymentPhone}
                  </div>
                </div>
              </div>
            )}

            {/* InstaPay */}
            {config.paymentInstapay && (
              <div className="flex min-w-0 items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-200">
                <button
                  onClick={() => copyToClipboard(config.paymentInstapay, 'instapay')}
                  className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                >
                  {copiedField === 'instapay' ? 'تم النسخ ✓' : 'نسخ العنوان'}
                </button>
                <div className="min-w-0 max-w-[70%] overflow-hidden text-left">
                  <div className="text-xs text-slate-400">عنوان انستاباي (InstaPay)</div>
                  <div className="font-mono font-bold text-slate-800 text-sm dir-ltr break-all">
                    {config.paymentInstapay}
                  </div>
                </div>
              </div>
            )}

            {config.instapayLink && (
              <a
                href={/^https:\/\/ipn\.eg\//i.test(config.instapayLink) ? config.instapayLink : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="block min-w-0 max-w-full rounded-xl bg-pink-50 border border-pink-200 p-3 text-center text-sm font-bold text-pink-700 hover:bg-pink-100 active:scale-[0.99] transition break-all"
                dir="ltr"
                aria-label="فتح رابط InstaPay للتحويل"
              >
                تحويل مباشر عبر InstaPay ↗
              </a>
            )}
          </div>
        )}

        {user?.status !== 'active' && (
          <form onSubmit={activateWithCode} className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-right space-y-3">
            <p className="text-sm font-bold text-slate-700">بعد التحويل، ابعت صورة الإيصال للمسؤول على واتساب. هيراجع الدفع ويبعتلك كود التفعيل.</p>
            <label htmlFor="activation-code" className="block text-sm font-bold text-slate-700">أدخل كود التفعيل اللي وصلك</label>
            <input id="activation-code" type="text" inputMode="numeric" autoComplete="one-time-code" dir="ltr" required maxLength={32} value={activationCode} onChange={(event) => setActivationCode(event.target.value)} className="block min-w-0 w-full max-w-full box-border rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono" placeholder="كود التفعيل" />
            <button disabled={isActivating || !isOnline} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {isActivating ? 'جاري التفعيل...' : 'تفعيل الاشتراك بالكود'}
            </button>
            {paymentMessage && <p role="status" className="text-xs font-semibold text-slate-600">{paymentMessage}</p>}
          </form>
        )}

        {/* WhatsApp Action Button */}
        {config?.whatsappNumber && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full mb-3 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>إرسال صورة التحويل عبر واتساب</span>
          </a>
        )}

        {/* Refresh Status Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || !isOnline}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-colors mb-4"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>تحديث حالة التفعيل</span>
        </button>

        {/* Logout */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 text-right">
          <span className="min-w-0 max-w-full break-all">رقمك المسجل: {user?.phone}</span>
          <button
            onClick={logout}
            className="self-end sm:self-auto shrink-0 text-rose-700 hover:underline flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-3 py-2"
          >
            <LogOut className="w-3 h-3" />
            <span>تسجيل خروج</span>
          </button>
        </div>
      </div>
    </div>
  );
};
