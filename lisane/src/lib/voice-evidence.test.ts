import assert from "node:assert/strict";
import test from "node:test";
import { countAudiblePcm16Windows, MIN_AUDIBLE_WINDOWS } from "./voice-evidence.ts";

const sampleRate = 16_000;

function pcm(seconds: number, sample: (index: number) => number) {
  const bytes = Buffer.alloc(seconds * sampleRate * 2);
  for (let index = 0; index < bytes.length / 2; index += 1) {
    bytes.writeInt16LE(sample(index), index * 2);
  }
  return bytes;
}

test("silence and constant microphone offset never qualify as learner input", () => {
  assert.equal(countAudiblePcm16Windows(pcm(2, () => 0)), 0);
  assert.equal(countAudiblePcm16Windows(pcm(2, () => 500)), 0);
});

test("a click cannot qualify even if its upload is padded with silence", () => {
  const click = pcm(2, (index) => index === 100 ? 14_000 : 0);
  assert.ok(countAudiblePcm16Windows(click) < MIN_AUDIBLE_WINDOWS);
});

test("a short voiced signal can qualify without a long silence tail", () => {
  const voice = pcm(0.12, (index) => Math.round(800 * Math.sin(index * 2 * Math.PI * 190 / sampleRate)));
  assert.ok(countAudiblePcm16Windows(voice) >= MIN_AUDIBLE_WINDOWS);
});
