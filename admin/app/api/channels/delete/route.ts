import { deleteChannel } from "@/lib/channels";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { youtubeChannelId } = body;

    if (!youtubeChannelId) {
      return NextResponse.json(
        { error: "Missing required field: youtubeChannelId" },
        { status: 400 }
      );
    }

    const result = await deleteChannel(youtubeChannelId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      deletedSpeeches: result.deletedSpeeches,
      deletedVideos: result.deletedVideos,
    });
  } catch (error: any) {
    console.error("Error deleting channel:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete channel" },
      { status: 500 }
    );
  }
}
