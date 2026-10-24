import { storage } from '#imports';
import type { ChannelTimeline } from './timeline';

const MAX_ENTRIES = 20;

interface Entry {
  key: string;
  timeline: ChannelTimeline;
}

const timelines = storage.defineItem<Entry[]>('local:timelines', { fallback: [] });

export async function getCachedTimeline(key: string): Promise<ChannelTimeline | null> {
  const entries = await timelines.getValue();
  return entries.find((entry) => entry.key === key)?.timeline ?? null;
}

export async function setCachedTimeline(key: string, timeline: ChannelTimeline): Promise<void> {
  const entries = (await timelines.getValue()).filter((entry) => entry.key !== key);
  entries.unshift({ key, timeline });
  await timelines.setValue(entries.slice(0, MAX_ENTRIES));
}
