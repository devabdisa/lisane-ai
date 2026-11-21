import { z } from "zod";
import { isLanguageCode, supportLanguages } from "../config/languages.ts";

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const text = z.string().trim().min(1);
const languageCode = z.string().refine((code): boolean => isLanguageCode(code), { message: "Unknown language code" });

function localized<T extends z.ZodType>(value: T) {
  return z.record(languageCode, value).superRefine((entries, ctx) => {
    for (const { code } of supportLanguages) {
      if (!Object.hasOwn(entries, code)) {
        ctx.addIssue({ code: "custom", path: [code], message: "Missing enabled support language" });
      }
    }
  });
}

const guidebookSchema = z.strictObject({
  title: text,
  goal: text,
  introduction: text,
  notes: z.array(z.strictObject({ explanation: text, examples: z.array(id).min(1) })).min(1),
});

const answerSchema = z.strictObject({
  text,
  alternatives: z.array(text).optional(),
});

const phraseSchema = z.strictObject({
  id,
  english: answerSchema,
  meaning: localized(answerSchema),
  hint: localized(text),
});

const phraseExercise = { id, phraseId: id };
const choiceExercise = { ...phraseExercise, distractorPhraseIds: z.array(id).min(2).max(3) };

const exerciseSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("select-meaning"), ...choiceExercise }),
  z.strictObject({ kind: z.literal("match-pairs"), id, phraseIds: z.array(id).min(3).max(5) }),
  z.strictObject({
    kind: z.literal("word-bank-translate"),
    ...phraseExercise,
    direction: z.enum(["support-to-english", "english-to-support"]),
  }),
  z.strictObject({
    kind: z.literal("fill-blank"),
    ...phraseExercise,
    before: z.string(),
    after: z.string(),
    answer: text,
    distractors: z.array(text).min(2).max(3),
  }),
  z.strictObject({ kind: z.literal("listen-and-pick"), ...choiceExercise }),
  z.strictObject({ kind: z.literal("type-what-you-hear"), ...phraseExercise }),
  z.strictObject({ kind: z.literal("speak-sentence"), ...phraseExercise }),
]);

const lessonSchema = z.strictObject({ id, exercises: z.array(exerciseSchema).min(10).max(15) });
const lessonLevel = { id, lessons: z.array(lessonSchema).min(1) };

const levelSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("lesson"), ...lessonLevel }),
  z.strictObject({ kind: z.literal("unit-review"), ...lessonLevel }),
  z.strictObject({ kind: z.literal("personal-practice"), id }),
  z.strictObject({
    kind: z.literal("speaking-roleplay"),
    id,
    setup: text,
    learnerTask: localized(text),
    phraseIds: z.array(id).min(1),
  }),
]);

export const curriculumSections = ["intro", "a1", "a2", "b1"] as const;
export const curriculumLevelKindSchema = z.enum(levelSchema.options.map((level) => level.shape.kind.value));

const curriculumUnitFields = z.strictObject({
  id,
  section: z.enum(curriculumSections),
  position: z.int().min(1),
  review: localized(z.enum(["draft", "approved"])),
  guidebook: localized(guidebookSchema),
  phrases: z.array(phraseSchema).min(1),
  levels: z.array(levelSchema).min(1),
});

export const curriculumPathContentSchema = curriculumUnitFields.omit({ levels: true });

export const curriculumUnitSchema = curriculumUnitFields.superRefine((unit, ctx) => {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });
  const unique = (seen: Set<string>, value: string, path: (string | number)[]) => {
    if (seen.has(value)) issue(path, `Duplicate value "${value}"`);
    seen.add(value);
  };
  const phrases = new Map<string, (typeof unit.phrases)[number]>();
  unit.phrases.forEach((phrase, index) => {
    if (phrases.has(phrase.id)) issue(["phrases", index, "id"], `Duplicate phrase ID "${phrase.id}"`);
    phrases.set(phrase.id, phrase);
  });

  function checkPhraseList(values: string[], path: (string | number)[], target?: string) {
    const seen = new Set(target ? [target] : []);
    values.forEach((value, i) => {
      unique(seen, value, [...path, i]);
      if (!phrases.has(value)) issue([...path, i], `Unknown phrase "${value}"`);
    });
  }

  for (const [code, guidebook] of Object.entries(unit.guidebook)) {
    guidebook.notes.forEach((note, index) => {
      checkPhraseList(note.examples, ["guidebook", code, "notes", index, "examples"]);
    });
  }

  const levelIds = new Set<string>();
  const lessonIds = new Set<string>();
  const exerciseIds = new Set<string>();
  unit.levels.forEach((level, levelIndex) => {
    const levelPath = ["levels", levelIndex];
    unique(levelIds, level.id, [...levelPath, "id"]);
    if (level.kind === "speaking-roleplay") checkPhraseList(level.phraseIds, [...levelPath, "phraseIds"]);
    if (!("lessons" in level)) return;

    level.lessons.forEach((lesson, lessonIndex) => {
      const lessonPath = [...levelPath, "lessons", lessonIndex];
      unique(lessonIds, lesson.id, [...lessonPath, "id"]);
      lesson.exercises.forEach((exercise, exerciseIndex) => {
        const path = [...lessonPath, "exercises", exerciseIndex];
        unique(exerciseIds, exercise.id, [...path, "id"]);

        if (exercise.kind === "match-pairs") {
          checkPhraseList(exercise.phraseIds, [...path, "phraseIds"]);
          return;
        }

        const phrase = phrases.get(exercise.phraseId);
        if (!phrase) issue([...path, "phraseId"], `Unknown phrase "${exercise.phraseId}"`);
        if ("distractorPhraseIds" in exercise) {
          checkPhraseList(exercise.distractorPhraseIds, [...path, "distractorPhraseIds"], exercise.phraseId);
        }

        if (exercise.kind === "fill-blank") {
          const choices = new Set([exercise.answer.toLowerCase()]);
          exercise.distractors.forEach((choice, index) => {
            unique(choices, choice.toLowerCase(), [...path, "distractors", index]);
          });
          const filled = `${exercise.before}${exercise.answer}${exercise.after}`.trim();
          if (phrase && filled !== phrase.english.text && !phrase.english.alternatives?.includes(filled)) {
            issue([...path, "answer"], "The completed sentence must match an accepted English answer");
          }
        }
      });
    });
  });
});

export type CurriculumUnit = z.infer<typeof curriculumUnitSchema>;
