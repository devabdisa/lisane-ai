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
import { requireAppUser } from "@/lib/require-app-user";
import { getLanguage, isLanguageCode } from "@/config/languages";
import { Link } from "@/i18n/navigation";
import { getProfile } from "@/server/services/profile/profile";

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
  const onboarding = await getTranslations("Onboarding");
  const user = await requireAppUser();
  const profile = await getProfile(user.id);
  const supportName =
    profile?.supportLanguage && isLanguageCode(profile.supportLanguage)
      ? profile.supportLanguage === "en"
        ? onboarding("englishOnly")
        : getLanguage(profile.supportLanguage).nativeName
      : null;

  return (
    <PlaceholderScreen title={t("title")} description={t("description")}>
      {profile?.onboardingCompleted && profile.goal && profile.englishLevel && profile.dailyGoalMinutes ? (
        <Card>
          <CardTitle>{t("setup")}</CardTitle>
          <dl className="flex flex-col gap-2 text-body">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">{t("goal")}</dt>
              <dd>{onboarding(`goals.${profile.goal}`)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">{t("level")}</dt>
              <dd>{onboarding(`levels.${profile.englishLevel}`)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">{t("supportLanguage")}</dt>
              <dd>{supportName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">{t("dailyGoal")}</dt>
              <dd>{onboarding("minutes", { count: profile.dailyGoalMinutes })}</dd>
            </div>
          </dl>
          <Link href="/onboarding" className="text-label font-semibold underline-offset-2 hover:underline">
            {t("editSetup")}
          </Link>
        </Card>
      ) : null}
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
