import { useFilterModal } from "@/contexts/FilterModalContext";
import { useSearch as useSearchContext } from "@/contexts/SearchContext";
import { useClientSearch } from "@/hooks/useClientSearch";
import { SortOption, useSpeeches } from "@/hooks/useSpeeches";
import { useState } from "react";

export function useHomeFilters() {
    // Home filters
    const [selectedFilter, setSelectedFilter] = useState<SortOption>("forYou");

    const { showFilterModal, setShowFilterModal } = useFilterModal();
    const { isSearchActive, activeSearchQuery } = useSearchContext();

    // Data fetching
    const { speeches, loading, error, hasMore, loadMore, refresh } = useSpeeches(selectedFilter);
    const { results: searchResults, loading: searchLoading, setQuery } = useClientSearch(speeches);

    const isShowingSearchResults = isSearchActive && activeSearchQuery.length > 0;

    // Compute display data
    const displayData = isShowingSearchResults ? searchResults : speeches;
    const isLoading = isShowingSearchResults ? searchLoading : loading;

    const hasActiveHomeFilters = selectedFilter !== "forYou";

    return {
        // Home filters
        selectedFilter,
        setSelectedFilter,
        // Filter modal
        showFilterModal,
        setShowFilterModal,
        // Data
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
