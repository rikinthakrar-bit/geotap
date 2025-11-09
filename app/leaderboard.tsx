import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { trackEvent } from "../lib/analytics";
import { todayISO } from "../lib/daily";
import { getLeaderboard } from "../lib/lbStore";
import { fetchProfiles, getOrCreateProfile, syncProfileToCloud } from "../lib/profile";

// Countdown helpers: Europe/London next 05:00 local time
function getLondonParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month), // 1..12
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

// Build a Date based on Europe/London "wall clock" values, interpreting them in UTC.
// Since we use the same construction for 'now' and 'target', the difference in ms is correct.
function londonDateAsUTC(year: number, month1: number, day: number, hour = 0, minute = 0, second = 0) {
  return new Date(`${String(year).padStart(4, "0")}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}Z`);
}

function nextLondonReset(): Date {
  const now = new Date();
  const p = getLondonParts(now);
  const today0500 = londonDateAsUTC(p.year, p.month, p.day, 5, 0, 0);
  const nowAsLondonUTC = londonDateAsUTC(p.year, p.month, p.day, p.hour, p.minute, p.second);
  if (nowAsLondonUTC >= today0500) {
    // tomorrow 05:00
    const tomorrow = new Date(londonDateAsUTC(p.year, p.month, p.day, 12, 0, 0)); // noon as safe base
    // add 1 day
    const tYear = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric" }).format(new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)));
    const tMonth = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "2-digit" }).format(new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)));
    const tDay = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "2-digit" }).format(new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)));
    return londonDateAsUTC(tYear, tMonth, tDay, 5, 0, 0);
  }
  return today0500;
}

function fmtHMS(ms: number) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

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

  useEffect(() => {
    trackEvent("screen_view", { screen: "leaderboard", dateISO, isToday });
  }, [dateISO]);

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

  const [countdown, setCountdown] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      trackEvent("leaderboard_loaded", { dateISO, total: (lb as any)?.length || 0 });

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

  useEffect(() => {
    function tick() {
      try {
        const target = nextLondonReset();
        const now = new Date();
        const parts = getLondonParts(now);
        const nowAsLondonUTC = londonDateAsUTC(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
        const ms = target.getTime() - nowAsLondonUTC.getTime();
        setCountdown(fmtHMS(ms));
      } catch {
        // noop
      }
    }
    tick();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle,
          headerBackTitle: "Back",
          headerTintColor: "#fff",
          headerStyle: { backgroundColor: "#0c1320" },
          contentStyle: { backgroundColor: "#0c1320" },
          headerRight: () => (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: "#93c5fd", fontSize: 11 }}>Next round in</Text>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 0.5 }}>
                {countdown || "—:—:—"}
              </Text>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, backgroundColor: "#0c1320", flexGrow: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ color: "#9aa", fontSize: 13 }}>
            {total > 0 ? `${start + 1}–${Math.min(end, total)} of ${total}` : "0 of 0"}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Text
              onPress={() => {
                setPage(p => Math.max(0, p - 1));
                trackEvent("tap_leaderboard_page_prev", { page });
              }}
              style={{ color: clampedPage > 0 ? "#cbd5e1" : "#475569", fontSize: 14 }}
            >
              ◀ Prev
            </Text>
            <Text
              onPress={() => {
                setPage(p => Math.min(totalPages - 1, p + 1));
                trackEvent("tap_leaderboard_page_next", { page });
              }}
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