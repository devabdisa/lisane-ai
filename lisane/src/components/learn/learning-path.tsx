"use client";

import { useTranslations } from "next-intl";
import { useId, useRef } from "react";
import { fontClassNames, getLanguage, isLanguageCode } from "@/config/languages";
import { cn } from "@/lib/cn";
import type { LearningPathDTO } from "@/lib/learning-path";

type Path = LearningPathDTO;
type Unit = Path["sections"][number]["units"][number];
type Level = Unit["levels"][number];

const sectionKey = {
  intro: "sectionIntro",
  a1: "sectionA1",
  a2: "sectionA2",
  b1: "sectionB1",
} as const;

const levelKey = {
  lesson: "levelLesson",
  "unit-review": "levelReview",
  "personal-practice": "levelPractice",
  "speaking-roleplay": "levelRoleplay",
} as const;

const stateKey = {
  locked: "levelLocked",
  current: "levelCurrent",
  done: "levelDone",
} as const;

function LearningPath({ path }: { path: Path }) {
  const t = useTranslations("Learn");
  if (path.sections.length === 0) {
    return <p className="px-4 text-body text-fg-muted">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-8 px-4 pb-6">
      {path.sections.map((section) => (
        <section key={section.id} className="flex flex-col gap-6">
          <h2 className="text-heading font-semibold">{t(sectionKey[section.id])}</h2>
          {section.units.map((unit) => (
            <UnitPath key={unit.id} unit={unit} />
          ))}
        </section>
      ))}
    </div>
  );
}

function UnitPath({ unit }: { unit: Unit }) {
  const t = useTranslations("Learn");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-label font-semibold">{unit.title}</h3>
        <p className="text-body text-fg-muted">{unit.goal}</p>
      </div>
      <ol className="flex flex-col items-center gap-3">
        {unit.levels.map((level, index) => (
          <li key={level.id} className={cn("flex w-full", index % 2 === 0 ? "justify-center" : index % 4 === 1 ? "justify-end pr-8" : "justify-start pl-8")}>
            <LevelNode level={level} onOpen={() => dialogRef.current?.showModal()} />
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="min-h-12 self-start rounded-full border border-line px-4 text-label font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
      >
        {t("guidebook")}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(100%-2rem,32rem)] rounded-16 border border-line bg-canvas p-0 text-fg backdrop:bg-midnight/70"
      >
        <Guidebook unit={unit} titleId={titleId} onClose={() => dialogRef.current?.close()} />
      </dialog>
    </div>
  );
}

function LevelNode({ level, onOpen }: { level: Level; onOpen: () => void }) {
  const t = useTranslations("Learn");
  const label = `${t(levelKey[level.kind])}. ${t(stateKey[level.state])}`;
  const className = cn(
    "flex size-16 items-center justify-center rounded-full border-2 text-label font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
    level.state === "current" && "border-action bg-action text-on-action",
    level.state === "done" && "border-fg bg-field text-fg",
    level.state === "locked" && "border-line bg-card text-fg-muted",
  );

  if (level.state === "locked") {
    return (
      <button type="button" disabled aria-label={label} className={className}>
        <LockIcon />
      </button>
    );
  }

  return (
    <button type="button" aria-label={label} onClick={onOpen} className={className}>
      {level.state === "done" ? <CheckIcon /> : <span aria-hidden>{level.kind === "speaking-roleplay" ? "▶" : "●"}</span>}
    </button>
  );
}

function Guidebook({ unit, titleId, onClose }: { unit: Unit; titleId: string; onClose: () => void }) {
  const t = useTranslations("Learn");
  const language = isLanguageCode(unit.guidebook.language) ? getLanguage(unit.guidebook.language) : null;

  return (
    <div className={cn("flex max-h-[80dvh] flex-col gap-4 overflow-y-auto p-5", language && fontClassNames[language.font])} lang={language?.code}>
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-heading font-semibold">
          {unit.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line focus-visible:outline-2 focus-visible:outline-fg"
        >
          <span className="sr-only">{t("closeGuidebook")}</span>
          <CloseIcon />
        </button>
      </div>
      <p className="text-body">{unit.guidebook.introduction}</p>
      {unit.guidebook.reviewStatus === "draft" ? <p className="text-caption text-fg-muted">{t("guidebookDraft")}</p> : null}
      {unit.guidebook.notes.map((note) => (
        <div key={note.explanation} className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-body">{note.explanation}</p>
          <ul className="flex flex-col gap-2">
            {note.examples.map((example) => (
              <li key={example.id} className="rounded-12 border border-line bg-card px-3 py-2">
                <p className="font-sans text-label font-semibold" lang="en">
                  {example.english}
                </p>
                <p className="text-label text-fg-muted">{example.meaning}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

export { LearningPath };
