import { endOfDay, formatCountdown, formatTimeAgo, getVirtualDate } from '@/core/clock';
import { getCachedTimeline, setCachedTimeline } from './cache';
import { PublishDates } from './publish-dates';
import type { ChannelVideo, DataSource } from './source';
import { loadChannelTimeline, type ChannelTimeline } from './timeline';

const SHORTS_LAUNCH = new Date(2020, 8, 14);
const CHANNEL_PATH = /^\/(@[^/]+|channel\/UC[\w-]+|c\/[^/]+|user\/[^/]+)(\/(featured|videos))?\/?$/;
const ROOT_CLASS = 'pastport-root';
const ACTIVE_CLASS = 'pastport-active';

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

export function isChannelVideosPage(path: string): boolean {
  return CHANNEL_PATH.test(path);
}

export class ChannelPage {
  private run = 0;
  private headerTimer?: number;
  private observer?: IntersectionObserver;
  private dates: PublishDates;
  private datedSource: DataSource;

  constructor(
    private source: DataSource,
    private offset: number,
    /** False once the extension was reloaded and this copy of the script is stale. */
    private isAlive: () => boolean = () => true,
  ) {
    this.dates = new PublishDates(source);
    this.datedSource = {
      resolveChannelId: (url) => source.resolveChannelId(url),
      getUploadsOldestFirst: (id) => source.getUploadsOldestFirst(id),
      getPublishDate: (id) => this.dates.get(id),
      getJoinedDate: (id) => source.getJoinedDate(id),
    };
  }

  /** The virtual clock keeps ticking while the page is open. */
  private get now(): Date {
    return getVirtualDate(this.offset);
  }

  async show(url: URL): Promise<void> {
    const run = ++this.run;
    const primary = await waitFor(activeChannelPrimary);
    if (!primary || run !== this.run) return;

    const root = mount(primary);
    const heading = `Heading to ${dateFormat.format(this.now)}`;
    root.replaceChildren(message('Traveling back in time...', heading));
    this.watchHeader(null);

    try {
      const channelId = await this.source.resolveChannelId(url.origin + url.pathname.replace(/\/(featured|videos)\/?$/, ''));
      if (!channelId) throw new Error('Channel not found');

      const timeline = await this.loadTimeline(channelId, (scanned) => {
        if (run === this.run) root.replaceChildren(message('Traveling back in time...', `${heading}. Checked ${scanned} videos.`));
      });
      const visible = await this.hideUpcoming(timeline);
      if (run !== this.run) return;

      this.watchHeader(visible.videos.length);
      root.replaceChildren(visible.videos.length ? this.grid(visible.videos) : this.emptyState(visible));
    } catch (error) {
      if (run !== this.run || !this.isAlive()) return;
      console.error('[Pastport]', error);
      root.replaceChildren(message('The time machine stalled.', 'Could not load this channel. Try reloading the page.'));
    }
  }

  hide(): void {
    this.run++;
    window.clearInterval(this.headerTimer);
    this.observer?.disconnect();
    document.querySelectorAll(`.${ROOT_CLASS}`).forEach((el) => el.remove());
    document.querySelectorAll(`.${ACTIVE_CLASS}`).forEach((el) => el.classList.remove(ACTIVE_CLASS));
    document.querySelectorAll('[data-pastport-hidden]').forEach((el) => {
      (el as HTMLElement).style.display = '';
      el.removeAttribute('data-pastport-hidden');
    });
  }

  /** Timelines are cached per virtual day, so the cut is made at the end of that day. */
  private async loadTimeline(channelId: string, onProgress: (scanned: number) => void): Promise<ChannelTimeline> {
    const target = endOfDay(this.now);
    const key = `${channelId}:${target.toDateString()}`;

    const cached = await getCachedTimeline(key);
    if (cached) return cached;

    const timeline = await loadChannelTimeline(this.datedSource, channelId, target.getTime(), onProgress);
    await setCachedTimeline(key, timeline);
    return timeline;
  }

  /** Drops videos from later today that have not been uploaded yet at the virtual time. */
  private async hideUpcoming(timeline: ChannelTimeline): Promise<ChannelTimeline> {
    const now = this.now.getTime();
    let start = 0;
    let nextUpload: number | null = null;

    for (const video of timeline.videos) {
      const date = await this.dates.get(video.id);
      if (date === null || date <= now) break;
      nextUpload = date;
      start++;
    }

    if (start === 0) return timeline;
    const videos = timeline.videos.slice(start);
    return { ...timeline, videos, firstUploadAt: videos.length ? timeline.firstUploadAt : nextUpload };
  }

