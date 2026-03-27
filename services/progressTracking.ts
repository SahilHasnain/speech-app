import AsyncStorage from "@react-native-async-storage/async-storage";

const PROGRESS_KEY = "@speech_progress";

export interface VideoProgress {
    speechId: string;
    progress: number; // Current time in seconds
    duration: number; // Total duration in seconds
    percentage: number; // Progress percentage (0-100)
    timestamp: number; // When it was last updated
}

export type { VideoProgress };

/**
 * Get all video progress records
 */
async function getAllProgress(): Promise<Record<string, VideoProgress>> {
    try {
        const json = await AsyncStorage.getItem(PROGRESS_KEY);
        if (!json) return {};
        return JSON.parse(json);
    } catch (error) {
        console.error("Failed to load progress:", error);
        return {};
    }
}

/**
 * Get progress for a specific speech
 */
export async function getProgress(speechId: string): Promise<VideoProgress | null> {
    try {
        const allProgress = await getAllProgress();
        return allProgress[speechId] || null;
    } catch (error) {
        console.error("Failed to get progress:", error);
        return null;
    }
}

/**
 * Save progress for a speech
 * Only saves if:
 * - User has watched at least 5% of the video
 * - User hasn't watched more than 95% (consider it completed)
 */
export async function saveProgress(
    speechId: string,
    progress: number,
    duration: number
): Promise<void> {
    try {
        // Calculate percentage
        const percentage = duration > 0 ? (progress / duration) * 100 : 0;

        // Don't save if less than 5% watched
        if (percentage < 5) {
            return;
        }

        // Don't save if more than 95% watched (consider it completed)
        if (percentage > 95) {
            await removeProgress(speechId);
            return;
        }

        const allProgress = await getAllProgress();
        allProgress[speechId] = {
            speechId,
            progress,
            duration,
            percentage,
            timestamp: Date.now(),
        };

        await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(allProgress));
    } catch (error) {
        console.error("Failed to save progress:", error);
    }
}

/**
 * Remove progress for a specific speech
 */
export async function removeProgress(speechId: string): Promise<void> {
    try {
        const allProgress = await getAllProgress();
        delete allProgress[speechId];
        await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(allProgress));
    } catch (error) {
        console.error("Failed to remove progress:", error);
    }
}

/**
 * Clear all progress records
 */
export async function clearAllProgress(): Promise<void> {
    try {
        await AsyncStorage.removeItem(PROGRESS_KEY);
    } catch (error) {
        console.error("Failed to clear progress:", error);
    }
}

/**
 * Get all speeches with progress (for displaying progress indicators)
 */
export async function getAllSpeechesWithProgress(): Promise<Record<string, VideoProgress>> {
    return getAllProgress();
}

/**
 * Clean up old progress records (older than 30 days)
 */
export async function cleanupOldProgress(): Promise<void> {
    try {
        const allProgress = await getAllProgress();
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

        const cleaned = Object.entries(allProgress).reduce(
            (acc, [speechId, progress]) => {
                if (progress.timestamp > thirtyDaysAgo) {
                    acc[speechId] = progress;
                }
                return acc;
            },
            {} as Record<string, VideoProgress>
        );

        await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(cleaned));
    } catch (error) {
        console.error("Failed to cleanup old progress:", error);
    }
}
