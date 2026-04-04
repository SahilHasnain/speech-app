import { config, databases } from "@/config/appwrite";
import { Speech } from "@/types";
import { Query } from "appwrite";
import { useCallback, useEffect, useRef, useState } from "react";

const SHORTS_BATCH_SIZE = 50; // Fetch larger pool
const SHORTS_SERVE_SIZE = 10; // Serve smaller batches
const UNSEEN_RATIO = 0.9; // 90% unseen
const SEEN_RATIO = 0.1; // 10% seen (rediscovery)

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface UseShortsOptions {
  seenShortIds?: string[];
  enableRealtimeRebuild?: boolean; // Control whether to rebuild on seenIds change
}

export function useShorts(options: UseShortsOptions = {}) {
  const { seenShortIds = [], enableRealtimeRebuild = false } = options;
  
  const [allShorts, setAllShorts] = useState<Speech[]>([]);
  const [displayShorts, setDisplayShorts] = useState<Speech[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);
  const initialSeenIdsRef = useRef<string[]>([]); // Capture initial state
  const servedShortsRef = useRef<Set<string>>(new Set()); // Track served shorts

  // Capture initial seenShortIds on mount
  useEffect(() => {
    initialSeenIdsRef.current = seenShortIds;
  }, []); // Only on mount

  // Fetch all shorts from database using batching
  const fetchAllShorts = useCallback(async () => {
    try {
      setLoading(true);
      
      let allFetchedShorts: Speech[] = [];
      let offset = 0;
      const batchSize = 100; // Fetch in batches of 100
      let hasMoreBatches = true;

      while (hasMoreBatches) {
        const queries = [
          Query.equal("isShort", true),
          Query.isNotNull("videoId"),
          Query.notEqual("videoId", ""),
          Query.limit(batchSize),
          Query.offset(offset),
        ];

        const response = await databases.listDocuments(
          config.databaseId,
          config.speechesCollectionId,
          queries
        );

        const batch = response.documents as unknown as Speech[];
        allFetchedShorts = [...allFetchedShorts, ...batch];

        console.log(`📦 Fetched batch: ${batch.length} shorts (total: ${allFetchedShorts.length})`);

        // Check if we got fewer documents than the limit (means we've reached the end)
        if (batch.length < batchSize) {
          hasMoreBatches = false;
        } else {
          offset += batchSize;
        }
      }

      console.log(`✅ Total shorts fetched: ${allFetchedShorts.length}`);
      setAllShorts(allFetchedShorts);
      setError(null);
      
      return allFetchedShorts;
    } catch (err) {
      console.error("Error fetching shorts:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch shorts"));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Build feed with unseen/seen mix
  const buildFeed = useCallback(
    (shorts: Speech[], offset: number = 0, useSeenIds: string[] = seenShortIds) => {
      if (shorts.length === 0) return [];

      // Split into seen and unseen, excluding already served shorts
      const unseenShorts = shorts.filter(
        (s) => !useSeenIds.includes(s.$id) && !servedShortsRef.current.has(s.$id)
      );
      const seenShorts = shorts.filter(
        (s) => useSeenIds.includes(s.$id) && !servedShortsRef.current.has(s.$id)
      );

      console.log(`📊 Shorts pool: ${unseenShorts.length} unseen, ${seenShorts.length} seen`);

      // Calculate how many of each to show
      const unseenCount = Math.ceil(SHORTS_SERVE_SIZE * UNSEEN_RATIO);
      const seenCount = Math.floor(SHORTS_SERVE_SIZE * SEEN_RATIO);

      // Shuffle both pools
      const shuffledUnseen = shuffleArray(unseenShorts);
      const shuffledSeen = shuffleArray(seenShorts);

      // Build feed
      let feed: Speech[] = [];

      // Add unseen shorts (priority)
      if (shuffledUnseen.length > 0) {
        feed.push(...shuffledUnseen.slice(0, unseenCount));
      }

      // Fill remaining with seen shorts (rediscovery)
      const remaining = SHORTS_SERVE_SIZE - feed.length;
      if (remaining > 0 && shuffledSeen.length > 0) {
        feed.push(...shuffledSeen.slice(0, remaining));
      }

      // If still not enough, fill with any available (excluding already served)
      if (feed.length < SHORTS_SERVE_SIZE) {
        const availableShorts = shorts.filter(
          (s) => !servedShortsRef.current.has(s.$id) && !feed.find((f) => f.$id === s.$id)
        );
        const allShuffled = shuffleArray(availableShorts);
        const needed = SHORTS_SERVE_SIZE - feed.length;
        const additional = allShuffled.slice(0, needed);
        feed.push(...additional);
      }

      // Track served shorts
      feed.forEach((s) => servedShortsRef.current.add(s.$id));

      // Final shuffle to mix unseen and seen
      return shuffleArray(feed);
    },
    [seenShortIds]
  );

  // Initial load - use initial seenIds
  useEffect(() => {
    const initialize = async () => {
      const shorts = await fetchAllShorts();
      const feed = buildFeed(shorts, 0, initialSeenIdsRef.current);
      setDisplayShorts(feed);
      setCurrentOffset(feed.length);
      setHasMore(feed.length === SHORTS_SERVE_SIZE);
    };

    initialize();
  }, [fetchAllShorts]); // Only on mount

  // Only rebuild if enableRealtimeRebuild is true (for refresh)
  useEffect(() => {
    if (enableRealtimeRebuild && allShorts.length > 0) {
      const feed = buildFeed(allShorts, 0);
      setDisplayShorts(feed);
      setCurrentOffset(feed.length);
      setHasMore(feed.length === SHORTS_SERVE_SIZE);
    }
  }, [enableRealtimeRebuild, allShorts, buildFeed]);

  // Load more shorts - use current seenIds for pagination
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;

    const nextBatch = buildFeed(allShorts, currentOffset, initialSeenIdsRef.current);
    
    if (nextBatch.length === 0) {
      setHasMore(false);
      return;
    }

    // Filter out duplicates before adding to display
    setDisplayShorts((prev) => {
      const existingIds = new Set(prev.map(s => s.$id));
      const uniqueNewShorts = nextBatch.filter(s => !existingIds.has(s.$id));
      return [...prev, ...uniqueNewShorts];
    });
    setCurrentOffset((prev) => prev + nextBatch.length);
    setHasMore(nextBatch.length === SHORTS_SERVE_SIZE);
  }, [loading, hasMore, allShorts, currentOffset, buildFeed]);

  // Refresh shorts - rebuild with current seenIds
  const refresh = useCallback(async () => {
    // Clear served shorts on refresh
    servedShortsRef.current.clear();
    
    const shorts = await fetchAllShorts();
    const feed = buildFeed(shorts, 0, seenShortIds); // Use current seenIds on refresh
    setDisplayShorts(feed);
    setCurrentOffset(feed.length);
    setHasMore(feed.length === SHORTS_SERVE_SIZE);
  }, [fetchAllShorts, buildFeed, seenShortIds]);

  // Get stats
  const getStats = useCallback(() => {
    const unseenCount = allShorts.filter((s) => !seenShortIds.includes(s.$id)).length;
    const seenCount = allShorts.filter((s) => seenShortIds.includes(s.$id)).length;
    
    return {
      total: allShorts.length,
      unseen: unseenCount,
      seen: seenCount,
      isExhausted: unseenCount < 5,
    };
  }, [allShorts, seenShortIds]);

  return {
    shorts: displayShorts,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    getStats,
  };
}
