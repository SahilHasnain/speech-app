/**
 * Shared channel management logic
 * Used by both CLI scripts and API routes
 */

import { Client, Databases, ID, Query, Storage } from "node-appwrite";

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
  deletedVideos?: number;
  error?: string;
}

// Initialize Appwrite client
function getAppwriteClient() {
  const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
const SPEECHES_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID!;
const CHANNELS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID!;
const VIDEO_BUCKET_ID = "video-files";

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
  const { databases } = getAppwriteClient();

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
  const { databases } = getAppwriteClient();

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
  const { databases } = getAppwriteClient();

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
  const { databases, storage } = getAppwriteClient();

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

    // Delete all speeches for this channel - keep fetching until none left
    let deletedSpeechesCount = 0;
    let deletedVideosCount = 0;
    let hasMore = true;

    console.log(`Starting deletion for channel: ${youtubeChannelId}`);

    while (hasMore) {
      // Always fetch from offset 0 since we're deleting as we go
      const speechesResponse = await databases.listDocuments(
        DATABASE_ID,
        SPEECHES_COLLECTION_ID,
        [
          Query.equal("channelId", youtubeChannelId),
          Query.limit(100),
        ]
      );

      console.log(`Found ${speechesResponse.documents.length} speeches to delete`);

      if (speechesResponse.documents.length === 0) {
        hasMore = false;
        break;
      }

      // Delete speeches and their videos in this batch
      for (const speech of speechesResponse.documents) {
        try {
          // Delete video file from storage if it exists
          if (speech.videoId) {
            try {
              await storage.deleteFile(VIDEO_BUCKET_ID, speech.videoId);
              deletedVideosCount++;
              console.log(`Deleted video file: ${speech.videoId}`);
            } catch (videoErr: any) {
              // Video might not exist or already deleted, log but continue
              console.warn(`Could not delete video ${speech.videoId}:`, videoErr.message);
            }
          }

          // Delete speech document
          await databases.deleteDocument(
            DATABASE_ID,
            SPEECHES_COLLECTION_ID,
            speech.$id
          );
          deletedSpeechesCount++;
          console.log(`Deleted speech ${deletedSpeechesCount}: ${speech.$id}`);
        } catch (err: any) {
          console.error(`Failed to delete speech ${speech.$id}:`, err.message);
          // Continue with other speeches even if one fails
        }
      }

      // If we got less than 100, we're done
      if (speechesResponse.documents.length < 100) {
        hasMore = false;
      }
    }

    console.log(`Total speeches deleted: ${deletedSpeechesCount}`);
    console.log(`Total videos deleted: ${deletedVideosCount}`);

    // Delete the channel document
    try {
      await databases.deleteDocument(DATABASE_ID, CHANNELS_COLLECTION_ID, channelDoc.$id);
      console.log(`Deleted channel document: ${channelDoc.$id}`);
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to delete channel document: ${err.message}`,
      };
    }

    return {
      success: true,
      deletedSpeeches: deletedSpeechesCount,
      deletedVideos: deletedVideosCount,
    };
  } catch (error: any) {
    console.error("Delete channel error:", error);
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
  const { databases } = getAppwriteClient();

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

/**
 * Clean up orphaned speeches and videos
 * - Speeches whose channel no longer exists
 * - Videos in storage that have no corresponding speech document
 */
export async function cleanupOrphanedSpeeches(): Promise<{
  success: boolean;
  deletedCount: number;
  deletedVideos: number;
  deletedOrphanedStorageVideos: number;
  orphanedChannels: string[];
  error?: string;
}> {
  const { databases, storage } = getAppwriteClient();

  try {
    // Get all existing channel IDs
    const channels = await getAllChannels();
    const validChannelIds = new Set(channels.map((c: any) => c.youtubeChannelId));

    console.log(`Found ${validChannelIds.size} valid channels`);

    // Get all speeches
    const allSpeeches = [];
    let offset = 0;
    const limit = 5000;

    while (true) {
      const response = await databases.listDocuments(
        DATABASE_ID,
        SPEECHES_COLLECTION_ID,
        [Query.limit(limit), Query.offset(offset)]
      );

      allSpeeches.push(...response.documents);

      if (response.documents.length < limit) break;
      offset += limit;
    }

    console.log(`Found ${allSpeeches.length} total speeches`);

    // Create a set of all valid video IDs from speeches
    const validVideoIds = new Set(
      allSpeeches
        .filter((s: any) => s.videoId)
        .map((s: any) => s.videoId)
    );

    console.log(`Found ${validVideoIds.size} valid video IDs in speeches`);

    // Find orphaned speeches (from deleted channels)
    const orphanedSpeeches = allSpeeches.filter(
      (speech: any) => !validChannelIds.has(speech.channelId)
    );

    const orphanedChannels = [
      ...new Set(orphanedSpeeches.map((s: any) => s.channelId)),
    ];

    console.log(`Found ${orphanedSpeeches.length} orphaned speeches from ${orphanedChannels.length} deleted channels`);

    // Delete orphaned speeches and their videos
    let deletedCount = 0;
    let deletedVideos = 0;
    
    for (const speech of orphanedSpeeches) {
      try {
        // Delete video file from storage if it exists
        if (speech.videoId) {
          try {
            await storage.deleteFile(VIDEO_BUCKET_ID, speech.videoId);
            deletedVideos++;
            console.log(`Deleted orphaned video file: ${speech.videoId}`);
          } catch (videoErr: any) {
            console.warn(`Could not delete video ${speech.videoId}:`, videoErr.message);
          }
        }

        // Delete speech document
        await databases.deleteDocument(
          DATABASE_ID,
          SPEECHES_COLLECTION_ID,
          speech.$id
        );
        deletedCount++;
        
        if (deletedCount % 10 === 0) {
          console.log(`Deleted ${deletedCount}/${orphanedSpeeches.length} orphaned speeches`);
        }
      } catch (err: any) {
        console.error(`Failed to delete orphaned speech ${speech.$id}:`, err.message);
      }
    }

    console.log(`Phase 1 complete: deleted ${deletedCount} orphaned speeches and ${deletedVideos} videos`);

    // Phase 2: Find and delete orphaned videos in storage (videos with no speech reference)
    console.log(`\nPhase 2: Checking for orphaned videos in storage...`);
    
    let deletedOrphanedStorageVideos = 0;
    let storageOffset = 0;
    const storageLimit = 100;

    while (true) {
      const storageResponse = await storage.listFiles(VIDEO_BUCKET_ID, [
        Query.limit(storageLimit),
        Query.offset(storageOffset),
      ]);

      if (storageResponse.files.length === 0) break;

      for (const file of storageResponse.files) {
        // If this video ID is not in our valid set, it's orphaned
        if (!validVideoIds.has(file.$id)) {
          try {
            await storage.deleteFile(VIDEO_BUCKET_ID, file.$id);
            deletedOrphanedStorageVideos++;
            console.log(`Deleted orphaned storage video: ${file.$id}`);
          } catch (err: any) {
            console.warn(`Could not delete orphaned storage video ${file.$id}:`, err.message);
          }
        }
      }

      if (storageResponse.files.length < storageLimit) break;
      storageOffset += storageLimit;
    }

    console.log(`Phase 2 complete: deleted ${deletedOrphanedStorageVideos} orphaned storage videos`);
    console.log(`\nTotal cleanup: ${deletedCount} speeches, ${deletedVideos + deletedOrphanedStorageVideos} videos`);

    return {
      success: true,
      deletedCount,
      deletedVideos,
      deletedOrphanedStorageVideos,
      orphanedChannels,
    };
  } catch (error: any) {
    console.error("Cleanup orphaned speeches error:", error);
    return {
      success: false,
      deletedCount: 0,
      deletedVideos: 0,
      deletedOrphanedStorageVideos: 0,
      orphanedChannels: [],
      error: error.message || "Failed to cleanup orphaned speeches",
    };
  }
}

/**
 * Delete speeches by channel ID (for cleanup purposes)
 */
export async function deleteSpeechesByChannelId(
  channelId: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  const { databases } = getAppwriteClient();

  try {
    let deletedCount = 0;
    let hasMore = true;

    console.log(`Starting deletion of speeches for channel: ${channelId}`);

    while (hasMore) {
      const speechesResponse = await databases.listDocuments(
        DATABASE_ID,
        SPEECHES_COLLECTION_ID,
        [Query.equal("channelId", channelId), Query.limit(100)]
      );

      console.log(`Found ${speechesResponse.documents.length} speeches to delete`);

      if (speechesResponse.documents.length === 0) {
        hasMore = false;
        break;
      }

      for (const speech of speechesResponse.documents) {
        try {
          await databases.deleteDocument(
            DATABASE_ID,
            SPEECHES_COLLECTION_ID,
            speech.$id
          );
          deletedCount++;
        } catch (err: any) {
          console.error(`Failed to delete speech ${speech.$id}:`, err.message);
        }
      }

      if (speechesResponse.documents.length < 100) {
        hasMore = false;
      }
    }

    console.log(`Deleted ${deletedCount} speeches for channel ${channelId}`);

    return {
      success: true,
      deletedCount,
    };
  } catch (error: any) {
    console.error("Delete speeches error:", error);
    return {
      success: false,
      deletedCount: 0,
      error: error.message || "Failed to delete speeches",
    };
  }
}
