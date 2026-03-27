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

const { Client, Databases, Query } = require("node-appwrite");
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

  return new Databases(client);
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

// Delete a speech document
async function deleteSpeech(databases, speechId) {
  try {
    await databases.deleteDocument(
      config.databaseId,
      config.speechesCollectionId,
      speechId,
    );
  } catch (error) {
    throw new Error(`Failed to delete speech ${speechId}: ${error.message}`);
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

    const databases = initAppwrite();

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
    console.log(`   - Channel "${channel.name}" will be deleted\n`);

    const confirm = await question("Are you sure you want to delete? Type 'DELETE' to confirm: ");

    if (confirm !== "DELETE") {
      console.log("\n👋 Deletion cancelled. Goodbye!");
      rl.close();
      process.exit(0);
    }

    // Delete speeches
    if (speeches.length > 0) {
      console.log("\n🗑️  Deleting speeches...");

      let deletedCount = 0;
      let errorCount = 0;

      for (const speech of speeches) {
        try {
          await deleteSpeech(databases, speech.$id);
          deletedCount++;
          console.log(`   ✅ Deleted: ${speech.title}`);
        } catch (error) {
          errorCount++;
          console.error(`   ❌ Error deleting ${speech.title}: ${error.message}`);
        }
      }

      console.log("\n═══════════════════════════════════════════════════════════");
      console.log("📊 Speech Deletion Summary:");
      console.log("═══════════════════════════════════════════════════════════");
      console.log(`   ✅ Successfully deleted: ${deletedCount}`);
      console.log(`   ❌ Errors: ${errorCount}`);
      console.log("═══════════════════════════════════════════════════════════\n");
    }

    // Delete channel
    console.log("🗑️  Deleting channel...");
    await deleteChannel(databases, trimmedChannelDocId);
    console.log(`✅ Channel "${channel.name}" deleted successfully!\n`);

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
