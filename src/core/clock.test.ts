import { describe, expect, it } from 'vitest';
import {
  formatCountdown,
  formatTimeAgo,
  getSelectableYears,
  getVirtualDate,
  isBeforeVirtualDate,
  yearToOffset,
} from './clock';

describe('formatTimeAgo', () => {
  const now = new Date(2014, 9, 24, 21, 0).getTime();

  it('uses the largest whole unit', () => {
    expect(formatTimeAgo(new Date(2014, 9, 24, 19, 30).getTime(), now)).toBe('1 hour ago');
    expect(formatTimeAgo(new Date(2014, 9, 21, 21, 0).getTime(), now)).toBe('3 days ago');
    expect(formatTimeAgo(new Date(2014, 9, 10).getTime(), now)).toBe('2 weeks ago');
    expect(formatTimeAgo(new Date(2012, 0, 1).getTime(), now)).toBe('2 years ago');
  });

  it('handles very recent uploads', () => {
    expect(formatTimeAgo(now - 5_000, now)).toBe('5 seconds ago');
    expect(formatTimeAgo(now, now)).toBe('just now');
  });
});

describe('formatCountdown', () => {
  it('formats years and months', () => {
    expect(formatCountdown(new Date(2014, 9, 24), new Date(2017, 1, 24))).toBe('2 years, 4 months');
  });

  it('formats months and days', () => {
    expect(formatCountdown(new Date(2014, 9, 24), new Date(2015, 0, 1))).toBe('2 months, 8 days');
  });

  it('formats single units', () => {
    expect(formatCountdown(new Date(2014, 9, 24), new Date(2015, 9, 24))).toBe('1 year');
    expect(formatCountdown(new Date(2014, 9, 24), new Date(2014, 9, 25))).toBe('1 day');
  });

  it('formats hours and minutes within a day', () => {
    expect(formatCountdown(new Date(2014, 9, 24, 10), new Date(2014, 9, 24, 15, 20))).toBe('5 hours');
    expect(formatCountdown(new Date(2014, 9, 24, 10), new Date(2014, 9, 24, 10, 40))).toBe('40 minutes');
  });
});

describe('getVirtualDate', () => {
  it('keeps month and day', () => {
    const now = new Date(2026, 9, 24, 12, 0);
    const virtual = getVirtualDate(12, now);
    expect(virtual.getFullYear()).toBe(2014);
    expect(virtual.getMonth()).toBe(9);
    expect(virtual.getDate()).toBe(24);
  });

  it('moves Feb 29 to Feb 28 in non leap years', () => {
    const now = new Date(2028, 1, 29);
    const virtual = getVirtualDate(1, now);
    expect(virtual.getFullYear()).toBe(2027);
    expect(virtual.getMonth()).toBe(1);
    expect(virtual.getDate()).toBe(28);
  });

  it('keeps Feb 29 in leap years', () => {
    const now = new Date(2028, 1, 29);
    expect(getVirtualDate(4, now).getDate()).toBe(29);
  });
});

describe('helpers', () => {
  const now = new Date(2026, 9, 24);

  it('converts year to offset', () => {
    expect(yearToOffset(2014, now)).toBe(12);
  });

  it('lists years from last year back to 2005', () => {
    const years = getSelectableYears(now);
    expect(years[0]).toBe(2025);
    expect(years.at(-1)).toBe(2005);
  });

  it('checks dates against the virtual date', () => {
    expect(isBeforeVirtualDate(new Date(2014, 9, 23), 12, now)).toBe(true);
    expect(isBeforeVirtualDate(new Date(2014, 9, 25), 12, now)).toBe(false);
  });
});
