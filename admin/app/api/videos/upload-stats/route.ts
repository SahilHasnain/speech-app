import { NextResponse } from "next/server";
import { Client, Databases, Query } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);

const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
const SPEECHES_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID!;
const CHANNELS_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID!;

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

async function fetchSpeechesWithoutVideo() {
  const allSpeeches = [];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const response = await databases.listDocuments(
      DATABASE_ID,
      SPEECHES_COLLECTION_ID,
      [Query.isNull("videoId"), Query.limit(limit), Query.offset(offset)]
    );

    allSpeeches.push(...response.documents);

    if (response.documents.length < limit) break;
    offset += limit;
  }

  return allSpeeches;
}

export async function GET() {
  try {
    const [channels, speeches] = await Promise.all([
      fetchAllChannels(),
      fetchSpeechesWithoutVideo(),
    ]);

    // Calculate stats
    const totalWithoutVideo = speeches.length;
    const shortsWithoutVideo = speeches.filter(
      (s: any) => s.duration < 60
    ).length;
    const speechesWithoutVideo = speeches.filter(
      (s: any) => s.duration >= 60
    ).length;

    return NextResponse.json({
      channels: channels.map((c: any) => ({
        $id: c.$id,
        name: c.name,
        youtubeChannelId: c.youtubeChannelId,
        type: c.type || "channel",
      })),
      stats: {
        totalWithoutVideo,
        shortsWithoutVideo,
        speechesWithoutVideo,
      },
    });
  } catch (error) {
    console.error("Error fetching upload stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch upload stats" },
      { status: 500 }
    );
  }
}
