import { colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Text, View } from "react-native";
import Animated, {
    SharedValue,
    useAnimatedStyle,
} from "react-native-reanimated";
import Pressable from "./ResponsivePressable";

interface AnimatedHeaderProps {
    translateY: SharedValue<number>;
    isScrolledDown: SharedValue<boolean>;
}

export function AnimatedHeader({
    translateY,
    isScrolledDown,
}: AnimatedHeaderProps) {
    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    return (
        <Animated.View
            style={[animatedStyle]}
            className="absolute top-0 left-0 right-0 z-50"
        >
            <View
                className="px-4 pt-safe-top pb-1"
                style={{ backgroundColor: colors.background.primary }}
            >
                <View className="flex-row items-center justify-between mb-3">
                    {/* Logo */}
                    <View className="flex-row items-center gap-2">
                        <View
                            className="rounded-full overflow-hidden"
                            style={{ width: 32, height: 32 }}
                        >
                            <Image
                                source={require("@/assets/images/android-icon-foreground.png")}
                                style={{ width: 32, height: 32 }}
                                contentFit="cover"
                            />
                        </View>
                        <Text
                            className="text-lg font-semibold"
                            style={{ color: colors.text.primary }}
                        >
                            Islamic Speeches
                        </Text>
                    </View>

                    {/* Action Icons */}
                    <View className="flex-row items-center gap-4">
                        {/* Search - Placeholder for future */}
                        <Pressable
                            onPress={() => { }}
                            accessibilityLabel="Search"
                            accessibilityRole="button"
                            style={{ opacity: 0.3 }}
                            disabled
                        >
                            <Ionicons name="search" size={24} color={colors.text.primary} />
                        </Pressable>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
}
