import { cookies } from "next/headers";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { PlaceholderScreen } from "@/components/shell/placeholder-screen";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { parseThemePreference, THEME_COOKIE } from "@/lib/theme";

async function AppearanceCard() {
  const t = await getTranslations("Profile");
  const cookieStore = await cookies();
  const initialPreference = parseThemePreference(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <Card>
      <CardTitle>{t("appearance")}</CardTitle>
      <ThemeSwitcher initialPreference={initialPreference} />
    </Card>
  );
}

export default async function ProfilePage() {
  const t = await getTranslations("Profile");

  return (
    <PlaceholderScreen title={t("title")} description={t("description")}>
      <Suspense
        fallback={
          <Card>
            <CardTitle>{t("appearance")}</CardTitle>
            <Skeleton className="h-36 w-full rounded-12" />
          </Card>
        }
      >
        <AppearanceCard />
      </Suspense>
      <Card>
        <CardTitle>{t("appLanguage")}</CardTitle>
        <LanguageSwitcher />
      </Card>
      <SignOutButton />
    </PlaceholderScreen>
  );
}
