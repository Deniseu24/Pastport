import { endOfDay, formatCountdown } from '@/core/clock';
import { getCachedTimeline, setCachedTimeline } from './cache';
import type { DataSource } from './source';
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

  constructor(
    private source: DataSource,
    private virtualDate: Date,
  ) {}

  async show(url: URL): Promise<void> {
    const run = ++this.run;
    const primary = await waitFor(activeChannelPrimary);
    if (!primary || run !== this.run) return;

    const root = mount(primary);
    root.replaceChildren(message('Traveling back in time...', `Heading to ${dateFormat.format(this.virtualDate)}`));
    this.watchHeader(null);

    try {
      const channelId = await this.source.resolveChannelId(url.origin + url.pathname.replace(/\/(featured|videos)\/?$/, ''));
      if (!channelId) throw new Error('Channel not found');

      const timeline = await this.loadTimeline(channelId, (scanned) => {
        if (run !== this.run) return;
        root.replaceChildren(
          message('Traveling back in time...', `Heading to ${dateFormat.format(this.virtualDate)}. Checked ${scanned} videos.`),
        );
      });
      if (run !== this.run) return;

      this.watchHeader(timeline.videos.length);
      root.replaceChildren(timeline.videos.length ? grid(timeline) : this.emptyState(timeline));
    } catch (error) {
      if (run !== this.run) return;
      console.error('[Pastport]', error);
      root.replaceChildren(message('The time machine stalled.', 'Could not load this channel. Try reloading the page.'));
    }
  }

  hide(): void {
    this.run++;
    window.clearInterval(this.headerTimer);
    document.querySelectorAll(`.${ROOT_CLASS}`).forEach((el) => el.remove());
    document.querySelectorAll(`.${ACTIVE_CLASS}`).forEach((el) => el.classList.remove(ACTIVE_CLASS));
    document.querySelectorAll('[data-pastport-hidden]').forEach((el) => {
      (el as HTMLElement).style.display = '';
      el.removeAttribute('data-pastport-hidden');
    });
  }

  private async loadTimeline(channelId: string, onProgress: (scanned: number) => void): Promise<ChannelTimeline> {
    const target = endOfDay(this.virtualDate);
    const key = `${channelId}:${target.toDateString()}`;

    const cached = await getCachedTimeline(key);
    if (cached) return cached;

    const timeline = await loadChannelTimeline(this.source, channelId, target.getTime(), onProgress);
    await setCachedTimeline(key, timeline);
    return timeline;
  }

  private emptyState(timeline: ChannelTimeline): HTMLElement {
    const name = channelName();

    if (timeline.joinedAt && timeline.joinedAt > this.virtualDate.getTime()) {
      const wait = formatCountdown(this.virtualDate, new Date(timeline.joinedAt));
      return message(`${name} hasn't joined YouTube yet!`, `This channel opens in ${wait}.`);
    }
    if (timeline.firstUploadAt) {
      const wait = formatCountdown(this.virtualDate, new Date(timeline.firstUploadAt));
      return message(`${name} hasn't started creating yet!`, `Their first video drops in ${wait}.`);
    }
    return message('Nothing here yet.', `${name} has no videos from before ${dateFormat.format(this.virtualDate)}.`);
  }

  /** The header re-renders on its own, so keep patching it while the page is open. */
  private watchHeader(videoCount: number | null): void {
    window.clearInterval(this.headerTimer);
    const patch = () => patchHeader(videoCount, this.virtualDate);
    patch();
    this.headerTimer = window.setInterval(patch, 500);
  }
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

function patchHeader(videoCount: number | null, virtualDate: Date): void {
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

  if (virtualDate < SHORTS_LAUNCH) {
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

function grid(timeline: ChannelTimeline): HTMLElement {
  const container = el('div', 'pastport-grid');

  for (const video of timeline.videos) {
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

    link.append(thumb, el('h3', 'pastport-title', video.title));
    container.append(link);
  }

  return container;
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
