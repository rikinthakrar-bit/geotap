// app/(tabs)/_layout.tsx
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { Tabs, usePathname } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { preloadAllAds } from "@/lib/ads";
import StickyBanner from "../../components/StickyBanner";
import { todayISO } from "../../lib/daily";
import { getDeviceId } from "../../lib/device";
import { updateBadges } from "../../lib/invites";
import { getAllResults } from "../../lib/lbStore";
import { ensureDaily10Reminder } from "../../lib/notifications";

export default function TabsLayout() {
  const [inviteBadge, setInviteBadge] = useState<number | undefined>(undefined);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Preload ads once
  useEffect(() => {
    preloadAllAds();
  }, []);

  // Load the invites badge + set app icon badge
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const deviceId = await getDeviceId();
        const n = await updateBadges(deviceId);
        if (!mounted) return;
        setInviteBadge(n || undefined);
        try {
          await Notifications.setBadgeCountAsync(n || 0);
        } catch {}
      } catch (e) {
        console.warn("Failed to update invite badges", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Keep exactly one 6pm local Daily10 reminder (tomorrow if already played)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getAllResults();
        const playedToday = Array.isArray(all) && all.some(r => r?.date === todayISO());
        if (!cancelled) {
          await ensureDaily10Reminder(playedToday, 18, 0);
        }
      } catch (e) {
        console.warn("ensureDaily10Reminder failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Compute sticky banner offset: above the tab bar, or closer to bottom on /question
  const TAB_BAR_H = 49;
  const offset =
    pathname === "/question"
      ? (insets?.bottom ?? 0) + 2
      : (insets?.bottom ?? 0) + TAB_BAR_H + 4;

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: "#0c1320" },
          tabBarActiveTintColor: "#fff",
          tabBarInactiveTintColor: "#9aa",
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="challenge/index"
          options={{
            title: "Challenge",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="flag-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="friends/index"
          options={{
            title: "My Friends",
            tabBarBadge: inviteBadge,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: "My Stats",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />
        {/* Hidden under Tabs but not a visible tab button */}
        <Tabs.Screen name="summary" options={{ href: null, title: "Summary" }} />
        <Tabs.Screen name="archive/index" options={{ href: null }} />
        <Tabs.Screen name="archive/[date]" options={{ href: null }} />
        <Tabs.Screen
          name="practice/index"
          options={{ title: "Practice", href: null }}
        />
      </Tabs>

      {/* Sticky banner overlays content; offset keeps it above the tab bar */}
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <StickyBanner bottomOffset={offset} />
      </View>
    </>
  );
}