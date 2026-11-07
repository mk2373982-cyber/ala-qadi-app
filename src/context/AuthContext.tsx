'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface UserSession {
  id: string;
  name: string;
  phone: string;
  status: 'pending' | 'active' | 'suspended' | 'expired';
  plan: '1_month' | '3_months' | '6_months' | '1_year' | 'lifetime';
  startDate: string | null;
  endDate: string | null;
  lastOnlineCheck?: number;
}

interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  isOnline: boolean;
  login: (phone: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, phone: string, pass: string) => Promise<{ success: boolean; error?: string }>;
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

  // Load user from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ala_qaddi_user');
      if (stored) {
        const parsed = JSON.parse(stored) as UserSession;
        setUser(parsed);
      }
    } catch (e) {
      console.error('Error loading stored user', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Periodic license check with server when online
  const refreshStatus = useCallback(async () => {
    if (!user || !navigator.onLine) return;

    try {
      const res = await fetch('/api/auth/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (res.ok) {
        const data = await res.json();
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
  }, [isOnline, user?.id, refreshStatus]);

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
      setUser(session);
      localStorage.setItem('ala_qaddi_user', JSON.stringify(session));
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
      setUser(session);
      localStorage.setItem('ala_qaddi_user', JSON.stringify(session));
      return { success: true };
    } catch {
      return { success: false, error: 'حدث خطأ في الاتصال بالشبكة' };
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem('ala_qaddi_user');
      sessionStorage.removeItem('ala_qaddi_user');
      sessionStorage.removeItem('ala_qaddi_admin_auth');
    } catch (e) {
      console.error(e);
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
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
