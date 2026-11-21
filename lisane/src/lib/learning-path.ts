import { defaultLocale, supportLanguages } from "../config/languages.ts";
import { curriculumSections, type CurriculumUnit } from "../schemas/curriculum.ts";

type LevelKind = CurriculumUnit["levels"][number]["kind"];
type LevelState = "locked" | "current" | "done";
type PathLevel = { id: string; kind: LevelKind; position: number; completed: boolean };

export type LearningPathUnit = Omit<CurriculumUnit, "levels"> & { levels: PathLevel[] };

export function buildLearningPath(units: LearningPathUnit[], preferredLanguage: string | null) {
  const supportLanguage = supportLanguages.find((language) => language.code === preferredLanguage)?.code ?? defaultLocale;
  let foundCurrentLevel = false;

  const sections = curriculumSections.flatMap((section) => {
    const sectionUnits = units.filter((unit) => unit.section === section).sort((a, b) => a.position - b.position);
    if (!sectionUnits.length) return [];

    return [{
      id: section,
      units: sectionUnits.map((unit) => {
        const language = Object.hasOwn(unit.guidebook, supportLanguage) ? supportLanguage : defaultLocale;
        const guidebook = unit.guidebook[language];
        const phrases = new Map(unit.phrases.map((phrase) => [phrase.id, phrase]));
        const levels = unit.levels.toSorted((a, b) => a.position - b.position).map((level) => {
          const state: LevelState = level.completed ? "done" : foundCurrentLevel ? "locked" : "current";
          if (state === "current") foundCurrentLevel = true;
          return { id: level.id, kind: level.kind, state };
        });

        return {
          id: unit.id,
          title: guidebook.title,
          goal: guidebook.goal,
          guidebook: {
            language,
            reviewStatus: unit.review[language],
            introduction: guidebook.introduction,
            notes: guidebook.notes.map((note) => ({
              explanation: note.explanation,
              examples: note.examples.flatMap((id) => {
                const phrase = phrases.get(id);
                if (!phrase) return [];
                return [{ id, english: phrase.english.text, meaning: phrase.meaning[language]?.text ?? phrase.meaning[defaultLocale].text }];
              }),
            })),
          },
          levels,
        };
      }),
    }];
  });

  return { supportLanguage, sections };
}

export type LearningPathDTO = ReturnType<typeof buildLearningPath>;
