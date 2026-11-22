"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { fontClassNames, supportLanguages } from "@/config/languages";
import { getPathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import {
  dailyGoalMinutes,
  englishLevels,
  goals,
  onboardingSchema,
  type DailyGoalMinutes,
  type EnglishLevel,
  type Goal,
  type ProfileDTO,
} from "@/schemas/profile";

const profileSteps = ["language", "goal", "level", "daily"] as const;
type Start = "learn" | "speak";
type FirstUnit = { title: string; language: string };

function OnboardingFlow({ profile, firstUnit }: { profile: ProfileDTO | null; firstUnit: FirstUnit | null }) {
  const t = useTranslations("Onboarding");
  const locale = useLocale();
  const steps = profile?.onboardingCompleted ? profileSteps : [...profileSteps, "start"] as const;
  const [stepIndex, setStepIndex] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(profile?.goal ?? null);
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel | null>(profile?.englishLevel ?? null);
  const [supportLanguage, setSupportLanguage] = useState(
    supportLanguages.find((language) => language.code === profile?.supportLanguage)?.code ??
      supportLanguages.find((language) => language.code === locale)?.code ?? "en",
  );
  const [minutes, setMinutes] = useState<DailyGoalMinutes | null>(profile?.dailyGoalMinutes ?? null);
  const [start, setStart] = useState<Start>("learn");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  const step = steps[stepIndex];
  const selected = { language: supportLanguage, goal, level: englishLevel, daily: minutes, start }[step];
  const lastStep = stepIndex === steps.length - 1;

  async function continueStep() {
    if (selected === null || pending) return;
    setError(false);
    if (!lastStep) {
      setStepIndex(stepIndex + 1);
      window.scrollTo(0, 0);
      return;
    }

    setPending(true);
    const answers = onboardingSchema.safeParse({ goal, englishLevel, supportLanguage, dailyGoalMinutes: minutes });
    if (!answers.success) {
      const field = String(answers.error.issues[0]?.path[0] ?? "");
      const stepForField = { supportLanguage: "language", goal: "goal", englishLevel: "level", dailyGoalMinutes: "daily" }[field];
      if (stepForField) setStepIndex(steps.indexOf(stepForField as (typeof steps)[number]));
      setError(true);
      setPending(false);
      return;
    }
    try {
      const response = await fetch("/api/profile/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(answers.data),
      });
      if (!response.ok) {
        setError(true);
        return;
      }
      window.location.replace(getPathname({ href: start === "speak" ? "/speak" : "/learn", locale }));
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5">
      <div className="flex flex-1 flex-col gap-5 py-6 sm:py-8">
        <Brand />
        <div
          role="progressbar"
          aria-label={t("setupProgress")}
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={stepIndex + 1}
          className="flex gap-1.5"
        >
          {steps.map((item, index) => (
            <span key={item} className={cn("h-1.5 flex-1 rounded-full", index <= stepIndex ? "bg-fg" : "bg-line")} />
          ))}
        </div>
        <div>
          <h1 id="onboarding-title" className="text-title font-bold tracking-tight">{t(`${step}Title`)}</h1>
          <p className="mt-1 text-label text-fg-muted">{t(`${step}Hint`)}</p>
        </div>
        <fieldset
          key={step}
          aria-labelledby="onboarding-title"
          disabled={pending}
          className={cn("min-w-0 gap-2.5", step === "daily" ? "grid grid-cols-2" : "flex flex-col")}
        >
          {step === "language" ? supportLanguages.map((language) => (
            <Choice
              key={language.code}
              name={step}
              selected={supportLanguage === language.code}
              label={language.code === "en" ? t("englishOnly") : language.nativeName}
              labelLanguage={language.code === "en" ? undefined : language.code}
              labelClass={fontClassNames[language.font]}
              description={language.code === "en" ? t("englishOnlyHint") : language.englishName}
              onSelect={() => setSupportLanguage(language.code)}
            />
          )) : null}
          {step === "goal" ? goals.map((item) => (
            <Choice
              key={item} name={step} selected={goal === item}
              label={t(`goals.${item}`)} description={t(`goalDetails.${item}`)} onSelect={() => setGoal(item)}
            />
          )) : null}
          {step === "level" ? englishLevels.map((item) => (
            <Choice
              key={item} name={step} selected={englishLevel === item}
              label={t(`levels.${item}`)} description={t(`levelDetails.${item}`)} onSelect={() => setEnglishLevel(item)}
            />
          )) : null}
          {step === "daily" ? dailyGoalMinutes.map((item) => (
            <Choice key={item} name={step} selected={minutes === item} label={t("minutes", { count: item })} onSelect={() => setMinutes(item)} />
          )) : null}
          {step === "start" ? (
            <>
              <Choice name={step} selected={start === "learn"} label={t("startLearn")} description={t("startLearnHint")} onSelect={() => setStart("learn")} />
              {firstUnit && start === "learn" ? (
                <div className="mx-2 border-l-2 border-line pl-3">
                  <p className="text-caption text-fg-muted">{t("firstUnit")}</p>
                  <p lang={firstUnit.language} className="text-label font-semibold">{firstUnit.title}</p>
                </div>
              ) : null}
              <Choice name={step} selected={start === "speak"} label={t("startSpeak")} description={t("startSpeakHint")} onSelect={() => setStart("speak")} />
            </>
          ) : null}
        </fieldset>
      </div>
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-canvas pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error ? <p role="alert" className="text-label">{t("failed")}</p> : null}
        <div className="flex items-center gap-2">
          {stepIndex > 0 ? (
            <Button
              type="button" hierarchy="secondary" disabled={pending}
              onClick={() => {
                setError(false);
                setStepIndex(stepIndex - 1);
                window.scrollTo(0, 0);
              }}
            >
              {t("back")}
            </Button>
          ) : null}
          <Button type="button" width="full" disabled={selected === null || pending} onClick={() => void continueStep()}>
            {pending ? t("saving") : lastStep ? t("finish") : t("continue")}
          </Button>
        </div>
      </div>
    </main>
  );
}

function Choice({ name, selected, label, description, labelLanguage, labelClass, onSelect }: {
  name: string;
  selected: boolean;
  label: string;
  description?: string;
  labelLanguage?: string;
  labelClass?: string;
  onSelect: () => void;
}) {
  return (
    <label className={cn(
      "flex min-w-0 cursor-pointer items-center gap-3 rounded-16 border px-3 py-2.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-fg sm:px-4",
      selected ? "border-fg bg-field" : "border-line bg-card",
    )}>
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full border", selected ? "border-fg" : "border-fg-muted")}>
        {selected ? <span className="size-2.5 rounded-full bg-fg" /> : null}
      </span>
      <span className="min-w-0">
        <span lang={labelLanguage} className={cn("block text-label font-semibold", labelClass)}>{label}</span>
        {description ? <span className="block text-caption text-fg-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export { OnboardingFlow };
