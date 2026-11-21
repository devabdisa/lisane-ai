import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Ethiopic } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ThemeScript } from "@/components/theme-script";
import { ThemeSync } from "@/components/theme-sync";
import { fontClassNames, getLanguage } from "@/config/languages";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSansEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-noto-ethiopic",
  subsets: ["ethiopic"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
    title: t("title"),
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: "#0b0f14",
  viewportFit: "cover",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const language = getLanguage(locale);

  return (
    <html
      lang={locale}
      dir={language.dir}
      // Theme attributes are set by ThemeScript before paint; suppress the mismatch warning.
      suppressHydrationWarning
      className={`${inter.variable} ${notoSansEthiopic.variable} ${fontClassNames[language.font]} h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col bg-canvas text-fg">
        <ThemeSync />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
