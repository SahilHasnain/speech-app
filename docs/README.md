# Islamic Speeches App

A mobile application for browsing and watching Islamic speeches from various scholars.

## 🚀 Quick Start

**Want to get started immediately?** → See [QUICKSTART.md](./QUICKSTART.md)

## Features

- Browse speeches from multiple Islamic channels
- Video-only playback (≤5 minutes)
- Download speeches for offline viewing
- Watch history tracking
- Clean, modern UI based on YouTube dark mode

## Tech Stack

- React Native with Expo
- Expo Router for navigation
- NativeWind (Tailwind CSS for React Native)
- Appwrite for backend
- YouTube iframe player

## Getting Started

### Quick Setup (5 minutes)

See [QUICKSTART.md](./QUICKSTART.md) for the fastest way to get running.

### Detailed Setup

#### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator or Android Emulator (or physical device)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env` and fill in your Appwrite credentials:

```bash
cp .env.example .env
```

4. Start the development server:

```bash
npm start
```

5. Run on your preferred platform:

```bash
# iOS
npm run ios

# Android
npm run android

# Web
npm run web
```

## Project Structure

```
speech-app/
├── app/                 # Expo Router screens
│   ├── _layout.tsx     # Root layout with tabs
│   ├── home.tsx        # Home screen (speeches list)
│   ├── history.tsx     # Watch history
│   ├── downloads.tsx   # Downloaded speeches
│   └── video.tsx       # Video player
├── components/         # Reusable components
│   ├── SpeechCard.tsx
│   ├── EmptyState.tsx
│   └── ResponsivePressable.tsx
├── constants/          # Theme and constants
│   └── theme.ts
├── types/             # TypeScript types
│   └── index.ts
├── utils/             # Utility functions
│   ├── formatters.ts
│   └── dateGrouping.ts
└── config/            # Configuration
    └── appwrite.ts
```

## Appwrite Setup

### Collections

1. **Speeches Collection**
   - title (string)
   - youtubeId (string)
   - thumbnailUrl (string)
   - duration (integer)
   - uploadDate (datetime)
   - channelName (string)
   - channelId (string)
   - views (integer)
   - description (string, optional)
   - tags (array, optional)
   - language (string, optional)
   - topic (string, optional)

2. **Channels Collection**
   - name (string)
   - youtubeChannelId (string)
   - thumbnailUrl (string, optional)
   - description (string, optional)

3. **History Collection**
   - userId (string)
   - speechId (string)
   - watchedAt (datetime)
   - progress (integer)

## Development

- `npm start` - Start Expo development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web
- `npm run lint` - Run ESLint

## License

Private - All rights reserved
