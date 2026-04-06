import {
    addChannel,
    fetchYouTubeChannelInfo,
    fetchYouTubePlaylistInfo,
    type ChannelInfo,
} from "@/lib/channels";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceId, sourceType, ignoreDuration, includeShorts } = body;

    if (!sourceId || !sourceType) {
      return NextResponse.json(
        { error: "Missing required fields: sourceId and sourceType" },
        { status: 400 }
      );
    }

    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    if (!youtubeApiKey) {
      return NextResponse.json(
        { error: "YouTube API key not configured" },
        { status: 500 }
      );
    }

    // Fetch info from YouTube
    let channelInfo: ChannelInfo;

    if (sourceType === "playlist") {
      channelInfo = await fetchYouTubePlaylistInfo(sourceId, youtubeApiKey);
    } else {
      channelInfo = await fetchYouTubeChannelInfo(sourceId, youtubeApiKey);
    }

    // Add settings
    channelInfo.ignoreDuration = ignoreDuration || false;
    channelInfo.includeShorts = includeShorts || false;

    // Add to database
    const result = await addChannel(channelInfo);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      channel: result.channel,
      info: channelInfo,
    });
  } catch (error: any) {
    console.error("Error adding channel:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add channel" },
      { status: 500 }
    );
  }
}
