import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { loadCurriculumUnits } from "./curriculum-files.mts";

async function syncCurriculum() {
  const units = await loadCurriculumUnits();
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("Set DATABASE_URL before syncing the curriculum.");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    await db.$transaction(async (tx) => {
      for (const unit of units) {
        const { id, levels, ...content } = unit;
        const data = { ...content, active: true };
        await tx.curriculumUnit.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });

        for (const [index, level] of levels.entries()) {
          const { id: levelId, kind, ...content } = level;
          const data = { kind, position: index + 1, content, active: true };
          await tx.curriculumLevel.upsert({
            where: { unitId_id: { unitId: id, id: levelId } },
            create: { unitId: id, id: levelId, ...data },
            update: data,
          });
        }

        // Keep stable IDs and progress when an author removes a level from the path.
        await tx.curriculumLevel.updateMany({
          where: { unitId: id, active: true, id: { notIn: levels.map((level) => level.id) } },
          data: { active: false },
        });
      }

      await tx.curriculumUnit.updateMany({
        where: { active: true, id: { notIn: units.map((unit) => unit.id) } },
        data: { active: false },
      });
    }, { maxWait: 15_000, timeout: 60_000, isolationLevel: "Serializable" });
  } finally {
    await db.$disconnect();
  }

  const levels = units.reduce((total, unit) => total + unit.levels.length, 0);
  console.log(`Synced ${units.length} English curriculum unit(s) and ${levels} level(s).`);
}

try {
  await syncCurriculum();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
