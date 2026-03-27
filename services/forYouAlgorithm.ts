/**
 * For You Algorithm Service
 *
 * Smart content discovery algorithm that provides personalized,
 * randomized content recommendations based on:
 * - Watch history (avoid recently watched)
 * - Recency (newer content prioritized)
 * - Engagement (views count)
 * - Channel diversity (mix different channels)
 * - Random factor (keep it interesting)
 */

import type { Speech } from "../types";
import { storageService } from "./storage";

interface ScoredSpeech {
  speech: Speech;
  score: number;
}

/**
 * Algorithm weights for scoring
 */
const WEIGHTS = {
  RECENCY: 0.25, // How new the content is
  ENGAGEMENT: 0.3, // View count popularity
  DIVERSITY: 0.2, // Channel variety
  UNSEEN: 0.15, // Not in watch history
  RANDOM: 0.1, // Random factor for discovery
};

/**
 * Calculate recency score (0-1)
 * Newer content gets higher scores
 */
function calculateRecencyScore(uploadDate: string): number {
  const now = Date.now();
  const uploaded = new Date(uploadDate).getTime();
  const ageInDays = (now - uploaded) / (1000 * 60 * 60 * 24);

  // Exponential decay: content loses 50% score every 30 days
  return Math.exp(-ageInDays / 30);
}

/**
 * Calculate engagement score (0-1)
 * Normalized by max views in the dataset
 */
function calculateEngagementScore(views: number, maxViews: number): number {
  if (maxViews === 0) return 0;
  return Math.min(views / maxViews, 1);
}

/**
 * Calculate diversity score (0-1)
 * Penalizes channels that appear too frequently in recent results
 */
function calculateDiversityScore(
  channelId: string,
  recentChannels: Map<string, number>
): number {
  const count = recentChannels.get(channelId) || 0;
  // Exponential penalty for repeated channels
  return Math.exp(-count / 3);
}

/**
 * Apply weighted shuffle to scored speeches
 * Higher scored items are more likely to appear first
 */
function weightedShuffle(scoredSpeeches: ScoredSpeech[]): Speech[] {
  const result: Speech[] = [];
  const remaining = [...scoredSpeeches];

  while (remaining.length > 0) {
    // Calculate total score
    const totalScore = remaining.reduce((sum, item) => sum + item.score, 0);

    // Pick random value
    let random = Math.random() * totalScore;

    // Select item based on weighted probability
    let selectedIndex = 0;
    for (let i = 0; i < remaining.length; i++) {
      random -= remaining[i].score;
      if (random <= 0) {
        selectedIndex = i;
        break;
      }
    }

    // Add to result and remove from remaining
    result.push(remaining[selectedIndex].speech);
    remaining.splice(selectedIndex, 1);
  }

  return result;
}

/**
 * Generate For You feed with smart randomization
 *
 * @param speeches - All available speeches
 * @param channelId - Optional channel filter
 * @returns Smartly randomized array of speeches
 */
export async function generateForYouFeed(
  speeches: Speech[],
  channelId?: string | null
): Promise<Speech[]> {
  if (speeches.length === 0) return [];

  // Get watch history
  const watchHistory = await storageService.getWatchHistory();
  const watchedSet = new Set(watchHistory);

  // Calculate max views for normalization
  const maxViews = Math.max(...speeches.map((s) => s.views), 1);

  // Track recent channels for diversity
  const recentChannels = new Map<string, number>();

  // Score each speech
  const scoredSpeeches: ScoredSpeech[] = speeches.map((speech) => {
    // Recency score
    const recencyScore = calculateRecencyScore(speech.uploadDate);

    // Engagement score
    const engagementScore = calculateEngagementScore(speech.views, maxViews);

    // Diversity score
    const diversityScore = calculateDiversityScore(
      speech.channelId,
      recentChannels
    );

    // Unseen bonus (higher score if not watched)
    const unseenScore = watchedSet.has(speech.$id) ? 0 : 1;

    // Random factor
    const randomScore = Math.random();

    // Calculate weighted total score
    const score =
      recencyScore * WEIGHTS.RECENCY +
      engagementScore * WEIGHTS.ENGAGEMENT +
      diversityScore * WEIGHTS.DIVERSITY +
      unseenScore * WEIGHTS.UNSEEN +
      randomScore * WEIGHTS.RANDOM;

    return { speech, score };
  });

  // Apply weighted shuffle
  return weightedShuffle(scoredSpeeches);
}

/**
 * Get For You feed with session caching
 * Returns cached order if session is still valid
 *
 * @param speeches - All available speeches
 * @param channelId - Optional channel filter
 * @returns Ordered array of speeches
 */
export async function getForYouFeed(
  speeches: Speech[],
  channelId?: string | null
): Promise<Speech[]> {
  // Check for existing session
  const sessionIds = await storageService.getForYouSession();

  if (sessionIds) {
    // Reconstruct order from session
    const speechMap = new Map(speeches.map((s) => [s.$id, s]));
    const orderedSpeeches = sessionIds
      .map((id) => speechMap.get(id))
      .filter((s): s is Speech => s !== undefined);

    // If we have most of the speeches, use cached order
    if (orderedSpeeches.length >= speeches.length * 0.8) {
      return orderedSpeeches;
    }
  }

  // Generate new order
  const orderedSpeeches = await generateForYouFeed(speeches, channelId);

  // Save session
  await storageService.saveForYouSession(orderedSpeeches.map((s) => s.$id));

  return orderedSpeeches;
}
