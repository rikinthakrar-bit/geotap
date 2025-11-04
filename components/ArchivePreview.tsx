// components/ArchivePreview.tsx
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { getRecentResults } from "../lib/lbStore";

export default function ArchivePreview() {
  const [rows, setRows] = useState<{ date: string; totalKm: number }[] | null>(null);

  useEffect(() => {
    (async () => setRows(await getRecentResults(7)))();
  }, []);

  if (!rows) {
    return (
      <View style={{ backgroundColor:"#0b1220", borderRadius:16, borderWidth:1, borderColor:"#1f2937", padding:16 }}>
        <Text style={{ color:"#fff", fontSize:18, fontWeight:"800", marginBottom:8 }}>Archive</Text>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor:"#0b1220", borderRadius:16, borderWidth:1, borderColor:"#1f2937", overflow:"hidden" }}>
      <View style={{ padding:16, paddingBottom:8 }}>
        <Text style={{ color:"#fff", fontSize:18, fontWeight:"800" }}>Archive</Text>
        <Text style={{ color:"#9aa", marginTop:4, fontSize:12 }}>Your recent Daily 10 results</Text>
      </View>

      <View style={{ paddingHorizontal:16, paddingBottom:12 }}>
        {rows.length === 0 ? (
          <Text style={{ color:"#9aa", paddingVertical:8 }}>No games yet. Play today’s Daily 10!</Text>
        ) : (
          rows.map(r => (
            <View key={r.date} style={{ paddingVertical:8, borderBottomColor:"#1f2937", borderBottomWidth:1 }}>
              <Text style={{ color:"#fff" }}>{r.date}</Text>
              <Text style={{ color:"#9aa", marginTop:2 }}>{r.totalKm.toLocaleString()} km</Text>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity
        onPress={() => router.push("/archive")}
        activeOpacity={0.85}
        style={{ backgroundColor:"#334155", paddingVertical:12, alignItems:"center" }}
      >
        <Text style={{ color:"#fff", fontWeight:"800" }}>Open Archive</Text>
      </TouchableOpacity>
    </View>
  );
}