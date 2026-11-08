'use client';

import React, { useState, useEffect } from 'react';
import { db, Debt, WalletAccount } from '@/lib/db';
import { HandCoins, Plus, CheckCircle2, Clock, Trash2, ArrowRight, Pencil } from 'lucide-react';
import { AddDebtModal } from '../modals/AddDebtModal';
import { askForConfirmation } from '@/lib/confirm-action';

export const DebtsView: React.FC = () => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [activeTab, setActiveTab] = useState<'to_me' | 'on_me'>('to_me');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [debtToEdit, setDebtToEdit] = useState<Debt | null>(null);
  const [paymentModalDebt, setPaymentModalDebt] = useState<Debt | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [paymentWalletId, setPaymentWalletId] = useState('');

  const loadDebts = async () => {
    const list = await db.debts.toArray();
    setDebts(list);
    const walletList = await db.wallets.toArray();
    setWallets(walletList);
    if (walletList.length && !walletList.some((wallet) => String(wallet.id) === paymentWalletId)) {
      setPaymentWalletId(String(walletList[0].id));
    }
  };

  useEffect(() => {
    loadDebts();
  }, []);

  const filteredDebts = debts.filter((d) => d.type === activeTab);

  const totalToMeRemaining = debts
    .filter((d) => d.type === 'to_me' && !d.isCompleted)
    .reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0);

  const totalOnMeRemaining = debts
    .filter((d) => d.type === 'on_me' && !d.isCompleted)
    .reduce((s, d) => s + (d.totalAmount - d.paidAmount), 0);

  const handleDelete = async (id?: number) => {
    if (id === undefined) return;
    const debt = debts.find((item) => item.id === id);
    if (!debt) return;
    const confirmed = await askForConfirmation({
      title: 'تأكيد حذف الدين',
      message: 'هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن الحذف.',
      itemName: `${debt.personName} · ${debt.totalAmount.toLocaleString('ar-EG')} ج.م`,
    });
    if (!confirmed) return;
    await db.debts.delete(id);
    loadDebts();
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalDebt || !paymentModalDebt.id) return;

    const payment = parseFloat(paymentAmountInput);
    const remaining = Math.max(0, paymentModalDebt.totalAmount - paymentModalDebt.paidAmount);
    if (isNaN(payment) || payment <= 0 || payment > remaining) {
      alert('يرجى كتابة مبلغ صحيح');
      return;
    }

    const selectedWallet = wallets.find((wallet) => String(wallet.id) === paymentWalletId);
    if (!selectedWallet?.id) {
      alert('أضف مكانًا للأموال من الصفحة الرئيسية أولًا');
      return;
    }

    const newPaid = paymentModalDebt.paidAmount + payment;
    const isCompleted = newPaid >= paymentModalDebt.totalAmount;

    await db.transaction('rw', [db.debts, db.transactions, db.wallets], async () => {
      await db.debts.update(paymentModalDebt.id!, { paidAmount: newPaid, isCompleted });
      if (paymentModalDebt.type === 'to_me') {
        await db.transactions.add({
        type: 'income',
        amount: payment,
        category: 'استرداد سلفة أو دين',
        note: `سداد من ${paymentModalDebt.personName}`,
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
        walletId: selectedWallet.id,
      });
      } else {
        await db.transactions.add({
        type: 'expense',
        amount: payment,
        category: 'أقساط ومستحقات',
        note: `سداد دين لـ ${paymentModalDebt.personName}`,
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
        walletId: selectedWallet.id,
      });
      }
      await db.wallets.update(selectedWallet.id!, {
        balance: selectedWallet.balance + (paymentModalDebt.type === 'to_me' ? payment : -payment),
      });
    });

    setPaymentModalDebt(null);
    setPaymentAmountInput('');
    loadDebts();
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-800">قسم "ليّا وعليّا"</h2>
          <p className="text-xs text-slate-500">تتبع السلف والديون والأقساط حتى لا تنسى أي مليم</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة التزام / دين جديد</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 gap-3">
        <div
          onClick={() => setActiveTab('to_me')}
          className={`p-4 rounded-3xl border cursor-pointer transition-all ${
            activeTab === 'to_me'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs text-emerald-700 font-bold mb-1">فلوس ليّا عند الناس</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-800">
            {totalToMeRemaining.toLocaleString('ar-EG')} ج.م
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">سلف مستحق لك</div>
        </div>

        <div
          onClick={() => setActiveTab('on_me')}
          className={`p-4 rounded-3xl border cursor-pointer transition-all ${
            activeTab === 'on_me'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xs text-rose-700 font-bold mb-1">ديون ومستحقات عليّا</div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-800">
            {totalOnMeRemaining.toLocaleString('ar-EG')} ج.م
          </div>
          <div className="text-[11px] text-rose-600 mt-1">واجبة السداد</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('to_me')}
          className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
            activeTab === 'to_me'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          فلوس ليّا ({debts.filter((d) => d.type === 'to_me').length})
        </button>
        <button
          onClick={() => setActiveTab('on_me')}
          className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
            activeTab === 'on_me'
              ? 'bg-white text-rose-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          ديون عليّا ({debts.filter((d) => d.type === 'on_me').length})
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredDebts.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200">
            <HandCoins className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">لا توجد سجلات مسجلة في هذا القسم</div>
            <p className="text-xs text-slate-400 mt-1">
              اضغط على "إضافة التزام / دين جديد" لتسجيل سلفة أو دين.
            </p>
          </div>
        ) : (
          filteredDebts.map((item) => {
            const remaining = Math.max(item.totalAmount - item.paidAmount, 0);
            const progress = Math.min(Math.round((item.paidAmount / item.totalAmount) * 100), 100);

            return (
              <div
                key={item.id}
                className={`bg-white rounded-3xl p-5 border transition-all ${
                  item.isCompleted
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                        {item.personName}
                      </h3>
                      {item.isCompleted ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>مسدد بالكامل</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>جاري السداد</span>
                        </span>
                      )}
                    </div>
                    {item.note && <div className="text-xs text-slate-500 mt-0.5">{item.note}</div>}
                    {item.dueDate && (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        تاريخ الاستحقاق المتوقع: {item.dueDate}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!item.isCompleted && (
                      <button
                        onClick={() => {
                          setPaymentModalDebt(item);
                          setPaymentAmountInput(remaining.toString());
                        }}
                        className="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs border border-brand-200 transition-colors"
                      >
                        تسجيل دفعة سداد
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDebtToEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                      title="تعديل البيانات"
                      aria-label={`تعديل بيانات ${item.personName}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress & Amounts */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex justify-between items-baseline text-xs font-medium mb-1.5">
                    <span className="text-slate-500">
                      تم سداد: {item.paidAmount.toLocaleString('ar-EG')} من أصل{' '}
                      {item.totalAmount.toLocaleString('ar-EG')} ج.م
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        item.isCompleted ? 'text-emerald-600' : 'text-slate-800'
                      }`}
                    >
                      {item.isCompleted
                        ? 'خالص ✓'
                        : `المتبقي: ${remaining.toLocaleString('ar-EG')} ج.م`}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.isCompleted ? 'bg-emerald-500' : 'bg-brand-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Debt Modal */}
      <AddDebtModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadDebts}
        initialType={activeTab}
      />

      <AddDebtModal
        isOpen={debtToEdit !== null}
        onClose={() => setDebtToEdit(null)}
        onSaved={loadDebts}
        initialDebt={debtToEdit}
      />

      {/* Partial Payment Modal */}
      {paymentModalDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-800 mb-1">تسجيل دفعة سداد</h3>
            <p className="text-xs text-slate-500 mb-4">
              {paymentModalDebt.type === 'to_me'
                ? `استلام دفعة من: ${paymentModalDebt.personName}`
                : `سداد دفعة إلى: ${paymentModalDebt.personName}`}
            </p>

            <form onSubmit={handleRegisterPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">المبلغ المسدد الآن (جنيه)</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  autoFocus
                  placeholder="المبلغ"
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-lg font-bold text-slate-800 text-center dir-ltr focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  {paymentModalDebt.type === 'to_me' ? 'إضافة المبلغ إلى' : 'الخصم من'}
                </label>
                <select required value={paymentWalletId} onChange={(event) => setPaymentWalletId(event.target.value)} disabled={!wallets.length} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold disabled:bg-slate-100">
                  {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.balance.toLocaleString('ar-EG')} ج.م</option>)}
                </select>
                {!wallets.length && <p className="mt-1 text-[11px] text-rose-600">أضف مكانًا للأموال من الصفحة الرئيسية أولًا.</p>}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!wallets.length}
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm"
                >
                  تأكيد وحفظ المعاملة
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentModalDebt(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
