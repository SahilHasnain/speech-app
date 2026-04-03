import { config, databases } from "@/config/appwrite";
import { searchItems } from "@/utils/search";
import type { Speech, UseSearchReturn } from "@/types";
import { Query } from "appwrite";
import { useCallback, useEffect, useRef, useState } from "react";

const SEARCH_FETCH_LIMIT = 5000;

export function useSearch(channelId: string | null = null): UseSearchReturn {
    const [query, setQueryState] = useState<string>("");
    const [results, setResults] = useState<Speech[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    const allSpeechesRef = useRef<Speech[]>([]);
    const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMountedRef = useRef<boolean>(true);

    const loadSpeeches = useCallback(async () => {
        try {
            const queries: string[] = [
                Query.limit(SEARCH_FETCH_LIMIT),
                Query.offset(0),
                Query.orderDesc("uploadDate"),
            ];

            if (channelId) {
                queries.push(Query.equal("channelId", channelId));
            }

            const response = await databases.listDocuments(
                config.databaseId,
                config.speechesCollectionId,
                queries
            );

            if (isMountedRef.current) {
                allSpeechesRef.current = (response.documents as unknown as Speech[]).filter(
                    (speech) => (speech as Speech & { isShort?: boolean | null }).isShort !== true
                );
            }
        } catch (error) {
            console.error("Failed to load speeches for search:", error);
        }
    }, [channelId]);

    const performSearch = useCallback(
        (searchQuery: string) => {
            if (!searchQuery.trim()) {
                setResults([]);
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                const searchResults = searchItems(allSpeechesRef.current, searchQuery, {
                    searchInChannel: true,
                    minScore: 60,
                });

                if (isMountedRef.current) {
                    setResults(searchResults);
                }
            } catch (error) {
                console.error("Search failed:", error);
                if (isMountedRef.current) {
                    setResults([]);
                }
            } finally {
                if (isMountedRef.current) {
                    setLoading(false);
                }
            }
        },
        []
    );

    const setQuery = useCallback(
        (newQuery: string) => {
            setQueryState(newQuery);

            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }

            if (!newQuery.trim()) {
                setResults([]);
                setLoading(false);
                return;
            }

            setLoading(true);

            debounceTimeoutRef.current = setTimeout(() => {
                performSearch(newQuery);
            }, 300);
        },
        [performSearch]
    );

    const clearSearch = useCallback(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = null;
        }

        setQueryState("");
        setResults([]);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadSpeeches();
    }, [loadSpeeches]);

    useEffect(() => {
        if (query.trim()) {
            loadSpeeches().then(() => {
                performSearch(query);
            });
        }
    }, [channelId, loadSpeeches, performSearch, query]);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;

            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, []);

    return {
        query,
        results,
        loading,
        setQuery,
        clearSearch,
    };
}
