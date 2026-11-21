import { z } from "zod";

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const lessonAttemptSchema = z
  .strictObject({
    exerciseId: id,
    choiceId: id.optional(),
    tiles: z.array(z.string().trim().min(1).max(80)).max(24).optional(),
    text: z.string().trim().min(1).max(400).optional(),
    pairs: z.array(z.strictObject({ englishId: id, meaningId: id })).min(3).max(5).optional(),
  })
  .refine((attempt) => [attempt.choiceId, attempt.tiles, attempt.text, attempt.pairs].filter((value) => value !== undefined).length === 1, {
    message: "Choose one answer for this question.",
  });

export const lessonCompletionSchema = z.strictObject({ attempts: z.array(lessonAttemptSchema) });
