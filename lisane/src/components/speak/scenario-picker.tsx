"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { speakScenarios, type SpeakScenarioId } from "@/config/scenarios";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

const scenarioLabel = {
  self_introduction: "selfIntroduction",
  job_interview: "jobInterview",
  workplace: "workplace",
  university: "university",
} as const;

function ScenarioPicker({
  scenario,
  customIdea,
  onScenario,
  onCustomIdea,
}: {
  scenario: SpeakScenarioId | null;
  customIdea: string;
  onScenario: (scenario: SpeakScenarioId | null) => void;
  onCustomIdea: (idea: string) => void;
}) {
  const t = useTranslations("Speak");
  const fieldId = useId();
  const idea = customIdea.trim().length > 0;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-label font-medium text-fg">{t("scenarioLabel")}</legend>
      <div className="grid grid-cols-2 gap-2">
        {speakScenarios.map((item) => {
          const selected = !idea && scenario === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onCustomIdea("");
                onScenario(selected ? null : item.id);
              }}
              className={cn(
                "min-h-12 rounded-12 border px-3 py-2 text-label",
                selected ? "border-fg bg-field font-semibold" : "border-line bg-card",
              )}
            >
              {t(scenarioLabel[item.id])}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId}>{t("customIdeaLabel")}</Label>
        <Input
          id={fieldId}
          name="customIdea"
          maxLength={200}
          value={customIdea}
          placeholder={t("customIdeaPlaceholder")}
          onChange={(event) => {
            onCustomIdea(event.target.value);
            if (event.target.value.trim()) onScenario(null);
          }}
        />
      </div>
    </fieldset>
  );
}

export { ScenarioPicker };
