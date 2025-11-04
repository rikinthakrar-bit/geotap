// app/challenge/index.tsx
import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function ChallengeHome() {
  return (
    <View style={{ flex:1, backgroundColor:"#0c1320", alignItems:"center", justifyContent:"center", gap:16 }}>
      <Text style={{ color:"#fff", fontSize:24, fontWeight:"700" }}>6-Round Challenge</Text>

      <TouchableOpacity
        onPress={() => router.push({ pathname: "/challenge/intro", params: { level: "1" } } as const)}
        style={{ backgroundColor:"#1f6feb", paddingHorizontal:18, paddingVertical:14, borderRadius:12 }}
      >
        <Text style={{ color:"#fff", fontSize:18 }}>Start Challenge</Text>
      </TouchableOpacity>

      <Text style={{ color:"rgba(255,255,255,0.8)", fontSize:12, textAlign:"center", marginTop:6 }}>
        Complete 6 levels of increasing difficulty.  
        Miss the target distance and you’ll restart the round.
      </Text>
    </View>
  );
}