  private emptyState(timeline: ChannelTimeline): HTMLElement {
    const name = channelName();
    const now = this.now;

    if (timeline.joinedAt && timeline.joinedAt > now.getTime()) {
      const wait = formatCountdown(now, new Date(timeline.joinedAt));
      return message(`${name} hasn't joined YouTube yet!`, `This channel opens in ${wait}.`);
    }
    if (timeline.firstUploadAt) {
      const wait = formatCountdown(now, new Date(timeline.firstUploadAt));
      return message(`${name} hasn't started creating yet!`, `Their first video drops in ${wait}.`);
    }
    return message('Nothing here yet.', `${name} has no videos from before ${dateFormat.format(now)}.`);
  }

  private grid(videos: ChannelVideo[]): HTMLElement {
    const container = el('div', 'pastport-grid');
    const metas = new Map<Element, { meta: HTMLElement; video: ChannelVideo }>();

    // Exact upload times are looked up only for cards that come into view.
    this.observer?.disconnect();
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const card = metas.get(entry.target);
          if (!entry.isIntersecting || !card) continue;
          this.observer?.unobserve(entry.target);
          this.dates
            .get(card.video.id)
            .then((date) => {
              if (date !== null) card.meta.textContent = metaText(card.video, date, this.now.getTime());
            })
            .catch(() => {});
        }
      },
      { rootMargin: '600px 0px' },
    );

    for (const video of videos) {
      const link = document.createElement('a');
      link.className = 'pastport-card';
      link.href = `/watch?v=${video.id}`;

      const thumb = el('div', 'pastport-thumb');
      const img = document.createElement('img');
      img.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
      img.alt = '';
      img.loading = 'lazy';
      thumb.append(img);
      if (video.duration) thumb.append(el('span', 'pastport-duration', video.duration));

      const meta = el('p', 'pastport-meta', metaText(video));
      const details = el('div', 'pastport-details');
      details.append(el('h3', 'pastport-title', video.title), meta);

      link.append(thumb, details);
      container.append(link);
      metas.set(link, { meta, video });
      this.observer.observe(link);
    }

    return container;
  }

  /** The header re-renders on its own, so keep patching it while the page is open. */
  private watchHeader(videoCount: number | null): void {
    window.clearInterval(this.headerTimer);
    const patch = () => {
      if (this.isAlive()) patchHeader(videoCount, this.now);
      else this.hide();
    };
    patch();
    this.headerTimer = window.setInterval(patch, 500);
  }
}

function metaText(video: ChannelVideo, date?: number, now?: number): string {
  const age = date !== undefined && now !== undefined ? formatTimeAgo(date, now) : undefined;
  return [video.views, age].filter(Boolean).join(' • ');
}

function activeChannelPrimary(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    'ytd-browse[page-subtype="channels"]:not([hidden]) ytd-two-column-browse-results-renderer #primary',
  );
}

function mount(primary: HTMLElement): HTMLElement {
  primary.classList.add(ACTIVE_CLASS);
  let root = primary.querySelector<HTMLElement>(`:scope > .${ROOT_CLASS}`);
  if (!root) {
    root = document.createElement('div');
    root.className = ROOT_CLASS;
    primary.prepend(root);
  }
  return root;
}

function patchHeader(videoCount: number | null, now: Date): void {
  const header = document.querySelector('ytd-browse[page-subtype="channels"]:not([hidden]) yt-page-header-renderer');
  if (!header) return;

  for (const span of header.querySelectorAll<HTMLElement>('span')) {
    if (span.children.length > 0 || span.dataset.pastportHidden !== undefined) continue;
    const text = span.textContent ?? '';

    if (/subscribers?$/i.test(text)) {
      hideElement(span);
      const delimiter = span.nextElementSibling;
      if (delimiter instanceof HTMLElement && delimiter.textContent?.trim() === '•') hideElement(delimiter);
    } else if (/videos?$/i.test(text) && videoCount !== null) {
      span.textContent = `${videoCount} video${videoCount === 1 ? '' : 's'}`;
    }
  }

  if (now < SHORTS_LAUNCH) {
    document.querySelectorAll<HTMLElement>('yt-tab-shape[tab-title="Shorts"]').forEach(hideElement);
  }
}

function hideElement(el: HTMLElement): void {
  el.style.display = 'none';
  el.dataset.pastportHidden = '';
}

function channelName(): string {
  const title = document.querySelector('ytd-browse[page-subtype="channels"]:not([hidden]) yt-page-header-renderer h1');
  return title?.textContent?.trim() || 'This creator';
}

function message(title: string, detail: string): HTMLElement {
  const box = el('div', 'pastport-message');
  box.append(el('div', 'pastport-message-icon', '🕰️'), el('h2', 'pastport-message-title', title), el('p', 'pastport-message-detail', detail));
  return box;
}

function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

async function waitFor<T>(find: () => T | null, timeout = 5000): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = find();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}
