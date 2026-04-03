// Speech-specific types

export interface Speech {
  $id: string;
  title: string;
  youtubeId: string;
  videoId: string; // Appwrite Storage file ID for self-hosted video
  thumbnailUrl: string;
  duration: number;
  uploadDate: string;
  channelName: string;
  channelId: string;
  views: number;
  description?: string;
  tags?: string[];
  language?: string;
  topic?: string;
  isShort?: boolean; // Videos < 60 seconds
}

export interface Channel {
  $id: string;
  name: string;
  youtubeChannelId: string;
  thumbnailUrl?: string;
  description?: string;
  type: "channel" | "playlist";
  ignoreDuration?: boolean;
  includeShorts?: boolean; // Include shorts (< 60s) for this channel
}

// Download metadata
export interface DownloadMetadata {
  speechId: string;
  title: string;
  channelName: string;
  thumbnailUrl: string;
  duration: number;
  downloadDate: string;
  fileSize: number;
  localUri: string;
}

// Duration filter option
export type DurationOption = "all" | "short" | "medium" | "long";

// Sort option type for downloads
export type DownloadSortOption =
  | "date-desc"
  | "date-asc"
  | "title-asc"
  | "title-desc";

// Hook return types
export interface UseSpeechesReturn {
  speeches: Speech[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
}

export interface UseChannelsReturn {
  channels: Channel[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export interface UseSearchReturn {
  query: string;
  results: Speech[];
  loading: boolean;
  setQuery: (query: string) => void;
  clearSearch: () => void;
}

export interface UseDownloadsReturn {
  downloads: DownloadMetadata[];
  loading: boolean;
  error: Error | null;
  totalSize: number;
  refresh: () => Promise<void>;
  deleteVideo: (speechId: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

// Component prop types
export interface SpeechCardProps {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  uploadDate: string;
  channelName: string;
  views: number;
  onPress: () => void;
  onLongPress?: () => void;
  progressPercentage?: number; // 0-100, shows progress bar if present
}

export interface VideoPlayerProps {
  videoUrl: string;
}

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export interface EmptyStateProps {
  message: string;
  iconName?: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}

export interface DownloadedVideoCardProps {
  video: DownloadMetadata;
  onPress: () => void;
}

export interface DownloadsHeaderProps {
  totalSize: number;
  downloadCount: number;
  onClearAll?: () => void;
}

// History types
export interface HistoryEntry {
  speechId: string;
  speech: Speech;
  watchedAt: number;
  progress: number;
}
