import assert from "node:assert/strict";
import { test } from "node:test";
import { pcm16ToWav, wavToPcm16 } from "./wav-pcm.ts";

test("wav audio keeps the same samples", () => {
  const pcm = Int16Array.of(0, 1000, -1000, 32000);
  const restored = wavToPcm16(pcm16ToWav(pcm, 16000));
  assert.deepEqual(Array.from(restored), Array.from(pcm));
});
