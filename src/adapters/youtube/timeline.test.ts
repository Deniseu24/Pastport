import { describe, expect, it } from 'vitest';
import { parseRelativeTime } from './relative-time';
import type { ChannelVideo, DataSource } from './source';
import { loadChannelTimeline } from './timeline';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 24);

function ago(date: number): string {
  const days = Math.floor((NOW - date) / DAY);
  if (days >= 365) return `${Math.floor(days / 365.25)} years ago`;
  if (days >= 30) return `${Math.floor(days / 30.44)} months ago`;
  return `${days} days ago`;
}

/** A channel that uploaded once a day between two dates. */
function fakeChannel(start: number, end: number, pageSize = 30) {
  const dates = new Map<string, number>();
  const videos: ChannelVideo[] = [];
  for (let date = start; date <= end; date += DAY) {
    const id = `v${videos.length}`;
    dates.set(id, date);
    videos.push({ id, title: id, ageText: ago(date) });
  }

  let lookups = 0;
  let pages = 0;
  const source: DataSource = {
    resolveChannelId: async () => 'UC1',
    async *getUploadsOldestFirst() {
      for (let i = 0; i < videos.length; i += pageSize) {
        pages++;
        yield videos.slice(i, i + pageSize);
      }
    },
    getPublishDate: async (id) => {
      lookups++;
      return dates.get(id) ?? null;
    },
    getJoinedDate: async () => start - 30 * DAY,
  };

  return { source, dates, stats: () => ({ lookups, pages }) };
}

describe('parseRelativeTime', () => {
  it('parses common formats', () => {
    expect(parseRelativeTime('15 years ago', NOW)).not.toBeNull();
    expect(parseRelativeTime('6 hr ago', NOW)).not.toBeNull();
    expect(parseRelativeTime('Streamed 2 months ago', NOW)).not.toBeNull();
    expect(parseRelativeTime('259K views', NOW)).toBeNull();
  });

  it('returns a range around the real date', () => {
    const range = parseRelativeTime('12 years ago', NOW)!;
    const real = Date.UTC(2014, 3, 1);
    expect(range.earliest).toBeLessThanOrEqual(real);
    expect(range.latest).toBeGreaterThanOrEqual(real);
  });
});

describe('loadChannelTimeline', () => {
  it('cuts exactly at the target date', async () => {
    const { source, dates, stats } = fakeChannel(Date.UTC(2010, 0, 1), Date.UTC(2026, 9, 20));
    const target = Date.UTC(2014, 9, 24, 23, 59);

    const timeline = await loadChannelTimeline(source, 'UC1', target, undefined, NOW);
    const newest = dates.get(timeline.videos[0]!.id)!;

    expect(newest).toBeLessThanOrEqual(target);
    expect(newest + DAY).toBeGreaterThan(target);
    expect(timeline.videos.every((v) => dates.get(v.id)! <= target)).toBe(true);
    expect(stats().lookups).toBeLessThan(15);
  });

  it('stops paging after the target date', async () => {
    const { source, stats } = fakeChannel(Date.UTC(2010, 0, 1), Date.UTC(2026, 9, 20));
    await loadChannelTimeline(source, 'UC1', Date.UTC(2011, 0, 1), undefined, NOW);
    expect(stats().pages).toBeLessThan(40);
  });

  it('reports the first upload when nothing is out yet', async () => {
    const start = Date.UTC(2016, 5, 1);
    const { source } = fakeChannel(start, Date.UTC(2017, 0, 1));

    const timeline = await loadChannelTimeline(source, 'UC1', Date.UTC(2014, 9, 24), undefined, NOW);

    expect(timeline.videos).toHaveLength(0);
    expect(timeline.firstUploadAt).toBe(start);
    expect(timeline.joinedAt).toBe(start - 30 * DAY);
  });
});
