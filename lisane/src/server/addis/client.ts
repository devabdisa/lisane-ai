import "server-only";
import { createHash } from "node:crypto";
import { AddisAI, type ChatLanguage, type TranslateLanguage } from "addisai";
import { getLanguage, isLanguageCode, type LanguageCode } from "@/config/languages";
import { requireEnv } from "@/lib/env";
import { generateGeminiText } from "@/server/ai/gemini";
import { AI_USAGE_LIMITS, assertMaxChars } from "@/server/ai/usage-guardrails";
import { chunkText } from "./chunk-text";
import { recall, remember } from "./text-cache";

export type ExplanationSource = "english" | "cache" | "addis-chat" | "addis-translate" | "gemini";

let client: AddisAI | undefined;

export function getAddis(): AddisAI {
  if (!client) {
    client = new AddisAI({ apiKey: requireEnv("ADDIS_API_KEY") });
  }
  return client;
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function translateLanguage(code: LanguageCode): TranslateLanguage {
  const language = getLanguage(code);
  if (!language.addis.translate) {
    throw new Error(`${language.englishName} is not available for Addis translation.`);
  }
  return code as TranslateLanguage;
}

function knownLanguage(code: string): LanguageCode {
  if (!isLanguageCode(code)) throw new Error("Unknown language.");
  return code;
}

export async function translateText(params: { text: string; from: string; to: string }): Promise<string> {
  const from = translateLanguage(knownLanguage(params.from));
  const to = translateLanguage(knownLanguage(params.to));
  const trimmed = params.text.trim();
  if (!trimmed || from === to) return trimmed;

  const key = `translate:${from}:${to}:${hash(trimmed)}`;
  const cached = recall(key);
  if (cached !== undefined) return cached;

  const translated: string[] = [];
  for (const piece of chunkText(trimmed)) {
    const result = await getAddis().translate.create({ text: piece, from, to });
    translated.push(result.text.trim());
  }
  const text = translated.filter(Boolean).join("\n\n");
  remember(key, text);
  return text;
}

export async function explainInSupportLanguage(params: {
  englishText: string;
  targetLanguage: string;
}): Promise<{ text: string; source: ExplanationSource }> {
  assertMaxChars(params.englishText, AI_USAGE_LIMITS.maxPracticeReplyChars, "Explanation");
  const target = getLanguage(knownLanguage(params.targetLanguage));
  const englishText = params.englishText.trim();
  if (!target.addis.chat) {
    return { text: englishText, source: "english" };
  }

  const key = `explain:${target.code}:${hash(englishText)}`;
  const cached = recall(key);
  if (cached !== undefined) return { text: cached, source: "cache" };

  try {
    const completion = await getAddis().chat.completions.create({
      language: target.code as ChatLanguage,
      max_tokens: 180,
      system: "Explain this English correction in two short, kind sentences. Do not add another correction.",
      messages: [{ role: "user", content: englishText }],
    });
    const text = completion.choices[0]?.message.content?.trim();
    if (!text) throw new Error("Empty Addis chat reply");
    remember(key, text);
    return { text, source: "addis-chat" };
  } catch (error) {
    console.info("Addis fallback", { from: "chat", to: "translate", targetLanguage: target.code, reason: errorName(error) });
  }

  try {
    const text = await translateText({ text: englishText, from: "en", to: target.code });
    remember(key, text);
    return { text, source: "addis-translate" };
  } catch (error) {
    console.info("Addis fallback", { from: "translate", to: "gemini", targetLanguage: target.code, reason: errorName(error) });
  }

  const text = await generateGeminiText({
    prompt: `Explain this in ${target.englishName}, in two short kind sentences:\n${englishText}`,
    maxChars: AI_USAGE_LIMITS.maxPracticeMessageChars,
  });
  remember(key, text.trim());
  return { text: text.trim(), source: "gemini" };
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}
