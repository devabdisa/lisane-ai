import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "am", "om"],
  defaultLocale: "en",
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type AppLocale = (typeof routing.locales)[number];

// Native names are shown untranslated so learners can always find their language.
// Step 04 moves this into the language registry.
export const localeNativeNames: Record<AppLocale, string> = {
  en: "English",
  am: "አማርኛ",
  om: "Afaan Oromoo",
};
