import EmptyState from "@/components/EmptyState";
import { SearchSuggestions } from "@/components/SearchSuggestions";
import SpeechCard from "@/components/SpeechCard";
import UnifiedFilterBar from "@/components/UnifiedFilterBar";
import { colors } from "@/constants/theme";
import { useHeaderVisibility } from "@/contexts/HeaderVisibilityContext.animated";
import { useSearch as useSearchContext } from "@/contexts/SearchContext";
import { useTabBarVisibility } from "@/contexts/TabBarVisibilityContext.animated";
import { useHomeFilters } from "@/hooks/useHomeFilters";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { getAllSpeechesWithProgress, VideoProgress } from "@/services/progressTracking";
import { storageService } from "@/services/storage";
import { Speech } from "@/types";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    BackHandler,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function HomeScreen() {
    const router = useRouter();
    const flatListRef = useRef<FlatList>(null);
    const [progressData, setProgressData] = useState<Record<string, VideoProgress>>({});

    // Contexts
    const {
        isSearchActive,
        deactivateSearch,
        searchInput,
        setSearchInput,
        activeSearchQuery,
        setActiveSearchQuery,
        submitSearch,
    } = useSearchContext();
    const { handleScroll: handleTabBarScroll, showTabBar } = useTabBarVisibility();
    const { handleScroll: handleHeaderScroll, showHeader } = useHeaderVisibility();

    // Custom hooks
    const filters = useHomeFilters();
    const { setQuery, isShowingSearchResults } = filters;

    // Search suggestions
    const { suggestions, updateSuggestions, addToHistory } = useSearchSuggestions({
        speeches: filters.speeches,
        maxSuggestions: 10,
    });

    const showSuggestionsOverlay = isSearchActive && !activeSearchQuery;

    // --- Search orchestration effects ---

    useEffect(() => {
        if (isSearchActive) updateSuggestions(searchInput);
    }, [searchInput, isSearchActive, updateSuggestions]);

    useEffect(() => {
        if (activeSearchQuery && searchInput !== activeSearchQuery) {
            setActiveSearchQuery("");
        }
    }, [searchInput, activeSearchQuery, setActiveSearchQuery]);

    useEffect(() => {
        if (activeSearchQuery) {
            setQuery(activeSearchQuery);
            addToHistory(activeSearchQuery);
        } else {
            setQuery("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSearchQuery]);

    useEffect(() => {
        if (!isSearchActive) {
            setQuery("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isSearchActive]);

    useEffect(() => {
        if (isSearchActive) showHeader();
    }, [isSearchActive, showHeader]);

    useEffect(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [isShowingSearchResults]);

    useFocusEffect(
        useCallback(() => {
            showHeader();
        }, [showHeader])
    );

    // Force tab bar to show when this screen is focused
    useFocusEffect(
        useCallback(() => {
            showTabBar();
        }, [showTabBar])
    );

    // Load progress data when screen is focused
    useFocusEffect(
        useCallback(() => {
            const loadProgress = async () => {
                const progress = await getAllSpeechesWithProgress();
                setProgressData(progress);
            };
            loadProgress();
        }, [])
    );

    // Android back button
    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            if (isSearchActive) {
                deactivateSearch();
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, [isSearchActive, deactivateSearch]);

    const handleRefresh = async () => {
        await Promise.all([filters.refresh(), filters.refreshChannels()]);
    };

    const handleScroll = (event: any) => {
        handleTabBarScroll(event);
        if (!isSearchActive) handleHeaderScroll(event);
    };

    const handleSpeechPress = async (speechId: string) => {
        const speech = filters.displayData.find((s) => s.$id === speechId);
        if (!speech) return;

        // Track watch history
        await storageService.addToWatchHistory(speech.$id);

        router.push({
            pathname: "/video",
            params: {
                videoUrl: `https://www.youtube.com/watch?v=${speech.youtubeId}`,
                title: speech.title,
                channelName: speech.channelName,
                thumbnailUrl: speech.thumbnailUrl,
                youtubeId: speech.youtubeId,
                speechId: speech.$id,
            },
        });
    };

    const renderSpeechCard = React.useCallback(
        ({ item }: { item: Speech }) => {
            const progress = progressData[item.$id];
            const progressPercentage = progress ? progress.percentage : undefined;

            return (
                <SpeechCard
                    id={item.$id}
                    title={item.title}
                    thumbnail={item.thumbnailUrl}
                    duration={item.duration}
                    uploadDate={item.uploadDate}
                    channelName={item.channelName}
                    views={item.views}
                    onPress={() => handleSpeechPress(item.$id)}
                    progressPercentage={progressPercentage}
                />
            );
        },
        [filters.displayData, progressData]
    );

    const renderFooter = () => {
        if (!filters.loading || filters.isShowingSearchResults || filters.displayData.length === 0) {
            return null;
        }
        return (
            <View className="py-6">
                <ActivityIndicator size="small" color={colors.accent.secondary} />
            </View>
        );
    };

    const renderEmptyState = () => {
        if (filters.isLoading && filters.displayData.length === 0) {
            return (
                <View className="items-center justify-center flex-1 py-20">
                    <ActivityIndicator size="large" color={colors.accent.secondary} />
                    <Text className="mt-4 text-base text-neutral-400">
                        {filters.isShowingSearchResults ? "Searching..." : "Loading speeches..."}
                    </Text>
                </View>
            );
        }
        if (filters.error && filters.displayData.length === 0) {
            return (
                <EmptyState
                    message="Unable to connect. Please check your internet connection."
                    iconName="alert-circle"
                    actionLabel="Retry"
                    onAction={handleRefresh}
                />
            );
        }
        if (filters.isShowingSearchResults && filters.displayData.length === 0) {
            return (
                <EmptyState
                    message="No speeches found matching your search."
                    iconName="search"
                />
            );
        }
        if (filters.displayData.length === 0) {
            return (
                <EmptyState
                    message="No speeches available yet. Check back soon!"
                    iconName="mic"
                />
            );
        }
        return null;
    };

    return (
        <View
            className="flex-1"
            style={{ backgroundColor: colors.background.primary }}
        >
            <LinearGradient
                pointerEvents="none"
                colors={[
                    "rgba(0, 0, 0, 0.52)",
                    "rgba(6, 10, 20, 0.3)",
                    "rgba(0, 0, 0, 0.12)",
                    "rgba(0, 0, 0, 0.4)",
                ]}
                locations={[0, 0.2, 0.56, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <View className="flex-1">
                <FlatList
                    ref={flatListRef}
                    data={filters.displayData}
                    renderItem={renderSpeechCard}
                    keyExtractor={(item) => item.$id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        flexGrow: 1,
                        paddingTop: 100,
                        paddingBottom: 120,
                    }}
                    ListHeaderComponent={
                        !isSearchActive ? (
                            <>
                                <UnifiedFilterBar
                                    selectedSort={filters.selectedFilter}
                                    onSortChange={filters.setSelectedFilter}
                                    channels={filters.channels}
                                    selectedChannelId={filters.selectedChannelId}
                                    onChannelChange={filters.setSelectedChannelId}
                                    channelsLoading={filters.channelsLoading}
                                    selectedDuration={filters.selectedDuration}
                                    onDurationChange={filters.setSelectedDuration}
                                    hideChips={!filters.hasActiveHomeFilters}
                                    externalOpen={filters.showFilterModal}
                                    onExternalClose={() => filters.setShowFilterModal(false)}
                                />
                                {filters.hasActiveHomeFilters && (
                                    <View style={{ height: 12 }} />
                                )}
                            </>
                        ) : null
                    }
                    ListEmptyComponent={renderEmptyState}
                    ListFooterComponent={renderFooter}
                    onEndReached={() => {
                        if (!filters.isShowingSearchResults && filters.hasMore && !filters.loading) {
                            filters.loadMore();
                        }
                    }}
                    onEndReachedThreshold={1.5}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    refreshControl={
                        <RefreshControl
                            refreshing={false}
                            onRefresh={handleRefresh}
                            colors={[colors.accent.secondary]}
                            tintColor={colors.accent.secondary}
                        />
                    }
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    initialNumToRender={10}
                />
            </View>

            {showSuggestionsOverlay && (
                <View
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        paddingTop: 100,
                        backgroundColor: colors.background.primary,
                        zIndex: 40,
                    }}
                >
                    <LinearGradient
                        pointerEvents="none"
                        colors={[
                            "rgba(0, 0, 0, 0.42)",
                            colors.background.primary,
                            colors.background.primary,
                        ]}
                        locations={[0, 0.16, 1]}
                        style={StyleSheet.absoluteFill}
                    />
                    <SearchSuggestions
                        suggestions={suggestions}
                        onSuggestionPress={(s) => {
                            setSearchInput(s.text);
                            submitSearch(s.text);
                        }}
                        onSuggestionInsert={(s) => setSearchInput(s.text)}
                    />
                </View>
            )}
        </View>
    );
}
