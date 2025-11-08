// /Users/rikin/geotap/lib/ads.ts
import { Platform } from "react-native";
import {
    BannerAd,
    BannerAdSize,
    InterstitialAd,
    RewardedAd,
    TestIds,
} from "react-native-google-mobile-ads";

export const IS_DEV = __DEV__;

// Use Google test IDs while setting up
const TEST = {
  banner: {
    ios: TestIds.BANNER,
    android: TestIds.BANNER,
  },
  interstitial: {
    ios: TestIds.INTERSTITIAL,
    android: TestIds.INTERSTITIAL,
  },
  rewarded: {
    ios: TestIds.REWARDED,
    android: TestIds.REWARDED,
  },
};

// Replace these with live IDs when ready
export const AD_UNITS = {
  banner: Platform.select({
    ios: TEST.banner.ios,
    android: TEST.banner.android,
  })!,
  interstitial: Platform.select({
    ios: TEST.interstitial.ios,
    android: TEST.interstitial.android,
  })!,
  rewarded: Platform.select({
    ios: TEST.rewarded.ios,
    android: TEST.rewarded.android,
  })!,
};

export { BannerAd, BannerAdSize, InterstitialAd, RewardedAd };
