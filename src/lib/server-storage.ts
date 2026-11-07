import fs from 'fs';
import path from 'path';
import os from 'os';

export interface UserAccount {
  id: string;
  name: string;
  phone: string;
  password: string;
  status: 'pending' | 'active' | 'suspended' | 'expired';
  plan: '1_month' | '3_months' | '6_months' | '1_year' | 'lifetime';
  startDate: string | null;
  endDate: string | null;
  notes?: string;
  createdAt: string;
}

export interface AdminSettings {
  adminPassword: string;
  paymentPhone: string;
  paymentInstapay: string;
  whatsappNumber: string;
  pricingNote: string;
}

export interface SystemData {
  settings: AdminSettings;
  users: UserAccount[];
}

// On Vercel Serverless, process.cwd() is read-only. We MUST write to os.tmpdir() (/tmp)
const IS_SERVERLESS = !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const DATA_DIR = IS_SERVERLESS ? path.join(os.tmpdir(), 'ala_qaddi') : path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'system_data.json');

const DEFAULT_SETTINGS: AdminSettings = {
  adminPassword: 'admin',
  paymentPhone: '01000000000',
  paymentInstapay: 'wallet@instapay',
  whatsappNumber: '201000000000',
  pricingNote: 'الاشتراك: 50 جنيه شهرياً / 300 جنيه سنوياً (تحويل انستاباي أو فودافون كاش)',
};

// Global in-memory cache to ensure instant speed and survival across serverless warm requests
let inMemoryData: SystemData | null = null;

function ensureDataFile(): SystemData {
  if (inMemoryData) {
    return inMemoryData;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    console.warn('Could not create directory:', e);
  }

  // Check if file exists in DATA_FILE
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      inMemoryData = JSON.parse(raw);
      return inMemoryData!;
    } catch (e) {
      console.error('Error reading DATA_FILE, fallback to initial', e);
    }
  }

  // Check if bundled seed file exists in project
  const bundledPath = path.join(process.cwd(), 'data', 'system_data.json');
  if (fs.existsSync(bundledPath)) {
    try {
      const raw = fs.readFileSync(bundledPath, 'utf-8');
      inMemoryData = JSON.parse(raw);
      try {
        fs.writeFileSync(DATA_FILE, raw, 'utf-8');
      } catch {}
      return inMemoryData!;
    } catch {}
  }

  // Default initial data
  const initialData: SystemData = {
    settings: DEFAULT_SETTINGS,
    users: [
      {
        id: 'demo_user',
        name: 'مستخدم تجريبي',
        phone: '01012345678',
        password: '123',
        status: 'active',
        plan: '1_year',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        notes: 'حساب تجريبي افتراضي',
      },
    ],
  };

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Could not write initial DATA_FILE to disk, using memory:', e);
  }

  inMemoryData = initialData;
  return inMemoryData;
}

export function getSystemData(): SystemData {
  return ensureDataFile();
}

export function saveSystemData(data: SystemData) {
  inMemoryData = data;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Disk write failed on serverless, saved to inMemoryData:', e);
  }
}

export function findUserByPhone(phone: string): UserAccount | undefined {
  const data = getSystemData();
  const cleanPhone = phone.trim().replace(/\s+/g, '');
  return data.users.find((u) => u.phone.trim().replace(/\s+/g, '') === cleanPhone);
}

export function findUserById(id: string): UserAccount | undefined {
  const data = getSystemData();
  return data.users.find((u) => u.id === id);
}

export function createUser(name: string, phone: string, password: string): UserAccount {
  const data = getSystemData();
  const cleanPhone = phone.trim().replace(/\s+/g, '');

  const existing = data.users.find((u) => u.phone.trim().replace(/\s+/g, '') === cleanPhone);
  if (existing) {
    throw new Error('رقم الهاتف مسجل بالفعل');
  }

  const newUser: UserAccount = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    phone: cleanPhone,
    password: password.trim(),
    status: 'pending',
    plan: '1_month',
    startDate: null,
    endDate: null,
    createdAt: new Date().toISOString(),
  };

  data.users.unshift(newUser);
  saveSystemData(data);
  return newUser;
}

export function calculateEndDate(plan: UserAccount['plan']): string | null {
  const now = new Date();
  if (plan === 'lifetime') return null;
  const d = new Date(now);
  if (plan === '1_month') d.setMonth(d.getMonth() + 1);
  else if (plan === '3_months') d.setMonth(d.getMonth() + 3);
  else if (plan === '6_months') d.setMonth(d.getMonth() + 6);
  else if (plan === '1_year') d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

export function updateUserStatus(
  userId: string,
  status: UserAccount['status'],
  plan?: UserAccount['plan'],
  customEndDate?: string | null
): UserAccount {
  const data = getSystemData();
  const index = data.users.findIndex((u) => u.id === userId);
  if (index === -1) throw new Error('المستخدم غير موجود');

  const user = data.users[index];
  user.status = status;
  if (plan) {
    user.plan = plan;
  }

  if (status === 'active') {
    if (!user.startDate) {
      user.startDate = new Date().toISOString();
    }
    if (customEndDate !== undefined) {
      user.endDate = customEndDate;
    } else if (plan) {
      user.endDate = calculateEndDate(plan);
    }
  }

  data.users[index] = user;
  saveSystemData(data);
  return user;
}

export function deleteUser(userId: string) {
  const data = getSystemData();
  data.users = data.users.filter((u) => u.id !== userId);
  saveSystemData(data);
  return true;
}

export function updateSettings(newSettings: Partial<AdminSettings>) {
  const data = getSystemData();
  data.settings = { ...data.settings, ...newSettings };
  saveSystemData(data);
  return data.settings;
}
