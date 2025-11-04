import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!);

export async function upsertDaily(deviceId: string, dateISO: string, totalKm: number) {
  const { error } = await supabase
    .from("daily_results_public")
    .upsert({ device_id: deviceId, date_iso: dateISO, total_km: totalKm }, { onConflict: "device_id,date_iso" });
  if (error) throw error;
}

export async function fetchRange(deviceId: string, fromISO: string, toISO: string) {
  const { data, error } = await supabase
    .from("daily_results_public")
    .select("date_iso,total_km")
    .eq("device_id", deviceId)
    .gte("date_iso", fromISO)
    .lte("date_iso", toISO);
  if (error) throw error;
  return data as { date_iso: string; total_km: number }[];
}