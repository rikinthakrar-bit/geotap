import { LinearGradient } from "expo-linear-gradient";
import { ViewProps } from "react-native";

export default function AppBackground({ children, style }: ViewProps & { children: React.ReactNode }) {
  return (
    <LinearGradient
      colors={["#0C1320", "#0C1320", "#101B33"]}
      locations={[0, 0.6, 1]}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
}