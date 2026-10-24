export interface ChannelVideo {
  id: string;
  title: string;
  duration?: string;
  ageText?: string;
}

/** Where YouTube data comes from. InnerTube today, the official Data API later. */
export interface DataSource {
  resolveChannelId(url: string): Promise<string | null>;
  getUploadsOldestFirst(channelId: string): AsyncIterable<ChannelVideo[]>;
  getPublishDate(videoId: string): Promise<number | null>;
  getJoinedDate(channelId: string): Promise<number | null>;
}
