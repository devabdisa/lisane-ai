import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { chapaSignatureMatches } from "./chapa-signature.ts";
import { paymentMatches, remainingSpeakingSeconds, splitSpeakingUsage } from "./speaking-allowance.ts";

test("free time is used before paid minutes, and a pass raises the daily cap", () => {
  assert.equal(remainingSpeakingSeconds({ usedToday: 60, credits: 30, raisedCap: false }), 4 * 60 + 30);
  assert.equal(remainingSpeakingSeconds({ usedToday: 5 * 60, credits: 0, raisedCap: false }), 0);
  assert.equal(remainingSpeakingSeconds({ usedToday: 10 * 60, credits: 0, raisedCap: true }), 20 * 60);
  assert.deepEqual(splitSpeakingUsage(90, 60, 20), { fromDaily: 60, fromCredit: 20 });
});

test("a payment is accepted only when Chapa confirms the amount, currency, and mode", () => {
  const expected = { amount: 300, currency: "ETB" };
  assert.equal(paymentMatches(expected, { status: "success", amount: 300, currency: "ETB", mode: "test" }, true), true);
  assert.equal(paymentMatches(expected, { status: "success", amount: 299, currency: "ETB", mode: "test" }, true), false);
  assert.equal(paymentMatches(expected, { status: "pending", amount: 300, currency: "ETB", mode: "test" }, true), false);
  assert.equal(paymentMatches(expected, { status: "success", amount: 300, currency: "ETB", mode: "live" }, true), false);
});

test("the Chapa webhook signature must match the raw body", () => {
  const body = "{\"tx_ref\":\"lisane-1\"}";
  const secret = "test-secret";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(chapaSignatureMatches(body, signature, secret), true);
  assert.equal(chapaSignatureMatches(body, signature, "other"), false);
  assert.equal(chapaSignatureMatches(body, null, secret), false);
});
