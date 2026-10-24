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

export function isBeforeVirtualDate(date: Date, offset: number, now: Date = new Date()): boolean {
  return date.getTime() <= getVirtualDate(offset, now).getTime();
}
