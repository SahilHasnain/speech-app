# Migration from Naat-Collection

This document explains what was adapted from the naat-collection app and what changes were made.

## File Mapping

### Copied & Adapted

| Naat-Collection | Speech-App | Changes |
|----------------|------------|---------|
| `NaatCard.tsx` | `SpeechCard.tsx` | Renamed, removed audio-specific props, changed icon from headphone to mic |
| `EmptyState.tsx` | `EmptyState.tsx` | Copied as-is |
| `ResponsivePressable.tsx` | `ResponsivePressable.tsx` | Copied as-is |
| `constants/theme.ts` | `constants/theme.ts` | Copied as-is |
| `utils/formatters.ts` | `utils/formatters.ts` | Simplified, removed audio-specific functions |
| `utils/dateGrouping.ts` | `utils/dateGrouping.ts` | Copied as-is |
| `app/home.tsx` | `app/home.tsx` | Heavily simplified, removed audio contexts, added mock data |
| `app/video.tsx` | `app/video.tsx` | Removed "Switch to Audio" functionality, simplified |
| `app/_layout.tsx` | `app/_layout.tsx` | Removed all audio contexts, simplified to basic tabs |

### Removed (Not Needed)

- `AudioContext.tsx` - Audio player state
- `LiveRadioContext.tsx` - Live radio
- `PlaybackModeContext.tsx` - Audio/Video switching
- `VideoContext.tsx` - Video state management (simplified inline)
- `MiniPlayer.tsx` - Audio mini player
- `FullPlayerModal.tsx` - Full audio player
- `LiveRadioMiniPlayer.tsx` - Radio mini player
- `AnimatedHeader.tsx` - Complex animated header
- `AnimatedTabBar.tsx` - Custom tab bar
- `SearchBar.tsx`, `SearchModal.tsx`, `SearchSuggestions.tsx` - Search UI (to be reimplemented)
- `UnifiedFilterBar.tsx`, `SearchFilterBar.tsx` - Filter UI (to be reimplemented)
- `HistoryCard.tsx` - History card (to be reimplemented)
- `DownloadedAudioCard.tsx` - Download card (to be reimplemented)
- `trackPlayerService.ts` - Audio player service
- `audioDownload.ts` - Audio download service
- `forYouAlgorithm.ts` - Recommendation algorithm
- All audio-related hooks

### New Files

- `SETUP.md` - Setup instructions
- `ARCHITECTURE.md` - Architecture documentation
- `TODO.md` - Task list
- `MIGRATION_FROM_NAAT.md` - This file

## Type Changes

### Naat → Speech

```typescript
// Before (Naat)
interface Naat {
  $id: string;
  title: string;
  youtubeId: string;
  audioUrl?: string;
  cutAudio?: string;
  // ... audio-specific fields
}

// After (Speech)
interface Speech {
  $id: string;
  title: string;
  youtubeId: string;
  // No audio fields
  topic?: string;
  language?: string;
}
```

### Component Props

```typescript
// Before (NaatCard)
interface NaatCardProps {
  // ... common props
  isCut?: boolean;
  onDownload?: () => void;
  isDownloaded?: boolean;
  isDownloading?: boolean;
  downloadProgress?: number;
}

// After (SpeechCard)
interface SpeechCardProps {
  // ... common props
  // Removed isCut
  onDownload?: () => void;
  isDownloaded?: boolean;
  isDownloading?: boolean;
  downloadProgress?: number;
}
```

## Context Simplification

### Before (Naat-Collection)

```typescript
<AudioProvider>
  <LiveRadioProvider>
    <VideoProvider>
      <PlaybackModeProvider>
        <SearchProvider>
          <FilterModalProvider>
            <HeaderVisibilityProvider>
              <TabBarVisibilityProvider>
                {/* App content */}
              </TabBarVisibilityProvider>
            </HeaderVisibilityProvider>
          </FilterModalProvider>
        </SearchProvider>
      </PlaybackModeProvider>
    </VideoProvider>
  </LiveRadioProvider>
</AudioProvider>
```

### After (Speech-App)

```typescript
<SafeAreaProvider>
  {/* App content - no contexts yet */}
</SafeAreaProvider>
```

Contexts will be added as needed:
- `DownloadContext` - For download management
- `HistoryContext` - For watch history
- `SearchContext` - For search state

## Navigation Changes

### Before (Naat-Collection)

```typescript
<Tabs>
  <Tabs.Screen name="home" />
  <Tabs.Screen name="live" />      // Removed
  <Tabs.Screen name="history" />
  <Tabs.Screen name="downloads" />
  <Tabs.Screen name="video" />
</Tabs>
```

### After (Speech-App)

