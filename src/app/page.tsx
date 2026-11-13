'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { installDriveBackupHooks, setDriveBackupUserId } from '@/lib/drive-backup';
import { Header } from '@/components/Header';
import { Navigation, TabType } from '@/components/Navigation';
import { AuthScreen } from '@/components/AuthScreen';
import { PendingScreen } from '@/components/PendingScreen';
import { DashboardView } from '@/components/views/DashboardView';
import { TransactionsView } from '@/components/views/TransactionsView';
import { DebtsView } from '@/components/views/DebtsView';
import { Gam3eyaGoldView } from '@/components/views/Gam3eyaGoldView';
import { BudgetReportsView } from '@/components/views/BudgetReportsView';
import { SettingsView } from '@/components/views/SettingsView';
import { AddTransactionModal } from '@/components/modals/AddTransactionModal';
import { OnboardingGuide } from '@/components/OnboardingGuide';
import { AddDebtModal } from '@/components/modals/AddDebtModal';
import { Plus } from 'lucide-react';

const SWIPE_NAV_TABS: TabType[] = [
  'dashboard',
  'transactions',
  'debts',
  'gam3eya_gold',
  'budget_reports',
];

export default function Home() {
  const { user, isLoading, isLicenseActive, daysRemaining } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [isDebtQuickAddOpen, setIsDebtQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'expense' | 'income'>('expense');
  const [saveMessage, setSaveMessage] = useState('');
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const isRegisteredTrial = Boolean(user?.isTrial && !user.trialExpiresAt && user.startDate);
  const offerDeadline = isRegisteredTrial ? new Date(user!.startDate!) : null;
  if (offerDeadline) offerDeadline.setDate(offerDeadline.getDate() + 10);
  const isAnnualOfferOpen = Boolean(offerDeadline && Date.now() <= offerDeadline.getTime());

  useEffect(() => {
    installDriveBackupHooks();
  }, [user?.id]);

  useEffect(() => {
    void setDriveBackupUserId(user?.id || null);
  }, [user?.id]);

  useEffect(() => {
    if (!user || (user.isTrial && user.trialExpiresAt)) return;
    const pendingKey = `ala_qaddi_onboarding_pending_${user.id}`;
    if (localStorage.getItem(pendingKey) === '1') setShowOnboarding(true);
  }, [user?.id, user?.isTrial, user?.trialExpiresAt]);

  const closeOnboarding = () => {
    if (user) {
      localStorage.removeItem(`ala_qaddi_onboarding_pending_${user.id}`);
      localStorage.setItem(`ala_qaddi_onboarding_seen_${user.id}`, '1');
    }
    setShowOnboarding(false);
  };

  const handleTransactionSaved = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleMainTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    swipeStart.current = null;
    if (
      !SWIPE_NAV_TABS.includes(currentTab) ||
      isAddModalOpen ||
      isDebtQuickAddOpen ||
      showQuickAdd
    ) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest(
        'input, select, textarea, [contenteditable="true"], [role="dialog"], [aria-modal="true"], [data-no-tab-swipe], table, [role="grid"], .recharts-wrapper, .overflow-x-auto, .overflow-x-scroll, [data-horizontal-scroll]',
      )
    ) {
      return;
    }

    let ancestor: HTMLElement | null = target as HTMLElement;
    while (ancestor && ancestor !== event.currentTarget) {
      const style = window.getComputedStyle(ancestor);
      const allowsHorizontalScroll = style.overflowX === 'auto' || style.overflowX === 'scroll';
      if (allowsHorizontalScroll && ancestor.scrollWidth > ancestor.clientWidth + 1) return;
      ancestor = ancestor.parentElement;
    }

    const touch = event.touches.item(0);
    if (touch) swipeStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleMainTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || !SWIPE_NAV_TABS.includes(currentTab)) return;

    const touch = event.changedTouches.item(0);
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) <= 60 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) return;

    const activeIndex = SWIPE_NAV_TABS.indexOf(currentTab);
    const nextIndex = activeIndex + (deltaX < 0 ? 1 : -1);
    if (nextIndex >= 0 && nextIndex < SWIPE_NAV_TABS.length) {
      setCurrentTab(SWIPE_NAV_TABS[nextIndex]);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="app-theme flex min-h-screen items-center justify-center bg-[#f8fafc] p-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 animate-spin mx-auto mb-3" />
          <div className="font-bold text-slate-700 text-sm">جاري فتح تطبيق "على قدي"...</div>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <AuthScreen />;
  }

  // Pending, suspended, or expired
  if (!isLicenseActive) {
    return <PendingScreen />;
  }

  // Active Licensed Application
  return (
    <div className="app-theme flex min-h-screen flex-col bg-[#f8fafc] selection:bg-emerald-100 selection:text-emerald-950">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-white px-4 py-3 font-bold text-emerald-950 focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        تخطي إلى المحتوى الرئيسي
      </a>
      <Header
        onOpenSettings={() => setCurrentTab('settings')}
        isSettingsActive={currentTab === 'settings'}
      />
      <Navigation currentTab={currentTab} onSelectTab={setCurrentTab} />

      {isRegisteredTrial && daysRemaining !== null && (
        <aside
          className={`mx-auto mt-2 flex w-[calc(100%-2rem)] max-w-5xl items-center justify-between gap-2 rounded-xl border px-3 py-2 ${daysRemaining <= 5 ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-black">
              {daysRemaining <= 5
                ? `باقي ${daysRemaining} ${daysRemaining === 1 ? 'يوم' : 'أيام'} على انتهاء الشهر المجاني`
                : `أنت في الشهر المجاني — باقي ${daysRemaining} يوم`}
            </p>
            <p className="mt-0.5 hidden text-[10px] leading-4 sm:block">
              {isAnnualOfferOpen
                ? `ادفع للاشتراك السنوي قبل ${offerDeadline?.toLocaleDateString('ar-EG')} واحصل على نصف السعر.`
                : `انتهت مهلة خصم السنوي. إذا كان الدفع تم خلال أول ١٠ أيام، أرسل الإيصال للمسؤول.`}{' '}
              بياناتك المالية محفوظة على جهازك.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentTab('settings')}
            className="shrink-0 rounded-lg bg-white px-3 py-2 text-[10px] font-black shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            تفاصيل الاشتراك
          </button>
        </aside>
      )}

      <main
        id="main-content"
        onTouchStart={handleMainTouchStart}
        onTouchEnd={handleMainTouchEnd}
        onTouchCancel={() => {
          swipeStart.current = null;
        }}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-4 pb-[calc(6rem_+_env(safe-area-inset-bottom))] sm:py-5 md:px-5 md:py-6 md:pb-8"
      >
        {currentTab === 'dashboard' && (
          <DashboardView
            key={`dash_${refreshKey}`}
            userId={user.id}
            userName={user.name}
            onOpenAddModal={() => setShowQuickAdd(true)}
            onNavigate={setCurrentTab}
          />
        )}
        {currentTab === 'transactions' && (
          <TransactionsView key={`tx_${refreshKey}`} onOpenAddModal={() => setShowQuickAdd(true)} />
        )}
        {currentTab === 'debts' && <DebtsView key={`debts_${refreshKey}`} />}
        {currentTab === 'gam3eya_gold' && <Gam3eyaGoldView key={`gold_${refreshKey}`} />}
        {currentTab === 'budget_reports' && <BudgetReportsView key={`budget_${refreshKey}`} />}
        {currentTab === 'settings' && (
          <SettingsView
            key={`settings_${refreshKey}`}
            onShowOnboarding={() => setShowOnboarding(true)}
          />
        )}
      </main>

      <button
        type="button"
        onClick={() => setShowQuickAdd(true)}
        aria-label="إضافة حركة مالية"
        title="إضافة حركة"
        className="fixed bottom-[calc(5.25rem_+_env(safe-area-inset-bottom))] left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 transition-colors hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:scale-95 md:bottom-7 md:left-7"
      >
        <Plus aria-hidden="true" className="h-6 w-6" />
      </button>

      {/* Global Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        initialType={quickAddType}
        onSaved={() => {
          handleTransactionSaved();
          setSaveMessage('تم حفظ الحركة وتحديث رصيد المكان.');
          window.setTimeout(() => setSaveMessage(''), 3200);
        }}
      />
      <AddDebtModal
        isOpen={isDebtQuickAddOpen}
        onClose={() => setIsDebtQuickAddOpen(false)}
        onSaved={() => {
          setRefreshKey((previous) => previous + 1);
          setSaveMessage('تم حفظ الدين.');
          window.setTimeout(() => setSaveMessage(''), 3200);
        }}
      />
      {showQuickAdd && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowQuickAdd(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-add-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setShowQuickAdd(false);
                return;
              }

              if (event.key !== 'Tab') return;
              const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
              );
              const first = focusable.item(0);
              const last = focusable.item(focusable.length - 1);
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5"
          >
            <h2 id="quick-add-title" className="text-lg font-black text-slate-900">
              إضافة حركة
            </h2>
            <p className="mt-1 text-xs text-slate-600">اختار نوع الحركة اللي عايز تسجلها.</p>
            <div className="mt-4 grid grid-cols-1 gap-2.5">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setQuickAddType('expense');
                  setShowQuickAdd(false);
                  setIsAddModalOpen(true);
                }}
                className="flex min-h-12 items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-900 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
              >
                <span>مصروف</span>
                <span aria-hidden="true">−</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickAddType('income');
                  setShowQuickAdd(false);
                  setIsAddModalOpen(true);
                }}
                className="flex min-h-12 items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-900 hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                <span>دخل</span>
                <span aria-hidden="true">+</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowQuickAdd(false);
                  setIsDebtQuickAddOpen(true);
                }}
                className="flex min-h-12 items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-950 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
              >
                <span>دين أو مبلغ مستحق</span>
                <span aria-hidden="true">↗</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowQuickAdd(false)}
              className="mt-3 min-h-11 w-full rounded-xl px-4 text-sm font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            >
              إلغاء
            </button>
          </section>
        </div>
      )}
      {saveMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(9rem_+_env(safe-area-inset-bottom))] left-3 right-3 z-[80] mx-auto max-w-md rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-bold text-white shadow-xl md:bottom-5"
        >
          {saveMessage}
        </div>
      )}
      {showOnboarding && <OnboardingGuide onClose={closeOnboarding} />}
    </div>
  );
}
