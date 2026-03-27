/**
 * Appwrite Database Setup Script for Speech App
 *
 * This script creates:
 * - Database
 * - Speeches collection with attributes and indexes
 * - Channels collection with attributes and indexes
 * - Storage bucket for video thumbnails (optional)
 *
 * Usage: node scripts/setup-appwrite.js
 */

const sdk = require("node-appwrite");
const path = require("path");
const fs = require("fs");

// Load environment variables
const envPath = fs.existsSync(path.join(__dirname, "..", ".env.local"))
  ? path.join(__dirname, "..", ".env.local")
  : path.join(__dirname, "..", ".env");

require("dotenv").config({ path: envPath });

// Configuration
const config = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1",
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  apiKey: process.env.APPWRITE_API_KEY,
};

// Validate configuration
function validateConfig() {
  const missing = [];
  if (!config.endpoint) missing.push("EXPO_PUBLIC_APPWRITE_ENDPOINT");
  if (!config.projectId) missing.push("EXPO_PUBLIC_APPWRITE_PROJECT_ID");
  if (!config.apiKey) missing.push("APPWRITE_API_KEY");

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error("\n💡 Please add these to your .env.local file");
    process.exit(1);
  }
}

// Initialize Appwrite client
function initializeClient() {
  const client = new sdk.Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey);

  return {
    databases: new sdk.Databases(client),
    storage: new sdk.Storage(client),
  };
}

// Helper function to wait for attribute creation
async function waitForAttribute(databases, databaseId, collectionId, attributeKey) {
  console.log(`   ⏳ Waiting for attribute '${attributeKey}' to be ready...`);
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    try {
      const collection = await databases.getCollection(databaseId, collectionId);
      const attribute = collection.attributes.find((attr) => attr.key === attributeKey);

      if (attribute && attribute.status === "available") {
        console.log(`   ✅ Attribute '${attributeKey}' is ready`);
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      console.error(`   ⚠️  Error checking attribute status: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }
  }

  throw new Error(`Attribute '${attributeKey}' did not become available in time`);
}

// Create database
async function createDatabase(databases) {
  const databaseId = sdk.ID.unique();
  console.log("\n🗄️  Creating database...");

  try {
    await databases.create(databaseId, "Islamic Speeches");
    console.log(`✅ Database created with ID: ${databaseId}`);
    return databaseId;
  } catch (error) {
    console.error(`❌ Failed to create database: ${error.message}`);
    throw error;
  }
}

// Create Speeches collection
async function createSpeechesCollection(databases, databaseId) {
  const collectionId = sdk.ID.unique();
  console.log("\n📦 Creating Speeches collection...");

  try {
    await databases.createCollection(databaseId, collectionId, "Speeches");
    console.log(`✅ Collection created with ID: ${collectionId}`);
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create collection: ${error.message}`);
    throw error;
  }
}

// Create attributes for Speeches collection
async function createSpeechesAttributes(databases, databaseId, collectionId) {
  console.log("\n📝 Creating Speeches attributes...");

  const attributes = [
    {
      name: "title",
      type: "string",
      size: 500,
      required: true,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "title", 500, true),
    },
    {
      name: "youtubeId",
      type: "string",
      size: 50,
      required: true,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "youtubeId", 50, true),
    },
    {
      name: "thumbnailUrl",
      type: "string",
      size: 1000,
      required: true,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "thumbnailUrl", 1000, true),
    },
    {
      name: "duration",
      type: "integer",
      required: true,
      create: () =>
        databases.createIntegerAttribute(databaseId, collectionId, "duration", true, 0, 300),
    },
    {
      name: "uploadDate",
      type: "datetime",
      required: true,
      create: () =>
        databases.createDatetimeAttribute(databaseId, collectionId, "uploadDate", true),
    },
    {
      name: "channelName",
      type: "string",
      size: 200,
      required: true,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "channelName", 200, true),
    },
    {
      name: "channelId",
      type: "string",
      size: 100,
      required: true,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "channelId", 100, true),
    },
    {
      name: "views",
      type: "integer",
      required: true,
      create: () =>
        databases.createIntegerAttribute(databaseId, collectionId, "views", true, 0),
    },
    {
      name: "description",
      type: "string",
      size: 5000,
      required: false,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "description", 5000, false),
    },
    {
      name: "language",
      type: "string",
      size: 50,
      required: false,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "language", 50, false),
    },
    {
      name: "topic",
      type: "string",
      size: 100,
      required: false,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "topic", 100, false),
    },
  ];

  for (const attr of attributes) {
    try {
      console.log(`\n   Creating ${attr.type} attribute: ${attr.name}`);
      await attr.create();
      console.log(`   ✅ Attribute '${attr.name}' created`);
      await waitForAttribute(databases, databaseId, collectionId, attr.name);
    } catch (error) {
      console.error(`   ❌ Failed to create attribute '${attr.name}': ${error.message}`);
      throw error;
    }
  }

  console.log("\n✅ All Speeches attributes created successfully");
}

