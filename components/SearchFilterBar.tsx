import { colors } from "@/constants/theme";
import type { DurationOption, Channel } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import Pressable from "./ResponsivePressable";

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

interface SearchFilterBarProps {
    channels: Channel[];
    selectedChannelId: string | null;
    onChannelChange: (channelId: string | null) => void;
    selectedDuration: DurationOption;
    onDurationChange: (duration: DurationOption) => void;
}

export function SearchFilterBar({
    channels,
    selectedChannelId,
    onChannelChange,
    selectedDuration,
    onDurationChange,
}: SearchFilterBarProps) {
    const sortedChannels = [...channels].sort((a, b) => a.name.localeCompare(b.name));

    return (
        <View style={{ backgroundColor: colors.background.primary }}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                }}
            >
                <Pressable
                    onPress={() => onChannelChange(null)}
                    className="mr-2 px-3 py-1.5 rounded-full flex-row items-center"
                    style={{
                        backgroundColor:
                            selectedChannelId === null
                                ? colors.accent.secondary
                                : colors.background.tertiary,
                    }}
                >
                    <Ionicons
                        name="globe"
                        size={14}
                        color={selectedChannelId === null ? colors.text.primary : "#d4d4d8"}
                    />
                    <Text
                        className="font-medium text-xs ml-1.5"
                        style={{
                            color:
                                selectedChannelId === null ? colors.text.primary : "#d4d4d8",
                        }}
                    >
                        All
                    </Text>
                </Pressable>

                {sortedChannels.map((channel) => (
                    <Pressable
                        key={channel.youtubeChannelId}
                        onPress={() => onChannelChange(channel.youtubeChannelId)}
                        className="mr-2 px-3 py-1.5 rounded-full flex-row items-center"
                        style={{
                            backgroundColor:
                                selectedChannelId === channel.youtubeChannelId
                                    ? colors.accent.secondary
                                    : colors.background.tertiary,
                        }}
                    >
                        <Text
                            className="font-medium text-xs"
                            numberOfLines={1}
                            style={{
                                color:
                                    selectedChannelId === channel.youtubeChannelId
                                        ? colors.text.primary
                                        : "#d4d4d8",
                            }}
                        >
                            {channel.name}
                        </Text>
                    </Pressable>
                ))}

                <View
                    style={{
                        width: 1,
                        backgroundColor: colors.background.tertiary,
                        marginHorizontal: 6,
                    }}
                />

                {durationFilters.map((filter) => (
                    <Pressable
                        key={filter.value}
                        onPress={() => onDurationChange(filter.value)}
                        className="mr-2 px-3 py-1.5 rounded-full flex-row items-center"
                        style={{
                            backgroundColor:
                                selectedDuration === filter.value
                                    ? colors.accent.secondary
                                    : colors.background.tertiary,
                        }}
                    >
                        <Ionicons
                            name={filter.iconName}
                            size={14}
                            color={
                                selectedDuration === filter.value
                                    ? colors.text.primary
                                    : "#d4d4d8"
                            }
                        />
                        <Text
                            className="font-medium text-xs ml-1.5"
                            style={{
                                color:
                                    selectedDuration === filter.value
                                        ? colors.text.primary
                                        : "#d4d4d8",
                            }}
                        >
                            {filter.label}
                        </Text>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}
