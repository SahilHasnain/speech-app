/**
 * Appwrite Function: Speech Ingestion Service
 *
 * Fetches Islamic speeches from YouTube channels and stores them in Appwrite.
 * Only ingests videos ≤20 minutes (1200 seconds).
 * Runs on a scheduled basis (cron job) to keep content updated.
 *
 * Environment Variables Required:
 * - APPWRITE_FUNCTION_PROJECT_ID: Appwrite project ID (auto-provided)
 * - APPWRITE_API_KEY: API key with database write permissions
 * - APPWRITE_DATABASE_ID: Database ID
 * - APPWRITE_SPEECHES_COLLECTION_ID: Speeches collection ID
 * - APPWRITE_CHANNELS_COLLECTION_ID: Channels collection ID
 * - YOUTUBE_API_KEY: YouTube Data API v3 key
 */

import { Client, Databases, ID, Query } from "node-appwrite";

/**
 * Fetches shorts video IDs from UUSH playlist (undocumented YouTube feature)
 * @param {string} channelId - YouTube channel ID
 * @param {string} apiKey - YouTube API key
 * @param {Function} log - Logging function
 * @returns {Promise<Set>} Set of shorts video IDs
 */
async function getShortsVideoIds(channelId, apiKey, log) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";
  const shortsPlaylistId = channelId.replace('UC', 'UUSH');
  const shortsIds = new Set();
  
  try {
    log(`Fetching shorts playlist (${shortsPlaylistId})...`);
    let pageToken = null;
    let totalShorts = 0;
    
    do {
      let playlistUrl = `${baseUrl}/playlistItems?part=contentDetails&playlistId=${shortsPlaylistId}&maxResults=50&key=${apiKey}`;
      
      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }
      
      const response = await fetch(playlistUrl);
      
      if (!response.ok) {
        // Shorts playlist might not exist for this channel
        log(`No shorts playlist found (this is normal if channel has no shorts)`);
        break;
      }
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        data.items.forEach(item => {
          shortsIds.add(item.contentDetails.videoId);
        });
        totalShorts += data.items.length;
      }
      
      pageToken = data.nextPageToken;
    } while (pageToken);
    
    if (totalShorts > 0) {
      log(`Found ${totalShorts} shorts to exclude`);
    }
  } catch (error) {
    log(`Could not fetch shorts playlist: ${error.message}`);
  }
  
  return shortsIds;
}

/**
 * Fetches videos from a YouTube playlist using YouTube Data API v3
 * @param {string} playlistId - YouTube playlist ID
 * @param {string} apiKey - YouTube API key
 * @param {number} maxResults - Maximum number of videos to fetch
 * @param {Function} log - Logging function
 * @returns {Promise<Object>} Object containing playlistId, playlistName, and videos array
 */
