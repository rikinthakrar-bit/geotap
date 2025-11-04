

// lib/notifications.ts
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Ask permission and return an Expo push token for this device, or null if unavailable.
 * Call this once on startup and send the token to your backend (if you have one).
 */
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("[notifications] Not a physical device; push not available.");
    return null;
  }

  // iOS: request permissions first
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.log("[notifications] Permission not granted");
    return null;
  }

  // Get Expo push token
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log("[notifications] Expo push token:", token);

  // Android: ensure a high-importance default channel exists
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return token;
}

/**
 * Schedule a daily local reminder (e.g., “Today’s GeoTap is live!”)
 * hour: 0–23 in local time
 */
export async function scheduleDailyReminder(hour = 9): Promise<void> {
  // Cancel any previous scheduled reminders to avoid duplicates
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.identifier || "").startsWith("daily-reminder")) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  await Notifications.scheduleNotificationAsync({
    identifier: `daily-reminder-${hour}`,
    content: {
      title: "Today’s GeoTap is live",
      body: "10 quick taps. Keep your streak alive.",
      sound: true,
      data: { cid: new Date().toISOString().slice(0, 10) },
    },
    trigger: {
      hour,
      minute: 0,
      repeats: true,
    } as any, // TS: cross‑platform typed trigger
  });
}

/**
 * Subscribe to notification taps. Provide a handler that receives the `data` payload.
 * Returns an unsubscribe function.
 */
export function onNotificationResponse(
  handler: (data: Record<string, any>) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    try {
      const data = resp.notification.request.content.data as Record<string, any>;
      handler?.(data || {});
    } catch (e) {
      console.warn("[notifications] Failed to handle response", e);
    }
  });
  return () => sub.remove();
}