import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";
import { routing } from "./routing";

async function loadMessages(locale: string) {
  try {
    return (await import(`../../messages/${locale}.json`)).default;
  } catch {
    // am/om message files are drafted in step 04; until then those locales render English.
    return (await import("../../messages/en.json")).default;
  }
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
