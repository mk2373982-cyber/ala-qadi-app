import { ConfirmActionOptions } from '@/components/modals/ConfirmActionModal';

type ConfirmAction = (options: ConfirmActionOptions) => Promise<boolean>;

let confirmAction: ConfirmAction | null = null;

export const registerConfirmAction = (handler: ConfirmAction) => {
  confirmAction = handler;
  return () => {
    if (confirmAction === handler) confirmAction = null;
  };
};

export const askForConfirmation = (options: ConfirmActionOptions) => {
  if (!confirmAction) return Promise.resolve(false);
  return confirmAction(options);
};
