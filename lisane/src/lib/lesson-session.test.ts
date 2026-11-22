import assert from "node:assert/strict";
import { test } from "node:test";
import {
  activeStreak,
  applyLessonResult,
  describeReward,
  lessonXp,
  nextStreak,
  practiceDay,
  previousPracticeDay,
  startLessonSession,
  XP_PER_GEM,
} from "./lesson-session.ts";

const item = (id: string, kind: string) => ({ id, kind });

test("a missed question returns once and a second miss lets the lesson end", () => {
  const session = startLessonSession([item("a", "select-meaning"), item("b", "select-meaning")]);
  const once = applyLessonResult(session, false);
  assert.deepEqual(once.queue.map((entry) => [entry.exercise.id, entry.misses]), [["b", 0], ["a", 1]]);
  assert.equal(once.streak, 0);
  const twice = applyLessonResult(applyLessonResult(once, true), false);
  assert.deepEqual(twice.queue, []);
});

test("three correct answers bring a harder question forward", () => {
  const session = startLessonSession([
    item("a", "select-meaning"),
    item("b", "select-meaning"),
    item("c", "select-meaning"),
    item("d", "select-meaning"),
    item("e", "speak-sentence"),
  ]);
  let state = session;
  for (let count = 0; count < 3; count += 1) state = applyLessonResult(state, true);
  assert.equal(state.streak, 3);
  assert.equal(state.queue[0]?.exercise.id, "e");
  assert.equal(state.queue[1]?.exercise.id, "d");
});

test("a first try is worth more than a question that had to return", () => {
  assert.equal(lessonXp([{ correct: true, firstCorrect: true }, { correct: true, firstCorrect: false }, { correct: false, firstCorrect: false }]), 15);
});

test("the displayed streak allows today to be unfinished and drops after a missed day", () => {
  assert.equal(activeStreak({ streak: 4, lastDay: "2026-11-21" }, "2026-11-22"), 4);
  assert.equal(activeStreak({ streak: 4, lastDay: "2026-11-22" }, "2026-11-22"), 4);
  assert.equal(activeStreak({ streak: 4, lastDay: "2026-11-20" }, "2026-11-22"), 0);
});

test("xp fills a gem and the next day continues the streak", () => {
  const reward = describeReward({ xp: 30, streak: 2 }, { xp: 45, streak: 3 }, 15);
  assert.equal(reward.gemEarned, true);
  assert.equal(reward.gems, 1);
  assert.equal(reward.gemInto, 45 - XP_PER_GEM);
  assert.equal(reward.streakGrew, true);
  assert.equal(nextStreak({ streak: 3, lastDay: "2026-11-21" }, "2026-11-22"), 4);
  assert.equal(nextStreak({ streak: 3, lastDay: "2026-11-22" }, "2026-11-22"), 3);
  assert.equal(nextStreak({ streak: 3, lastDay: "2026-11-20" }, "2026-11-22"), 1);
  assert.equal(previousPracticeDay("2026-03-01"), "2026-02-28");
  assert.equal(practiceDay(new Date("2026-11-21T21:30:00.000Z")), "2026-11-22");
});
