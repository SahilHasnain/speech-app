import { UploadConfig, uploadVideos } from "@/lib/video-upload";
import { NextRequest } from "next/server";

export const maxDuration = 300; // 5 minutes max for Vercel, adjust as needed

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config: UploadConfig = {
      channels: body.channels || [],
      uploadMode: body.uploadMode || "all",
      quality: body.quality || 720,
      limit: body.limit || 10,
    };

    // Validate config
    if (config.channels.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one channel must be selected" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (![480, 720, 1080].includes(config.quality)) {
      return new Response(
        JSON.stringify({ error: "Invalid quality. Must be 480, 720, or 1080" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create a readable stream for Server-Sent Events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await uploadVideos(config, (data) => {
            // Send progress update as SSE
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          });

          // Send final result
          const finalMessage = `data: ${JSON.stringify({
            type: "complete",
            result,
          })}\n\n`;
          controller.enqueue(encoder.encode(finalMessage));

          controller.close();
        } catch (error) {
          const errorMessage = `data: ${JSON.stringify({
            type: "error",
            message: error instanceof Error ? error.message : "Upload failed",
          })}\n\n`;
          controller.enqueue(encoder.encode(errorMessage));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to start upload",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
