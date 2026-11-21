import assert from "node:assert/strict";
import { test } from "node:test";
import { requestedSpokenSupport } from "./spoken-support.ts";

test("explicit voice requests select the spoken support language", () => {
  assert.equal(requestedSpokenSupport("Hey, can you speak Amharic?"), "am");
  assert.equal(requestedSpokenSupport("Can you say something in Amharic?"), "am");
  assert.equal(requestedSpokenSupport("Can we talk in Afaan Oromo?"), "om");
  assert.equal(requestedSpokenSupport("Can we talk in a fun or a mo?"), "om");
  assert.equal(requestedSpokenSupport("Let’s switch to አማርኛ for a second."), "am");
  assert.equal(requestedSpokenSupport("Can you speak other languages like Amharic?"), "am");
  assert.equal(requestedSpokenSupport("Please talk with me in Afaan Oromoo."), "om");
  assert.equal(requestedSpokenSupport("አማርኛ መናገር ትችያለሽ?"), "am");
  assert.equal(requestedSpokenSupport("Afaan Oromoo dubbachuu dandeessaa?"), "om");
});

test("mentioning a language or asking about a translation does not trigger an opening", () => {
  for (const text of ["I speak Amharic.", "Can you speak Amharic fluently in your dreams?", "How do I say coffee in Oromo?", "Could you say that in Amharic?", "Can you speak about Amharic?", "Yeah, just tell me some on my Kindle. You’ll transfer it to English.", "Can you speak English?", "Can you speak Tigrinya?", "   ", "Can you speak Oromo or Amharic?"]) {
    assert.equal(requestedSpokenSupport(text), null, text);
  }
});
