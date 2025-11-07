import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { createClient } from "@supabase/supabase-js";
import { router } from "expo-router";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import { getDeviceId } from "../lib/device";
import { syncProfileToCloud, updateLocalDisplayName } from "../lib/profile";

const KEY_DISPLAY_NAME = "profile.displayName";
const KEY_EDITING_NAME = "profile.editingName";

// --- First-run random name generator (adjective-noun)
const ADJ = ["Brave","Rapid","Calm","Bright","Witty","Nimble","Lucky","Mighty","Sly","Zesty"] as const;
const NOUN = ["Narwhal","Falcon","Otter","Panda","Orca","Maple","Comet","Badger","Kestrel","Harbor"] as const;
const genRandomName = () => `${ADJ[Math.floor(Math.random()*ADJ.length)]}_${NOUN[Math.floor(Math.random()*NOUN.length)]}`;

// Allow: A–Z, a–z, 0–9, underscore; 3–15 chars; no leading/trailing underscore; no spaces
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]/g, "");
const isValid = (s: string) => /^[A-Za-z0-9](?:[A-Za-z0-9_]{1,13}[A-Za-z0-9])$/.test(s);

const suggestAlt = (base: string): string => {
  const b = normalize(base).replace(/^_+|_+$/g, "").slice(0, 12); // leave room for suffix
  const rand = Math.floor(100 + Math.random() * 900); // 3 digits
  if (!b) return `player_${rand}`;
  return `${b}_${rand}`;
};

