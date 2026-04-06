# Install Dependencies

## Required Steps

After the migration, you need to install the new dependencies and remove the old ones.

### 1. Remove YouTube Dependency

```bash
npm uninstall react-native-youtube-iframe
```

### 2. Install expo-av

```bash
npx expo install expo-av
```

Or if you prefer npm:

```bash
npm install
```

### 3. Clear Cache (Recommended)

```bash
# Clear Metro bundler cache
npx expo start -c

# Or if using npm
npm start -- --clear
```

### 4. Rebuild Native Code (if needed)

If you're using a development build:

```bash
# For Android
npx expo run:android

# For iOS
npx expo run:ios
```

## Verification

After installation, verify everything works:

```bash
# Start the app
npm start

# Check for any import errors in the console
```

## Dependencies Added

- `expo-av` (~15.0.1) - For native video playback

## Dependencies Removed

- `react-native-youtube-iframe` - No longer needed

## Troubleshooting

### "Cannot find module 'expo-av'"

Run:
```bash
npx expo install expo-av
npm start -- --clear
```

### "Module not found" errors

Clear cache and reinstall:
```bash
rm -rf node_modules
npm install
npm start -- --clear
```

### Video player not working

1. Check if expo-av is installed: `npm list expo-av`
2. Verify video URL is accessible
3. Check Appwrite bucket permissions
4. Look for errors in console

## Next Steps

After installation:
1. Test the app: `npm start`
2. Upload videos: `npm run upload:video -- --limit=1 --test`
3. Verify video playback works
