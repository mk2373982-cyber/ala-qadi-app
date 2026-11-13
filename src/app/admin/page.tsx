'use client';

import React, { useState, useEffect } from 'react';
import { UserAccount, AdminSettings } from '@/lib/server-storage';
import {
  ShieldCheck,
  Users,
  CheckCircle,
  Clock,
  Ban,
  Trash2,
  RefreshCw,
  Search,
  Settings,
  Phone,
  MessageCircle,
  Lock,
  LogOut,
  Calendar,
  AlertCircle,
  DollarSign,
  ArrowRight,
} from 'lucide-react';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Admin Data
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    expiredUsers: 0,
    suspendedUsers: 0,
  });
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);

  // Settings Edit State
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [paymentPhone, setPaymentPhone] = useState('');
  const [paymentInstapay, setPaymentInstapay] = useState('');
  const [instapayLink, setInstapayLink] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [pricingNote, setPricingNote] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  // Check stored admin session
  useEffect(() => {
    const session = localStorage.getItem('ala_qaddi_admin_auth');
    if (session === 'true') {
      fetch('/api/admin/users')
        .then((res) => {
          if (res.ok) {
            setIsAuthenticated(true);
            fetchUsers();
            fetchSettings();
          } else localStorage.removeItem('ala_qaddi_admin_auth');
        })
        .catch(() => localStorage.removeItem('ala_qaddi_admin_auth'));
    }
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPasswordInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('ala_qaddi_admin_auth', 'true');
        fetchUsers();
        fetchSettings();
      } else {
        setLoginError(data.error || 'كلمة المرور غير صحيحة');
      }
    } catch {
      setLoginError('فشل الاتصال بالسيرفر');
    }
  };

  const handleAdminLogout = () => {
    try {
      localStorage.removeItem('ala_qaddi_admin_auth');
    } catch (e) {}
    void fetch('/api/admin/logout', { method: 'POST' });
    setIsAuthenticated(false);
    if (typeof window !== 'undefined') {
      window.location.replace('/');
      window.location.reload();
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users);
        setStats(data.stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        setPaymentPhone(data.settings.paymentPhone);
        setPaymentInstapay(data.settings.paymentInstapay);
        setInstapayLink(data.settings.instapayLink || '');
        setWhatsappNumber(data.settings.whatsappNumber);
        setPricingNote(data.settings.pricingNote);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateStatus = async (
    userId: string,
    status: UserAccount['status'],
    plan?: UserAccount['plan'],
  ) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          userId,
          status,
          plan,
        }),
      });
      if (res.ok) {
        setActionMessage('تم تحديث حالة المستخدم بنجاح');
        fetchUsers();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReviewPayment = async (userId: string, decision: 'confirm' | 'reject') => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review_payment', userId, decision }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذرت مراجعة الطلب');
      setActionMessage(
        decision === 'confirm' ? 'تم تأكيد الدفع وتفعيل الاشتراك' : 'تم رفض طلب الدفع',
      );
      await fetchUsers();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'تعذرت مراجعة الطلب');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // Optimistic UI update: remove user from state immediately!
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    setStats((prev) => ({
      ...prev,
      totalUsers: Math.max(0, prev.totalUsers - 1),
    }));
    setUserToDelete(null);
    setActionMessage('تم حذف المستخدم بنجاح');
    setTimeout(() => setActionMessage(null), 3000);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', userId }),
      });
      if (!res.ok) {
        // If server failed, refetch to restore
        fetchUsers();
      }
    } catch (e) {
      console.error(e);
      fetchUsers();
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<AdminSettings> = {
        paymentPhone,
        paymentInstapay,
        instapayLink,
        whatsappNumber,
        pricingNote,
      };
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setActionMessage('تم حفظ الإعدادات ورقم التحويل بنجاح');
        setIsEditingSettings(false);
        setNewAdminPassword('');
        fetchSettings();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchPhone = u.phone.includes(q);
      if (!matchName && !matchPhone) return false;
    }
    return true;
  });

  // If not authenticated, show login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-700 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-brand-500/20">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-black">لوحة تحكم المسؤول</h1>
            <p className="text-xs text-slate-400 mt-1">
              تطبيق "على قدي" - إدارة المشتركين والتراخيص
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs text-center">
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                كلمة مرور الأدمن
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="••••••••"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-slate-700 bg-slate-900/80 text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                كلمة المرور تُضبط في إعدادات النشر الآمنة. سيتذكرك هذا الجهاز لمدة 30 يوماً.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-500 font-bold text-sm shadow-md transition-all"
            >
              تسجيل الدخول للمسؤول
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1"
            >
              <span>العودة لصفحة التطبيق الرئيسية</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 pb-20 selection:bg-brand-500 selection:text-white">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/80 backdrop-blur-md p-5 rounded-3xl border border-slate-700/80 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white">لوحة تحكم وتراخيص "على قدي"</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                  لوحة المبيعات المباشرة
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                تحكم كامل في تفعيل المشتركين، وإيقاف الحسابات، ومدد الاشتراكات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingSettings(!isEditingSettings)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white transition-colors"
            >
              <Settings className="w-4 h-4 text-brand-400" />
              <span>إعدادات التحويل والحساب</span>
            </button>

            <button
              onClick={() => fetchUsers()}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <a
              href="/"
              className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              title="فتح التطبيق كعميل"
            >
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              onClick={handleAdminLogout}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition-colors"
              title="تسجيل خروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {actionMessage && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
            <div className="text-xs text-slate-400 font-medium">إجمالي المسجلين</div>
            <div className="text-2xl font-black text-white font-mono mt-1">{stats.totalUsers}</div>
          </div>

          <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30">
            <div className="text-xs text-amber-400 font-bold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>بانتظار التفعيل</span>
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono mt-1">
              {stats.pendingUsers}
            </div>
          </div>

          <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/30">
            <div className="text-xs text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>حسابات نشطة</span>
            </div>
            <div className="text-2xl font-black text-emerald-300 font-mono mt-1">
              {stats.activeUsers}
            </div>
          </div>

          <div className="bg-orange-500/10 p-4 rounded-2xl border border-orange-500/30">
            <div className="text-xs text-orange-400 font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>اشتراكات منتهية</span>
            </div>
            <div className="text-2xl font-black text-orange-300 font-mono mt-1">
              {stats.expiredUsers}
            </div>
          </div>

          <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/30 col-span-2 sm:col-span-1">
            <div className="text-xs text-rose-400 font-bold flex items-center gap-1">
              <Ban className="w-3.5 h-3.5" />
              <span>موقوفين / مطرودين</span>
            </div>
            <div className="text-2xl font-black text-rose-300 font-mono mt-1">
              {stats.suspendedUsers}
            </div>
          </div>
        </div>

        {/* Settings Box (Toggleable) */}
        {isEditingSettings && (
          <div className="bg-slate-800 rounded-3xl p-6 border border-brand-500/40 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="font-bold text-sm text-brand-400 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>بيانات التحويل والتواصل التي تظهر للعملاء المعلقين</span>
              </h3>
              <button
                onClick={() => setIsEditingSettings(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                إغلاق ✕
              </button>
            </div>

            <form
              onSubmit={handleSaveSettings}
              className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  رقم فودافون كاش / المحفظة لاستلام الفلوس
                </label>
                <input
                  type="text"
                  value={paymentPhone}
                  onChange={(e) => setPaymentPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="block min-w-0 w-full max-w-full box-border px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  عنوان انستاباي (InstaPay Handle)
                </label>
                <input
                  type="text"
                  value={paymentInstapay}
                  onChange={(e) => setPaymentInstapay(e.target.value)}
                  placeholder="username@instapay"
                  className="block min-w-0 w-full max-w-full box-border px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div className="min-w-0">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  رابط InstaPay للتحويل المباشر
                </label>
                <input
                  type="url"
                  value={instapayLink}
                  onChange={(e) => setInstapayLink(e.target.value)}
                  placeholder="https://ipn.eg/S/..."
                  className="block min-w-0 w-full max-w-full box-border px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                  dir="ltr"
                />
                <span className="block mt-1 text-[10px] text-slate-500">
                  الصق رابط المشاركة الذي تنشئه من تطبيق InstaPay، وسيظهر زر للعميل لفتحه مباشرة.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  رقم الواتساب لاستلام إشعارات التحويل (مع كود الدولة)
                </label>
                <input
                  type="text"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="2010XXXXXXXX"
                  className="block min-w-0 w-full max-w-full box-border px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                  dir="ltr"
                />
                <span className="text-[10px] text-slate-500">مثال لمصر: 201012345678</span>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ملاحظة الأسعار (تظهر للمستخدمين عند طلب الاشتراك)
                </label>
                <input
                  type="text"
                  value={pricingNote}
                  onChange={(e) => setPricingNote(e.target.value)}
                  placeholder="اكتب السعر السنوي الأساسي والسعر بعد خصم ٥٠٪ خلال أول ١٠ أيام"
                  className="block min-w-0 w-full max-w-full box-border px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="bg-slate-800/80 p-4 rounded-3xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="بحث بالاسم أو الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto">
            {['all', 'pending', 'active', 'expired', 'suspended'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {st === 'all'
                  ? 'الكل'
                  : st === 'pending'
                    ? 'المعلقين'
                    : st === 'active'
                      ? 'النشطين'
                      : st === 'expired'
                        ? 'المنتهين'
                        : 'الموقوفين'}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table / Cards */}
        <div className="bg-slate-800/80 rounded-3xl border border-slate-700 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/60 text-slate-400 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-4">الاسم ورقم الهاتف</th>
                  <th className="p-4">تاريخ التسجيل</th>
                  <th className="p-4">حالة الحساب</th>
                  <th className="p-4">نوع الباقة والصلاحية</th>
                  <th className="p-4 text-center">إجراءات التفعيل والتحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      لا يوجد مستخدمين يطابقون البحث.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isUserActive = u.status === 'active';
                    const isPending = u.status === 'pending';
                    const isSuspended = u.status === 'suspended';
                    const isExpired = u.status === 'expired';
                    const needsActivation = isPending || isExpired;

                    const cleanPhone = u.phone.replace(/\D/g, '');
                    const waLink = `https://wa.me/${cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone}`;
                    const trialOfferDeadline = new Date(u.createdAt);
                    trialOfferDeadline.setDate(trialOfferDeadline.getDate() + 10);

                    return (
                      <tr key={u.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-white text-sm">{u.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-slate-400 text-xs" dir="ltr">
                              {u.phone}
                            </span>
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-400 hover:text-emerald-300"
                              title="محادثة واتساب"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                            <a
                              href={`tel:${u.phone}`}
                              className="text-blue-400 hover:text-blue-300"
                              title="اتصال هاتفي"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>

                        <td className="p-4 text-slate-400 font-mono">
                          {new Date(u.createdAt).toLocaleDateString('ar-EG')}
                        </td>

                        <td className="p-4">
                          {isUserActive && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
                              <CheckCircle className="w-3 h-3" />
                              <span>نشط ومفعل</span>
                            </span>
                          )}
                          {u.isTrial && u.endDate && (
                            <div className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-[11px] leading-5 text-sky-100">
                              <div className="font-bold">
                                تجربة مجانية — عرض ٥٠٪ على الاشتراك السنوي
                              </div>
                              <div>
                                الموعد النهائي للدفع بالعرض:{' '}
                                {trialOfferDeadline.toLocaleDateString('ar-EG')}
                              </div>
                              <div>
                                راجع تاريخ التحويل في الإيصال؛ إذا كان خلال أول ١٠ أيام، فعّل السنوي
                                بعد مراجعة المبلغ المخفّض.
                              </div>
                            </div>
                          )}
                          {isPending && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-max">
                              <Clock className="w-3 h-3" />
                              <span>معلق (بانتظار التحويل)</span>
                            </span>
                          )}
                          {needsActivation && u.paymentStatus !== 'pending_review' && (
                            <div className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2 text-[11px] text-sky-100">
                              <div>
                                بعد مراجعة التحويل وصورة الإيصال على واتساب، فعّل الاشتراك من أزرار
                                الباقة.
                              </div>
                              <button
                                onClick={() => handleReviewPayment(u.id, 'confirm')}
                                className="mt-2 rounded bg-emerald-600 px-2 py-1 font-bold text-white"
                              >
                                تأكيد الدفع وتفعيل الباقة الحالية
                              </button>
                            </div>
                          )}
                          {u.paymentStatus === 'pending_review' && (
                            <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                              <div className="font-bold">طلب الدفع بانتظار قرارك</div>
                              {u.paymentSubmittedAt && (
                                <div>{new Date(u.paymentSubmittedAt).toLocaleString('ar-EG')}</div>
                              )}
                              <div className="mt-2 flex gap-2">
                                <button
                                  onClick={() => handleReviewPayment(u.id, 'confirm')}
                                  className="rounded bg-emerald-600 px-2 py-1 font-bold text-white"
                                >
                                  تأكيد الدفع
                                </button>
                                <button
                                  onClick={() => handleReviewPayment(u.id, 'reject')}
                                  className="rounded bg-rose-600 px-2 py-1 font-bold text-white"
                                >
                                  رفض الطلب
                                </button>
                              </div>
                            </div>
                          )}
                          {isSuspended && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-max">
                              <Ban className="w-3 h-3" />
                              <span>موقوف / مطرود</span>
                            </span>
                          )}
                          {isExpired && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1 w-max">
                              <AlertCircle className="w-3 h-3" />
                              <span>منتهي الصلاحية</span>
                            </span>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="font-bold text-slate-200">
                            {u.plan === 'lifetime'
                              ? 'مدى الحياة (دائم)'
                              : u.plan === '1_year'
                                ? 'سنة'
                                : u.plan === '6_months'
                                  ? '6 شهور'
                                  : u.plan === '3_months'
                                    ? '3 شهور'
                                    : 'شهر'}
                          </div>
                          {u.endDate && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              ينتهي: {new Date(u.endDate).toLocaleDateString('ar-EG')}
                            </div>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Activate actions */}
                            <button
                              onClick={() => handleUpdateStatus(u.id, 'active', '1_month')}
                              title="تفعيل لمدة شهر"
                              className="px-2 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-[11px] transition-colors"
                            >
                              شهر
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(u.id, 'active', '1_year')}
                              title="تفعيل لمدة سنة"
                              className="px-2 py-1 rounded-lg bg-emerald-700/80 hover:bg-emerald-700 text-white font-bold text-[11px] transition-colors"
                            >
                              سنة
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(u.id, 'active', 'lifetime')}
                              title="تفعيل دائم مدى الحياة"
                              className="px-2 py-1 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white font-bold text-[11px] transition-colors"
                            >
                              دائم ∞
                            </button>

                            {/* Suspend / Kick button */}
                            {!isSuspended && (
                              <button
                                onClick={() => handleUpdateStatus(u.id, 'suspended')}
                                title="إيقاف أو طرد فوري للمستخدم"
                                className="px-2 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-[11px] transition-colors flex items-center gap-1"
                              >
                                <Ban className="w-3 h-3" />
                                <span>إيقاف</span>
                              </button>
                            )}

                            {/* Delete User */}
                            <button
                              onClick={() => setUserToDelete(u)}
                              title="حذف الحساب نهائياً"
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delete Confirmation Modal (100% Mobile & Standalone PWA friendly) */}
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-slate-800 rounded-3xl max-w-sm w-full p-6 border border-slate-700 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="font-bold text-base text-white">تأكيد حذف الحساب نهائياً</h3>
                <p className="text-xs text-slate-300 mt-1">هل أنت متأكد من حذف حساب المشترك:</p>
                <div className="mt-2 p-2 rounded-xl bg-slate-900 border border-slate-700">
                  <div className="font-bold text-brand-400 text-sm">{userToDelete.name}</div>
                  <div className="text-xs text-slate-400 font-mono" dir="ltr">
                    {userToDelete.phone}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleDeleteUser(userToDelete.id)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors"
                >
                  نعم، احذف الحساب الآن
                </button>
                <button
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-xs transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
