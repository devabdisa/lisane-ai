import "server-only";
import { buildLearningPath, type LearningPathDTO } from "@/lib/learning-path";
import { curriculumLevelKindSchema, curriculumPathContentSchema } from "@/schemas/curriculum";
import { getPrisma } from "@/server/db";

export async function getLearningPath(userId: string): Promise<LearningPathDTO> {
  const db = getPrisma();
  const [profile, rows] = await db.$transaction([
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
            progress: { where: { userId }, select: { completedAt: true } },
          },
        },
      },
    }),
  ], { isolationLevel: "RepeatableRead" });

  const units = rows.flatMap(({ levels, ...content }) => {
    if (!levels.length) return [];
    return [{
      ...curriculumPathContentSchema.parse(content),
      levels: levels.map(({ progress, ...level }) => ({
        ...level,
        kind: curriculumLevelKindSchema.parse(level.kind),
        completed: progress.length > 0,
      })),
    }];
  });
  return buildLearningPath(units, profile?.supportLanguage ?? null);
}
