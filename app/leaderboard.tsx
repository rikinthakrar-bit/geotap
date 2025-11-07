import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { todayISO } from "../lib/daily";
import { getLeaderboard } from "../lib/lbStore";
import { fetchProfiles, getOrCreateProfile, syncProfileToCloud } from "../lib/profile";

export default function Leaderboard() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const dateISO = (typeof date === "string" && date) ? date : todayISO();

  const isToday = dateISO === todayISO();
  function formatPrettyDate(iso: string) {
    try {
      const d = new Date(iso + "T00:00:00Z");
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return iso; }
  }
  const headerTitle = isToday ? "Today's Leaderboard" : `${formatPrettyDate(dateISO)} Leaderboard`;

  const [rows, setRows] = useState<Array<{
    device_id?: string;
    id?: string;
    totalKm?: number;        // camelCase when coming from lbStore
    total_km?: number;       // snake_case when coming from SQL view
    ts?: number;
    date_iso?: string;
    display_name?: string;
    color?: string;
  }>>([]);
  const [nameMap, setNameMap] = useState<Record<string, { name: string; color?: string }>>({});
  const [myId, setMyId] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const pageSize = 20;

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(0, page), totalPages - 1);
  const start = clampedPage * pageSize;
  const end = start + pageSize;

  const myIndex = rows.findIndex((r) => resolveDeviceId(r) === myId);
  const showMyRowExtra = myId && myIndex >= 0 && !(myIndex >= start && myIndex < end);
  const visibleRows = rows.slice(start, end);

  function resolveDeviceId(row: any): string | undefined {
    if (!row) return undefined;
    return (
      row.device_id ||
      row.deviceId ||
      row.user_id ||
      row.userId ||
      row.profile_id ||
      row.profileId ||
      row.id ||
      undefined
    );
  }

  useEffect(() => {
    (async () => {
      // Ensure our own profile is present/up-to-date in Supabase so names resolve
      try { await syncProfileToCloud(); } catch {}

      const lb = await getLeaderboard(dateISO);
      setRows(lb as any);

      // Collect device IDs from rows (supports either `device_id` or `id`)
      const ids = Array.from(new Set((lb as any[])
        .map(r => resolveDeviceId(r))
        .filter(Boolean))) as string[];

      // Always include our own device so we can at least show a local name as fallback
      try {
        const me = await getOrCreateProfile();
        if (me?.id) {
          setMyId(me.id);
          if (!ids.includes(me.id)) ids.push(me.id);
        }

        // Fetch names from Supabase
        const fetched = ids.length ? await fetchProfiles(ids as string[]) : {};

        // Merge cloud names with a local fallback for "me"
        const merged = {
          ...(me?.id ? { [me.id]: { name: me.displayName, color: me.color } } : {}),
          ...(fetched as any),
        } as Record<string, { name: string; color?: string }>;

        setNameMap(merged);
      } catch {
        // ignore; keep whatever map we have
      }
    })();
  }, [dateISO]);

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle,
          headerBackTitle: "Back",
          headerTintColor: "#fff",
          headerStyle: { backgroundColor: "#0c1320" },
          contentStyle: { backgroundColor: "#0c1320" },
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, backgroundColor: "#0c1320", flexGrow: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ color: "#9aa", fontSize: 13 }}>
            {total > 0 ? `${start + 1}–${Math.min(end, total)} of ${total}` : "0 of 0"}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Text
              onPress={() => setPage(p => Math.max(0, p - 1))}
              style={{ color: clampedPage > 0 ? "#cbd5e1" : "#475569", fontSize: 14 }}
            >
              ◀ Prev
            </Text>
            <Text
              onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              style={{ color: clampedPage < totalPages - 1 ? "#cbd5e1" : "#475569", fontSize: 14 }}
            >
              Next ▶
            </Text>
          </View>
        </View>
        {rows.length === 0 ? (
          <Text style={{ color: "#9aa" }}>No entries yet.</Text>
        ) : (
          visibleRows.map((r, i) => {
            const idx = start + i;
            const deviceId = resolveDeviceId(r) || String(idx);
            const displayName = (r as any).display_name || nameMap[deviceId]?.name || "Player";
            const kmValue = (typeof (r as any).totalKm === 'number') ? (r as any).totalKm : Number((r as any).total_km ?? 0);
            const tint = (r as any).color || nameMap[deviceId]?.color || "#64748b";
            const isMe = !!myId && deviceId === myId;
            return (
              <View
                key={deviceId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: isMe ? "#10223a" : "#0f1a2b",
                  borderWidth: 1,
                  borderColor: isMe ? "#234f7a" : "#1b293f",
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: "#9aa", fontSize: 16, width: 32, textAlign: "right" }}>{idx + 1}.</Text>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: isMe ? "700" : "400" }}>
                    {displayName}
                  </Text>
                </View>
                <Text style={{ color: "#e5e7eb", fontSize: 16, fontWeight: "700" }}>
                  {kmValue.toLocaleString()} km
                </Text>
              </View>
            );
          })
        )}
        {showMyRowExtra ? (() => {
          const r = rows[myIndex]!;
          const deviceId = resolveDeviceId(r) || String(myIndex);
          const displayName = (r as any).display_name || nameMap[deviceId]?.name || "Player";
          const kmValue = (typeof (r as any).totalKm === 'number') ? (r as any).totalKm : Number((r as any).total_km ?? 0);
          const tint = (r as any).color || nameMap[deviceId]?.color || "#64748b";
          const idx = myIndex;
          return (
            <>
              <View style={{ height: 6 }} />
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 12,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: "#10223a",
                borderWidth: 1,
                borderColor: "#234f7a",
                marginBottom: 8,
              }}>
                <Text style={{ color: "#9aa", fontSize: 16, width: 32, textAlign: "right" }}>{idx + 1}.</Text>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 8 }}>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>{displayName} (you)</Text>
                </View>
                <Text style={{ color: "#e5e7eb", fontSize: 16, fontWeight: "700" }}>{kmValue.toLocaleString()} km</Text>
              </View>
            </>
          );
        })() : null}
      </ScrollView>
    </>
  );
}