// Create indexes for Speeches collection
async function createSpeechesIndexes(databases, databaseId, collectionId) {
  console.log("\n🔍 Creating Speeches indexes...");

  const indexes = [
    {
      name: "title_search",
      type: sdk.IndexType.Fulltext,
      attributes: ["title"],
      description: "Full-text search on title",
    },
    {
      name: "youtubeId_unique",
      type: sdk.IndexType.Unique,
      attributes: ["youtubeId"],
      description: "Unique index on youtubeId to prevent duplicates",
    },
    {
      name: "uploadDate_desc",
      type: sdk.IndexType.Key,
      attributes: ["uploadDate"],
      orders: ["DESC"],
      description: "Index for sorting by upload date (newest first)",
    },
    {
      name: "views_desc",
      type: sdk.IndexType.Key,
      attributes: ["views"],
      orders: ["DESC"],
      description: "Index for sorting by views (most popular first)",
    },
    {
      name: "channelId_index",
      type: sdk.IndexType.Key,
      attributes: ["channelId"],
      description: "Index for filtering by channel",
    },
    {
      name: "duration_index",
      type: sdk.IndexType.Key,
      attributes: ["duration"],
      description: "Index for filtering by duration",
    },
  ];

  for (const index of indexes) {
    try {
      console.log(`\n   Creating ${index.type} index: ${index.name}`);
      await databases.createIndex(
        databaseId,
        collectionId,
        index.name,
        index.type,
        index.attributes,
        index.orders || []
      );
      console.log(`   ✅ Index '${index.name}' created`);
      console.log(`      ${index.description}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`   ❌ Failed to create index '${index.name}': ${error.message}`);
      throw error;
    }
  }

  console.log("\n✅ All Speeches indexes created successfully");
}

// Create Channels collection
async function createChannelsCollection(databases, databaseId) {
  const collectionId = sdk.ID.unique();
  console.log("\n📦 Creating Channels collection...");

  try {
    await databases.createCollection(databaseId, collectionId, "Channels");
    console.log(`✅ Collection created with ID: ${collectionId}`);
    return collectionId;
  } catch (error) {
    console.error(`❌ Failed to create collection: ${error.message}`);
    throw error;
  }
}

// Create attributes for Channels collection
async function createChannelsAttributes(databases, databaseId, collectionId) {
  console.log("\n📝 Creating Channels attributes...");

  const attributes = [
    {
      name: "name",
      type: "string",
      size: 200,
      required: true,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "name", 200, true),
    },
    {
      name: "youtubeChannelId",
      type: "string",
      size: 100,
      required: true,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "youtubeChannelId", 100, true),
    },
    {
      name: "thumbnailUrl",
      type: "string",
      size: 1000,
      required: false,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "thumbnailUrl", 1000, false),
    },
    {
      name: "description",
      type: "string",
      size: 2000,
      required: false,
      create: () =>
        databases.createStringAttribute(databaseId, collectionId, "description", 2000, false),
    },
  ];

  for (const attr of attributes) {
    try {
      console.log(`\n   Creating ${attr.type} attribute: ${attr.name}`);
      await attr.create();
      console.log(`   ✅ Attribute '${attr.name}' created`);
      await waitForAttribute(databases, databaseId, collectionId, attr.name);
    } catch (error) {
      console.error(`   ❌ Failed to create attribute '${attr.name}': ${error.message}`);
      throw error;
    }
  }

  console.log("\n✅ All Channels attributes created successfully");
}

// Create indexes for Channels collection
async function createChannelsIndexes(databases, databaseId, collectionId) {
  console.log("\n🔍 Creating Channels indexes...");

  const indexes = [
    {
      name: "youtubeChannelId_unique",
      type: sdk.IndexType.Unique,
      attributes: ["youtubeChannelId"],
      description: "Unique index on youtubeChannelId",
    },
    {
      name: "name_search",
      type: sdk.IndexType.Fulltext,
      attributes: ["name"],
      description: "Full-text search on channel name",
    },
  ];

  for (const index of indexes) {
    try {
      console.log(`\n   Creating ${index.type} index: ${index.name}`);
      await databases.createIndex(
        databaseId,
        collectionId,
        index.name,
        index.type,
        index.attributes,
        index.orders || []
      );
      console.log(`   ✅ Index '${index.name}' created`);
      console.log(`      ${index.description}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`   ❌ Failed to create index '${index.name}': ${error.message}`);
      throw error;
    }
  }

  console.log("\n✅ All Channels indexes created successfully");
}

