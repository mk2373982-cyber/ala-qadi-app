import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export type UserStatus = 'pending' | 'active' | 'suspended' | 'expired';
export type SubscriptionPlan = '1_month' | '3_months' | '6_months' | '1_year' | 'lifetime';

export interface UserAccount {
  id: string;
  name: string;
  phone: string;
  status: UserStatus;
  plan: SubscriptionPlan;
  startDate: string | null;
  endDate: string | null;
  notes?: string;
  createdAt: string;
  paymentStatus: 'not_submitted' | 'pending_review' | 'confirmed' | 'rejected';
  paymentReference?: string;
  paymentSubmittedAt?: string | null;
}

export interface AdminSettings {
  paymentPhone: string;
  paymentInstapay: string;
  instapayLink: string;
  whatsappNumber: string;
  pricingNote: string;
}

type DbUser = {
  id: string; name: string; phone: string; password_hash?: string; status: UserStatus;
  plan: SubscriptionPlan; start_date: string | null; end_date: string | null;
  notes: string | null; payment_status: UserAccount['paymentStatus'];
  payment_reference: string | null; payment_submitted_at: string | null; created_at: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('قاعدة البيانات غير متصلة. أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في إعدادات البيئة.');
  }
}

async function db<T>(table: string, query = '', init: RequestInit = {}): Promise<T> {
  requireSupabase();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    ...init,
    cache: 'no-store',
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.body ? { Prefer: 'return=representation' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(`Supabase ${table} request failed (${response.status}):`, detail);
    if (response.status === 409) throw new Error('رقم الهاتف مسجل بالفعل');
    throw new Error('تعذر حفظ البيانات في قاعدة البيانات');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function mapUser(row: DbUser): UserAccount {
  return {
    id: row.id, name: row.name, phone: row.phone, status: row.status, plan: row.plan,
    startDate: row.start_date, endDate: row.end_date, notes: row.notes || undefined,
    paymentStatus: row.payment_status, paymentReference: row.payment_reference || undefined,
    paymentSubmittedAt: row.payment_submitted_at, createdAt: row.created_at,
  };
}

function normalizePhone(phone: string) { return phone.trim().replace(/\s+/g, ''); }
function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function findUserByPhone(phone: string, withPassword = false) {
  const rows = await db<DbUser[]>('app_users', `?phone=eq.${encodeURIComponent(normalizePhone(phone))}&select=${withPassword ? '*' : 'id,name,phone,status,plan,start_date,end_date,notes,payment_status,payment_reference,payment_submitted_at,created_at'}&limit=1`);
  return rows[0] ? { ...mapUser(rows[0]), passwordHash: rows[0].password_hash } : undefined;
}

export async function verifyUserPassword(phone: string, password: string) {
  const user = await findUserByPhone(phone, true);
  return user?.passwordHash && passwordMatches(password, user.passwordHash) ? user : undefined;
}

export async function findUserById(id: string) {
  const rows = await db<DbUser[]>('app_users', `?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  return rows[0] ? mapUser(rows[0]) : undefined;
}

export async function listUsers() {
  const rows = await db<DbUser[]>('app_users', '?select=*&order=created_at.desc');
  return rows.map(mapUser);
}

export async function createUser(name: string, phone: string, password: string) {
  const rows = await db<DbUser[]>('app_users', '', {
    method: 'POST',
    body: JSON.stringify({ name: name.trim(), phone: normalizePhone(phone), password_hash: passwordHash(password.trim()) }),
  });
  return mapUser(rows[0]);
}

export function calculateEndDate(plan: SubscriptionPlan): string | null {
  const date = new Date();
  if (plan === 'lifetime') return null;
  if (plan === '1_month') date.setMonth(date.getMonth() + 1);
  else if (plan === '3_months') date.setMonth(date.getMonth() + 3);
  else if (plan === '6_months') date.setMonth(date.getMonth() + 6);
  else if (plan === '1_year') date.setFullYear(date.getFullYear() + 1);
  return date.toISOString();
}

async function patchUser(userId: string, changes: Record<string, unknown>) {
  const rows = await db<DbUser[]>('app_users', `?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH', body: JSON.stringify({ ...changes, updated_at: new Date().toISOString() }),
  });
  if (!rows[0]) throw new Error('المستخدم غير موجود');
  return mapUser(rows[0]);
}

export async function updateUserStatus(userId: string, status: UserStatus, plan?: SubscriptionPlan, customEndDate?: string | null) {
  const existing = await findUserById(userId);
  if (!existing) throw new Error('المستخدم غير موجود');
  const changes: Record<string, unknown> = { status };
  if (plan) changes.plan = plan;
  if (status === 'active') {
    changes.start_date = existing.startDate || new Date().toISOString();
    if (customEndDate !== undefined) changes.end_date = customEndDate;
    else if (plan) changes.end_date = calculateEndDate(plan);
  }
  return patchUser(userId, changes);
}

export async function activateSubscriptionWithCode(userId: string, code: string) {
  const configuredCode = process.env.SUBSCRIPTION_ACTIVATION_CODE;
  if (!configuredCode) throw new Error('كود التفعيل غير مضبوط على السيرفر.');
  const supplied = createHash('sha256').update(code.trim()).digest();
  const expected = createHash('sha256').update(configuredCode.trim()).digest();
  if (!timingSafeEqual(supplied, expected)) throw new Error('كود التفعيل غير صحيح.');

  const user = await findUserById(userId);
  if (!user) throw new Error('الحساب غير موجود.');
  if (user.status === 'suspended') throw new Error('الحساب موقوف. تواصل مع المسؤول.');
  if (user.paymentStatus !== 'pending_review') throw new Error('تواصل مع المسؤول بعد إرسال صورة التحويل على واتساب.');
  if (user.status === 'active' && (!user.endDate || new Date(user.endDate).getTime() > Date.now())) {
    throw new Error('الاشتراك مفعل بالفعل.');
  }

  const plan = user.plan;
  return patchUser(userId, {
    status: 'active',
    start_date: new Date().toISOString(),
    end_date: calculateEndDate(plan),
    payment_status: 'confirmed',
  });
}

export async function authorizeUserActivation(userId: string) {
  const user = await findUserById(userId);
  if (!user) throw new Error('المستخدم غير موجود.');
  if (user.status === 'suspended') throw new Error('لا يمكن تفعيل حساب موقوف.');
  return patchUser(userId, { payment_status: 'pending_review', payment_submitted_at: new Date().toISOString() });
}

export async function reviewPayment(userId: string, decision: 'confirm' | 'reject', plan?: SubscriptionPlan) {
  const user = await findUserById(userId);
  if (!user) throw new Error('المستخدم غير موجود');
  if (user.paymentStatus !== 'pending_review') throw new Error('لا يوجد طلب دفع بانتظار المراجعة');
  if (decision === 'reject') return patchUser(userId, { payment_status: 'rejected' });
  const activePlan = plan ?? user.plan;
  return patchUser(userId, { status: 'active', plan: activePlan, start_date: new Date().toISOString(), end_date: calculateEndDate(activePlan), payment_status: 'confirmed' });
}

export async function deleteUser(userId: string) {
  await db<unknown>('app_users', `?id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' });
}

const defaultSettings: AdminSettings = { paymentPhone: '', paymentInstapay: '', instapayLink: '', whatsappNumber: '', pricingNote: '' };

export async function getSettings(): Promise<AdminSettings> {
  const rows = await db<{ value: Partial<AdminSettings> }[]>('app_settings', '?key=eq.payment&select=value&limit=1');
  return { ...defaultSettings, ...(rows[0]?.value || {}) };
}

export async function updateSettings(settings: Partial<AdminSettings>) {
  const allowed = { paymentPhone: settings.paymentPhone, paymentInstapay: settings.paymentInstapay, instapayLink: settings.instapayLink, whatsappNumber: settings.whatsappNumber, pricingNote: settings.pricingNote };
  const current = await getSettings();
  const value = { ...current, ...Object.fromEntries(Object.entries(allowed).filter(([, item]) => item !== undefined)) };
  await db('app_settings', '?key=eq.payment', { method: 'PATCH', body: JSON.stringify({ value, updated_at: new Date().toISOString() }) });
  return value;
}

export function verifyAdminPassword(password: string) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) throw new Error('اضبط ADMIN_PASSWORD في إعدادات البيئة قبل استخدام لوحة الإدارة.');
  if (configured.length < 14) throw new Error('كلمة مرور الإدارة قصيرة. حدّث ADMIN_PASSWORD في إعدادات Vercel إلى 14 حرفاً على الأقل.');
  const actual = createHash('sha256').update(password).digest();
  const expected = createHash('sha256').update(configured).digest();
  return timingSafeEqual(actual, expected);
}

export function createAdminSession() {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error('اضبط ADMIN_PASSWORD في إعدادات البيئة قبل استخدام لوحة الإدارة.');
  if (secret.length < 14) throw new Error('كلمة مرور الإدارة قصيرة. حدّث ADMIN_PASSWORD في إعدادات Vercel إلى 14 حرفاً على الأقل.');
  const expiresAt = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
  const signature = createHmac('sha256', secret).update(String(expiresAt)).digest('base64url');
  return `${expiresAt}.${signature}`;
}

export function verifyAdminSession(session: string | undefined) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret || secret.length < 14 || !session) return false;
  const [expiresText, signature] = session.split('.');
  const expiresAt = Number(expiresText);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000) || !signature) return false;
  const expected = createHmac('sha256', secret).update(expiresText).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
