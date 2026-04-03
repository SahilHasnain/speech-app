import { CustomVideoPlayer } from "@/components/CustomVideoPlayer";
import { colors, shadows } from "@/constants/theme";
import { useTabBarVisibility } from "@/contexts/TabBarVisibilityContext.animated";
import { getProgress, saveProgress } from "@/services/progressTracking";
import Constants from "expo-constants";
import { VideoPlayer } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    AppState,
    Alert,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function VideoScreen() {
    const params = useLocalSearchParams<{
        videoId: string;
        title?: string;
        channelName?: string;
        thumbnailUrl?: string;
        speechId?: string;
    }>();

    const [isLoading, setIsLoading] = React.useState(true);
    const [videoPlaying, setVideoPlaying] = React.useState(false);
    const [videoDuration, setVideoDuration] = React.useState(0);
    const [videoPosition, setVideoPosition] = React.useState(0);
    const [initialPosition, setInitialPosition] = React.useState(0);
    const lastSavedProgressRef = React.useRef<number>(0);
    const videoRef = React.useRef<VideoPlayer>(null);
    const playingRef = React.useRef(false);
    const speechIdRef = React.useRef<string | undefined>(undefined);
    const videoDurationRef = React.useRef(0);

    const videoId = params.videoId;
    const title = params.title;
    const speechId = params.speechId;

    // Construct Appwrite video URL
    const endpoint = Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
    const projectId = Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "69c60b0e001c5ec5e031";
    const videoUrl = `${endpoint}/storage/buckets/video-files/files/${videoId}/view?project=${projectId}`;

    // Get tab bar visibility context
    const { showTabBar } = useTabBarVisibility();

    // Force tab bar to show when this screen is focused
    useFocusEffect(
        React.useCallback(() => {
            showTabBar();

            return () => {
                const player = videoRef.current;
                if (!player) {
                    return;
                }

                if (player.playing) {
                    player.pause();
                }

                if (speechIdRef.current && videoDurationRef.current > 0) {
                    saveProgress(
                        speechIdRef.current,
                        player.currentTime,
                        videoDurationRef.current,
                    ).catch((error) => {
                        console.error("Error saving progress on blur:", error);
                    });
                }
            };
        }, [showTabBar]),
    );

    const formatTime = React.useCallback((seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, "0")}`;
    }, []);

    React.useEffect(() => {
        playingRef.current = videoPlaying;
    }, [videoPlaying]);

    React.useEffect(() => {
        speechIdRef.current = speechId;
    }, [speechId]);

    React.useEffect(() => {
        videoDurationRef.current = videoDuration;
    }, [videoDuration]);

    React.useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextState) => {
            if (nextState === "active") {
                return;
            }

            const player = videoRef.current;
            if (!player) {
                return;
            }

            if (player.playing) {
                player.pause();
            }

            if (speechIdRef.current && videoDurationRef.current > 0) {
                saveProgress(
                    speechIdRef.current,
                    player.currentTime,
                    videoDurationRef.current,
                ).catch((error) => {
                    console.error("Error saving progress on app background:", error);
                });
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // Load video on mount and autoplay
    React.useEffect(() => {
        setIsLoading(true);
        setVideoPosition(0);
        setVideoPlaying(true);
        setInitialPosition(0);
        lastSavedProgressRef.current = 0;

        const loadingTimeout = setTimeout(() => {
            setIsLoading(false);
        }, 5000);

        return () => {
            clearTimeout(loadingTimeout);
        };
    }, [videoId]);

    // Load saved progress and resume automatically when applicable
    React.useEffect(() => {
        const loadSavedProgress = async () => {
            if (!speechId) {
                return;
            }

            try {
                const progress = await getProgress(speechId);
                if (progress && progress.progress > 0) {
                    const percentage = (progress.progress / progress.duration) * 100;
                    if (percentage >= 5 && percentage <= 95) {
                        setInitialPosition(progress.progress);
                        setVideoPosition(progress.progress);
                        lastSavedProgressRef.current = progress.progress;
                        console.log(`Auto-resuming from ${progress.progress}s (${percentage.toFixed(1)}%)`);
                    }
                }
            } catch (error) {
                console.error("Failed to load saved progress:", error);
            }
        };

        loadSavedProgress();
    }, [speechId, videoId]);

    // Cleanup: unlock orientation when screen unmounts
    React.useEffect(() => {
        const player = videoRef.current;
        return () => {
            if (speechId && videoDuration > 0 && player) {
                (async () => {
                    try {
                        await saveProgress(speechId, player.currentTime, videoDuration);
                    } catch (error) {
                        console.error("Error saving progress on unmount:", error);
                    }
                })();
            }
        };
    }, [speechId, videoDuration]);

    return (
        <>
            <StatusBar
                barStyle="light-content"
                backgroundColor={colors.background.primary}
            />

            <SafeAreaView edges={["bottom", "top"]} className="flex-1 bg-black">
                <LinearGradient
                    pointerEvents="none"
                    colors={[
                        "rgba(0, 0, 0, 0.46)",
                        "rgba(6, 10, 20, 0.24)",
                        "rgba(0, 0, 0, 0.12)",
                        "rgba(0, 0, 0, 0.36)",
                    ]}
                    locations={[0, 0.18, 0.58, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />

                <View className="flex-1">
                    <View
                        className="flex-1 bg-neutral-900 overflow-hidden"
                        style={shadows.lg}
                    >
                        {/* Video Player */}
                        <View className="flex-1 bg-black">
                            <View className="relative flex-1">
                                <CustomVideoPlayer
                                    ref={videoRef}
                                    videoUrl={videoUrl}
                                    title={title}
                                    onTimeUpdate={async (currentTime, duration) => {
                                        setVideoPosition(currentTime);
                                        if (duration > 0 && videoDuration !== duration) {
                                            setVideoDuration(duration);
                                        }

                                        if (
                                            speechId &&
                                            playingRef.current &&
                                            duration > 0 &&
                                            Math.abs(currentTime - lastSavedProgressRef.current) >= 10
                                        ) {
                                            await saveProgress(speechId, currentTime, duration);
                                            lastSavedProgressRef.current = currentTime;
                                        }
                                    }}
                                    onPlayingChange={async (playing) => {
                                        setVideoPlaying(playing);

                                        if (!playing && speechId && videoDuration > 0 && videoRef.current) {
                                            try {
                                                await saveProgress(
                                                    speechId,
                                                    videoRef.current.currentTime,
                                                    videoDuration,
                                                );
                                            } catch (error) {
                                                console.error("Error saving progress on pause:", error);
                                            }
                                        }
                                    }}
                                    onReadyForDisplay={() => {
                                        console.log("[VideoScreen] Video ready");
                                        setIsLoading(false);
                                    }}
                                    onError={(error) => {
                                        console.error("[VideoScreen] Video error:", error);
                                        setIsLoading(false);
                                        Alert.alert(
                                            "Video Error",
                                            "Unable to load video. Please check your internet connection.",
                                            [{ text: "OK" }],
                                        );
                                    }}
                                    onLoad={(duration) => {
                                        console.log("[VideoScreen] Video duration:", duration);
                                        setVideoDuration(duration);
                                    }}
                                    onEnd={() => {
                                        setVideoPlaying(false);

                                        if (speechId && videoDuration > 0) {
                                            saveProgress(speechId, videoDuration, videoDuration).catch((error) => {
                                                console.error("Error saving progress on end:", error);
                                            });
                                        }
                                    }}
                                    initialPosition={initialPosition}
                                />

                                {isLoading && (
                                    <View className="absolute inset-0 items-center justify-center bg-black">
                                        <ActivityIndicator
                                            size="large"
                                            color={colors.text.primary}
                                        />
                                        <Text className="mt-3 text-sm text-neutral-400">
                                            Loading video...
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Custom Video Controls */}
                            <View className="px-6 pb-24 bg-black">
                                <View className="mb-4 items-center">
                                    <Text className="text-sm text-neutral-400">
                                        {formatTime(videoPosition)} / {videoDuration > 0 ? formatTime(videoDuration) : "--:--"}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
}
