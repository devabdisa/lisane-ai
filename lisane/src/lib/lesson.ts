import { lessonAudioPath } from "./lesson-audio.ts";
import { defaultLocale } from "../config/languages.ts";
import type { CurriculumUnit } from "../schemas/curriculum.ts";

type Phrase = CurriculumUnit["phrases"][number];
type Level = CurriculumUnit["levels"][number];
type LessonLevel = Extract<Level, { kind: "lesson" | "unit-review" }>;
type Exercise = LessonLevel["lessons"][number]["exercises"][number];

export type LessonChoice = { id: string; label: string };

export type PublicExercise =
  | { id: string; kind: "select-meaning"; prompt: string; choices: LessonChoice[] }
  | { id: string; kind: "listen-and-pick"; spoken: string; audioSrc: string; choices: LessonChoice[] }
  | { id: string; kind: "match-pairs"; english: LessonChoice[]; meanings: LessonChoice[] }
  | {
      id: string;
      kind: "word-bank-translate";
      prompt: string;
      tiles: string[];
      direction: "support-to-english" | "english-to-support";
    }
  | { id: string; kind: "fill-blank"; hint: string; before: string; after: string; choices: string[] }
  | { id: string; kind: "type-what-you-hear"; spoken: string; audioSrc: string }
  | { id: string; kind: "speak-sentence"; prompt: string };

export type LessonDTO = {
  unitId: string;
  levelId: string;
  kind: Level["kind"];
  lessonNumber: number;
  supportLanguage: string;
  exercises: PublicExercise[];
};

export type LessonAttempt = {
  exerciseId: string;
  choiceId?: string;
  tiles?: string[];
  text?: string;
  pairs?: { englishId: string; meaningId: string }[];
};

export type LessonGrade =
  | { status: "graded"; correct: boolean; answer: string; answerLanguage: string }
  | { status: "invalid" }
  | { status: "unknown" };

function phrasesOf(unit: CurriculumUnit) {
  return new Map(unit.phrases.map((phrase) => [phrase.id, phrase]));
}

function meaning(phrase: Phrase, language: string) {
  return phrase.meaning[language]?.text ?? phrase.meaning[defaultLocale].text;
}

function supportAnswers(phrase: Phrase, language: string) {
  const translated = phrase.meaning[language] ?? phrase.meaning[defaultLocale];
  return [translated.text, ...(translated.alternatives ?? [])];
}

function englishAnswers(phrase: Phrase) {
  return [phrase.english.text, ...(phrase.english.alternatives ?? [])];
}

export function normalizeLessonAnswer(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{M}\p{N}\s']/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchesAnswer(value: string, accepted: string[]) {
  const normalized = normalizeLessonAnswer(value);
  return normalized.length > 0 && accepted.some((answer) => normalizeLessonAnswer(answer) === normalized);
}

