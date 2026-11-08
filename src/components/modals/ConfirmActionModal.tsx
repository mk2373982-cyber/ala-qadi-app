'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

export interface ConfirmActionOptions {
  title?: string;
  message: string;
  itemName?: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}

interface ConfirmActionModalProps extends ConfirmActionOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  title = 'تأكيد حذف العنصر',
  message,
  itemName,
  confirmLabel = 'تأكيد الحذف',
  tone = 'danger',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const isDanger = tone === 'danger';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        aria-describedby="confirm-action-message"
        className="w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-[0_24px_80px_-20px_rgba(15,23,42,0.45)] animate-in zoom-in-95 duration-150"
      >
        <div className={`h-1.5 w-full ${isDanger ? 'bg-gradient-to-l from-rose-500 to-orange-400' : 'bg-gradient-to-l from-brand-600 to-emerald-400'}`} />
        <div className="p-6 text-center">
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isDanger ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-100' : 'bg-brand-50 text-brand-600 ring-1 ring-brand-100'}`}>
            {isDanger ? <Trash2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
          <h2 id="confirm-action-title" className="text-lg font-black text-slate-800">{title}</h2>
          <p id="confirm-action-message" className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
          {itemName && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-extrabold text-slate-800 break-words">
              {itemName}
            </div>
          )}
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]">
              إلغاء
            </button>
            <button type="button" onClick={onConfirm} className={`flex-1 rounded-xl px-4 py-3 text-sm font-extrabold text-white shadow-lg transition active:scale-[0.98] ${isDanger ? 'bg-rose-600 shadow-rose-600/20 hover:bg-rose-700' : 'bg-brand-600 shadow-brand-600/20 hover:bg-brand-700'}`}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
