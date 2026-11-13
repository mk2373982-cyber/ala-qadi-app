const egyptianNumber = new Intl.NumberFormat('ar-EG', {
  maximumFractionDigits: 2,
});

const egyptianDate = new Intl.DateTimeFormat('ar-EG', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatAmount(amount: number) {
  return egyptianNumber.format(Number.isFinite(amount) ? amount : 0);
}

export function formatCurrency(amount: number) {
  return `${formatAmount(amount)} ج.م`;
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
  const parsed =
    date instanceof Date
      ? date
      : new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date);
  if (!Number.isFinite(parsed.getTime())) return 'تاريخ غير صالح';
  return options
    ? new Intl.DateTimeFormat('ar-EG', options).format(parsed)
    : egyptianDate.format(parsed);
}
