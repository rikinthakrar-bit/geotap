import { Image, Text, View } from "react-native";

export default function BrandHeader({ subtitle }: { subtitle?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Image source={require("../assets/woe-logo.png")} style={{ width: 36, height: 36 }} />
      <View>
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>Where on Earth?</Text>
        {subtitle ? (
          <Text style={{ color: "rgba(255,255,255,.7)", fontSize: 12 }}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}