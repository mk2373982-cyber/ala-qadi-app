'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ConfirmActionModal, ConfirmActionOptions } from '@/components/modals/ConfirmActionModal';
import { registerConfirmAction } from '@/lib/confirm-action';

type PendingConfirmation = ConfirmActionOptions & { resolve: (confirmed: boolean) => void };
const ConfirmActionContext = createContext<((options: ConfirmActionOptions) => Promise<boolean>) | null>(null);

export const ConfirmActionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const confirm = useCallback((options: ConfirmActionOptions) => new Promise<boolean>((resolve) => {
    setPending({ ...options, resolve });
  }), []);

  const finish = useCallback((confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  useEffect(() => registerConfirmAction(confirm), [confirm]);

  return (
    <ConfirmActionContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmActionModal
          title={pending.title}
          message={pending.message}
          itemName={pending.itemName}
          confirmLabel={pending.confirmLabel}
          tone={pending.tone}
          onConfirm={() => finish(true)}
          onCancel={() => finish(false)}
        />
      )}
    </ConfirmActionContext.Provider>
  );
};

export const useConfirmAction = () => {
  const confirm = useContext(ConfirmActionContext);
  if (!confirm) throw new Error('useConfirmAction must be used inside ConfirmActionProvider');
  return confirm;
};
