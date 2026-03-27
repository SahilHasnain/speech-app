/**
 * Utility functions for formatting data
 */

// Cache for formatted values
const fileSizeCache = new Map<number, string>();
const CACHE_MAX_SIZE = 100;

/**
 * Format file size from bytes to human-readable format (MB/GB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 MB";

  // Check cache first
  if (fileSizeCache.has(bytes)) {
    return fileSizeCache.get(bytes)!;
  }

  const mb = bytes / (1024 * 1024);
  let result: string;

  if (mb < 1024) {
    result = `${mb.toFixed(1)} MB`;
  } else {
    const gb = mb / 1024;
    result = `${gb.toFixed(2)} GB`;
  }

  // Cache the result
  if (fileSizeCache.size >= CACHE_MAX_SIZE) {
    const firstKey = fileSizeCache.keys().next().value;
    if (firstKey !== undefined) {
      fileSizeCache.delete(firstKey);
    }
  }
  fileSizeCache.set(bytes, result);

  return result;
}

/**
 * Format duration from seconds to MM:SS format
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Format views count (e.g., 1.2K, 1.5M)
 */
export function formatViews(views: number): string {
  if (views < 1000) {
    return views.toString();
  } else if (views < 1000000) {
    return `${(views / 1000).toFixed(1)}K`;
  } else {
    return `${(views / 1000000).toFixed(1)}M`;
  }
}
