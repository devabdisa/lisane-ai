"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

function PlansLink() {
  const t = useTranslations("Navigation");
  const pathname = usePathname();
  const active = pathname === "/plans" || pathname.startsWith("/plans/");

  return (
    <Link
      href="/plans"
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-3 text-label font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
        active ? "border-fg bg-field" : "border-line",
      )}
    >
      {t("plans")}
    </Link>
  );
}

export { PlansLink };
