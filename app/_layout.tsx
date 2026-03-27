import { AnimatedHeader } from "@/components/AnimatedHeader";
import { AnimatedTabBar } from "@/components/AnimatedTabBar";
import { colors } from "@/constants/theme";
import { FilterModalProvider, useFilterModal } from "@/contexts/FilterModalContext";
import { SearchProvider, useSearch as useSearchContext } from "@/contexts/SearchContext";
import {
  HeaderVisibilityProvider,
  useHeaderVisibility,
} from "@/contexts/HeaderVisibilityContext.animated";
import {
  TabBarVisibilityProvider,
  useTabBarVisibility,
} from "@/contexts/TabBarVisibilityContext.animated";
import { SortOption } from "@/hooks/useSpeeches";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Tabs, useRouter, useSegments } from "expo-router";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSharedValue } from "react-native-reanimated";
import {
  SafeAreaProvider,
} from "react-native-safe-area-context";
import "../global.css";

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const { translateY } = useTabBarVisibility();
  const { translateY: headerTranslateY } = useHeaderVisibility();
  const { setShowFilterModal } = useFilterModal();
  const isScrolledDownValue = useSharedValue(false);
  const {
    isSearchActive,
    activateSearch,
    deactivateSearch,
    searchInput,
    setSearchInput,
    submitSearch,
  } = useSearchContext();

  // Track selected sort for header indicator
  const [selectedSort, setSelectedSort] = useState<SortOption>("forYou");

  // Check if user is on video screen
  const isOnVideoScreen = segments[0] === "video";

  // Check if user is on home screen
  const isOnHomeScreen = segments[0] === "home";

  return (
    <>
      {/* Animated Header - Global across all screens except video */}
      {!isOnVideoScreen && (
        <AnimatedHeader
          translateY={headerTranslateY}
          isScrolledDown={isScrolledDownValue}
          selectedSort={selectedSort}
          onFilterPress={() => setShowFilterModal(true)}
          onSearchPress={() => {
            activateSearch();
            if (!isOnHomeScreen) {
              router.push("/home");
            }
          }}
          disableFilter={!isOnHomeScreen || isSearchActive}
          isSearchActive={isSearchActive}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onSearchSubmit={() => submitSearch(searchInput)}
          onSearchClose={deactivateSearch}
        />
      )}

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent.secondary,
          tabBarInactiveTintColor: colors.text.secondary,
        }}
        tabBar={(props) => <AnimatedTabBar {...props} translateY={translateY} />}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={24}
                color={color}
              />
            ),
          }}
          initialParams={{ setSelectedSort }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: "History",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "list" : "list-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="downloads"
          options={{
            title: "Downloads",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "cloud-download" : "cloud-download-outline"}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="video"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <SearchProvider>
            <FilterModalProvider>
              <HeaderVisibilityProvider headerHeight={100}>
                <TabBarVisibilityProvider tabBarHeight={68}>
                  <RootLayoutContent />
                </TabBarVisibilityProvider>
              </HeaderVisibilityProvider>
            </FilterModalProvider>
          </SearchProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
