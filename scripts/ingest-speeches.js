#!/usr/bin/env node

/**
 * Local Speech Ingestion Script
 *
 * Fetches Islamic speeches from YouTube channels and stores them in Appwrite.
 * Only ingests videos ≤20 minutes (1200 seconds).
 *
 * Usage: node scripts/ingest-speeches.js
 */

const { Client, Databases, ID, Query } = require("node-appwrite");
const readline = require("readline");
const path = require("path");
const fs = require("fs");

// Load environment variables
const envPath = fs.existsSync(path.join(__dirname, "..", ".env.local"))
  ? path.join(__dirname, "..", ".env.local")
  : path.join(__dirname, "..", "functions", ".env");

require("dotenv").config({ path: envPath });

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify question
function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Configuration
const config = {
  youtubeApiKey: process.env.YOUTUBE_API_KEY,
  appwriteEndpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  appwriteProjectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  appwriteApiKey: process.env.APPWRITE_API_KEY,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  speechesCollectionId: process.env.EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID,
  channelsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID,
};

// Validate environment variables
function validateEnv() {
  const required = [
    "YOUTUBE_API_KEY",
    "EXPO_PUBLIC_APPWRITE_ENDPOINT",
    "EXPO_PUBLIC_APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
    "EXPO_PUBLIC_APPWRITE_DATABASE_ID",
    "EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID",
    "EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error("\n💡 Please add these to your .env.local or functions/.env file");
    process.exit(1);
  }
}

// Initialize Appwrite client
function initAppwrite() {
  const client = new Client()
    .setEndpoint(config.appwriteEndpoint)
    .setProject(config.appwriteProjectId)
    .setKey(config.appwriteApiKey);

  return new Databases(client);
}

// Fetch shorts video IDs from UUSH playlist (undocumented YouTube feature)
async function getShortsVideoIds(channelId) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";
  const shortsPlaylistId = channelId.replace('UC', 'UUSH');
  const shortsIds = new Set();
  
  try {
    console.log(`   Fetching shorts playlist (${shortsPlaylistId})...`);
    let pageToken = null;
    let totalShorts = 0;
    
    do {
      let playlistUrl = `${baseUrl}/playlistItems?part=contentDetails&playlistId=${shortsPlaylistId}&maxResults=50&key=${config.youtubeApiKey}`;
      
      if (pageToken) {
        playlistUrl += `&pageToken=${pageToken}`;
      }
      
      const response = await fetch(playlistUrl);
      
      if (!response.ok) {
        // Shorts playlist might not exist for this channel
        console.log(`   ℹ️  No shorts playlist found (this is normal if channel has no shorts)`);
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
      console.log(`   ✅ Found ${totalShorts} shorts to exclude`);
    }
  } catch (error) {
    console.log(`   ℹ️  Could not fetch shorts playlist: ${error.message}`);
  }
  
  return shortsIds;
}

// Fetch videos from YouTube playlist
async function fetchYouTubePlaylistVideos(playlistId, maxResults = 5000) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    // Fetch videos from the playlist with pagination
    const allVideoItems = [];
    let pageToken = null;
    const perPage = 50;

    console.log(`   Fetching videos (limit: ${maxResults === Infinity ? 'all' : maxResults})...`);

    while (maxResults === Infinity || allVideoItems.length < maxResults) {
      let playlistUrl = `${baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=${perPage}&key=${config.youtubeApiKey}`;

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
      
      if (maxResults !== Infinity) {
        console.log(`   Fetched ${Math.min(allVideoItems.length, maxResults)} / ${maxResults} videos...`);
      } else {
        console.log(`   Fetched ${allVideoItems.length} videos...`);
      }

      pageToken = playlistData.nextPageToken;

      if (!pageToken) {
        break;
      }
      
      if (maxResults !== Infinity && allVideoItems.length >= maxResults) {
        break;
      }
    }

    if (allVideoItems.length === 0) {
      return { channelId: playlistId, channelName: "Unknown Playlist", videos: [] };
    }

    const limitedVideoItems = maxResults === Infinity ? allVideoItems : allVideoItems.slice(0, maxResults);

    // Fetch video details in batches
    const allVideosData = [];
    const batchSize = 50;

    for (let i = 0; i < limitedVideoItems.length; i += batchSize) {
      const batch = limitedVideoItems.slice(i, i + batchSize);
      const videoIds = batch
        .map((item) => item.contentDetails.videoId)
        .join(",");

      const videosResponse = await fetch(
        `${baseUrl}/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${config.youtubeApiKey}`,
      );

      if (!videosResponse.ok) {
        throw new Error(
          `YouTube API error: ${videosResponse.status} ${videosResponse.statusText}`,
        );
      }

      const videosData = await videosResponse.json();
      allVideosData.push(...videosData.items);

      console.log(`   Processed details for ${allVideosData.length} videos...`);
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
      `${baseUrl}/playlists?part=snippet&id=${playlistId}&key=${config.youtubeApiKey}`,
    );
    const playlistData = await playlistResponse.json();
    const channelName = playlistData.items?.[0]?.snippet?.title || "Unknown Playlist";

    return { channelId: playlistId, channelName, videos };
  } catch (error) {
    throw new Error(`Failed to fetch YouTube playlist videos: ${error.message}`);
  }
}

