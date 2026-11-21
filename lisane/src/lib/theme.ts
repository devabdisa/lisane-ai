export const THEME_COOKIE = "THEME";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const themePreferences = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: string): value is ThemePreference {
  return (themePreferences as readonly string[]).includes(value);
}

export function parseThemePreference(value: string | undefined | null): ThemePreference {
  return value && isThemePreference(value) ? value : "system";
}

// Runs before paint so the first frame already has the right theme.
export const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var p=m?decodeURIComponent(m[1]):"system";if(p!=="light"&&p!=="dark")p="system";var r=p==="system"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;var h=document.documentElement;h.dataset.theme=r;h.dataset.themePreference=p;h.style.colorScheme=r;}catch(e){}})();`;

export function themeCookieValue(preference: ThemePreference): string {
  return `${THEME_COOKIE}=${encodeURIComponent(preference)}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}
