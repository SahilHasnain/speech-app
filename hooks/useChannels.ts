import { config, databases } from "@/config/appwrite";
import type { Channel } from "@/types";
import { Query } from "appwrite";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Return type for useChannels hook
 */
export interface UseChannelsReturn {
  channels: Channel[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Custom hook for managing channels data with caching
 *
 * Features:
 * - Fetches available channels from Appwrite on mount
 * - In-memory caching to avoid redundant API calls
 * - Pull-to-refresh support
 * - Error handling
 * - Alphabetical sorting by channel name
 *
 * @returns UseChannelsReturn object with channels data and control functions
 */
export function useChannels(): UseChannelsReturn {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // In-memory cache to avoid redundant API calls
  const cacheRef = useRef<Channel[] | null>(null);

  // Flag to prevent multiple simultaneous loads
  const isLoadingRef = useRef<boolean>(false);

  /**
   * Fetch channels from Appwrite
   */
  const fetchChannels = useCallback(async (): Promise<void> => {
    // Prevent multiple simultaneous loads
    if (isLoadingRef.current) {
      return;
    }

    // Use cached data if available
    if (cacheRef.current !== null) {
      setChannels(cacheRef.current);
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await databases.listDocuments(
        config.databaseId,
        config.channelsCollectionId,
        [Query.orderAsc("name")]
      );

      const fetchedChannels = response.documents as unknown as Channel[];

      // Cache the results
      cacheRef.current = fetchedChannels;

      // Update state
      setChannels(fetchedChannels);
    } catch (err) {
      const errorObj =
        err instanceof Error ? err : new Error("Failed to load channels");
      setError(errorObj);

      // On error, return empty array as fallback
      setChannels([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  /**
   * Refresh the channels list (pull-to-refresh)
   * Clears cache and reloads from the beginning
   */
  const refresh = useCallback(async (): Promise<void> => {
    // Clear cache
    cacheRef.current = null;

    // Reset state
    setChannels([]);
    setError(null);
    setLoading(true);
    isLoadingRef.current = true;

    try {
      const response = await databases.listDocuments(
        config.databaseId,
        config.channelsCollectionId,
        [Query.orderAsc("name")]
      );

      const freshChannels = response.documents as unknown as Channel[];

      // Cache the results
      cacheRef.current = freshChannels;

      // Update state
      setChannels(freshChannels);
    } catch (err) {
      const errorObj =
        err instanceof Error ? err : new Error("Failed to refresh channels");
      setError(errorObj);

      // On error, return empty array as fallback
      setChannels([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  // Fetch channels on mount
  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  return {
    channels,
    loading,
    error,
    refresh,
  };
}
