import { updateChannel } from "@/lib/channels";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { youtubeChannelId, ...updates } = body;

    if (!youtubeChannelId) {
      return NextResponse.json(
        { error: "Missing required field: youtubeChannelId" },
        { status: 400 }
      );
    }

    const result = await updateChannel(youtubeChannelId, updates);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      channel: result.channel,
    });
  } catch (error: any) {
    console.error("Error updating channel:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update channel" },
      { status: 500 }
    );
  }
}
