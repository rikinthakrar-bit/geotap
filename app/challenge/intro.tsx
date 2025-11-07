import { router, Stack, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { loadChallenge, type LevelRule } from "../../lib/loadChallenge";

const COLORS = {
  bg: "#0c1320",
  card: "#101a2b",
  text: "#ffffff",
  sub: "rgba(255,255,255,0.75)",
  brand: "#1e88e5",
  brandAlt: "#1565c0",
};

export default function ChallengeIntro() {
  const { level } = useLocalSearchParams<{ level?: string }>();
  const currentLevel = Number(level ?? "1");

  const [levels, setLevels] = useState<LevelRule[] | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const rules = await loadChallenge();
      if (mounted) setLevels(rules);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const rule = useMemo(
    () => (levels ?? []).find((l) => l.id === currentLevel) || null,
    [levels, currentLevel]
  );

  if (!rule) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.bg,
          padding: 20,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: COLORS.text, fontSize: 18 }}>Loading round…</Text>
      </View>
    );
  }

  const title = `Round ${rule.id}: ${rule.difficulty.toUpperCase()}`;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Stack.Screen options={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg }, animation: "fade" }} />
      <StatusBar style="light" backgroundColor={COLORS.bg} />
      <View style={{ padding: 20, gap: 16, marginTop: 60 }}>
        <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: "800" }}>{title}</Text>
        <View
          style={{
            backgroundColor: COLORS.card,
            borderRadius: 14,
            padding: 16,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "700" }}>
            Goal: stay under {rule.advanceMaxKm.toLocaleString()} km
          </Text>
          <Text style={{ color: COLORS.sub, marginTop: 8 }}>
            You’ll get {rule.numQuestions} {rule.difficulty} questions. Stay under the target
            distance to advance to the next round.
          </Text>
        </View>

        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/question",
              params: {
                mode: "challenge",
                level: String(rule.id),
                difficulty: rule.difficulty,
                targetKm: String(rule.advanceMaxKm),
                num: String(rule.numQuestions),
              },
            })
          }
          style={{
            backgroundColor: COLORS.brand,
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: "center",
          }}
          activeOpacity={0.9}
        >
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>Start Round</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace("/challenge")}
          style={{
            backgroundColor: COLORS.brandAlt,
            paddingVertical: 12,
            borderRadius: 10,
            alignItems: "center",
          }}
          activeOpacity={0.9}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Back to Challenge Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}