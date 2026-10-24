export const FIRST_YEAR = 2005;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Shifts a real date back by `offset` years. Feb 29 falls back to Feb 28. */
export function getVirtualDate(offset: number, now: Date = new Date()): Date {
  const year = now.getFullYear() - offset;
  const month = now.getMonth();
  let day = now.getDate();

  if (month === 1 && day === 29 && !isLeapYear(year)) {
    day = 28;
  }

  const date = new Date(now);
  date.setFullYear(year, month, day);
  return date;
}

export function yearToOffset(year: number, now: Date = new Date()): number {
  return now.getFullYear() - year;
}

export function offsetToYear(offset: number, now: Date = new Date()): number {
  return now.getFullYear() - offset;
}

/** Years the user can travel to, newest first. */
export function getSelectableYears(now: Date = new Date()): number[] {
  const years: number[] = [];
  for (let year = now.getFullYear() - 1; year >= FIRST_YEAR; year--) {
    years.push(year);
  }
  return years;
}

export function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function plural(amount: number, unit: string): string {
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}

/** Human readable time between two dates, like "2 years, 4 months". */
export function formatCountdown(from: Date, to: Date): string {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months--;

  const anchor = new Date(from);
  anchor.setMonth(anchor.getMonth() + months);
  const days = Math.floor((to.getTime() - anchor.getTime()) / 86_400_000);

  const years = Math.floor(months / 12);
  months %= 12;

  if (years > 0) return months > 0 ? `${plural(years, 'year')}, ${plural(months, 'month')}` : plural(years, 'year');
  if (months > 0) return days > 0 ? `${plural(months, 'month')}, ${plural(days, 'day')}` : plural(months, 'month');
  if (days > 0) return plural(days, 'day');

  const minutes = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 60_000));
  return minutes >= 60 ? plural(Math.floor(minutes / 60), 'hour') : plural(minutes, 'minute');
}

const AGE_STEPS: [string, number][] = [
  ['year', 31_556_952],
  ['month', 2_629_746],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
  ['second', 1],
];

/** YouTube style age, like "3 hours ago". */
export function formatTimeAgo(date: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - date) / 1000));
  for (const [unit, size] of AGE_STEPS) {
    const amount = Math.floor(seconds / size);
    if (amount >= 1) return `${plural(amount, unit)} ago`;
  }
  return 'just now';
}

export function isBeforeVirtualDate(date: Date, offset: number, now: Date = new Date()): boolean {
  return date.getTime() <= getVirtualDate(offset, now).getTime();
}