// Update .env.local with IDs
async function updateEnvFile(databaseId, speechesCollectionId, channelsCollectionId) {
  console.log("\n📝 Updating .env.local file...");

  try {
    const envPath = path.join(process.cwd(), ".env.local");
    let envContent = fs.readFileSync(envPath, "utf8");

    // Add new environment variables
    const newVars = `
# Appwrite Configuration (Auto-generated by setup script)
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=${config.projectId}
EXPO_PUBLIC_APPWRITE_DATABASE_ID=${databaseId}
EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID=${speechesCollectionId}
EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID=${channelsCollectionId}
`;

    // Append if not already present
    if (!envContent.includes("EXPO_PUBLIC_APPWRITE_DATABASE_ID")) {
      envContent += newVars;
      fs.writeFileSync(envPath, envContent);
      console.log("✅ .env.local updated with collection IDs");
    } else {
      console.log("⚠️  Environment variables already exist in .env.local");
      console.log("\n📋 Please manually update these values:");
      console.log(`   EXPO_PUBLIC_APPWRITE_DATABASE_ID=${databaseId}`);
      console.log(`   EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID=${speechesCollectionId}`);
      console.log(`   EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID=${channelsCollectionId}`);
    }
  } catch (error) {
    console.error(`❌ Failed to update .env.local: ${error.message}`);
    console.log("\n📋 Please manually add these to your .env.local:");
    console.log(`   EXPO_PUBLIC_APPWRITE_DATABASE_ID=${databaseId}`);
    console.log(`   EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID=${speechesCollectionId}`);
    console.log(`   EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID=${channelsCollectionId}`);
  }
}

// Main setup function
async function setup() {
  console.log("🚀 Starting Appwrite Setup for Speech App\n");
  console.log("═══════════════════════════════════════════════════════════");

  try {
    // Validate configuration
    validateConfig();
    console.log("✅ Configuration validated");

    // Initialize client
    const { databases, storage } = initializeClient();
    console.log("✅ Appwrite client initialized");

    // Create database
    const databaseId = await createDatabase(databases);

    // Create Speeches collection
    const speechesCollectionId = await createSpeechesCollection(databases, databaseId);
    await createSpeechesAttributes(databases, databaseId, speechesCollectionId);
    await createSpeechesIndexes(databases, databaseId, speechesCollectionId);

    // Create Channels collection
    const channelsCollectionId = await createChannelsCollection(databases, databaseId);
    await createChannelsAttributes(databases, databaseId, channelsCollectionId);
    await createChannelsIndexes(databases, databaseId, channelsCollectionId);

    // Update .env.local
    await updateEnvFile(databaseId, speechesCollectionId, channelsCollectionId);

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("🎉 Setup completed successfully!\n");
    console.log("📋 Summary:");
    console.log(`   Database ID: ${databaseId}`);
    console.log(`   Speeches Collection ID: ${speechesCollectionId}`);
    console.log(`   Channels Collection ID: ${channelsCollectionId}`);
    console.log("\n📝 Next steps:");
    console.log("   1. Verify the collections in your Appwrite console");
    console.log("   2. Set up permissions for the collections");
    console.log("   3. Create an ingestion function to populate speeches");
    console.log("   4. Test the API by running your app");
    console.log("\n💡 Note: History tracking will use AsyncStorage (local only)");
    console.log("\n");
  } catch (error) {
    console.error("\n═══════════════════════════════════════════════════════════");
    console.error("❌ Setup failed:", error.message);
    console.error("\nPlease check the error above and try again.");
    process.exit(1);
  }
}

// Run setup
setup();
