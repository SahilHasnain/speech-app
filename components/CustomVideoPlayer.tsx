import Pressable from "@/components/ResponsivePressable";
import { colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { VideoPlayer, VideoSource, VideoView, useVideoPlayer } from "expo-video";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface CustomVideoPlayerProps {
  videoUrl: string;
  title?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  onLoad?: (duration: number) => void;
  onEnd?: () => void;
  onReadyForDisplay?: () => void;
  onError?: (error: string) => void;
  initialPosition?: number;
}

const CONTROL_HIDE_DELAY_MS = 2500;

const formatTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export const CustomVideoPlayer = React.forwardRef<
  VideoPlayer,
  CustomVideoPlayerProps
>(
  (
    {
      videoUrl,
      title,
      onTimeUpdate,
      onPlayingChange,
      onLoad,
      onEnd,
      onReadyForDisplay,
      onError,
      initialPosition = 0,
    },
    ref
  ) => {
    const [controlsVisible, setControlsVisible] = React.useState(true);
    const [isLoading, setIsLoading] = React.useState(true);
    const [hasError, setHasError] = React.useState(false);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [duration, setDuration] = React.useState(0);
    const [position, setPosition] = React.useState(0);
    const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const startedAtInitialPositionRef = React.useRef(false);

    const source = React.useMemo<VideoSource>(
      () => ({
        uri: videoUrl,
        useCaching: true,
        metadata: title ? { title } : undefined,
      }),
      [title, videoUrl]
    );

    const player = useVideoPlayer(source, (instance) => {
      instance.timeUpdateEventInterval = 0.25;
      instance.staysActiveInBackground = false;
      instance.showNowPlayingNotification = false;
    });

    React.useImperativeHandle(ref, () => player, [player]);

    const clearHideTimer = React.useCallback(() => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }, []);

    const revealControlsTemporarily = React.useCallback(() => {
      setControlsVisible(true);
      clearHideTimer();
      if (player.playing) {
        hideTimerRef.current = setTimeout(() => {
          setControlsVisible(false);
        }, CONTROL_HIDE_DELAY_MS);
      }
    }, [clearHideTimer, player]);

    React.useEffect(() => {
      setIsLoading(true);
      setHasError(false);
      setControlsVisible(true);
      startedAtInitialPositionRef.current = false;
    }, [videoUrl]);

    React.useEffect(() => {
      const statusSubscription = player.addListener("statusChange", ({ status, error }) => {
        if (status === "readyToPlay") {
          setIsLoading(false);
          const nextDuration = Number.isFinite(player.duration) ? player.duration : 0;
          if (nextDuration > 0) {
            setDuration(nextDuration);
            onLoad?.(nextDuration);
          }
          if (!startedAtInitialPositionRef.current && initialPosition > 0) {
            player.currentTime = initialPosition;
          }
          startedAtInitialPositionRef.current = true;
          onReadyForDisplay?.();
          player.play();
        } else if (status === "loading") {
          setIsLoading(true);
        } else if (status === "error") {
          setIsLoading(false);
          setHasError(true);
          onError?.(error?.message || "Unable to load video.");
        }
      });

      const playingSubscription = player.addListener("playingChange", ({ isPlaying: nextIsPlaying }) => {
        setIsPlaying(nextIsPlaying);
        onPlayingChange?.(nextIsPlaying);
        if (nextIsPlaying) {
          revealControlsTemporarily();
        } else {
          clearHideTimer();
          setControlsVisible(true);
        }
      });

      const timeSubscription = player.addListener("timeUpdate", ({ currentTime }) => {
        const nextDuration = Number.isFinite(player.duration) ? player.duration : 0;
        setPosition(currentTime);
        if (nextDuration > 0 && nextDuration !== duration) {
          setDuration(nextDuration);
          onLoad?.(nextDuration);
        }
        onTimeUpdate?.(currentTime, nextDuration);
      });

      const endSubscription = player.addListener("playToEnd", () => {
        setControlsVisible(true);
        onEnd?.();
      });

      return () => {
        statusSubscription.remove();
        playingSubscription.remove();
        timeSubscription.remove();
        endSubscription.remove();
      };
    }, [
      clearHideTimer,
      duration,
      initialPosition,
      onEnd,
      onError,
      onLoad,
      onPlayingChange,
      onReadyForDisplay,
      onTimeUpdate,
      player,
      revealControlsTemporarily,
    ]);

    React.useEffect(() => {
      return () => {
        clearHideTimer();
      };
    }, [clearHideTimer]);

    const handleToggleControls = React.useCallback(() => {
      if (controlsVisible) {
        clearHideTimer();
        setControlsVisible(false);
      } else {
        revealControlsTemporarily();
      }
    }, [clearHideTimer, controlsVisible, revealControlsTemporarily]);

    const togglePlayback = React.useCallback(() => {
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
      revealControlsTemporarily();
    }, [player, revealControlsTemporarily]);

    const seekTo = React.useCallback(
      (nextTime: number) => {
        const boundedTime = Math.min(Math.max(nextTime, 0), duration || nextTime);
        player.currentTime = boundedTime;
        setPosition(boundedTime);
        onTimeUpdate?.(boundedTime, duration);
        revealControlsTemporarily();
      },
      [duration, onTimeUpdate, player, revealControlsTemporarily]
    );

    const seekBy = React.useCallback(
      (delta: number) => {
        seekTo(position + delta);
      },
      [position, seekTo]
    );

    return (
      <Pressable style={styles.container} onPress={handleToggleControls}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls={false}
          contentFit="contain"
          fullscreenOptions={{ enable: true, orientation: "landscape" }}
          useExoShutter={false}
          onFirstFrameRender={() => {
            setIsLoading(false);
            onReadyForDisplay?.();
          }}
        />

        {controlsVisible && !hasError ? (
          <View pointerEvents="box-none" style={styles.overlay}>
            <View style={styles.topOverlay}>
              <Text numberOfLines={1} style={styles.title}>
                {title || "Video"}
              </Text>
            </View>

            <View style={styles.centerControls}>
              <Pressable
                onPress={() => seekBy(-10)}
                style={styles.secondaryButton}
                accessibilityRole="button"
                accessibilityLabel="Seek back 10 seconds"
              >
                <Ionicons name="play-back" size={22} color={colors.text.primary} />
              </Pressable>

              <Pressable
                onPress={togglePlayback}
                style={styles.primaryButton}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? "Pause video" : "Play video"}
              >
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={30}
                  color={colors.text.primary}
                />
              </Pressable>

              <Pressable
                onPress={() => seekBy(10)}
                style={styles.secondaryButton}
                accessibilityRole="button"
                accessibilityLabel="Seek forward 10 seconds"
              >
                <Ionicons name="play-forward" size={22} color={colors.text.primary} />
              </Pressable>
            </View>

            <View style={styles.bottomOverlay}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={Math.max(duration, 0.1)}
                value={Math.min(position, duration || position)}
                onSlidingStart={clearHideTimer}
                onSlidingComplete={seekTo}
                minimumTrackTintColor={colors.accent.primary}
                maximumTrackTintColor="rgba(255,255,255,0.28)"
                thumbTintColor={colors.accent.primary}
              />
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Text style={styles.timeText}>{duration > 0 ? formatTime(duration) : "--:--"}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {isLoading && !hasError ? (
          <View style={styles.loadingContainer} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.text.primary} />
            <Text style={styles.loadingText}>Loading video...</Text>
          </View>
        ) : null}

        {hasError ? (
          <View style={styles.errorContainer} pointerEvents="none">
            <Text style={styles.errorText}>
              Unable to load video. Please check your connection.
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  }
);

CustomVideoPlayer.displayName = "CustomVideoPlayer";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  video: {
    flex: 1,
    backgroundColor: "#000",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  topOverlay: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    color: colors.text.primary,
    fontSize: 15,
    fontWeight: "600",
  },
  centerControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  primaryButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.58)",
  },
  secondaryButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  bottomOverlay: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  slider: {
    width: "100%",
    height: 32,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -2,
  },
  timeText: {
    color: colors.text.primary,
    fontSize: 12,
    fontWeight: "500",
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
  },
});
