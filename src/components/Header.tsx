'use client';

import React from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { Settings, Wifi, WifiOff } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  isSettingsActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings, isSettingsActive = false }) => {
  const { isOnline } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 min-w-0 max-w-5xl items-center justify-between gap-3 px-4 sm:h-[72px]">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image
            src="/icon-192.png"
            alt=""
            width={40}
            height={40}
            priority
            className="h-10 w-10 shrink-0 rounded-xl object-cover"
          />
          <h1 className="whitespace-nowrap text-base font-black tracking-tight text-slate-900 sm:text-lg">
            على قدي
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div
            role="status"
            aria-label={isOnline ? 'التطبيق متصل بالإنترنت' : 'التطبيق يعمل دون اتصال'}
            title={isOnline ? 'متصل بالإنترنت' : 'يعمل دون اتصال'}
            className={`flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-bold ${
              isOnline
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {isOnline ? (
              <Wifi aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <WifiOff aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{isOnline ? 'متصل' : 'أوفلاين'}</span>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="الإعدادات"
            aria-current={isSettingsActive ? 'page' : undefined}
            title="الإعدادات"
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
              isSettingsActive
                ? 'bg-emerald-100 text-emerald-900'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Settings aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
