import { storage } from '#imports';
import type { DataSource } from './source';

const MAX_SAVED = 5000;
const CONCURRENCY = 4;

const saved = storage.defineItem<Record<string, number>>('local:publishDates', { fallback: {} });

/** Exact upload times. They never change, so every lookup is kept. */
export class PublishDates {
  private known = new Map<string, number>();
  private pending = new Map<string, Promise<number | null>>();
  private ready: Promise<void>;
  private active = 0;
  private queue: (() => void)[] = [];
  private saveTimer?: number;

  constructor(private source: DataSource) {
    this.ready = saved.getValue().then((dates) => {
      for (const [id, date] of Object.entries(dates)) this.known.set(id, date);
    });
  }

  async get(videoId: string): Promise<number | null> {
    await this.ready;
    const known = this.known.get(videoId);
    if (known !== undefined) return known;

    let request = this.pending.get(videoId);
    if (!request) {
      request = this.limit(() => this.source.getPublishDate(videoId)).finally(() => this.pending.delete(videoId));
      request.then((date) => date !== null && this.remember(videoId, date)).catch(() => {});
      this.pending.set(videoId, request);
    }
    return request;
  }

  private limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        this.active++;
        task()
          .then(resolve, reject)
          .finally(() => {
            this.active--;
            this.queue.shift()?.();
          });
      };
      if (this.active < CONCURRENCY) run();
      else this.queue.push(run);
    });
  }

  private remember(videoId: string, date: number): void {
    this.known.set(videoId, date);
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      saved.setValue(Object.fromEntries([...this.known].slice(-MAX_SAVED))).catch(() => {});
    }, 1000);
  }
}
