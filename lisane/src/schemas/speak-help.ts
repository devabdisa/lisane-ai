import { z } from "zod";

export const SPEAK_HELP_MAX_SECONDS = 10;
export const SPEAK_HELP_MAX_PCM_BYTES = 16_000 * 2 * SPEAK_HELP_MAX_SECONDS;
export const SPEAK_HELP_MAX_BASE64_CHARS = Math.ceil(SPEAK_HELP_MAX_PCM_BYTES / 3) * 4;
export const speakHelpInputSchema = z.object({
  clientRequestId: z.uuid(),
  audio: z.base64().min(4).max(SPEAK_HELP_MAX_BASE64_CHARS),
});
export const speakHelpResultSchema = z.object({ english: z.string().min(1) });