// Fetch videos from YouTube channel
async function fetchYouTubeVideos(channelId, maxResults = 5000, includeShorts = false) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    // Get channel info and uploads playlist ID
    const channelResponse = await fetch(
      `${baseUrl}/channels?part=contentDetails,snippet&id=${channelId}&key=${config.youtubeApiKey}`,
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
    const shortsIds = includeShorts ? new Set() : await getShortsVideoIds(channelId);

    // Fetch videos from uploads playlist with pagination
    const allVideoItems = [];
    let pageToken = null;
    const perPage = 50;

    console.log(`   Fetching videos (limit: ${maxResults === Infinity ? 'all' : maxResults})...`);

    while (maxResults === Infinity || allVideoItems.length < maxResults) {
      let playlistUrl = `${baseUrl}/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${perPage}&key=${config.youtubeApiKey}`;

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
      
      if (maxResults !== Infinity) {
        console.log(`   Fetched ${Math.min(allVideoItems.length, maxResults)} / ${maxResults} videos...`);
      } else {
        console.log(`   Fetched ${allVideoItems.length} videos...`);
      }

      pageToken = playlistData.nextPageToken;

      if (!pageToken) {
        break;
      }
      
      if (maxResults !== Infinity && allVideoItems.length >= maxResults) {
        break;
      }
    }

    if (allVideoItems.length === 0) {
      return { channelId, channelName, videos: [] };
    }

    const limitedVideoItems = maxResults === Infinity ? allVideoItems : allVideoItems.slice(0, maxResults);

    // Fetch video details in batches
    const allVideosData = [];
    const batchSize = 50;

    for (let i = 0; i < limitedVideoItems.length; i += batchSize) {
      const batch = limitedVideoItems.slice(i, i + batchSize);
      const videoIds = batch
        .map((item) => item.contentDetails.videoId)
        .join(",");

      const videosResponse = await fetch(
        `${baseUrl}/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${config.youtubeApiKey}`,
      );

      if (!videosResponse.ok) {
        throw new Error(
          `YouTube API error: ${videosResponse.status} ${videosResponse.statusText}`,
        );
      }

      const videosData = await videosResponse.json();
      allVideosData.push(...videosData.items);

      console.log(`   Processed details for ${allVideosData.length} videos...`);
    }

    // Transform to our format and filter out shorts
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
      console.log(`   🚫 Filtered ${shortsFilteredCount} shorts from video list`);
    }

    return { channelId, channelName, videos };
  } catch (error) {
    throw new Error(`Failed to fetch YouTube videos: ${error.message}`);
  }
}

// Parse ISO 8601 duration to seconds
function parseDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

