import { THEME_STORAGE_KEY } from "@core/constants";

export type ThemePreference = "light" | "dark" | "system";

export function readThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    return "system";
  }
  return "system";
}

export function writeThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    return;
  }
}

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "system") {
    return matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

export function applyTheme(resolved: "light" | "dark"): void {
  const root = document.documentElement;
  root.classList.add("theme-transitioning");

  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove("theme-transitioning");
    });
  });
}

export function initTheme(): void {
  const pref = readThemePreference();
  applyTheme(resolveTheme(pref));
  if (pref === "system") {
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", () => {
      const current = readThemePreference();
      if (current === "system") applyTheme(resolveTheme(current));
    });
  }
}
