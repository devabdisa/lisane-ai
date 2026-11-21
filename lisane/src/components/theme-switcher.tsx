"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import {
  themeCookieValue,
  themePreferences,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";
import { cn } from "@/lib/cn";

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  const resolved: ResolvedTheme =
    preference === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : preference;
  root.dataset.themePreference = preference;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  document.cookie = themeCookieValue(preference);
}

function ThemeSwitcher({
  className,
  initialPreference,
}: {
  className?: string;
  initialPreference: ThemePreference;
}) {
  const t = useTranslations("ThemeSwitcher");
  const groupName = useId();
  const [preference, setPreference] = useState(initialPreference);

  function select(next: ThemePreference) {
    setPreference(next);
    applyTheme(next);
  }

  return (
    <fieldset className={cn("flex w-full flex-col rounded-12 bg-canvas p-1", className)}>
      <legend className="sr-only">{t("label")}</legend>
      {themePreferences.map((value) => {
        const selected = value === preference;
        return (
          <label
            key={value}
            className={cn(
              "flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-8 p-3 text-label text-fg has-focus-visible:outline-2 has-focus-visible:outline-fg",
              selected && "bg-field font-semibold",
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={value}
              checked={selected}
              onChange={() => select(value)}
              className="sr-only"
            />
            <span>{t(value)}</span>
            {selected && <span aria-hidden>✓</span>}
          </label>
        );
      })}
    </fieldset>
  );
}

export { ThemeSwitcher };
