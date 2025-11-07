import React from "react";
import {
  Image,
  ImageSourcePropType,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  title: string;
  description: string;
  cta: string;
  onPress: () => void;
  tint: string;
  image?: ImageSourcePropType;      // optional
  imageHeight?: number;             // controls card height via image
  compact?: boolean;
  played?: boolean;                 // NEW: show a "Played" badge on the image
};

export default function GameCard({
  title,
  description,
  cta,
  onPress,
  tint,
  image,
  imageHeight = 150,
  compact = false,
  played = false,
}: Props) {
  const imgH = compact ? Math.min(imageHeight, 90) : imageHeight;
  return (
    <View
      style={{
        backgroundColor: "#0b1220",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#1f2937",
        overflow: "hidden", // ensures rounded corners apply to image and CTA bar
        height: compact ? "100%" : undefined,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Image / placeholder with optional "Played" badge */}
      <View style={{ position: "relative" }}>
        {image ? (
          <Image
            source={image}
            resizeMode="cover"
            style={{
              width: "100%",
              height: imgH, // controls visual height
            }}
          />
        ) : (
          <View
            style={{
              width: "100%",
              height: imgH,
              backgroundColor: "#0d1526",
              borderBottomWidth: 1,
              borderBottomColor: "#182133",
            }}
          />
        )}

        {played && (
          <View
            style={{
              position: "absolute",
              right: 8,
              bottom: 8,
              backgroundColor: "#22C55E",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              Played
            </Text>
          </View>
        )}
      </View>

      {/* Text content */}
      <View style={{ flex: 1, padding: compact ? 12 : 16, gap: compact ? 6 : 8, justifyContent: "flex-start", minHeight: 0, flexShrink: 1 }}>
        <Text
          style={{ color: "#fff", fontSize: compact ? 15 : 18, fontWeight: "800" }}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        <Text
          style={{ color: "#9aa", fontSize: compact ? 13 : 14 }}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {description}
        </Text>
      </View>

      {/* Full-width CTA bar at the bottom */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          backgroundColor: tint,
          paddingVertical: compact ? 12 : 14,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800" }}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}