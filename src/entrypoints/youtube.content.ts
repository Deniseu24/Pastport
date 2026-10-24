import { ChannelPage, isChannelVideosPage } from '@/adapters/youtube/channel-page';
import { InnerTubeSource } from '@/adapters/youtube/innertube';
import '@/adapters/youtube/style.css';
import { getVirtualDate } from '@/core/clock';
import { enabledSetting, offsetSetting } from '@/core/settings';

export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  async main() {
    enabledSetting.watch(() => location.reload());
    offsetSetting.watch(() => location.reload());

    const enabled = await enabledSetting.getValue();
    if (!enabled) return;

    const offset = await offsetSetting.getValue();
    const channelPage = new ChannelPage(new InnerTubeSource(), getVirtualDate(offset));

    let current = '';
    const route = () => {
      const url = new URL(location.href);
      if (url.pathname === current) return;
      current = url.pathname;

      channelPage.hide();
      if (isChannelVideosPage(url.pathname)) channelPage.show(url);
    };

    document.addEventListener('yt-navigate-finish', route);
    route();
  },
});
