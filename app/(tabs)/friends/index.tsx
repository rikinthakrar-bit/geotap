// app/(tabs)/friends/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";

import { fetchProfiles } from "../../../lib/profile";
import { shareFriendLink } from "../../../lib/shareFriendLink";

type Friend = { deviceId: string; name?: string | null; addedAt: string };
const KEY = "friends_v1";

export default function FriendsHome() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [names, setNames] = useState<Record<string, { name: string; color: string }>>({});

  const load = useCallback(async () => {
    try {
      const raw = (await AsyncStorage.getItem(KEY)) || "[]";
      const list: Friend[] = JSON.parse(raw);
      setFriends(list);

      const ids = list.map(f => f.deviceId).filter(Boolean);
      if (ids.length === 0) {
        setNames({});
        return;
      }
      const map = await fetchProfiles(ids); // { [deviceId]: { name, color } }
      setNames(map || {});
    } catch {
      setNames({});
    }
  }, []);

  // Load once on mount
  useEffect(() => {
    load();
  }, [load]);

  // Reload whenever the tab/screen regains focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#0c1320", padding: 16 }}>
      {/* Invite CTA stays at the top */}
      <TouchableOpacity
        onPress={shareFriendLink}
        style={{ backgroundColor: "#1f6feb", padding: 14, borderRadius: 12, marginBottom: 16 }}
      >
        <Text style={{ color: "#fff", fontSize: 16, textAlign: "center" }}>
          Invite a Friend
        </Text>
      </TouchableOpacity>

      <FlatList
        data={friends}
        keyExtractor={(f) => f.deviceId}
        renderItem={({ item }) => {
          const fallback = item.name ?? "Friend";
          const resolved = names[item.deviceId]?.name ?? fallback;
          const tint = names[item.deviceId]?.color ?? "#444";

          return (
            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: "/challenge/h2h", params: { peer: item.deviceId } } as const)
              }
              style={{ paddingVertical: 12, borderBottomColor: "#223", borderBottomWidth: 1 }}
            >
              <Text style={{ color: "#fff", fontSize: 16 }}>
                <Text style={{ color: tint }}>● </Text>
                {resolved}
              </Text>
              <Text style={{ color: "#9aa" }}>{item.deviceId.slice(0, 8)}…</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: "#9aa", textAlign: "center", marginTop: 20 }}>
            No friends yet. Send your invite link to get started.
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}