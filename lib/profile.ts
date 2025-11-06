// lib/profile.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto"; // for deterministic color hash
import { getDeviceId } from "./device";

const KEY = "profile_v1";

const KEY_LEGACY_PRIMARY = "profile.displayName";   // legacy/simple key
const KEY_LEGACY_SECONDARY = "display_name_v1";     // alternate legacy key

type Profile = {
  id: string;            // deviceId
  displayName: string;   // "Brave Narwhal"
  color: string;         // hex like "#7cc9b2"
};

// ---------- name generator ----------
const ADJ = ["Brave","Rapid","Calm","Bright","Witty","Nimble","Lucky","Mighty","Sly","Zesty"];
const NOUN = ["Narwhal","Falcon","Otter","Panda","Orca","Maple","Comet","Badger","Kestrel","Harbor"];

function randomName() {
  const a = ADJ[Math.floor(Math.random()*ADJ.length)];
  const n = NOUN[Math.floor(Math.random()*NOUN.length)];
  return `${a} ${n}`;
}

function colorFromId(id: string) {
  // deterministic-ish pastel from deviceId
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  const hash = Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, id);
  return hash.then((h) => {
    const x = parseInt(h.slice(0, 6), 16) || 0;
    const r = 180 + (x % 60); // 180..239
    const g = 180 + ((x >> 3) % 60);
    const b = 180 + ((x >> 5) % 60);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  });
}

// ---------- local profile ----------
export async function getOrCreateProfile(): Promise<Profile> {
  const id = await getDeviceId();

  // Return cached profile if present (and well-formed)
  const cached = await AsyncStorage.getItem(KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as Profile;
      if (parsed && parsed.id && typeof parsed.displayName === "string" && parsed.color) {
        return parsed;
      }
    } catch {
      // fall through to recreate if corrupt
    }
  }

  // Check legacy/simple keys for an existing name to migrate
  let migratedName = "";
  try {
    const [p, s] = await Promise.all([
      AsyncStorage.getItem(KEY_LEGACY_PRIMARY),
      AsyncStorage.getItem(KEY_LEGACY_SECONDARY),
    ]);
    migratedName = (p && p.trim()) || (s && s.trim()) || "";
  } catch {
    migratedName = "";
  }

  const displayName = migratedName || randomName();
  const color = await colorFromId(id);
  const profile: Profile = { id, displayName, color };

  // Persist new profile
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));

  // Keep legacy keys in sync so older code paths remain stable
  try {
    await AsyncStorage.multiSet([
      [KEY_LEGACY_PRIMARY, displayName],
      [KEY_LEGACY_SECONDARY, displayName],
    ]);
  } catch {}

  return profile;
}

export async function updateLocalDisplayName(displayName: string) {
  const cur = await getOrCreateProfile();
  const next = { ...cur, displayName };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  // Mirror to legacy keys for backward compatibility
  try {
    await AsyncStorage.multiSet([
      [KEY_LEGACY_PRIMARY, displayName],
      [KEY_LEGACY_SECONDARY, displayName],
    ]);
  } catch {}
  return next;
}

// ---------- cloud (Supabase) optional ----------
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function syncProfileToCloud() {
  if (!supabase) return; // skip if no env
  const me = await getOrCreateProfile();
  await supabase
    .from("profiles")
    .upsert({ id: me.id, display_name: me.displayName, color: me.color }, { onConflict: "id" });
}

export async function fetchProfiles(ids: string[]) {
  if (!supabase || ids.length === 0) return {};
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, color")
    .in("id", ids);
  const map: Record<string, { name: string; color: string }> = {};
  (data ?? []).forEach(r => {
    map[r.id] = { name: r.display_name ?? "Friend", color: r.color ?? "#999" };
  });
  return map;
}