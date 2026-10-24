import { describe, expect, it } from 'vitest';
import { getSelectableYears, getVirtualDate, isBeforeVirtualDate, yearToOffset } from './clock';

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
