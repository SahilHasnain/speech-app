# Speech App TODO

## Immediate Tasks (MVP)

### Setup & Configuration
- [ ] Create Appwrite project
- [ ] Set up collections (speeches, channels, history)
- [ ] Configure indexes and permissions
- [ ] Add environment variables to `.env`
- [ ] Test Appwrite connection

### Data & Backend
- [ ] Create ingestion function (similar to naat-collection)
  - [ ] Fetch videos from YouTube channels
  - [ ] Filter videos ≤5 minutes
  - [ ] Extract metadata
  - [ ] Store in Appwrite
- [ ] Set up scheduled ingestion (cron job)
- [ ] Add initial channels to ingest from

### Core Features
- [ ] Implement `useSpeeches` hook
  - [ ] Fetch speeches from Appwrite
  - [ ] Pagination
  - [ ] Refresh functionality
- [ ] Implement `useChannels` hook
  - [ ] Fetch channels
  - [ ] Cache channels
- [ ] Replace mock data in home screen
- [ ] Add loading states
- [ ] Add error handling

### Search & Filters
- [ ] Add search bar component
- [ ] Implement search functionality
- [ ] Add filter by channel
- [ ] Add filter by topic
- [ ] Add filter by duration
- [ ] Add sort options (date, views)

### History
- [ ] Implement `useHistory` hook
- [ ] Track video views
- [ ] Save watch progress
- [ ] Display history in History tab
- [ ] Group by date (Today, Yesterday, etc.)
- [ ] Add clear history option

### Downloads
- [ ] Implement `useDownloads` hook
- [ ] Add download functionality
- [ ] Show download progress
- [ ] Store downloaded videos locally
- [ ] Display in Downloads tab
- [ ] Add delete functionality
- [ ] Show total storage used

### UI/UX Polish
- [ ] Add app icons (all sizes)
- [ ] Add splash screen
- [ ] Add pull-to-refresh on all screens
- [ ] Add skeleton loaders
- [ ] Add haptic feedback
- [ ] Add toast notifications
- [ ] Improve error messages

### Video Player
- [ ] Add share button
- [ ] Add download button (if not downloaded)
- [ ] Show related speeches
- [ ] Add playback speed control (optional)
- [ ] Improve loading states

## Phase 2 (Enhanced Features)

### User Experience
- [ ] Add onboarding flow
- [ ] Add settings screen
  - [ ] Video quality preference
  - [ ] Auto-download on WiFi
  - [ ] Clear cache
  - [ ] About/version info
- [ ] Add deep linking support
- [ ] Add share functionality
- [ ] Add favorites/bookmarks

### Performance
- [ ] Optimize image loading
- [ ] Add request caching
- [ ] Implement offline mode
- [ ] Add background downloads
- [ ] Optimize bundle size

### Analytics
- [ ] Add Sentry for error tracking
- [ ] Add analytics (Firebase/Mixpanel)
- [ ] Track user engagement
- [ ] Monitor app performance

## Phase 3 (Advanced Features)

### Social Features
- [ ] User accounts
- [ ] User profiles
- [ ] Watch later list
- [ ] Custom playlists
- [ ] Share with friends

### Content Discovery
- [ ] Recommendations algorithm
- [ ] Trending speeches
- [ ] Popular channels
- [ ] Topic-based browsing
- [ ] Advanced search filters

### Notifications
- [ ] Push notifications
- [ ] New speech alerts
- [ ] Download complete notifications
- [ ] Reminder notifications

### Admin Features
- [ ] Admin panel (web)
- [ ] Content moderation
- [ ] Analytics dashboard
- [ ] User management

## Testing

### Unit Tests
- [ ] Test utility functions
- [ ] Test formatters
- [ ] Test date helpers
- [ ] Test type guards

### Component Tests
- [ ] Test SpeechCard
- [ ] Test EmptyState
- [ ] Test video player
- [ ] Test navigation

### Integration Tests
- [ ] Test Appwrite queries
- [ ] Test download flow
- [ ] Test history tracking
- [ ] Test search functionality

### E2E Tests
- [ ] Test complete user flows
- [ ] Test offline mode
- [ ] Test error scenarios

## Deployment

### Pre-launch
- [ ] Update app name and bundle ID
- [ ] Add privacy policy
- [ ] Add terms of service
- [ ] Prepare app store assets
  - [ ] Screenshots
  - [ ] App description
  - [ ] Keywords
  - [ ] Promotional graphics

### App Store
- [ ] Configure EAS Build
- [ ] Create production build
- [ ] Test production build
- [ ] Submit to Google Play
- [ ] Submit to Apple App Store

### Post-launch
- [ ] Monitor crash reports
- [ ] Monitor user feedback
- [ ] Track analytics
- [ ] Plan updates

## Documentation

- [ ] API documentation
- [ ] Component documentation
- [ ] Deployment guide
- [ ] Contributing guide
- [ ] User guide

## Nice to Have

- [ ] Dark/light mode toggle
- [ ] Multiple language support
- [ ] Accessibility improvements
- [ ] Tablet optimization
- [ ] Web version
- [ ] Desktop app (Electron)

## Known Issues

- [ ] None yet (add as discovered)

## Notes

- Keep UI consistent with naat-collection
- Focus on video-only experience
- Prioritize performance and offline support
- Maintain clean, maintainable code
- Document all major decisions
