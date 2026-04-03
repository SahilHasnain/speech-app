#!/usr/bin/env node

/**
 * Update Channels to Include Shorts
 *
 * This script updates all channel documents in the database to set includeShorts: true
 *
 * Usage: node scripts/update-channels-include-shorts.js
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
  appwriteEndpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  appwriteProjectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  appwriteApiKey: process.env.APPWRITE_API_KEY,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  channelsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID,
};

// Validate environment variables
function validateEnv() {
  const required = [
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

// Fetch all channels
async function getAllChannels(databases) {
  try {
    const allChannels = [];
    let offset = 0;
    const limit = 100;

    console.log("📥 Fetching all channels from database...");

    while (true) {
      const response = await databases.listDocuments(
        config.databaseId,
        config.channelsCollectionId,
        [Query.limit(limit), Query.offset(offset)]
      );

      allChannels.push(...response.documents);

      console.log(`   Fetched ${response.documents.length} channels (total: ${allChannels.length})`);

      if (response.documents.length < limit) {
        break;
      }

      offset += limit;
    }

    return allChannels;
  } catch (error) {
    throw new Error(`Failed to fetch channels: ${error.message}`);
  }
}

// Update channel to include shorts
async function updateChannelIncludeShorts(databases, channelId, channelName, currentType) {
  try {
    const updateData = { includeShorts: true };
    
    // If type is missing, set it to "channel"
    if (!currentType) {
      updateData.type = "channel";
    }
    
    await databases.updateDocument(
      config.databaseId,
      config.channelsCollectionId,
      channelId,
      updateData
    );
    
    const typeInfo = !currentType ? " (added type=channel)" : "";
    console.log(`   ✅ Updated: ${channelName}${typeInfo}`);
    return { success: true, channelId, channelName };
  } catch (error) {
    console.error(`   ❌ Failed to update ${channelName}: ${error.message}`);
    return { success: false, channelId, channelName, error: error.message };
  }
}

// Main function
async function main() {
  console.log("🔄 Update Channels - Include Shorts\n");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    validateEnv();
    console.log("✅ Environment variables validated");

    const databases = initAppwrite();
    console.log("✅ Appwrite client initialized\n");

    // Fetch all channels
    const channels = await getAllChannels(databases);
    console.log(`✅ Found ${channels.length} channel(s)\n`);

    if (channels.length === 0) {
      console.log("⚠️  No channels found in database.");
      rl.close();
      process.exit(0);
    }

    // Show current status
    console.log("📊 Current Status:");
    console.log("═══════════════════════════════════════════════════════════");
    const withShorts = channels.filter((ch) => ch.includeShorts === true).length;
    const withoutShorts = channels.length - withShorts;
    const missingType = channels.filter((ch) => !ch.type).length;
    console.log(`   Channels with includeShorts=true: ${withShorts}`);
    console.log(`   Channels with includeShorts=false/undefined: ${withoutShorts}`);
    console.log(`   Channels missing type field: ${missingType}`);
    console.log("═══════════════════════════════════════════════════════════\n");

    if (withoutShorts === 0 && missingType === 0) {
      console.log("✨ All channels already have includeShorts=true and type field!");
      rl.close();
      process.exit(0);
    }

    // List channels that will be updated
    console.log("📝 Channels to be updated:");
    channels
      .filter((ch) => ch.includeShorts !== true || !ch.type)
      .forEach((ch, index) => {
        const updates = [];
        if (ch.includeShorts !== true) updates.push("includeShorts=true");
        if (!ch.type) updates.push("type=channel");
        console.log(`   ${index + 1}. ${ch.name} (${updates.join(", ")})`);
      });
    console.log("");

    // Confirm update
    const channelsToUpdate = channels.filter((ch) => ch.includeShorts !== true || !ch.type);
    const confirm = await question(
      `Update ${channelsToUpdate.length} channel(s)? (y/n): `
    );

    if (confirm.toLowerCase() !== "y") {
      console.log("\n👋 Cancelled. No changes made.");
      rl.close();
      process.exit(0);
    }

    console.log("\n🚀 Starting update...\n");

    // Update channels
    const results = [];
    for (const channel of channels) {
      if (channel.includeShorts !== true || !channel.type) {
        const result = await updateChannelIncludeShorts(
          databases,
          channel.$id,
          channel.name,
          channel.type
        );
        results.push(result);
      } else {
        console.log(`   ⏭️  Skipped: ${channel.name} (already up to date)`);
      }
    }

    // Summary
    const skipped = channels.length - results.length;
    console.log("\n" + "═".repeat(60));
    console.log("📊 Summary:");
    console.log("═".repeat(60));
    console.log(`   Total channels: ${channels.length}`);
    console.log(`   Updated: ${results.filter((r) => r.success).length}`);
    console.log(`   Failed: ${results.filter((r) => !r.success).length}`);
    console.log(`   Skipped: ${skipped}`);

    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      console.log("\n❌ Failed channels:");
      failed.forEach((f) => {
        console.log(`   - ${f.channelName}: ${f.error}`);
      });
    }

    console.log("═".repeat(60));
    console.log("\n✨ Update complete!");

    rl.close();
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    rl.close();
    process.exit(1);
  }
}

// Run the script
main();
