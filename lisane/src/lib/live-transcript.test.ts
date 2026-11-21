import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isLikelyWrongScriptTranscript,
  isMeaningfulUserTranscript,
  isUsableEnglishTranscript,
  mergeStreamingTranscript,
  normalizeTranscriptText,
} from "./live-transcript.ts";

function mergeAll(pieces: string[]) {
  let text: string | null = null;
  for (const piece of pieces) text = mergeStreamingTranscript(text, piece);
  return normalizeTranscriptText(text ?? "");
}

test("the coach's streamed pieces become one sentence", () => {
  // Pieces as Gemini Live sent them for one reply.
  const pieces = ["Hello, Abeba,", " I'm ready", " to help.", " What kind", " of job", " is the", " interview", " for?"];
  assert.equal(mergeAll(pieces), "Hello, Abeba, I'm ready to help. What kind of job is the interview for?");
});

test("repeated words are kept", () => {
  assert.equal(mergeAll(["I want", " to,", " to go"]), "I want to, to go");
});

test("a piece that continues a word joins without a space", () => {
  assert.equal(mergeAll(["I under", "stand"]), "I understand");
});

test("a fresh copy of the whole turn replaces the pieces", () => {
  assert.equal(mergeAll(["I am", "I am a student"]), "I am a student");
});

test("Amharic written in Arabic script is flagged", () => {
  assert.equal(isLikelyWrongScriptTranscript("سلام عليكم كيف"), true);
  assert.equal(isMeaningfulUserTranscript("سلام عليكم كيف"), false);
  assert.equal(isMeaningfulUserTranscript("እኔ ተማሪ ነኝ"), true);
});

test("only real English is judged as English", () => {
  assert.equal(isUsableEnglishTranscript("I am a student"), true);
  assert.equal(isUsableEnglishTranscript("እኔ ተማሪ ነኝ"), false);
  assert.equal(isUsableEnglishTranscript("ok"), false);
});
