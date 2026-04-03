# Video Player Migration Guide - Speech App

## Overview

Migrate from YouTube iframe to custom video player with self-hosted videos on Appwrite Storage.

## What's Already Done ✅

- ✅ Appwrite `video-files` bucket created
- ✅ Database `videoId` field added to speeches collection
- ✅ Video download script created (`scripts/download-video.js`)
- ✅ Custom video player component created (`components/CustomVideoPlayer.tsx`)
- ✅ NPM script added (`npm run upload:video`)

## Quick Start

### 1. Test Video Download

```bash
# Download 1 video for testing (no upload)
npm run upload:video -- --limit=1 --test --quality=720
```

Check `temp-video/` folder for the downloaded video.

### 2. Upload Test Video

```bash
# Upload 1 video to Appwrite
npm run upload:video -- --limit=1 --quality=720
```

### 3. Verify in Appwrite Dashboard

- Go to Appwrite Console
- Navigate to Storage → video-files bucket
- Verify video file is uploaded

### 4. Update video.tsx to Use Custom Player

Add this to `app/video.tsx`:

```typescript
import { CustomVideoPlayer } from "@/components/CustomVideoPlayer";
import { Video } from "expo-av";

// Add state for custom video
const [customVideoUrl, setCustomVideoUrl] = React.useState<string | null>(null);
const [useCustomPlayer, setUseCustomPlayer] = React.useState(false);
const customVideoRef = React.useRef<Video>(null);

// Get videoId from params
const propVideoId = params.videoId;

// Load custom video URL if videoId exists
React.useEffect(() => {
  if (propVideoId) {
    // Construct Appwrite video URL
    const videoUrl = `${APPWRITE_ENDPOINT}/storage/buckets/video-files/files/${propVideoId}/view?project=${APPWRITE_PROJECT_ID}`;
    setCustomVideoUrl(videoUrl);
    setUseCustomPlayer(true);
  } else {
    setUseCustomPlayer(false);
  }
}, [propVideoId]);

// Handle custom video playback
const handleCustomVideoStatus = React.useCallback(
  (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      const positionSeconds = status.positionMillis / 1000;
      setVideoPosition(positionSeconds);

      if (status.durationMillis && videoDuration === 0) {
        const durationSeconds = status.durationMillis / 1000;
        setVideoDuration(durationSeconds);
      }

      if (status.didJustFinish) {
        setVideoPlaying(false);
        if (isRepeatEnabled && customVideoRef.current) {
          customVideoRef.current.replayAsync();
          setVideoPlaying(true);
        }
      }
    }
  },
  [videoDuration, isRepeatEnabled]
);

// Seek function for custom player
const seekToPositionCustom = async (seconds: number) => {
  if (customVideoRef.current) {
    try {
      await customVideoRef.current.setPositionAsync(seconds * 1000);
      setVideoPosition(seconds);
    } catch (error) {
      console.error("Seek error:", error);
    }
  }
};

// In the render, replace YoutubePlayer with conditional rendering:
{useCustomPlayer && customVideoUrl ? (
  <CustomVideoPlayer
    ref={customVideoRef}
    videoUrl={customVideoUrl}
    isPlaying={videoPlaying}
    onPlaybackStatusUpdate={handleCustomVideoStatus}
    onReadyForDisplay={() => setIsLoading(false)}
    onError={(error) => {
      console.error("Video error:", error);
      setIsLoading(false);
      Alert.alert("Video Error", "Unable to load video.");
    }}
    initialPosition={videoPosition}
  />
) : (
  <YoutubePlayer
    // ... existing YouTube player code
  />
)}
```

## Script Options

```bash
# Test mode (download only, no upload)
npm run upload:video -- --test

# Limit number of videos
npm run upload:video -- --limit=10

# Set video quality (480p, 720p, or 1080p)
npm run upload:video -- --quality=720

# Combine options
npm run upload:video -- --limit=5 --quality=480 --test
```

## Video Quality Guide

