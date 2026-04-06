import { spawn } from "child_process";
import { existsSync, mkdirSync, statSync, unlinkSync } from "fs";
import { Client, Databases, ID, Query, Storage } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { basename, dirname, extname, join } from "path";

// Types
export interface UploadConfig {
  channels: string[];
  uploadMode: "all" | "shorts" | "speeches";
  quality: 480 | 720 | 1080;
  limit: number;
}

export interface Speech {
  $id: string;
  title: string;
  youtubeId: string;
  channelId: string;
  duration: number;
  isShort?: boolean;
}

export interface ProgressCallback {
  (data: {
    type: "progress" | "success" | "error" | "complete";
    current: number;
    total: number;
    speechId?: string;
    title?: string;
    message?: string;
    status?: "downloading" | "transcoding" | "uploading" | "updating";
  }): void;
}

// Configuration
const TEMP_DIR = join(process.cwd(), "..", "temp-video");

// Initialize Appwrite client
function getAppwriteClient() {
  const client = new Client()
    .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_API_KEY!);

  return {
    databases: new Databases(client),
    storage: new Storage(client),
  };
}

const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID!;
const SPEECHES_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID!;
const VIDEO_BUCKET_ID = "video-files";

// Utility functions
function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} failed with code ${code}${stderr ? `: ${stderr}` : ""}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });
  });
}

async function getVideoCodec(filePath: string): Promise<string> {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);

  return stdout.trim().toLowerCase();
}

async function ensureH264Compatible(filePath: string): Promise<string> {
  const codec = await getVideoCodec(filePath);

  if (codec === "h264") {
    return filePath;
  }

  const transcodedPath = join(
    dirname(filePath),
    `${basename(filePath, extname(filePath))}_h264.mp4`
  );

  await runCommand("ffmpeg", [
    "-y",
    "-i",
    filePath,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    transcodedPath,
  ]);

  const transcodedCodec = await getVideoCodec(transcodedPath);
  if (transcodedCodec !== "h264") {
    throw new Error(`Transcode failed, resulting codec is ${transcodedCodec}`);
  }

  return transcodedPath;
}

function ensureTempDir(): void {
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function cleanupTempFile(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`Failed to cleanup ${filePath}:`, error);
  }
}

