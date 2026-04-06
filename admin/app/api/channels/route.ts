import { getAllChannels } from "@/lib/channels";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("Fetching all channels...");
    const channels = await getAllChannels();
    console.log(`Found ${channels.length} channels`);
    return NextResponse.json({ channels });
  } catch (error: any) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch channels" },
      { status: 500 }
    );
  }
}