| Quality | Resolution | File Size | Use Case |
|---------|-----------|-----------|----------|
| 480p | 854×480 | ~30-50MB | Older/less popular content |
| 720p | 1280×720 | ~50-100MB | **Recommended** - Good balance |
| 1080p | 1920×1080 | ~100-200MB | Premium/popular content |

## Migration Strategy

### Phase 1: Test (Week 1)
```bash
npm run upload:video -- --limit=5 --quality=720
```
- Upload 5 test videos
- Implement custom player in video.tsx
- Test on both iOS and Android

### Phase 2: Popular Videos (Week 2-3)
```bash
npm run upload:video -- --limit=50 --quality=720
```
- Upload 50-100 most viewed speeches
- Monitor costs and performance
- Gather user feedback

### Phase 3: Gradual Migration (Month 2-3)
```bash
npm run upload:video -- --limit=100 --quality=720
```
- Upload remaining videos in batches
- Keep YouTube as fallback
- Monitor error rates

### Phase 4: Cleanup (Month 4)
- Remove YouTube iframe dependency
- Optimize storage
- Implement advanced features

## Implementation Checklist

### Infrastructure ✅
- [x] Video bucket created
- [x] Database schema updated
- [x] Download script created
- [x] Custom player component created

### Development
- [ ] Update video.tsx with custom player
- [ ] Add Appwrite video URL helper
- [ ] Implement fallback to YouTube
- [ ] Test play/pause controls
- [ ] Test seek functionality
- [ ] Test fullscreen mode
- [ ] Test repeat functionality

### Testing
- [ ] Test video download script
- [ ] Test video upload
- [ ] Test custom player playback
- [ ] Test YouTube fallback
- [ ] Test on iOS
- [ ] Test on Android
- [ ] Test offline mode
- [ ] Test error handling
- [ ] Test progress tracking

### Migration
- [ ] Upload test videos (5)
- [ ] Monitor for issues
- [ ] Upload popular videos (50-100)
- [ ] Monitor costs and performance
- [ ] Continue gradual migration
- [ ] Remove YouTube dependency

## Troubleshooting

### yt-dlp not found
```bash
# Install yt-dlp
pip install yt-dlp
# or
brew install yt-dlp
```

### Download fails
- Check YouTube URL is valid
- Try with cookies: `--cookies cookies.txt`
- Reduce quality: `--quality=480`

### Upload fails
- Check file size (max 500MB)
- Verify Appwrite API key in `.env.local`
- Check bucket permissions
- Try smaller batch: `--limit=5`

### Video won't play
- Verify video URL is accessible
- Check bucket permissions (public read)
- Test video file in browser
- Check video format (should be MP4)

## Cost Estimation

### Storage (1000 videos at 720p)
- Average size: 75MB per video
- Total: ~75GB
- Estimated cost: $5-15/month

### Bandwidth (10,000 monthly views)
- Per view: ~52MB (70% watch time)
- Monthly: ~525GB
- Estimated cost: $10-30/month

**Total: $15-45/month**

## Benefits

After migration:
- ✅ **Offline Support** - Users can download videos
- ✅ **Better UX** - Custom controls and features
- ✅ **No Restrictions** - No YouTube API limits
- ✅ **Professional** - No YouTube branding
- ✅ **Full Control** - Customize everything
- ✅ **Future-Proof** - Add features as needed

## Next Steps

1. **Test the download script**
   ```bash
   npm run upload:video -- --limit=1 --test
   ```

2. **Review downloaded video**
   - Check quality
   - Check file size
   - Verify it plays correctly

3. **Upload test video**
   ```bash
   npm run upload:video -- --limit=1
   ```

4. **Implement custom player**
   - Update video.tsx
   - Test thoroughly

5. **Gradual migration**
   - Start with popular videos
   - Monitor costs and performance
   - Adjust strategy as needed

---

**Ready to start?** Run `npm run upload:video -- --limit=1 --test` to download your first video!
