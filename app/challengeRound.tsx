// app/challengeRound.tsx
import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function ChallengeRound() {
  const { level } = useLocalSearchParams<{ level?: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: "#0c1320", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "white", fontSize: 22 }}>
        Round {level ?? "?"} — coming soon
      </Text>
    </View>
  );
}