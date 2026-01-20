import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, addMinutes } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Toshkent vaqtini (UTC+5) olish
 */
export function getTashkentDate(date: Date = new Date()): Date {
  // Brauzer vaqtini UTC ga o'tkazamiz va 5 soat (300 minut) qo'shamiz
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5));
}

/**
 * Toshkent vaqti bo'yicha bugungi sanani YYYY-MM-DD formatida olish
 */
export function getTashkentToday(): string {
  return format(getTashkentDate(), 'yyyy-MM-dd');
}

const uzbekMonths = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
];

export function formatDateUz(date: any, style: 'short' | 'long' = 'long'): string {
  if (!date) return style === 'short' ? '--.--.----' : "Sana yo'q";

  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'object' && 'seconds' in date) {
    // Firestore Timestamp
    d = new Date(date.seconds * 1000);
  } else {
    d = new Date(date);
  }

  if (isNaN(d.getTime())) {
    return style === 'short' ? '--.--.----' : "Noma'lum sana";
  }

  // Formatlashda Toshkent vaqtiga o'tkazamiz
  const tashkentDate = getTashkentDate(d);
  const day = tashkentDate.getDate();
  const month = tashkentDate.getMonth();
  const year = tashkentDate.getFullYear();

  if (style === 'short') {
    return `${day.toString().padStart(2, '0')}.${(month + 1).toString().padStart(2, '0')}.${year}`;
  }

  return `${day}-${uzbekMonths[month]}, ${year}`;
}
