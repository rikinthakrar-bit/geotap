// app/(tabs)/friends/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";
import { todayISO } from "../../lib/daily";
import { getDeviceId } from "../../lib/device";
import { fetchRange } from "../../lib/publicResults";
import { shareFriendLink } from "../../lib/shareFriendLink";

const KEY = "friends_v1";
type Friend = { deviceId: string; name?: string | null; addedAt: string };

export default function FriendsTab() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [scores, setScores] = useState<Record<string, number | null>>({});

  // Load friend list from storage
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) setFriends(JSON.parse(raw));
    })();
  }, []);

  // Fetch each friend’s latest score
  useEffect(() => {
    (async () => {
      const you = await getDeviceId();
      const date = todayISO();
      const next: Record<string, number | null> = {};

      for (const f of friends) {
        const [mine, theirs] = await Promise.all([
          fetchRange(you, date, date),
          fetchRange(f.deviceId, date, date),
        ]);
        next[f.deviceId] =
          (theirs[0]?.total_km ?? null) !== null ? theirs[0].total_km : null;
      }
      setScores(next);
    })();
  }, [friends]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0c1320" }}
      contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
    >
      {/* --- Invite CTA --- */}
      <TouchableOpacity
        onPress={() => shareFriendLink()}
        style={{
          backgroundColor: "#1f6feb",
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
          Invite a Friend
        </Text>
      </TouchableOpacity>

      {/* --- Friend Matches --- */}
      {friends.length === 0 ? (
        <Text style={{ color: "#aaa", textAlign: "center", marginTop: 40 }}>
          No friends added yet — send an invite to get started!
        </Text>
      ) : (
        friends.map((f) => (
          <TouchableOpacity
            key={f.deviceId}
            onPress={() => router.push(`/challenge/h2h?peer=${f.deviceId}`)}
            style={{
              backgroundColor: "#162235",
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
              {f.name || f.deviceId.slice(0, 6)}
            </Text>
            <Text style={{ color: "#bbb", marginTop: 4 }}>
              Today:{" "}
              {scores[f.deviceId] != null
                ? `${Math.round(scores[f.deviceId]!)} km`
                : "No score yet"}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}