'use client';

import React from 'react';
import { ArrowLeftRight, HandCoins, Home, Landmark, PieChart } from 'lucide-react';

export type TabType =
  | 'dashboard'
  | 'transactions'
  | 'debts'
  | 'gam3eya_gold'
  | 'budget_reports'
  | 'settings';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

const mainTabs = [
  { id: 'dashboard', label: 'الرئيسية', icon: Home },
  { id: 'transactions', label: 'المعاملات', icon: ArrowLeftRight },
  { id: 'debts', label: 'ليّا وعليّا', icon: HandCoins },
  { id: 'gam3eya_gold', label: 'جمعيات وذهب', icon: Landmark },
  { id: 'budget_reports', label: 'التقارير', icon: PieChart },
] as const satisfies ReadonlyArray<{ id: TabType; label: string; icon: typeof Home }>;

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => (
  <>
    <nav
      aria-label="التنقل الرئيسي"
      className="hidden border-b border-slate-200/70 bg-white md:block"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-pressed={isActive}
              className={`relative flex min-h-12 items-center gap-2 px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700 ${
                isActive
                  ? 'text-emerald-800 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-emerald-600'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>

    <nav
      aria-label="التنقل الرئيسي"
      className="floating-navigation fixed inset-x-3 bottom-[calc(0.65rem_+_env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl rounded-full border border-white/90 bg-white/90 shadow-[0_20px_30px_-16px_rgba(15,23,42,0.18)] backdrop-blur-xl md:hidden"
    >
      <div className="flex min-h-[4.1rem] items-stretch px-1.5 py-1">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-pressed={isActive}
              className={`relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700 ${
                isActive ? 'text-emerald-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`flex h-8 w-10 items-center justify-center rounded-full transition-all duration-200 ${
                  isActive ? 'scale-105 bg-emerald-100 text-emerald-900' : 'text-current'
                }`}
              >
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="max-w-full truncate text-[9px] font-bold min-[390px]:text-[10px]">
                {tab.label}
              </span>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1/3 top-0 h-0.5 rounded-full bg-emerald-600 transition-all duration-200"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  </>
);
