import { colors } from "@/constants/theme";
import { SortOption } from "@/hooks/useSpeeches";
import { Ionicons } from "@expo/vector-icons";
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useMemo, useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Pressable from "./ResponsivePressable";

interface UnifiedFilterBarProps {
    selectedSort: SortOption;
    onSortChange: (sort: SortOption) => void;
    hideChips?: boolean;
    externalOpen?: boolean;
    onExternalClose?: () => void;
}

const UnifiedFilterBar: React.FC<UnifiedFilterBarProps> = ({
    selectedSort,
    onSortChange,
    hideChips = false,
    externalOpen = false,
    onExternalClose,
}) => {
    const bottomSheetRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ["40%"], []);

    // Open sheet when external trigger fires
    React.useEffect(() => {
        if (externalOpen) {
            bottomSheetRef.current?.present();
        }
    }, [externalOpen]);

    const openSheet = useCallback(() => {
        bottomSheetRef.current?.present();
    }, []);

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

    const currentSort = sortFilters.find((f) => f.value === selectedSort);
    const hasActiveFilters = selectedSort !== "forYou";

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
                            onPress={openSheet}
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

                        {/* Clear */}
                        {hasActiveFilters && (
                            <Pressable
                                onPress={() => onSortChange("forYou")}
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
                            Sort By
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

                    {/* Content */}
                    <BottomSheetScrollView showsVerticalScrollIndicator={false}>
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
                    </BottomSheetScrollView>
                </SafeAreaView>
            </BottomSheetModal>
        </>
    );
};

export default UnifiedFilterBar;
