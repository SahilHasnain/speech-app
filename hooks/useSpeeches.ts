import { config, databases } from "@/config/appwrite";
import { getForYouFeed } from "@/services/forYouAlgorithm";
import { storageService } from "@/services/storage";
import type { Speech } from "@/types";
import { Query } from "appwrite";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Number of speeches to fetch per page
 */
const PAGE_SIZE = 20;

export type SortOption = "forYou" | "latest" | "popular" | "oldest";

export interface UseSpeechesReturn {
  speeches: Speech[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
}

/**
 * Custom hook for managing speeches data with pagination and caching
 *
 * Features:
 * - Fetches speeches from Appwrite with pagination
 * - In-memory caching to avoid redundant API calls
 * - Infinite scroll support with loadMore
 * - Pull-to-refresh support
 * - Error handling
 * - Filter support (forYou, latest, popular, oldest)
 * - Smart "For You" algorithm with personalized recommendations
 *
 * @param filter - Sort order for speeches (default: "forYou")
 * @returns UseSpeechesReturn object with speeches data and control functions
 */
export function useSpeeches(
  filter: SortOption = "forYou"
): UseSpeechesReturn {
  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);

  // Track current offset for pagination
  const offsetRef = useRef<number>(0);

  // In-memory cache to avoid redundant API calls
  const cacheRef = useRef<Map<string, Map<number, Speech[]>>>(new Map());

  // Cache for full ordered list (For You algorithm)
  const fullOrderedListRef = useRef<Map<string, Speech[]>>(new Map());

  // Flag to prevent multiple simultaneous loads
  const isLoadingRef = useRef<boolean>(false);

  // Track current filter to detect changes
  const currentFilterRef = useRef<SortOption>(filter);

  // Generate cache key from filter
  const getCacheKey = useCallback((sortFilter: SortOption): string => {
    return sortFilter;
  }, []);

  const cacheKey = getCacheKey(filter);

  // Reset state when filter changes
  useEffect(() => {
    if (currentFilterRef.current !== filter) {
      currentFilterRef.current = filter;
      offsetRef.current = 0;
      setSpeeches([]);
      setHasMore(true);
      setError(null);
      isLoadingRef.current = false;
    }
  }, [filter]);

  /**
   * Fetch speeches from Appwrite
   */
  const fetchSpeeches = useCallback(
    async (
      limit: number,
      offset: number,
      sortFilter: SortOption
    ): Promise<Speech[]> => {
      const queries: string[] = [
        Query.limit(limit),
        Query.offset(offset),
        Query.isNotNull("videoId"), // Only fetch speeches with uploaded videos
        Query.equal("isShort", false),
      ];

      // Add sorting based on filter
      if (sortFilter === "latest" || sortFilter === "forYou") {
        queries.push(Query.orderDesc("uploadDate"));
      } else if (sortFilter === "popular") {
        queries.push(Query.orderDesc("views"));
      } else if (sortFilter === "oldest") {
        queries.push(Query.orderAsc("uploadDate"));
      }

      const response = await databases.listDocuments(
        config.databaseId,
        config.speechesCollectionId,
        queries
      );

      return response.documents as unknown as Speech[];
    },
    []
  );

