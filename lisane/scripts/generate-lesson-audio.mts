import { GoogleGenAI } from "@google/genai";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { lessonAudioPath } from "../src/lib/lesson-audio.ts";
import { loadCurriculumUnits } from "./curriculum-files.mts";

const units = await loadCurriculumUnits();
const sentences = new Set<string>();
for (const unit of units) {
  const phrases = new Map(unit.phrases.map((phrase) => [phrase.id, phrase.english.text]));
  for (const level of unit.levels) {
    if (!("lessons" in level)) continue;
    for (const { exercises } of level.lessons) {
      for (const exercise of exercises) {
        if (exercise.kind !== "listen-and-pick" && exercise.kind !== "type-what-you-hear") continue;
        sentences.add(phrases.get(exercise.phraseId)!);
      }
    }
  }
}

const check = process.argv.includes("--check");
const output = resolve("public");
const missing = [];
for (const sentence of sentences) {
  const path = lessonAudioPath(sentence);
  const file = resolve(output, "." + path);
  const exists = await stat(file).then((entry) => entry.isFile() && entry.size > 0).catch(() => false);
  if (!exists) missing.push({ sentence, file, path });
}

if (check && missing.length) {
  throw new Error(`Missing lesson audio: ${missing.map(({ path }) => path).join(", ")}. Run pnpm curriculum:audio.`);
}

if (missing.length) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Set GEMINI_API_KEY before generating lesson audio.");
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1beta", timeout: 35_000 } });
  await mkdir(resolve(output, "lesson-audio"), { recursive: true });
  for (const { sentence, file, path } of missing) {
    const reply = await ai.interactions.create({
      model: "gemini-3.8-flash-tts",
      input: sentence,
      response_format: { type: "audio", mime_type: "audio/mp3" },
      generation_config: { speech_config: { speakers: [{ voice: "Kore", language: "en-US" }] } },
    }).catch((error: unknown) => {
      const status = error && typeof error === "object" && "status" in error ? error.status : "unknown";
      throw new Error(`Gemini TTS failed for ${path} (status ${status}).`);
    });
    const audio = reply.output_audio;
    if (reply.status !== "completed" || !audio?.mime_type?.startsWith("audio/mp3") || !audio.data) {
      throw new Error(`Gemini did not return a complete MP3 for ${path}.`);
    }
    await writeFile(file, Buffer.from(audio.data, "base64"), { flag: "wx" });
    console.log(`Generated ${path}`);
  }
}
console.log(`Lesson audio ready for ${sentences.size} English sentences.`);
