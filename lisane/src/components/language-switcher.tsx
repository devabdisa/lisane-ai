"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeNativeNames, routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("LanguageSwitcher");
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  // Cache Components keeps previous routes mounted but hidden, so a shared
  // radio name would join their groups across the document.
  const groupName = useId();

  function selectLocale(locale: AppLocale) {
    startTransition(() => {
      router.replace(pathname, { locale });
    });
  }

  return (
    <fieldset
      aria-busy={isPending}
      className={cn("flex w-full flex-col rounded-12 bg-canvas p-1", className)}
    >
      <legend className="sr-only">{t("label")}</legend>
      {routing.locales.map((locale) => {
        const selected = locale === currentLocale;
        return (
          <label
            key={locale}
            lang={locale}
            className={cn(
              "flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-8 p-3 text-label text-fg has-focus-visible:outline-2 has-focus-visible:outline-fg",
              selected && "bg-field font-semibold",
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={locale}
              checked={selected}
              disabled={isPending}
              onChange={() => selectLocale(locale)}
              className="sr-only"
            />
            <span>{localeNativeNames[locale]}</span>
            {selected && <span aria-hidden>✓</span>}
          </label>
        );
      })}
    </fieldset>
  );
}

export { LanguageSwitcher };
