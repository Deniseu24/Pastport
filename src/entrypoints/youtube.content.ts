import { getVirtualDate } from '@/core/clock';
import { enabledSetting, offsetSetting } from '@/core/settings';

export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  async main() {
    const enabled = await enabledSetting.getValue();
    if (!enabled) return;

    const offset = await offsetSetting.getValue();
    console.log('[Pastport] Virtual date:', getVirtualDate(offset).toDateString());
  },
});
