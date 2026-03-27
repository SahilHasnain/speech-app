import { colors } from "@/constants/theme";
import { SortOption } from "@/hooks/useSpeeches";
import { Channel, DurationOption } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Pressable from "./ResponsivePressable";

interface UnifiedFilterBarProps {
    selectedSort: SortOption;
    onSortChange: (sort: SortOption) => void;
    channels: Channel[];
    selectedChannelId: string | null;
    onChannelChange: (channelId: string | null) => void;
    channelsLoading?: boolean;
    selectedDuration: DurationOption;
    onDurationChange: (duration: DurationOption) => void;
    hideChips?: boolean;
    externalOpen?: boolean;
    onExternalClose?: () => void;
}

const UnifiedFilterBar: React.FC<UnifiedFilterBarProps> = ({
    selectedSort,
    onSortChange,
    channels,
    selectedChannelId,
    onChannelChange,
    channelsLoading = false,
    selectedDuration,
    onDurationChange,
    hideChips = false,
    externalOpen = false,
    onExternalClose,
}) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const [activeTab, setActiveTab] = useState<"sort" | "channel" | "duration">("sort");
    const [isChannelsExpanded, setIsChannelsExpanded] = useState(false);
    const snapPoints = useMemo(() => ["55%"], []);

    // Open sheet when external trigger fires
    React.useEffect(() => {
        if (externalOpen) {
            bottomSheetRef.current?.present();
        }
    }, [externalOpen]);

    const openSheet = useCallback(
        (tab: "sort" | "channel" | "duration") => {
            setActiveTab(tab);
            bottomSheetRef.current?.present();
        },
        []
    );

    const handleClose = useCallback(() => {
        bottomSheetRef.current?.dismiss();
        onExternalClose?.();
    }, [onExternalClose]);

    const handleDismiss = useCallback(() => {
        onExternalClose?.();
    }, [onExternalClose]);

    const renderBackdrop = useCallback(
        (props: any) => (
            <BottomSheetBackdrop
                {...props}
                disappearsOnIndex={-1}
                appearsOnIndex={0}
                opacity={0.5}
            />
        ),
        []
    );

    // --- Filter data ---

    const sortFilters: {
        value: SortOption;
        label: string;
        iconName: keyof typeof Ionicons.glyphMap;
    }[] = [
            { value: "forYou", label: "For You", iconName: "sparkles" },
            { value: "latest", label: "Latest", iconName: "time" },
            { value: "popular", label: "Popular", iconName: "flame" },
            { value: "oldest", label: "Oldest", iconName: "calendar" },
        ];

    const durationFilters: {
        value: DurationOption;
        label: string;
        iconName: keyof typeof Ionicons.glyphMap;
    }[] = [
            { value: "all", label: "All", iconName: "infinite" },
            { value: "short", label: "< 5 min", iconName: "flash" },
            { value: "medium", label: "5-15 min", iconName: "hourglass" },
            { value: "long", label: "> 15 min", iconName: "film" },
        ];

    const sortedChannels = [...channels].sort((a, b) => a.name.localeCompare(b.name));

    const channelOptions: {
        id: string | null;
        name: string;
        iconName: keyof typeof Ionicons.glyphMap;
    }[] = [
            { id: null, name: "All", iconName: "globe" },
            ...sortedChannels.map((ch) => ({
                id: ch.$id,
                name: ch.name,
                iconName: "tv" as keyof typeof Ionicons.glyphMap,
            })),
        ];

    const currentSort = sortFilters.find((f) => f.value === selectedSort);
    const currentChannel =
        channelOptions.find((c) => c.id === selectedChannelId) || channelOptions[0];
    const currentDuration = durationFilters.find((f) => f.value === selectedDuration);
    const hasActiveFilters =
        selectedSort !== "forYou" || selectedChannelId !== null || selectedDuration !== "all";

    return (
        <>
            {/* Compact Filter Chips */}
            {!hideChips && (
                <View style={{ backgroundColor: colors.background.primary }}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                        }}
                    >
                        {/* Sort Chip */}
                        <Pressable
                            onPress={() => openSheet("sort")}
                            className="mr-3 px-4 py-2.5 rounded-full flex-row items-center"
                            style={{
                                backgroundColor:
                                    selectedSort !== "forYou"
                                        ? colors.accent.secondary
                                        : colors.background.tertiary,
                                minHeight: 44,
                            }}
                        >
                            <Ionicons
                                name={currentSort?.iconName || "sparkles"}
                                size={16}
                                color={
                                    selectedSort !== "forYou" ? colors.text.primary : "#d4d4d8"
                                }
                            />
                            <Text
                                className="font-semibold text-sm ml-2"
                                style={{
                                    color:
                                        selectedSort !== "forYou" ? colors.text.primary : "#d4d4d8",
                                }}
                            >
                                {currentSort?.label}
                            </Text>
                        </Pressable>

                        {/* Channel Chip */}
                        <Pressable
                            onPress={() => openSheet("channel")}
                            className="mr-3 px-4 py-2.5 rounded-full flex-row items-center"
                            style={{
                                backgroundColor: selectedChannelId
                                    ? colors.accent.secondary
                                    : colors.background.tertiary,
                                minHeight: 44,
                            }}
                        >
                            <Ionicons
                                name={currentChannel?.iconName || "globe"}
                                size={16}
                                color={selectedChannelId ? colors.text.primary : "#d4d4d8"}
                            />
                            <Text
                                className="font-semibold text-sm ml-2"
                                style={{
                                    color: selectedChannelId ? colors.text.primary : "#d4d4d8",
                                }}
                            >
                                {currentChannel?.name}
                            </Text>
                        </Pressable>

                        {/* Duration Chip */}
                        <Pressable
                            onPress={() => openSheet("duration")}
                            className="mr-3 px-4 py-2.5 rounded-full flex-row items-center"
                            style={{
                                backgroundColor:
                                    selectedDuration !== "all"
                                        ? colors.accent.secondary
                                        : colors.background.tertiary,
                                minHeight: 44,
                            }}
                        >
                            <Ionicons
                                name={currentDuration?.iconName || "infinite"}
                                size={16}
                                color={selectedDuration !== "all" ? colors.text.primary : "#d4d4d8"}
                            />
                            <Text
                                className="font-semibold text-sm ml-2"
                                style={{
                                    color:
                                        selectedDuration !== "all" ? colors.text.primary : "#d4d4d8",
                                }}
                            >
                                {currentDuration?.label}
                            </Text>
                        </Pressable>

                        {/* Clear */}
                        {hasActiveFilters && (
                            <Pressable
                                onPress={() => {
                                    onSortChange("forYou");
                                    onChannelChange(null);
                                    onDurationChange("all");
                                }}
                                className="px-4 py-2.5 rounded-full flex-row items-center"
                                style={{
                                    backgroundColor: colors.background.secondary,
                                    minHeight: 44,
                                }}
                            >
                                <Ionicons name="close-circle" size={16} color="#d4d4d8" />
                                <Text className="font-semibold text-sm text-neutral-300 ml-2">
                                    Clear
                                </Text>
                            </Pressable>
                        )}
                    </ScrollView>
                </View>
            )}

            {/* Bottom Sheet Modal */}
            <BottomSheetModal
                ref={bottomSheetRef}
                snapPoints={snapPoints}
                enablePanDownToClose
                onDismiss={handleDismiss}
                backdropComponent={renderBackdrop}
                handleIndicatorStyle={{ backgroundColor: colors.text.tertiary }}
                backgroundStyle={{ backgroundColor: colors.background.secondary }}
            >
                <SafeAreaView edges={["bottom"]} className="flex-1">
                    {/* Sheet Header */}
                    <View
                        className="flex-row items-center justify-between px-6 py-3 border-b"
                        style={{ borderBottomColor: colors.border.secondary }}
                    >
                        <Text
                            className="text-xl font-bold"
                            style={{ color: colors.text.primary }}
                        >
                            Filters
                        </Text>
                        <Pressable
                            onPress={handleClose}
                            style={{
                                minHeight: 44,
                                minWidth: 44,
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            <Ionicons
                                name="close"
                                size={24}
                                color={colors.text.secondary}
                            />
                        </Pressable>
                    </View>

                    {/* Tabs */}
                    <View
                        className="flex-row border-b"
                        style={{ borderBottomColor: colors.border.secondary }}
                    >
                        {(["sort", "channel", "duration"] as const).map((tab) => (
                            <Pressable
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                className={`flex-1 py-4 ${activeTab === tab ? "border-b-2 border-blue-500" : ""
                                    }`}
                                style={{ minHeight: 44 }}
                            >
                                <Text
                                    className={`text-center font-semibold text-base ${activeTab === tab ? "text-blue-500" : "text-neutral-400"
                                        }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Content */}
                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        {activeTab === "sort" && (
                            <View className="p-4">
                                {sortFilters.map((filter) => {
                                    const isSelected = selectedSort === filter.value;
                                    return (
                                        <Pressable
                                            key={filter.value}
                                            onPress={() => {
                                                onSortChange(filter.value);
                                                handleClose();
                                            }}
                                            className="flex-row items-center p-4 rounded-xl mb-2"
                                            style={{
                                                backgroundColor: isSelected
                                                    ? colors.accent.secondary
                                                    : colors.background.tertiary,
                                                minHeight: 56,
                                            }}
                                        >
                                            <Ionicons
                                                name={filter.iconName}
                                                size={22}
                                                color={colors.text.primary}
                                            />
                                            <Text
                                                className="flex-1 font-semibold text-base ml-3"
                                                style={{
                                                    color: isSelected ? colors.text.primary : "#d4d4d4",
                                                }}
                                            >
                                                {filter.label}
                                            </Text>
                                            {isSelected && (
                                                <Ionicons
                                                    name="checkmark-circle"
                                                    size={22}
                                                    color={colors.text.primary}
                                                />
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}

                        {activeTab === "channel" && (
                            <View className="p-4">
                                {/* All Channels Option */}
                                <Pressable
                                    key="all"
                                    onPress={() => {
                                        onChannelChange(null);
                                        handleClose();
                                    }}
                                    disabled={channelsLoading}
                                    className="flex-row items-center p-4 rounded-xl mb-2"
                                    style={{
                                        backgroundColor: selectedChannelId === null
                                            ? colors.accent.secondary
                                            : colors.background.tertiary,
                                        minHeight: 56,
                                    }}
                                >
                                    <Ionicons
                                        name="globe"
                                        size={22}
                                        color={colors.text.primary}
                                    />
                                    <Text
                                        className="flex-1 font-semibold text-base ml-3"
                                        style={{
                                            color: selectedChannelId === null
                                                ? colors.text.primary
                                                : "#d4d4d4",
                                        }}
                                    >
                                        All
                                    </Text>
                                    {selectedChannelId === null && (
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={22}
                                            color={colors.text.primary}
                                        />
                                    )}
                                </Pressable>

                                {/* First 3 Channels (always visible) */}
                                {channelOptions.slice(1, 4).map((option) => {
                                    const isSelected = selectedChannelId === option.id;
                                    return (
                                        <Pressable
                                            key={option.id || "all"}
                                            onPress={() => {
                                                onChannelChange(option.id);
                                                handleClose();
                                            }}
                                            disabled={channelsLoading}
                                            className="flex-row items-center p-4 rounded-xl mb-2"
                                            style={{
                                                backgroundColor: isSelected
                                                    ? colors.accent.secondary
                                                    : colors.background.tertiary,
                                                minHeight: 56,
                                            }}
                                        >
                                            <Ionicons
                                                name={option.iconName}
                                                size={22}
                                                color={colors.text.primary}
                                            />
                                            <Text
                                                className="flex-1 font-semibold text-base ml-3"
                                                style={{
                                                    color: isSelected
                                                        ? colors.text.primary
                                                        : "#d4d4d4",
                                                }}
                                            >
                                                {option.name}
                                            </Text>
                                            {isSelected && (
                                                <Ionicons
                                                    name="checkmark-circle"
                                                    size={22}
                                                    color={colors.text.primary}
                                                />
                                            )}
                                        </Pressable>
                                    );
                                })}

                                {/* Show More/Less Button (only if more than 3 channels) */}
                                {channelOptions.length > 4 && (
                                    <Pressable
                                        onPress={() => setIsChannelsExpanded(!isChannelsExpanded)}
                                        className="flex-row items-center justify-center p-4 rounded-xl mb-2"
                                        style={{
                                            backgroundColor: colors.background.tertiary,
                                            minHeight: 56,
                                        }}
                                    >
                                        <Text
                                            className="font-semibold text-base mr-2"
                                            style={{ color: colors.text.secondary }}
                                        >
                                            {isChannelsExpanded
                                                ? "Show Less"
                                                : `Show ${channelOptions.length - 4} More`}
                                        </Text>
                                        <Ionicons
                                            name={isChannelsExpanded ? "chevron-up" : "chevron-down"}
                                            size={22}
                                            color={colors.text.secondary}
                                        />
                                    </Pressable>
                                )}

                                {/* Remaining Channels (collapsible) */}
                                {isChannelsExpanded && channelOptions.slice(4).map((option) => {
                                    const isSelected = selectedChannelId === option.id;
                                    return (
                                        <Pressable
                                            key={option.id || "all"}
                                            onPress={() => {
                                                onChannelChange(option.id);
                                                handleClose();
                                            }}
                                            disabled={channelsLoading}
                                            className="flex-row items-center p-4 rounded-xl mb-2"
                                            style={{
                                                backgroundColor: isSelected
                                                    ? colors.accent.secondary
                                                    : colors.background.tertiary,
                                                minHeight: 56,
                                            }}
                                        >
                                            <Ionicons
                                                name={option.iconName}
                                                size={22}
                                                color={colors.text.primary}
                                            />
                                            <Text
                                                className="flex-1 font-semibold text-base ml-3"
                                                style={{
                                                    color: isSelected
                                                        ? colors.text.primary
                                                        : "#d4d4d4",
                                                }}
                                            >
                                                {option.name}
                                            </Text>
                                            {isSelected && (
                                                <Ionicons
                                                    name="checkmark-circle"
                                                    size={22}
                                                    color={colors.text.primary}
                                                />
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}

                        {activeTab === "duration" && (
                            <View className="p-4">
                                {durationFilters.map((filter) => {
                                    const isSelected = selectedDuration === filter.value;
                                    return (
                                        <Pressable
                                            key={filter.value}
                                            onPress={() => {
                                                onDurationChange(filter.value);
                                                handleClose();
                                            }}
                                            className="flex-row items-center p-4 rounded-xl mb-2"
                                            style={{
                                                backgroundColor: isSelected
                                                    ? colors.accent.secondary
                                                    : colors.background.tertiary,
                                                minHeight: 56,
                                            }}
                                        >
                                            <Ionicons
                                                name={filter.iconName}
                                                size={22}
                                                color={colors.text.primary}
                                            />
                                            <Text
                                                className="flex-1 font-semibold text-base ml-3"
                                                style={{
                                                    color: isSelected ? colors.text.primary : "#d4d4d4",
                                                }}
                                            >
                                                {filter.label}
                                            </Text>
                                            {isSelected && (
                                                <Ionicons
                                                    name="checkmark-circle"
                                                    size={22}
                                                    color={colors.text.primary}
                                                />
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
                    </BottomSheetScrollView>
                </SafeAreaView>
            </BottomSheetModal>
        </>
    );
};

export default UnifiedFilterBar;
