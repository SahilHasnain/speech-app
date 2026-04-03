import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const SEEN_SHORTS_KEY = "shorts_seen";
const LAST_RESET_KEY = "shorts_last_reset";
const RESET_AFTER_DAYS = 7;

export function useSeenShorts() {
  const [seenShortIds, setSeenShortIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load seen shorts from storage
  useEffect(() => {
    const loadSeenShorts = async () => {
      try {
        const [seenData, lastResetData] = await Promise.all([
          AsyncStorage.getItem(SEEN_SHORTS_KEY),
          AsyncStorage.getItem(LAST_RESET_KEY),
        ]);

        // Check if we need to reset (after 7 days)
        if (lastResetData) {
          const lastReset = new Date(lastResetData);
          const daysSinceReset = (Date.now() - lastReset.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceReset >= RESET_AFTER_DAYS) {
            // Reset seen list
            await AsyncStorage.multiRemove([SEEN_SHORTS_KEY, LAST_RESET_KEY]);
            setSeenShortIds([]);
            console.log("🔄 Reset seen shorts (7 days passed)");
            setLoading(false);
            return;
          }
        }

        if (seenData) {
          const parsed = JSON.parse(seenData);
          setSeenShortIds(Array.isArray(parsed) ? parsed : []);
        }
      } catch (error) {
        console.error("Failed to load seen shorts:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSeenShorts();
  }, []);

  // Mark a short as seen
  const markAsSeen = useCallback(async (shortId: string) => {
    try {
      setSeenShortIds((prev) => {
        if (prev.includes(shortId)) return prev;
        const updated = [...prev, shortId];
        
        // Save to storage
        AsyncStorage.setItem(SEEN_SHORTS_KEY, JSON.stringify(updated)).catch(
          console.error
        );
        
        // Set last reset date if first time
        if (prev.length === 0) {
          AsyncStorage.setItem(LAST_RESET_KEY, new Date().toISOString()).catch(
            console.error
          );
        }
        
        return updated;
      });
    } catch (error) {
      console.error("Failed to mark short as seen:", error);
    }
  }, []);

  // Check if a short has been seen
  const hasSeen = useCallback(
    (shortId: string) => {
      return seenShortIds.includes(shortId);
    },
    [seenShortIds]
  );

  // Reset all seen shorts
  const resetSeen = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([SEEN_SHORTS_KEY, LAST_RESET_KEY]);
      setSeenShortIds([]);
      console.log("🔄 Manually reset seen shorts");
    } catch (error) {
      console.error("Failed to reset seen shorts:", error);
    }
  }, []);

  // Get stats
  const getStats = useCallback(() => {
    return {
      totalSeen: seenShortIds.length,
      seenIds: seenShortIds,
    };
  }, [seenShortIds]);

  return {
    seenShortIds,
    markAsSeen,
    hasSeen,
    resetSeen,
    getStats,
    loading,
  };
}
