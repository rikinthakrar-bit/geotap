import { Stack } from "expo-router";
import "react-native-get-random-values"; // must be before anything that uses uuid

// app/_layout.tsx
import "react-native-get-random-values";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerTintColor:"#fff", headerStyle:{ backgroundColor:"#0c1320" } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown:false }} />
      <Stack.Screen name="question" options={{ headerShown:false }} />
      <Stack.Screen name="summary" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="archive/[date]" options={{ title:"Archive Day" }} />
      <Stack.Screen name="challenge/index" options={{ title:"Challenge" }} />
      <Stack.Screen name="challenge/intro" options={{ title:"Challenge Intro" }} />
      <Stack.Screen name="challenge/h2h" options={{ title:"Head to Head" }} />
      <Stack.Screen name="friends/index" options={{ title:"Friends" }} />
      <Stack.Screen name="stats" options={{ title:"Your Progress" }} />
    </Stack>
  );
}