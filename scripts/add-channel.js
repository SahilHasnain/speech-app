#!/usr/bin/env node

/**
 * Interactive CLI Tool to Add Channels and Ingest Speeches
 *
 * This tool:
 * 1. Prompts for YouTube channel ID
 * 2. Fetches channel info from YouTube
 * 3. Adds channel to Appwrite Channels collection
 * 4. Optionally runs ingestion for that channel
 *
 * Usage: node scripts/add-channel.js
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

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify question
function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Validate environment
function validateEnv() {
  const required = [
    "YOUTUBE_API_KEY",
    "EXPO_PUBLIC_APPWRITE_ENDPOINT",
    "EXPO_PUBLIC_APPWRITE_PROJECT_ID",
    "APPWRITE_API_KEY",
    "EXPO_PUBLIC_APPWRITE_DATABASE_ID",
    "EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    process.exit(1);
  }
}

// Initialize Appwrite
function initAppwrite() {
  const client = new Client()
    .setEndpoint(config.appwriteEndpoint)
    .setProject(config.appwriteProjectId)
    .setKey(config.appwriteApiKey);

  return new Databases(client);
}

// Fetch channel info from YouTube
async function fetchChannelInfo(channelId) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    const response = await fetch(
      `${baseUrl}/channels?part=snippet,statistics&id=${channelId}&key=${config.youtubeApiKey}`,
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
      youtubeChannelId: channelId,
      name: channel.snippet.title,
      thumbnailUrl: channel.snippet.thumbnails.high?.url || channel.snippet.thumbnails.default?.url,
      description: channel.snippet.description || "",
      subscriberCount: parseInt(channel.statistics?.subscriberCount || "0", 10),
      videoCount: parseInt(channel.statistics?.videoCount || "0", 10),
    };
  } catch (error) {
    throw new Error(`Failed to fetch channel info: ${error.message}`);
  }
}

// Check if channel already exists
async function channelExists(databases, youtubeChannelId) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.equal("youtubeChannelId", youtubeChannelId), Query.limit(1)],
    );

    return response.documents.length > 0;
  } catch (error) {
    throw new Error(`Failed to check channel existence: ${error.message}`);
  }
}

// Add channel to database
async function addChannel(databases, channelInfo) {
  try {
    const document = await databases.createDocument(
      config.databaseId,
      config.channelsCollectionId,
      ID.unique(),
      {
        name: channelInfo.name,
        youtubeChannelId: channelInfo.youtubeChannelId,
        thumbnailUrl: channelInfo.thumbnailUrl,
        description: channelInfo.description,
      },
    );

    return document;
  } catch (error) {
    throw new Error(`Failed to add channel: ${error.message}`);
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

// Fetch videos from channel
async function fetchChannelVideos(channelId, maxResults = 5000) {
  const baseUrl = "https://www.googleapis.com/youtube/v3";

  try {
    const channelResponse = await fetch(
      `${baseUrl}/channels?part=contentDetails,snippet&id=${channelId}&key=${config.youtubeApiKey}`,
    );

    if (!channelResponse.ok) {
      throw new Error(`YouTube API error: ${channelResponse.status}`);
    }

    const channelData = await channelResponse.json();
    const channelName = channelData.items[0].snippet.title;
    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

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

      if (!pageToken) break;
      if (maxResults !== Infinity && allVideoItems.length >= maxResults) break;
    }

    const limitedVideoItems = maxResults === Infinity ? allVideoItems : allVideoItems.slice(0, maxResults);

    const allVideosData = [];
    const batchSize = 50;

    for (let i = 0; i < limitedVideoItems.length; i += batchSize) {
      const batch = limitedVideoItems.slice(i, i + batchSize);
      const videoIds = batch.map((item) => item.contentDetails.videoId).join(",");

      const videosResponse = await fetch(
        `${baseUrl}/videos?part=contentDetails,snippet,statistics&id=${videoIds}&key=${config.youtubeApiKey}`,
      );

      const videosData = await videosResponse.json();
      allVideosData.push(...videosData.items);
    }

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

    return { channelId, channelName, videos };
  } catch (error) {
    throw new Error(`Failed to fetch videos: ${error.message}`);
  }
}

// Get existing speeches
async function getExistingSpeeches(databases) {
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

// Ingest speeches for channel
async function ingestChannelSpeeches(databases, channelId, channelName, maxResults = 5000) {
  console.log(`\n📺 Fetching videos from channel...`);

  const { videos } = await fetchChannelVideos(channelId, maxResults);
  console.log(`✅ Found ${videos.length} videos`);

  console.log(`📦 Checking existing speeches...`);
  const existingMap = await getExistingSpeeches(databases);

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let filtered = 0;

  console.log(`\n🔄 Processing videos...\n`);

  for (const video of videos) {
    try {
      // Filter: 1-5 minutes only
      if (video.duration > 300) {
        console.log(`   🚫 Filtered: ${video.title} (${video.duration}s > 300s)`);
        filtered++;
        continue;
      }

      if (video.duration < 60) {
        console.log(`   🚫 Filtered: ${video.title} (${video.duration}s < 60s)`);
        filtered++;
        continue;
      }

      const existing = existingMap.get(video.youtubeId);

      if (existing) {
        if (existing.views !== video.views) {
          await databases.updateDocument(
            config.databaseId,
            config.speechesCollectionId,
            existing.documentId,
            { views: video.views },
          );
          console.log(`   🔄 Updated: ${video.title} (${existing.views} → ${video.views} views)`);
          updated++;
        } else {
          unchanged++;
        }
      } else {
        await databases.createDocument(
          config.databaseId,
          config.speechesCollectionId,
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
          },
        );
        console.log(`   ✅ Added: ${video.title} (${video.views} views, ${video.duration}s)`);
        added++;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${video.title} - ${error.message}`);
    }
  }

  return { added, updated, unchanged, filtered, total: videos.length };
}

// Main CLI function
async function main() {
  console.log("🎙️  Islamic Speeches - Add Channel Tool\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    validateEnv();

    const databases = initAppwrite();

    // Prompt for channel ID
    console.log("📝 Enter YouTube Channel ID:");
    console.log("   (e.g., UCDwHEBKDyZvCbHLjNh8olfQ)\n");

    const channelId = await question("Channel ID: ");

    if (!channelId || !channelId.trim()) {
      console.error("\n❌ Channel ID is required");
      rl.close();
      process.exit(1);
    }

    const trimmedChannelId = channelId.trim();

    console.log(`\n🔍 Fetching channel information from YouTube...`);

    // Fetch channel info
    const channelInfo = await fetchChannelInfo(trimmedChannelId);

    console.log("\n✅ Channel found!");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`📺 Name: ${channelInfo.name}`);
    console.log(`🆔 ID: ${channelInfo.youtubeChannelId}`);
    console.log(`👥 Subscribers: ${channelInfo.subscriberCount.toLocaleString()}`);
    console.log(`📹 Videos: ${channelInfo.videoCount.toLocaleString()}`);
    console.log(`📝 Description: ${channelInfo.description.substring(0, 100)}...`);
    console.log("═══════════════════════════════════════════════════════════\n");

    // Check if channel already exists
    const exists = await channelExists(databases, trimmedChannelId);

    if (exists) {
      console.log("⚠️  This channel already exists in the database.\n");
      const proceed = await question("Do you want to ingest speeches anyway? (y/n): ");

      if (proceed.toLowerCase() !== "y") {
        console.log("\n👋 Cancelled. Goodbye!");
        rl.close();
        process.exit(0);
      }
    } else {
      // Confirm adding channel
      const confirm = await question("Add this channel to the database? (y/n): ");

      if (confirm.toLowerCase() !== "y") {
        console.log("\n👋 Cancelled. Goodbye!");
        rl.close();
        process.exit(0);
      }

      console.log("\n💾 Adding channel to database...");
      await addChannel(databases, channelInfo);
      console.log("✅ Channel added successfully!");
    }

    // Ask about ingestion
    const ingest = await question("\nDo you want to ingest speeches from this channel now? (y/n): ");

    if (ingest.toLowerCase() === "y") {
      // Ask for number of videos to process
      console.log("\n📊 How many videos do you want to process?");
      console.log("   Enter a number (e.g., 100) or press Enter for all videos");
      const limitInput = await question("Limit (default: all): ");
      
      let maxResults = Infinity;
      if (limitInput.trim()) {
        const parsed = parseInt(limitInput.trim(), 10);
        if (!isNaN(parsed) && parsed > 0) {
          maxResults = parsed;
        } else {
          console.log("⚠️  Invalid number, processing all videos");
        }
      }

      console.log("\n🚀 Starting ingestion...");

      const results = await ingestChannelSpeeches(
        databases,
        trimmedChannelId,
        channelInfo.name,
        maxResults,
      );

      console.log("\n═══════════════════════════════════════════════════════════");
      console.log("📊 Ingestion Summary:");
      console.log("═══════════════════════════════════════════════════════════");
      console.log(`   📹 Total videos: ${results.total}`);
      console.log(`   ✅ New speeches added: ${results.added}`);
      console.log(`   🔄 Speeches updated: ${results.updated}`);
      console.log(`   ⏭️  Speeches unchanged: ${results.unchanged}`);
      console.log(`   🚫 Videos filtered: ${results.filtered}`);
      console.log("═══════════════════════════════════════════════════════════\n");
      console.log("✨ Ingestion complete!");
    } else {
      console.log("\n✅ Channel added. Run 'npm run ingest:speeches' later to ingest speeches.");
    }

    console.log("\n👋 Done! Goodbye!");
    rl.close();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

// Run CLI
main();