  /**
   * Load more speeches for infinite scroll
   * Uses cached data when available
   * For "forYou" filter, applies smart algorithm
   */
  const loadMore = useCallback(() => {
    // Prevent multiple simultaneous loads
    if (isLoadingRef.current || !hasMore) {
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    // Get or create cache for current filter
    if (!cacheRef.current.has(cacheKey)) {
      cacheRef.current.set(cacheKey, new Map());
    }
    const filterCache = cacheRef.current.get(cacheKey)!;

    // Check cache first
    const cachedData = filterCache.get(offsetRef.current);

    if (cachedData) {
      // Use cached data
      setSpeeches((prev) => [...prev, ...cachedData]);
      offsetRef.current += PAGE_SIZE;
      setHasMore(cachedData.length === PAGE_SIZE);
      setLoading(false);
      isLoadingRef.current = false;
      return;
    }

    // For "forYou" filter, use progressive loading strategy
    if (filter === "forYou") {
      // Check if we already have the full ordered list cached
      const cachedOrderedList = fullOrderedListRef.current.get(cacheKey);

      if (cachedOrderedList) {
        // Use cached ordered list for pagination
        const startIndex = offsetRef.current;
        const endIndex = startIndex + PAGE_SIZE;
        const pageSpeeches = cachedOrderedList.slice(startIndex, endIndex);

        // Cache the page
        filterCache.set(offsetRef.current, pageSpeeches);

        // Update state - filter out duplicates
        setSpeeches((prev) => {
          const existingIds = new Set(prev.map((s) => s.$id));
          const uniqueNewSpeeches = pageSpeeches.filter(
            (s) => !existingIds.has(s.$id)
          );
          return [...prev, ...uniqueNewSpeeches];
        });
        offsetRef.current += PAGE_SIZE;
        setHasMore(endIndex < cachedOrderedList.length);
        setLoading(false);
        isLoadingRef.current = false;

        console.log(
          `[ForYou] Using cached list, displaying ${pageSpeeches.length} speeches, ${cachedOrderedList.length - endIndex} remaining`
        );
        return;
      }

      // Progressive loading: Start with 500 speeches for fast initial load
      const initialBatchSize = 500;

      fetchSpeeches(initialBatchSize, 0, "latest")
        .then(async (initialSpeeches) => {
          console.log(
            `[ForYou] Initial fetch: ${initialSpeeches.length} speeches, applying algorithm...`
          );

          // Apply For You algorithm to initial batch
          const orderedSpeeches = await getForYouFeed(initialSpeeches);

          // Cache the full ordered list
          fullOrderedListRef.current.set(cacheKey, orderedSpeeches);

          // Paginate the results
          const startIndex = offsetRef.current;
          const endIndex = startIndex + PAGE_SIZE;
          const pageSpeeches = orderedSpeeches.slice(startIndex, endIndex);

          // Cache the page
          filterCache.set(offsetRef.current, pageSpeeches);

          // Update state - filter out duplicates
          setSpeeches((prev) => {
            const existingIds = new Set(prev.map((s) => s.$id));
            const uniqueNewSpeeches = pageSpeeches.filter(
              (s) => !existingIds.has(s.$id)
            );
            return [...prev, ...uniqueNewSpeeches];
          });
          offsetRef.current += PAGE_SIZE;
          setHasMore(endIndex < orderedSpeeches.length);

          console.log(
            `[ForYou] Displaying ${pageSpeeches.length} speeches, ${orderedSpeeches.length - endIndex} remaining`
          );

          // Background fetch: Get remaining speeches if there are more
          if (initialSpeeches.length === initialBatchSize) {
            console.log(
              "[ForYou] Starting background fetch for remaining speeches..."
            );

            // Fetch remaining speeches in background (non-blocking)
            const fetchRemainingInBackground = async () => {
              const batchSize = 200;
              let allSpeeches = [...initialSpeeches];
              let currentOffset = initialBatchSize;
              let hasMoreBatches = true;

              while (hasMoreBatches) {
                try {
                  const batch = await fetchSpeeches(
                    batchSize,
                    currentOffset,
                    "latest"
                  );

                  if (batch.length > 0) {
                    allSpeeches = [...allSpeeches, ...batch];
                    currentOffset += batchSize;

                    console.log(
                      `[ForYou Background] Fetched ${batch.length} more speeches, total: ${allSpeeches.length}`
                    );

                    // Re-apply algorithm with expanded dataset
                    const updatedOrderedSpeeches = await getForYouFeed(
                      allSpeeches
                    );
                    fullOrderedListRef.current.set(
                      cacheKey,
                      updatedOrderedSpeeches
                    );

                    console.log(
                      `[ForYou Background] Updated recommendations with ${allSpeeches.length} total speeches`
                    );
                  }

                  if (batch.length < batchSize) {
                    hasMoreBatches = false;
                    console.log(
                      `[ForYou Background] Complete! Total speeches: ${allSpeeches.length}`
                    );
                  }
                } catch (err) {
                  console.error(
                    "[ForYou Background] Error fetching more speeches:",
                    err
                  );
                  hasMoreBatches = false;
                }
              }
            };

            // Run in background without blocking UI
            fetchRemainingInBackground();
          }
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err : new Error("Failed to load speeches")
          );
          console.log(
            "[useSpeeches] Error loading more speeches, keeping existing data"
          );
        })
        .finally(() => {
          setLoading(false);
          isLoadingRef.current = false;
        });
    } else {
      // Standard fetch for other filters
      fetchSpeeches(PAGE_SIZE, offsetRef.current, filter)
        .then((newSpeeches) => {
          // Cache the results for this filter
          filterCache.set(offsetRef.current, newSpeeches);

          // Update state - filter out duplicates
          setSpeeches((prev) => {
            const existingIds = new Set(prev.map((s) => s.$id));
            const uniqueNewSpeeches = newSpeeches.filter(
              (s) => !existingIds.has(s.$id)
            );
            return [...prev, ...uniqueNewSpeeches];
          });
          offsetRef.current += PAGE_SIZE;
          setHasMore(newSpeeches.length === PAGE_SIZE);
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err : new Error("Failed to load speeches")
          );
          console.log(
            "[useSpeeches] Error loading more speeches, keeping existing data"
          );
        })
        .finally(() => {
          setLoading(false);
          isLoadingRef.current = false;
        });
    }
  }, [hasMore, filter, cacheKey, fetchSpeeches]);

  /**
   * Refresh the speeches list (pull-to-refresh)
   * Clears ALL caches and reloads from the beginning
   * For "forYou", also clears the session cache
   */
  const refresh = useCallback(async (): Promise<void> => {
    // Reset state
    offsetRef.current = 0;

    // Clear ALL caches
    cacheRef.current.clear();
    fullOrderedListRef.current.clear();

    // Clear For You session if using that filter
    if (filter === "forYou") {
      await storageService.clearForYouSession();
    }

    setSpeeches([]);
    setHasMore(true);
    setError(null);
    setLoading(true);
    isLoadingRef.current = true;

    try {
      if (filter === "forYou") {
        // Progressive loading: Start with 500 speeches for fast refresh
        const initialBatchSize = 500;

        const initialSpeeches = await fetchSpeeches(
          initialBatchSize,
          0,
          "latest"
        );

        console.log(
          `[ForYou Refresh] Initial fetch: ${initialSpeeches.length} speeches, applying algorithm...`
        );

        // Apply For You algorithm
        const orderedSpeeches = await getForYouFeed(initialSpeeches);

        // Cache the full ordered list
        fullOrderedListRef.current.set(cacheKey, orderedSpeeches);

        // Get first page
        const freshSpeeches = orderedSpeeches.slice(0, PAGE_SIZE);

        // Get or create cache
        if (!cacheRef.current.has(cacheKey)) {
          cacheRef.current.set(cacheKey, new Map());
        }
        const filterCache = cacheRef.current.get(cacheKey)!;

        // Cache the results
        filterCache.set(0, freshSpeeches);

        // Update state
        setSpeeches(freshSpeeches);
        offsetRef.current = PAGE_SIZE;
        setHasMore(PAGE_SIZE < orderedSpeeches.length);

        console.log(
          `[ForYou Refresh] Displaying ${freshSpeeches.length} speeches, ${orderedSpeeches.length - PAGE_SIZE} remaining`
        );

        // Background fetch remaining speeches if there are more
        if (initialSpeeches.length === initialBatchSize) {
          console.log(
            "[ForYou Refresh] Starting background fetch for remaining speeches..."
          );

          const fetchRemainingInBackground = async () => {
            const batchSize = 200;
            let allSpeeches = [...initialSpeeches];
            let currentOffset = initialBatchSize;
            let hasMoreBatches = true;

            while (hasMoreBatches) {
              try {
                const batch = await fetchSpeeches(
                  batchSize,
                  currentOffset,
                  "latest"
                );

                if (batch.length > 0) {
                  allSpeeches = [...allSpeeches, ...batch];
                  currentOffset += batchSize;

                  console.log(
                    `[ForYou Refresh Background] Fetched ${batch.length} more, total: ${allSpeeches.length}`
                  );

                  // Re-apply algorithm with expanded dataset
                  const updatedOrderedSpeeches = await getForYouFeed(
                    allSpeeches
                  );
                  fullOrderedListRef.current.set(cacheKey, updatedOrderedSpeeches);

                  console.log(
                    `[ForYou Refresh Background] Updated with ${allSpeeches.length} total speeches`
                  );
                }

                if (batch.length < batchSize) {
                  hasMoreBatches = false;
                  console.log(
                    `[ForYou Refresh Background] Complete! Total: ${allSpeeches.length}`
                  );
                }
              } catch (err) {
                console.error("[ForYou Refresh Background] Error:", err);
                hasMoreBatches = false;
              }
            }
          };

          fetchRemainingInBackground();
        }
      } else {
        // Standard refresh for other filters
        const freshSpeeches = await fetchSpeeches(PAGE_SIZE, 0, filter);

        // Get or create cache for current filter
        if (!cacheRef.current.has(cacheKey)) {
          cacheRef.current.set(cacheKey, new Map());
        }
        const filterCache = cacheRef.current.get(cacheKey)!;

        // Cache the results
        filterCache.set(0, freshSpeeches);

        // Update state
        setSpeeches(freshSpeeches);
        offsetRef.current = PAGE_SIZE;
        setHasMore(freshSpeeches.length === PAGE_SIZE);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to refresh speeches")
      );
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [filter, cacheKey, fetchSpeeches]);

  return {
    speeches,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
