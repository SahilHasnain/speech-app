import { CustomVideoPlayer } from "@/components/CustomVideoPlayer";
import { colors } from "@/constants/theme";
import { useTabBarVisibility } from "@/contexts/TabBarVisibilityContext.animated";
import { getProgress, saveProgress } from "@/services/progressTracking";
import { storageService } from "@/services/storage";
import Constants from "expo-constants";
import { VideoPlayer } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    AppState,
    Alert,
    StatusBar,
    StyleSheet,
    View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { config, databases } from "@/config/appwrite";
import { runOnJS } from "react-native-reanimated";

export default function VideoScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        videoId: string;
        title?: string;
        channelName?: string;
        thumbnailUrl?: string;
        speechId?: string;
        currentIndex?: string;
        feedIds?: string;
    }>();

    const [isLoading, setIsLoading] = React.useState(true);
    const [videoPlaying, setVideoPlaying] = React.useState(false);
    const [videoDuration, setVideoDuration] = React.useState(0);
    const [initialPosition, setInitialPosition] = React.useState(0);
    const lastSavedProgressRef = React.useRef<number>(0);
    const videoRef = React.useRef<VideoPlayer>(null);
    const playingRef = React.useRef(false);
    const speechIdRef = React.useRef<string | undefined>(undefined);
    const videoDurationRef = React.useRef(0);

    const videoId = params.videoId;
    const speechId = params.speechId;
    const currentIndex = Number(params.currentIndex || -1);
    const feedIds = React.useMemo(
        () => (typeof params.feedIds === "string" ? params.feedIds.split(",").filter(Boolean) : []),
        [params.feedIds],
    );

    // Construct Appwrite video URL
    const endpoint = Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";
    const projectId = Constants.expoConfig?.extra?.EXPO_PUBLIC_APPWRITE_PROJECT_ID || "69c60b0e001c5ec5e031";
    const videoUrl = `${endpoint}/storage/buckets/video-files/files/${videoId}/view?project=${projectId}`;

    // Get tab bar visibility context
    const { showTabBar, tabBarHeight } = useTabBarVisibility();

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

    React.useEffect(() => {
        playingRef.current = videoPlaying;
    }, [videoPlaying]);

    React.useEffect(() => {
        speechIdRef.current = speechId;
    }, [speechId]);

    React.useEffect(() => {
        videoDurationRef.current = videoDuration;
    }, [videoDuration]);

    const navigateToSpeech = React.useCallback(
        async (nextSpeechId: string, nextIndex: number) => {
            try {
                const response = await databases.getDocument(
                    config.databaseId,
                    config.speechesCollectionId,
                    nextSpeechId,
                );
                const speech = response as any;

                await storageService.addToWatchHistory(speech.$id);

                router.replace({
                    pathname: "/video",
                    params: {
                        videoId: speech.videoId,
                        title: speech.title,
                        channelName: speech.channelName,
                        thumbnailUrl: speech.thumbnailUrl,
                        speechId: speech.$id,
                        currentIndex: String(nextIndex),
                        feedIds: feedIds.join(","),
                    },
                });
            } catch (error) {
                console.error("Failed to navigate to next speech:", error);
                Alert.alert("Next Video", "Unable to load the next speech right now.", [
                    { text: "OK" },
                ]);
            }
        },
        [feedIds, router],
    );

    const handleNextSpeech = React.useCallback(() => {
        if (currentIndex < 0 || currentIndex + 1 >= feedIds.length) {
            return;
        }

        const nextSpeechId = feedIds[currentIndex + 1];
        if (!nextSpeechId) {
            return;
        }

        const player = videoRef.current;
        if (player?.playing) {
            player.pause();
        }

        navigateToSpeech(nextSpeechId, currentIndex + 1);
    }, [currentIndex, feedIds, navigateToSpeech]);

    const swipeUpGesture = React.useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetY([-24, 24])
                .failOffsetX([-40, 40])
                .onEnd((event) => {
                    if (event.translationY < -90 && Math.abs(event.velocityY) > 250) {
                        runOnJS(handleNextSpeech)();
                    }
                }),
        [handleNextSpeech],
    );

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
                translucent
            />

            <SafeAreaView edges={[]} className="flex-1 bg-black">
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

                <GestureDetector gesture={swipeUpGesture}>
                    <View className="flex-1 bg-black">
                        <CustomVideoPlayer
                            ref={videoRef}
                            videoUrl={videoUrl}
                            bottomOffset={tabBarHeight}
                            onTimeUpdate={async (currentTime, duration) => {
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
                            </View>
                        )}
                    </View>
                </GestureDetector>
            </SafeAreaView>
        </>
    );
}
