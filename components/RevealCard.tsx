import { useEffect, useRef } from "react";
import { Animated, Text } from "react-native";

export default function RevealCard({ title, subtitle, success }: { title: string; subtitle?: string; success?: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      position: "absolute", left: 16, right: 16, top: 110,
      borderRadius: 16, padding: 16,
      backgroundColor: "#101B33", borderWidth: 1, borderColor: "rgba(255,255,255,.08)",
      opacity, transform: [{ scale }], zIndex: 99
    }}>
      <Text style={{ color: success ? "#15C37E" : "#fff", fontSize: 18, fontWeight: "800" }}>{title}</Text>
      {!!subtitle && <Text style={{ color: "rgba(255,255,255,.8)", marginTop: 4 }}>{subtitle}</Text>}
    </Animated.View>
  );
}