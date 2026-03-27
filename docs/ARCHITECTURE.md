# Speech App Architecture

## Overview

The Speech App is a streamlined version of the Naat Collection app, focused exclusively on video playback of Islamic speeches. It maintains the polished UI/UX while removing audio-specific features.

## Core Differences from Naat-Collection

### What Was Removed

1. **Audio Playback System**
   - `AudioContext.tsx` - Audio player state management
   - `MiniPlayer.tsx` - Persistent audio mini player
   - `FullPlayerModal.tsx` - Full-screen audio player
   - `trackPlayerService.ts` - React Native Track Player integration
   - `audioDownload.ts` - Audio file download management

2. **Live Radio**
   - `LiveRadioContext.tsx` - Live radio state
   - `LiveRadioMiniPlayer.tsx` - Live radio mini player
   - Live tab and all radio functionality

3. **Playback Mode Switching**
   - `PlaybackModeContext.tsx` - Audio/Video mode toggle
   - Mode preference storage
   - "Switch to Audio" functionality in video player

4. **Audio-Specific Features**
   - AB repeat for audio
   - Playback speed control
   - Audio-only downloads
   - Saved playback positions

### What Was Kept

1. **Core UI Components**
   - Card-based layout (SpeechCard adapted from NaatCard)
   - Tab navigation structure
   - Animated headers and tab bars
   - Empty states and loading indicators
   - Responsive pressable components

2. **Video Playback**
   - YouTube iframe player
   - Video controls (play/pause, seek, repeat)
   - Fullscreen support
   - Screen orientation handling

3. **Navigation & Routing**
   - Expo Router with tabs
   - Home, History, Downloads screens
   - Video player screen

4. **Utilities & Helpers**
   - Date formatting and grouping
   - View count formatting
   - Duration formatting
   - Theme constants

5. **Infrastructure**
   - Appwrite integration
   - Network status handling
   - Error boundaries
   - TypeScript types

## Architecture Layers

### 1. Presentation Layer (`app/` & `components/`)

**Screens:**
- `home.tsx` - Browse speeches
- `history.tsx` - Watch history
- `downloads.tsx` - Offline speeches
- `video.tsx` - Video player

**Components:**
- `SpeechCard.tsx` - Speech preview card
- `EmptyState.tsx` - Empty state UI
- `ResponsivePressable.tsx` - Touch-optimized button

### 2. Business Logic Layer (`hooks/` - To Be Implemented)

Future hooks to implement:
- `useSpeeches.ts` - Fetch and manage speeches
- `useChannels.ts` - Fetch channels
- `useHistory.ts` - Watch history management
- `useDownloads.ts` - Download management
- `useSearch.ts` - Search functionality

### 3. Data Layer (`config/` & `services/` - To Be Implemented)

**Config:**
- `appwrite.ts` - Appwrite client setup

**Services (To Implement):**
- `speechService.ts` - Speech CRUD operations
- `historyService.ts` - History tracking
- `downloadService.ts` - Video download management
- `storageService.ts` - Local storage utilities

### 4. Type System (`types/`)

**Core Types:**
```typescript
Speech {
  $id, title, youtubeId, thumbnailUrl,
  duration, uploadDate, channelName,
  channelId, views, description, tags,
  language, topic
}

Channel {
  $id, name, youtubeChannelId,
  thumbnailUrl, description
}

HistoryItem {
  speechId, speech, watchedAt, progress
}

DownloadMetadata {
  speechId, title, channelName,
  thumbnailUrl, duration, downloadDate,
  fileSize, localUri
}
```

## Data Flow

### Video Playback Flow

```
User taps SpeechCard
  ↓
Navigate to /video with params
  ↓
VideoScreen extracts YouTube ID
  ↓
YouTube iframe player loads
  ↓
Video plays (autoplay enabled)
  ↓
Track watch history (to implement)
```

### Download Flow (To Implement)

```
User long-presses SpeechCard
  ↓
Show action sheet
  ↓
User taps "Download"
  ↓
Download video file
  ↓
Save metadata to local storage
  ↓
Show in Downloads tab
```

### History Tracking (To Implement)

```
Video starts playing
  ↓
Create/update history entry
  ↓
Track progress periodically
  ↓
Save to Appwrite
  ↓
Display in History tab
```

## State Management

### Current Approach
- Local component state with `useState`
- React Context for global state (to be added as needed)
- No Redux or external state management

### Future Contexts to Add
- `VideoContext` - Video player state (if needed)
- `DownloadContext` - Download queue management
- `HistoryContext` - Watch history state

## Styling System

### NativeWind (Tailwind CSS)
- Utility-first CSS framework
- Configured in `tailwind.config.js`
- Dark mode color palette
- Consistent spacing and typography

### Theme Constants
- Centralized in `constants/theme.ts`
- Colors, shadows, spacing, border radius
- YouTube dark mode inspired

## Performance Optimizations

1. **Component Memoization**
   - `React.memo` on SpeechCard
   - Custom `arePropsEqual` comparison

2. **List Optimization**
   - `removeClippedSubviews` on FlatList
   - `maxToRenderPerBatch` and `windowSize` tuning
   - `initialNumToRender` optimization

3. **Image Caching**
   - `expo-image` with `cachePolicy="memory-disk"`
   - Lazy loading with loading states

## Security Considerations

1. **Environment Variables**
   - Appwrite credentials in `.env`
   - Never commit `.env` to git

2. **Permissions**
   - Read-only access for speeches/channels
   - User-scoped access for history

3. **Input Validation**
   - Validate YouTube IDs
   - Sanitize user inputs

## Testing Strategy (To Implement)

1. **Unit Tests**
   - Utility functions (formatters, date helpers)
   - Type guards and validators

2. **Component Tests**
   - SpeechCard rendering
   - EmptyState variations
   - Video player controls

3. **Integration Tests**
   - Navigation flows
   - Appwrite queries
   - Download management

## Deployment

### Development
```bash
npm start
```

### Production Build
```bash
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

### App Store Requirements
- Update bundle ID in `app.json`
- Add app icons and splash screens
- Configure EAS credentials
- Submit via EAS Submit

## Future Enhancements

### Phase 1 (MVP)
- [ ] Connect to Appwrite
- [ ] Implement real data fetching
- [ ] Add search functionality
- [ ] Implement filters (channel, topic, duration)

### Phase 2
- [ ] Download management
- [ ] Watch history tracking
- [ ] Share functionality
- [ ] Offline mode

### Phase 3
- [ ] User accounts
- [ ] Favorites/bookmarks
- [ ] Playlists
- [ ] Notifications

### Phase 4
- [ ] Advanced search
- [ ] Recommendations
- [ ] Analytics
- [ ] Admin panel

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Monitor Appwrite usage
- Review crash reports
- Update content regularly

### Monitoring
- Sentry for error tracking (to add)
- Analytics for user behavior (to add)
- Appwrite logs for backend issues

## Resources

- Naat Collection repo (source of truth)
- Expo documentation
- Appwrite documentation
- React Native best practices
