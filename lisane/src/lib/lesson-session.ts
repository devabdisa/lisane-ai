export const XP_FIRST_TRY = 10;
export const XP_AFTER_MISS = 5;
export const XP_PER_GEM = 40;
export const HARDER_AFTER_STREAK = 3;

const difficulty: Record<string, number> = {
  "select-meaning": 0,
  "listen-and-pick": 0,
  "match-pairs": 1,
  "word-bank-translate": 2,
  "fill-blank": 2,
  "type-what-you-hear": 3,
  "speak-sentence": 4,
};

export type SessionExercise = { id: string; kind: string };
export type QueuedExercise<T extends SessionExercise> = { exercise: T; misses: number };
export type LessonSession<T extends SessionExercise> = { queue: QueuedExercise<T>[]; streak: number };

export type LessonReward = {
  xpGained: number;
  xp: number;
  gems: number;
  gemFill: number;
  gemInto: number;
  gemGoal: number;
  streak: number;
  streakGrew: boolean;
  gemEarned: boolean;
};

export function startLessonSession<T extends SessionExercise>(exercises: T[]): LessonSession<T> {
  return { queue: exercises.map((exercise) => ({ exercise, misses: 0 })), streak: 0 };
}

export function applyLessonResult<T extends SessionExercise>(session: LessonSession<T>, correct: boolean): LessonSession<T> {
  const current = session.queue[0];
  if (!current) return session;
  let queue = session.queue.slice(1);
  const streak = correct ? session.streak + 1 : 0;
  // A miss comes back once. A second miss ends that question so the lesson can finish.
  if (!correct && current.misses < 1) queue = [...queue, { exercise: current.exercise, misses: 1 }];
  if (correct && streak % HARDER_AFTER_STREAK === 0) queue = promoteHarder(queue);
  return { queue, streak };
}

function promoteHarder<T extends SessionExercise>(queue: QueuedExercise<T>[]) {
  const next = queue[0];
  if (!next) return queue;
  let harderIndex = -1;
  let harderScore = difficulty[next.exercise.kind] ?? 1;
  queue.forEach((item, index) => {
    if (index === 0) return;
    const score = difficulty[item.exercise.kind] ?? 1;
    if (score > harderScore) {
      harderIndex = index;
      harderScore = score;
    }
  });
  if (harderIndex < 0) return queue;
  const promoted = queue[harderIndex];
  if (!promoted) return queue;
  return [promoted, ...queue.slice(0, harderIndex), ...queue.slice(harderIndex + 1)];
}

export function lessonXp(results: { correct: boolean; firstCorrect: boolean }[]) {
  return results.reduce((total, result) => {
    if (!result.correct) return total;
    return total + (result.firstCorrect ? XP_FIRST_TRY : XP_AFTER_MISS);
  }, 0);
}

export function gemProgress(xp: number) {
  const safe = Math.max(0, xp);
  return { gems: Math.floor(safe / XP_PER_GEM), into: safe % XP_PER_GEM, fill: (safe % XP_PER_GEM) / XP_PER_GEM };
}

export function practiceDay(now: Date, timeZone = "Africa/Addis_Ababa") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function previousPracticeDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1));
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function nextStreak(previous: { streak: number; lastDay: string | null }, today: string) {
  if (previous.lastDay === today) return Math.max(1, previous.streak);
  if (previous.lastDay && previous.lastDay === previousPracticeDay(today)) return previous.streak + 1;
  return 1;
}

export function activeStreak(previous: { streak: number; lastDay: string | null }, today: string) {
  return previous.lastDay === today || previous.lastDay === previousPracticeDay(today) ? previous.streak : 0;
}

export function rewardSnapshot(xp: number, streak: number) {
  const progress = gemProgress(xp);
  return { xp, streak, gems: progress.gems, gemFill: progress.fill, gemInto: progress.into, gemGoal: XP_PER_GEM };
}

export function describeReward(before: { xp: number; streak: number }, after: { xp: number; streak: number }, xpGained: number): LessonReward {
  const progress = gemProgress(after.xp);
  return {
    xpGained,
    xp: after.xp,
    gems: progress.gems,
    gemFill: progress.fill,
    gemInto: progress.into,
    gemGoal: XP_PER_GEM,
    streak: after.streak,
    streakGrew: after.streak > before.streak,
    gemEarned: progress.gems > gemProgress(before.xp).gems,
  };
}
