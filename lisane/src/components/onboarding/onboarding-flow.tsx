"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { fontClassNames, supportLanguages } from "@/config/languages";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import {
  dailyGoalMinutes,
  englishLevels,
  goals,
  type DailyGoalMinutes,
  type EnglishLevel,
  type Goal,
  type ProfileDTO,
} from "@/schemas/profile";

type Step = "goal" | "level" | "language" | "daily";

const steps: Step[] = ["language", "goal", "level", "daily"];

function OnboardingFlow({ profile }: { profile: ProfileDTO | null }) {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(profile?.goal ?? null);
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel | null>(profile?.englishLevel ?? null);
  const [supportLanguage, setSupportLanguage] = useState<string | null>(
    profile?.supportLanguage ?? (supportLanguages.some((language) => language.code === locale) ? locale : "en"),
  );
  const [minutes, setMinutes] = useState<DailyGoalMinutes | null>(profile?.dailyGoalMinutes ?? null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const step = steps[stepIndex];
  const selected =
    step === "language" ? supportLanguage : step === "goal" ? goal : step === "level" ? englishLevel : minutes;

  async function continueStep() {
    if (selected === null) return;
    setError(null);
    if (stepIndex < steps.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }
    setPending(true);
    const response = await fetch("/api/profile/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal, englishLevel, supportLanguage, dailyGoalMinutes: minutes }),
    });
    setPending(false);
    if (!response.ok) {
      setError(t("failed"));
      return;
    }
    router.replace("/learn");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <div className="flex flex-1 flex-col gap-6 py-8">
        <div className="flex gap-2" aria-hidden>
          {steps.map((item, index) => (
            <span
              key={item}
              className={cn("h-1.5 flex-1 rounded-full", index <= stepIndex ? "bg-fg" : "bg-line")}
            />
          ))}
        </div>
        <h1 className="text-title font-semibold">{t(`${step}Title`)}</h1>
        <div className="flex flex-col gap-3" role="radiogroup" aria-label={t(`${step}Title`)}>
          {step === "language"
            ? supportLanguages.map((language) => (
                <Choice
                  key={language.code}
                  selected={supportLanguage === language.code}
                  lang={language.code}
                  className={fontClassNames[language.font]}
                  label={language.code === "en" ? t("englishOnly") : language.nativeName}
                  onSelect={() => setSupportLanguage(language.code)}
                />
              ))
            : null}
          {step === "goal"
            ? goals.map((item) => (
                <Choice
                  key={item}
                  selected={goal === item}
                  label={t(`goals.${item}`)}
                  onSelect={() => setGoal(item)}
                />
              ))
            : null}
          {step === "level"
            ? englishLevels.map((item) => (
                <Choice
                  key={item}
                  selected={englishLevel === item}
                  label={t(`levels.${item}`)}
                  onSelect={() => setEnglishLevel(item)}
                />
              ))
            : null}
          {step === "daily"
            ? dailyGoalMinutes.map((item) => (
                <Choice
                  key={item}
                  selected={minutes === item}
                  label={t("minutes", { count: item })}
                  onSelect={() => setMinutes(item)}
                />
              ))
            : null}
        </div>
      </div>
      <div className="sticky bottom-0 flex flex-col gap-3 bg-canvas py-4">
        {error ? (
          <p role="alert" className="text-label text-fg">
            {error}
          </p>
        ) : null}
        {stepIndex > 0 ? (
          <button
            type="button"
            className="min-h-12 text-label text-fg-muted"
            onClick={() => setStepIndex(stepIndex - 1)}
          >
            {t("back")}
          </button>
        ) : null}
        <Button type="button" width="full" disabled={selected === null || pending} onClick={continueStep}>
          {t("continue")}
        </Button>
      </div>
    </main>
  );
}

function Choice({
  selected,
  label,
  onSelect,
  lang,
  className,
}: {
  selected: boolean;
  label: string;
  onSelect: () => void;
  lang?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      lang={lang}
      onClick={onSelect}
      className={cn(
        "min-h-14 rounded-16 border px-4 text-left text-body",
        selected ? "border-fg bg-field font-semibold" : "border-line bg-card",
        className,
      )}
    >
      {label}
    </button>
  );
}

export { OnboardingFlow };
