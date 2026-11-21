import "server-only";
import { isLanguageCode } from "@/config/languages";
import { speakCorrectionPrompt } from "@/prompts/speak-correction";
import { parseSpeakJudgment, type SpeakCorrectionType } from "@/schemas/speak-correction";
import { GEMINI_TEXT_MODEL, getGemini } from "@/server/ai/gemini";
import { AI_RATE_LIMIT_RULES, AI_USAGE_LIMITS } from "@/server/ai/usage-guardrails";
import { explainInSupportLanguage } from "@/server/addis/client";
import { hitInMemoryRateLimit } from "@/server/rate-limit/in-memory-rate-limiter";

export type TurnCorrection = {
  original: string;
  corrected: string;
  correctionType: SpeakCorrectionType;
  explanation: string;
  supportLanguage: string;
};

export async function judgeSpeakTurn(params: {
  userId: string;
  text: string;
  supportLanguage: string;
  conversationContext?: string[];
}): Promise<TurnCorrection | null> {
  const text = params.text.trim().slice(0, AI_USAGE_LIMITS.maxPracticeMessageChars);
  if (text.length < 2) return null;
  const supportLanguage = isLanguageCode(params.supportLanguage) ? params.supportLanguage : "en";

  const limit = hitInMemoryRateLimit({
    key: `speak-correction:user:${params.userId}`,
    limit: AI_RATE_LIMIT_RULES.practiceMessage.limit,
    windowMs: AI_RATE_LIMIT_RULES.practiceMessage.windowMs,
  });
  if (!limit.allowed) {
    console.info("speak correction skipped", { reason: "rate_limit" });
    return null;
  }

  let raw = "";
  try {
    const response = await getGemini().models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: speakCorrectionPrompt(text, params.conversationContext),
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 300,
        temperature: 0.2,
      },
    });
    raw = response.text ?? "";
  } catch (error) {
    console.info("speak correction skipped", { reason: "gemini", error: errorName(error) });
    return null;
  }

  const judgment = parseSpeakJudgment(raw);
  if (!judgment) {
    console.info("speak correction skipped", { reason: "invalid_json" });
    return null;
  }
  if (!judgment.hasCorrection || !judgment.corrected.trim()) return null;

  const english = learnerFacingReason(judgment.reason, judgment.tip);
  if (!english) return null;

  try {
    const explained = await explainInSupportLanguage({
      englishText: english,
      targetLanguage: supportLanguage,
    });
    return {
      original: judgment.original.trim() || text,
      corrected: judgment.corrected.trim(),
      correctionType: judgment.type,
      explanation: explained.text,
      supportLanguage,
    };
  } catch (error) {
    console.info("speak correction skipped", { reason: "explanation", error: errorName(error) });
    return null;
  }
}

function learnerFacingReason(reason: string, tip: string): string {
  const cleanReason = reason.trim();
  const cleanTip = tip.trim();
  if (!cleanReason) return cleanTip;
  if (!cleanTip || cleanReason.includes(cleanTip)) return cleanReason;
  return `${cleanReason} ${cleanTip}`;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}
