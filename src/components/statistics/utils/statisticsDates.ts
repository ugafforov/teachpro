
/**
 * Date & month utilities for statistics
 */
export const monthNamesUz = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

export function formatMonthUz(jsDate: Date) {
  return `${monthNamesUz[jsDate.getMonth()]}, ${jsDate.getFullYear()}-yil`;
}

export function getTotalMonthsSince(firstDateStr: string | null) {
  if (!firstDateStr) return 0;
  const now = new Date();
  const first = new Date(firstDateStr);
  let months = (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth());
  if (now.getDate() >= first.getDate()) months += 1;
  months = Math.max(months, 1);
  return months;
}

export function getPeriodStartDate(period: string): string {
  const now = new Date();
  const startDate = new Date();
  switch (period) {
    case '1kun': startDate.setDate(now.getDate() - 1); break;
    case '1hafta': startDate.setDate(now.getDate() - 7); break;
    case '1oy': startDate.setMonth(now.getMonth() - 1); break;
    case '2oy': startDate.setMonth(now.getMonth() - 2); break;
    case '3oy': startDate.setMonth(now.getMonth() - 3); break;
    case '4oy': startDate.setMonth(now.getMonth() - 4); break;
    case '5oy': startDate.setMonth(now.getMonth() - 5); break;
    case '6oy': startDate.setMonth(now.getMonth() - 6); break;
    case '7oy': startDate.setMonth(now.getMonth() - 7); break;
    case '8oy': startDate.setMonth(now.getMonth() - 8); break;
    case '9oy': startDate.setMonth(now.getMonth() - 9); break;
    case '10oy': startDate.setMonth(now.getMonth() - 10); break;
    default: startDate.setMonth(now.getMonth() - 1);
  }
  return startDate.toISOString().split('T')[0];
}
