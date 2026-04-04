#!/usr/bin/env node

/**
 * Delete Channel and Associated Speeches Script
 *
 * This tool:
 * 1. Prompts for channel document ID
 * 2. Fetches channel information
 * 3. Finds all speeches belonging to that channel
 * 4. Deletes all speeches
 * 5. Deletes the channel document
 *
 * Usage: node scripts/delete-channel.js
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
  videoBucketId: process.env.EXPO_PUBLIC_APPWRITE_VIDEO_BUCKET_ID || "video-files",
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

// Get channel by document ID
async function getChannelById(databases, channelDocId) {
  try {
    const channel = await databases.getDocument(
      config.databaseId,
      config.channelsCollectionId,
      channelDocId,
    );
    return channel;
  } catch (error) {
    if (error.code === 404) {
      throw new Error(`Channel not found with ID: ${channelDocId}`);
    }
    throw new Error(`Failed to fetch channel: ${error.message}`);
  }
}

// List all channels
async function listAllChannels(databases) {
  try {
    const response = await databases.listDocuments(
      config.databaseId,
      config.channelsCollectionId,
      [Query.limit(100)],
    );
    return response.documents;
  } catch (error) {
    throw new Error(`Failed to list channels: ${error.message}`);
  }
}

// Get all speeches for a channel
async function getSpeechesByChannel(databases, youtubeChannelId) {
  try {
    const allSpeeches = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await databases.listDocuments(
        config.databaseId,
        config.speechesCollectionId,
        [
          Query.equal("channelId", youtubeChannelId),
          Query.limit(limit),
          Query.offset(offset),
        ],
      );

      allSpeeches.push(...response.documents);

      if (response.documents.length < limit) {
        break;
      }

      offset += limit;
    }

    return allSpeeches;
  } catch (error) {
    throw new Error(`Failed to fetch speeches: ${error.message}`);
  }
}

// Delete video file from storage
async function deleteVideoFile(storage, videoId) {
  try {
    await storage.deleteFile(config.videoBucketId, videoId);
    return true;
  } catch (error) {
    // File might not exist or already deleted
    if (error.code === 404) {
      return false; // File not found
    }
    throw new Error(`Failed to delete video file ${videoId}: ${error.message}`);
  }
}

// Delete a speech document and its associated video
async function deleteSpeech(databases, storage, speech) {
  try {
    // Delete video file if it exists
    let videoDeleted = false;
    if (speech.videoId) {
      try {
        videoDeleted = await deleteVideoFile(storage, speech.videoId);
      } catch (error) {
        console.error(`   ⚠️  Warning: Could not delete video file for ${speech.title}: ${error.message}`);
      }
    }

    // Delete speech document
    await databases.deleteDocument(
      config.databaseId,
      config.speechesCollectionId,
      speech.$id,
    );

    return { videoDeleted };
  } catch (error) {
    throw new Error(`Failed to delete speech ${speech.$id}: ${error.message}`);
  }
}

// Delete channel document
async function deleteChannel(databases, channelDocId) {
  try {
    await databases.deleteDocument(
      config.databaseId,
      config.channelsCollectionId,
      channelDocId,
    );
  } catch (error) {
    throw new Error(`Failed to delete channel: ${error.message}`);
  }
}

// Main CLI function
async function main() {
  console.log("🗑️  Islamic Speeches - Delete Channel Tool\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    validateEnv();

    const { databases, storage } = initAppwrite();

    // List all channels first
    console.log("📋 Fetching all channels...\n");
    const channels = await listAllChannels(databases);

    if (channels.length === 0) {
      console.log("⚠️  No channels found in the database.");
      rl.close();
      process.exit(0);
    }

    console.log("Available channels:");
    console.log("═══════════════════════════════════════════════════════════");
    channels.forEach((channel, index) => {
      console.log(`${index + 1}. ${channel.name}`);
      console.log(`   Document ID: ${channel.$id}`);
      console.log(`   YouTube ID: ${channel.youtubeChannelId}`);
      console.log("");
    });
    console.log("═══════════════════════════════════════════════════════════\n");

    // Prompt for channel document ID
    console.log("📝 Enter the Channel Document ID to delete:");
    console.log("   (Copy the Document ID from the list above)\n");

    const channelDocId = await question("Channel Document ID: ");

    if (!channelDocId || !channelDocId.trim()) {
      console.error("\n❌ Channel Document ID is required");
      rl.close();
      process.exit(1);
    }

    const trimmedChannelDocId = channelDocId.trim();

    console.log(`\n🔍 Fetching channel information...`);

    // Fetch channel info
    const channel = await getChannelById(databases, trimmedChannelDocId);

    console.log("\n✅ Channel found!");
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`📺 Name: ${channel.name}`);
    console.log(`🆔 Document ID: ${channel.$id}`);
    console.log(`🆔 YouTube Channel ID: ${channel.youtubeChannelId}`);
    console.log("═══════════════════════════════════════════════════════════\n");

    // Fetch speeches for this channel
    console.log("🔍 Searching for speeches from this channel...");
    const speeches = await getSpeechesByChannel(databases, channel.youtubeChannelId);

    console.log(`✅ Found ${speeches.length} speech(es) from this channel\n`);

    if (speeches.length > 0) {
      console.log("📋 Speeches to be deleted:");
      console.log("───────────────────────────────────────────────────────────");
      speeches.slice(0, 10).forEach((speech, index) => {
        console.log(`${index + 1}. ${speech.title}`);
      });
      if (speeches.length > 10) {
        console.log(`   ... and ${speeches.length - 10} more`);
      }
      console.log("───────────────────────────────────────────────────────────\n");
    }

    // Confirm deletion
    console.log("⚠️  WARNING: This action cannot be undone!");
    console.log(`   - ${speeches.length} speech(es) will be deleted`);
    console.log(`   - Associated video files will be deleted from storage`);
    console.log(`   - Channel "${channel.name}" can optionally be deleted\n`);

    const confirm = await question("Are you sure you want to delete speeches? Type 'DELETE' to confirm: ");

    if (confirm !== "DELETE") {
      console.log("\n👋 Deletion cancelled. Goodbye!");
      rl.close();
      process.exit(0);
    }

    // Delete speeches
    if (speeches.length > 0) {
      console.log("\n🗑️  Deleting speeches and associated videos...");

      let deletedCount = 0;
      let errorCount = 0;
      let videosDeletedCount = 0;
      let videosNotFoundCount = 0;

      for (const speech of speeches) {
        try {
          const { videoDeleted } = await deleteSpeech(databases, storage, speech);
          deletedCount++;
          if (videoDeleted) {
            videosDeletedCount++;
            console.log(`   ✅ Deleted: ${speech.title} (+ video file)`);
          } else {
            videosNotFoundCount++;
            console.log(`   ✅ Deleted: ${speech.title} (no video file found)`);
          }
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Error deleting ${speech.title}: ${error.message}`);
        }
      }

      console.log("\n═══════════════════════════════════════════════════════════");
      console.log("📊 Speech Deletion Summary:");
      console.log("═══════════════════════════════════════════════════════════");
      console.log(`   ✅ Speeches deleted: ${deletedCount}`);
      console.log(`   🎥 Video files deleted: ${videosDeletedCount}`);
      console.log(`   ℹ️  Video files not found: ${videosNotFoundCount}`);
      console.log(`   ❌ Errors: ${errorCount}`);
      console.log("═══════════════════════════════════════════════════════════\n");
    }

    // Ask if user wants to delete the channel document
    console.log("📋 Do you also want to delete the channel document?");
    console.log(`   Channel: "${channel.name}"`);
    console.log("   Note: Deleting the channel will remove it from your sources list.\n");

    const deleteChannelConfirm = await question("Delete channel document? (y/n): ");

    if (deleteChannelConfirm.toLowerCase() === "y") {
      console.log("\n🗑️  Deleting channel...");
      await deleteChannel(databases, trimmedChannelDocId);
      console.log(`✅ Channel "${channel.name}" deleted successfully!\n`);
    } else {
      console.log(`\n✅ Channel "${channel.name}" kept in database.\n`);
    }

    console.log("✨ Deletion complete!");
    console.log("👋 Goodbye!");
    rl.close();
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    rl.close();
    process.exit(1);
  }
}

// Run CLI
main();
