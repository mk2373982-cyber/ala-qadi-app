import { db } from './db';

export async function exportAllDataAsJSON() {
  const transactions = await db.transactions.toArray();
  const categories = await db.categories.toArray();
  const budgets = await db.budgets.toArray();
  const debts = await db.debts.toArray();
  const gam3eyat = await db.gam3eyat.toArray();
  const savings = await db.savings.toArray();

  const backup = {
    appName: 'على قدي',
    version: '1.0',
    exportDate: new Date().toISOString(),
    data: {
      transactions,
      categories,
      budgets,
      debts,
      gam3eyat,
      savings,
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

export async function importDataFromJSON(file: File): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const fail = (message: string) => resolve({ success: false, message });
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const backup = JSON.parse(text);

        if (backup.appName !== 'على قدي' || !backup.data || typeof backup.data !== 'object') {
          return resolve({ success: false, message: 'الملف غير صالح أو ليس نسخة احتياطية من على قدي' });
        }

        const { transactions, categories, budgets, debts, gam3eyat, savings } = backup.data;
        const tables = [transactions, categories, budgets, debts, gam3eyat, savings];
        if (tables.some((table) => !Array.isArray(table))) {
          return fail('النسخة غير مكتملة أو تالفة؛ لم يتم تغيير البيانات الحالية.');
        }

        await db.transaction('rw', [db.transactions, db.categories, db.budgets, db.debts, db.gam3eyat, db.savings], async () => {
          await Promise.all([
            db.transactions.clear(), db.categories.clear(), db.budgets.clear(),
            db.debts.clear(), db.gam3eyat.clear(), db.savings.clear(),
          ]);
          await Promise.all([
            transactions.length ? db.transactions.bulkAdd(transactions) : Promise.resolve(),
            categories.length ? db.categories.bulkAdd(categories) : Promise.resolve(),
            budgets.length ? db.budgets.bulkAdd(budgets) : Promise.resolve(),
            debts.length ? db.debts.bulkAdd(debts) : Promise.resolve(),
            gam3eyat.length ? db.gam3eyat.bulkAdd(gam3eyat) : Promise.resolve(),
            savings.length ? db.savings.bulkAdd(savings) : Promise.resolve(),
          ]);
        });

        resolve({ success: true, message: 'تم استرجاع النسخة الاحتياطية بنجاح!' });
      } catch (err: any) {
        resolve({ success: false, message: 'حدث خطأ أثناء قراءة الملف: ' + err.message });
      }
    };
    reader.onerror = () => fail('تعذرت قراءة ملف النسخة الاحتياطية.');
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
