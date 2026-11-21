import { createHash } from "node:crypto";

export function lessonAudioPath(text: string) {
  const key = createHash("sha256").update(text).digest("hex").slice(0, 20);
  return `/lesson-audio/${key}.mp3`;
}
