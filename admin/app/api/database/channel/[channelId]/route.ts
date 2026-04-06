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

async function fetchChannelSpeeches(channelId: string) {
  const allSpeeches = [];
  let offset = 0;
  const limit = 5000;

  while (true) {
    const response = await databases.listDocuments(
      DATABASE_ID,
      SPEECHES_COLLECTION_ID,
      [Query.equal("channelId", channelId), Query.limit(limit), Query.offset(offset)]
    );

    allSpeeches.push(...response.documents);

    if (response.documents.length < limit) break;
    offset += limit;
  }

  return allSpeeches;
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

    const totalVideos = allSpeeches.length;
    const speechVideos = allSpeeches.filter((s) => s.isShort !== true).length;
    const shortVideos = allSpeeches.filter((s) => s.isShort === true).length;

    return {
      total: totalVideos,
      speeches: speechVideos,
      shorts: shortVideos,
    };
  } catch (error) {
    console.error(`Error fetching channel video count: ${error}`);
    return { total: 0, speeches: 0, shorts: 0 };
  }
}

function analyzeChannelStats(speeches: any[]) {
  const total = speeches.length;
  const shorts = speeches.filter((s) => s.isShort === true).length;
  const speechesOnly = total - shorts;
  const under20Min = speeches.filter((s) => s.duration < 1200).length;
  const over20Min = speeches.filter((s) => s.duration >= 1200).length;

  const totalDuration = speeches.reduce((sum, s) => sum + s.duration, 0);
  const avgDuration = total > 0 ? totalDuration / total : 0;
  const maxDuration = total > 0 ? Math.max(...speeches.map((s) => s.duration)) : 0;
  const minDuration = total > 0 ? Math.min(...speeches.map((s) => s.duration)) : 0;

  return {
    total,
    speechesOnly,
    shorts,
    under20Min,
    over20Min,
    totalDuration,
    avgDuration,
    maxDuration,
    minDuration,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;

    // Fetch channel info
    const channelsResponse = await databases.listDocuments(
      DATABASE_ID,
      CHANNELS_COLLECTION_ID,
      [Query.equal("youtubeChannelId", channelId), Query.limit(1)]
    );

    if (channelsResponse.documents.length === 0) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }

    const channel = channelsResponse.documents[0];

    // Fetch all speeches for this channel
    const speeches = await fetchChannelSpeeches(channelId);

    // Get video counts
    const videoCounts = await getChannelVideoCount(channelId);

    // Analyze stats
    const stats = analyzeChannelStats(speeches);

    return NextResponse.json({
      $id: channel.$id,
      name: channel.name,
      youtubeChannelId: channel.youtubeChannelId,
      type: channel.type || "channel",
      ignoreDuration: channel.ignoreDuration || false,
      includeShorts: channel.includeShorts || false,
      totalCount: stats.total,
      speechesOnlyCount: stats.speechesOnly,
      shortsCount: stats.shorts,
      videoCount: videoCounts.total,
      speechVideoCount: videoCounts.speeches,
      shortVideoCount: videoCounts.shorts,
      documentsWithoutVideo: stats.total - videoCounts.total,
      ...stats,
    });
  } catch (error) {
    console.error("Error fetching channel details:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel details" },
      { status: 500 }
    );
  }
}
