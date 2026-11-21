import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spokenSupportOpeners, type SpokenSupportLanguage } from "@/lib/spoken-support";
import { wavToPcm16 } from "@/lib/wav-pcm";

const englishFollowUp = "What did you want to ask me?";
const clips = new Map<SpokenSupportLanguage | "en", { mimeType: string; data: string } | null>();

function loadClip(language: SpokenSupportLanguage | "en") {
  if (!clips.has(language)) {
    try {
      const wav = readFileSync(join(process.cwd(), "public", "speak", `language-${language}.wav`));
      const pcm = wavToPcm16(wav);
      if (!pcm.length) throw new Error("Empty support clip");
      clips.set(language, {
        mimeType: `audio/pcm;rate=${wav.readUInt32LE(24)}`,
        data: Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength).toString("base64"),
      });
    } catch {
      console.info("Speak support opening unavailable", { language });
      clips.set(language, null);
    }
  }

  return clips.get(language) ?? null;
}

export function supportOpener(language: SpokenSupportLanguage) {
  const native = loadClip(language);
  const english = loadClip("en");
  if (!native || !english) return null;
  return { text: `${spokenSupportOpeners[language].text} ${englishFollowUp}`, audio: [native, english] };
}
