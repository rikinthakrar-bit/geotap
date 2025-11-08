// @ts-nocheck
// lib/notifications.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

const KEY_DAILY10_SCHEDULE_ID = "notif.daily10.schedule_id";

function nextLocalDateAt(hour: number, minute: number) {
  const now = new Date();
  const d = new Date();
  d.setSeconds(0, 0);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export async function registerForPush(): Promise<string | null> {
  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowBadge: true, allowAlert: true, allowSound: true }
    });
    granted = req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  if (!granted || !Device.isDevice) return null;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    return token ?? null;
  } catch (e) {
    console.warn("Failed to get Expo push token:", e);
    return null;
  }
}

export async function cancelDaily10Reminder() {
  try {
    const id = await AsyncStorage.getItem(KEY_DAILY10_SCHEDULE_ID);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(KEY_DAILY10_SCHEDULE_ID);
    }
  } catch (e) {
    console.warn("cancelDaily10Reminder error", e);
  }
}

/**
 * Ensure there's exactly one pending reminder at ~18:00 local.
 * If the user has already played today, schedule for tomorrow 18:00.
 * If not, schedule for the next 18:00 that hasn't passed yet (i.e., today or tomorrow).
 */
export async function ensureDaily10Reminder(playedToday: boolean, hourLocal = 18, minuteLocal = 0) {
  // clear any previous scheduled id
  await cancelDaily10Reminder();

  const triggerDate = playedToday
    ? (() => { const d = nextLocalDateAt(hourLocal, minuteLocal); d.setDate(d.getDate()); return d; })()
    : nextLocalDateAt(hourLocal, minuteLocal);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Daily 10 is ready 🌍",
        body: "Jump back in when you have a moment.",
        sound: "default",
        badge: 0,
      },
      trigger: triggerDate,
    });
    await AsyncStorage.setItem(KEY_DAILY10_SCHEDULE_ID, String(id));
    return id;
  } catch (err) {
    console.warn("ensureDaily10Reminder schedule error:", err);
    return null;
  }
}

// optional: foreground behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // modern shape in SDK 54+: show banners/lists on iOS
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function scheduleDailyReminder(hourLocal = 9, minuteLocal = 0) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Daily 10 is ready 🌍",
        body: "Take today’s 10-question challenge.",
        sound: "default",
        badge: 0,
      },
      trigger: {
        hour: hourLocal,
        minute: minuteLocal,
        repeats: true,
        channelId: "daily10",
      },
    });
    return id;
  } catch (err) {
    console.warn("Error scheduling reminder:", err);
    return null;
  }
}