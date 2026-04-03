/**
 * Video Download and Upload Script for Speech App
 *
 * This script:
 * 1. Fetches speeches from the database that don't have videoId
 * 2. Downloads video using yt-dlp from YouTube
 * 3. Uploads to Appwrite Storage (video-files bucket)
 * 4. Updates database with videoId
 *
 * Usage:
 *   node scripts/download-video.js [--limit=10] [--test] [--quality=720]
 *
 * Options:
 *   --limit=N      Process only N videos (default: all)
 *   --test         Test mode: download only, no upload
 *   --quality=N    Video quality: 480, 720, or 1080 (default: 720)
 */

const { spawn } = require("child_process");
const dotenv = require("dotenv");
const { existsSync, mkdirSync, unlinkSync, statSync } = require("fs");
const { Client, Databases, Query, Storage, ID } = require("node-appwrite");
const { InputFile } = require("node-appwrite/file");
const { dirname, extname, join, basename } = require("path");
const readline = require("readline");

// Load environment variables
dotenv.config({ path: ".env.local" });

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify question
function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Configuration
const APPWRITE_ENDPOINT = process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID;
const SPEECHES_COLLECTION_ID = process.env.EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID;
const VIDEO_BUCKET_ID = "video-files";

// Parse command line arguments
const args = process.argv.slice(2);
const limit =
  parseInt(args.find((arg) => arg.startsWith("--limit="))?.split("=")[1]) ||
  null;
const testMode = args.includes("--test");
const quality =
  parseInt(args.find((arg) => arg.startsWith("--quality="))?.split("=")[1]) ||
  720;

// Validate quality
if (![480, 720, 1080].includes(quality)) {
  console.error("❌ Invalid quality. Must be 480, 720, or 1080");
  process.exit(1);
}

// Temp directory for downloads
const TEMP_DIR = join(process.cwd(), "temp-video");

// Initialize Appwrite
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

function runCommand(command, args) {
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
        reject(
          new Error(`${command} failed with code ${code}${stderr ? `: ${stderr}` : ""}`)
        );
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });
  });
}

async function getVideoCodec(filePath) {
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

async function ensureH264Compatible(filePath) {
  const codec = await getVideoCodec(filePath);
  console.log(`  Video codec: ${codec || "unknown"}`);

  if (codec === "h264") {
    return filePath;
  }

  const transcodedPath = join(
    dirname(filePath),
    `${basename(filePath, extname(filePath))}_h264.mp4`
  );

  console.log("  Transcoding to H.264/AAC for Android compatibility...");

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

  console.log("  âœ“ Transcoded successfully");
  return transcodedPath;
}

/**
 * Ensure temp directory exists
 */
function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
    console.log(`✓ Created temp directory: ${TEMP_DIR}`);
  }
}

/**
 * Download video using yt-dlp
 */