// Get all existing speeches from database
async function getAllExistingSpeeches(databases) {
  try {
    const allDocuments = [];
    let offset = 0;
    const limit = 5000;

    while (true) {
      const response = await databases.listDocuments(
        config.databaseId,
        config.speechesCollectionId,
        [Query.limit(limit), Query.offset(offset)],
      );

      allDocuments.push(...response.documents);

      if (response.documents.length < limit) {
        break;
      }

      offset += limit;
    }

    // Create map: youtubeId -> {documentId, views}
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

// Create speech document in database
async function createSpeechDocument(databases, video, channelId, channelName) {
  const document = {
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
  };

  await databases.createDocument(
    config.databaseId,
    config.speechesCollectionId,
    ID.unique(),
    document,
  );

  return document;
}

// Update speech views
async function updateSpeechViews(databases, documentId, newViews) {
  try {
    await databases.updateDocument(
      config.databaseId,
      config.speechesCollectionId,
      documentId,
      { views: newViews },
    );
  } catch (error) {
    throw new Error(`Failed to update speech views: ${error.message}`);
  }
}

// Process a single source (channel or playlist)
async function ingestSourceSpeeches(databases, existingMap, source, maxResults = 5000, ingestMode = "all") {
  const sourceType = source.type || "channel";
  const sourceId = source.youtubeChannelId;
  const sourceName = source.name;
  
  console.log(`\n📺 Processing ${sourceType}: ${sourceId}`);
  console.log(`   Fetching videos from YouTube...`);

  let sourceData;
  if (sourceType === "playlist") {
    sourceData = await fetchYouTubePlaylistVideos(sourceId, maxResults);
  } else {
    sourceData = await fetchYouTubeVideos(sourceId, maxResults, source.includeShorts || false);
  }
  
  const { channelName, videos } = sourceData;

  console.log(`   ✅ Found ${videos.length} videos for ${sourceType}: ${channelName}`);

  // Check ignoreDuration setting
  const ignoreDuration = source.ignoreDuration || false;
  if (ignoreDuration) {
    console.log(`   ⚙️  ignoreDuration is enabled for this ${sourceType}`);
  }

  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;
  let filteredDurationCount = 0;

  for (const video of videos) {
    const { youtubeId, title, duration, views: newViews } = video;

    try {
      const isShort = duration < 60;

      // Apply ingest mode filter
      if (ingestMode === "shorts" && !isShort) {
        console.log(`   🚫 Filtered: ${title} (${duration}s, not a short)`);
        filteredDurationCount++;
        continue;
      }
      
      if (ingestMode === "speeches" && isShort) {
        console.log(`   🚫 Filtered: ${title} (${duration}s, is a short)`);
        filteredDurationCount++;
        continue;
      }

      // Universal filter: Skip shorts (< 60 seconds) if channel doesn't include shorts
      if (!(source.includeShorts || false) && isShort) {
        console.log(`   🚫 Filtered: ${title} (duration ${duration}s < 60s, channel excludes shorts)`);
        filteredDurationCount++;
        continue;
      }

      // Duration filter: Only apply if ignoreDuration is false
      if (!ignoreDuration && !isShort) {
        // Filter: Only speeches ≤20 minutes (1200 seconds)
        if (duration > 1200) {
          console.log(`   🚫 Filtered: ${title} (duration ${duration}s > 1200s)`);
          filteredDurationCount++;
          continue;
        }
      }

      const existingSpeech = existingMap.get(youtubeId);

      if (existingSpeech) {
        // Speech exists - check if views need updating
        if (existingSpeech.views !== newViews) {
          await updateSpeechViews(databases, existingSpeech.documentId, newViews);
          console.log(
            `   🔄 Updated: ${title} (${existingSpeech.views} → ${newViews} views)`,
          );
          updatedCount++;
        } else {
          console.log(`   ⏭️  Unchanged: ${title}`);
          unchangedCount++;
        }
      } else {
        // New speech - insert it
        try {
          await createSpeechDocument(databases, video, sourceId, channelName);
          console.log(`   ✅ Added: ${title} (${newViews} views, ${duration}s${isShort ? ', SHORT' : ''})`);
          newCount++;
        } catch (createError) {
          // Handle duplicate (race condition)
          if (
            createError.code === 409 ||
            createError.message.includes("already exists")
          ) {
            console.log(`   ⏭️  Skipped: ${title} (already exists)`);
            unchangedCount++;
          } else {
            throw createError;
          }
        }
      }
    } catch (error) {
      console.error(`   ❌ Error processing ${title}:`, error.message);
      errorCount++;
    }
  }

  return {
    channelId: sourceId,
    channelName: sourceName,
    newCount,
    updatedCount,
    unchangedCount,
    errorCount,
    filteredDurationCount,
    totalVideos: videos.length,
  };
}

// Main ingestion function
async function ingestSpeeches() {
  console.log("🚀 Starting speech ingestion...\n");

  try {
    validateEnv();
    console.log("✅ Environment variables validated");

    const databases = initAppwrite();
    console.log("✅ Appwrite client initialized");

    // Fetch all sources (channels/playlists) from database
    console.log("\n📦 Fetching sources from database...");
    const sourcesResponse = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.limit(100)]
    );
    
    const sources = sourcesResponse.documents;
    console.log(`✅ Found ${sources.length} source(s) to process`);

    if (sources.length === 0) {
      console.log("\n⚠️  No sources found in database.");
      console.log("   Run 'npm run add:channel' to add channels or playlists first.");
      rl.close();
      process.exit(0);
    }

    // Ask what to ingest
    console.log("\n📊 What do you want to ingest?");
    console.log("   1. Shorts only (< 60 seconds)");
    console.log("   2. Speeches only (≥ 60 seconds)");
    console.log("   3. All (both shorts and speeches)");
    const ingestChoice = await question("\nChoice (1/2/3, default: 3): ");
    
    let ingestMode = "all";
    if (ingestChoice.trim() === "1") {
      ingestMode = "shorts";
      console.log("✅ Will ingest shorts only");
    } else if (ingestChoice.trim() === "2") {
      ingestMode = "speeches";
      console.log("✅ Will ingest speeches only");
    } else {
      ingestMode = "all";
      console.log("✅ Will ingest all videos");
    }

    // Ask for number of videos to process
    console.log("\n📊 How many videos do you want to process per source?");
    console.log("   Enter a number (e.g., 100) or press Enter for all videos");
    const limitInput = await question("Limit (default: all): ");
    
    let maxResults = Infinity;
    if (limitInput.trim()) {
      const parsed = parseInt(limitInput.trim(), 10);
      if (!isNaN(parsed) && parsed > 0) {
        maxResults = parsed;
        console.log(`✅ Will process up to ${maxResults} videos per source`);
      } else {
        console.log("⚠️  Invalid number, processing all videos");
      }
    } else {
      console.log("✅ Will process all videos");
    }

    console.log("\n📦 Fetching existing speeches from database...");
    const existingMap = await getAllExistingSpeeches(databases);
    console.log(`✅ Found ${existingMap.size} existing speeches in database`);

    // Process each source
    const sourceResults = [];
    for (const source of sources) {
      try {
        const result = await ingestSourceSpeeches(databases, existingMap, source, maxResults, ingestMode);
        sourceResults.push(result);
      } catch (error) {
        console.error(`\n❌ Error processing source ${source.youtubeChannelId}:`, error.message);
        sourceResults.push({
          channelId: source.youtubeChannelId,
          channelName: source.name || "Unknown",
          newCount: 0,
          updatedCount: 0,
          unchangedCount: 0,
          errorCount: 0,
          filteredDurationCount: 0,
          totalVideos: 0,
          error: error.message,
        });
      }
    }

    // Print per-source statistics
    console.log("\n" + "=".repeat(60));
    console.log("📊 Per-Source Statistics:");
    console.log("=".repeat(60));

    for (const result of sourceResults) {
      console.log(`\n📺 ${result.channelName} (${result.channelId}):`);
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   📹 Total videos: ${result.totalVideos}`);
        console.log(`   ✅ New speeches added: ${result.newCount}`);
        console.log(`   🔄 Speeches updated: ${result.updatedCount}`);
        console.log(`   ⏭️  Speeches unchanged: ${result.unchangedCount}`);
        console.log(`   🚫 Videos filtered by duration (>20min or <1min): ${result.filteredDurationCount}`);
        console.log(`   ❌ Errors: ${result.errorCount}`);
      }
    }

    // Print overall summary
    const totalNew = sourceResults.reduce((sum, r) => sum + r.newCount, 0);
    const totalUpdated = sourceResults.reduce((sum, r) => sum + r.updatedCount, 0);
    const totalUnchanged = sourceResults.reduce((sum, r) => sum + r.unchangedCount, 0);
    const totalErrors = sourceResults.reduce((sum, r) => sum + r.errorCount, 0);
    const totalFilteredDuration = sourceResults.reduce((sum, r) => sum + r.filteredDurationCount, 0);
    const totalVideos = sourceResults.reduce((sum, r) => sum + r.totalVideos, 0);

    console.log("\n" + "=".repeat(60));
    console.log("📊 Overall Summary:");
    console.log("=".repeat(60));
    console.log(`   📺 Sources processed: ${sourceResults.length}`);
    console.log(`   📹 Total videos processed: ${totalVideos}`);
    console.log(`   ✅ New speeches added: ${totalNew}`);
    console.log(`   🔄 Speeches updated: ${totalUpdated}`);
    console.log(`   ⏭️  Speeches unchanged: ${totalUnchanged}`);
    console.log(`   🚫 Videos filtered by duration: ${totalFilteredDuration}`);
    console.log(`   ℹ️  Note: Shorts are included or excluded per channel configuration`);
    console.log(`   ❌ Errors: ${totalErrors}`);
    console.log("\n✨ Ingestion complete!");
    
    rl.close();
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    rl.close();
    process.exit(1);
  }
}

// Run ingestion
ingestSpeeches();
