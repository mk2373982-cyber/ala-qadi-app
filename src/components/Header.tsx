'use client';

import React from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { Bell, Settings, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  isSettingsActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenNotifications,
  onOpenSettings,
  isSettingsActive = false,
}) => {
  const { isOnline } = useAuth();

  return (
    <header className="stitch-header fixed inset-x-3 top-[calc(0.75rem_+_env(safe-area-inset-top))] z-40 mx-auto flex w-[calc(100%-1.5rem)] max-w-md items-center justify-between gap-2">
      <div className="stitch-brand-capsule flex min-w-0 items-center gap-2.5 rounded-full border border-slate-200/80 bg-white/90 py-1.5 pl-3 pr-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.06)] backdrop-blur-xl">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/20">
          <Image
            src="/icon-192.png"
            alt=""
            width={36}
            height={36}
            unoptimized
            priority
            className="h-9 w-9 rounded-full object-cover"
          />
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 leading-none">
            <h1 className="whitespace-nowrap text-sm font-black tracking-tight text-slate-900">
              على قدي
            </h1>
          </div>
          <div
            role="status"
            aria-label={isOnline ? 'التطبيق متصل بالإنترنت' : 'التطبيق يعمل دون اتصال'}
            className={`mt-1 flex items-center gap-1 text-[9px] font-semibold ${
              isOnline ? 'text-emerald-800' : 'text-amber-800'
            }`}
          >
            {isOnline ? (
              <Wifi aria-hidden="true" className="h-3 w-3" />
            ) : (
              <WifiOff aria-hidden="true" className="h-3 w-3" />
            )}
            <span>{isOnline ? 'متصل' : 'دون إنترنت'}</span>
          </div>
        </div>
      </div>

      <div className="stitch-actions-capsule flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200/80 bg-white/90 p-1 shadow-[0_8px_20px_rgba(0,0,0,0.06)] backdrop-blur-xl">
        <button
          type="button"
          onClick={onOpenNotifications}
          aria-label="التنبيهات والاستحقاقات القادمة"
          title="التنبيهات"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          <Bell aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
        <span aria-hidden="true" className="h-4 w-px bg-slate-200" />
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="الإعدادات"
          aria-current={isSettingsActive ? 'page' : undefined}
          title="الإعدادات"
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
            isSettingsActive
              ? 'bg-emerald-100 text-emerald-900'
              : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
          }`}
        >
          <Settings aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
};
