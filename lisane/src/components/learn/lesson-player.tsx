"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { LessonExercise } from "@/components/learn/lesson-exercise";
import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { getPathname, Link, useRouter } from "@/i18n/navigation";
import { fontClassNames, getLanguage, isLanguageCode } from "@/config/languages";
import type { LessonAttempt, LessonDTO, PublicExercise } from "@/lib/lesson";
import { cn } from "@/lib/cn";

const levelKey = {
  lesson: "levelLesson",
  "unit-review": "levelReview",
  "personal-practice": "levelPractice",
  "speaking-roleplay": "levelRoleplay",
} as const;

const promptKey = {
  "select-meaning": "selectPrompt",
  "listen-and-pick": "listenPrompt",
  "match-pairs": "matchPrompt",
  "word-bank-translate": "wordBankPrompt",
  "fill-blank": "fillPrompt",
  "type-what-you-hear": "typePrompt",
  "speak-sentence": "speakPrompt",
} as const;

function LessonPlayer({ lesson }: { lesson: LessonDTO }) {
  if (lesson.exercises.length === 0) return <LessonGate lesson={lesson} />;
  return <LessonRun lesson={lesson} />;
}

function LessonRun({ lesson }: { lesson: LessonDTO }) {
  const [attempts, setAttempts] = useState<LessonAttempt[]>([]);
  const index = attempts.length;
  const exercise = lesson.exercises[index];
  if (!exercise) return <LessonComplete />;
  return (
    <Question
      key={exercise.id}
      lesson={lesson}
      exercise={exercise}
      index={index}
      total={lesson.exercises.length}
      onSave={(attempt) => saveLesson(lesson.unitId, lesson.levelId, [...attempts, attempt])}
      onAdvance={(attempt) => setAttempts((current) => current.length === index ? [...current, attempt] : current)}
    />
  );
}

