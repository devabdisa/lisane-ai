import assert from "node:assert/strict";
import { test } from "node:test";
import { oneSpokenSentence } from "./natural-sentence.ts";

test("a quoted reply becomes one spoken sentence", () => {
  assert.equal(oneSpokenSentence('"I am a student." Let me know if you want more.'), "I am a student.");
});

test("blank model text stays blank", () => {
  assert.equal(oneSpokenSentence("   "), "");
});
