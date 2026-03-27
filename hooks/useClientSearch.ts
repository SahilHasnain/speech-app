import { Speech } from "@/types";
import { searchItems } from "@/utils/search";
import { useCallback, useEffect, useRef, useState } from "react";

interface UseClientSearchReturn {
    query: string;
    results: Speech[];
    loading: boolean;
    setQuery: (query: string) => void;
    clearSearch: () => void;
}

/**
 * Custom hook for client-side fuzzy search of speeches
 *
 * Features:
 * - Client-side fuzzy search with robust matching
 * - Debounced search with 300ms delay
 * - Real-time filtering as user types
 * - Handles spelling variants and transliteration
 *
 * @param allSpeeches - Array of all speeches to search through
 * @returns UseClientSearchReturn object with search state and control functions
 */
export function useClientSearch(allSpeeches: Speech[]): UseClientSearchReturn {
    const [query, setQueryState] = useState<string>("");
    const [results, setResults] = useState<Speech[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    // Ref to store the debounce timeout
    const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Ref to track if component is mounted
    const isMountedRef = useRef<boolean>(true);

    /**
     * Perform client-side search
     */
    const performSearch = useCallback(
        (searchQuery: string) => {
            if (!searchQuery.trim()) {
                setResults([]);
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                // Use client-side fuzzy search
                const searchResults = searchItems(allSpeeches, searchQuery, {
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
        [allSpeeches]
    );

    /**
     * Set search query with debouncing
     * Triggers search after 300ms of inactivity
     */
    const setQuery = useCallback(
        (newQuery: string) => {
            setQueryState(newQuery);

            // Clear existing timeout
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }

            // If query is empty, clear results immediately
            if (!newQuery.trim()) {
                setResults([]);
                setLoading(false);
                return;
            }

            // Set loading state immediately for better UX
            setLoading(true);

            // Set new timeout for debounced search
            debounceTimeoutRef.current = setTimeout(() => {
                performSearch(newQuery);
            }, 300);
        },
        [performSearch]
    );

    /**
     * Clear search query and results
     * Restores to initial state
     */
    const clearSearch = useCallback(() => {
        // Clear any pending debounce timeout
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
            debounceTimeoutRef.current = null;
        }

        setQueryState("");
        setResults([]);
        setLoading(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;

            // Clear any pending timeout
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
