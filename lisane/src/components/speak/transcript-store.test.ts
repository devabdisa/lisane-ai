import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

const store = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  },
});

const { clearTranscriptForResume, loadReview, loadTranscriptForResume, saveReview, saveTranscriptForResume } =
  await import("./transcript-store.ts");

beforeEach(() => store.clear());

test("a dropped conversation can be opened again once", () => {
  saveTranscriptForResume([
    { id: "1", turnId: "t-1", speaker: "USER", text: "I is a student", final: true },
    { id: "2", speaker: "AI", text: "Nice to meet you.", final: true },
  ]);
  assert.equal(loadTranscriptForResume()?.length, 2);
  clearTranscriptForResume();
  assert.equal(loadTranscriptForResume(), null);
});

test("the review keeps finished lines and their notes", () => {
  saveReview({
    situation: "Job interview",
    items: [
      {
        id: "1",
        speaker: "USER",
        text: "I is a student",
        final: true,
        correction: {
          id: "c1",
          original: "I is a student",
          corrected: "I am a student",
          correctionType: "GRAMMAR",
          explanation: "Use am with I.",
          supportLanguage: "en",
        },
      },
      { id: "2", speaker: "AI", text: "Tell me", final: false },
    ],
  });
  const review = loadReview();
  assert.equal(review?.situation, "Job interview");
  assert.equal(review?.items.length, 1);
  assert.equal(review?.items[0]?.correction?.corrected, "I am a student");
  assert.equal(loadReview(), review);
});

test("broken stored data is ignored", () => {
  store.set("lisane:voice-transcript:last", "{not json");
  assert.equal(loadTranscriptForResume(), null);
});
