# Appwrite Setup Guide

## Prerequisites

1. **Appwrite Account**: Sign up at [cloud.appwrite.io](https://cloud.appwrite.io)
2. **Create a Project**: Create a new project in Appwrite console
3. **Get API Key**: Generate an API key with full permissions

## Step 1: Configure Environment Variables

Edit `.env.local` and add your Appwrite project ID:

```bash
APPWRITE_API_KEY=your_api_key_here
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_project_id_here
```

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Run Setup Script

```bash
npm run setup:appwrite
```

This script will:
- ✅ Create a new database
- ✅ Create Speeches collection with attributes and indexes
- ✅ Create Channels collection with attributes and indexes
- ✅ Update `.env.local` with generated IDs

## Step 4: Verify in Appwrite Console

1. Go to your Appwrite console
2. Navigate to Databases
3. You should see:
   - Database: "Islamic Speeches"
   - Collections: "Speeches" and "Channels"

## Step 5: Set Permissions

### Speeches Collection Permissions

1. Go to Speeches collection → Settings → Permissions
2. Add permissions:
   - **Read**: Any (allow public read access)
   - **Create**: Admin only (or specific role)
   - **Update**: Admin only
   - **Delete**: Admin only

### Channels Collection Permissions

1. Go to Channels collection → Settings → Permissions
2. Add permissions:
   - **Read**: Any (allow public read access)
   - **Create**: Admin only
   - **Update**: Admin only
   - **Delete**: Admin only

## Database Schema

### Speeches Collection

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string(500) | Yes | Speech title |
| youtubeId | string(50) | Yes | YouTube video ID (unique) |
| thumbnailUrl | string(1000) | Yes | Thumbnail image URL |
| duration | integer | Yes | Duration in seconds (0-300) |
| uploadDate | datetime | Yes | Upload date |
| channelName | string(200) | Yes | Channel name |
| channelId | string(100) | Yes | Channel ID |
| views | integer | Yes | View count |
| description | string(5000) | No | Speech description |
| language | string(50) | No | Language (e.g., "English", "Arabic") |
| topic | string(100) | No | Topic/category |

**Indexes:**
- `title_search` - Full-text search on title
- `youtubeId_unique` - Unique constraint
- `uploadDate_desc` - Sort by date (newest first)
- `views_desc` - Sort by popularity
- `channelId_index` - Filter by channel
- `duration_index` - Filter by duration

### Channels Collection

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string(200) | Yes | Channel name |
| youtubeChannelId | string(100) | Yes | YouTube channel ID (unique) |
| thumbnailUrl | string(1000) | No | Channel thumbnail |
| description | string(2000) | No | Channel description |

**Indexes:**
- `youtubeChannelId_unique` - Unique constraint
- `name_search` - Full-text search on name

## History Tracking

History is stored locally using AsyncStorage (no Appwrite collection needed):

```typescript
// History item structure
{
  speechId: string;
  watchedAt: number; // timestamp
  progress: number; // seconds watched
}
```

## Next Steps

1. **Create Ingestion Function**: Set up a function to fetch speeches from YouTube
2. **Add Sample Data**: Manually add a few speeches to test
3. **Test API**: Run the app and verify data loads correctly

## Troubleshooting

### Error: "Missing required environment variables"

Make sure `.env.local` has all required variables:
- `APPWRITE_API_KEY`
- `EXPO_PUBLIC_APPWRITE_PROJECT_ID`

### Error: "Failed to create database"

Check that your API key has the correct permissions:
- Database: Create, Read, Update, Delete
- Collections: Create, Read, Update, Delete

### Error: "Attribute did not become available in time"

This is usually a temporary issue. Wait a minute and try again.

### Collections already exist

If you need to re-run the setup:
1. Delete the existing database in Appwrite console
2. Remove the generated IDs from `.env.local`
3. Run `npm run setup:appwrite` again

## Manual Setup (Alternative)

If the script fails, you can manually create the collections:

1. Create database "Islamic Speeches"
2. Create "Speeches" collection with attributes listed above
3. Create "Channels" collection with attributes listed above
4. Add indexes as specified
5. Update `.env.local` with the IDs

## API Usage Examples

### Fetch Speeches

```typescript
import { databases, config } from "@/config/appwrite";
import { Query } from "appwrite";

const speeches = await databases.listDocuments(
  config.databaseId,
  config.speechesCollectionId,
  [
    Query.orderDesc("uploadDate"),
    Query.limit(20),
  ]
);
```

### Search Speeches

```typescript
const results = await databases.listDocuments(
  config.databaseId,
  config.speechesCollectionId,
  [
    Query.search("title", searchQuery),
    Query.limit(20),
  ]
);
```

### Filter by Channel

```typescript
const speeches = await databases.listDocuments(
  config.databaseId,
  config.speechesCollectionId,
  [
    Query.equal("channelId", channelId),
    Query.orderDesc("uploadDate"),
  ]
);
```

## Resources

- [Appwrite Documentation](https://appwrite.io/docs)
- [Appwrite Node SDK](https://appwrite.io/docs/sdks#server)
- [Appwrite Queries](https://appwrite.io/docs/queries)
