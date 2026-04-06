#!/usr/bin/env node

/**
 * Interactive CLI Tool to Inspect Database
 *
 * This tool:
 * 1. Shows total number of documents in each collection
 * 2. Lists all channels with their document counts
 * 3. Allows selection of a channel to inspect in detail
 * 4. Shows channel statistics:
 *    - Total number of documents (speeches)
 *    - Number of documents with duration < 20 minutes
 *    - Number of documents with duration >= 20 minutes
 *
 * Usage: node scripts/inspect-database.js
 */

const { Client, Databases, Storage, Query } = require("node-appwrite");
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
  appwriteEndpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  appwriteProjectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  appwriteApiKey: process.env.APPWRITE_API_KEY,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  speechesCollectionId: process.env.EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID,
  channelsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID,
  videoBucketId: "video-files",
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
    process.exit(1);
  }
}

// Initialize Appwrite
function initAppwrite() {
  const client = new Client()
    .setEndpoint(config.appwriteEndpoint)
    .setProject(config.appwriteProjectId)
    .setKey(config.appwriteApiKey);

  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

// Get total count of documents in a collection
async function getCollectionCount(databases, collectionId) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      collectionId,
      [Query.limit(1)]
    );
    return response.total;
  } catch (error) {
    console.error(`Error fetching count: ${error.message}`);
    return 0;
  }
}

// Get total count of files in storage bucket
async function getStorageFileCount(storage) {
  try {
    let total = 0;
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await storage.listFiles(
        config.videoBucketId,
        [Query.limit(limit), Query.offset(offset)]
      );

      total += response.files.length;

      if (response.files.length < limit) break;
      offset += limit;
    }

    return total;
  } catch (error) {
    console.error(`Error fetching storage count: ${error.message}`);
    return 0;
  }
}

// Get count of videos in storage for a specific channel
async function getChannelVideoCount(databases, storage, channelId) {
  try {
    // Fetch all speeches for this channel that have videoId
    let allSpeeches = [];
    let offset = 0;
    const limit = 5000;

    while (true) {
      const response = await databases.listDocuments(
        config.databaseId,
        config.speechesCollectionId,
        [
          Query.equal("channelId", channelId),
          Query.isNotNull("videoId"),
          Query.limit(limit),
          Query.offset(offset),
        ]
      );

      allSpeeches.push(...response.documents);

      if (response.documents.length < limit) break;
      offset += limit;
    }

    return allSpeeches.length;
  } catch (error) {
    console.error(`Error fetching channel video count: ${error.message}`);
    return 0;
  }
}

// Fetch all channels
async function fetchAllChannels(databases) {
  const allChannels = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.limit(limit), Query.offset(offset)]
    );

    allChannels.push(...response.documents);

    if (response.documents.length < limit) break;
    offset += limit;
  }

  return allChannels;
}

// Get speech count for a specific channel
async function getChannelSpeechCount(databases, channelId) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.speechesCollectionId,
      [Query.equal("channelId", channelId), Query.limit(1)]
    );
    return response.total;
  } catch (error) {
    console.error(`Error fetching channel speech count: ${error.message}`);
    return 0;
  }
}

// Fetch speeches for a specific channel
async function fetchChannelSpeeches(databases, channelId) {
  const allSpeeches = [];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const response = await databases.listDocuments(
      config.databaseId,
      config.speechesCollectionId,
      [
        Query.equal("channelId", channelId),
        Query.limit(limit),
        Query.offset(offset),
      ]
    );

    allSpeeches.push(...response.documents);

    if (response.documents.length < limit) break;
    offset += limit;
  }

  return allSpeeches;
}

// Format duration in human-readable format
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Analyze channel statistics
function analyzeChannelStats(speeches) {
  const total = speeches.length;
  const under20Min = speeches.filter((s) => s.duration < 1200).length;
  const over20Min = speeches.filter((s) => s.duration >= 1200).length;

  // Additional stats
  const totalDuration = speeches.reduce((sum, s) => sum + s.duration, 0);
  const avgDuration = total > 0 ? totalDuration / total : 0;
  const maxDuration = total > 0 ? Math.max(...speeches.map((s) => s.duration)) : 0;
  const minDuration = total > 0 ? Math.min(...speeches.map((s) => s.duration)) : 0;

  return {
    total,
    under20Min,
    over20Min,
    totalDuration,
    avgDuration,
    maxDuration,
    minDuration,
  };
}

// Display database overview
async function displayDatabaseOverview(databases, storage) {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊 Database Overview");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("🔄 Fetching collection statistics...\n");

  // Get counts for each collection
  const speechesCount = await getCollectionCount(databases, config.speechesCollectionId);
  const channelsCount = await getCollectionCount(databases, config.channelsCollectionId);
  
  console.log("🔄 Fetching storage statistics...\n");
  const videoFilesCount = await getStorageFileCount(storage);

  console.log("📦 Collections:");
  console.log(`   📹 Speeches: ${speechesCount.toLocaleString()} documents`);
  console.log(`   📺 Channels: ${channelsCount.toLocaleString()} documents`);
  console.log("");
  console.log("💾 Storage:");
  console.log(`   🎥 Video Files: ${videoFilesCount.toLocaleString()} files`);
  console.log("");
}

