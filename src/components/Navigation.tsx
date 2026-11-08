'use client';

import React from 'react';
import { Home, ArrowLeftRight, HandCoins, Landmark, PieChart, Settings } from 'lucide-react';

export type TabType = 'dashboard' | 'transactions' | 'debts' | 'gam3eya_gold' | 'budget_reports' | 'settings';

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
      <nav className="hidden md:block bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 flex gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-4 font-medium text-sm border-b-2 transition-colors ${
                  isActive
                    ? 'border-brand-600 text-brand-700 bg-brand-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Navigation directly below the sticky header */}
      <div className="md:hidden sticky top-16 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="grid grid-cols-6 items-center py-1.5 px-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex flex-col items-center justify-center py-1 rounded-lg transition-all ${
                  isActive ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div
                  className={`p-1 rounded-full ${
                    isActive ? 'bg-brand-100/70 text-brand-700' : 'transparent'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-medium mt-0.5 truncate max-w-full px-0.5">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
