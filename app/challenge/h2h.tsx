import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { todayISO } from "../../lib/daily";
import { getDeviceId } from "../../lib/device";
import { fetchProfiles } from "../../lib/profile";
import { fetchRange } from "../../lib/publicResults";

type Row = { date: string; you?: number; friend?: number };

const FRIENDS_KEY = "friends_v1";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

async function removeFriendById(deviceId: string) {
  try {
    // 1) Delete on server (both directions), if Supabase is configured
    if (supabase) {
      const me = await getDeviceId();
      // Remove me → them
      await supabase
        .from("friends")
        .delete()
        .match({ owner_device_id: me, friend_device_id: deviceId });
      // Remove them → me (reciprocal)
      await supabase
        .from("friends")
        .delete()
        .match({ owner_device_id: deviceId, friend_device_id: me });
      // Also clear any pending invites in either direction
      await supabase
        .from("friend_invites")
        .delete()
        .match({ to_device_id: me, from_device_id: deviceId });
      await supabase
        .from("friend_invites")
        .delete()
        .match({ to_device_id: deviceId, from_device_id: me });
    }

    // 2) Update local cache so UI reflects removal immediately
    const raw = (await AsyncStorage.getItem(FRIENDS_KEY)) || "[]";
    const list: Array<{ deviceId: string; name?: string | null; addedAt: string }> = JSON.parse(raw);
    const next = list.filter((f) => f.deviceId !== deviceId);
    await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export default function H2H() {
  const { peer } = useLocalSearchParams<{ peer?: string }>();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendName, setFriendName] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      if (!peer) { setFriendName(null); return; }
      try {
        // 1) Try local friends cache
        const raw = (await AsyncStorage.getItem(FRIENDS_KEY)) || "[]";
        const list: Array<{ deviceId: string; name?: string | null }> = JSON.parse(raw);
        const hit = list.find((f) => f.deviceId === String(peer));
        if (hit?.name) setFriendName(hit.name);
        // 2) Resolve from Supabase profiles
        const map = await fetchProfiles([String(peer)]);
        const resolved = map[String(peer)]?.name;
        if (resolved) setFriendName(resolved);
      } catch {
        // ignore
      }
    })();
  }, [peer]);

  // summary is computed from rows (mutual-play days only)
  const summary = useMemo(() => {
    let you = 0;
    let friend = 0;
    let draws = 0;
    for (const r of rows) {
      if (typeof r.you === "number" && typeof r.friend === "number") {
        if (r.you < r.friend) you += 1;
        else if (r.friend < r.you) friend += 1;
        else draws += 1;
      }
    }
    return { you, friend, draws };
  }, [rows]);

  useEffect(() => {
    (async () => {
      if (!peer) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const youId = await getDeviceId();
        const to = todayISO();
        const from = dayjs(to).subtract(90, "day").format("YYYY-MM-DD");

        // Expecting arrays like [{ date: "2025-10-28", totalKm: 3123 }, ...]
        const [mine, theirs] = await Promise.all([
          fetchRange(youId, from, to),
          fetchRange(String(peer), from, to),
        ]);

        // Index by date
        const mineByDate = new Map<string, number>();
        const theirsByDate = new Map<string, number>();
        mine?.forEach((r: any) => {
          if (r?.date && typeof r?.totalKm === "number") mineByDate.set(r.date, r.totalKm);
        });
        theirs?.forEach((r: any) => {
          if (r?.date && typeof r?.totalKm === "number")
            theirsByDate.set(r.date, r.totalKm);
        });

        // Union of dates (we’ll render all; W-L-D counts only mutual days)
        const allDates = new Set<string>([
          ...Array.from(mineByDate.keys()),
          ...Array.from(theirsByDate.keys()),
        ]);

        const merged: Row[] = Array.from(allDates).map((date) => ({
          date,
          you: mineByDate.get(date),
          friend: theirsByDate.get(date),
        }));

        // Sort newest -> oldest
        merged.sort((a, b) => (a.date < b.date ? 1 : -1));

        setRows(merged);
      } catch (e) {
        // fail safe
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [peer]);

  // UI
  if (!peer) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0c1320", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
          Head-to-Head
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.85)", textAlign: "center" }}>
          No friend selected. Open the friend link or add a friend to view H2H results.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0c1320", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ color: "#fff", marginTop: 8 }}>Loading head-to-head…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0c1320" }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>Head-to-Head</Text>
        <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
          Record (mutual play only):{" "}
          <Text style={{ fontWeight: "700" }}>
            You {summary.you} – {summary.friend} {friendName || "Friend"}
          </Text>
          {summary.draws ? ` (${summary.draws} draw${summary.draws === 1 ? "" : "s"})` : ""}
        </Text>
      </View>

      {/* Table */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* Header row */}
        <View style={{ flexDirection: "row", paddingVertical: 8, borderBottomColor: "rgba(255,255,255,0.15)", borderBottomWidth: 1 }}>
          <Text style={{ color: "rgba(255,255,255,0.85)", width: 90 }}>Date</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", flex: 1, textAlign: "right" }}>You</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", width: 16, textAlign: "center" }}>–</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", flex: 1 }}>{friendName || "Friend"}</Text>
        </View>

        {rows.length === 0 ? (
          <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 12 }}>
            No results in the last 90 days.
          </Text>
        ) : (
          rows.map((r) => {
            const youPlayed = typeof r.you === "number";
            const friendPlayed = typeof r.friend === "number";
            const both = youPlayed && friendPlayed;

            // Colour winner when both played
            let youStyle: { color: string } = { color: "#fff" };
            let friendStyle: { color: string } = { color: "#fff" };
            if (both) {
            if (r.you! < r.friend!) youStyle = { color: "#6ee7b7" }; // green-ish
            else if (r.friend! < r.you!) friendStyle = { color: "#6ee7b7" };
        }

            return (
              <View
                key={r.date}
                style={{
                  flexDirection: "row",
                  paddingVertical: 10,
                  borderBottomColor: "rgba(255,255,255,0.08)",
                  borderBottomWidth: 1,
                }}
              >
                <Text style={{ color: "#fff", width: 90 }}>
                  {dayjs(r.date).format("DD MMM")}
                </Text>
                <Text style={[{ flex: 1, textAlign: "right" }, youStyle]}>
                  {youPlayed ? `${r.you!.toLocaleString()} km` : "—"}
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.6)", width: 16, textAlign: "center" }}>–</Text>
                <Text style={[{ flex: 1 }, friendStyle]}>
                  {friendPlayed ? `${r.friend!.toLocaleString()} km` : "—"}
                </Text>
              </View>
            );
          })
        )}

        <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 12, fontSize: 12 }}>
          Note: Only days where both players have a score count toward the record.
        </Text>
        {/* Danger zone */}
        <View style={{ marginTop: 24, borderTopColor: "rgba(255,255,255,0.15)", borderTopWidth: 1, paddingTop: 16 }}>
          <TouchableOpacity
            onPress={() => {
              if (!peer) return;
              Alert.alert(
                "Remove friend?",
                `Are you sure you want to remove this friend? You will no longer see ${(friendName || String(peer).slice(0, 6))}’s scores or head-to-head record. You can add them again later.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                      const ok = await removeFriendById(String(peer));
                      if (ok) {
                        router.back();
                      } else {
                        Alert.alert("Error", "Couldn't remove this friend. Please try again.");
                      }
                    },
                  },
                ]
              );
            }}
            style={{
              backgroundColor: "#7f1d1d",
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>Remove Friend</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}