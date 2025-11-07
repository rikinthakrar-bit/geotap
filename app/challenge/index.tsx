// app/challenge/index.tsx
import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import challengeDef from "../../assets/challenge.json";

export default function ChallengeHome() {
  const levels: Array<{ id: number; difficulty: string; advanceMaxKm: number; numQuestions?: number }> =
    (challengeDef as any)?.levels ?? [];

  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const km = (n: number) => (n ?? 0).toLocaleString();

  return (
    <View style={{ flex: 1, backgroundColor: "#0c1320", padding: 24, justifyContent: "center" }}>
      {/* Heading */}
      <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: 24, marginTop: 70 }}>
        6-Round Challenge
      </Text>

      {/* Description */}
      <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, textAlign: "center", marginBottom: 30 }}>
        Test your geography skills through six rounds of increasing difficulty. Each round introduces a new challenge — reach the target distance to progress!
      </Text>

      {/* CTA */}
      <TouchableOpacity
        onPress={() => router.push({ pathname: "/challenge/intro", params: { level: "1" } } as const)}
        style={{ backgroundColor: "#1f6feb", paddingVertical: 16, borderRadius: 14, alignItems: "center", width: "100%" }}
      >
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>Start Challenge</Text>
      </TouchableOpacity>

      {/* Footer note */}
      <Text style={{ color: "#8aa1bf", fontSize: 12, marginTop: 20, textAlign: "center" }}>
        Your progress saves automatically after each round.
      </Text>
    </View>
  );
}