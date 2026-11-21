import "server-only";
import { createHash } from "node:crypto";
import { oneSpokenSentence } from "@/lib/natural-sentence";
import { countAudiblePcm16Windows, MIN_AUDIBLE_WINDOWS } from "@/lib/voice-evidence";
import { SPEAK_HELP_MAX_PCM_BYTES } from "@/schemas/speak-help";
import { translateText } from "@/server/addis/client";
import { speechLanguage, transcribeSupportSpeech } from "@/server/addis/speech";
import { GEMINI_TEXT_MODEL, getGemini } from "@/server/ai/gemini";

export async function helpSayPhrase(params: {
  userId: string;
  supportLanguage: string;
  clientRequestId: string;
  audio: string;
  signal: AbortSignal;
}): Promise<{ english: string } | null> {
  const language = speechLanguage(params.supportLanguage);
  if (!language) return null;

  const pcm = Buffer.from(params.audio, "base64");
  if (!pcm.length || pcm.length % 2 !== 0 || pcm.length > SPEAK_HELP_MAX_PCM_BYTES) return null;
  if (countAudiblePcm16Windows(pcm) < MIN_AUDIBLE_WINDOWS) return null;

  const samples = new Int16Array(pcm.length / 2);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = pcm.readInt16LE(index * 2);
  }
  const requestId = createHash("sha256").update(params.userId).update(":").update(params.clientRequestId).digest("hex");
  const transcript = await transcribeSupportSpeech({ pcm: samples, language, requestId, signal: params.signal });
  if (!transcript || transcript.length > 500 || !/\p{L}/u.test(transcript)) return null;

  params.signal.throwIfAborted();
  const translated = await translateText({ text: transcript, from: language, to: "en" });
  if (!translated.trim()) return null;

  let english = translated;
  try {
    const response = await getGemini().models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [
        "Rewrite the translation as one natural English sentence the learner can say aloud.",
        "Keep the meaning, names and numbers exactly the same. Do not answer the sentence or add any details.",
        "Return only the rewritten sentence.",
        JSON.stringify(translated),
      ].join("\n"),
      config: { maxOutputTokens: 200, temperature: 0.2, abortSignal: params.signal },
    });
    english = oneSpokenSentence(response.text ?? "") || translated;
  } catch {
    // The learner can still use the Addis translation if polishing fails.
    params.signal.throwIfAborted();
    console.info("speak help fallback", { reason: "english_polish" });
  }

  return { english };
}
