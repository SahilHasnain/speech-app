import EmptyState from "@/components/EmptyState";
import { colors } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

export default function DownloadsScreen() {
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
                <EmptyState
                    message="Downloaded speeches will appear here for offline viewing"
                    iconName="cloud-download-outline"
                />
            </View>
        </View>
    );
}
