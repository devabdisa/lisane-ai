import "server-only";
import { GoogleGenAI } from "@google/genai";
import { env, requireEnv } from "@/lib/env";
import { assertMaxChars } from "./usage-guardrails";

// Text stays on a current Flash-Lite model. Live and TTS come from the environment,
// with the same defaults Voxa uses, including the models/ prefix on the live model.
export const GEMINI_TEXT_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_STT_MODEL = "gemini-3.5-transcribe";

export function toModelResource(model: string): string {
  return model.startsWith("models/") ? model : `models/${model}`;
}

export const GEMINI_LIVE_MODEL = toModelResource(env.GEMINI_LIVE_MODEL);
export const GEMINI_TTS_MODEL = env.GEMINI_TTS_MODEL;

let client: GoogleGenAI | undefined;
let liveClient: GoogleGenAI | undefined;

export function getGemini(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  }
  return client;
}

// Voxa opens the live voice socket on the v1alpha API. The stable API returns 404 for that model.
export function getGeminiLive(): GoogleGenAI {
  if (!liveClient) {
    liveClient = new GoogleGenAI({
      apiKey: requireEnv("GEMINI_API_KEY"),
      httpOptions: { apiVersion: "v1alpha" },
    });
  }
  return liveClient;
}

export async function generateGeminiText(params: { prompt: string; maxChars: number }): Promise<string> {
  assertMaxChars(params.prompt, params.maxChars, "Prompt");
  const response = await getGemini().models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: params.prompt,
  });
  return response.text ?? "";
}
