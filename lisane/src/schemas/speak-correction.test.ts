import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSpeakJudgment } from "./speak-correction.ts";

test("a fenced judgment still parses", () => {
  const judgment = parseSpeakJudgment(
    ["```json", '{ "hasCorrection": true, "original": "I is fine", "corrected": "I am fine",', '"type": "GRAMMAR", "reason": "Use am with I.", "tip": "Say am after I." }', "```"].join(
      "\n",
    ),
  );
  assert.equal(judgment?.hasCorrection, true);
  assert.equal(judgment?.type, "GRAMMAR");
  assert.equal(judgment?.corrected, "I am fine");
});

test("a clean sentence can carry no correction", () => {
  const judgment = parseSpeakJudgment(
    '{"hasCorrection":false,"original":"Thank you","corrected":"","type":"PHRASING","reason":"","tip":""}',
  );
  assert.equal(judgment?.hasCorrection, false);
});

test("a clean sentence with an empty type still parses", () => {
  const judgment = parseSpeakJudgment(
    '{"hasCorrection":false,"original":"Hello","corrected":"","type":"","reason":"","tip":""}',
  );
  assert.equal(judgment?.hasCorrection, false);
});

test("a judgment with an unknown type is ignored", () => {
  const judgment = parseSpeakJudgment(
    '{"hasCorrection":true,"original":"Hi","corrected":"Hello","type":"PRONUNCIATION","reason":"x","tip":"y"}',
  );
  assert.equal(judgment, null);
});