async function fetchYouTubePlaylistVideos(playlistId, apiKey, maxResults = 5000, log) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    // Fetch videos from the playlist with pagination
    const allVideoItems = [];
    let pageToken = null;
    const perPage = 50;

    while (allVideoItems.length < maxResults) {
      let playlistUrl = `${baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${perPage}&key=${apiKey}`;

      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }

      const playlistResponse = await fetch(playlistUrl);

      if (!playlistResponse.ok) {
        throw new Error(
          `YouTube API error: ${playlistResponse.status} ${playlistResponse.statusText}`,
        );
      }

      const playlistData = await playlistResponse.json();

      if (!playlistData.items || playlistData.items.length === 0) {
        break;
      }

      allVideoItems.push(...playlistData.items);

      pageToken = playlistData.nextPageToken;

      if (!pageToken) {
        break;
      }
    }

    if (allVideoItems.length === 0) {
      return { channelId: playlistId, channelName: "Unknown Playlist", videos: [] };
    }

    const limitedVideoItems = allVideoItems.slice(0, maxResults);

    // Fetch video details in batches
    const allVideosData = [];
    const batchSize = 50;

    for (let i = 0; i < limitedVideoItems.length; i += batchSize) {
      const batch = limitedVideoItems.slice(i, i + batchSize);
      const videoIds = batch
        .map((item) => item.contentDetails.videoId)
        .join(",");

      const videosResponse = await fetch(
        `${baseUrl}/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${apiKey}`,
      );

      if (!videosResponse.ok) {
        throw new Error(
          `YouTube API error: ${videosResponse.status} ${videosResponse.statusText}`,
        );
      }

      const videosData = await videosResponse.json();
      allVideosData.push(...videosData.items);
    }

    // Transform to our format
    const videos = allVideosData.map((video) => ({
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

    // Get playlist name
    const playlistResponse = await fetch(
      `${baseUrl}/playlists?part=snippet&id=${playlistId}&key=${apiKey}`,
    );
    const playlistData = await playlistResponse.json();
    const channelName = playlistData.items?.[0]?.snippet?.title || "Unknown Playlist";

    return { channelId: playlistId, channelName, videos };
  } catch (error) {
    throw new Error(`Failed to fetch YouTube playlist videos: ${error.message}`);
  }
}

/**
 * Fetches videos from a YouTube channel
 */
async function fetchYouTubeVideos(channelId, apiKey, maxResults = 5000, log, includeShorts = false) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    const channelResponse = await fetch(
      `${baseUrl}/channels?part=contentDetails,snippet&id=${channelId}&key=${apiKey}`,
    );

    if (!channelResponse.ok) {
      throw new Error(
        `YouTube API error: ${channelResponse.status} ${channelResponse.statusText}`,
      );
    }

    const channelData = await channelResponse.json();

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const channelName = channelData.items[0].snippet.title;
    const uploadsPlaylistId =
      channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Fetch shorts video IDs to exclude them
    const shortsIds = includeShorts ? new Set() : await getShortsVideoIds(channelId, apiKey, log);

    const allVideoItems = [];
    let pageToken = null;
    const perPage = 50;

    while (allVideoItems.length < maxResults) {
      let playlistUrl = `${baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${perPage}&key=${apiKey}`;

      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }

      const playlistResponse = await fetch(playlistUrl);

      if (!playlistResponse.ok) {
        throw new Error(
          `YouTube API error: ${playlistResponse.status} ${playlistResponse.statusText}`,
        );
      }

      const playlistData = await playlistResponse.json();

      if (!playlistData.items || playlistData.items.length === 0) {
        break;
      }

      allVideoItems.push(...playlistData.items);

      pageToken = playlistData.nextPageToken;

      if (!pageToken) {
        break;
      }
    }

    if (allVideoItems.length === 0) {
      return { channelId, channelName, videos: [] };
    }

    const limitedVideoItems = allVideoItems.slice(0, maxResults);

    const allVideosData = [];
    const batchSize = 50;

    for (let i = 0; i < limitedVideoItems.length; i += batchSize) {
      const batch = limitedVideoItems.slice(i, i + batchSize);
      const videoIds = batch
        .map((item) => item.contentDetails.videoId)
        .join(",");

      const videosResponse = await fetch(
        `${baseUrl}/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${apiKey}`,
      );

      if (!videosResponse.ok) {
        throw new Error(
          `YouTube API error: ${videosResponse.status} ${videosResponse.statusText}`,
        );
      }

      const videosData = await videosResponse.json();
      allVideosData.push(...videosData.items);
    }

    const videos = allVideosData
      .filter((video) => {
        // Filter out shorts using UUSH playlist
        if (shortsIds.has(video.id)) {
          return false;
        }
        return true;
      })
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

    const shortsFilteredCount = allVideosData.length - videos.length;
    if (shortsFilteredCount > 0) {
      log(`Filtered ${shortsFilteredCount} shorts from video list`);
    }

    return { channelId, channelName, videos };
  } catch (error) {
    throw new Error(`Failed to fetch YouTube videos: ${error.message}`);
  }
}

/**
 * Parses ISO 8601 duration format to seconds
 */
function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) {
    return 0;
  }

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Fetches all existing speeches from database
 */
