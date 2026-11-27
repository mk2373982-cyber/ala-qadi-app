'use client';

import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

    if (isIosDevice && !isStandalone) {
      setIsIOS(true);
    }

    // Android / Chrome beforeinstallprompt event
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt && !isIOS) return null;

  return (
    <div className="bg-gradient-to-r from-brand-600 to-emerald-700 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-emerald-200 shrink-0" />
        {isIOS ? (
          <span>
            لتثبيت التطبيق على آيفون: اضغط زر{' '}
            <span className="font-bold underline">المشاركة (Share)</span> ثم اختر{' '}
            <span className="font-bold underline">&quot;إضافة للشاشة الرئيسية&quot;</span>.
          </span>
        ) : (
          <span>هل تريد تثبيت تطبيق &quot;على قدي&quot; على هاتفك ليفتح كأي تطبيق أصلي؟</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isIOS && deferredPrompt && (
          <button
            onClick={handleInstallClick}
            className="px-3 py-1 rounded-lg bg-white text-brand-800 hover:bg-brand-50 font-bold transition-all shadow-sm flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تثبيت</span>
          </button>
        )}
        <button
          onClick={() => {
            setShowPrompt(false);
            setIsIOS(false);
          }}
          className="p-1 text-white/70 hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
