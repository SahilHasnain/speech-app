import AsyncStorage from "@react-native-async-storage/async-storage";

const SEARCH_HISTORY_KEY = "@speech_search_history";
const MAX_HISTORY_ITEMS = 20;

export interface SearchHistoryItem {
    id: string;
    query: string;
    timestamp: number;
}

/**
 * Get search history
 */
export async function getSearchHistory(): Promise<SearchHistoryItem[]> {
    try {
        const json = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        if (!json) return [];
        return JSON.parse(json);
    } catch (error) {
        console.error("Failed to load search history:", error);
        return [];
    }
}

/**
 * Add query to search history
 */
export async function addToSearchHistory(query: string): Promise<void> {
    try {
        const trimmed = query.trim();
        if (!trimmed) return;

        const history = await getSearchHistory();

        // Remove existing entry if present
        const filtered = history.filter(
            (item) => item.query.toLowerCase() !== trimmed.toLowerCase()
        );

        // Add new entry at the beginning
        const newHistory: SearchHistoryItem[] = [
            {
                id: Date.now().toString(),
                query: trimmed,
                timestamp: Date.now(),
            },
            ...filtered,
        ].slice(0, MAX_HISTORY_ITEMS);

        await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
    } catch (error) {
        console.error("Failed to save search history:", error);
    }
}

/**
 * Remove item from search history
 */
export async function removeFromSearchHistory(id: string): Promise<void> {
    try {
        const history = await getSearchHistory();
        const filtered = history.filter((item) => item.id !== id);
        await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error("Failed to remove from search history:", error);
    }
}

/**
 * Clear all search history
 */
export async function clearSearchHistory(): Promise<void> {
    try {
        await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (error) {
        console.error("Failed to clear search history:", error);
    }
}