```typescript
<Tabs>
  <Tabs.Screen name="home" />
  <Tabs.Screen name="history" />
  <Tabs.Screen name="downloads" />
  <Tabs.Screen name="video" />
</Tabs>
```

## Video Player Changes

### Removed Features

1. **Switch to Audio Button**
   ```typescript
   // Removed this entire section
   <Pressable onPress={switchToAudio}>
     <Text>Play as Audio Only</Text>
   </Pressable>
   ```

2. **Audio Loading State**
   ```typescript
   // Removed
   const [audioLoading, setAudioLoading] = useState(false);
   ```

3. **Playback Mode Preference**
   ```typescript
   // Removed
   await storageService.savePlaybackMode("video");
   ```

### Kept Features

1. **YouTube Player**
2. **Repeat Functionality**
3. **Progress Bar**
4. **Fullscreen Support**
5. **Screen Orientation**

## Home Screen Changes

### Removed

1. **Audio Playback**
   ```typescript
   // Removed
   const { handleNaatPress } = useNaatPlayback();
   ```

2. **Complex Filters**
   ```typescript
   // Removed
   <UnifiedFilterBar />
   <SearchFilterBar />
   ```

3. **Search Overlay**
   ```typescript
   // Removed
   <SearchSuggestions />
   ```

4. **Download Manager**
   ```typescript
   // Removed (to be reimplemented)
   const { downloadStates, handleDownload } = useDownloadManager();
   ```

### Simplified

1. **Data Fetching**
   ```typescript
   // Before: Complex hook with filters
   const filters = useHomeFilters();
   
   // After: Simple mock data
   const [speeches] = useState<Speech[]>(MOCK_SPEECHES);
   ```

2. **Card Interaction**
   ```typescript
   // Before: Audio playback
   onPress={() => handleNaatPress(item.$id)}
   
   // After: Direct video navigation
   onPress={() => handleSpeechPress(item.$id)}
   ```

## Dependencies Removed

From `package.json`:

- `@weights-ai/react-native-track-player` - Audio player
- `@react-native-community/slider` - Kept for video progress
- `expo-speech-recognition` - Voice search
- Audio processing libraries (ffmpeg, whisper, etc.)
- AI libraries (openai, groq-sdk)

## Dependencies Kept

- `expo` and core Expo packages
- `expo-router` - Navigation
- `react-native-youtube-iframe` - Video player
- `appwrite` - Backend
- `nativewind` - Styling
- `expo-image` - Image optimization
- `@gorhom/bottom-sheet` - Modals
- `expo-linear-gradient` - Gradients
- `expo-haptics` - Haptic feedback

## Configuration Changes

### app.json

```json
{
  "name": "Islamic Speeches",
  "slug": "islamic-speeches",
  "bundleIdentifier": "com.islamicspeeches.app",
  // Removed audio permissions
  // Removed speech recognition plugin
}
```

### Environment Variables

```bash
# Before
EXPO_PUBLIC_APPWRITE_NAATS_COLLECTION_ID
EXPO_PUBLIC_APPWRITE_AUDIO_BUCKET_ID

# After
EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID
# No audio bucket needed
```

## What to Implement Next

1. **Data Fetching**
   - Create `useSpeeches` hook
   - Connect to Appwrite
   - Replace mock data

2. **Search & Filters**
   - Implement search UI
   - Add filter options
   - Create filter hooks

3. **Downloads**
   - Implement video download
   - Create download manager
   - Add download UI

4. **History**
   - Track watch history
   - Display in History tab
   - Sync with Appwrite

## Testing the Migration

### Verify Core Features

1. **Navigation**
   ```bash
   npm start
   # Test: Navigate between tabs
   ```

2. **Video Playback**
   ```bash
   # Test: Tap a speech card
   # Test: Video plays
   # Test: Controls work
   ```

3. **UI/UX**
   ```bash
   # Test: Cards render correctly
   # Test: Empty states show
   # Test: Pull to refresh works
   ```

## Common Issues & Solutions

### Issue: TypeScript errors about missing types

**Solution:** Run `npm install` to ensure all dependencies are installed

### Issue: Metro bundler cache issues

**Solution:** Clear cache with `npx expo start -c`

### Issue: Video player not loading

**Solution:** Check internet connection and YouTube video ID

### Issue: Styles not applying

**Solution:** Ensure NativeWind is configured correctly in `metro.config.js`

## Rollback Plan

If you need to reference the original naat-collection:

1. Keep naat-collection repo intact
2. Use it as reference for any features
3. Copy components as needed
4. Adapt for video-only use case

## Success Criteria

The migration is successful when:

- [ ] App builds without errors
- [ ] All tabs are accessible
- [ ] Video playback works
- [ ] UI matches naat-collection quality
- [ ] No audio-related code remains
- [ ] Documentation is complete
