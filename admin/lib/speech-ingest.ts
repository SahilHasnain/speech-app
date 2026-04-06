import { Client, Databases, ID, Query } from "node-appwrite";

// Types
export interface IngestConfig {
  channels: string[];
  ingestMode: "all" | "shorts" | "speeches";
  limit: number | null; // null means all videos
}

export interface Channel {
  $id: string;
  name: string;
  youtubeChannelId: string;
  type: "channel" | "playlist";
  ignoreDuration?: boolean;
  includeShorts?: boolean;
}

export interface Video {
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  duration: number;
  uploadDate: string;
  views: number;
  description: string;
}

export interface ProgressCallback {
  (data: {
    type: "progress" | "success" | "error" | "complete" | "channel_start" | "channel_complete";
    channelId?: string;
    channelName?: string;
    current?: number;
    total?: number;
    videoTitle?: string;
    message?: string;
    action?: "fetching" | "processing" | "adding" | "updating" | "filtering";
    result?: IngestResult;
  }): void;
}

export interface IngestResult {
  channelId: string;
  channelName: string;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  errorCount: number;
  filteredDurationCount: number;
  totalVideos: number;
  error?: string;
}

// Configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!;
const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
const SPEECHES_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID!;
const CHANNELS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID!;

// Initialize Appwrite client
function getAppwriteClient() {
  const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  return new Databases(client);
}

// Parse ISO 8601 duration to seconds
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");

  return hours * 3600 + minutes * 60 + seconds;
}

// Fetch shorts video IDs from UUSH playlist
async function getShortsVideoIds(channelId: string): Promise<Set<string>> {
  const baseUrl = "https://www.googleapis.com/youtube/v3";
  const shortsPlaylistId = channelId.replace("UC", "UUSH");
  const shortsIds = new Set<string>();

  try {
    let pageToken: string | null = null;

    do {
      let playlistUrl = `${baseUrl}/playlistItems?part=contentDetails&playlistId=${shortsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}`;

      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }

      const response = await fetch(playlistUrl);

      if (!response.ok) {
        break;
      }

      const data = await response.json();

      if (data.items && data.items.length > 0) {
        data.items.forEach((item: any) => {
          shortsIds.add(item.contentDetails.videoId);
        });
      }

      pageToken = data.nextPageToken;
    } while (pageToken);
  } catch (error) {
    // Shorts playlist might not exist
  }

  return shortsIds;
}

