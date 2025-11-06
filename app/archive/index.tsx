import { router, type Href } from "expo-router";
import { useEffect } from "react";
export default function ArchiveRedirect() {
  useEffect(() => { router.replace("/(tabs)/archive" as Href); }, []);
  return null;
}