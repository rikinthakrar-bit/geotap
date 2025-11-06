import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect } from "react";

export default function ArchiveDateRedirect() {
  const { date } = useLocalSearchParams<{ date?: string }>();

  useEffect(() => {
    const d = typeof date === "string" && date ? date : "";
    if (d) {
      // Send to tabbed archive path but without adding another Archive tab
      router.replace((`/?archiveDate=${encodeURIComponent(d)}` as Href));
    } else {
      router.replace("/" as Href);
    }
  }, [date]);

  return null;
}