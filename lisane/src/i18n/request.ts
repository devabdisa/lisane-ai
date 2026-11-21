import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { defaultLocale } from "@/config/languages";
import { routing } from "./routing";

type Messages = { [key: string]: string | Messages };

// Keys not yet translated in a locale fall back to the English source string.
function withFallback(base: Messages, override: Messages): Messages {
  const merged: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = base[key];
    merged[key] =
      typeof value === "object" && typeof baseValue === "object"
        ? withFallback(baseValue, value)
        : value;
  }
  return merged;
}

async function loadMessages(locale: string): Promise<Messages> {
  const source: Messages = (await import(`../../messages/${defaultLocale}.json`)).default;
  if (locale === defaultLocale) {
    return source;
  }
  const translated: Messages = (await import(`../../messages/${locale}.json`)).default;
  return withFallback(source, translated);
}

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const paramValue = await rootParams.locale();
    if (!hasLocale(routing.locales, paramValue)) {
      notFound();
    }
    locale = paramValue;
  }

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
