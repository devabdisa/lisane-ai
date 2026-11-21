import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env, requireEnv } from "@/lib/env";
import { assertMaxChars } from "./usage-guardrails";

// Short coach turns. Flash-Lite is the current low-cost model for new projects.
// gemini-2.5-flash is deprecated and stops accepting new traffic on 2026-12-01.
export const GEMINI_TEXT_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_STT_MODEL = "gemini-3.5-transcribe";
export const GEMINI_TTS_MODEL = env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-lite-tts";

let client: GoogleGenAI | undefined;

export function getGemini(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  }
  return client;
}

export async function generateGeminiText(params: { prompt: string; maxChars: number }): Promise<string> {
  assertMaxChars(params.prompt, params.maxChars, "Prompt");
  const response = await getGemini().models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: params.prompt,
  });
  return response.text ?? "";
}
