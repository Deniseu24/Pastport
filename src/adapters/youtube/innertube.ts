import type { ChannelVideo, DataSource } from './source';

const API = 'https://www.youtube.com/youtubei/v1';
const FALLBACK_VERSION = '2.20261023.01.00';
const VIDEOS_TAB_PARAMS = 'EgZ2aWRlb3PyBgQKAjoA';

type Json = any;

function readClientVersion(): string {
  for (const script of document.querySelectorAll('script')) {
    const match = script.textContent?.match(/"INNERTUBE_CLIENT_VERSION":"([\d.]+)"/);
    if (match?.[1]) return match[1];
  }
  return FALLBACK_VERSION;
}

/** Depth first search through a JSON tree. */
function findAll(node: Json, test: (value: Json) => boolean, found: Json[] = []): Json[] {
  if (!node || typeof node !== 'object') return found;
  if (test(node)) found.push(node);
  for (const value of Object.values(node)) findAll(value, test, found);
  return found;
}

function findFirst(node: Json, test: (value: Json) => boolean): Json | undefined {
  return findAll(node, test)[0];
}

function parseLockup(lockup: Json): ChannelVideo | null {
  if (lockup.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null;

  const meta = lockup.metadata?.lockupMetadataViewModel;
  const parts: string[] = (meta?.metadata?.contentMetadataViewModel?.metadataRows ?? [])
    .flatMap((row: Json) => row.metadataParts ?? [])
    .map((part: Json) => part.text?.content ?? '');
  const badge = findFirst(lockup.contentImage, (v) => typeof v.thumbnailBadgeViewModel === 'object');

  return {
    id: lockup.contentId,
    title: meta?.title?.content ?? '',
    duration: badge?.thumbnailBadgeViewModel.text,
    ageText: parts.find((part) => /ago/i.test(part)),
    views: parts.find((part) => /views?$/i.test(part)),
  };
}

export class InnerTubeSource implements DataSource {
  private version = readClientVersion();

  private async post(endpoint: string, body: object): Promise<Json> {
    const response = await fetch(`${API}/${endpoint}?prettyPrint=false`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        'x-youtube-client-name': '1',
        'x-youtube-client-version': this.version,
      },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: this.version, hl: 'en', gl: 'US' } },
        ...body,
      }),
    });
    if (!response.ok) throw new Error(`InnerTube ${endpoint} failed with ${response.status}`);
    return response.json();
  }

  async resolveChannelId(url: string): Promise<string | null> {
    const data = await this.post('navigation/resolve_url', { url });
    const id = data.endpoint?.browseEndpoint?.browseId;
    return typeof id === 'string' && id.startsWith('UC') ? id : null;
  }

  async *getUploadsOldestFirst(channelId: string): AsyncIterable<ChannelVideo[]> {
    const page = await this.post('browse', { browseId: channelId, params: VIDEOS_TAB_PARAMS });
    // The sort options come either as a dropdown or as plain chips.
    const oldest = findFirst(
      page,
      (v) => v.listItemViewModel?.title?.content === 'Oldest' || v.chipViewModel?.text === 'Oldest',
    );
    let token: string | undefined = findFirst(oldest, (v) => typeof v.continuationCommand?.token === 'string')
      ?.continuationCommand.token;

    if (!token) {
      if (findFirst(page, (v) => typeof v.lockupViewModel === 'object')) {
        throw new Error('Could not sort this channel by oldest');
      }
      return;
    }

    while (token) {
      const data = await this.post('browse', { continuation: token });
      const items = findAll(data.onResponseReceivedActions, (v) => Array.isArray(v.continuationItems))
        .flatMap((v) => v.continuationItems);

      const videos = findAll(items, (v) => typeof v.lockupViewModel === 'object')
        .map((v) => parseLockup(v.lockupViewModel))
        .filter((v): v is ChannelVideo => v !== null);
      if (videos.length) yield videos;

      token = findFirst(items, (v) => typeof v.continuationItemRenderer === 'object')
        ?.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token;
    }
  }

  async getPublishDate(videoId: string): Promise<number | null> {
    const data = await this.post('player', { videoId });
    const date = data.microformat?.playerMicroformatRenderer?.publishDate;
    return date ? Date.parse(date) : null;
  }

  async getJoinedDate(channelId: string): Promise<number | null> {
    const page = await this.post('browse', { browseId: channelId });
    const description = findFirst(page.header, (v) => typeof v.descriptionPreviewViewModel === 'object');
    const token = findFirst(description, (v) => typeof v.continuationCommand?.token === 'string')
      ?.continuationCommand.token;
    if (!token) return null;

    const about = await this.post('browse', { continuation: token });
    const text: string | undefined = findFirst(about, (v) => typeof v.joinedDateText?.content === 'string')
      ?.joinedDateText.content;
    const date = text ? Date.parse(text.replace(/^Joined\s+/i, '')) : NaN;
    return Number.isNaN(date) ? null : date;
  }
}
