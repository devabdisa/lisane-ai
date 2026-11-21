"use client";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { fontClassNames, getLanguage, isLanguageCode } from "@/config/languages";
import { Link } from "@/i18n/navigation";
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

const shift = [0, 52, 88, 52, 0, -52, -88, -52];

function LearningPath({ path }: { path: Path }) {
  const t = useTranslations("Learn");
  if (path.sections.length === 0) {
    return <p className="px-4 text-body text-fg-muted">{t("empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-8 px-4 pb-8">
      {path.sections.map((section) => (
        <section key={section.id} className="mx-auto flex w-full max-w-sm flex-col gap-5">
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
  const [hintId, setHintId] = useState<string | null>(null);
  const language = isLanguageCode(unit.guidebook.language) ? getLanguage(unit.guidebook.language) : null;
  const lessonNumbers = new Map<string, number>();
  let seenLessons = 0;
  for (const level of unit.levels) {
    if (level.kind === "lesson") seenLessons += 1;
    lessonNumbers.set(level.id, seenLessons);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3 rounded-16 bg-accent-host p-4 text-white">
        <div className={cn("flex min-w-0 flex-1 flex-col gap-1", language && fontClassNames[language.font])} lang={language?.code}>
          <h3 className="text-heading font-semibold">{unit.title}</h3>
          <p className="text-label text-on-dark-muted">{unit.goal}</p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="sr-only">{t("guidebook")}</span>
          <BookIcon />
        </button>
      </div>
      <ol className="flex flex-col items-center gap-1 py-3">
        {unit.levels.map((level, index) => {
          const label = level.kind === "lesson" ? t("lessonNumber", { number: lessonNumbers.get(level.id) ?? index + 1 }) : t(levelKey[level.kind]);
          return (
            <li key={level.id} className="flex w-full justify-center" style={{ transform: `translateX(${shift[index % shift.length]}px)` }}>
              <LevelNode
                unitId={unit.id}
                level={level}
                label={label}
                hinted={hintId === level.id}
                onLocked={() => setHintId((current) => (current === level.id ? null : level.id))}
              />
            </li>
          );
        })}
      </ol>
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

function LevelNode({
  unitId,
  level,
  label,
  hinted,
  onLocked,
}: {
  unitId: string;
  level: Level;
  label: string;
  hinted: boolean;
  onLocked: () => void;
}) {
  const t = useTranslations("Learn");
  const href = `/learn/${unitId}/${level.id}`;
  const circle = cn(
    "flex items-center justify-center rounded-full border-2 shadow-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg",
    level.state === "current" && "size-24 border-b-4 border-midnight bg-action text-on-action",
    level.state === "done" && "size-20 border-action bg-card text-fg",
    level.state === "locked" && "size-20 border-line bg-card text-fg-muted shadow-none",
  );

  return (
    <div className="flex flex-col items-center">
      {level.state === "current" ? (
        <div className="relative mb-3 w-40 rounded-16 border border-line bg-card px-3 py-3 text-center shadow-raised">
          <p className="text-caption font-semibold">{label}</p>
          <Link
            href={href}
            className="mt-2 flex min-h-12 items-center justify-center rounded-full bg-action px-4 text-label font-semibold text-on-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
          >
            {t("start")}
          </Link>
          <span className="absolute -bottom-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 border-r border-b border-line bg-card" />
        </div>
      ) : null}
      {level.state === "locked" ? (
        <button type="button" className={circle} aria-label={`${label}. ${t(stateKey.locked)}`} onClick={onLocked}>
          <LockIcon />
        </button>
      ) : (
        <Link href={href} className={circle} aria-label={`${label}. ${t(stateKey[level.state])}`}>
          <LevelIcon kind={level.kind} done={level.state === "done"} />
        </Link>
      )}
      {level.state === "locked" && hinted ? (
        <p className="mt-2 w-52 text-center text-caption text-fg-muted" role="status">
          {t("lockedHint")}
        </p>
      ) : null}
    </div>
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

function LevelIcon({ kind, done }: { kind: Level["kind"]; done: boolean }) {
  if (done) return <CheckIcon />;
  if (kind === "unit-review") return <TrophyIcon />;
  if (kind === "personal-practice") return <CardsIcon />;
  if (kind === "speaking-roleplay") return <MicIcon />;
  return <StarIcon />;
}

function StarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="m12 3 2.4 5.4 5.9.6-4.5 3.9 1.3 5.8L12 15.8 6.9 18.7l1.3-5.8L3.7 9l5.9-.6L12 3Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M9 20h6M12 14v3" strokeLinecap="round" />
    </svg>
  );
}

function CardsIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="7" y="3" width="12" height="16" rx="2" />
      <path d="M5 7v12a2 2 0 0 0 2 2h10" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" strokeLinecap="round" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5Z" />
      <path d="M5 19.2A2.5 2.5 0 0 1 7.5 17H20" />
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
