import { parseRelativeTime, type DateRange } from './relative-time';
import type { ChannelVideo, DataSource } from './source';

export interface ChannelTimeline {
  /** Videos up to the target date, newest first. */
  videos: ChannelVideo[];
  firstUploadAt: number | null;
  joinedAt: number | null;
}

interface Candidate {
  video: ChannelVideo;
  range: DateRange | null;
}

export async function loadChannelTimeline(
  source: DataSource,
  channelId: string,
  target: number,
  onProgress?: (scanned: number) => void,
  now: number = Date.now(),
): Promise<ChannelTimeline> {
  const candidates: Candidate[] = [];

  for await (const page of source.getUploadsOldestFirst(channelId)) {
    for (const video of page) {
      candidates.push({ video, range: video.ageText ? parseRelativeTime(video.ageText, now) : null });
    }
    onProgress?.(candidates.length);

    const last = candidates.at(-1)?.range;
    if (last && last.earliest > target) break;
  }

  // Uploads come oldest first, so the cut is one index. Narrow it down with the
  // rough ages, then find it with as few exact lookups as possible.
  let low = indexOrEnd(candidates, (c) => !c.range || c.range.latest > target);
  let high = Math.max(low, indexOrEnd(candidates, (c) => !!c.range && c.range.earliest > target));

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const date = await source.getPublishDate(candidates[mid]!.video.id);
    if (date !== null && date <= target) low = mid + 1;
    else high = mid;
  }

  const videos = candidates.slice(0, low).map((c) => c.video).reverse();

  let firstUploadAt: number | null = null;
  let joinedAt: number | null = null;
  if (videos.length === 0) {
    joinedAt = await source.getJoinedDate(channelId);
    const first = candidates[0];
    if (first) firstUploadAt = await source.getPublishDate(first.video.id);
  }

  return { videos, firstUploadAt, joinedAt };
}

function indexOrEnd<T>(items: T[], test: (item: T) => boolean): number {
  const index = items.findIndex(test);
  return index === -1 ? items.length : index;
}
