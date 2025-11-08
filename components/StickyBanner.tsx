// /Users/rikin/geotap/components/StickyBanner.tsx
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AD_UNITS, BannerAd, BannerAdSize } from "../lib/ads";

/** Fixed banner that sits above the home indicator / tab bar */
export default function StickyBanner({ hidden = false }: { hidden?: boolean }) {
  const insets = useSafeAreaInsets();
  if (hidden) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: Math.max(insets.bottom, 8),
        backgroundColor: "#0c1320",
        alignItems: "center",
      }}
    >
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      />
    </View>
  );
}

/** Optional spacer to keep content from being covered by the banner */
export function StickyBannerSpacer({ height = 90 }: { height?: number }) {
  return <View style={{ height }} />;
}