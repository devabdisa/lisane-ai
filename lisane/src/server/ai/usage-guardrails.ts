import "server-only";

// Caps for the speaking features. Reader and live-voice limits from Voxa are not carried over.
export const AI_USAGE_LIMITS = {
  maxPracticeMessageChars: 2_000,
  maxRecordedVoiceAudioBytes: 1_500_000,
  maxRecordedVoiceSeconds: 45,
  maxSttTranscriptChars: 1_500,
  maxPracticeReplyChars: 600,
  maxTtsChars: 600,
} as const;

export const AI_RATE_LIMIT_RULES = {
  practiceMessage: { limit: 80, windowMs: 60 * 60 * 1000 },
  recordedVoiceMessage: { limit: 35, windowMs: 60 * 60 * 1000 },
  sttTranscription: { limit: 40, windowMs: 60 * 60 * 1000 },
  practiceReplyTts: { limit: 30, windowMs: 60 * 60 * 1000 },
} as const;

export class UsageLimitError extends Error {
  readonly code = "usage_limit";

  constructor(message: string) {
    super(message);
    this.name = "UsageLimitError";
  }
}

export function assertMaxChars(text: string, maxChars: number, label: string) {
  if (text.length > maxChars) {
    throw new UsageLimitError(`${label} is too long. Keep it under ${maxChars} characters.`);
  }
}

export function assertMaxBytes(bytes: number, maxBytes: number, label: string) {
  if (bytes > maxBytes) {
    throw new UsageLimitError(`${label} is too large.`);
  }
}
