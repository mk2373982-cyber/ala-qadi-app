import { db } from './db';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Neutralizes spreadsheet formula injection: Excel/LibreOffice/Sheets execute a
 * cell as a formula when it starts with =, +, -, or @, so a crafted transaction
 * note could run commands when the exported CSV is opened. Detection ignores
 * leading whitespace; a leading single quote forces text interpretation.
 */
export function csvSafeCell(value: string) {
  const trimmed = value.trimStart();
  return /^[=+\-@]/.test(trimmed) ? `'${trimmed}` : value;
}

// --- Restore validation: reject malformed rows before they touch IndexedDB ---

function requiredString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === 'string' && value.trim().length > 0;
}

function requiredNumber(row: Record<string, unknown>, key: string, min = -Infinity) {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= min;
}

function optionalNumber(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return (
    value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value))
  );
}

function requiredBoolean(row: Record<string, unknown>, key: string) {
  return typeof row[key] === 'boolean';
}

function requiredDateString(row: Record<string, unknown>, key: string) {
  return typeof row[key] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row[key] as string);
}

function requiredMonthString(row: Record<string, unknown>, key: string) {
  return typeof row[key] === 'string' && /^\d{4}-\d{2}$/.test(row[key] as string);
}

function requiredEnum(row: Record<string, unknown>, key: string, allowed: readonly string[]) {
  return allowed.includes(row[key] as string);
}

// Auto-increment ids in app exports are positive numbers; absent ids are still
// accepted (Dexie assigns them), but a wrong-typed id is rejected.
function validId(row: Record<string, unknown>) {
  const value = row.id;
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 1);
}

const IMPORT_TABLE_VALIDATORS: Record<string, (row: Record<string, unknown>) => boolean> = {
  transactions: (row) =>
    validId(row) &&
    requiredEnum(row, 'type', ['expense', 'income']) &&
    requiredNumber(row, 'amount', 0) &&
    requiredString(row, 'category') &&
    requiredDateString(row, 'date') &&
    requiredNumber(row, 'createdAt') &&
    optionalNumber(row, 'walletId'),
  categories: (row) =>
    validId(row) &&
    requiredString(row, 'name') &&
    requiredEnum(row, 'type', ['expense', 'income']) &&
    typeof row.icon === 'string' &&
    typeof row.color === 'string',
  budgets: (row) =>
    validId(row) && requiredString(row, 'category') && requiredNumber(row, 'monthlyLimit', 0),
  debts: (row) =>
    validId(row) &&
    requiredEnum(row, 'type', ['to_me', 'on_me']) &&
    requiredString(row, 'personName') &&
    requiredNumber(row, 'totalAmount', 0) &&
    optionalNumber(row, 'paidAmount') &&
    requiredBoolean(row, 'isCompleted') &&
    requiredNumber(row, 'createdAt'),
  gam3eyat: (row) =>
    validId(row) &&
    requiredString(row, 'name') &&
    requiredNumber(row, 'monthlyAmount', 0) &&
    requiredNumber(row, 'totalMonths', 1) &&
    requiredNumber(row, 'myTurnMonth', 1) &&
    requiredNumber(row, 'paidMonths', 0) &&
    requiredMonthString(row, 'startDate') &&
    requiredBoolean(row, 'isCompleted') &&
    requiredEnum(row, 'status', ['active', 'completed']),
  savings: (row) =>
    validId(row) &&
    requiredEnum(row, 'type', ['gold_21', 'gold_24', 'usd', 'cash_cert']) &&
    requiredString(row, 'name') &&
    requiredNumber(row, 'quantity', 0) &&
    requiredNumber(row, 'buyPricePerUnit', 0) &&
    requiredNumber(row, 'currentPricePerUnit', 0) &&
    requiredDateString(row, 'date'),
  wallets: (row) =>
    validId(row) &&
    requiredString(row, 'name') &&
    requiredEnum(row, 'kind', ['cash', 'card', 'mobile', 'other']) &&
    requiredNumber(row, 'balance') &&
    requiredNumber(row, 'createdAt'),
  savingsGoals: (row) =>
    validId(row) &&
    requiredString(row, 'name') &&
    requiredNumber(row, 'targetAmount', 0) &&
    requiredNumber(row, 'savedAmount', 0) &&
    requiredNumber(row, 'createdAt'),
  recurringTransactions: (row) =>
    validId(row) &&
    requiredString(row, 'name') &&
    requiredEnum(row, 'type', ['expense', 'income']) &&
    requiredNumber(row, 'amount', 0) &&
    requiredString(row, 'category') &&
    requiredNumber(row, 'walletId', 1) &&
    requiredNumber(row, 'dayOfMonth', 1) &&
    requiredDateString(row, 'nextDueDate') &&
    requiredBoolean(row, 'isActive') &&
    requiredNumber(row, 'createdAt'),
};

const IMPORT_TABLE_LABELS: Record<string, string> = {
  transactions: 'المعاملات',
  categories: 'التصنيفات',
  budgets: 'الميزانيات',
  debts: 'الديون',
  gam3eyat: 'الجمعيات',
  savings: 'المدخرات والأصول',
  wallets: 'الأماكن المالية',
  savingsGoals: 'أهداف الادخار',
  recurringTransactions: 'المعاملات المتكررة',
};

