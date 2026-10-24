import { storage } from '#imports';

export const enabledSetting = storage.defineItem<boolean>('sync:enabled', {
  fallback: false,
});

export const offsetSetting = storage.defineItem<number>('sync:offset', {
  fallback: 12,
});
