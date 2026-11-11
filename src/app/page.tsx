'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { seedDefaultCategoriesIfEmpty } from '@/lib/db';
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
import { Plus } from 'lucide-react';

export default function Home() {
  const { user, isLoading, isLicenseActive, daysRemaining } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const isRegisteredTrial = Boolean(user?.isTrial && !user.trialExpiresAt && user.startDate);
  const offerDeadline = isRegisteredTrial ? new Date(user!.startDate!) : null;
  if (offerDeadline) offerDeadline.setDate(offerDeadline.getDate() + 10);
  const isAnnualOfferOpen = Boolean(offerDeadline && Date.now() <= offerDeadline.getTime());

  useEffect(() => {
    installDriveBackupHooks();
    seedDefaultCategoriesIfEmpty();
  }, []);

  useEffect(() => {
    void setDriveBackupUserId(user?.id || null);
  }, [user?.id]);

  const handleTransactionSaved = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="app-theme min-h-screen bg-[#f3f8f4] flex items-center justify-center p-4">
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
    <div className="app-theme min-h-screen bg-[#f3f8f4] flex flex-col selection:bg-brand-200 selection:text-brand-900">
      <Header onOpenAddModal={() => setIsAddModalOpen(true)} />
      <Navigation currentTab={currentTab} onSelectTab={setCurrentTab} />

      {isRegisteredTrial && daysRemaining !== null && (
        <aside className={`mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-5xl flex-col gap-2 rounded-2xl border p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${daysRemaining <= 5 ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}>
          <div>
            <p className="text-sm font-black">{daysRemaining <= 5 ? `باقي ${daysRemaining} ${daysRemaining === 1 ? 'يوم' : 'أيام'} على انتهاء الشهر المجاني` : `أنت في الشهر المجاني — باقي ${daysRemaining} يوم`}</p>
            <p className="mt-1 text-[11px] leading-5">{isAnnualOfferOpen ? `ادفع للاشتراك السنوي قبل ${offerDeadline?.toLocaleDateString('ar-EG')} واحصل على نصف السعر.` : `انتهت مهلة خصم السنوي. إذا كان الدفع تم خلال أول ١٠ أيام، أرسل الإيصال للمسؤول.`} بياناتك المالية محفوظة على جهازك.</p>
          </div>
          <button type="button" onClick={() => setCurrentTab('settings')} className="shrink-0 self-start rounded-xl bg-white/80 px-3 py-2 text-xs font-black shadow-sm sm:self-auto">تفاصيل الاشتراك</button>
        </aside>
      )}

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            key={`dash_${refreshKey}`}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onNavigate={setCurrentTab}
          />
        )}
        {currentTab === 'transactions' && (
          <TransactionsView
            key={`tx_${refreshKey}`}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        )}
        {currentTab === 'debts' && <DebtsView key={`debts_${refreshKey}`} />}
        {currentTab === 'gam3eya_gold' && <Gam3eyaGoldView key={`gold_${refreshKey}`} />}
        {currentTab === 'budget_reports' && <BudgetReportsView key={`budget_${refreshKey}`} />}
        {currentTab === 'settings' && <SettingsView key={`settings_${refreshKey}`} />}
      </main>

      {/* Floating Action Button (FAB) for Mobile Quick Add */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="md:hidden fixed bottom-20 left-4 z-40 w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-500 text-white shadow-lg shadow-brand-600/30 flex items-center justify-center active:scale-90 transition-transform"
        title="تسجيل معاملة سريعة"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Global Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSaved={handleTransactionSaved}
      />
    </div>
  );
}
