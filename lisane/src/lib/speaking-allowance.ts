import { speakingLimits } from "../config/plans.ts";

export function remainingSpeakingSeconds(input: { usedToday: number; credits: number; raisedCap: boolean }) {
  const cap = input.raisedCap ? speakingLimits.plusDailySeconds : speakingLimits.freeDailySeconds;
  return Math.max(0, cap - Math.max(0, input.usedToday)) + Math.max(0, input.credits);
}

export function splitSpeakingUsage(seconds: number, dailyRemaining: number, credits: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const fromDaily = Math.min(safeSeconds, Math.max(0, dailyRemaining));
  const fromCredit = Math.min(Math.max(0, credits), safeSeconds - fromDaily);
  return { fromDaily, fromCredit };
}

export function paymentMatches(
  expected: { amount: number; currency: string },
  actual: { status: string; amount: number; currency: string; mode?: string },
  testKey: boolean,
) {
  if (actual.status.toLowerCase() !== "success") return false;
  if (!Number.isFinite(actual.amount) || Math.round(actual.amount) !== expected.amount) return false;
  if (actual.currency.toUpperCase() !== expected.currency) return false;
  if (!actual.mode) return true;
  const testPayment = actual.mode.toLowerCase() === "test";
  return testKey ? testPayment : !testPayment;
}

export function isTestChapaKey(secret: string) {
  return secret.toUpperCase().includes("TEST");
}
