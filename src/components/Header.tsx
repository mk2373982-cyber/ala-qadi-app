'use client';

import React from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { Wifi, WifiOff, Plus, LogOut, ShieldCheck, User } from 'lucide-react';

interface HeaderProps {
  onOpenAddModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAddModal }) => {
  const { user, isOnline, logout, isLicenseActive, daysRemaining, trialMinutesRemaining } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-900/10 bg-white/95 shadow-[0_8px_24px_-20px_rgba(6,78,59,0.6)] backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-[68px] min-w-0 max-w-5xl items-center justify-between gap-2 px-2.5 sm:h-[76px] sm:px-4">
        {/* Brand Logo & Name */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          <div className="shrink-0 rounded-[15px] bg-gradient-to-br from-emerald-400 to-emerald-800 p-[2px] shadow-md shadow-emerald-900/15">
            <Image src="/icon-192.png" alt="أيقونة تطبيق على قدي" width={44} height={44} priority className="h-9 w-9 rounded-[13px] bg-white object-cover sm:h-11 sm:w-11" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="whitespace-nowrap text-[15px] font-black tracking-tight text-slate-900 sm:text-xl">على قدي</h1>
              <span className="hidden rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-800 sm:inline">
                محلي وخاص
              </span>
            </div>
            <p className="hidden truncate text-[10px] text-slate-500 sm:block">إدارتك المالية بكل سهولة وخصوصية</p>
          </div>
        </div>

        {/* Status Indicators & Actions */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Online/Offline status pill */}
          <div
            className={`flex h-8 shrink-0 items-center gap-1 rounded-xl border px-1.5 text-[10px] font-bold sm:px-2 ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={isOnline ? 'متصل بالشبكة' : 'يعمل أوفلاين (البيانات محفوظة على جهازك)'}
          >
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span className="hidden lg:inline">{isOnline ? 'متصل' : 'أوفلاين'}</span>
          </div>

          {/* License Status Badge */}
          {user && isLicenseActive && (
            <div className="flex h-8 max-w-[82px] shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1.5 text-[9px] font-bold text-slate-700 sm:max-w-none sm:px-2 sm:text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
              {user.isTrial ? (
                <span className="whitespace-nowrap">تجربة {trialMinutesRemaining !== null ? `${Math.floor(trialMinutesRemaining / 60)}س ${trialMinutesRemaining % 60}د` : '48 ساعة'}</span>
              ) : <>
                <span className="hidden sm:inline">
                  {daysRemaining === null ? 'مدى الحياة' : `متبقي ${daysRemaining} يوم`}
                </span>
                <span className="sm:hidden whitespace-nowrap">
                  {daysRemaining === null ? 'دائم' : `${daysRemaining} يوم`}
                </span>
              </>}
            </div>
          )}

          {/* Quick Add Button */}
          {isLicenseActive && (
            <button
              onClick={onOpenAddModal}
              aria-label="تسجيل معاملة"
              className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 px-2.5 text-white shadow-md shadow-emerald-900/15 transition hover:from-emerald-700 hover:to-emerald-900 active:scale-95 sm:px-3"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden md:inline text-[11px] font-bold">تسجيل</span>
            </button>
          )}

          {/* User Profile / Logout */}
          {user && (
            <>
            {user.isTrial && (
              <button
                onClick={() => {
                  try { sessionStorage.setItem('ala_qaddi_open_registration', '1'); } catch {}
                  logout();
                }}
                title="إنشاء حساب والاحتفاظ ببيانات هذا الجهاز"
                aria-label="إنشاء حساب"
                className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 text-emerald-900 transition hover:bg-emerald-100 sm:px-2.5"
              >
                <User className="h-4 w-4" />
                <span className="hidden lg:inline text-[11px] font-bold">إنشاء حساب</span>
              </button>
            )}
            <button
              onClick={() => {
                logout();
              }}
              title={`تسجيل خروج (${user.name})`}
              aria-label="تسجيل الخروج"
              className="flex h-9 shrink-0 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline text-[11px] font-bold">خروج</span>
            </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
