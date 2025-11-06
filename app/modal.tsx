import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useEffect, useLayoutEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import setDisplayName from "../lib/profileName";

const KEY_DISPLAY_NAME = "profile.displayName";
const KEY_EDITING_NAME = "profile.editingName";

export default function EditDisplayNameModal() {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const navigation = useNavigation();
  const allowCloseRef = React.useRef(false);
  usePreventRemove(!allowCloseRef.current, () => {
    if (!allowCloseRef.current) {
      Alert.alert("Finish editing", "Please save or cancel to leave this screen.");
    }
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      presentation: "modal",
      headerTitle: "Edit Display Name",
      headerBackVisible: false,
      gestureEnabled: false,
      headerBackButtonMenuEnabled: false,
    });
  }, [navigation]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { await AsyncStorage.setItem(KEY_EDITING_NAME, "1"); } catch {}
      try {
        const raw = await AsyncStorage.getItem(KEY_DISPLAY_NAME);
        if (alive && raw) setName(raw);
      } catch {}
    })();
    return () => {
      alive = false;
      AsyncStorage.removeItem(KEY_EDITING_NAME).catch(() => {});
    };
  }, []);

  const onChangeName = (t: string) => {
    setName(t);
  };

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Please enter a display name.");
      return;
    }
    try {
      setSaving(true);
      await setDisplayName(trimmed);
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
          <Text style={{ color: "#e5e7eb", fontSize: 18, fontWeight: "700" }}>Your name</Text>
          <Text style={{ color: "#9aa", fontSize: 13, marginBottom: 6 }}>
            This name appears on leaderboards and friend challenges.
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

          <View style={{ height: 10 }} />

          <TouchableOpacity
            onPress={onSave}
            disabled={saving}
            style={{
              backgroundColor: saving ? "#334155" : "#1F6FEB",
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              {saving ? "Saving…" : "Save"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { allowCloseRef.current = true; router.back(); }}
            style={{
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#9aa", fontWeight: "600" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
