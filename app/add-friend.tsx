// app/add-friend.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

type Friend = { deviceId: string; name?: string | null; addedAt: string };
const KEY = "friends_v1";

export default function AddFriend() {
  const { peer } = useLocalSearchParams<{ peer?: string }>();
  const [status, setStatus] = useState<"idle"|"saving"|"done"|"error">("idle");

  useEffect(() => {
    (async () => {
      if (!peer) { setStatus("error"); return; }
      setStatus("saving");
      try {
        const raw = (await AsyncStorage.getItem(KEY)) || "[]";
        const current: Friend[] = JSON.parse(raw);
        if (!current.some(f => f.deviceId === peer)) {
          current.push({ deviceId: String(peer), name: null, addedAt: new Date().toISOString() });
          await AsyncStorage.setItem(KEY, JSON.stringify(current));
        }
        setStatus("done");
        // bounce to the Friends tab list (adjust path if yours differs)
        setTimeout(() => router.replace("/friends"), 800);
      } catch {
        setStatus("error");
      }
    })();
  }, [peer]);

  return (
    <View style={{ flex:1, backgroundColor:"#0c1320", alignItems:"center", justifyContent:"center", padding:24 }}>
      {status === "saving" && <ActivityIndicator />}
      <Text style={{ color:"#fff", fontSize:18, textAlign:"center", marginTop:12 }}>
        {status === "saving" && "Adding friend…"}
        {status === "done"   && "Friend added! Redirecting…"}
        {status === "error"  && "Couldn’t add friend. Invalid link or storage error."}
      </Text>
    </View>
  );
}