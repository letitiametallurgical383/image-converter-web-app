import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  type ThemePreference,
  writeThemePreference,
} from "@presentation/theme/initTheme";
import { useCallback, useEffect, useState } from "react";

export function useTheme(): {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readThemePreference(),
  );
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    resolveTheme(readThemePreference()),
  );

  useEffect(() => {
    const r = resolveTheme(preference);
    setResolved(r);
    applyTheme(r);
    writeThemePreference(preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = resolveTheme("system");
      setResolved(r);
      applyTheme(r);
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
  }, []);

  const toggle = useCallback(() => {
    setPreferenceState((prev) => {
      const current = resolveTheme(prev);
      return current === "dark" ? "light" : "dark";
    });
  }, []);

  return { preference, resolved, setPreference, toggle };
}
