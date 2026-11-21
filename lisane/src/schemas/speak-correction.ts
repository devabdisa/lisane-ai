import { z } from "zod";

export const speakCorrectionTypes = ["GRAMMAR", "VOCABULARY", "PHRASING"] as const;

export type SpeakCorrectionType = (typeof speakCorrectionTypes)[number];

export const speakJudgmentSchema = z.object({
  hasCorrection: z.boolean(),
  original: z.string(),
  corrected: z.string(),
  type: z.enum(speakCorrectionTypes),
  reason: z.string(),
  tip: z.string(),
});

export type SpeakJudgment = z.infer<typeof speakJudgmentSchema>;

export function parseSpeakJudgment(raw: string): SpeakJudgment | null {
  try {
    const parsed: unknown = JSON.parse(extractJson(raw));
    const result = speakJudgmentSchema.safeParse(normalizeJudgment(parsed));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function normalizeJudgment(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (typeof record.type === "string") record.type = record.type.toUpperCase();
  // A clean sentence comes back with an empty type; it has no fix to label.
  if (record.hasCorrection === false && !speakCorrectionTypes.some((type) => type === record.type)) {
    record.type = "PHRASING";
  }
  return record;
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const withoutFence = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object");
  return withoutFence.slice(start, end + 1);
}
