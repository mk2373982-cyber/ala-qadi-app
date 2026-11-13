'use client';

import React from 'react';
import { Home, ArrowLeftRight, HandCoins, Landmark, PieChart, Settings } from 'lucide-react';

export type TabType =
  'dashboard' | 'transactions' | 'debts' | 'gam3eya_gold' | 'budget_reports' | 'settings';

interface NavigationProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentTab, onSelectTab }) => {
  const tabs = [
    { id: 'dashboard' as TabType, label: 'الرئيسية', icon: Home },
    { id: 'transactions' as TabType, label: 'المعاملات', icon: ArrowLeftRight },
    { id: 'debts' as TabType, label: 'ليّا وعليّا', icon: HandCoins },
    { id: 'gam3eya_gold' as TabType, label: 'جمعيات وذهب', icon: Landmark },
    { id: 'budget_reports' as TabType, label: 'التقارير', icon: PieChart },
    { id: 'settings' as TabType, label: 'الإعدادات', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Navigation (Sub-header) */}
      <nav
        aria-label="التنقل الرئيسي"
        className="hidden md:block bg-white border-b border-slate-300"
      >
        <div className="max-w-5xl mx-auto px-4 flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-700 ${
                  isActive
                    ? 'border-brand-700 text-brand-900 bg-brand-100 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon
                  aria-hidden="true"
                  className={`w-4 h-4 ${isActive ? 'text-brand-700' : 'text-slate-500'}`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Navigation directly below the sticky header */}
      <nav
        aria-label="التنقل الرئيسي"
        className="md:hidden sticky top-[68px] z-20 overflow-x-auto bg-white border-b border-slate-300 shadow-sm"
      >
        <div className="flex min-w-full w-max items-center justify-between py-1.5 px-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                aria-pressed={isActive}
                className={`flex min-w-[70px] flex-1 flex-col items-center justify-center rounded-xl py-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-700 ${
                  isActive ? 'text-brand-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div
                  className={`p-1.5 rounded-xl ${
                    isActive ? 'bg-brand-100 text-brand-800 ring-1 ring-brand-300' : 'transparent'
                  }`}
                >
                  <Icon aria-hidden="true" className="w-5 h-5" />
                </div>
                <span className="mt-0.5 whitespace-nowrap px-0.5 text-[10px] font-semibold">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
