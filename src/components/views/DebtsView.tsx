'use client';

import React, { useEffect, useState } from 'react';
import { db, Debt, getDebtPaidAmount, getDebtRemainingAmount, WalletAccount } from '@/lib/db';
import {
  Check,
  CheckCircle2,
  Clock,
  HandCoins,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { AddDebtModal } from '../modals/AddDebtModal';
import { askForConfirmation } from '@/lib/confirm-action';

function normalizeWhatsAppPhone(phone?: string) {
  let digits = phone?.replace(/\D/g, '') ?? '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (/^01[0125]\d{8}$/.test(digits)) return `20${digits.slice(1)}`;
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.length >= 8 ? digits : '';
}

function formatDueDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(parsed);
}

export const DebtsView: React.FC = () => {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [activeTab, setActiveTab] = useState<'to_me' | 'on_me'>('on_me');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [debtToEdit, setDebtToEdit] = useState<Debt | null>(null);
  const [paymentModalDebt, setPaymentModalDebt] = useState<Debt | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [paymentWalletId, setPaymentWalletId] = useState('');
  const [recordPaymentTransaction, setRecordPaymentTransaction] = useState(true);
  const [paymentError, setPaymentError] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const loadDebts = async () => {
    const [debtList, walletList] = await Promise.all([db.debts.toArray(), db.wallets.toArray()]);
    setDebts(debtList);
    setWallets(walletList);
    setPaymentWalletId((currentId) =>
      walletList.some((wallet) => String(wallet.id) === currentId)
        ? currentId
        : walletList[0]?.id === undefined
          ? ''
          : String(walletList[0].id),
    );
  };

  useEffect(() => {
    void loadDebts();
  }, []);

  const filteredDebts = debts.filter((debt) => debt.type === activeTab);
  const totalToMeRemaining = debts
    .filter((debt) => debt.type === 'to_me')
    .reduce((sum, debt) => sum + getDebtRemainingAmount(debt), 0);
  const totalOnMeRemaining = debts
    .filter((debt) => debt.type === 'on_me')
    .reduce((sum, debt) => sum + getDebtRemainingAmount(debt), 0);

  const openPaymentModal = (debt: Debt, settleFully = false) => {
    setPaymentModalDebt(debt);
    setPaymentAmountInput(settleFully ? String(getDebtRemainingAmount(debt)) : '');
    setRecordPaymentTransaction(wallets.length > 0);
    setPaymentError('');
  };

  const closePaymentModal = () => {
    if (isSavingPayment) return;
    setPaymentModalDebt(null);
    setPaymentAmountInput('');
    setPaymentError('');
  };

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
    await loadDebts();
  };

  const handleRegisterPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paymentModalDebt?.id) return;

    const payment = Number(paymentAmountInput);
    const remaining = getDebtRemainingAmount(paymentModalDebt);
    if (!Number.isFinite(payment) || payment <= 0 || payment > remaining) {
      setPaymentError(
        `اكتب مبلغ أكبر من صفر ومايزيدش عن ${remaining.toLocaleString('ar-EG')} ج.م.`,
      );
      return;
    }
    if (recordPaymentTransaction && !paymentWalletId) {
      setPaymentError(
        'اختار مكان الفلوس اللي هتسجل عليه الدفعة، أو اقفل الاختيار لتحديث الدين بس.',
      );
      return;
    }

    setIsSavingPayment(true);
    setPaymentError('');
    try {
      const result = await db.transaction(
        'rw',
        [db.debts, db.transactions, db.wallets],
        async () => {
          const latestDebt = await db.debts.get(paymentModalDebt.id!);
          if (!latestDebt) return { ok: false as const, message: 'سجل الدين مش موجود.' };

          const latestRemaining = getDebtRemainingAmount(latestDebt);
          if (payment > latestRemaining) {
            return {
              ok: false as const,
              message: 'المبلغ المتبقي اتغير. راجع قيمة الدين وحاول تاني.',
            };
          }

          const selectedWallet = recordPaymentTransaction
            ? await db.wallets.get(Number(paymentWalletId))
            : undefined;
          if (recordPaymentTransaction && !selectedWallet?.id) {
            return {
              ok: false as const,
              message: 'مكان الفلوس المختار مش موجود. اختار مكان تاني أو سجّل الدفعة على الدين بس.',
            };
          }

          const newPaidAmount = getDebtPaidAmount(latestDebt) + payment;
          const newRemainingAmount = Math.max(0, latestDebt.totalAmount - newPaidAmount);
          await db.debts.update(paymentModalDebt.id!, {
            paidAmount: newPaidAmount,
            isCompleted: newRemainingAmount === 0,
          });

          if (selectedWallet?.id) {
            const isIncome = latestDebt.type === 'to_me';
            await db.transactions.add({
              type: isIncome ? 'income' : 'expense',
              amount: payment,
              category: isIncome ? 'استرداد سلفة أو دين' : 'أقساط ومستحقات',
              note: isIncome
                ? `سداد من ${latestDebt.personName}`
                : `سداد دين لـ ${latestDebt.personName}`,
              date: new Date().toISOString().slice(0, 10),
              createdAt: Date.now(),
              walletId: selectedWallet.id,
            });
            await db.wallets.update(selectedWallet.id, {
              balance: selectedWallet.balance + (isIncome ? payment : -payment),
            });
          }

          return { ok: true as const };
        },
      );

      if (!result.ok) {
        setPaymentError(result.message);
        return;
      }

      setStatusMessage(
        recordPaymentTransaction
          ? 'اتسجلت الدفعة واتحدّث رصيد المكان المالي.'
          : 'اتسجلت الدفعة على الدين من غير حركة مالية.',
      );
      setPaymentModalDebt(null);
      setPaymentAmountInput('');
      await loadDebts();
    } catch {
      setPaymentError(
        'حصلت مشكلة في حفظ الدفعة. بيانات الدين ورصيد المكان لسه زي ما كانوا. حاول تاني.',
      );
    } finally {
      setIsSavingPayment(false);
    }
  };

  return (
    <div className="space-y-4 pb-16">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-800">قسم «ليّا وعليّا»</h2>
          <p className="text-xs text-slate-500">
            تابع السلف والديون والأقساط واعرف المتبقي عليك وليك
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>إضافة التزام / دين جديد</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('to_me')}
          aria-pressed={activeTab === 'to_me'}
          className={`w-full rounded-3xl border p-4 text-right transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
            activeTab === 'to_me'
              ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-500/20 shadow-sm'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="mb-1 text-xs font-bold text-emerald-700">فلوس ليّا عند الناس</div>
          <div className="text-xl font-black tabular-nums text-emerald-800 sm:text-2xl">
            {totalToMeRemaining.toLocaleString('ar-EG')} ج.م
          </div>
          <div className="mt-1 text-[11px] text-emerald-600">المبلغ اللي لسه هيترد</div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('on_me')}
          aria-pressed={activeTab === 'on_me'}
          className={`w-full rounded-3xl border p-4 text-right transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 ${
            activeTab === 'on_me'
              ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-500/20 shadow-sm'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="mb-1 text-xs font-bold text-rose-700">ديون ومستحقات عليّا</div>
          <div className="text-xl font-black tabular-nums text-rose-800 sm:text-2xl">
            {totalOnMeRemaining.toLocaleString('ar-EG')} ج.م
          </div>
          <div className="mt-1 text-[11px] text-rose-600">المبلغ اللي لسه مطلوب سداده</div>
        </button>
      </div>

      <div className="flex rounded-2xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('to_me')}
          aria-pressed={activeTab === 'to_me'}
          className={`min-h-10 flex-1 rounded-xl text-xs font-bold transition-all sm:text-sm ${
            activeTab === 'to_me'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          فلوس ليّا ({debts.filter((debt) => debt.type === 'to_me').length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('on_me')}
          aria-pressed={activeTab === 'on_me'}
          className={`min-h-10 flex-1 rounded-xl text-xs font-bold transition-all sm:text-sm ${
            activeTab === 'on_me'
              ? 'bg-white text-rose-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          ديون عليّا ({debts.filter((debt) => debt.type === 'on_me').length})
        </button>
      </div>

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800"
        >
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage('')}
            className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100"
            aria-label="إخفاء رسالة تأكيد السداد"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="space-y-3">
        {filteredDebts.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
            <HandCoins className="mx-auto mb-2 h-10 w-10 text-slate-300" aria-hidden="true" />
            <div className="text-sm font-bold text-slate-700">مفيش سجلات في القسم ده</div>
            <p className="mt-1 text-xs text-slate-400">
              اضغط على «إضافة التزام / دين جديد» لتسجيل سلفة أو دين.
            </p>
          </div>
        ) : (
          filteredDebts.map((item) => {
            const paidAmount = getDebtPaidAmount(item);
            const remainingAmount = getDebtRemainingAmount(item);
            const isSettled = item.isCompleted || remainingAmount === 0;
            const progress =
              item.totalAmount > 0
                ? Math.min(Math.round((paidAmount / item.totalAmount) * 100), 100)
                : 0;
            const amountFormatter = new Intl.NumberFormat('ar-EG', {
              maximumFractionDigits: 2,
            });
            const reminderText = [
              `أهلاً ${item.personName}، يا رب تكون بخير 🌷`,
              `بفكرك بلطف إن باقي من المبلغ اللي عندك ${amountFormatter.format(remainingAmount)} ج.م.`,
              item.dueDate ? `وموعده ${formatDueDate(item.dueDate)}.` : '',
              'لما يناسبك ابقى طمني عليه، وشكرًا ليك 🙏',
            ]
              .filter(Boolean)
              .join(' ');
            const phone = normalizeWhatsAppPhone(item.phone);
            const reminderHref = `https://wa.me/${phone}?text=${encodeURIComponent(reminderText)}`;

            return (
              <article
                key={item.id}
                className={`rounded-3xl border bg-white p-4 transition-colors sm:p-5 ${
                  isSettled ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-slate-800 sm:text-base">
                        {item.personName}
                      </h3>
                      {isSettled ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          مسدد بالكامل
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          جاري السداد
                        </span>
                      )}
                    </div>
                    {item.note && <div className="mt-1 text-xs text-slate-500">{item.note}</div>}
                    {item.dueDate && (
                      <div className="mt-1 text-[11px] text-slate-400">
                        موعد السداد المتوقع: {formatDueDate(item.dueDate)}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDebtToEdit(item)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-brand-50 hover:text-brand-700"
                      aria-label={`تعديل بيانات ${item.personName}`}
                      title="تعديل البيانات"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.id)}
                      className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`حذف سجل ${item.personName}`}
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                    <span className="font-medium text-slate-600">
                      تم سداد{' '}
                      <b className="tabular-nums text-slate-800">
                        {amountFormatter.format(paidAmount)} ج.م
                      </b>
                    </span>
                    <span className="font-bold tabular-nums text-slate-800">
                      المتبقي {amountFormatter.format(remainingAmount)} ج.م
                    </span>
                  </div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label={`نسبة سداد دين ${item.personName}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        isSettled ? 'bg-emerald-500' : 'bg-brand-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {!isSettled && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openPaymentModal(item)}
                      className="min-h-10 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-100"
                    >
                      سداد جزئي
                    </button>
                    <button
                      type="button"
                      onClick={() => openPaymentModal(item, true)}
                      className="min-h-10 rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-700"
                    >
                      تسوية كاملة
                    </button>
                    {item.type === 'to_me' && remainingAmount > 0 && (
                      <a
                        href={reminderHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        تذكير واتساب
                      </a>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

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

      {paymentModalDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="partial-payment-title"
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <h3 id="partial-payment-title" className="text-base font-bold text-slate-800">
                تسجيل دفعة
              </h3>
              <button
                type="button"
                onClick={closePaymentModal}
                disabled={isSavingPayment}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="إغلاق نافذة السداد"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              {paymentModalDebt.type === 'to_me'
                ? `الدفعة المستلمة من ${paymentModalDebt.personName}`
                : `الدفعة المسددة إلى ${paymentModalDebt.personName}`}
              <span className="mt-1 block font-bold tabular-nums text-slate-700">
                المتبقي: {getDebtRemainingAmount(paymentModalDebt).toLocaleString('ar-EG')} ج.م
              </span>
            </p>

            <form onSubmit={handleRegisterPayment} className="space-y-4">
              <div>
                <label
                  htmlFor="debt-payment-amount"
                  className="mb-1 block text-xs font-bold text-slate-600"
                >
                  مبلغ الدفعة (جنيه)
                </label>
                <input
                  id="debt-payment-amount"
                  type="number"
                  step="any"
                  min="0.01"
                  max={getDebtRemainingAmount(paymentModalDebt)}
                  required
                  autoFocus
                  placeholder="اكتب المبلغ"
                  value={paymentAmountInput}
                  onChange={(event) => setPaymentAmountInput(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-center text-lg font-bold tabular-nums text-slate-800 focus:border-brand-500 focus:outline-none dir-ltr"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  checked={recordPaymentTransaction}
                  onChange={(event) => setRecordPaymentTransaction(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                />
                <span>
                  <span className="block text-xs font-bold text-slate-700">
                    سجّل الدفعة في مكان مالي
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    هيضاف دخل أو مصروف ويتحدث رصيد المكان تلقائيًا
                  </span>
                </span>
              </label>

              {recordPaymentTransaction && (
                <div>
                  <label
                    htmlFor="debt-payment-wallet"
                    className="mb-1 block text-xs font-bold text-slate-600"
                  >
                    {paymentModalDebt.type === 'to_me' ? 'إضافة المبلغ إلى' : 'الخصم من'}
                  </label>
                  <select
                    id="debt-payment-wallet"
                    value={paymentWalletId}
                    onChange={(event) => setPaymentWalletId(event.target.value)}
                    disabled={!wallets.length}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold disabled:bg-slate-100"
                  >
                    <option value="">اختار مكان الفلوس</option>
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} · {wallet.balance.toLocaleString('ar-EG')} ج.م
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {paymentError && (
                <p
                  role="alert"
                  className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
                >
                  {paymentError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSavingPayment}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {isSavingPayment ? 'جاري الحفظ...' : 'حفظ الدفعة'}
                </button>
                <button
                  type="button"
                  onClick={closePaymentModal}
                  disabled={isSavingPayment}
                  className="min-h-11 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 disabled:opacity-60"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
