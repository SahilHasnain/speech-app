import EmptyState from "@/components/EmptyState";
import SpeechCard from "@/components/SpeechCard";
import { config, databases } from "@/config/appwrite";
import { colors } from "@/constants/theme";
import { useHeaderVisibility } from "@/contexts/HeaderVisibilityContext.animated";
import { useTabBarVisibility } from "@/contexts/TabBarVisibilityContext.animated";
import { storageService } from "@/services/storage";
import { Speech } from "@/types";
import { useFocusEffect } from "@react-navigation/native";
import { Query } from "appwrite";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    View,
} from "react-native";

export default function HomeScreen() {
    const router = useRouter();
    const [speeches, setSpeeches] = useState<Speech[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const { handleScroll: handleTabBarScroll, showTabBar } = useTabBarVisibility();
    const { handleScroll: handleHeaderScroll, showHeader } = useHeaderVisibility();

    const fetchSpeeches = async () => {
        try {
            const response = await databases.listDocuments(
                config.databaseId,
                config.speechesCollectionId,
                [
                    Query.orderDesc("uploadDate"),
                    Query.limit(100),
                ]
            );

            setSpeeches(response.documents as unknown as Speech[]);
        } catch (error) {
            console.error("Error fetching speeches:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSpeeches();
    }, []);

    // Force tab bar and header to show when this screen is focused
    useFocusEffect(
        useCallback(() => {
            showTabBar();
            showHeader();
        }, [showTabBar, showHeader]),
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchSpeeches();
        setRefreshing(false);
    };

    const handleScroll = (event: any) => {
        handleTabBarScroll(event);
        handleHeaderScroll(event);
    };

    const handleSpeechPress = async (speechId: string) => {
        const speech = speeches.find((s) => s.$id === speechId);
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
                />
            );
        },
        [speeches],
    );

    const renderEmptyState = () => {
        if (loading && speeches.length === 0) {
            return (
                <View className="items-center justify-center flex-1 py-20">
                    <ActivityIndicator size="large" color={colors.accent.secondary} />
                </View>
            );
        }
        if (speeches.length === 0) {
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
                    data={speeches}
                    renderItem={renderSpeechCard}
                    keyExtractor={(item) => item.$id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        flexGrow: 1,
                        paddingTop: 100,
                        paddingBottom: 120,
                    }}
                    ListEmptyComponent={renderEmptyState}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
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
        </View>
    );
}
