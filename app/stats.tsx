import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function StatsScreen() {
  const stats = [
    { icon: "repeat-outline", label: "Plays", value: "10", tint: "#3B82F6" },
    { icon: "navigate-outline", label: "Average Score", value: "650 km", tint: "#10B981" },
    { icon: "trophy-outline", label: "Best Score", value: "80 km", tint: "#F59E0B" },
    { icon: "flame-outline", label: "Longest Streak", value: "7 days", tint: "#EF4444" },
  ];

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Your Daily 10 Stats</Text>

        <View style={styles.grid}>
          {stats.map((s) => (
            <View key={s.label} style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: s.tint + "33" }]}>
                <Ionicons name={s.icon as any} size={26} color={s.tint} />
              </View>
              <Text style={styles.value}>{s.value}</Text>
              <Text style={styles.label}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0c1320" },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  heading: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12, // replaces gap above grid
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 12, // vertical spacing between rows (replaces gap)
  },
  iconWrap: {
    borderRadius: 32,
    padding: 8,
    marginBottom: 10,
  },
  value: { color: "#fff", fontSize: 20, fontWeight: "800" },
  label: { color: "#9aa", fontSize: 13, marginTop: 4 },
});