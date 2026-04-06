import { getAllChannels } from "@/lib/channels";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const channels = await getAllChannels();
    return NextResponse.json({ channels });
  } catch (error: any) {
    console.error("Error fetching channels:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch channels" },
      { status: 500 }
    );
  }
}
