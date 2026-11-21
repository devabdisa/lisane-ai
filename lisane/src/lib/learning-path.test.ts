import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { defaultLocale, supportLanguages } from "../config/languages.ts";
import { curriculumUnitSchema } from "../schemas/curriculum.ts";
import { buildLearningPath, type LearningPathDTO, type LearningPathUnit } from "./learning-path.ts";

const source = new URL("../../content/curriculum/english/intro/introduce-yourself-at-work.json", import.meta.url);
const { levels, ...content } = curriculumUnitSchema.parse(JSON.parse(readFileSync(source, "utf8")));

function unit(overrides: Partial<LearningPathUnit> = {}): LearningPathUnit {
  return {
    ...content,
    levels: levels.map((level, index) => ({
      id: level.id,
      kind: level.kind,
      position: index + 1,
      completed: false,
    })),
    ...overrides,
  };
}

function getLevels(path: LearningPathDTO) {
  return path.sections.flatMap((section) => section.units.flatMap((unit) => unit.levels));
}

test("the first unfinished level is current and later ones stay locked across sections", () => {
  const intro = unit();
  intro.levels.reverse();
  const next = unit({ id: "another-unit", section: "a1" });
  const second = unit({ id: "second-intro-unit", position: 2 });
  const path = buildLearningPath([next, second, intro], null);
  assert.deepEqual(path.sections.map(({ id }) => id), ["intro", "a1"]);
  assert.deepEqual(path.sections[0].units.map(({ id }) => id), [intro.id, second.id]);
  assert.equal(getLevels(path)[0].id, levels[0].id);
  assert.equal(getLevels(path)[0].state, "current");
  assert.ok(getLevels(path).slice(1).every((level) => level.state === "locked"));
});

test("a completed level is replayable and the next unfinished level opens", () => {
  const intro = unit();
  intro.levels[0].completed = true;
  intro.levels[2].completed = true;
  const result = getLevels(buildLearningPath([intro], defaultLocale));
  assert.deepEqual(result.slice(0, 4).map((row) => row.state), ["done", "current", "done", "locked"]);
});

test("finishing the last level in a section opens the next section", () => {
  const intro = unit();
  for (const level of intro.levels) level.completed = true;
  assert.ok(getLevels(buildLearningPath([intro], null)).every(({ state }) => state === "done"));

  const next = unit({ id: "another-unit", section: "a1" });
  const path = buildLearningPath([intro, next], null);
  assert.equal(path.sections[1].units[0].levels[0].state, "current");
});

test("the guidebook uses the chosen support language and retains its review status", () => {
  for (const { code } of supportLanguages) {
    const path = buildLearningPath([unit()], code);
    const item = path.sections[0].units[0];
    assert.equal(path.supportLanguage, code);
    assert.equal(item.title, content.guidebook[code].title);
    assert.equal(item.guidebook.reviewStatus, content.review[code]);
    assert.equal(item.guidebook.notes[0].examples[0].meaning, content.phrases[0].meaning[code].text);
  }
});

test("an unavailable support language falls back to English", () => {
  const path = buildLearningPath([unit()], "unsupported");
  assert.equal(path.supportLanguage, defaultLocale);
  assert.equal(path.sections[0].units[0].guidebook.language, defaultLocale);
});
