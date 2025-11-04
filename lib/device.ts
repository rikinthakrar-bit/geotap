// lib/device.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const KEY = "device_id_v1";

export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) return existing;

  const id = await Crypto.randomUUID(); // ✅ no polyfill needed
  await AsyncStorage.setItem(KEY, id);
  return id;
}