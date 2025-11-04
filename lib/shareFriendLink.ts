// lib/shareFriendLink.ts
import * as Clipboard from "expo-clipboard";
import { Platform, Share } from "react-native";
import { getDeviceId } from "./device";

export async function shareFriendLink() {
  const id = await getDeviceId();
  const url = `/add-friend?peer=${encodeURIComponent(id)}`; // deep link path
  const msg = `Play GeoTap with me! Tap this link to connect:\n${url}`;

  // Copy to clipboard for convenience
  try { await Clipboard.setStringAsync(url); } catch {}

  // Also bring up native share (fallback on web)
  try {
    if (Platform.OS !== "web") {
      await Share.share({ message: msg });
    }
  } catch {}

  return url; // return in case caller wants it
}