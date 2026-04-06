import {
    fetchYouTubeChannelInfo,
    fetchYouTubePlaylistInfo,
} from "@/lib/channels";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourceId, sourceType } = body;

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

    let info;

    if (sourceType === "playlist") {
      info = await fetchYouTubePlaylistInfo(sourceId, youtubeApiKey);
    } else {
      info = await fetchYouTubeChannelInfo(sourceId, youtubeApiKey);
    }

    return NextResponse.json({ info });
  } catch (error: any) {
    console.error("Error fetching YouTube info:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch YouTube info" },
      { status: 500 }
    );
  }
}