// Fetch videos from YouTube channel
export async function fetchYouTubeVideos(
  channelId: string,
  maxResults: number | null,
  includeShorts: boolean,
  onProgress?: (message: string) => void
): Promise<{ channelName: string; videos: Video[] }> {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  // Get channel info
  const channelResponse = await fetch(
    `${baseUrl}/channels?part=contentDetails,snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`
  );

  if (!channelResponse.ok) {
    throw new Error(`YouTube API error: ${channelResponse.status}`);
  }

  const channelData = await channelResponse.json();

  if (!channelData.items || channelData.items.length === 0) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const channelName = channelData.items[0].snippet.title;
  const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

  // Fetch shorts to exclude
  const shortsIds = includeShorts ? new Set<string>() : await getShortsVideoIds(channelId);

  // Fetch videos from uploads playlist
  const allVideoItems: any[] = [];
  let pageToken: string | null = null;
  const perPage = 50;

  while (maxResults === null || allVideoItems.length < maxResults) {
    let playlistUrl = `${baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${perPage}&key=${YOUTUBE_API_KEY}`;

    if (pageToken) {
      playlistUrl += `&pageToken=${pageToken}`;
    }

    const playlistResponse = await fetch(playlistUrl);

    if (!playlistResponse.ok) {
      throw new Error(`YouTube API error: ${playlistResponse.status}`);
    }

    const playlistData = await playlistResponse.json();

    if (!playlistData.items || playlistData.items.length === 0) {
      break;
    }

    allVideoItems.push(...playlistData.items);
    onProgress?.(`Fetched ${allVideoItems.length} videos...`);

    pageToken = playlistData.nextPageToken;

    if (!pageToken) break;
    if (maxResults !== null && allVideoItems.length >= maxResults) break;
  }

  const limitedVideoItems =
    maxResults === null ? allVideoItems : allVideoItems.slice(0, maxResults);

  // Fetch video details in batches
  const allVideosData: any[] = [];
  const batchSize = 50;

  for (let i = 0; i < limitedVideoItems.length; i += batchSize) {
    const batch = limitedVideoItems.slice(i, i + batchSize);
    const videoIds = batch.map((item) => item.contentDetails.videoId).join(",");

    const videosResponse = await fetch(
      `${baseUrl}/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );

    if (!videosResponse.ok) {
      throw new Error(`YouTube API error: ${videosResponse.status}`);
    }

    const videosData = await videosResponse.json();
    allVideosData.push(...videosData.items);

    onProgress?.(`Processed details for ${allVideosData.length} videos...`);
  }

  // Transform and filter
  const videos: Video[] = allVideosData
    .filter((video) => !shortsIds.has(video.id))
    .map((video) => ({
      youtubeId: video.id,
      title: video.snippet.title,
      thumbnailUrl:
        video.snippet.thumbnails.high?.url ||
        video.snippet.thumbnails.medium?.url ||
        video.snippet.thumbnails.default?.url,
      duration: parseDuration(video.contentDetails.duration),
      uploadDate: video.snippet.publishedAt,
      views: parseInt(video.statistics?.viewCount || "0", 10),
      description: video.snippet.description || "",
    }));

  return { channelName, videos };
}

// Fetch videos from YouTube playlist
export async function fetchYouTubePlaylistVideos(
  playlistId: string,
  maxResults: number | null,
  onProgress?: (message: string) => void
): Promise<{ channelName: string; videos: Video[] }> {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  // Fetch videos from playlist
  const allVideoItems: any[] = [];
  let pageToken: string | null = null;
  const perPage = 50;

  while (maxResults === null || allVideoItems.length < maxResults) {
    let playlistUrl = `${baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${perPage}&key=${YOUTUBE_API_KEY}`;

    if (pageToken) {
      playlistUrl += `&pageToken=${pageToken}`;
    }

    const playlistResponse = await fetch(playlistUrl);

    if (!playlistResponse.ok) {
      throw new Error(`YouTube API error: ${playlistResponse.status}`);
    }

    const playlistData = await playlistResponse.json();

    if (!playlistData.items || playlistData.items.length === 0) {
      break;
    }

    allVideoItems.push(...playlistData.items);
    onProgress?.(`Fetched ${allVideoItems.length} videos...`);

    pageToken = playlistData.nextPageToken;

    if (!pageToken) break;
    if (maxResults !== null && allVideoItems.length >= maxResults) break;
  }

  const limitedVideoItems =
    maxResults === null ? allVideoItems : allVideoItems.slice(0, maxResults);

  // Fetch video details
  const allVideosData: any[] = [];
  const batchSize = 50;

  for (let i = 0; i < limitedVideoItems.length; i += batchSize) {
    const batch = limitedVideoItems.slice(i, i + batchSize);
    const videoIds = batch.map((item) => item.contentDetails.videoId).join(",");

    const videosResponse = await fetch(
      `${baseUrl}/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );

    if (!videosResponse.ok) {
      throw new Error(`YouTube API error: ${videosResponse.status}`);
    }

    const videosData = await videosResponse.json();
    allVideosData.push(...videosData.items);

    onProgress?.(`Processed details for ${allVideosData.length} videos...`);
  }

  // Get playlist name
  const playlistResponse = await fetch(
    `${baseUrl}/playlists?part=snippet&id=${playlistId}&key=${YOUTUBE_API_KEY}`
  );
  const playlistData = await playlistResponse.json();
  const channelName = playlistData.items?.[0]?.snippet?.title || "Unknown Playlist";

  const videos: Video[] = allVideosData.map((video) => ({
    youtubeId: video.id,
    title: video.snippet.title,
    thumbnailUrl:
      video.snippet.thumbnails.high?.url ||
      video.snippet.thumbnails.medium?.url ||
      video.snippet.thumbnails.default?.url,
    duration: parseDuration(video.contentDetails.duration),
    uploadDate: video.snippet.publishedAt,
    views: parseInt(video.statistics?.viewCount || "0", 10),
    description: video.snippet.description || "",
  }));

  return { channelName, videos };
}

// Get all existing speeches
export async function getAllExistingSpeeches(): Promise<
  Map<string, { documentId: string; views: number }>
> {
  const databases = getAppwriteClient();
  const allDocuments: any[] = [];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const response = await databases.listDocuments(DATABASE_ID, SPEECHES_COLLECTION_ID, [
      Query.limit(limit),
      Query.offset(offset),
    ]);

    allDocuments.push(...response.documents);

    if (response.documents.length < limit) break;
    offset += limit;
  }

  const existingMap = new Map();
  allDocuments.forEach((doc) => {
    existingMap.set(doc.youtubeId, {
      documentId: doc.$id,
      views: doc.views || 0,
    });
  });

  return existingMap;
}

