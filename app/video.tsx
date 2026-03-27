import Pressable from "@/components/ResponsivePressable";
import { colors, shadows } from "@/constants/theme";
import { useTabBarVisibility } from "@/contexts/TabBarVisibilityContext.animated";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React from "react";
import {
    ActivityIndicator,
    Alert,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import YoutubePlayer from "react-native-youtube-iframe";

export default function VideoScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        videoUrl: string;
        title?: string;
        channelName?: string;
        thumbnailUrl?: string;
        youtubeId?: string;
        speechId?: string;
    }>();

    const [isLoading, setIsLoading] = React.useState(true);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const [videoPlaying, setVideoPlaying] = React.useState(false);
    const [videoDuration, setVideoDuration] = React.useState(0);
    const [videoPosition, setVideoPosition] = React.useState(0);
    const [isRepeatEnabled, setIsRepeatEnabled] = React.useState(false);
    const playerRef = React.useRef<any>(null);

    const videoUrl = params.videoUrl;
    const title = params.title;

    // Get tab bar visibility context
    const { showTabBar } = useTabBarVisibility();

    // Force tab bar to show when this screen is focused
    useFocusEffect(
        React.useCallback(() => {
            // Show tab bar and reset scroll tracking state
            showTabBar();
        }, [showTabBar]),
    );

    // Extract YouTube video ID from URL
    const getYouTubeId = (url: string): string => {
        const regExp =
            /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return match && match[7].length === 11 ? match[7] : "";
    };

    // Format seconds to MM:SS
    const formatTime = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, "0")}`;
    };

    const videoId = getYouTubeId(videoUrl);

    // Load video on mount and autoplay
    React.useEffect(() => {
        setIsLoading(true);
        setVideoPosition(0);
        setVideoPlaying(true);

        const loadingTimeout = setTimeout(() => {
            if (isLoading) {
                setIsLoading(false);
            }
        }, 5000);

        return () => {
            clearTimeout(loadingTimeout);
        };
    }, [videoUrl]);

    // Handle fullscreen changes
    const handleFullscreenChange = async (isFullscreen: boolean) => {
        setIsFullscreen(isFullscreen);

        if (isFullscreen) {
            await ScreenOrientation.lockAsync(
                ScreenOrientation.OrientationLock.LANDSCAPE,
            );
        } else {
            await ScreenOrientation.unlockAsync();
        }
    };

    // Cleanup: unlock orientation when screen unmounts
    React.useEffect(() => {
        return () => {
            if (isFullscreen) {
                ScreenOrientation.unlockAsync();
            }
        };
    }, [isFullscreen]);

    // Update video position periodically
    React.useEffect(() => {
        const interval = setInterval(async () => {
            if (playerRef.current) {
                try {
                    const currentTime = await playerRef.current.getCurrentTime();
                    setVideoPosition(currentTime);

                    if (videoDuration === 0) {
                        try {
                            const duration = await playerRef.current.getDuration();
                            if (duration > 0) {
                                setVideoDuration(duration);
                            }
                        } catch {
                            // Ignore duration errors
                        }
                    }
                } catch {
                    // Ignore errors
                }
            }
        }, 500);

        return () => clearInterval(interval);
    }, [videoDuration]);

    // Handle video state changes
    const onStateChange = React.useCallback(
        (state: string) => {
            if (state === "playing") {
                setIsLoading(false);
                setVideoPlaying(true);

                if (videoDuration === 0 && playerRef.current) {
                    setTimeout(async () => {
                        try {
                            const duration = await playerRef.current.getDuration();
                            if (duration > 0) {
                                setVideoDuration(duration);
                            }
                        } catch (error) {
                            console.error("Error getting duration:", error);
                        }
                    }, 1000);
                }
            } else if (state === "paused") {
                setVideoPlaying(false);
            } else if (state === "ended") {
                setVideoPlaying(false);

                if (isRepeatEnabled && playerRef.current) {
                    setTimeout(async () => {
                        try {
                            await playerRef.current.seekTo(0, true);
                            setVideoPlaying(true);
                        } catch (error) {
                            console.error("Error repeating video:", error);
                        }
                    }, 100);
                }
            }
        },
        [isRepeatEnabled, videoDuration],
    );

    // Seek to position in video
    const seekToPosition = async (seconds: number) => {
        if (playerRef.current) {
            try {
                await playerRef.current.seekTo(seconds, true);
                setVideoPosition(seconds);
            } catch {
                // Ignore errors
            }
        }
    };

    const toggleRepeat = () => {
        setIsRepeatEnabled(!isRepeatEnabled);
    };

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
                                <YoutubePlayer
                                    ref={playerRef}
                                    height={300}
                                    videoId={videoId}
                                    play={videoPlaying}
                                    onReady={() => {
                                        setIsLoading(false);
                                        if (playerRef.current) {
                                            setTimeout(async () => {
                                                try {
                                                    const duration = await playerRef.current.getDuration();
                                                    setVideoDuration(duration);
                                                } catch (error) {
                                                    console.error("Error getting duration:", error);
                                                }
                                            }, 500);
                                        }
                                    }}
                                    onChangeState={onStateChange}
                                    onFullScreenChange={handleFullscreenChange}
                                    onError={() => {
                                        setIsLoading(false);
                                        Alert.alert(
                                            "Video Error",
                                            "Unable to load video. Please check your internet connection and try again.",
                                            [{ text: "OK" }],
                                        );
                                    }}
                                    webViewStyle={{ opacity: isLoading ? 0 : 1 }}
                                    initialPlayerParams={{
                                        controls: true,
                                        modestbranding: true,
                                        rel: false,
                                    }}
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
                                {/* Progress Bar */}
                                <View className="mb-4">
                                    <Slider
                                        style={{ width: "100%", height: 40 }}
                                        minimumValue={0}
                                        maximumValue={videoDuration}
                                        value={videoPosition}
                                        onSlidingComplete={seekToPosition}
                                        minimumTrackTintColor={colors.accent.primary}
                                        maximumTrackTintColor={colors.background.elevated}
                                        thumbTintColor={colors.accent.primary}
                                    />

                                    {/* Time Labels */}
                                    <View className="flex-row justify-between">
                                        <Text className="text-sm text-neutral-400">
                                            {formatTime(videoPosition)}
                                        </Text>
                                        <Text className="text-sm text-neutral-400">
                                            {videoDuration > 0 ? formatTime(videoDuration) : "--:--"}
                                        </Text>
                                    </View>
                                </View>

                                {/* Repeat Button */}
                                <View className="mb-4 flex-row items-center justify-center">
                                    <Pressable
                                        onPress={toggleRepeat}
                                        className="flex-row items-center gap-2 px-4 py-2 rounded-full bg-neutral-800"
                                        accessibilityRole="button"
                                        accessibilityLabel={
                                            isRepeatEnabled ? "Repeat enabled" : "Repeat disabled"
                                        }
                                    >
                                        <Ionicons
                                            name="repeat"
                                            size={20}
                                            color={
                                                isRepeatEnabled
                                                    ? colors.accent.primary
                                                    : colors.text.primary
                                            }
                                        />
                                        <Text
                                            className="text-sm font-medium"
                                            style={{
                                                color: isRepeatEnabled
                                                    ? colors.accent.primary
                                                    : colors.text.primary,
                                            }}
                                        >
                                            Repeat
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </SafeAreaView>
        </>
    );
}
