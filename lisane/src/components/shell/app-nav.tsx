"use client";

import { useTranslations } from "next-intl";
import type { ComponentType, SVGProps } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { LearnIcon, PracticeIcon, ProfileIcon, ProgressIcon, SpeakIcon } from "./nav-icons";

type NavItem = {
  href: "/learn" | "/speak" | "/practice" | "/progress" | "/profile";
  labelKey: "learn" | "speak" | "practice" | "progress" | "profile";
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const navItems: NavItem[] = [
  { href: "/learn", labelKey: "learn", Icon: LearnIcon },
  { href: "/speak", labelKey: "speak", Icon: SpeakIcon },
  { href: "/practice", labelKey: "practice", Icon: PracticeIcon },
  { href: "/progress", labelKey: "progress", Icon: ProgressIcon },
  { href: "/profile", labelKey: "profile", Icon: ProfileIcon },
];

// The bar sits on the accent-host surface, which stays Midnight in both themes,
// so lime and on-dark text are valid here even in the light theme.
function AppNav() {
  const t = useTranslations("Navigation");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className="sticky bottom-0 z-10 border-t border-line bg-accent-host pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:top-0 md:order-first md:h-dvh md:border-t-0 md:border-r md:px-2 md:py-6"
    >
      <ul className="flex md:flex-col md:gap-2">
        {navItems.map(({ href, labelKey, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center gap-1 rounded-8 text-caption focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:w-20 md:py-2",
                  active ? "font-semibold text-accent" : "text-on-dark-muted hover:text-white",
                )}
              >
                <Icon />
                <span>{t(labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { AppNav };
