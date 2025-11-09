// app/(tabs)/practice/index.tsx
import { trackEvent } from "@/lib/analytics";
import { router } from "expo-router";
import { useEffect } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#0c1320";

const ITEMS: Array<{ label: string; topic: string; tint: string }> = [
  { label: "Countries",       topic: "countries",      tint: "#1F6FEB" },
  { label: "Capital Cities",  topic: "capitals",       tint: "#22C55E" },
  { label: "Cities",          topic: "cities",         tint: "#F59E0B" },
  { label: "US States",       topic: "states",         tint: "#EF4444" },
  { label: "Flags",           topic: "flags",          tint: "#8B5CF6" },
  { label: "Europe",          topic: "region_europe",  tint: "#0EA5E9" },
  { label: "Asia",            topic: "region_asia",    tint: "#06B6D4" },
  { label: "Africa",          topic: "region_africa",  tint: "#10B981" },
  { label: "Americas",        topic: "region_americas",tint: "#EAB308" },
  { label: "Oceania",         topic: "region_oceania", tint: "#A855F7" },
];

export default function PracticeScreenTabs() {
  useEffect(() => {
    try {
      trackEvent("screen_view", { screen: "practice_index" });
    } catch {}
  }, []);
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 14 }}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 8 }}>
          Practice questions
        </Text>
        <Text style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: 8 }}>
          Sharpen your skills with quick 10-question drills. Pick a topic and we’ll load a focused set instantly.
        </Text>

        <View style={{ height: 2, backgroundColor: "#1b293f", opacity: 0.6, marginVertical: 6 }} />

        {ITEMS.map((item) => (
          <TouchableOpacity
            key={item.topic}
            onPress={() => {
              try {
                trackEvent("tap_practice_topic", { surface: "practice", topic: item.topic, label: item.label });
              } catch {}
              router.push({ pathname: "/question", params: { mode: "practice", topic: item.topic, count: "10" } } as const);
            }}
            style={{ backgroundColor: item.tint, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, alignItems: "center" }}
            activeOpacity={0.9}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>{item.label}</Text>
            <Text style={{ color: "#fff", opacity: 0.9, marginTop: 2 }}>10 questions</Text>
          </TouchableOpacity>
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