// Display channels with speech counts
async function displayChannelsWithCounts(databases, storage, channels) {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("📺 Channels with Speech & Video Counts");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("🔄 Fetching speech and video counts for each channel...\n");

  const channelsWithCounts = [];

  for (const channel of channels) {
    const speechCount = await getChannelSpeechCount(databases, channel.youtubeChannelId);
    const videoCount = await getChannelVideoCount(databases, storage, channel.youtubeChannelId);
    channelsWithCounts.push({ ...channel, speechCount, videoCount });
  }

  // Sort by speech count descending
  channelsWithCounts.sort((a, b) => b.speechCount - a.speechCount);

  channelsWithCounts.forEach((channel, index) => {
    const type = channel.type === "playlist" ? "📋" : "📺";
    const videoPercentage = channel.speechCount > 0 
      ? ((channel.videoCount / channel.speechCount) * 100).toFixed(1) 
      : "0.0";
    
    console.log(`${index + 1}. ${type} ${channel.name}`);
    console.log(`   ID: ${channel.youtubeChannelId}`);
    console.log(`   Speeches: ${channel.speechCount.toLocaleString()}`);
    console.log(`   Videos in Storage: ${channel.videoCount.toLocaleString()} (${videoPercentage}%)`);
    console.log(`   Ignore Duration: ${channel.ignoreDuration ? "Yes" : "No"}`);
    console.log(`   Include Shorts: ${channel.includeShorts ? "Yes" : "No"}`);
    console.log("");
  });

  return channelsWithCounts;
}

// Inspect specific channel
async function inspectChannel(databases, storage, channel) {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`🔍 Inspecting: ${channel.name}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("🔄 Fetching speeches...");
  const speeches = await fetchChannelSpeeches(databases, channel.youtubeChannelId);

  console.log("🔄 Fetching video storage info...");
  const videoCount = await getChannelVideoCount(databases, storage, channel.youtubeChannelId);

  const stats = analyzeChannelStats(speeches);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📈 Channel Statistics:");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log(`📹 Total Documents: ${stats.total.toLocaleString()}`);
  console.log(`🎥 Videos in Storage: ${videoCount.toLocaleString()} (${((videoCount / stats.total) * 100).toFixed(1)}%)`);
  console.log(`📝 Documents without Video: ${(stats.total - videoCount).toLocaleString()}`);
  console.log("");
  console.log(`⏱️  Documents < 20 minutes: ${stats.under20Min.toLocaleString()} (${((stats.under20Min / stats.total) * 100).toFixed(1)}%)`);
  console.log(`⏱️  Documents >= 20 minutes: ${stats.over20Min.toLocaleString()} (${((stats.over20Min / stats.total) * 100).toFixed(1)}%)`);
  console.log("");
  console.log(`⏳ Total Duration: ${formatDuration(stats.totalDuration)}`);
  console.log(`📊 Average Duration: ${formatDuration(Math.round(stats.avgDuration))}`);
  console.log(`⬆️  Longest Speech: ${formatDuration(stats.maxDuration)}`);
  console.log(`⬇️  Shortest Speech: ${formatDuration(stats.minDuration)}`);

  console.log("\n═══════════════════════════════════════════════════════════\n");
}

// Main CLI function
async function main() {
  console.log("🔍 Islamic Speeches - Database Inspector\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    validateEnv();

    const { databases, storage } = initAppwrite();

    // Display database overview
    await displayDatabaseOverview(databases, storage);

    // Fetch all channels
    console.log("📡 Fetching channels from database...\n");
    const channels = await fetchAllChannels(databases);

    if (channels.length === 0) {
      console.log("❌ No channels found in the database.");
      rl.close();
      process.exit(0);
    }

    // Display channels with counts
    const channelsWithCounts = await displayChannelsWithCounts(databases, storage, channels);

    // Ask if user wants to inspect a specific channel
    const inspectChoice = await question("Do you want to inspect a specific channel? (y/n): ");

    if (inspectChoice.toLowerCase() === "y") {
      const choice = await question("\nSelect a channel to inspect (enter number): ");
      const selectedIndex = parseInt(choice.trim(), 10) - 1;

      if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= channelsWithCounts.length) {
        console.error("\n❌ Invalid selection");
        rl.close();
        process.exit(1);
      }

      const selectedChannel = channelsWithCounts[selectedIndex];
      await inspectChannel(databases, storage, selectedChannel);
    }

    console.log("✨ Inspection complete!");
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
