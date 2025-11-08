import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AD_UNITS, BannerAd, BannerAdSize } from "../lib/ads";

/** Fixed banner that sits above the home indicator / tab bar */
export default function StickyBanner({ hidden = false, bottomOffset = 0 }: { hidden?: boolean; bottomOffset?: number }) {
  const insets = useSafeAreaInsets();
  if (hidden) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: bottomOffset,
        paddingBottom: 0,
        backgroundColor: "transparent",
        alignItems: "center",
        zIndex: 9999,
        elevation: 9999,
        alignSelf: "stretch",
      }}
    >
      <BannerAd
        unitId={AD_UNITS.banner}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => console.log("[ads] banner loaded")} 
        onAdFailedToLoad={(e: any) => console.warn("[ads] banner failed", e)}
      />
    </View>
  );
}

/** Optional spacer to keep content from being covered by the banner */
export function StickyBannerSpacer({ height = 50 }: { height?: number }) {
  return <View style={{ height }} />;
}