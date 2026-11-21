import "server-only";
import { randomUUID } from "node:crypto";
import { DEFAULT_VOICES, type Language } from "addisai";
import { getLanguage, isLanguageCode, usesAddisSpeech } from "@/config/languages";
import { oneSpokenSentence } from "@/lib/natural-sentence";
import { pcm16ToWav, wavToPcm16 } from "@/lib/wav-pcm";
import { getAddis } from "./client";

const speechLanguages = ["am", "om", "ti"] as const;
type SpeechLanguage = (typeof speechLanguages)[number];

export function speechLanguage(code: string): SpeechLanguage | null {
  if (!usesAddisSpeech(code) || !isLanguageCode(code)) return null;
  return speechLanguages.find((language) => language === code) ?? null;
}

export async function transcribeSupportSpeech(params: {
  pcm: Int16Array;
  language: SpeechLanguage;
  requestId: string;
  signal?: AbortSignal;
}): Promise<string> {
  const result = await getAddis().scribe.transcribe(
    {
      audio: { data: pcm16ToWav(params.pcm, 16_000), filename: "phrase.wav", contentType: "audio/wav" },
      language: params.language,
      backend: "turbo",
      requestId: params.requestId,
    },
    { signal: params.signal },
  );
  return result.text.trim();
}

export async function shortSupportLine(text: string, language: SpeechLanguage): Promise<string> {
  const completion = await getAddis().chat.completions.create({
    language,
    max_tokens: 80,
    system:
      "The learner is practising spoken English and just said this in their language. Reply with one short, kind spoken sentence in the same language that helps them. Do not translate the whole idea. Do not use English.",
    messages: [{ role: "user", content: text.slice(0, 500) }],
  });
  return oneSpokenSentence(completion.choices[0]?.message.content ?? "");
}

export async function speakSupportLine(text: string, language: SpeechLanguage): Promise<Int16Array | null> {
  const voiceLanguage = language as Language;
  const clip = await getAddis().voice.generate({
    voiceId: DEFAULT_VOICES[voiceLanguage],
    text,
    language: voiceLanguage,
    outputFormat: "pcm_16000",
    clientRequestId: randomUUID(),
  });
  const bytes = new Uint8Array(await clip.arrayBuffer());
  const pcm = wavToPcm16(bytes);
  return pcm.length > 0 ? pcm : null;
}

export function supportScript(language: SpeechLanguage): "ethiopic" | "latin" {
  return getLanguage(language).script;
}
