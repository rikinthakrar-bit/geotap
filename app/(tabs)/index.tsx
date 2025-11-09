import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, usePathname, type Href } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GameCard from "../../components/GameCard";
import { trackEvent, trackScreen } from "../../lib/analytics";
import { todayISO } from "../../lib/daily";
import { getAllResults } from "../../lib/lbStore";
import { syncProfileToCloud } from "../../lib/profile";
import { peekDisplayName } from "../../lib/profileName";

function hashString(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
function colorFromName(name: string) {
  const hue = hashString(name) % 360;
  return `hsl(${hue}, 70%, 55%)`;
}
function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "🙂";
}

export default function HomeScreen() {
  const [displayName, setDisplayName] = useState<string>("");
  const [playedToday, setPlayedToday] = useState(false);
  const didGuardRef = useRef(false);
  const pathname = usePathname();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          // 1) Check for an existing name without generating one
          const found = await peekDisplayName();
          const haveName = Boolean(found && found.trim());
          if (alive && haveName) setDisplayName(found!.trim());

          // 2) First‑run name guard (session‑scoped): only once, skip if already on modal
          if (!didGuardRef.current) {
            if (String(pathname || "").includes("/modal")) {
              didGuardRef.current = true;
            } else {
              const editing = await AsyncStorage.getItem("profile.editingName");
              if (alive && !editing && !haveName) {
                didGuardRef.current = true;
                trackEvent("first_run_missing_name", { surface: "home" });
                router.push("/modal" as Href);
                return; // avoid generating a default name in this pass
              } else {
                didGuardRef.current = true; // evaluated once per session
              }
            }
          }
        } catch {}

        try {
          const all = await getAllResults();
          if (alive) setPlayedToday(all.some((r) => r.date === todayISO()));
        } catch {}

        // Optional, non-blocking profile sync
        syncProfileToCloud().catch(() => {});
      })();
      return () => {
        alive = false;
      };
    }, [pathname])
  );

  React.useEffect(() => {
    trackScreen("Home");
    trackEvent("home_view");
  }, []);

  const avatarColor = colorFromName(displayName || "Player");
  const avatarText = initialsFromName(displayName || "Player");

  const imgArchive = require("../../assets/home-archive.png");

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: "#0c1320" }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 0,
          paddingBottom: 10, // extra room for future sticky ad
          gap: 16,
        }}
      >
        {/* Greeting */}
        <View style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: avatarColor,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
                {avatarText}
              </Text>
            </View>
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>
              👋 Hello, {displayName || "…"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                trackEvent("tap_edit_name", { surface: "home" });
                router.push("/modal");
              }}
            >
              <Text style={{ color: "#ccc", fontSize: 18 }}>✏️</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: "#9aa", marginTop: 6, fontSize: 12 }}>
            This name appears on leaderboards and friend challenges.
          </Text>
        </View>

        {/* Cards — make Daily and Challenge “tall”, Friends shorter */}
        <GameCard
          title="Daily 10"
          description="Play today’s 10-question world quiz"
          image={require("../../assets/home-daily.png")}
          imageHeight={200}
          tint="#1F6FEB"
          cta={playedToday ? "View Today’s Summary" : "Play Daily 10"}
          onPress={() => {
            // CTA click is tracked here; actual "start" is tracked inside questions screen when a run begins
            trackEvent("tap_daily10", { surface: "home", playedToday });
            if (playedToday) {
              router.replace(`/(tabs)/summary?date=${todayISO()}`);
            } else {
              router.push("/question");
            }
          }}
          played={playedToday}
        />

        {/* Grid: 2 x 2 below the full-width Daily card */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {/* Challenge */}
          <View style={{ width: "49%", height: 220, marginBottom: 16, overflow: "hidden" }}>
            <GameCard
              title="6-Round Challenge"
              description="Beat the target each round"
              image={require("../../assets/home-challenge.png")}
              imageHeight={90}
              tint="#22C55E"
              cta="Play Challenge"
              onPress={() => {
                trackEvent("tap_challenge", { surface: "home" });
                router.push("/(tabs)/challenge");
              }}
              compact
            />
          </View>

          {/* Practice */}
          <View style={{ width: "49%", height: 220, marginBottom: 16, overflow: "hidden" }}>
            <GameCard
              title="Practice rounds"
              description="Improve your world knowledge!"
              image={require("../../assets/practice.png")} // TODO: replace with a practice-specific image when added
              imageHeight={90}
              tint="#0EA5E9"
              cta="Open Practice"
              onPress={() => {
                trackEvent("tap_practice", { surface: "home" });
                router.push("/(tabs)/practice" as Href);
              }}
              compact
            />
          </View>

          {/* Archived (centered on its row) */}
          <View style={{ width: "100%", marginBottom: 16, alignItems: "center" }}>
            <View style={{ width: "49%", height: 220, overflow: "hidden" }}>
              <GameCard
                title="Archived Daily 10s"
                description="Play previous days contests"
                image={imgArchive}
                imageHeight={90}
                tint="#8B5CF6"
                cta="Open Archive"
                onPress={() => {
                  trackEvent("tap_archive", { surface: "home" });
                  router.push("/archive");
                }}
                compact
              />
            </View>
          </View>
        </View>
        {/* Optional sticky ad spacer */}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