// Core functions
export async function downloadVideo(
  youtubeId: string,
  title: string,
  quality: number
): Promise<string> {
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
  const outputPath = join(TEMP_DIR, `${youtubeId}_${sanitizedTitle}.mp4`);

  return new Promise((resolve, reject) => {
    const formatString = `bestvideo[vcodec^=avc1][height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[vcodec^=avc1][height<=${quality}][ext=mp4]/bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}][ext=mp4]/best`;

    const ytdlp = spawn("yt-dlp", [
      "-f",
      formatString,
      "--merge-output-format",
      "mp4",
      "--max-filesize",
      "500M",
      "--no-playlist",
      "-o",
      outputPath,
      `https://www.youtube.com/watch?v=${youtubeId}`,
    ]);

    let errorOutput = "";

    ytdlp.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on("close", (code) => {
      if (code === 0 && existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp failed with code ${code}: ${errorOutput}`));
      }
    });

    ytdlp.on("error", (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

export async function uploadVideo(filePath: string, youtubeId: string): Promise<string> {
  const { storage } = getAppwriteClient();
  const fileName = `${youtubeId}.mp4`;
  const fileSize = statSync(filePath).size;

  if (fileSize > 500 * 1024 * 1024) {
    throw new Error(`File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB (max 500MB)`);
  }

  const file = await storage.createFile(
    VIDEO_BUCKET_ID,
    ID.unique(),
    InputFile.fromPath(filePath, fileName)
  );

  return file.$id;
}

export async function updateSpeechWithVideoId(speechId: string, videoFileId: string): Promise<void> {
  const { databases } = getAppwriteClient();
  await databases.updateDocument(DATABASE_ID, SPEECHES_COLLECTION_ID, speechId, {
    videoId: videoFileId,
  });
}

export async function fetchSpeechesWithoutVideo(config: UploadConfig): Promise<Speech[]> {
  const { databases } = getAppwriteClient();
  const BATCH_SIZE = 100;
  let allSpeeches: Speech[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore && allSpeeches.length < config.limit) {
    const queries = [Query.isNull("videoId"), Query.limit(BATCH_SIZE), Query.offset(offset)];

    const response = await databases.listDocuments(DATABASE_ID, SPEECHES_COLLECTION_ID, queries);

    let batch = response.documents as any[];

    // Filter by selected channels
    if (config.channels.length > 0) {
      batch = batch.filter((speech) => config.channels.includes(speech.channelId));
    }

    // Filter based on upload mode
    if (config.uploadMode === "shorts") {
      batch = batch.filter((speech) => speech.duration < 60);
    } else if (config.uploadMode === "speeches") {
      batch = batch.filter((speech) => speech.duration >= 60);
    }

    allSpeeches.push(...(batch as Speech[]));

    hasMore = response.documents.length === BATCH_SIZE;
    offset += BATCH_SIZE;

    if (allSpeeches.length >= config.limit) {
      allSpeeches = allSpeeches.slice(0, config.limit);
      hasMore = false;
    }
  }

  return allSpeeches;
}

export async function processSpeech(
  speech: Speech,
  quality: number,
  onProgress?: (status: string, message?: string) => void
): Promise<{ success: boolean; error?: string }> {
  let tempFilePath: string | null = null;
  let uploadFilePath: string | null = null;

  try {
    // Download
    onProgress?.("downloading", `Downloading: ${speech.title}`);
    tempFilePath = await downloadVideo(speech.youtubeId, speech.title, quality);

    // Transcode if needed
    onProgress?.("transcoding", "Checking codec compatibility...");
    uploadFilePath = await ensureH264Compatible(tempFilePath);

    // Upload
    onProgress?.("uploading", "Uploading to Appwrite Storage...");
    const videoFileId = await uploadVideo(uploadFilePath, speech.youtubeId);

    // Update database
    onProgress?.("updating", "Updating database...");
    await updateSpeechWithVideoId(speech.$id, videoFileId);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    // Cleanup
    if (tempFilePath) cleanupTempFile(tempFilePath);
    if (uploadFilePath && uploadFilePath !== tempFilePath) cleanupTempFile(uploadFilePath);
  }
}

export async function uploadVideos(
  config: UploadConfig,
  progressCallback: ProgressCallback
): Promise<{ successful: number; failed: number; errors: string[] }> {
  ensureTempDir();

  // Fetch speeches
  const speeches = await fetchSpeechesWithoutVideo(config);

  if (speeches.length === 0) {
    progressCallback({
      type: "complete",
      current: 0,
      total: 0,
      message: "No speeches found without videos",
    });
    return { successful: 0, failed: 0, errors: [] };
  }

  let successful = 0;
  let failed = 0;
  const errors: string[] = [];

  // Process each speech
  for (let i = 0; i < speeches.length; i++) {
    const speech = speeches[i];

    const result = await processSpeech(speech, config.quality, (status, message) => {
      progressCallback({
        type: "progress",
        current: i + 1,
        total: speeches.length,
        speechId: speech.$id,
        title: speech.title,
        status: status as any,
        message,
      });
    });

    if (result.success) {
      successful++;
      progressCallback({
        type: "success",
        current: i + 1,
        total: speeches.length,
        speechId: speech.$id,
        title: speech.title,
        message: "Upload successful",
      });
    } else {
      failed++;
      errors.push(`${speech.title}: ${result.error}`);
      progressCallback({
        type: "error",
        current: i + 1,
        total: speeches.length,
        speechId: speech.$id,
        title: speech.title,
        message: result.error,
      });
    }

    // Delay between downloads
    if (i < speeches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  progressCallback({
    type: "complete",
    current: speeches.length,
    total: speeches.length,
    message: `Complete: ${successful} successful, ${failed} failed`,
  });

  return { successful, failed, errors };
}
