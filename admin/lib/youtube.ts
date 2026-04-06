/**
 * YouTube API utilities
 */

interface YouTubeChannelInfo {
  type: "channel";
  youtubeChannelId: string;
  name: string;
  thumbnailUrl: string;
  description: string;
  subscriberCount: number;
  videoCount: number;
}

interface YouTubePlaylistInfo {
  type: "playlist";
  youtubeChannelId: string;
  name: string;
  thumbnailUrl: string;
  description: string;
  videoCount: number;
}

export async function fetchChannelInfo(
  channelId: string,
  apiKey: string
): Promise<YouTubeChannelInfo> {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  const response = await fetch(
    `${baseUrl}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const channel = data.items[0];

  return {
    type: "channel",
    youtubeChannelId: channelId,
    name: channel.snippet.title,
    thumbnailUrl:
      channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url,
    description: channel.snippet.description || "",
    subscriberCount: parseInt(channel.statistics?.subscriberCount || "0", 10),
    videoCount: parseInt(channel.statistics?.videoCount || "0", 10),
  };
}

export async function fetchPlaylistInfo(
  playlistId: string,
  apiKey: string
): Promise<YouTubePlaylistInfo> {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  const response = await fetch(
    `${baseUrl}/playlists?part=snippet,contentDetails&id=${playlistId}&key=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error(`Playlist not found: ${playlistId}`);
  }

  const playlist = data.items[0];

  return {
    type: "playlist",
    youtubeChannelId: playlistId,
    name: playlist.snippet.title,
    thumbnailUrl:
      playlist.snippet.thumbnails.high?.url || playlist.snippet.thumbnails.default?.url,
    description: playlist.snippet.description || "",
    videoCount: parseInt(playlist.contentDetails?.itemCount || "0", 10),
  };
}
