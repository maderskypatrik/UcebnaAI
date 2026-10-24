import { useSyncExternalStore } from "react";
import type { Template } from "./schemas";

const KEY = "ucebna:last-settings";
let cachedRaw: string | null = null;
let cached: Template | null = null;

function read(): Template | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  // useSyncExternalStore needs the same object back while nothing changed.
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? (JSON.parse(raw) as Template) : null;
    } catch {
      cached = null;
    }
  }
  return cached;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

/** The school, class, subject and parts of the teacher's last test on this device, so the next one starts there. */
export function useLastSettings(): Template | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function saveLastSettings(settings: Template) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {}
}
