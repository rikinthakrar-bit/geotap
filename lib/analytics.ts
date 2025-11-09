import * as Analytics from "expo-firebase-analytics";
import { Platform } from "react-native";

/**
 * Lightweight analytics wrapper for consistent, safe event tracking.
 * - Console logs in dev so you can see what would be sent.
 * - Sanitizes params to primitives/flat values (Firebase requirement).
 * - Provides helpers for screens, users, and feature flags.
 */

const DEBUG = __DEV__;

/** Toggle analytics collection at runtime (e.g. user opted out). */
export async function setAnalyticsEnabled(enabled: boolean) {
  try {
    // Optional chaining across platforms (method not present on web)
    (Analytics as any)?.setAnalyticsCollectionEnabled?.(enabled);
    if (DEBUG) console.log("[analytics] collection", enabled ? "ENABLED" : "DISABLED");
  } catch (e) {
    console.warn("Analytics setAnalyticsEnabled failed", e);
  }
}

/** Ensure GA/FA is initialized (safe to call multiple times). */
export async function initAnalytics() {
  try {
    // Nothing required for expo-firebase-analytics; keep for symmetry.
    if (DEBUG) console.log("[analytics] init OK on", Platform.OS);
  } catch (e) {
    console.warn("Analytics init failed", e);
  }
}

/** Coerce values to Firebase-friendly primitives and truncate long strings. */
function sanitizeParams(params: Record<string, any> = {}) {
  const out: Record<string, string | number | boolean | null> = {};
  const entries = Object.entries(params).slice(0, 24); // GA4: keep param count modest
  for (const [k, v] of entries) {
    const key = String(k).slice(0, 40); // GA4 key len guard
    let val: any = v;

    if (val === undefined) {
      continue;
    } else if (val === null || typeof val === "number" || typeof val === "boolean") {
      // keep as-is
    } else if (typeof val === "string") {
      val = val.length > 100 ? val.slice(0, 100) : val;
    } else if (typeof val === "bigint") {
      val = Number(val);
    } else if (typeof val === "object") {
      // flatten simple objects to JSON string (bounded)
      try {
        const s = JSON.stringify(val);
        val = s.length > 100 ? s.slice(0, 100) : s;
      } catch {
        val = String(val);
      }
    } else {
      val = String(val);
    }

    out[key] = val as any;
  }
  return out;
}

/** Track a custom event. */
export async function trackEvent(name: string, params: Record<string, any> = {}) {
  const eventName = String(name).slice(0, 40); // GA4 name guard

  const clean = sanitizeParams(params);

  if (DEBUG) {
    console.log("[analytics] EVENT:", eventName, clean);
  }

  try {
    await Analytics.logEvent(eventName, clean);
  } catch (e) {
    console.warn("Analytics logEvent failed", e);
  }
}

/** Track screen navigation. Prefer this in useFocusEffect on each screen. */
export async function trackScreen(screenName: string, params: Record<string, any> = {}) {
  const name = String(screenName || "unknown").slice(0, 36); // GA4 screen_name limit ≈ 36-40
  if (DEBUG) console.log("[analytics] SCREEN:", name, params);

  try {
    // Some Expo Firebase Analytics typings don't expose setCurrentScreen.
    // Use optional chaining via any, and fall back to screen_view event.
    const maybeSet = (Analytics as any)?.setCurrentScreen;
    if (typeof maybeSet === "function") {
      await maybeSet(name);
    } else {
      await Analytics.logEvent("screen_view", sanitizeParams({ screen_name: name, ...params }));
    }
  } catch (e) {
    console.warn("Analytics trackScreen failed", e);
  }
}

/** Associate events with a user/device. Safe to call any time. */
export async function setUserId(userId: string | null) {
  try {
    await Analytics.setUserId(userId ?? null); // typings expect string | null
    if (DEBUG) console.log("[analytics] userId =", userId);
  } catch (e) {
    console.warn("Analytics setUserId failed", e);
  }
}

/** Set one user property. */
export async function setUserProperty(name: string, value: string) {
  try {
    await Analytics.setUserProperties({ [name]: value });
    if (DEBUG) console.log("[analytics] userProperty:", name, value);
  } catch (e) {
    console.warn("Analytics setUserProperty failed", e);
  }
}

/** Set multiple user properties at once. */
export async function setUserProperties(props: Record<string, string | number | boolean | null | undefined>) {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue;
    clean[k] = String(v).slice(0, 100);
  }
  try {
    await Analytics.setUserProperties(clean);
    if (DEBUG) console.log("[analytics] userProperties:", clean);
  } catch (e) {
    console.warn("Analytics setUserProperties failed", e);
  }
}

/** Convenience helpers for ad lifecycle (optional but keeps naming consistent). */
export const trackAdShown = (placement: string, extra: Record<string, any> = {}) =>
  trackEvent("ad_shown", { placement, ...extra });

export const trackAdClick = (placement: string, extra: Record<string, any> = {}) =>
  trackEvent("ad_click", { placement, ...extra });

export const trackAdError = (placement: string, message?: string, code?: string) =>
  trackEvent("ad_error", { placement, message, code });

/** Example: call once when the app starts (e.g. in root layout). */
export async function bootstrapAnalytics({
  userId,
  props,
  enabled = true,
}: {
  userId?: string | null;
  props?: Record<string, string | number | boolean | null | undefined>;
  enabled?: boolean;
} = {}) {
  await initAnalytics();
  await setAnalyticsEnabled(enabled);
  if (userId) await setUserId(userId);
  if (props) await setUserProperties(props);
  if (DEBUG) console.log("[analytics] bootstrapped");
}