async function getAllExistingSpeeches(databases, databaseId, collectionId) {
  try {
    const allDocuments = [];
    let offset = 0;
    const limit = 5000;

    while (true) {
      const response = await databases.listDocuments(databaseId, collectionId, [
        Query.limit(limit),
        Query.offset(offset),
      ]);

      allDocuments.push(...response.documents);

      if (response.documents.length < limit) {
        break;
      }

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
  } catch (error) {
    throw new Error(`Failed to fetch existing speeches: ${error.message}`);
  }
}

/**
 * Inserts a new speech into database
 */
async function insertSpeech(
  databases,
  databaseId,
  collectionId,
  video,
  channelName,
  channelId,
) {
  try {
    const document = await databases.createDocument(
      databaseId,
      collectionId,
      ID.unique(),
      {
        title: video.title,
        youtubeId: video.youtubeId,
        thumbnailUrl: video.thumbnailUrl,
        duration: video.duration,
        uploadDate: video.uploadDate,
        channelName: channelName,
        channelId: channelId,
        views: video.views,
        description: video.description,
        isShort: video.duration < 60,
      },
    );

    return document;
  } catch (error) {
    throw new Error(`Failed to insert speech: ${error.message}`);
  }
}

/**
 * Updates view count for existing speech
 */
async function updateSpeechViews(
  databases,
  databaseId,
  collectionId,
  documentId,
  newViews,
) {
  try {
    const document = await databases.updateDocument(
      databaseId,
      collectionId,
      documentId,
      { views: newViews },
    );

    return document;
  } catch (error) {
    throw new Error(`Failed to update speech views: ${error.message}`);
  }
}

/**
 * Fetches all channels from database
 */
async function getAllChannels(databases, databaseId, channelsCollectionId, log) {
  try {
    const allChannels = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await databases.listDocuments(
        databaseId,
        channelsCollectionId,
        [Query.limit(limit), Query.offset(offset)],
      );

      allChannels.push(...response.documents);

      if (response.documents.length < limit) {
        break;
      }

      offset += limit;
    }

    log(`Fetched ${allChannels.length} channels from database`);
    return allChannels;
  } catch (error) {
    throw new Error(`Failed to fetch channels: ${error.message}`);
  }
}

/**
 * Processes speeches for a single source (channel or playlist)
 */
