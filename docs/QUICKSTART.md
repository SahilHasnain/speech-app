# Quick Start Guide

Get the Speech App running in 5 minutes!

## 1. Prerequisites

- Node.js 18+ installed
- Appwrite account ([sign up here](https://cloud.appwrite.io))
- Appwrite project created

## 2. Get Your Appwrite Credentials

1. Go to [Appwrite Console](https://cloud.appwrite.io)
2. Create a new project (or use existing)
3. Go to **Settings** → **API Keys**
4. Create a new API key with these scopes:
   - `databases.read`
   - `databases.write`
   - `collections.read`
   - `collections.write`
5. Copy your:
   - Project ID
   - API Key

## 3. Configure Environment

Edit `speech-app/.env.local`:

```bash
APPWRITE_API_KEY=your_api_key_here
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_project_id_here
```

## 4. Install & Setup

```bash
cd speech-app

# Install dependencies
npm install

# Run Appwrite setup (creates database & collections)
npm run setup:appwrite
```

You should see:
```
🎉 Setup completed successfully!

📋 Summary:
   Database ID: 67xxxxx
   Speeches Collection ID: 67xxxxx
   Channels Collection ID: 67xxxxx
```

## 5. Set Permissions in Appwrite Console

1. Go to your Appwrite console
2. Navigate to **Databases** → **Islamic Speeches**
3. For **Speeches** collection:
   - Click **Settings** → **Permissions**
   - Add: **Role: Any** → **Read** ✓
4. For **Channels** collection:
   - Click **Settings** → **Permissions**
   - Add: **Role: Any** → **Read** ✓

## 6. Run the App

```bash
npm start
```

Then:
- Press `a` for Android
- Press `i` for iOS
- Press `w` for web

## 7. Add Sample Data (Optional)

To test the app, manually add a speech in Appwrite console:

1. Go to **Databases** → **Islamic Speeches** → **Speeches**
2. Click **Add Document**
3. Fill in:
   ```json
   {
     "title": "The Importance of Prayer",
     "youtubeId": "dQw4w9WgXcQ",
     "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
     "duration": 245,
     "uploadDate": "2024-01-15T10:00:00.000Z",
     "channelName": "Islamic Guidance",
     "channelId": "channel1",
     "views": 15000
   }
   ```

## Troubleshooting

### "Missing required environment variables"
- Check `.env.local` has all three variables
- Make sure there are no typos

### "Failed to create database"
- Verify API key has correct permissions
- Check project ID is correct

### App shows "No speeches available"
- Add sample data (step 7)
- Or set up ingestion function to fetch from YouTube

## Next Steps

- [ ] Set up ingestion function to fetch speeches from YouTube
- [ ] Add more channels to track
- [ ] Implement search and filters
- [ ] Add download functionality

## Need Help?

Check these docs:
- `APPWRITE_SETUP.md` - Detailed Appwrite setup
- `SETUP.md` - Full setup guide
- `ARCHITECTURE.md` - App architecture
- `TODO.md` - Feature roadmap
