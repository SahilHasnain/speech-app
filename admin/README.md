# Islamic Speeches Admin Panel

A Next.js admin panel for managing and inspecting the Islamic Speeches database.

## Features

- **Database Inspector**: View comprehensive statistics about your database
  - Total speeches, channels, and video files
  - Channel-by-channel breakdown with speech and video counts
  - Detailed channel inspection with duration statistics
  - Video storage coverage tracking

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy the environment variables:
```bash
cp .env.local.example .env.local
```

3. Update `.env.local` with your Appwrite credentials:
   - Get these from your main speech-app `.env.local` file
   - Or from the Appwrite console

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

Required environment variables:

- `EXPO_PUBLIC_APPWRITE_ENDPOINT` - Appwrite API endpoint
- `EXPO_PUBLIC_APPWRITE_PROJECT_ID` - Your Appwrite project ID
- `APPWRITE_API_KEY` - Appwrite API key (server-side)
- `EXPO_PUBLIC_APPWRITE_DATABASE_ID` - Database ID
- `EXPO_PUBLIC_APPWRITE_SPEECHES_COLLECTION_ID` - Speeches collection ID
- `EXPO_PUBLIC_APPWRITE_CHANNELS_COLLECTION_ID` - Channels collection ID

## Pages

### Dashboard (`/`)
Main landing page with links to all admin tools.

### Database Inspector (`/database`)
Comprehensive database inspection tool showing:
- Database overview (total speeches, channels, videos)
- Channel list with speech and video counts
- Detailed channel statistics including:
  - Duration breakdowns (<20 min, ≥20 min)
  - Video storage coverage
  - Average, min, and max durations
  - Channel settings (ignore duration, include shorts)

## Tech Stack

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Appwrite** - Backend database and storage
- **node-appwrite** - Server-side Appwrite SDK

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Design

The UI follows the same design language as the naat-collection web app:
- Dark theme with neutral grays
- Sky blue accents for interactive elements
- Clean, modern interface
- Responsive design for mobile and desktop
