# Speech Ingestion Guide

This guide explains how to ingest Islamic speeches from YouTube channels into your Appwrite database.

## Prerequisites

1. ✅ Appwrite database and collections set up (run `npm run setup:appwrite`)
2. ✅ YouTube Data API v3 key ([Get one here](https://console.cloud.google.com/apis/credentials))
3. ✅ YouTube channel IDs of Islamic scholars you want to track

## Getting YouTube Channel IDs

1. Go to the YouTube channel page
2. Look at the URL:
   - If it's `youtube.com/channel/UCxxxxx`, the ID is `UCxxxxx`
   - If it's `youtube.com/@username`, click "About" tab and look for "Channel ID"
3. Or use this tool: https://commentpicker.com/youtube-channel-id.php

## Setup

### 1. Add YouTube API Key

Edit `.env.local` or `functions/.env`:

```bash
YOUTUBE_API_KEY=your_youtube_api_key_here
```

### 2. Add Channel IDs

Add comma-separated YouTube channel IDs:

```bash
YOUTUBE_CHANNEL_IDS=UCChannelID1,UCChannelID2,UCChannelID3
```

**Example Islamic Speech Channels**:
```bash
# Example channels (replace with actual channels you want to track)
YOUTUBE_CHANNEL_IDS=UCDwHEBKDyZvCbHLjNh8olfQ,UCl_fO8gGJweYbvjrGASq-yw
```

### 3. Add Channels to Database (Optional)

You can also add channels directly to the Channels collection in Appwrite:

1. Go to Appwrite Console → Databases → Islamic Speeches → Channels
2. Click "Add Document"
3. Add:
   ```json
   {
     "name": "Channel Name",
     "youtubeChannelId": "UCxxxxx",
     "thumbnailUrl": "https://...",
     "description": "Channel description"
   }
   ```

## Running Ingestion

### Option 1: Local Script (Recommended for Testing)

```bash
npm run ingest:speeches
```

This will:
- Fetch videos from all configured channels
- Filter videos to only include speeches ≤5 minutes (300 seconds)
- Skip videos <1 minute (likely shorts/clips)
- Add new speeches to database
- Update view counts for existing speeches
- Show detailed progress and statistics

### Option 2: Appwrite Function (For Production)

#### Deploy the Function

1. Install Appwrite CLI:
   ```bash
   npm install -g appwrite
   ```

2. Login to Appwrite:
   ```bash
   appwrite login
   ```

3. Initialize project:
   ```bash
   cd speech-app/functions/ingest-speeches
   appwrite init function
   ```

4. Deploy:
   ```bash
   appwrite deploy function
   ```

5. Set environment variables in Appwrite Console:
   - Go to Functions → ingest-speeches → Settings → Variables
   - Add all required variables from `functions/.env`

#### Schedule the Function

1. Go to Appwrite Console → Functions → ingest-speeches
2. Click "Settings" → "Schedule"
3. Add a cron expression:
   - Every hour: `0 * * * *`
   - Every 6 hours: `0 */6 * * *`
   - Daily at 3 AM: `0 3 * * *`

## Ingestion Rules

### Duration Filters

- **Minimum**: 60 seconds (1 minute)
  - Filters out shorts, clips, trailers
- **Maximum**: 300 seconds (5 minutes)
  - Only speeches ≤5 minutes are ingested
  - Longer videos are automatically filtered out

### What Gets Ingested

✅ **Included**:
- Videos between 1-5 minutes
- All videos from configured channels
- New videos and view count updates

❌ **Excluded**:
- Videos <1 minute (shorts, clips)
- Videos >5 minutes (longer speeches)
- Duplicate videos (based on YouTube ID)

## Output Example

```
🚀 Starting speech ingestion...

✅ Environment variables validated
✅ Found 2 channel(s) to process
✅ Appwrite client initialized

📦 Fetching existing speeches from database...
✅ Found 45 existing speeches in database

📺 Processing channel: UCChannelID1
   Fetching videos from YouTube...
   Fetched 150 videos so far...
   Processed details for 150 videos...
   ✅ Found 150 videos for channel: Islamic Guidance

   ✅ Added: The Importance of Prayer (15000 views, 245s)
   🔄 Updated: Understanding Tawheed (8500 → 8750 views)
   ⏭️  Unchanged: The Five Pillars
   🚫 Filtered: Long Lecture Series (duration 3600s > 300s)

============================================================
📊 Per-Channel Statistics:
============================================================

📺 Islamic Guidance (UCChannelID1):
   📹 Total videos: 150
   ✅ New speeches added: 12
   🔄 Speeches updated: 8
   ⏭️  Speeches unchanged: 25
   🚫 Videos filtered (>5min or <1min): 105
   ❌ Errors: 0

============================================================
📊 Overall Summary:
============================================================
   📺 Channels processed: 2
   📹 Total videos processed: 300
   ✅ New speeches added: 25
   🔄 Speeches updated: 15
   ⏭️  Speeches unchanged: 50
   🚫 Videos filtered: 210
   ❌ Errors: 0

✨ Ingestion complete!
```

## Troubleshooting

### Error: "Missing YOUTUBE_API_KEY"

Add your YouTube API key to `.env.local`:
```bash
YOUTUBE_API_KEY=your_key_here
```

### Error: "Missing YOUTUBE_CHANNEL_IDS"

Add channel IDs to `.env.local`:
```bash
YOUTUBE_CHANNEL_IDS=UCChannelID1,UCChannelID2
```

### Error: "YouTube API error: 403"

Your API key might be invalid or quota exceeded:
1. Check your API key in Google Cloud Console
2. Enable YouTube Data API v3
3. Check your quota usage

### Error: "Channel not found"

The channel ID might be incorrect:
1. Verify the channel ID is correct
2. Make sure it starts with "UC"
3. Try accessing the channel directly on YouTube

### No speeches added (all filtered)

If all videos are filtered:
1. Check if the channel has videos between 1-5 minutes
2. Verify the duration filter settings
3. Look at the filtered count in the output

## Best Practices

1. **Start Small**: Test with 1-2 channels first
2. **Check Quota**: YouTube API has daily quotas (10,000 units/day)
3. **Schedule Wisely**: Run ingestion every 6-12 hours, not every minute
4. **Monitor Logs**: Check Appwrite function logs for errors
5. **Verify Data**: Check Appwrite Console to see ingested speeches

## API Quota Management

YouTube Data API v3 quota costs:
- List videos: 1 unit per request
- Get video details: 1 unit per request
- Daily quota: 10,000 units

**Estimated costs per channel**:
- 100 videos = ~3 units (1 for playlist + 2 for video details)
- 1000 videos = ~21 units

**Tips to save quota**:
- Run ingestion less frequently (every 6-12 hours)
- Limit `maxResults` in the script
- Only add active channels

## Next Steps

1. Run ingestion: `npm run ingest:speeches`
2. Check Appwrite Console for ingested speeches
3. Set up automatic ingestion with Appwrite Functions
4. Add more channels as needed
5. Monitor quota usage in Google Cloud Console

## Resources

- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [Appwrite Functions Documentation](https://appwrite.io/docs/functions)
- [Cron Expression Generator](https://crontab.guru/)
