import Dexie, { type Table } from 'dexie';

export interface Transaction {
  id?: number;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  note?: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface Category {
  id?: number;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  isDefault?: boolean;
}

export interface Budget {
  id?: number;
  category: string; // category name or 'TOTAL'
  monthlyLimit: number;
}

export interface Debt {
  id?: number;
  type: 'to_me' | 'on_me'; // to_me = فلوس ليّا برة, on_me = ديون عليّا
  personName: string;
  totalAmount: number;
  paidAmount: number;
  note?: string;
  dueDate?: string;
  isCompleted: boolean;
  createdAt: number;
}

export interface Gam3eya {
  id?: number;
  name: string;
  monthlyAmount: number;
  totalMonths: number;
  myTurnMonth: number; // الشهر الذي ستقبض فيه
  paidMonths: number;
  startDate: string; // YYYY-MM
  isCollected: boolean; // هل قبضت جمعيتك أم لسه
  status: 'active' | 'completed';
}

export interface SavingsAsset {
  id?: number;
  type: 'gold_21' | 'gold_24' | 'usd' | 'cash_cert';
  name: string;
  quantity: number; // جرامات الذهب أو عدد الدولارات
  buyPricePerUnit: number;
  currentPricePerUnit: number;
  note?: string;
  date: string;
}

export class AlaQaddiDatabase extends Dexie {
  transactions!: Table<Transaction>;
  categories!: Table<Category>;
  budgets!: Table<Budget>;
  debts!: Table<Debt>;
  gam3eyat!: Table<Gam3eya>;
  savings!: Table<SavingsAsset>;

  constructor() {
    super('AlaQaddiLocalDB');
    this.version(1).stores({
      transactions: '++id, type, category, date, createdAt',
      categories: '++id, name, type',
      budgets: '++id, category',
      debts: '++id, type, personName, isCompleted, dueDate',
      gam3eyat: '++id, name, status',
      savings: '++id, type',
    });
  }
}

export const db = new AlaQaddiDatabase();

// Default Egyptian / Arabic categories
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  // Expenses
  { name: 'مصاريف البيت والطلبات', type: 'expense', icon: 'Home', color: '#10b981', isDefault: true },
  { name: 'مواصلات وبنزين', type: 'expense', icon: 'Car', color: '#06b6d4', isDefault: true },
  { name: 'فواتير وكهرباء وغاز', type: 'expense', icon: 'Zap', color: '#f59e0b', isDefault: true },
  { name: 'علاج وصيدلية', type: 'expense', icon: 'Pill', color: '#ef4444', isDefault: true },
  { name: 'خروجات ومطاعم وترفيه', type: 'expense', icon: 'Coffee', color: '#8b5cf6', isDefault: true },
  { name: 'تسوق وملابس', type: 'expense', icon: 'ShoppingBag', color: '#ec4899', isDefault: true },
  { name: 'أقساط ومستحقات', type: 'expense', icon: 'CreditCard', color: '#f97316', isDefault: true },
  { name: 'جمعيات شهرية', type: 'expense', icon: 'Users', color: '#6366f1', isDefault: true },
  { name: 'مصاريف أخرى', type: 'expense', icon: 'MoreHorizontal', color: '#64748b', isDefault: true },
  
  // Incomes
  { name: 'الراتب الأساسي', type: 'income', icon: 'Briefcase', color: '#10b981', isDefault: true },
  { name: 'شغل حر / إضافي (فريلانس)', type: 'income', icon: 'Laptop', color: '#0ea5e9', isDefault: true },
  { name: 'قبض جمعية', type: 'income', icon: 'Gift', color: '#8b5cf6', isDefault: true },
  { name: 'استرداد سلفة أو دين', type: 'income', icon: 'RotateCcw', color: '#14b8a6', isDefault: true },
  { name: 'أرباح أو استثمار', type: 'income', icon: 'TrendingUp', color: '#f59e0b', isDefault: true },
  { name: 'دخل آخر', type: 'income', icon: 'PlusCircle', color: '#64748b', isDefault: true },
];

export async function seedDefaultCategoriesIfEmpty() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }
}
