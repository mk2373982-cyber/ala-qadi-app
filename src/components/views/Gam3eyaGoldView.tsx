'use client';

import React, { useState, useEffect } from 'react';
import { db, Gam3eya, SavingsAsset, WalletAccount } from '@/lib/db';
import { Users, Landmark, Plus, Trash2, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { AddGam3eyaModal } from '../modals/AddGam3eyaModal';
import { AddSavingsModal } from '../modals/AddSavingsModal';
import { askForConfirmation } from '@/lib/confirm-action';
import { getLocalDateString } from '@/lib/recurring-transactions';

export const Gam3eyaGoldView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'gam3eya' | 'gold'>('gam3eya');
  const [gam3eyat, setGam3eyat] = useState<Gam3eya[]>([]);
  const [savings, setSavings] = useState<SavingsAsset[]>([]);
  const [isGam3eyaModalOpen, setIsGam3eyaModalOpen] = useState(false);
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [walletAction, setWalletAction] = useState<{
    group: Gam3eya;
    kind: 'pay' | 'collect';
  } | null>(null);
  const [groupWalletId, setGroupWalletId] = useState('');

  const loadData = async () => {
    const gList = await db.gam3eyat.toArray();
    setGam3eyat(gList);
    const sList = await db.savings.toArray();
    setSavings(sList);
    const walletList = await db.wallets.toArray();
    setWallets(walletList);
    if (walletList.length && !walletList.some((wallet) => String(wallet.id) === groupWalletId))
      setGroupWalletId(String(walletList[0].id));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteGam3eya = async (id?: number) => {
    if (id === undefined) return;
    const group = gam3eyat.find((item) => item.id === id);
    if (!group) return;
    const confirmed = await askForConfirmation({
      title: 'تأكيد حذف الجمعية',
      message: 'هل أنت متأكد من حذف الجمعية؟ لا يمكن التراجع عن الحذف.',
      itemName: group.name,
    });
    if (!confirmed) return;
    await db.gam3eyat.delete(id);
    loadData();
  };

  const handleDeleteSavings = async (id?: number) => {
    if (id === undefined) return;
    const asset = savings.find((item) => item.id === id);
    if (!asset) return;
    const confirmed = await askForConfirmation({
      title: 'تأكيد حذف الأصل',
      message: 'هل أنت متأكد من حذف هذا الأصل؟ لا يمكن التراجع عن الحذف.',
      itemName: asset.name,
    });
    if (!confirmed) return;
    await db.savings.delete(id);
    loadData();
  };

  // Pay monthly installment for a Gam3eya
  const handlePayInstallment = async (g: Gam3eya, wallet: WalletAccount) => {
    if (!g.id) return;
    if (g.paidMonths >= g.totalMonths) {
      alert('تم سداد كافة شهور الجمعية بالفعل!');
      return;
    }

    const nextPaid = g.paidMonths + 1;
    const isCompleted = nextPaid >= g.totalMonths;

    await db.transaction('rw', [db.gam3eyat, db.transactions, db.wallets], async () => {
      await db.gam3eyat.update(g.id!, {
        paidMonths: nextPaid,
        lastInstallmentPaidMonth: getLocalDateString().slice(0, 7),
        lastInstallmentSkippedMonth: undefined,
        status: isCompleted ? 'completed' : 'active',
      });
      await db.transactions.add({
        type: 'expense',
        amount: g.monthlyAmount,
        category: 'جمعيات شهرية',
        note: `قسط شهر (${nextPaid} من ${g.totalMonths}) - ${g.name}`,
        date: getLocalDateString(),
        createdAt: Date.now(),
        walletId: wallet.id,
      });
      await db.wallets.update(wallet.id!, { balance: wallet.balance - g.monthlyAmount });
    });

    loadData();
  };

  // Mark Gam3eya as collected (قبض الدور)
  const handleCollectGam3eya = async (g: Gam3eya, wallet: WalletAccount) => {
    if (!g.id) return;
    const totalPayout = g.monthlyAmount * g.totalMonths;

    await db.transaction('rw', [db.gam3eyat, db.transactions, db.wallets], async () => {
      await db.gam3eyat.update(g.id!, { isCollected: true });
      await db.transactions.add({
        type: 'income',
        amount: totalPayout,
        category: 'قبض جمعية',
        note: `قبض دور جمعية: ${g.name}`,
        date: getLocalDateString(),
        createdAt: Date.now(),
        walletId: wallet.id,
      });
      await db.wallets.update(wallet.id!, { balance: wallet.balance + totalPayout });
    });

    loadData();
  };

  const confirmWalletAction = async () => {
    if (!walletAction) return;
    const wallet = wallets.find((item) => String(item.id) === groupWalletId);
    if (!wallet) return;
    if (walletAction.kind === 'pay') await handlePayInstallment(walletAction.group, wallet);
    else await handleCollectGam3eya(walletAction.group, wallet);
    setWalletAction(null);
  };

  // Calculations for Gold & Savings
  const gold21Grams = savings
    .filter((s) => s.type === 'gold_21')
    .reduce((sum, s) => sum + s.quantity, 0);

  const gold24Grams = savings
    .filter((s) => s.type === 'gold_24')
    .reduce((sum, s) => sum + s.quantity, 0);

  const totalUSD = savings.filter((s) => s.type === 'usd').reduce((sum, s) => sum + s.quantity, 0);

  const totalSavingsEstimatedValue = savings.reduce((sum, s) => {
    const price = s.currentPricePerUnit || s.buyPricePerUnit || 0;
    return sum + s.quantity * price;
  }, 0);

  return (
    <div className="space-y-4 pb-16">
      {/* Top Header Card */}
      <div className="flex flex-col justify-between gap-3 px-1 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-900">جمعيات وذهب</h2>
        </div>

        <div className="flex gap-2">
          {activeSection === 'gam3eya' ? (
            <button
              onClick={() => setIsGam3eyaModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة جمعية</span>
            </button>
          ) : (
            <button
              onClick={() => setIsSavingsModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة أصل / ذهب</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveSection('gam3eya')}
          className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeSection === 'gam3eya'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>الجمعيات الشهرية ({gam3eyat.length})</span>
        </button>
        <button
          onClick={() => setActiveSection('gold')}
          className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeSection === 'gold'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>محفظة الذهب والأصول ({savings.length})</span>
        </button>
      </div>

      {/* GAM3EYAT SECTION */}
      {activeSection === 'gam3eya' && (
        <div className="space-y-3">
          {gam3eyat.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-4 text-xs text-slate-600">
              <span>مفيش جمعيات مسجلة.</span>
              <button
                type="button"
                onClick={() => setIsGam3eyaModalOpen(true)}
                className="min-h-10 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
              >
                + إضافة جمعية
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-white px-4 divide-y divide-slate-100">
            {gam3eyat.map((g) => {
              const totalPayout = g.monthlyAmount * g.totalMonths;
              const progress = Math.min(Math.round((g.paidMonths / g.totalMonths) * 100), 100);

              return (
                <div
                  key={g.id}
                  className="space-y-3 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base">{g.name}</h3>
                        {g.isCollected ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            تم قبض دورك ✓
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            دورك الشهر رقم {g.myTurnMonth}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        القسط:{' '}
                        <span className="font-bold">
                          {g.monthlyAmount.toLocaleString('ar-EG')} ج.م
                        </span>{' '}
                        • الإجمالي المقبوض:{' '}
                        <span className="font-bold text-slate-800">
                          {totalPayout.toLocaleString('ar-EG')} ج.م
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDeleteGam3eya(g.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                        title="حذف الجمعية"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between items-baseline text-xs font-medium mb-1">
                      <span className="text-slate-500">
                        دفعت {g.paidMonths} من أصل {g.totalMonths} شهور
                      </span>
                      <span className="font-bold tabular-nums text-slate-700">{progress}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Quick Action buttons */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <button
                      onClick={() => setWalletAction({ group: g, kind: 'pay' })}
                      disabled={g.paidMonths >= g.totalMonths}
                      className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                    >
                      + سداد قسط هذا الشهر ({g.monthlyAmount} ج.م)
                    </button>

                    {!g.isCollected && (
                      <button
                        onClick={() => setWalletAction({ group: g, kind: 'collect' })}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors"
                      >
                        قبضت دوري الآن (+{totalPayout} ج.م)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* GOLD & ASSETS SECTION */}
      {activeSection === 'gold' && (
        <div className="space-y-4">
          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-white p-4 sm:grid-cols-4">
            <div>
              <div className="text-[11px] font-bold text-slate-500">ذهب عيار 21</div>
              <div className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                {gold21Grams} جرام
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500">سبائك عيار 24</div>
              <div className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                {gold24Grams} جرام
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500">دولار (USD)</div>
              <div className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                ${totalUSD.toLocaleString('ar-EG')}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500">القيمة التقديرية</div>
              <div className="mt-0.5 text-base font-bold tabular-nums text-slate-900">
                {totalSavingsEstimatedValue.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
          </div>

          {/* List of items */}
          <div>
            {savings.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-4 text-xs text-slate-600">
                <span>مفيش أصول مسجلة.</span>
                <button
                  type="button"
                  onClick={() => setIsSavingsModalOpen(true)}
                  className="min-h-10 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  + إضافة أصل
                </button>
              </div>
            ) : (
              savings.map((s) => {
                const price = s.currentPricePerUnit || s.buyPricePerUnit || 0;
                const value = s.quantity * price;
                const unit = s.type === 'usd' ? 'دولار' : s.type === 'cash_cert' ? 'جنيه' : 'جرام';

                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                        {s.type === 'gold_21'
                          ? '21'
                          : s.type === 'gold_24'
                            ? '24'
                            : s.type === 'usd'
                              ? '$'
                              : 'ش'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{s.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          الكمية:{' '}
                          <span className="font-bold tabular-nums text-slate-700">
                            {s.quantity} {unit}
                          </span>
                          {s.buyPricePerUnit > 0 && (
                            <span>
                              {' '}
                              • الشراء: {s.buyPricePerUnit.toLocaleString('ar-EG')} للـ {unit}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <div className="text-sm font-bold tabular-nums text-slate-900 sm:text-base">
                          {value.toLocaleString('ar-EG')} ج.م
                        </div>
                        <div className="text-[10px] text-slate-400">القيمة المقدرة</div>
                      </div>
                      <button
                        onClick={() => handleDeleteSavings(s.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <AddGam3eyaModal
        isOpen={isGam3eyaModalOpen}
        onClose={() => setIsGam3eyaModalOpen(false)}
        onSaved={loadData}
      />
      <AddSavingsModal
        isOpen={isSavingsModalOpen}
        onClose={() => setIsSavingsModalOpen(false)}
        onSaved={loadData}
      />
      {walletAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setWalletAction(null);
          }}
        >
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-base font-black text-slate-800">اختيار مكان الحركة</h3>
            <p className="text-xs text-slate-500">
              {walletAction.kind === 'pay'
                ? 'من أين دفعت قسط الجمعية؟'
                : 'أين أضفت مبلغ قبض الجمعية؟'}
            </p>
            {wallets.length ? (
              <select
                value={groupWalletId}
                onChange={(event) => setGroupWalletId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name} · {wallet.balance.toLocaleString('ar-EG')} ج.م
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                أضف مكانًا للأموال من الصفحة الرئيسية أولًا.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!wallets.length}
                onClick={confirmWalletAction}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                تأكيد وتحديث الرصيد
              </button>
              <button
                type="button"
                onClick={() => setWalletAction(null)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
