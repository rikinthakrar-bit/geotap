// /Users/rikin/geotap/lib/ads.ts
import { Platform } from "react-native";

// Guarded import: avoid crashing in environments without the native ads module (e.g. Expo Go)
let _RNAds: any = null;
let GOOGLE_ADS_AVAILABLE = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  _RNAds = require("react-native-google-mobile-ads");
  GOOGLE_ADS_AVAILABLE = Boolean(_RNAds && (_RNAds.BannerAd || _RNAds.default));
} catch {
  GOOGLE_ADS_AVAILABLE = false;
}

// Minimal fallbacks so the app renders without crashing when ads aren’t available
const NoopComponent: React.FC<any> = () => null;
const FallbackBannerAdSize = { BANNER: "BANNER" } as const;

export const BannerAd = GOOGLE_ADS_AVAILABLE ? _RNAds.BannerAd : (NoopComponent as any);
export const InterstitialAd = GOOGLE_ADS_AVAILABLE ? _RNAds.InterstitialAd : class { static createForAdRequest() { return { load() {}, addAdEventListener() { return () => {}; }, show() {} }; } } as any;
export const RewardedAd = GOOGLE_ADS_AVAILABLE ? _RNAds.RewardedAd : class { static createForAdRequest() { return { load() {}, addAdEventListener() { return () => {}; }, show() {} }; } } as any;
export const BannerAdSize = GOOGLE_ADS_AVAILABLE ? _RNAds.BannerAdSize : (FallbackBannerAdSize as any);
export const TestIds = GOOGLE_ADS_AVAILABLE ? _RNAds.TestIds : { BANNER: "TEST_BANNER", INTERSTITIAL: "TEST_INTERSTITIAL", REWARDED: "TEST_REWARDED" };

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

export const AD_UNITS = {
  banner: Platform.select({
    ios: __DEV__
      ? TestIds.BANNER
      : "ca-app-pub-7411339580974421/5114963013", // your real iOS banner ID
    android: __DEV__
      ? TestIds.BANNER
      : "ca-app-pub-7411339580974421/3975596576", // your real Android banner ID
  })!,
  interstitial: Platform.select({
    ios: __DEV__
      ? TestIds.INTERSTITIAL
     : "ca-app-pub-7411339580974421/6403993955",   
    android: __DEV__
      ? TestIds.INTERSTITIAL
      : "ca-app-pub-7411339580974421/9287918419",
  })!,
  rewarded: Platform.select({
    ios: __DEV__
      ? TestIds.REWARDED
    : "ca-app-pub-7411339580974421/3777830614",
    android: __DEV__
      ? TestIds.REWARDED
      : "ca-app-pub-7411339580974421/4791529388",
  })!,
};

export { GOOGLE_ADS_AVAILABLE };

// ===== Interstitial & Rewarded helpers (non-destructive append) =====

// Event enums (fall back to plain strings when the native module isn't present)
const AdEventType = GOOGLE_ADS_AVAILABLE
  ? _RNAds.AdEventType
  : { LOADED: "LOADED", CLOSED: "CLOSED" };

const RewardedAdEventType = GOOGLE_ADS_AVAILABLE
  ? _RNAds.RewardedAdEventType
  : { LOADED: "LOADED", EARNED_REWARD: "EARNED_REWARD" };

// ---------- Interstitial ----------
let _interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
  requestNonPersonalizedAdsOnly: true,
});
let _interstitialLoaded = false;

export function preloadInterstitial() {
  _interstitial = InterstitialAd.createForAdRequest(AD_UNITS.interstitial, {
    requestNonPersonalizedAdsOnly: true,
  });
  _interstitialLoaded = false;

  // listeners are safe even in fallback; they no-op in your dummy class
  _interstitial.addAdEventListener(AdEventType.LOADED, () => {
    _interstitialLoaded = true;
  });
  _interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    // warm the next one automatically
    preloadInterstitial();
  });

  _interstitial.load?.();
}

/** Show if loaded; fail-open (do nothing) if not. */
export async function showInterstitialAd(): Promise<void> {
  try {
    if (!_interstitialLoaded) {
      preloadInterstitial();
      return;
    }
    await _interstitial.show?.();
  } catch {
    // fail open
  }
}

// ---------- Rewarded ----------
let _rewarded = RewardedAd.createForAdRequest(AD_UNITS.rewarded, {
  requestNonPersonalizedAdsOnly: true,
});
let _rewardedLoaded = false;

export function preloadRewarded() {
  _rewarded = RewardedAd.createForAdRequest(AD_UNITS.rewarded, {
    requestNonPersonalizedAdsOnly: true,
  });
  _rewardedLoaded = false;

  _rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
    _rewardedLoaded = true;
  });
  _rewarded.addAdEventListener(AdEventType.CLOSED, () => {
    // warm the next one automatically
    preloadRewarded();
  });

  _rewarded.load?.();
}

/** Show rewarded; resolves true if user earned reward, else false. */
export async function showRewardedAd(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let earned = false;

    try {
      if (!_rewardedLoaded) {
        preloadRewarded();
        resolve(false);
        return;
      }

      const offEarned =
        _rewarded.addAdEventListener?.(RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
        }) || (() => {});
      const offClosed =
        _rewarded.addAdEventListener?.(AdEventType.CLOSED, () => {
          offEarned();
          offClosed();
          resolve(earned);
        }) || (() => resolve(earned));

      _rewarded.show?.().catch(() => {
        offEarned();
        offClosed();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

/** Optional convenience to warm both on app start */
export function preloadAllAds() {
  preloadInterstitial();
  preloadRewarded();
}
