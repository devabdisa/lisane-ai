import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  buildPersonalPractice,
  buildPublicExercises,
  gradeLessonAttempt,
  hasCompletedLesson,
  type LessonAttempt,
  type LessonDTO,
} from "@/lib/lesson";
import { buildLearningPath, type LearningPathDTO } from "@/lib/learning-path";
import { activeStreak, describeReward, lessonXp, nextStreak, practiceDay, rewardSnapshot } from "@/lib/lesson-session";
import { curriculumUnitSchema, type CurriculumUnit } from "@/schemas/curriculum";
import { getPrisma } from "@/server/db";

export type LessonPageResult =
  | { status: "missing" }
  | { status: "locked" }
  | { status: "ready"; lesson: LessonDTO };

export type LessonCheckResult =
  | { status: "missing" }
  | { status: "locked" }
  | { status: "invalid" }
  | { status: "graded"; correct: boolean; answer: string; answerLanguage: string };

function contentRecord(content: Prisma.JsonValue) {
  if (content && typeof content === "object" && !Array.isArray(content)) return content;
  return {};
}

async function loadLearnerCurriculum(userId: string) {
  const db = getPrisma();
  const [profile, rows] = await Promise.all([
      db.userProfile.findUnique({ where: { userId }, select: { supportLanguage: true } }),
      db.curriculumUnit.findMany({
        where: { active: true },
        select: {
          id: true,
          section: true,
          position: true,
          review: true,
          guidebook: true,
          phrases: true,
          levels: {
            where: { active: true },
            select: {
              id: true,
              kind: true,
              position: true,
              content: true,
              progress: { where: { userId }, select: { completedAt: true } },
            },
          },
        },
      }),
  ]);

  const parsed = new Map<string, CurriculumUnit>();
  const units = rows.flatMap((row) => {
    const levels = row.levels.toSorted((a, b) => a.position - b.position);
    if (!levels.length) return [];
    const unit = curriculumUnitSchema.parse({
      id: row.id,
      section: row.section,
      position: row.position,
      review: row.review,
      guidebook: row.guidebook,
      phrases: row.phrases,
      levels: levels.map((level) => ({ ...contentRecord(level.content), id: level.id, kind: level.kind })),
    });
    parsed.set(unit.id, unit);
    return [
      {
        ...unit,
        levels: levels.flatMap((level, index) => {
          const authored = unit.levels[index];
          if (!authored) return [];
          return [{ id: level.id, kind: authored.kind, position: level.position, completed: level.progress.length > 0 }];
        }),
      },
    ];
  });

  return {
    parsed,
    path: buildLearningPath(units, profile?.supportLanguage ?? null),
  };
}

function findLevel(path: LearningPathDTO, unitId: string, levelId: string) {
  for (const section of path.sections) {
    for (const unit of section.units) {
      if (unit.id !== unitId) continue;
      const index = unit.levels.findIndex((level) => level.id === levelId);
      if (index < 0) return null;
      const lessonNumber = unit.levels.slice(0, index + 1).filter((level) => level.kind === "lesson").length;
      return { state: unit.levels[index].state, lessonNumber };
    }
  }
  return null;
}

async function openLevel(userId: string, unitId: string, levelId: string) {
  const { parsed, path } = await loadLearnerCurriculum(userId);
  const unit = parsed.get(unitId);
  const level = unit?.levels.find((item) => item.id === levelId);
  const placed = findLevel(path, unitId, levelId);
  if (!unit || !level || !placed) return { status: "missing" as const };
  if (placed.state === "locked") return { status: "locked" as const };
  return { status: "open" as const, unit, level, path, lessonNumber: placed.lessonNumber };
}

export async function getLessonPage(userId: string, unitId: string, levelId: string): Promise<LessonPageResult> {
  const opened = await openLevel(userId, unitId, levelId);
  if (opened.status !== "open") return opened;
  const language = opened.path.supportLanguage;
  const exercises =
    opened.level.kind === "lesson" || opened.level.kind === "unit-review"
      ? buildPublicExercises(opened.unit, opened.level, language)
      : opened.level.kind === "personal-practice"
        ? buildPersonalPractice(opened.unit, language)
        : [];
  return {
    status: "ready",
    lesson: {
      unitId,
      levelId,
      kind: opened.level.kind,
      lessonNumber: opened.lessonNumber,
      supportLanguage: opened.path.supportLanguage,
      exercises,
    },
  };
}

