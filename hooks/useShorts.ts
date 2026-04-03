import { config, databases } from "@/config/appwrite";
import { Speech } from "@/types";
import { Query } from "appwrite";
import { useCallback, useEffect, useState } from "react";

const SHORTS_PAGE_SIZE = 10;

export function useShorts() {
  const [shorts, setShorts] = useState<Speech[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDocumentId, setLastDocumentId] = useState<string | null>(null);

  const fetchShorts = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setLoading(true);
          setLastDocumentId(null);
          setHasMore(true);
        }

        const queries = [
          Query.equal("isShort", true),
          Query.isNotNull("videoId"),
          Query.notEqual("videoId", ""),
          Query.orderDesc("uploadDate"),
          Query.limit(SHORTS_PAGE_SIZE),
        ];

        if (!isRefresh && lastDocumentId) {
          queries.push(Query.cursorAfter(lastDocumentId));
        }

        const response = await databases.listDocuments(
          config.databaseId,
          config.speechesCollectionId,
          queries
        );

        const fetchedShorts = response.documents as unknown as Speech[];

        if (isRefresh) {
          setShorts(fetchedShorts);
        } else {
          setShorts((prev) => [...prev, ...fetchedShorts]);
        }

        setHasMore(fetchedShorts.length === SHORTS_PAGE_SIZE);
        if (fetchedShorts.length > 0) {
          setLastDocumentId(fetchedShorts[fetchedShorts.length - 1].$id);
        }

        setError(null);
      } catch (err) {
        console.error("Error fetching shorts:", err);
        setError(err instanceof Error ? err : new Error("Failed to fetch shorts"));
      } finally {
        setLoading(false);
      }
    },
    [lastDocumentId]
  );

  const refresh = useCallback(async () => {
    await fetchShorts(true);
  }, [fetchShorts]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchShorts(false);
    }
  }, [loading, hasMore, fetchShorts]);

  useEffect(() => {
    fetchShorts(true);
  }, []);

  return {
    shorts,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
