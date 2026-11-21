import { defineRouting } from "next-intl/routing";
import { defaultLocale, uiLocales } from "@/config/languages";

export const routing = defineRouting({
  locales: uiLocales,
  defaultLocale,
  localeCookie: {
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type AppLocale = (typeof routing.locales)[number];