export function shuffleLessonItems<T>(items: readonly T[], random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function choice(phrases: Map<string, Phrase>, id: string, language: string): LessonChoice | null {
  const phrase = phrases.get(id);
  if (!phrase) return null;
  return { id, label: meaning(phrase, language) };
}

function presentExercise(
  exercise: Exercise,
  phrases: Map<string, Phrase>,
  language: string,
  random: () => number,
): PublicExercise | null {
  if (exercise.kind === "match-pairs") {
    const pairs = exercise.phraseIds.flatMap((id) => {
      const phrase = phrases.get(id);
      if (!phrase) return [];
      return [{ id, english: phrase.english.text, meaning: meaning(phrase, language) }];
    });
    if (pairs.length !== exercise.phraseIds.length) return null;
    return {
      id: exercise.id,
      kind: "match-pairs",
      english: shuffleLessonItems(pairs.map((pair) => ({ id: pair.id, label: pair.english })), random),
      meanings: shuffleLessonItems(pairs.map((pair) => ({ id: pair.id, label: pair.meaning })), random),
    };
  }

  const phrase = phrases.get(exercise.phraseId);
  if (!phrase) return null;

  if (exercise.kind === "select-meaning" || exercise.kind === "listen-and-pick") {
    const choices = shuffleLessonItems(
      [exercise.phraseId, ...exercise.distractorPhraseIds].flatMap((id) => {
        const item = choice(phrases, id, language);
        return item ? [item] : [];
      }),
      random,
    );
    if (exercise.kind === "listen-and-pick") return { id: exercise.id, kind: exercise.kind, spoken: phrase.english.text, audioSrc: lessonAudioPath(phrase.english.text), choices };
    return { id: exercise.id, kind: exercise.kind, prompt: phrase.english.text, choices };
  }

  if (exercise.kind === "word-bank-translate") {
    const english = phrase.english.text;
    const support = meaning(phrase, language);
    const target = exercise.direction === "support-to-english" ? english : support;
    return {
      id: exercise.id,
      kind: exercise.kind,
      direction: exercise.direction,
      prompt: exercise.direction === "support-to-english" ? support : english,
      tiles: shuffleLessonItems(target.trim().split(/\s+/), random),
    };
  }

  if (exercise.kind === "fill-blank") {
    return {
      id: exercise.id,
      kind: exercise.kind,
      hint: meaning(phrase, language),
      before: exercise.before,
      after: exercise.after,
      choices: shuffleLessonItems([exercise.answer, ...exercise.distractors], random),
    };
  }

  if (exercise.kind === "type-what-you-hear") return { id: exercise.id, kind: exercise.kind, spoken: phrase.english.text, audioSrc: lessonAudioPath(phrase.english.text) };
  return { id: exercise.id, kind: exercise.kind, prompt: phrase.english.text };
}

export function buildPersonalPractice(unit: CurriculumUnit, language: string, random: () => number = Math.random): PublicExercise[] {
  return unit.phrases.flatMap((phrase) => {
    const distractors = shuffleLessonItems(
      unit.phrases.filter((item) => item.id !== phrase.id),
      random,
    ).slice(0, 2);
    if (distractors.length < 2) return [];
    return [
      {
        id: phrase.id,
        kind: "select-meaning" as const,
        prompt: phrase.english.text,
        choices: shuffleLessonItems([phrase, ...distractors], random).map((item) => ({ id: item.id, label: meaning(item, language) })),
      },
    ];
  });
}

export function buildPublicExercises(
  unit: CurriculumUnit,
  level: LessonLevel,
  language: string,
  random: () => number = Math.random,
) {
  const phrases = phrasesOf(unit);
  return level.lessons.flatMap((lesson) =>
    lesson.exercises.flatMap((exercise) => {
      const presented = presentExercise(exercise, phrases, language, random);
      return presented ? [presented] : [];
    }),
  );
}

function graded(correct: boolean, answer: string, answerLanguage: string): LessonGrade {
  return { status: "graded", correct, answer, answerLanguage };
}

export function gradeLessonAttempt(
  unit: CurriculumUnit,
  level: Level,
  language: string,
  attempt: LessonAttempt,
): LessonGrade {
  if (level.kind === "personal-practice") {
    const practised = phrasesOf(unit).get(attempt.exerciseId);
    if (!practised || !attempt.choiceId || !phrasesOf(unit).has(attempt.choiceId)) return { status: "invalid" };
    return graded(attempt.choiceId === practised.id, meaning(practised, language), language);
  }
  if (level.kind === "speaking-roleplay") return { status: "unknown" };
  const exercise = level.lessons.flatMap((lesson) => lesson.exercises).find((item) => item.id === attempt.exerciseId);
  if (!exercise) return { status: "unknown" };
  if (exercise.kind === "match-pairs") {
    const pairs = attempt.pairs;
    if (!pairs || pairs.length !== exercise.phraseIds.length) return { status: "invalid" };

    const englishIds = new Set(exercise.phraseIds);
    const meaningIds = new Set(exercise.phraseIds);
    for (const { englishId, meaningId } of pairs) {
      if (!englishIds.delete(englishId) || !meaningIds.delete(meaningId)) return { status: "invalid" };
    }
    return graded(pairs.every(({ englishId, meaningId }) => englishId === meaningId), "", language);
  }

  const phrase = phrasesOf(unit).get(exercise.phraseId);

  if (exercise.kind === "select-meaning" || exercise.kind === "listen-and-pick") {
    if (!phrase || !attempt.choiceId || ![exercise.phraseId, ...exercise.distractorPhraseIds].includes(attempt.choiceId)) {
      return { status: "invalid" };
    }
    return graded(attempt.choiceId === exercise.phraseId, meaning(phrase, language), language);
  }

  if (exercise.kind === "fill-blank") {
    if (!phrase || !attempt.text || !matchesAnswer(attempt.text, [exercise.answer, ...exercise.distractors])) {
      return { status: "invalid" };
    }
    const sentence = `${exercise.before}${exercise.answer}${exercise.after}`.trim();
    return graded(matchesAnswer(attempt.text, [exercise.answer]), sentence, defaultLocale);
  }

  if (exercise.kind === "word-bank-translate") {
    if (!phrase || !attempt.tiles?.length) return { status: "invalid" };
    const support = meaning(phrase, language);
    const toEnglish = exercise.direction === "support-to-english";
    const accepted = toEnglish ? englishAnswers(phrase) : supportAnswers(phrase, language);
    const shown = toEnglish ? phrase.english.text : support;
    const available = shown.trim().split(/\s+/);
    for (const tile of attempt.tiles) {
      const index = available.indexOf(tile);
      if (index === -1) return { status: "invalid" };
      available.splice(index, 1);
    }
    return graded(matchesAnswer(attempt.tiles.join(" "), accepted), shown, exercise.direction === "support-to-english" ? defaultLocale : language);
  }

  if (exercise.kind === "type-what-you-hear" || exercise.kind === "speak-sentence") {
    if (!phrase || !attempt.text) return { status: "invalid" };
    const accepted = exercise.kind === "type-what-you-hear" ? [phrase.english.text] : englishAnswers(phrase);
    return graded(matchesAnswer(attempt.text, accepted), phrase.english.text, defaultLocale);
  }

  return { status: "invalid" };
}

export function hasCompletedLesson(
  unit: CurriculumUnit,
  level: Level,
  language: string,
  attempts: LessonAttempt[],
): boolean {
  // The roleplay stays a preview until it is connected to the Speak engine.
  if (level.kind === "speaking-roleplay") return attempts.length === 0;

  let exerciseIds: string[];
  const matchingIds = new Set<string>();
  if (level.kind === "personal-practice") {
    exerciseIds = unit.phrases.length >= 3 ? unit.phrases.map((phrase) => phrase.id) : [];
  } else {
    const exercises = level.lessons.flatMap((lesson) => lesson.exercises);
    exerciseIds = exercises.map((exercise) => exercise.id);
    for (const exercise of exercises) {
      if (exercise.kind === "match-pairs") matchingIds.add(exercise.id);
    }
  }
  const expected = new Set(exerciseIds);
  const seen = new Set<string>();
  const retryable = new Set<string>();
  if (!expected.size || attempts.length < expected.size || attempts.length > expected.size * 2) return false;

  for (const attempt of attempts) {
    const id = attempt.exerciseId;
    if (!expected.has(id)) return false;
    const isRetry = seen.has(id);
    if (isRetry && !retryable.delete(id)) return false;
    const grade = gradeLessonAttempt(unit, level, language, attempt);
    if (grade.status !== "graded" || (matchingIds.has(id) && !grade.correct)) return false;
    if (!isRetry && !grade.correct) retryable.add(id);
    seen.add(id);
  }
  return seen.size === expected.size;
}
