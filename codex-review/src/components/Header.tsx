'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Wifi, WifiOff, Plus, LogOut, ShieldCheck, User } from 'lucide-react';

interface HeaderProps {
  onOpenAddModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAddModal }) => {
  const { user, isOnline, logout, isLicenseActive, daysRemaining } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm transition-all">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <span className="font-extrabold text-lg">قـ</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-xl text-slate-800 tracking-tight">على قدي</h1>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-100 text-brand-800">
                محلي وخاص
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">إدارتك المالية بكل سهولة وخصوصية</p>
          </div>
        </div>

        {/* Status Indicators & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Online/Offline status pill */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={isOnline ? 'متصل بالشبكة' : 'يعمل أوفلاين (البيانات محفوظة على جهازك)'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isOnline ? 'متصل' : 'أوفلاين'}</span>
          </div>

          {/* License Status Badge */}
          {user && isLicenseActive && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>
                {daysRemaining === null ? 'مدى الحياة' : `متبقي ${daysRemaining} يوم`}
              </span>
            </div>
          )}

          {/* Quick Add Button */}
          {isLicenseActive && (
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-medium text-xs sm:text-sm shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل معاملة</span>
            </button>
          )}

          {/* User Profile / Logout */}
          {user && (
            <button
              onClick={() => {
                logout();
              }}
              title={`تسجيل خروج (${user.name})`}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 hover:border-rose-200 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