async function downloadVideo(youtubeId, title) {
  const sanitizedTitle = title.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
  const outputPath = join(TEMP_DIR, `${youtubeId}_${sanitizedTitle}.mp4`);

  console.log(`  Downloading: ${title}`);
  console.log(`  YouTube ID: ${youtubeId}`);
  console.log(`  Target Quality: ${quality}p`);

  return new Promise((resolve, reject) => {
    // yt-dlp format selection:
    // - bestvideo[height<=N]: Best video up to N pixels height
    // - bestaudio: Best audio
    // - mp4: Prefer MP4 container
    // - Merge into single file
    const formatString = `bestvideo[vcodec^=avc1][height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[vcodec^=avc1][height<=${quality}][ext=mp4]/bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}][ext=mp4]/best`;

    const ytdlp = spawn("yt-dlp", [
      "-f",
      formatString,
      "--merge-output-format",
      "mp4",
      "--max-filesize",
      "500M", // Limit file size to 500MB
      "--no-playlist",
      "-o",
      outputPath,
      `https://www.youtube.com/watch?v=${youtubeId}`,
    ]);

    let errorOutput = "";

    ytdlp.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ytdlp.stdout.on("data", (data) => {
      process.stdout.write(".");
    });

    ytdlp.on("close", (code) => {
      console.log(""); // New line after progress dots

      if (code === 0 && existsSync(outputPath)) {
        const stats = statSync(outputPath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`  ✓ Downloaded successfully (${sizeMB}MB)`);
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

/**
 * Upload video file to Appwrite Storage
 */
async function uploadVideo(filePath, youtubeId) {
  console.log(`  Uploading to Appwrite Storage...`);

  try {
    const fileName = `${youtubeId}.mp4`;
    const fileSize = statSync(filePath).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);

    console.log(`  File size: ${fileSizeMB}MB`);

    // Check if file is too large (Appwrite has limits)
    if (fileSize > 500 * 1024 * 1024) {
      throw new Error(`File too large: ${fileSizeMB}MB (max 500MB)`);
    }

    const file = await storage.createFile(
      VIDEO_BUCKET_ID,
      ID.unique(),
      InputFile.fromPath(filePath, fileName)
    );

    console.log(`  ✓ Uploaded: ${file.$id}`);
    return file.$id;
  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

/**
 * Update speech document with videoId
 */
async function updateSpeechWithVideoId(speechId, videoFileId) {
  await databases.updateDocument(DATABASE_ID, SPEECHES_COLLECTION_ID, speechId, {
    videoId: videoFileId,
  });
  console.log(`  ✓ Updated speech document with videoId`);
}

/**
 * Clean up temporary file
 */
function cleanupTempFile(filePath) {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      console.log(`  ✓ Cleaned up temp file`);
    }
  } catch (error) {
    console.warn(`  ⚠ Failed to cleanup: ${error.message}`);
  }
}

/**
 * Process a single speech
 */
async function processSpeech(speech, index, total) {
  console.log(`\n[${index + 1}/${total}] Processing: ${speech.title}`);

  let tempFilePath = null;
  let uploadFilePath = null;

  try {
    // Download video
    tempFilePath = await downloadVideo(speech.youtubeId, speech.title);
    uploadFilePath = await ensureH264Compatible(tempFilePath);

    if (!testMode) {
      // Upload to Appwrite
      const videoFileId = await uploadVideo(uploadFilePath, speech.youtubeId);

      // Update database
      await updateSpeechWithVideoId(speech.$id, videoFileId);
    } else {
      console.log(`  ℹ️  Test mode: skipping upload`);
    }

    console.log(`  ✅ Success!`);
    return { success: true, speechId: speech.$id };
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { success: false, speechId: speech.$id, error: error.message };
  } finally {
    // Cleanup temp file (unless test mode)
    if (tempFilePath && !testMode) {
      cleanupTempFile(tempFilePath);
    }
    if (uploadFilePath && uploadFilePath !== tempFilePath && !testMode) {
      cleanupTempFile(uploadFilePath);
    }
  }
}

/**
 * Fetch all speeches without videoId using pagination
 */
async function fetchAllSpeechesWithoutVideo(userLimit = null, uploadMode = "all") {
  const BATCH_SIZE = 100;
  let allSpeeches = [];
  let offset = 0;
  let hasMore = true;

  console.log("📥 Fetching speeches from database in batches...");

  while (hasMore) {
    const queries = [
      Query.isNull("videoId"),
      Query.limit(BATCH_SIZE),
      Query.offset(offset),
    ];

    const response = await databases.listDocuments(
      DATABASE_ID,
      SPEECHES_COLLECTION_ID,
      queries
    );

    let batch = response.documents;
    
    // Filter based on upload mode
    if (uploadMode === "shorts") {
      batch = batch.filter(speech => speech.duration < 60);
    } else if (uploadMode === "speeches") {
      batch = batch.filter(speech => speech.duration >= 60);
    }
    // "all" mode doesn't filter
    
    allSpeeches.push(...batch);

    console.log(
      `  Fetched batch: ${batch.length} speeches (total: ${allSpeeches.length})`
    );

    // Check if we should continue
    hasMore = response.documents.length === BATCH_SIZE;
    offset += BATCH_SIZE;

    // If user specified a limit, stop when we reach it
    if (userLimit && allSpeeches.length >= userLimit) {
      allSpeeches = allSpeeches.slice(0, userLimit);
      hasMore = false;
    }
  }

  return allSpeeches;
}

/**
 * Main function
 */
async function main() {
  console.log("🎥 Video Download and Upload Script (Speech App)\n");
  console.log("Configuration:");
  console.log(`  Endpoint: ${APPWRITE_ENDPOINT}`);
  console.log(`  Project: ${APPWRITE_PROJECT_ID}`);
  console.log(`  Database: ${DATABASE_ID}`);
  console.log(`  Collection: ${SPEECHES_COLLECTION_ID}`);
  console.log(`  Bucket: ${VIDEO_BUCKET_ID}`);
  console.log(`  Quality: ${quality}p`);
  console.log(`  Limit: ${limit || "All videos"}`);
  console.log(
    `  Mode: ${testMode ? "Test (no upload)" : "Full (download + upload)"}\n`
  );

  // Ask what to upload
  console.log("📊 What do you want to upload?");
  console.log("   1. Shorts only (< 60 seconds)");
  console.log("   2. Speeches only (≥ 60 seconds)");
  console.log("   3. All (both shorts and speeches)");
  const uploadChoice = await question("\nChoice (1/2/3, default: 3): ");
  
  let uploadMode = "all";
  if (uploadChoice.trim() === "1") {
    uploadMode = "shorts";
    console.log("✅ Will upload shorts only\n");
  } else if (uploadChoice.trim() === "2") {
    uploadMode = "speeches";
    console.log("✅ Will upload speeches only\n");
  } else {
    uploadMode = "all";
    console.log("✅ Will upload all videos\n");
  }

  // Ensure temp directory exists
  ensureTempDir();

  // Fetch all speeches without video using pagination
  const speeches = await fetchAllSpeechesWithoutVideo(limit, uploadMode);
  console.log(`✓ Found ${speeches.length} speeches without video\n`);

  if (speeches.length === 0) {
    console.log("No speeches to process. All videos already uploaded!");
    rl.close();
    return;
  }

  // Process each speech
  const results = [];
  for (let i = 0; i < speeches.length; i++) {
    const result = await processSpeech(speeches[i], i, speeches.length);
    results.push(result);

    // Delay between downloads to avoid rate limiting
    if (i < speeches.length - 1) {
      console.log("  ⏳ Waiting 3 seconds before next download...");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`  Total processed: ${results.length}`);
  console.log(`  Successful: ${results.filter((r) => r.success).length}`);
  console.log(`  Failed: ${results.filter((r) => !r.success).length}`);

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    console.log("\n❌ Failed speeches:");
    failed.forEach((f) => {
      console.log(`  - ${f.speechId}: ${f.error}`);
    });
  }

  console.log("=".repeat(60));

  if (testMode) {
    console.log(`\n✅ Test completed! Video files saved to: ${TEMP_DIR}`);
  } else {
    console.log("\n✅ Done! All video files uploaded to Appwrite Storage");
  }
  
  rl.close();
}

// Run the script
main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
