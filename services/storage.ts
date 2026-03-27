/**
 * Storage service for managing local data with AsyncStorage
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  WATCH_HISTORY: "@speech_watch_history",
  WATCH_HISTORY_TIMESTAMPS: "@speech_watch_history_timestamps",
  PLAYBACK_MODE: "@speech_playback_mode",
} as const;

const MAX_WATCH_HISTORY = 100;

class StorageService {
  /**
   * Add a speech to watch history
   * @param speechId - Unique identifier for the speech
   */
  async addToWatchHistory(speechId: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WATCH_HISTORY);
      let history: string[] = data ? JSON.parse(data) : [];

      // Get timestamps
      const timestampsData = await AsyncStorage.getItem(
        STORAGE_KEYS.WATCH_HISTORY_TIMESTAMPS
      );
      let timestamps: Record<string, number> = timestampsData
        ? JSON.parse(timestampsData)
        : {};

      // Remove if already exists (to update timestamp)
      history = history.filter((id) => id !== speechId);

      // Add to beginning
      history.unshift(speechId);

      // Update timestamp
      timestamps[speechId] = Date.now();

      // Limit to MAX_WATCH_HISTORY
      if (history.length > MAX_WATCH_HISTORY) {
        const removed = history.slice(MAX_WATCH_HISTORY);
        history = history.slice(0, MAX_WATCH_HISTORY);

        // Clean up timestamps for removed items
        removed.forEach((id) => delete timestamps[id]);
      }

      await AsyncStorage.setItem(
        STORAGE_KEYS.WATCH_HISTORY,
        JSON.stringify(history)
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.WATCH_HISTORY_TIMESTAMPS,
        JSON.stringify(timestamps)
      );
    } catch (error) {
      console.error("Error adding to watch history:", error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Get watch history
   * @returns Array of speech IDs in watch history
   */
  async getWatchHistory(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WATCH_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error getting watch history:", error);
      return [];
    }
  }

  /**
   * Get watch history with timestamps
   * @returns Record of speech IDs to timestamps
   */
  async getWatchHistoryTimestamps(): Promise<Record<string, number>> {
    try {
      const data = await AsyncStorage.getItem(
        STORAGE_KEYS.WATCH_HISTORY_TIMESTAMPS
      );
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Error getting watch history timestamps:", error);
      return {};
    }
  }

  /**
   * Remove a single item from watch history
   * @param speechId - Unique identifier for the speech
   */
  async removeFromWatchHistory(speechId: string): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.WATCH_HISTORY);
      let history: string[] = data ? JSON.parse(data) : [];

      // Get timestamps
      const timestampsData = await AsyncStorage.getItem(
        STORAGE_KEYS.WATCH_HISTORY_TIMESTAMPS
      );
      let timestamps: Record<string, number> = timestampsData
        ? JSON.parse(timestampsData)
        : {};

      // Remove from history
      history = history.filter((id) => id !== speechId);

      // Remove timestamp
      delete timestamps[speechId];

      await AsyncStorage.setItem(
        STORAGE_KEYS.WATCH_HISTORY,
        JSON.stringify(history)
      );
      await AsyncStorage.setItem(
        STORAGE_KEYS.WATCH_HISTORY_TIMESTAMPS,
        JSON.stringify(timestamps)
      );
    } catch (error) {
      console.error("Error removing from watch history:", error);
      throw new Error("Failed to remove from watch history.");
    }
  }

  /**
   * Clear all watch history
   */
  async clearWatchHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.WATCH_HISTORY);
      await AsyncStorage.removeItem(STORAGE_KEYS.WATCH_HISTORY_TIMESTAMPS);
    } catch (error) {
      console.error("Error clearing watch history:", error);
      throw new Error("Failed to clear watch history.");
    }
  }
}

export const storageService = new StorageService();
