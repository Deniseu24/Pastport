const DAY = 86_400_000;

const UNITS: Record<string, number> = {
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: DAY,
  week: 7 * DAY,
  month: 30.44 * DAY,
  year: 365.25 * DAY,
};

const ALIASES: Record<string, string> = {
  sec: 'second',
  min: 'minute',
  hr: 'hour',
};

export interface DateRange {
  earliest: number;
  latest: number;
}

/**
 * Turns text like "15 years ago" into the range of timestamps it can mean.
 * The range is kept wide on purpose, exact dates are looked up when it matters.
 */
export function parseRelativeTime(text: string, now: number = Date.now()): DateRange | null {
  const match = text.match(/(\d+)\s*(second|sec|minute|min|hour|hr|day|week|month|year)s?\b.*ago/i);
  if (!match?.[1] || !match[2]) return null;

  const amount = Number(match[1]);
  const name = match[2].toLowerCase();
  const unit = UNITS[ALIASES[name] ?? name];
  if (!unit) return null;

  return {
    earliest: now - (amount + 1) * unit,
    latest: now - Math.max(0, amount - 1) * unit,
  };
}
