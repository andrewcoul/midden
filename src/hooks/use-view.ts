import { useEffect, useState } from "react";
import type { View } from "@/components/file-list";

/** List or grid, remembered in this browser. */
export function useView(key = "midden:view"): [View, (v: View) => void] {
  const [view, setView] = useState<View>("list");
  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved === "list" || saved === "grid") setView(saved);
  }, [key]);
  return [
    view,
    (v) => {
      setView(v);
      localStorage.setItem(key, v);
    },
  ];
}