function Question({
  lesson,
  exercise,
  index,
  total,
  onSave,
  onAdvance,
}: {
  lesson: LessonDTO;
  exercise: PublicExercise;
  index: number;
  total: number;
  onSave: (attempt: LessonAttempt) => Promise<boolean>;
  onAdvance: (attempt: LessonAttempt) => void;
}) {
  const t = useTranslations("Learn");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [attempt, setAttempt] = useState<LessonAttempt | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string; answerLanguage: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState(false);
  const answered = index + (feedback ? 1 : 0);

  function leave() {
    router.push("/learn");
    router.refresh();
  }

  async function check(submitted: LessonAttempt | null = attempt) {
    if (!submitted || checking || feedback) return;
    setChecking(true);
    setProblem(false);
    try {
      const response = await fetch(`/api/learn/levels/${lesson.unitId}/${lesson.levelId}/check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submitted),
      });
      const grade = readGrade(await response.json().catch(() => null));
      if (!response.ok || !grade) {
        setProblem(true);
        return;
      }
      setFeedback(grade);
    } catch {
      setProblem(true);
    } finally {
      setChecking(false);
    }
  }

  async function continueForward() {
    if (!attempt || !feedback || checking) return;
    if (index + 1 < total) {
      onAdvance(attempt);
      return;
    }
    setChecking(true);
    setProblem(false);
    const saved = await onSave(attempt);
    setChecking(false);
    if (saved) onAdvance(attempt);
    else setProblem(true);
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-canvas">
      <header className="flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => (index === 0 && !feedback ? leave() : dialogRef.current?.showModal())}
          className="flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          <span className="sr-only">{t("quit")}</span>
          <CloseIcon />
        </button>
        <div
          className="h-4 flex-1 overflow-hidden rounded-full bg-field"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
          aria-label={t("lessonProgress", { current: Math.min(total, index + 1), total })}
        >
          <div className="h-full rounded-full bg-action transition-[width] duration-300" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 pt-6">
        <h1 className="sr-only">{lesson.kind === "lesson" ? t("lessonNumber", { number: lesson.lessonNumber }) : t(levelKey[lesson.kind])}</h1>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-3">
          <LessonExercise
            exercise={exercise}
            supportLanguage={lesson.supportLanguage}
            disabled={feedback !== null || checking}
            prompt={t(promptKey[exercise.kind])}
            playLabel={t("listenPlay")}
            listenUnavailable={t("listenUnavailable")}
            matchHint={t("matchPrompt")}
            matchMiss={t("matchMiss")}
            typePlaceholder={t("typePlaceholder")}
            transcribeUrl={`/api/learn/levels/${lesson.unitId}/${lesson.levelId}/transcribe`}
            onAttempt={setAttempt}
            onSolved={(matched) => {
              setAttempt(matched);
              void check(matched);
            }}
          />
        </div>
        <footer className="shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {problem ? <p className="mb-3 text-label text-fg-muted" role="status">{t(feedback ? "couldNotSave" : "couldNotCheck")}</p> : null}
          {feedback ? (
            <div className={cn("flex flex-col gap-3 rounded-16 p-4", feedback.correct ? "bg-accent-host text-white" : "bg-card text-fg")}>
              <p className={cn("text-heading font-semibold", feedback.correct && "text-accent")}>{feedback.correct ? t("correct") : t("incorrect")}</p>
              {!feedback.correct && feedback.answer ? (
                <p lang={feedback.answerLanguage} className={cn("text-body", answerFont(feedback.answerLanguage))}>
                  {feedback.answerLanguage === "en" ? t("correctAnswer", { answer: feedback.answer }) : feedback.answer}
                </p>
              ) : null}
              <Button onClick={() => void continueForward()} disabled={checking} width="full">
                {t("continue")}
              </Button>
            </div>
          ) : exercise.kind === "match-pairs" && !attempt ? (
            <div className="h-12" />
          ) : (
            <Button onClick={() => void check()} disabled={!attempt || checking} width="full">
              {t("check")}
            </Button>
          )}
        </footer>
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-16 border border-line bg-canvas p-5 text-fg backdrop:bg-midnight/70"
      >
        <h2 id={titleId} className="text-heading font-semibold">
          {t("quitTitle")}
        </h2>
        <p className="mt-2 text-body text-fg-muted">{t("quitBody")}</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={() => dialogRef.current?.close()} width="full">
            {t("stay")}
          </Button>
          <Button hierarchy="secondary" onClick={leave} width="full">
            {t("leave")}
          </Button>
        </div>
      </dialog>
    </div>
  );
}

function LessonComplete() {
  const t = useTranslations("Learn");
  const pathHref = getPathname({ href: "/learn", locale: useLocale() });
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <Mascot />
      <h1 className="text-title font-semibold">{t("completeTitle")}</h1>
      <p className="max-w-sm text-body text-fg-muted">{t("completeBody")}</p>
      <Button
        width="full"
        className="max-w-sm"
        onClick={() => window.location.assign(pathHref)}
      >
        {t("backToPath")}
      </Button>
    </div>
  );
}

function LessonGate({ lesson }: { lesson: LessonDTO }) {
  const t = useTranslations("Learn");
  const router = useRouter();
  const pathHref = getPathname({ href: "/learn", locale: useLocale() });
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(false);

  async function moveOn() {
    setSaving(true);
    const saved = await saveLesson(lesson.unitId, lesson.levelId, []);
    setSaving(false);
    if (!saved) {
      setProblem(true);
      return;
    }
    window.location.assign(pathHref);
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-canvas px-6 pt-[max(1rem,env(safe-area-inset-top))]">
      <button type="button" onClick={() => router.push("/learn")} className="flex size-11 items-center justify-center self-start rounded-full">
        <span className="sr-only">{t("quit")}</span>
        <CloseIcon />
      </button>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 text-center">
        <Mascot />
        <h1 className="text-title font-semibold">{t(levelKey[lesson.kind])}</h1>
        <p className="text-body text-fg-muted">{t("gateBody")}</p>
        {problem ? <p className="text-label text-fg-muted" role="status">{t("couldNotSave")}</p> : null}
        {lesson.kind === "speaking-roleplay" ? (
          <Button asChild hierarchy="secondary" width="full">
            <Link href="/speak">{t("openSpeak")}</Link>
          </Button>
        ) : null}
        <Button onClick={() => void moveOn()} disabled={saving} width="full">
          {t("moveOn")}
        </Button>
      </div>
    </div>
  );
}

async function saveLesson(unitId: string, levelId: string, attempts: LessonAttempt[]) {
  try {
    const response = await fetch(`/api/learn/levels/${unitId}/${levelId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attempts }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function readGrade(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const grade = value as { correct?: unknown; answer?: unknown; answerLanguage?: unknown };
  if (typeof grade.correct !== "boolean" || typeof grade.answer !== "string" || typeof grade.answerLanguage !== "string") return null;
  return { correct: grade.correct, answer: grade.answer, answerLanguage: grade.answerLanguage };
}

function answerFont(language: string) {
  if (!isLanguageCode(language)) return "font-sans";
  return fontClassNames[getLanguage(language).font];
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

export { LessonPlayer };