/**
 * Validates every known table present in a restore payload. Tables that are
 * absent are skipped (legacy backups), unknown tables are ignored (forward
 * compatibility). Returns an Arabic error message, or null when the data is
 * safe to import.
 */
export function findInvalidImportTable(data: unknown): string | null {
  if (!isRecord(data)) return 'بنية بيانات النسخة غير صالحة.';
  for (const [table, rows] of Object.entries(data)) {
    const validator = IMPORT_TABLE_VALIDATORS[table];
    if (!validator) continue;
    const label = IMPORT_TABLE_LABELS[table] || table;
    if (!Array.isArray(rows)) return `بيانات "${label}" في النسخة غير صالحة.`;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      if (!isRecord(row) || !validator(row)) {
        return `النسخة تحتوي على سجل غير صالح في "${label}" (سجل رقم ${index + 1}).`;
      }
    }
  }
  return null;
}

export async function exportAllDataAsJSON() {
  const transactions = await db.transactions.toArray();
  const categories = await db.categories.toArray();
  const budgets = await db.budgets.toArray();
  const debts = await db.debts.toArray();
  const gam3eyat = await db.gam3eyat.toArray();
  const savings = await db.savings.toArray();
  const wallets = await db.wallets.toArray();
  const savingsGoals = await db.savingsGoals.toArray();
  const recurringTransactions = await db.recurringTransactions.toArray();

  const exportedAt = new Date().toISOString();
  const backup = {
    appName: 'على قدي',
    version: '3.0',
    exportedAt,
    exportDate: exportedAt,
    data: {
      transactions,
      categories,
      budgets,
      debts,
      gam3eyat,
      savings,
      wallets,
      savingsGoals,
      recurringTransactions,
    },
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `ala_qaddi_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importDataFromJSON(
  file: File,
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const backup = JSON.parse(text);

        if (!backup.appName || !backup.data) {
          return resolve({
            success: false,
            message: 'الملف غير صالح أو ليس نسخة احتياطية من على قدي',
          });
        }

        const validationError = findInvalidImportTable(backup.data);
        if (validationError) {
          return resolve({ success: false, message: validationError });
        }

        const {
          transactions,
          categories,
          budgets,
          debts,
          gam3eyat,
          savings,
          wallets,
          savingsGoals,
          recurringTransactions,
        } = backup.data;

        await db.transaction(
          'rw',
          [
            db.transactions,
            db.categories,
            db.budgets,
            db.debts,
            db.gam3eyat,
            db.savings,
            db.wallets,
            db.savingsGoals,
            db.recurringTransactions,
          ],
          async () => {
            if (transactions && transactions.length > 0) {
              await db.transactions.clear();
              await db.transactions.bulkAdd(transactions);
            }
            if (categories && categories.length > 0) {
              await db.categories.clear();
              await db.categories.bulkAdd(categories);
            }
            if (budgets && budgets.length > 0) {
              await db.budgets.clear();
              await db.budgets.bulkAdd(budgets);
            }
            if (debts && debts.length > 0) {
              await db.debts.clear();
              await db.debts.bulkAdd(debts);
            }
            if (gam3eyat && gam3eyat.length > 0) {
              await db.gam3eyat.clear();
              await db.gam3eyat.bulkAdd(gam3eyat);
            }
            if (savings && savings.length > 0) {
              await db.savings.clear();
              await db.savings.bulkAdd(savings);
            }
            if (wallets) {
              await db.wallets.clear();
              if (wallets.length > 0) await db.wallets.bulkAdd(wallets);
            }
            // New tables are optional in legacy JSON backups; replace only when present.
            if (Array.isArray(savingsGoals)) {
              await db.savingsGoals.clear();
              if (savingsGoals.length > 0) await db.savingsGoals.bulkAdd(savingsGoals);
            }
            if (Array.isArray(recurringTransactions)) {
              await db.recurringTransactions.clear();
              if (recurringTransactions.length > 0)
                await db.recurringTransactions.bulkAdd(recurringTransactions);
            }
          },
        );

        resolve({ success: true, message: 'تم استرجاع النسخة الاحتياطية بنجاح!' });
      } catch (err) {
        resolve({
          success: false,
          message:
            'حدث خطأ أثناء قراءة الملف: ' +
            (err instanceof Error ? err.message : 'تنسيق غير مدعوم'),
        });
      }
    };
    reader.readAsText(file);
  });
}

export async function exportTransactionsToCSV() {
  const transactions = await db.transactions.toArray();
  if (transactions.length === 0) {
    alert('لا توجد معاملات لتصديرها');
    return;
  }

  // Header with UTF-8 BOM so Excel opens Arabic correctly
  const BOM = '\uFEFF';
  const headers = ['التاريخ', 'النوع', 'التصنيف', 'المبلغ (جنيه)', 'ملاحظات'];
  const rows = transactions.map((t) => [
    t.date,
    t.type === 'expense' ? 'مصروف' : 'دخل',
    `"${csvSafeCell(t.category || '').replace(/"/g, '""')}"`,
    t.amount,
    `"${csvSafeCell(t.note || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = BOM + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `تقرير_المعاملات_على_قدي_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