export async function checkLessonSpeechAccess(params: { userId: string; unitId: string; levelId: string; exerciseId: string }) {
  const opened = await openLevel(params.userId, params.unitId, params.levelId);
  if (opened.status !== "open") return opened.status;

  if (!("lessons" in opened.level)) return "missing";
  const hasExercise = opened.level.lessons.some(({ exercises }) =>
    exercises.some((exercise) => exercise.id === params.exerciseId && exercise.kind === "speak-sentence"),
  );
  return hasExercise ? "ready" : "missing";
}

export async function checkLessonAnswer(
  userId: string,
  unitId: string,
  levelId: string,
  attempt: LessonAttempt,
): Promise<LessonCheckResult> {
  const opened = await openLevel(userId, unitId, levelId);
  if (opened.status !== "open") return opened;
  const grade = gradeLessonAttempt(opened.unit, opened.level, opened.path.supportLanguage, attempt);
  if (grade.status === "unknown") return { status: "missing" };
  if (grade.status === "invalid") return { status: "invalid" };
  return grade;
}

export async function completeLessonLevel(userId: string, unitId: string, levelId: string, attempts: LessonAttempt[]) {
  const opened = await openLevel(userId, unitId, levelId);
  if (opened.status !== "open") return opened;
  if (!hasCompletedLesson(opened.unit, opened.level, opened.path.supportLanguage, attempts)) {
    return { status: "incomplete" as const };
  }

  const reward = await getPrisma().$transaction(async (tx) => {
    // Serialize a learner's completions so simultaneous requests cannot award XP twice or overwrite a streak.
    await tx.$queryRaw`SELECT "id" FROM "user" WHERE "id" = ${userId} FOR NO KEY UPDATE`;
    const where = { userId_unitId_levelId: { userId, unitId, levelId } };
    const existing = await tx.levelProgress.findUnique({ where, select: { userId: true } });
    await tx.levelProgress.upsert({ where, create: { userId, unitId, levelId }, update: {} });
    const stored = await tx.learnerReward.findUnique({ where: { userId } });
    const today = practiceDay(new Date());
    const previous = { streak: stored?.streak ?? 0, lastDay: stored?.lastDay ?? null };
    const before = { xp: stored?.xp ?? 0, streak: activeStreak(previous, today) };
    if (!attempts.length) return describeReward(before, before, 0);

    const xpGained = existing ? 0 : xpForAttempts(opened.unit, opened.level, opened.path.supportLanguage, attempts);
    const after = { xp: before.xp + xpGained, streak: nextStreak(previous, today) };
    await tx.learnerReward.upsert({
      where: { userId },
      create: { userId, ...after, lastDay: today },
      update: { ...after, lastDay: today },
    });
    return describeReward(before, after, xpGained);
  }, { isolationLevel: "ReadCommitted" });
  return { status: "completed" as const, reward };
}

function xpForAttempts(unit: CurriculumUnit, level: CurriculumUnit["levels"][number], language: string, attempts: LessonAttempt[]) {
  const first = new Map<string, boolean>();
  const last = new Map<string, boolean>();
  for (const attempt of attempts) {
    const grade = gradeLessonAttempt(unit, level, language, attempt);
    if (grade.status !== "graded") continue;
    if (!first.has(attempt.exerciseId)) first.set(attempt.exerciseId, grade.correct);
    last.set(attempt.exerciseId, grade.correct);
  }
  return lessonXp([...last.entries()].map(([id, correct]) => ({ correct, firstCorrect: first.get(id) === true })));
}

export async function getLearnerReward(userId: string) {
  const stored = await getPrisma().learnerReward.findUnique({ where: { userId } });
  return rewardSnapshot(stored?.xp ?? 0, stored ? activeStreak(stored, practiceDay(new Date())) : 0);
}

export async function getProgressSummary(userId: string) {
  const db = getPrisma();
  const today = practiceDay(new Date());
  const [stored, lessonsDone, profile] = await Promise.all([
    db.learnerReward.findUnique({ where: { userId } }),
    db.levelProgress.count({ where: { userId } }),
    db.userProfile.findUnique({ where: { userId }, select: { dailyGoalMinutes: true } }),
  ]);
  return {
    ...rewardSnapshot(stored?.xp ?? 0, stored ? activeStreak(stored, today) : 0),
    lessonsDone,
    dailyGoalMinutes: profile?.dailyGoalMinutes ?? null,
  };
}