// Process a single channel
export async function ingestChannelSpeeches(
  channel: Channel,
  existingMap: Map<string, { documentId: string; views: number }>,
  config: IngestConfig,
  progressCallback: ProgressCallback
): Promise<IngestResult> {
  const databases = getAppwriteClient();

  try {
    progressCallback({
      type: "channel_start",
      channelId: channel.youtubeChannelId,
      channelName: channel.name,
      message: `Fetching videos from YouTube...`,
    });

    // Fetch videos
    let sourceData;
    if (channel.type === "playlist") {
      sourceData = await fetchYouTubePlaylistVideos(
        channel.youtubeChannelId,
        config.limit,
        (msg) =>
          progressCallback({
            type: "progress",
            channelId: channel.youtubeChannelId,
            channelName: channel.name,
            action: "fetching",
            message: msg,
          })
      );
    } else {
      sourceData = await fetchYouTubeVideos(
        channel.youtubeChannelId,
        config.limit,
        channel.includeShorts || false,
        (msg) =>
          progressCallback({
            type: "progress",
            channelId: channel.youtubeChannelId,
            channelName: channel.name,
            action: "fetching",
            message: msg,
          })
      );
    }

    const { channelName, videos } = sourceData;

    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;
    let filteredDurationCount = 0;

    // Process each video
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const isShort = video.duration < 60;

      try {
        // Apply ingest mode filter
        if (config.ingestMode === "shorts" && !isShort) {
          filteredDurationCount++;
          continue;
        }

        if (config.ingestMode === "speeches" && isShort) {
          filteredDurationCount++;
          continue;
        }

        // Filter shorts if channel doesn't include them
        if (!(channel.includeShorts || false) && isShort) {
          filteredDurationCount++;
          continue;
        }

        // Duration filter (only if ignoreDuration is false)
        if (!(channel.ignoreDuration || false) && !isShort && video.duration > 1200) {
          filteredDurationCount++;
          continue;
        }

        const existingSpeech = existingMap.get(video.youtubeId);

        if (existingSpeech) {
          // Update views if changed
          if (existingSpeech.views !== video.views) {
            await databases.updateDocument(
              DATABASE_ID,
              SPEECHES_COLLECTION_ID,
              existingSpeech.documentId,
              { views: video.views }
            );
            updatedCount++;
            progressCallback({
              type: "success",
              channelId: channel.youtubeChannelId,
              channelName: channel.name,
              current: i + 1,
              total: videos.length,
              videoTitle: video.title,
              action: "updating",
              message: `Updated views: ${existingSpeech.views} → ${video.views}`,
            });
          } else {
            unchangedCount++;
          }
        } else {
          // Create new speech
          await databases.createDocument(DATABASE_ID, SPEECHES_COLLECTION_ID, ID.unique(), {
            title: video.title,
            youtubeId: video.youtubeId,
            thumbnailUrl: video.thumbnailUrl,
            duration: video.duration,
            uploadDate: video.uploadDate,
            channelName: channelName,
            channelId: channel.youtubeChannelId,
            views: video.views,
            description: video.description,
            isShort: isShort,
          });
          newCount++;
          progressCallback({
            type: "success",
            channelId: channel.youtubeChannelId,
            channelName: channel.name,
            current: i + 1,
            total: videos.length,
            videoTitle: video.title,
            action: "adding",
            message: `Added new speech (${video.views} views, ${video.duration}s)`,
          });
        }
      } catch (error: any) {
        errorCount++;
        progressCallback({
          type: "error",
          channelId: channel.youtubeChannelId,
          channelName: channel.name,
          current: i + 1,
          total: videos.length,
          videoTitle: video.title,
          message: error.message,
        });
      }
    }

    const result: IngestResult = {
      channelId: channel.youtubeChannelId,
      channelName: channel.name,
      newCount,
      updatedCount,
      unchangedCount,
      errorCount,
      filteredDurationCount,
      totalVideos: videos.length,
    };

    progressCallback({
      type: "channel_complete",
      channelId: channel.youtubeChannelId,
      channelName: channel.name,
      result,
    });

    return result;
  } catch (error: any) {
    const result: IngestResult = {
      channelId: channel.youtubeChannelId,
      channelName: channel.name,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      errorCount: 0,
      filteredDurationCount: 0,
      totalVideos: 0,
      error: error.message,
    };

    progressCallback({
      type: "error",
      channelId: channel.youtubeChannelId,
      channelName: channel.name,
      message: error.message,
    });

    return result;
  }
}

// Main ingest function
export async function ingestSpeeches(
  config: IngestConfig,
  progressCallback: ProgressCallback
): Promise<IngestResult[]> {
  const databases = getAppwriteClient();

  // Fetch channels
  const channelsResponse = await databases.listDocuments(DATABASE_ID, CHANNELS_COLLECTION_ID, [
    Query.limit(100),
  ]);

  const allChannels = channelsResponse.documents as any[];
  const selectedChannels = allChannels.filter((c) =>
    config.channels.includes(c.youtubeChannelId)
  );

  if (selectedChannels.length === 0) {
    throw new Error("No channels selected");
  }

  // Get existing speeches
  const existingMap = await getAllExistingSpeeches();

  // Process each channel
  const results: IngestResult[] = [];

  for (const channel of selectedChannels) {
    const result = await ingestChannelSpeeches(channel, existingMap, config, progressCallback);
    results.push(result);
  }

  progressCallback({
    type: "complete",
    message: "Ingestion complete",
  });

  return results;
}
