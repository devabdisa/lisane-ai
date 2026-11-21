import { z } from "zod";

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const lessonAttemptSchema = z
  .strictObject({
    exerciseId: id,
    choiceId: id.optional(),
    tiles: z.array(z.string().trim().min(1).max(80)).max(24).optional(),
    text: z.string().trim().min(1).max(400).optional(),
  })
  .refine((attempt) => attempt.choiceId !== undefined || attempt.tiles !== undefined || attempt.text !== undefined, {
    message: "Choose an answer first.",
  });
