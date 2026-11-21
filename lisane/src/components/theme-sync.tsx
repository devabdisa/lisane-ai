"use client";

import { useEffect } from "react";
import { parseThemePreference, type ResolvedTheme } from "@/lib/theme";

function applyResolvedTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");

    function sync() {
      const preference = parseThemePreference(document.documentElement.dataset.themePreference);
      if (preference === "system") {
        applyResolvedTheme(media.matches ? "light" : "dark");
      }
    }

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return null;
}

export { ThemeSync };
