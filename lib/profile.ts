// lib/profile.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto"; // for deterministic color hash
import { getDeviceId } from "./device";

const KEY = "profile_v1";

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
  const hash = Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, id);
  return hash.then(h => {
    // take first 6 hex as hue-ish seed
    const x = parseInt(h.slice(0,6), 16);
    const r = 180 + (x % 60);     // 180..239
    const g = 180 + ((x>>3)%60);
    const b = 180 + ((x>>5)%60);
    return `#${r.toString(16)}${g.toString(16)}${b.toString(16)}`;
  });
}

// ---------- local profile ----------
export async function getOrCreateProfile(): Promise<Profile> {
  const id = await getDeviceId();
  const cached = await AsyncStorage.getItem(KEY);
  if (cached) return JSON.parse(cached);

  const displayName = randomName();
  const color = await colorFromId(id);
  const profile: Profile = { id, displayName, color };

  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
  return profile;
}

export async function updateLocalDisplayName(displayName: string) {
  const cur = await getOrCreateProfile();
  const next = { ...cur, displayName };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
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