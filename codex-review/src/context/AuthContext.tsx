'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface UserSession {
  id: string;
  name: string;
  phone: string;
  status: 'pending' | 'active' | 'suspended' | 'expired';
  plan: 'lifetime';
  startDate: string;
  endDate: null;
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
  daysRemaining: number | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_KEY = 'ala_qaddi_user';
const ACCOUNT_KEY = 'ala_qaddi_local_account';
const createSession = (name: string, phone: string): UserSession => ({
  id: `local_${crypto.randomUUID()}`,
  name,
  phone,
  status: 'active',
  plan: 'lifetime',
  startDate: new Date().toISOString(),
  endDate: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const refreshOnline = () => setIsOnline(navigator.onLine);
    refreshOnline();
    window.addEventListener('online', refreshOnline);
    window.addEventListener('offline', refreshOnline);
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) setUser(JSON.parse(saved) as UserSession);
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setIsLoading(false);
    }
    return () => {
      window.removeEventListener('online', refreshOnline);
      window.removeEventListener('offline', refreshOnline);
    };
  }, []);

  const login = useCallback(async (phone: string, pass: string) => {
    try {
      const account = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null') as
        | { name: string; phone: string; password: string }
        | null;
      if (!account || account.phone !== phone.trim() || account.password !== pass) {
        return { success: false, error: 'لا يوجد حساب مطابق على هذا الجهاز. اختر «حساب جديد» لإنشاء حساب محلي.' };
      }
      const session = createSession(account.name, account.phone);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(session);
      return { success: true };
    } catch {
      return { success: false, error: 'تعذر قراءة الحساب المحلي على هذا الجهاز.' };
    }
  }, []);

  const register = useCallback(async (name: string, phone: string, pass: string) => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName || !cleanPhone || pass.length < 3) {
      return { success: false, error: 'أدخل الاسم ورقم الهاتف وكلمة مرور من 3 أحرف على الأقل.' };
    }
    if (localStorage.getItem(ACCOUNT_KEY)) {
      return { success: false, error: 'يوجد حساب محلي بالفعل. سجّل الدخول أو امسح بيانات الموقع لإنشاء حساب جديد.' };
    }
    try {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ name: cleanName, phone: cleanPhone, password: pass }));
      const session = createSession(cleanName, cleanPhone);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(session);
      return { success: true };
    } catch {
      return { success: false, error: 'تعذر حفظ الحساب على هذا الجهاز.' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('ala_qaddi_admin_auth');
    setUser(null);
  }, []);

  const refreshStatus = useCallback(async () => {}, []);
  const value = useMemo(() => ({
    user,
    isLoading,
    isOnline,
    login,
    register,
    logout,
    refreshStatus,
    isLicenseActive: Boolean(user),
    daysRemaining: null,
  }), [user, isLoading, isOnline, login, register, logout, refreshStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
