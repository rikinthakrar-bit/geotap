// lib/invites.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const INVITE_COUNT_KEY = "invite_count_v1";

export async function setInviteCount(n: number) {
  await AsyncStorage.setItem(INVITE_COUNT_KEY, String(n));
}

export async function getInviteCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(INVITE_COUNT_KEY);
  return Math.max(0, parseInt(raw || "0", 10) || 0);
}

import { supabase } from "@/lib/supabase";
import * as Notifications from "expo-notifications";

export async function getPendingInviteCount(deviceId: string): Promise<number> {
  const { data, error } = await supabase
    .from("friend_invites")
    .select("id")
    .eq("receiver_id", deviceId)
    .eq("accepted", false);

  if (error) {
    console.warn("Failed to load invites", error);
    return 0;
  }

  return data?.length || 0;
}

export async function updateBadges(deviceId: string) {
  try {
    const count = await getPendingInviteCount(deviceId);

    // 🔴 Store locally for fast tab display
    await AsyncStorage.setItem("invite_count_v1", String(count));

    // 🔴 Update app icon badge (iOS/Android)
    await Notifications.setBadgeCountAsync(count);

    return count;
  } catch (e) {
    console.warn("updateBadges failed", e);
    return 0;
  }
}