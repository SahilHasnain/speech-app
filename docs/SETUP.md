# Speech App Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd speech-app
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your Appwrite credentials:

```bash
cp .env.example .env
```

Edit `.env` with your Appwrite project details:
- Get these from your Appwrite console
- Create a new project specifically for the speech app
- Set up the required collections (see below)

### 3. Run the App

```bash
# Start development server
npm start

# Or run directly on a platform
npm run android  # Android
npm run ios      # iOS
npm run web      # Web
```

## Appwrite Setup

### Create Collections

1. **Speeches Collection** (`speeches`)
   ```
   Attributes:
   - title (string, required)
   - youtubeId (string, required)
   - thumbnailUrl (string, required)
   - duration (integer, required) - in seconds
   - uploadDate (datetime, required)
   - channelName (string, required)
   - channelId (string, required)
   - views (integer, default: 0)
   - description (string, optional)
   - tags (string[], optional)
   - language (string, optional)
   - topic (string, optional)
   ```

   Indexes:
   - `uploadDate` (descending) - for sorting by date
   - `views` (descending) - for sorting by popularity
   - `channelId` - for filtering by channel
   - `duration` - for filtering by length

2. **Channels Collection** (`channels`)
   ```
   Attributes:
   - name (string, required)
   - youtubeChannelId (string, required, unique)
   - thumbnailUrl (string, optional)
   - description (string, optional)
   ```

3. **History Collection** (`history`)
   ```
   Attributes:
   - userId (string, required)
   - speechId (string, required)
   - watchedAt (datetime, required)
   - progress (integer, default: 0) - in seconds
   ```

   Indexes:
   - `userId` + `watchedAt` (descending) - for user history
   - `userId` + `speechId` - for checking if watched

### Permissions

Set appropriate permissions for each collection:
- Speeches: Read (Any), Write (Admin only)
- Channels: Read (Any), Write (Admin only)
- History: Read (User), Write (User), Delete (User)

## Next Steps

### 1. Data Ingestion

Create an ingestion function (similar to naat-collection) to:
- Fetch videos from YouTube channels
- Filter videos ≤5 minutes
- Extract metadata (title, duration, views, etc.)
- Store in Appwrite

### 2. Implement Real Data Fetching

Replace mock data in `app/home.tsx` with actual Appwrite queries:

```typescript
import { databases, config } from "@/config/appwrite";
import { Query } from "appwrite";

const fetchSpeeches = async () => {
  const response = await databases.listDocuments(
    config.databaseId,
    config.speechesCollectionId,
    [
      Query.orderDesc("uploadDate"),
      Query.limit(20),
    ]
  );
  return response.documents;
};
```

### 3. Add Features

- Search functionality
- Filter by channel/topic
- Download management
- Watch history tracking
- Share functionality

## Differences from Naat-Collection

### Removed Features
- Audio playback (AudioContext, MiniPlayer, FullPlayerModal)
- Live radio functionality
- PlaybackMode switching
- Audio download management
- Track player service

### Kept Features
- Video player with YouTube iframe
- Tab navigation (Home, History, Downloads)
- Card-based UI
- Search and filters (to be implemented)
- Network status handling
- Error boundaries

### Key Changes
- Renamed "Naat" → "Speech" throughout
- Simplified to video-only playback
- Removed all audio-related contexts and services
- Cleaner, more focused codebase

## Development Tips

1. **Testing**: Use mock data initially, then connect to Appwrite
2. **Icons**: Update app icons in `assets/images/`
3. **Splash Screen**: Customize splash screen image
4. **Bundle ID**: Update in `app.json` for production
5. **Build**: Use EAS Build for production builds

## Troubleshooting

### Common Issues

1. **Metro bundler errors**: Clear cache with `npx expo start -c`
2. **TypeScript errors**: Run `npx tsc --noEmit` to check
3. **Dependency issues**: Delete `node_modules` and reinstall
4. **Appwrite connection**: Verify endpoint and project ID in `.env`

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Appwrite Documentation](https://appwrite.io/docs)
- [NativeWind](https://www.nativewind.dev/)
