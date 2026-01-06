import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();

  if (style === 'short') {
    return `${day.toString().padStart(2, '0')}.${(month + 1).toString().padStart(2, '0')}.${year}`;
  }

  return `${day}-${uzbekMonths[month]}, ${year}`;
}
