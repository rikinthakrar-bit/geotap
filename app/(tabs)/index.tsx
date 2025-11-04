import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GameCard from "../../components/GameCard";
import { todayISO } from "../../lib/daily";
import { getAllResults } from "../../lib/lbStore";
import { syncProfileToCloud } from "../../lib/profile";
import { getDisplayName } from "../../lib/profileName";

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

  useEffect(() => {
    (async () => {
      const name = await getDisplayName();
      setDisplayName(name);
      await syncProfileToCloud().catch(() => {});
    })();
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
          padding: 16,
          paddingBottom: 24,
          paddingTop: 8,
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
            <TouchableOpacity onPress={() => router.push("/modal")}>
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
  cta={playedToday ? "Replay (practice)" : "Play Daily 10"}
  onPress={() => router.push("/question")}
  played={playedToday}
/>

        <GameCard
          title="6-Round Challenge"
          description="Progress through the levels! It get's harder."
          image={require("../../assets/home-challenge.png")}
          imageHeight={200}
          tint="#22C55E"
          cta="Play Challenge"
          onPress={() => router.push("/challenge/intro")}
        />

<GameCard
  title="Archived Daily 10s"
  description="Play previous Daily 10s"
  image={imgArchive}
  imageHeight={130}          // a little shorter to balance the layout
  tint="#8B5CF6"             // violet accent (pick any brand color)
  cta="Open Archived Daily 10s"
  onPress={() => router.push("/archive")}
  compact
/>

        <GameCard
          title="Friends"
          description="Invite a friend and compete on Daily 10"
          image={require("../../assets/home-friends.png")}
          imageHeight={130}
          tint="#F59E0B"
          cta="Play with Friends"
          onPress={() => router.push("/friends")}
          compact
        />

  


        {/* Optional sticky ad spacer */}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const [playedToday, setPlayedToday] = useState(false);
useEffect(() => {
  (async () => {
    const all = await getAllResults();
    setPlayedToday(all.some(r => r.date === todayISO()));
  })();
}, []);