async function processSource(
  databases,
  databaseId,
  collectionId,
  existingMap,
  source,
  youtubeApiKey,
  log,
  logError,
) {
  const sourceType = source.type || "channel";
  const sourceName = source.name;
  const sourceId = source.youtubeChannelId;
  const ignoreDuration = source.ignoreDuration || false;
  const includeShorts = source.includeShorts || false;

  log(`Processing ${sourceType}: ${sourceName}`);
  
  if (ignoreDuration) {
    log(`ignoreDuration is enabled for this ${sourceType}`);
  }

  try {
    let fetchedData;
    
    // Fetch videos based on source type
    if (sourceType === "playlist") {
      fetchedData = await fetchYouTubePlaylistVideos(
        sourceId,
        youtubeApiKey,
        5000,
        log,
      );
    } else {
      fetchedData = await fetchYouTubeVideos(
        sourceId,
        youtubeApiKey,
        5000,
        log,
        includeShorts,
      );
    }

    const { videos } = fetchedData;

    log(`Found ${videos.length} videos for ${sourceType}: ${sourceName}`);

    const results = {
      sourceId,
      sourceName,
      sourceType,
      processed: videos.length,
      added: 0,
      updated: 0,
      unchanged: 0,
      filtered: 0,
      errors: [],
    };

    for (const video of videos) {
      try {
        if (!includeShorts && video.duration < 60) {
          log(`Filtered: ${video.title} (duration ${video.duration}s < 60s, likely short)`);
          results.filtered++;
          continue;
        }

        // Duration filter: Only apply if ignoreDuration is false
        if (!ignoreDuration && video.duration >= 60) {
          // Filter: Only speeches ≤20 minutes (1200 seconds)
          if (video.duration > 1200) {
            log(`Filtered: ${video.title} (duration ${video.duration}s > 1200s)`);
            results.filtered++;
            continue;
          }
        }

        const existingSpeech = existingMap.get(video.youtubeId);

        if (existingSpeech) {
          // Speech exists - check if views need updating
          if (existingSpeech.views !== video.views) {
            await updateSpeechViews(
              databases,
              databaseId,
              collectionId,
              existingSpeech.documentId,
              video.views,
            );

            log(
              `Updated speech: ${video.title} (${existingSpeech.views} → ${video.views} views)`,
            );
            results.updated++;
          } else {
            results.unchanged++;
          }
        } else {
          // Insert new speech
          await insertSpeech(
            databases,
            databaseId,
            collectionId,
            video,
            sourceName,
            sourceId,
          );

          log(`Added new speech: ${video.title} (${video.youtubeId})`);
          results.added++;
        }
      } catch (err) {
        const errorMsg = `Error processing video ${video.youtubeId}: ${err.message}`;
        logError(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    return results;
  } catch (error) {
    logError(`Error processing ${sourceType} ${sourceId}: ${error.message}`);
    return {
      sourceId,
      sourceName,
      sourceType,
      processed: 0,
      added: 0,
      updated: 0,
      unchanged: 0,
      filtered: 0,
      errors: [error.message],
    };
  }
}

/**
 * Main function handler
 */
export default async ({ req, res, log, error: logError }) => {
  try {
    log("Starting speech ingestion process...");

    // Validate environment variables
    const requiredEnvVars = [
      "APPWRITE_FUNCTION_PROJECT_ID",
      "APPWRITE_API_KEY",
      "APPWRITE_DATABASE_ID",
      "APPWRITE_SPEECHES_COLLECTION_ID",
      "APPWRITE_CHANNELS_COLLECTION_ID",
      "YOUTUBE_API_KEY",
    ];

    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName],
    );

    if (missingVars.length > 0) {
      const errorMsg = `Missing required environment variables: ${missingVars.join(", ")}`;
      logError(errorMsg);
      return res.json({ success: false, error: errorMsg }, 500);
    }

    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(
        process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
      )
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    const databaseId = process.env.APPWRITE_DATABASE_ID;
    const collectionId = process.env.APPWRITE_SPEECHES_COLLECTION_ID;
    const channelsCollectionId = process.env.APPWRITE_CHANNELS_COLLECTION_ID;
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;

    // Fetch channels from database
    log("Fetching channels from database...");
    const channels = await getAllChannels(
      databases,
      databaseId,
      channelsCollectionId,
      log,
    );

    if (channels.length === 0) {
      const errorMsg =
        "No channels found in database. Please add channels first.";
      logError(errorMsg);
      return res.json({ success: false, error: errorMsg }, 500);
    }

    log(`Found ${channels.length} channel(s) to process`);

    log("Fetching existing speeches from database...");
    const existingMap = await getAllExistingSpeeches(
      databases,
      databaseId,
      collectionId,
    );

    log(`Found ${existingMap.size} existing speeches in database`);

    // Process each source (channel or playlist)
    const sourceResults = [];
    for (const source of channels) {
      const result = await processSource(
        databases,
        databaseId,
        collectionId,
        existingMap,
        source,
        youtubeApiKey,
        log,
        logError,
      );
      sourceResults.push(result);
    }

    // Calculate overall statistics
    const overallResults = {
      sourcesProcessed: sourceResults.length,
      totalProcessed: sourceResults.reduce((sum, r) => sum + r.processed, 0),
      totalAdded: sourceResults.reduce((sum, r) => sum + r.added, 0),
      totalUpdated: sourceResults.reduce((sum, r) => sum + r.updated, 0),
      totalUnchanged: sourceResults.reduce((sum, r) => sum + r.unchanged, 0),
      totalFiltered: sourceResults.reduce((sum, r) => sum + r.filtered, 0),
      totalErrors: sourceResults.reduce((sum, r) => sum + r.errors.length, 0),
    };

    log("Speech ingestion completed");
    log(
      `Overall Summary: ${overallResults.totalAdded} added, ${overallResults.totalUpdated} updated, ${overallResults.totalUnchanged} unchanged, ${overallResults.totalFiltered} filtered, ${overallResults.totalErrors} errors across ${overallResults.sourcesProcessed} source(s)`,
    );

    return res.json({
      success: true,
      overall: overallResults,
      sources: sourceResults,
    });
  } catch (err) {
    const errorMsg = `Fatal error during ingestion: ${err.message}`;
    logError(errorMsg);

    return res.json({ success: false, error: errorMsg }, 500);
  }
};
