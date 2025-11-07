import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: { backgroundColor: "#fff" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      {/* 👇 note the `/index` names */}
      <Tabs.Screen
        name="challenge/index"
        options={{
          title: "Challenge",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flag-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
  name="friends/index"
  options={{
    title: "Friends",
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="people-outline" size={size} color={color} />
    ),
  }}
/>
r
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, size }) => (<Ionicons name="stats-chart" size={size} color={color} />),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          // Hide from the tab bar but keep it as a routable screen under the Tabs layout
          href: null,
          title: "Summary",
        }}
      />
      <Tabs.Screen name="archive/index" options={{ href: null }} />
      <Tabs.Screen name="archive/[date]" options={{ href: null }} />
      <Tabs.Screen
  name="practice/index"
  options={{
    title: "Practice",
    href: null, // keep it under Tabs (so the bottom bar shows) but don't show a tab button
  }}
/>
    </Tabs>
  );
}