import { cleanupOrphanedSpeeches } from "@/lib/channels";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const result = await cleanupOrphanedSpeeches();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount,
      deletedVideos: result.deletedVideos,
      deletedOrphanedStorageVideos: result.deletedOrphanedStorageVideos,
      orphanedChannels: result.orphanedChannels,
    });
  } catch (error: any) {
    console.error("Error cleaning up orphaned speeches:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cleanup orphaned speeches" },
      { status: 500 }
    );
  }
}
