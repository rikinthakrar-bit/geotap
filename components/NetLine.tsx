// components/NetLine.tsx
import { Image, Text, View } from "react-native";

function Avatar({ uri, name }: { uri?: string | null; name: string }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#eee" }}
      />
    );
  }
  const initials =
    name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || "")
      .join("") || "?";
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#ddd",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontWeight: "700" }}>{initials}</Text>
    </View>
  );
}

export function NetLine({
  me,
  them,
  status,
}: {
  me: { name: string; avatar?: string | null };
  them: { name: string; avatar?: string | null };
  status: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8 }}>
      <Avatar uri={me.avatar} name={me.name} />
      <Text style={{ fontWeight: "600" }}>{me.name}</Text>
      <Text style={{ marginHorizontal: 8, opacity: 0.8 }}>—</Text>
      <Text style={{ fontWeight: "700" }}>{status}</Text>
      <Text style={{ marginHorizontal: 8, opacity: 0.8 }}>—</Text>
      <Text style={{ fontWeight: "600" }}>{them.name}</Text>
      <Avatar uri={them.avatar} name={them.name} />
    </View>
  );
}