export const LIVE_MIN_TRANSCRIPT_LENGTH = 2;
export const LIVE_FALLBACK_FINAL_MIN_LENGTH = 6;

export function normalizeTranscriptText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

// Live transcription sends each turn as raw pieces that carry their own
// spacing (" I'm ready", " to help."), so pieces are joined as they come.
// A piece that repeats the whole turn so far is a fresh copy and replaces it.
// Callers keep the raw text and normalize it only for display.
export function mergeStreamingTranscript(previous: string | null, next: string) {
  if (!next.trim()) return previous ?? "";
  if (!previous?.trim()) return next;

  const previousNormalized = normalizeTranscriptText(previous).toLowerCase();
  const nextNormalized = normalizeTranscriptText(next).toLowerCase();
  if (!/^\s/.test(next) && nextNormalized.startsWith(previousNormalized)) {
    return next;
  }

  return previous + next;
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

// Live transcription sometimes writes Amharic speech in Arabic script.
export function isLikelyWrongScriptTranscript(text: string) {
  const normalized = normalizeTranscriptText(text);
  const latinLetters = countMatches(normalized, /[A-Za-z]/g);
  const ethiopicLetters = countMatches(normalized, /[\u1200-\u137F]/g);
  const arabicLetters = countMatches(normalized, /[\u0600-\u06FF]/g);
  const totalLetters = latinLetters + ethiopicLetters + arabicLetters;

  return totalLetters > 0 && arabicLetters >= 6 && ethiopicLetters === 0 && arabicLetters / totalLetters > 0.65;
}

export function isMeaningfulUserTranscript(text: string) {
  const normalized = normalizeTranscriptText(text);
  if (normalized.length < LIVE_MIN_TRANSCRIPT_LENGTH) return false;
  if (isLikelyWrongScriptTranscript(normalized)) return false;

  const latinLetters = countMatches(normalized, /[A-Za-z]/g);
  const ethiopicLetters = countMatches(normalized, /[\u1200-\u137F]/g);
  return latinLetters + ethiopicLetters > 0;
}

export function isStableEnoughForFallbackFinalization(text: string) {
  const normalized = normalizeTranscriptText(text);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  return normalized.length >= LIVE_FALLBACK_FINAL_MIN_LENGTH && wordCount >= 1;
}

// English practice targets English. Ethiopic, Arabic or CJK output means the
// learner spoke another language or transcription misfired.
export function isUsableEnglishTranscript(text: string): boolean {
  const normalized = text.replace(/\s+/g, "");
  if (!normalized) return false;

  const latin = normalized.match(/[A-Za-z]/g)?.length ?? 0;
  const ethiopic = normalized.match(/[\u1200-\u137F]/g)?.length ?? 0;
  const arabic = normalized.match(/[\u0600-\u06FF]/g)?.length ?? 0;
  const cjk = normalized.match(/[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g)?.length ?? 0;
  const letters = latin + ethiopic + arabic + cjk;

  if (letters === 0) return false;
  if (cjk >= 1 && cjk / letters > 0.3) return false;

  const nonLatin = ethiopic + arabic + cjk;
  if (nonLatin / letters > 0.45) return false;

  return latin >= 3 && latin / letters > 0.55;
}
