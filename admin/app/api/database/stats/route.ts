import { NextResponse } from "next/server";
import { Client, Databases, Query, Storage } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
const SPEECHES_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID!;
const CHANNELS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID!;
const VIDEO_BUCKET_ID = "video-files";

async function getCollectionCount(collectionId: string) {
  try {
    const response = await databases.listDocuments(DATABASE_ID, collectionId, [
      Query.limit(1),
    ]);
    return response.total;
  } catch (error) {
    console.error(`Error fetching count: ${error}`);
    return 0;
  }
}

async function getStorageFileCount() {
  try {
    let total = 0;
    let offset = 0;
    const limit = 100;

    while (true) {
      const response = await storage.listFiles(VIDEO_BUCKET_ID, [
        Query.limit(limit),
        Query.offset(offset),
      ]);

      total += response.files.length;

      if (response.files.length < limit) break;
      offset += limit;
    }

    return total;
  } catch (error) {
    console.error(`Error fetching storage count: ${error}`);
    return 0;
  }
}

async function fetchAllChannels() {
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

async function getChannelSpeechCount(channelId: string) {
  try {
    const response = await databases.listDocuments(
      DATABASE_ID,
      SPEECHES_COLLECTION_ID,
      [Query.equal("channelId", channelId), Query.limit(1)]
    );
    return response.total;
  } catch (error) {
    console.error(`Error fetching channel speech count: ${error}`);
    return 0;
  }
}

async function getChannelVideoCount(channelId: string) {
  try {
    let allSpeeches = [];
    let offset = 0;
    const limit = 5000;

    while (true) {
      const response = await databases.listDocuments(
        DATABASE_ID,
        SPEECHES_COLLECTION_ID,
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
    console.error(`Error fetching channel video count: ${error}`);
    return 0;
  }
}

export async function GET() {
  try {
    // Get collection counts
    const speechesCount = await getCollectionCount(SPEECHES_COLLECTION_ID);
    const channelsCount = await getCollectionCount(CHANNELS_COLLECTION_ID);
    const videoFilesCount = await getStorageFileCount();

    // Get all channels
    const channels = await fetchAllChannels();

    // Get speech and video counts for each channel
    const channelsWithCounts = await Promise.all(
      channels.map(async (channel: any) => {
        const speechCount = await getChannelSpeechCount(channel.youtubeChannelId);
        const videoCount = await getChannelVideoCount(channel.youtubeChannelId);

        return {
          $id: channel.$id,
          name: channel.name,
          youtubeChannelId: channel.youtubeChannelId,
          type: channel.type || "channel",
          ignoreDuration: channel.ignoreDuration || false,
          includeShorts: channel.includeShorts || false,
          speechCount,
          videoCount,
        };
      })
    );

    // Sort by speech count descending
    channelsWithCounts.sort((a, b) => b.speechCount - a.speechCount);

    return NextResponse.json({
      stats: {
        speechesCount,
        channelsCount,
        videoFilesCount,
      },
      channels: channelsWithCounts,
    });
  } catch (error) {
    console.error("Error fetching database stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch database stats" },
      { status: 500 }
    );
  }
}
