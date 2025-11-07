// app/(tabs)/friends/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { router, useFocusEffect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { todayISO } from "../../lib/daily";
import { getDeviceId } from "../../lib/device";
import { fetchProfiles } from "../../lib/profile";
import { getDisplayName, normalizeDisplayName } from "../../lib/profileName";
import { fetchRange } from "../../lib/publicResults";
import { shareFriendLink } from "../../lib/shareFriendLink";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const KEY = "friends_v1";
type Friend = { deviceId: string; name?: string | null; addedAt: string };

type Invite = { from_device_id: string; from_display_name: string | null };

export default function FriendsTab() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [myToday, setMyToday] = useState<number | null>(null);
  const [handleInput, setHandleInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string>("");

  const [invites, setInvites] = useState<Invite[]>([]);
  const [sentInvites, setSentInvites] = useState<Invite[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, { name: string; color: string }>>({});
  const [recordMap, setRecordMap] = useState<Record<string, { w: number; l: number; d: number }>>({});

  // Load friend list from storage
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) setFriends(JSON.parse(raw));
      fetchFriendsFromServer();
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
        setMyToday(mine[0]?.total_km ?? null);
      }
      setScores(next);
      const ids = friends.map(f => f.deviceId);
      if (ids.length) resolveFriendNames(ids);
    })();
  }, [friends]);

  async function saveFriends(next: Friend[]) {
    setFriends(next);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  }

  async function fetchInvitesForMe() {
    if (!supabase) return;
    const me = await getDeviceId();
    const { data, error } = await supabase
      .from("friend_invites")
      .select("from_device_id, from_display_name")
      .eq("to_device_id", me);
    if (!error && data) {
      setInvites(data as Invite[]);
      try {
        const ids = (data as Invite[]).map((r) => r.from_device_id);
        await resolveFriendNames(ids);
      } catch {}
    }
  }

  async function fetchSentInvitesForMe() {
    if (!supabase) return;
    const me = await getDeviceId();
    const { data, error } = await supabase
      .from("friend_invites")
      .select("to_device_id, from_device_id, from_display_name")
      .eq("from_device_id", me);
    if (!error && data) {
      // Coerce into Invite-like shape but keep to_device_id in a custom field via type cast
      setSentInvites(data as any);
      try {
        const ids = (data as any[]).map((r) => r.to_device_id as string);
        await resolveFriendNames(ids);
      } catch {}
    }
  }

  async function fetchH2HRecords() {
  if (!supabase) return;
  const me = await getDeviceId();
  try {
    const { data, error } = await supabase
      .from("h2h_stats")
      .select("device_a, device_b, a_wins, b_wins, draws")
      .or(`device_a.eq.${me},device_b.eq.${me}`);
    if (error || !data) return;
    const map: Record<string, { w: number; l: number; d: number }> = {};
    for (const r of data as any[]) {
      if (r.device_a === me) {
        map[r.device_b] = { w: r.a_wins ?? 0, l: r.b_wins ?? 0, d: r.draws ?? 0 };
      } else if (r.device_b === me) {
        map[r.device_a] = { w: r.b_wins ?? 0, l: r.a_wins ?? 0, d: r.draws ?? 0 };
      }
    }
    setRecordMap(map);
  } catch {
    // keep prior map
  }
}

  useEffect(() => {
    fetchInvitesForMe();
    fetchSentInvitesForMe();
    fetchH2HRecords(); 
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchInvitesForMe();
      fetchSentInvitesForMe();
      fetchFriendsFromServer();
      fetchH2HRecords();
    }, [])
  );

  async function addFriendByHandle() {
    setAddMsg("");
    const raw = handleInput.trim();
    if (!raw) { setAddMsg("Enter a username"); return; }
    const norm = normalizeDisplayName(raw);
    if (!norm) { setAddMsg("Invalid username"); return; }
    if (!supabase) { setAddMsg("Offline: try again later"); return; }
    try {
      setAdding(true);
      // Look up the profile by normalized handle
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("display_name_norm", norm)
        .limit(1);
      if (error) { setAddMsg("Couldn’t check right now"); return; }
      if (!data || data.length === 0) { setAddMsg("No user found"); return; }
      const row = data[0];
      const deviceId = await getDeviceId();
      if (row.id === deviceId) { setAddMsg("That’s you!"); return; }
      if (friends.some(f => f.deviceId === row.id)) { setAddMsg("Already added"); return; }
      const myName = await getDisplayName();
      const { error: invErr } = await supabase
        .from("friend_invites")
        .upsert({
          to_device_id: row.id,
          from_device_id: deviceId,
          from_display_name: myName,
        }, { onConflict: "to_device_id,from_device_id" });
      if (invErr) { setAddMsg("Couldn’t send invite"); return; }
      setAddMsg("Invite sent ✓");
      setHandleInput("");
    } finally {
      setAdding(false);
    }
  }

  async function acceptInvite(fromDeviceId: string, fromName?: string | null) {
    // 1) Insert friendship server-side (owner = me, friend = fromDeviceId)
    if (supabase) {
      const me = await getDeviceId();
      await supabase
        .from("friends")
        .upsert(
          { owner_device_id: me, friend_device_id: fromDeviceId },
          { onConflict: "owner_device_id,friend_device_id" }
        );
      // also insert reciprocal so inviter sees it immediately
      await supabase
        .from("friends")
        .upsert(
          { owner_device_id: fromDeviceId, friend_device_id: me },
          { onConflict: "owner_device_id,friend_device_id" }
        );
    }

    // 2) Delete invite from Supabase
    if (supabase) {
      const me = await getDeviceId();
      await supabase
        .from("friend_invites")
        .delete()
        .match({ to_device_id: me, from_device_id: fromDeviceId });
    }

    // 3) Update local cache (ensure present)
    if (!friends.some((f) => f.deviceId === fromDeviceId)) {
      const next: Friend[] = [
        { deviceId: fromDeviceId, name: fromName, addedAt: new Date().toISOString() },
        ...friends,
      ];
      await saveFriends(next);
      await resolveFriendNames([fromDeviceId, ...friends.map(f=>f.deviceId)]);
    }

    // 4) Refresh server state
    fetchInvitesForMe();
    fetchFriendsFromServer();
  }
  async function rejectInvite(fromDeviceId: string) {
    if (supabase) {
      const me = await getDeviceId();
      await supabase
        .from("friend_invites")
        .delete()
        .match({ to_device_id: me, from_device_id: fromDeviceId });
    }
    fetchInvitesForMe();
  }

  async function fetchFriendsFromServer() {
    if (!supabase) return;
    const me = await getDeviceId();
    const { data, error } = await supabase
      .from("friends")
      .select("friend_device_id")
      .eq("owner_device_id", me);
    if (error || !data) return;
    const ids = data.map((r: any) => r.friend_device_id as string);
    const next = ids.map((id: string) => ({ deviceId: id, name: null, addedAt: new Date().toISOString() }));
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    setFriends(next);
    if (ids.length) await resolveFriendNames(ids);
  }

  async function resolveFriendNames(ids: string[]) {
    try {
      if (!ids || ids.length === 0) return;
      const unique = Array.from(new Set(ids));
      const map = await fetchProfiles(unique);
      setNameMap((prev) => ({ ...(prev || {}), ...(map || {}) }));
    } catch {
      // keep prior map on error
    }
  }

  const fmt = (n: number | null | undefined) =>
    n == null ? "—" : Math.round(n).toLocaleString();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#0c1320" }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      >
        {/* Page heading */}
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 16 }}>
          👥 My Friends
        </Text>

        {invites.length > 0 && (
          <View style={{ backgroundColor: "#0f1a2b", borderColor: "#23314a", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 8 }}>
              My invites
            </Text>
            {invites.map((inv) => (
              <View key={inv.from_device_id} style={{ paddingVertical: 10, borderTopColor: "#1b293f", borderTopWidth: 1 }}>
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                  {inv.from_display_name || inv.from_device_id.slice(0, 6)}
                </Text>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => acceptInvite(inv.from_device_id, inv.from_display_name)}
                    style={{ backgroundColor: "#22c55e", paddingVertical: 8, borderRadius: 8, alignItems: "center", flex: 1 }}
                  >
                    <Text style={{ color: "#0b1220", fontWeight: "800" }}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => rejectInvite(inv.from_device_id)}
                    style={{ backgroundColor: "#334155", paddingVertical: 8, borderRadius: 8, alignItems: "center", flex: 1 }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {(() => {
          const pendingSent = (sentInvites as any[]).filter((inv: any) => !friends.some((f) => f.deviceId === inv.to_device_id));
          return pendingSent.length > 0 ? (
            <View style={{ backgroundColor: "#0f1a2b", borderColor: "#23314a", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800", marginBottom: 8 }}>
                Sent invites
              </Text>
              {pendingSent.map((inv: any) => (
                <View key={inv.to_device_id} style={{ paddingVertical: 10, borderTopColor: "#1b293f", borderTopWidth: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                    {nameMap[inv.to_device_id]?.name || inv.to_device_id.slice(0, 6)}
                  </Text>
                  <Text style={{ color: "#9aa", fontSize: 12, marginTop: 2 }}>Waiting for acceptance…</Text>
                </View>
              ))}
            </View>
          ) : null;
        })()}

        {/* --- Add by username + Invite --- */}
        <View style={{ gap: 10, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TextInput
              value={handleInput}
              onChangeText={setHandleInput}
              placeholder="Add by username (e.g. johnsmith)"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                flex: 1,
                backgroundColor: "#0f1a2b",
                borderWidth: 1,
                borderColor: "#23314a",
                color: "#fff",
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                fontSize: 16,
              }}
            />
            <TouchableOpacity
              onPress={addFriendByHandle}
              disabled={adding || handleInput.trim().length === 0}
              style={{
                backgroundColor: adding || handleInput.trim().length === 0 ? "#334155" : "#22c55e",
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 14,
              }}
            >
              <Text style={{ color: "#0b1220", fontWeight: "800", fontSize: 15 }}>
                Add Friend
              </Text>
            </TouchableOpacity>
          </View>
          {!!addMsg && (
            <Text style={{ color: addMsg.includes("✓") ? "#22c55e" : "#f87171", fontSize: 12 }}>
              {addMsg}
            </Text>
          )}
          <TouchableOpacity
            onPress={() => shareFriendLink()}
            style={{
              backgroundColor: "#1f6feb",
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
              Send invite via message
            </Text>
          </TouchableOpacity>
        </View>

        {/* --- Friend Matches --- */}
        <View style={{ backgroundColor: "#0f1a2b", borderColor: "#23314a", borderWidth: 1, borderRadius: 12, padding: 12 }}>
          {friends.length === 0 ? (
            <Text style={{ color: "#aaa", textAlign: "center", marginVertical: 20 }}>
              No friends added yet — send an invite to get started!
            </Text>
          ) : (
            friends.map((f) => {
              const friendName = nameMap[f.deviceId]?.name || f.name || f.deviceId.slice(0, 6);
              const friendToday = scores[f.deviceId] ?? null;
              // TODO: wire real W-L record here if/when available
              const recordLeft = ""; // e.g., your wins
              const recordRight = ""; // e.g., friend wins

              return (
                <TouchableOpacity
                  key={f.deviceId}
                  onPress={() => router.push(`/challenge/h2h?peer=${f.deviceId}`)}
                  style={{
                    paddingVertical: 14,
                    borderTopColor: "#1b293f",
                    borderTopWidth: 1,
                  }}
                >
                  {/* Heading row: Me    4 - 3    John */}
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800", flex: 1 }}>
                      Me
                    </Text>
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>
                      {(() => { const rec = recordMap[f.deviceId]; return rec ? `${rec.w} - ${rec.l}` : ""; })()}
                    </Text>
                    <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800", flex: 1, textAlign: "right" }}>
                      {friendName}
                    </Text>
                  </View>

                  {/* Sub row: today 5,000km  -  8,721km */}
                  <View style={{ marginTop: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {/* Left: label */}
                      <Text style={{ color: "#9aa", fontSize: 12, flex: 1 }}>
                        today
                      </Text>
                      {/* Center: my distance, hyphen, opponent distance */}
                      <View style={{ flexDirection: "row", alignItems: "center", marginLeft: -100 }}>
                        <Text style={{ color: "#9aa", fontSize: 12 }}>{fmt(myToday)} km</Text>
                        <Text style={{ color: "#9aa", fontSize: 12, marginHorizontal: 8 }}> - </Text>
                        <Text style={{ color: "#9aa", fontSize: 12 }}>{fmt(friendToday)} km</Text>
                      </View>
                      {/* Right: spacer to keep the center truly centered */}
                      <View style={{ flex: 1 }} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}