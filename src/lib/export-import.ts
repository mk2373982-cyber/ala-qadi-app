import { db } from './db';

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
      } catch (err: any) {
        resolve({ success: false, message: 'حدث خطأ أثناء قراءة الملف: ' + err.message });
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
    `"${(t.category || '').replace(/"/g, '""')}"`,
    t.amount,
    `"${(t.note || '').replace(/"/g, '""')}"`,
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
