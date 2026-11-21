import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { curriculumUnitSchema } from "../schemas/curriculum.ts";
import { buildPersonalPractice, buildPublicExercises, gradeLessonAttempt, hasCompletedLesson, normalizeLessonAnswer, type LessonAttempt } from "./lesson.ts";

const source = new URL("../../content/curriculum/english/intro/introduce-yourself-at-work.json", import.meta.url);
const unit = curriculumUnitSchema.parse(JSON.parse(readFileSync(source, "utf8")));
const lesson = unit.levels[0];
const build = unit.levels[1];
const speak = unit.levels[2];

test("a lesson becomes one question per authored exercise, in that order", () => {
  assert.equal(lesson.kind, "lesson");
  assert.equal(build.kind, "lesson");
  if (lesson.kind !== "lesson" || build.kind !== "lesson") return;
  const questions = buildPublicExercises(unit, lesson, "am", () => 0);
  assert.deepEqual(
    questions.map((question) => question.kind),
    lesson.lessons[0].exercises.map((exercise) => exercise.kind),
  );
  const meaning = questions.find((question) => question.kind === "select-meaning");
  assert.ok(meaning && meaning.kind === "select-meaning");
  assert.equal(meaning.prompt, "Hi, I'm Hana.");
  assert.ok(meaning.choices.some((choice) => choice.label === "ሰላም፣ እኔ ሃና ነኝ።"));
  const heard = questions.find((question) => question.kind === "listen-and-pick");
  assert.ok(heard && heard.kind === "listen-and-pick");
  assert.equal("prompt" in heard, false);
  assert.match(heard.audioSrc, /^\/lesson-audio\/[a-f0-9]{20}\.mp3$/);
});

test("selecting a meaning is graded against the phrase, not the label text", () => {
  const correct = gradeLessonAttempt(unit, lesson, "am", {
    exerciseId: "understand-introductions-01",
    choiceId: "say-your-name",
  });
  const missed = gradeLessonAttempt(unit, lesson, "am", {
    exerciseId: "understand-introductions-01",
    choiceId: "meeting-greeting",
  });
  assert.equal(correct.status, "graded");
  assert.equal(missed.status, "graded");
  if (correct.status !== "graded" || missed.status !== "graded") return;
  assert.equal(correct.correct, true);
  assert.equal(correct.answer, "ሰላም፣ እኔ ሃና ነኝ።");
  assert.equal(missed.correct, false);
  assert.equal(missed.answerLanguage, "am");
});

test("word order, blanks, and spoken answers accept the authored sentence", () => {
  assert.equal(build.kind, "lesson");
  assert.equal(speak.kind, "lesson");
  const ordered = gradeLessonAttempt(unit, build, "om", {
    exerciseId: "build-your-sentences-01",
    tiles: ["Hi,", "I'm", "Hana."],
  });
  const swapped = gradeLessonAttempt(unit, build, "om", {
    exerciseId: "build-your-sentences-01",
    tiles: ["Hana.", "Hi,", "I'm"],
  });
  const blank = gradeLessonAttempt(unit, build, "en", {
    exerciseId: "build-your-sentences-02",
    text: "meet",
  });
  const spoken = gradeLessonAttempt(unit, speak, "en", {
    exerciseId: "say-it-with-confidence-02",
    text: "Hi, I am Hana.",
  });
  assert.equal(ordered.status, "graded");
  assert.equal(swapped.status, "graded");
  assert.equal(blank.status, "graded");
  assert.equal(spoken.status, "graded");
  if (ordered.status === "graded") assert.equal(ordered.correct, true);
  if (swapped.status === "graded") assert.equal(swapped.correct, false);
  if (blank.status === "graded") {
    assert.equal(blank.correct, true);
    assert.equal(blank.answer, "Nice to meet you.");
  }
  if (spoken.status === "graded") assert.equal(spoken.correct, true);
  assert.deepEqual(gradeLessonAttempt(unit, speak, "en", {
    exerciseId: "say-it-with-confidence-02", text: "Hi, I’m Hannah.",
  }), { status: "graded", correct: true, answer: "Hi, I'm Hana.", answerLanguage: "en" });
});

test("dictation checks the recorded wording while ignoring case and punctuation", () => {
  const exerciseId = "say-it-with-confidence-03";
  assert.deepEqual(gradeLessonAttempt(unit, speak, "am", { exerciseId, text: "WHAt’s your NAME" }), {
    status: "graded", correct: true, answer: "What's your name?", answerLanguage: "en",
  });
  assert.deepEqual(gradeLessonAttempt(unit, speak, "am", { exerciseId, text: "What is your name?" }), {
    status: "graded", correct: false, answer: "What's your name?", answerLanguage: "en",
  });
});

test("personal practice asks the meaning of this unit's phrases", () => {
  const practice = unit.levels.find((level) => level.kind === "personal-practice");
  if (practice?.kind !== "personal-practice") throw new Error("missing practice level");
  const questions = buildPersonalPractice(unit, "am", () => 0);
  assert.ok(questions.length >= 3);
  assert.ok(questions.every((question) => question.kind === "select-meaning" && question.choices.length === 3));
  const graded = gradeLessonAttempt(unit, practice, "am", { exerciseId: "say-your-name", choiceId: "say-your-name" });
  assert.equal(graded.status, "graded");
  if (graded.status === "graded") assert.equal(graded.correct, true);
});

test("answers ignore case and punctuation", () => {
  assert.equal(normalizeLessonAnswer("  What's   YOUR name? "), "what's your name");
});

function introductionAttempts(): LessonAttempt[] {
  if (lesson.kind !== "lesson") throw new Error("missing intro lesson");
  return lesson.lessons.flatMap((part) => part.exercises.map((exercise) => {
    if (exercise.kind === "match-pairs") {
      return {
        exerciseId: exercise.id,
        pairs: exercise.phraseIds.map((id) => ({ englishId: id, meaningId: id })),
      };
    }
    if (exercise.kind === "select-meaning" || exercise.kind === "listen-and-pick") {
      return { exerciseId: exercise.id, choiceId: exercise.distractorPhraseIds[0] };
    }
    throw new Error("unexpected exercise in intro lesson");
  }));
}

test("finishing requires a valid attempt per question but accepts ordinary mistakes", () => {
  const attempts = introductionAttempts();
  assert.equal(hasCompletedLesson(unit, lesson, "en", attempts), true);
  assert.equal(hasCompletedLesson(unit, lesson, "en", attempts.slice(1)), false);
  assert.equal(hasCompletedLesson(unit, lesson, "en", [attempts[1], ...attempts.slice(1)]), false);
});

test("matched pairs must be complete and correct before the lesson can be saved", () => {
  const attempts = introductionAttempts();
  const match = attempts.find((attempt) => attempt.pairs);
  assert.ok(match?.pairs);
  const first = match.pairs[0];
  const second = match.pairs[1];
  first.meaningId = second.meaningId;
  second.meaningId = first.englishId;
  assert.deepEqual(gradeLessonAttempt(unit, lesson, "en", match), {
    status: "graded", correct: false, answer: "", answerLanguage: "en",
  });
  assert.equal(hasCompletedLesson(unit, lesson, "en", attempts), false);
});
