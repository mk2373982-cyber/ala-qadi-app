'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { activateUserDatabase } from '@/lib/db';

export interface UserSession {
  id: string;
  name: string;
  phone: string;
  status: 'pending' | 'active' | 'suspended' | 'expired';
  plan: '1_month' | '3_months' | '6_months' | '1_year' | 'lifetime';
  startDate: string | null;
  endDate: string | null;
  createdAt?: string;
  lastOnlineCheck?: number;
  isTrial?: boolean;
}

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  isOnline: boolean;
  login: (phone: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    name: string,
    phone: string,
    pass: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshStatus: () => Promise<void>;
  isLicenseActive: boolean;
  daysRemaining: number | null; // null for lifetime, number for remaining days
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const hasLoggedOut = useRef(false);

  // Online / Offline tracking
  useEffect(() => {
    setIsOnline(typeof window !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Restore only the signed-in account's local database before exposing its screens.
  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      let restoredUser: UserSession | null = null;
      try {
        const stored = localStorage.getItem('ala_qaddi_user');
        if (stored) {
          restoredUser = JSON.parse(stored) as UserSession;
        }
      } catch (error) {
        console.error('Error loading stored user', error);
      }

      if (restoredUser && !restoredUser.createdAt && navigator.onLine) {
        try {
          const response = await fetch('/api/auth/check-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (response.ok) {
            const data = await response.json();
            restoredUser = { ...restoredUser, createdAt: data.createdAt };
            localStorage.setItem('ala_qaddi_user', JSON.stringify(restoredUser));
          }
        } catch {
          // Without the server creation date, keep the legacy database unclaimed.
        }
      }

      try {
        await activateUserDatabase(
          restoredUser?.id ?? null,
          restoredUser?.createdAt,
          Boolean(restoredUser),
        );
      } catch (error) {
        console.error('Could not open isolated account storage', error);
        restoredUser = null;
        try {
          await activateUserDatabase(null);
        } catch {}
      }

      if (!cancelled && restoredUser) setUser(restoredUser);
      if (!cancelled) {
        setIsLoading(false);
      }
    };
    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // If another tab signs into a different account, move this tab to that account's
  // isolated database before updating its authenticated UI.
  useEffect(() => {
    const syncAccountAcrossTabs = (event: StorageEvent) => {
      if (event.key !== 'ala_qaddi_user') return;
      let nextUser: UserSession | null = null;
      try {
        nextUser = event.newValue ? (JSON.parse(event.newValue) as UserSession) : null;
      } catch {
        return;
      }
      if (nextUser?.id === user?.id) return;
      void activateUserDatabase(nextUser?.id ?? null, nextUser?.createdAt, Boolean(nextUser))
        .then(() => setUser(nextUser))
        .catch((error) => {
          console.error('Could not switch account storage in another tab', error);
          setUser(null);
        });
    };
    window.addEventListener('storage', syncAccountAcrossTabs);
    return () => window.removeEventListener('storage', syncAccountAcrossTabs);
  }, [user?.id]);

  // License check with server when online.
  const refreshStatus = useCallback(async () => {
    if (!user || hasLoggedOut.current || !navigator.onLine) return;

    try {
      const res = await fetch('/api/auth/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.status === 401) {
        hasLoggedOut.current = true;
        localStorage.removeItem('ala_qaddi_user');
        sessionStorage.removeItem('ala_qaddi_user');
        setUser(null);
        void activateUserDatabase(null).catch((error) =>
          console.error('Could not close expired account storage', error),
        );
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (hasLoggedOut.current) return;
        if (data.status === 'revoked') {
          // Admin deleted or revoked user
          setUser((prev) => (prev ? { ...prev, status: 'suspended' } : null));
          const updated = { ...user, status: 'suspended' as const };
          localStorage.setItem('ala_qaddi_user', JSON.stringify(updated));
        } else {
          const updated: UserSession = {
            ...user,
            status: data.status,
            plan: data.plan,
            startDate: data.startDate,
            endDate: data.endDate,
            createdAt: data.createdAt || user.createdAt,
            isTrial: Boolean(data.isTrial),
            lastOnlineCheck: Date.now(),
          };
          setUser(updated);
          localStorage.setItem('ala_qaddi_user', JSON.stringify(updated));
        }
      }
    } catch (err) {
      console.warn('Could not refresh license status online, continuing offline', err);
    }
  }, [user]);

  useEffect(() => {
    if (user && isOnline) {
      refreshStatus();
    }
    // Refresh only when the account or connection changes. `refreshStatus` updates
    // the user object, so depending on the callback here would cause a request loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user?.id]);

  // Periodic license re-check while the session is open: an account suspended or
  // expired after login must be gated without waiting for a full page reload.
  // Runs every 20 minutes while online and immediately (debounced) when the tab
  // becomes visible again after being hidden.
  useEffect(() => {
    if (!user || !isOnline) return;

    const RECHECK_INTERVAL_MS = 20 * 60 * 1000;
    const VISIBILITY_DEBOUNCE_MS = 60 * 1000;
    let lastRunAt = 0;
    let inFlight = false;

    const runCheck = () => {
      if (inFlight || hasLoggedOut.current || !navigator.onLine) return;
      inFlight = true;
      lastRunAt = Date.now();
      void Promise.resolve(refreshStatus()).finally(() => {
        inFlight = false;
      });
    };

    const interval = window.setInterval(runCheck, RECHECK_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRunAt < VISIBILITY_DEBOUNCE_MS) return;
      runCheck();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // Same reasoning as the mount check above: `refreshStatus` rewrites the user
    // object, so depending on the callback here would cause a request loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, user?.id]);

  const login = async (phone: string, pass: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password: pass }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'فشل تسجيل الدخول' };
      }

      const session: UserSession = {
        ...data.user,
        lastOnlineCheck: Date.now(),
      };
      await activateUserDatabase(session.id, session.createdAt, true);
      hasLoggedOut.current = false;
      setUser(session);
      localStorage.setItem('ala_qaddi_user', JSON.stringify(session));
      localStorage.setItem(`ala_qaddi_onboarding_pending_${session.id}`, '1');
      return { success: true };
    } catch {
      return { success: false, error: 'حدث خطأ في الاتصال بالشبكة' };
    }
  };

  const register = async (name: string, phone: string, pass: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password: pass }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'فشل التسجيل' };
      }

      const session: UserSession = {
        ...data.user,
        lastOnlineCheck: Date.now(),
      };

      await activateUserDatabase(session.id, session.createdAt, false);
      hasLoggedOut.current = false;
      setUser(session);
      localStorage.setItem('ala_qaddi_user', JSON.stringify(session));
      return { success: true };
    } catch {
      return { success: false, error: 'حدث خطأ في الاتصال بالشبكة' };
    }
  };

  const logout = () => {
    if (hasLoggedOut.current) return;
    hasLoggedOut.current = true;
    try {
      localStorage.removeItem('ala_qaddi_user');
      sessionStorage.removeItem('ala_qaddi_user');
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    void activateUserDatabase(null).catch((error) =>
      console.error('Could not close account storage on logout', error),
    );
    // Clear the server session without delaying the local logout interaction.
    void fetch('/api/auth/logout', { method: 'POST', keepalive: true }).catch(() => {});
  };

  // Calculate license validity and days remaining
  let isLicenseActive = false;
  let daysRemaining: number | null = null;

  if (user) {
    if (user.status === 'active') {
      if (!user.endDate) {
        // Lifetime plan
        isLicenseActive = true;
        daysRemaining = null;
      } else {
        const diffMs = new Date(user.endDate).getTime() - Date.now();
        if (diffMs > 0) {
          isLicenseActive = true;
          daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        } else {
          isLicenseActive = false;
          daysRemaining = 0;
        }
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isOnline,
        login,
        register,
        logout,
        refreshStatus,
        isLicenseActive,
        daysRemaining,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
