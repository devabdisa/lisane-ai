import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalSecret = z.preprocess(emptyToUndefined, z.string().min(1).optional());

export const envSchema = z
  .object({
    NEXT_PUBLIC_APP_URL: z.preprocess(
      emptyToUndefined,
      z.url().default("http://localhost:3000"),
    ),
    DATABASE_URL: optionalSecret,
    BETTER_AUTH_SECRET: optionalSecret,
    BETTER_AUTH_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    GOOGLE_CLIENT_ID: optionalSecret,
    GOOGLE_CLIENT_SECRET: optionalSecret,
    GEMINI_API_KEY: optionalSecret,
    GEMINI_LIVE_MODEL: z.preprocess(
      emptyToUndefined,
      z.string().min(1).default("models/gemini-3.1-flash-live-preview"),
    ),
    GEMINI_TTS_MODEL: z.preprocess(
      emptyToUndefined,
      z.string().min(1).default("gemini-3.1-flash-tts-preview"),
    ),
    STT_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["gemini", "groq"]).default("gemini")),
    GROQ_API_KEY: optionalSecret,
    ADDIS_API_KEY: optionalSecret,
    CHAPA_SECRET_KEY: optionalSecret,
    CHAPA_WEBHOOK_SECRET: optionalSecret,
  })
  .superRefine((data, ctx) => {
    const hasGoogleId = Boolean(data.GOOGLE_CLIENT_ID);
    const hasGoogleSecret = Boolean(data.GOOGLE_CLIENT_SECRET);
    if (hasGoogleId !== hasGoogleSecret) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together",
      });
    }
    if (data.STT_PROVIDER === "groq" && !data.GROQ_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["GROQ_API_KEY"],
        message: "GROQ_API_KEY is required when STT_PROVIDER is groq",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${details}`);
  }
  return result.data;
}
