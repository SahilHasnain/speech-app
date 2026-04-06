/**
 * Shared channel management logic
 * Used by both CLI scripts and API routes
 */

import { Client, Databases, ID, Query } from "node-appwrite";

export interface ChannelInfo {
  type: "channel" | "playlist";
  youtubeChannelId: string;
  name: string;
  thumbnailUrl: string;
  description: string;
  subscriberCount?: number;
  videoCount: number;
  ignoreDuration?: boolean;
  includeShorts?: boolean;
}

export interface AddChannelResult {
  success: boolean;
  channel?: any;
  error?: string;
}

export interface DeleteChannelResult {
  success: boolean;
  deletedSpeeches?: number;
  error?: string;
}

// Initialize Appwrite client
function getAppwriteClient() {
  const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  return new Databases(client);
}

const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
const SPEECHES_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID!;
const CHANNELS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID!;

/**
 * Fetch channel info from YouTube
 */
export async function fetchYouTubeChannelInfo(
  channelId: string,
  apiKey: string
): Promise<ChannelInfo> {
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

/**
 * Fetch playlist info from YouTube
 */
export async function fetchYouTubePlaylistInfo(
  playlistId: string,
  apiKey: string
): Promise<ChannelInfo> {
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

/**
 * Check if channel/playlist already exists
 */
export async function channelExists(youtubeChannelId: string): Promise<boolean> {
  const databases = getAppwriteClient();

  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      CHANNELS_COLLECTION_ID,
      [Query.equal("youtubeChannelId", youtubeChannelId), Query.limit(1)]
    );

    return response.documents.length > 0;
  } catch (error) {
    throw new Error(`Failed to check channel existence: ${error}`);
  }
}

/**
 * Add a new channel to the database
 */
export async function addChannel(channelInfo: ChannelInfo): Promise<AddChannelResult> {
  const databases = getAppwriteClient();

  try {
    // Check if already exists
    const exists = await channelExists(channelInfo.youtubeChannelId);
    if (exists) {
      return {
        success: false,
        error: "Channel already exists in the database",
      };
    }

    // Create channel document
    const document = await databases.createDocument(
      DATABASE_ID,
      CHANNELS_COLLECTION_ID,
      ID.unique(),
      {
        type: channelInfo.type,
        name: channelInfo.name,
        youtubeChannelId: channelInfo.youtubeChannelId,
        thumbnailUrl: channelInfo.thumbnailUrl,
        description: channelInfo.description,
        ignoreDuration: channelInfo.ignoreDuration || false,
        includeShorts: channelInfo.includeShorts || false,
      }
    );

    return {
      success: true,
      channel: document,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to add channel",
    };
  }
}

/**
 * Update channel settings
 */
export async function updateChannel(
  channelId: string,
  updates: Partial<ChannelInfo>
): Promise<AddChannelResult> {
  const databases = getAppwriteClient();

  try {
    // Find the channel document
    const response = await databases.listDocuments(
      DATABASE_ID,
      CHANNELS_COLLECTION_ID,
      [Query.equal("youtubeChannelId", channelId), Query.limit(1)]
    );

    if (response.documents.length === 0) {
      return {
        success: false,
        error: "Channel not found",
      };
    }

    const channelDoc = response.documents[0];

    // Update the document
    const updated = await databases.updateDocument(
      DATABASE_ID,
      CHANNELS_COLLECTION_ID,
      channelDoc.$id,
      updates
    );

    return {
      success: true,
      channel: updated,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to update channel",
    };
  }
}

/**
 * Delete a channel and all its speeches
 */
export async function deleteChannel(
  youtubeChannelId: string
): Promise<DeleteChannelResult> {
  const databases = getAppwriteClient();

  try {
    // Find the channel document
    const channelResponse = await databases.listDocuments(
      DATABASE_ID,
      CHANNELS_COLLECTION_ID,
      [Query.equal("youtubeChannelId", youtubeChannelId), Query.limit(1)]
    );

    if (channelResponse.documents.length === 0) {
      return {
        success: false,
        error: "Channel not found",
      };
    }

    const channelDoc = channelResponse.documents[0];

    // Delete all speeches for this channel
    let deletedCount = 0;
    let offset = 0;
    const limit = 100;

    while (true) {
      const speechesResponse = await databases.listDocuments(
        DATABASE_ID,
        SPEECHES_COLLECTION_ID,
        [
          Query.equal("channelId", youtubeChannelId),
          Query.limit(limit),
          Query.offset(offset),
        ]
      );

      if (speechesResponse.documents.length === 0) break;

      // Delete speeches in batch
      for (const speech of speechesResponse.documents) {
        await databases.deleteDocument(
          DATABASE_ID,
          SPEECHES_COLLECTION_ID,
          speech.$id
        );
        deletedCount++;
      }

      if (speechesResponse.documents.length < limit) break;
      offset += limit;
    }

    // Delete the channel document
    await databases.deleteDocument(DATABASE_ID, CHANNELS_COLLECTION_ID, channelDoc.$id);

    return {
      success: true,
      deletedSpeeches: deletedCount,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to delete channel",
    };
  }
}

/**
 * Get all channels
 */
export async function getAllChannels() {
  const databases = getAppwriteClient();

  const allChannels = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await databases.listDocuments(
      DATABASE_ID,
      CHANNELS_COLLECTION_ID,
      [Query.limit(limit), Query.offset(offset)]
    );

    allChannels.push(...response.documents);

    if (response.documents.length < limit) break;
    offset += limit;
  }

  return allChannels;
}