export default function EditDisplayNameModal() {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<"" | "checking" | "available" | "taken" | "invalid" | "unknown">("");
  const [suggestion, setSuggestion] = useState<string>("");
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [spaceHint, setSpaceHint] = useState(false);
  const checkTimerRef = useRef<number | null>(null);

  const navigation = useNavigation();
  const allowCloseRef = React.useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      // Always show a sensible back title on iOS instead of "(tabs)"
      headerBackTitle: "Back",
      headerBackTitleVisible: true,
      // Title and back button visibility depend on first-run vs edit
      headerTitle: isFirstRun ? "Welcome to GeoTap" : "Edit Display Name",
      headerLeft: isFirstRun ? () => null : undefined, // hide back on first-run only
      gestureEnabled: false,
    });
  }, [navigation, isFirstRun]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { await AsyncStorage.setItem(KEY_EDITING_NAME, "1"); } catch {}
      try {
        const raw = await AsyncStorage.getItem(KEY_DISPLAY_NAME);
        if (alive) {
          if (raw && raw.trim()) {
            setName(raw);
            setIsFirstRun(false);
          } else {
            const rnd = genRandomName();
            setName(rnd);
            setIsFirstRun(true);
          }
        }
      } catch {}
    })();
    return () => {
      alive = false;
      AsyncStorage.removeItem(KEY_EDITING_NAME).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
      checkTimerRef.current = null;
    }

    const trimmed = name.trim();
    const norm = normalize(trimmed);

    if (!trimmed) {
      setAvailability("");
      setSuggestion("");
      return;
    }
    if (!isValid(norm)) {
      setAvailability("invalid");
      setSuggestion("");
      return;
    }

    setAvailability("checking");
    checkTimerRef.current = setTimeout(async () => {
      try {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = (supabaseUrl && supabaseKey)
          ? createClient(supabaseUrl, supabaseKey)
          : null;

        if (!supabase) {
          setAvailability("unknown");
          setSuggestion("");
          return;
        }

        const deviceId = await getDeviceId();
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("display_name_norm", norm)
          .limit(1);

        if (error) {
          // On transient errors, don’t block saving; treat as unknown UI-wise
          setAvailability("unknown");
          setSuggestion("");
          return;
        }

        if (!data || data.length === 0) {
          setAvailability("available");
          setSuggestion("");
        } else {
          const isOurs = data[0]?.id === deviceId;
          if (isOurs) {
            setAvailability("available");
            setSuggestion("");
          } else {
            setAvailability("taken");
            setSuggestion(suggestAlt(trimmed));
          }
        }
      } catch {
        setAvailability("unknown");
        setSuggestion("");
      }
    }, 300);

    return () => {
      if (checkTimerRef.current) {
        clearTimeout(checkTimerRef.current);
        checkTimerRef.current = null;
      }
    };
  }, [name]);

  const onChangeName = (t: string) => {
    const noSpaces = t.replace(/\s+/g, "");
    setSpaceHint(noSpaces.length !== t.length);
    setName(noSpaces);
    // availability effect will handle status
  };

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Please enter a display name.");
      return;
    }
    try {
      setSaving(true);
      // Use profile helper so AsyncStorage + legacy keys + Supabase are kept in sync
      await updateLocalDisplayName(trimmed);
      try { await syncProfileToCloud(); } catch {}
      allowCloseRef.current = true;
      router.back();
    } catch {
      Alert.alert("Error", "Could not save your name. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={{ flex: 1, backgroundColor: "#0c1320" }}
      >
        <View style={{ flex: 1, padding: 20, gap: 14 }}>
          <Text style={{ color: "#e5e7eb", fontSize: 18, fontWeight: "700" }}>
            {isFirstRun ? "Welcome to GeoTap" : "Your name"}
          </Text>
          <Text style={{ color: "#9aa", fontSize: 13, marginBottom: 6 }}>
            {isFirstRun
              ? "Choose a name for your profile. You can change it later."
              : "This name appears on leaderboards and friend challenges."}
          </Text>

          <TextInput
            value={name}
            onChangeText={onChangeName}
            placeholder="e.g. Mickey Mouse"
            placeholderTextColor="#6b7280"
            autoFocus
            autoCapitalize="words"
            style={{
              backgroundColor: "#0f1a2b",
              borderWidth: 1,
              borderColor: "#23314a",
              color: "#fff",
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              fontSize: 16,
            }}
          />

          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6 }}>
            <TouchableOpacity onPress={() => setName(genRandomName())}>
              <Text style={{ color: "#60a5fa", fontSize: 13 }}>🔄 Shuffle</Text>
            </TouchableOpacity>
          </View>
          {spaceHint && (
            <Text style={{ color: "#9aa", fontSize: 12, marginTop: 4 }}>
              Spaces aren’t allowed — they’re removed automatically.
            </Text>
          )}

          <View style={{ minHeight: 18, marginTop: 6, marginBottom: 2 }}>
            {availability === "checking" && (
              <Text style={{ color: "#9aa", fontSize: 12 }}>Checking availability…</Text>
            )}
            {availability === "unknown" && (
              <Text style={{ color: "#9aa", fontSize: 12 }}>
                Can’t verify right now — we’ll double-check on Save.
              </Text>
            )}
            {availability === "available" && (
              <Text style={{ color: "#22c55e", fontSize: 12 }}>✓ Available</Text>
            )}
            {availability === "invalid" && (
              <Text style={{ color: "#f97316", fontSize: 12 }}>
                Use 3–15 characters: letters, numbers, underscores. No spaces or leading/trailing underscore. Capitals are fine.
              </Text>
            )}
            {availability === "taken" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ color: "#ef4444", fontSize: 12 }}>✕ Taken</Text>
                {!!suggestion && (
                  <TouchableOpacity onPress={() => setName(suggestion)}>
                    <Text style={{ color: "#60a5fa", fontSize: 12 }}>Try “{suggestion}”</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={onSave}
            disabled={saving || availability === "invalid" || availability === "checking" || name.trim().length === 0}
            style={{
              backgroundColor: saving ? "#334155" : "#1F6FEB",
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {saving ? "Saving…" : (isFirstRun ? "Continue" : "Save")}
            </Text>
          </TouchableOpacity>

          {!isFirstRun && (
            <TouchableOpacity
              onPress={() => { allowCloseRef.current = true; setTimeout(() => router.back(), 0); }}
              style={{
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#9aa", fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
