import { useFilterModal } from "@/contexts/FilterModalContext";
import { useSearch as useSearchContext } from "@/contexts/SearchContext";
import { useChannels } from "@/hooks/useChannels";
import { useClientSearch } from "@/hooks/useClientSearch";
import { SortOption, useSpeeches } from "@/hooks/useSpeeches";
import type { DurationOption, Speech } from "@/types";
import React, { useState } from "react";

/**
 * Filter speeches by duration
 */
function filterSpeechesByDuration(
    speeches: Speech[],
    duration: DurationOption
): Speech[] {
    if (duration === "all") return speeches;

    return speeches.filter((speech) => {
        const durationInSeconds = speech.duration;

        switch (duration) {
            case "short":
                return durationInSeconds < 300; // < 5 minutes
            case "medium":
                return durationInSeconds >= 300 && durationInSeconds <= 900; // 5-15 minutes
            case "long":
                return durationInSeconds > 900; // > 15 minutes
            default:
                return true;
        }
    });
}

export function useHomeFilters() {
    // Home filters
    const [selectedFilter, setSelectedFilter] = useState<SortOption>("forYou");
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<DurationOption>("all");

    const { showFilterModal, setShowFilterModal } = useFilterModal();
    const { isSearchActive, activeSearchQuery } = useSearchContext();

    // Data fetching
    const { channels, loading: channelsLoading, refresh: refreshChannels } = useChannels();
    const { speeches, loading, error, hasMore, loadMore, refresh } = useSpeeches(selectedFilter);
    const { results: searchResults, loading: searchLoading, setQuery } = useClientSearch(speeches);

    const isShowingSearchResults = isSearchActive && activeSearchQuery.length > 0;

    // Compute display data with channel and duration filters
    const homeDisplayData = React.useMemo(() => {
        let filtered = speeches;

        // Apply channel filter
        if (selectedChannelId) {
            filtered = filtered.filter((speech) => speech.channelId === selectedChannelId);
        }

        // Apply duration filter
        filtered = filterSpeechesByDuration(filtered, selectedDuration);

        return filtered;
    }, [speeches, selectedChannelId, selectedDuration]);

    const searchDisplayData = React.useMemo(() => {
        return searchResults;
    }, [searchResults]);

    const displayData = isShowingSearchResults ? searchDisplayData : homeDisplayData;
    const isLoading = isShowingSearchResults ? searchLoading : loading;

    const hasActiveHomeFilters =
        selectedFilter !== "forYou" ||
        selectedChannelId !== null ||
        selectedDuration !== "all";

    return {
        // Home filters
        selectedFilter,
        setSelectedFilter,
        selectedChannelId,
        setSelectedChannelId,
        selectedDuration,
        setSelectedDuration,
        // Filter modal
        showFilterModal,
        setShowFilterModal,
        // Data
        channels,
        channelsLoading,
        refreshChannels,
        speeches,
        loading,
        error,
        hasMore,
        loadMore,
        refresh,
        searchResults,
        searchLoading,
        setQuery,
        // Derived
        isShowingSearchResults,
        displayData,
        isLoading,
        hasActiveHomeFilters,
    };
}
