// lib/profileName.ts — stable, backward-compatible name helpers
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PRIMARY = "profile.displayName";   // legacy/simple key
const KEY_SECONDARY = "display_name_v1";     // another simple key used elsewhere
const KEY_PROFILE = "profile_v1";            // unified profile object (optional mirror)

// --- Minimal fallback generator (replace with your adjective–noun generator if you want) ---
const ADJ = ["Brave","Clever","Swift","Bright","Lucky","Calm","Nimble","Bold","Happy","Mighty"];
const NOUN = ["Panther","Falcon","Lion","Panda","Otter","Eagle","Tiger","Wolf","Fox","Dolphin"];
function generateDefaultName(): string {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  return `${a} ${n}`;
}
// -------------------------------------------------------------------------------------------

/** Read display name from any known place. If none found, generate one and persist. */
export async function getDisplayName(): Promise<string> {
  try {
    // 1) Try legacy/simple keys first
    const [p, s] = await Promise.all([
      AsyncStorage.getItem(KEY_PRIMARY),
      AsyncStorage.getItem(KEY_SECONDARY),
    ]);
    if (p && p.trim()) return p.trim();
    if (s && s.trim()) return s.trim();

    // 2) Try unified profile object
    try {
      const raw = await AsyncStorage.getItem(KEY_PROFILE);
      if (raw) {
        const obj = JSON.parse(raw) as { displayName?: string } | null;
        const dn = obj?.displayName;
        if (dn && typeof dn === "string" && dn.trim()) return dn.trim();
      }
    } catch { /* ignore */ }

    // 3) Nothing found — generate once and persist so it's stable from now on
    const generated = generateDefaultName();
    await setDisplayName(generated);
    return generated;
  } catch {
    // Absolute fallback
    const name = generateDefaultName();
    try { await setDisplayName(name); } catch { /* ignore */ }
    return name;
  }
}

/** Read display name from any known place but do not generate or persist. */
export async function peekDisplayName(): Promise<string | null> {
  try {
    const [p, s] = await Promise.all([
      AsyncStorage.getItem(KEY_PRIMARY),
      AsyncStorage.getItem(KEY_SECONDARY),
    ]);
    if (p && p.trim()) return p.trim();
    if (s && s.trim()) return s.trim();

    try {
      const raw = await AsyncStorage.getItem(KEY_PROFILE);
      if (raw) {
        const obj = JSON.parse(raw) as { displayName?: string } | null;
        const dn = obj?.displayName;
        if (dn && typeof dn === "string" && dn.trim()) return dn.trim();
      }
    } catch { /* ignore */ }

    return null;
  } catch {
    return null;
  }
}

/** Persist display name to simple keys + mirror into profile_v1 if present. */
export async function setDisplayName(name: string): Promise<void> {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return;

  try {
    // Write to both simple keys for backward compatibility
    await AsyncStorage.multiSet([
      [KEY_PRIMARY, trimmed],
      [KEY_SECONDARY, trimmed],
    ]);

    // Mirror into unified profile object if present
    try {
      const raw = await AsyncStorage.getItem(KEY_PROFILE);
      const obj = raw ? JSON.parse(raw) : {};
      obj.displayName = trimmed;
      await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(obj));
    } catch { /* ignore */ }
  } catch { /* ignore */ }
}

// Some parts of the code may import default setDisplayName
export default setDisplayName;