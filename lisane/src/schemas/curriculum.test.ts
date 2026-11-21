import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { defaultLocale, supportLanguages } from "../config/languages.ts";
import { curriculumUnitSchema } from "./curriculum.ts";

const source = new URL("../../content/curriculum/english/intro/introduce-yourself-at-work.json", import.meta.url);

function sampleUnit() {
  return curriculumUnitSchema.parse(JSON.parse(readFileSync(source, "utf8")));
}

test("the first unit includes all MVP exercise types and a speaking roleplay", () => {
  const unit = sampleUnit();
  const kinds = new Set(unit.levels.flatMap((level) =>
    "lessons" in level ? level.lessons.flatMap((lesson) => lesson.exercises.map((item) => item.kind)) : [],
  ));
  assert.equal(kinds.size, 7);
  assert.ok(unit.levels.some((level) => level.kind === "speaking-roleplay"));
});

test("an enabled support language is required for every phrase hint", () => {
  const unit = sampleUnit();
  const code = supportLanguages.find((language) => language.code !== defaultLocale)!.code;
  delete unit.phrases[0].hint[code];
  const result = curriculumUnitSchema.safeParse(unit);
  assert.ok(!result.success);
  assert.ok(result.error.issues.some((issue) => issue.path.join(".") === `phrases.0.hint.${code}`));
});

test("an exercise cannot reference a phrase the unit does not teach", () => {
  const unit = sampleUnit();
  const level = unit.levels.find((item) => item.kind === "lesson")!;
  const exercise = level.lessons[0].exercises.find((item) => item.kind === "select-meaning")!;
  exercise.phraseId = "missing-phrase";
  const result = curriculumUnitSchema.safeParse(unit);
  assert.ok(!result.success);
  assert.ok(result.error.issues.some((issue) => issue.message === 'Unknown phrase "missing-phrase"'));
});

test("a correct choice cannot also be a distractor", () => {
  const unit = sampleUnit();
  const level = unit.levels.find((item) => item.kind === "lesson")!;
  const exercise = level.lessons[0].exercises.find((item) => item.kind === "select-meaning")!;
  exercise.distractorPhraseIds[0] = exercise.phraseId;
  const result = curriculumUnitSchema.safeParse(unit);
  assert.ok(!result.success);
  assert.ok(result.error.issues.some((issue) => issue.path.includes("distractorPhraseIds")));
});

test("a fill exercise must reconstruct an accepted phrase", () => {
  const unit = sampleUnit();
  const exercise = unit.levels.flatMap((level) =>
    "lessons" in level ? level.lessons.flatMap((lesson) => lesson.exercises) : [],
  ).find((item) => item.kind === "fill-blank")!;
  exercise.answer = "unrelated";
  const result = curriculumUnitSchema.safeParse(unit);
  assert.ok(!result.success);
  assert.ok(result.error.issues.some((issue) => issue.message.includes("completed sentence")));
});
