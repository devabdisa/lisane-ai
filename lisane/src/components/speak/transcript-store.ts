import type { LiveCorrection } from "@/schemas/live";

export type TranscriptItem = {
  id: string;
  turnId?: string;
  speaker: "USER" | "AI";
  text: string;
  final: boolean;
  source?: string;
  warning?: string;
  correction?: LiveCorrection;
};

export type StoredReview = { situation: string; items: TranscriptItem[] };

const RESUME_KEY = "lisane:voice-transcript:last";
const REVIEW_KEY = "lisane:speak-review";
const RESUME_LIMIT = 40;

const correctionTypes = new Set(["GRAMMAR", "VOCABULARY", "PHRASING"]);

function readCorrection(value: unknown): LiveCorrection | undefined {
  if (!value || typeof value !== "object") return undefined;
  const correction = value as Partial<LiveCorrection>;
  if (
    typeof correction.id !== "string" ||
    typeof correction.original !== "string" ||
    typeof correction.corrected !== "string" ||
    typeof correction.explanation !== "string" ||
    typeof correction.supportLanguage !== "string" ||
    typeof correction.correctionType !== "string" ||
    !correctionTypes.has(correction.correctionType)
  ) {
    return undefined;
  }
  return {
    id: correction.id,
    original: correction.original,
    corrected: correction.corrected,
    correctionType: correction.correctionType,
    explanation: correction.explanation,
    supportLanguage: correction.supportLanguage,
  };
}

function readItem(value: unknown): TranscriptItem[] {
  if (!value || typeof value !== "object") return [];
  const item = value as Partial<TranscriptItem>;
  if (
    typeof item.id !== "string" ||
    (item.speaker !== "USER" && item.speaker !== "AI") ||
    typeof item.text !== "string" ||
    typeof item.final !== "boolean"
  ) {
    return [];
  }
  return [
    {
      id: item.id,
      turnId: typeof item.turnId === "string" ? item.turnId : undefined,
      speaker: item.speaker,
      text: item.text,
      final: item.final,
      source: typeof item.source === "string" ? item.source : undefined,
      warning: typeof item.warning === "string" ? item.warning : undefined,
      correction: readCorrection(item.correction),
    },
  ];
}

function readItems(raw: string | null): TranscriptItem[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const items = parsed.flatMap(readItem);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

function getItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setItem(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // The phone can refuse storage when it is full. The words stay on screen.
  }
}

export function saveTranscriptForResume(items: TranscriptItem[]) {
  if (typeof window === "undefined" || items.length === 0) return;
  setItem(RESUME_KEY, JSON.stringify(items.slice(-RESUME_LIMIT)));
}

export function loadTranscriptForResume(): TranscriptItem[] | null {
  if (typeof window === "undefined") return null;
  return readItems(getItem(RESUME_KEY));
}

export function clearTranscriptForResume() {
  if (typeof window === "undefined") return;
  setItem(RESUME_KEY, null);
}

let cachedReviewRaw: string | null | undefined;
let cachedReview: StoredReview | null = null;

function readReview(raw: string | null): StoredReview | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const review = parsed as Partial<StoredReview>;
    if (typeof review.situation !== "string" || !Array.isArray(review.items)) return null;
    const items = review.items.flatMap(readItem);
    return items.length > 0 ? { situation: review.situation, items } : null;
  } catch {
    return null;
  }
}

export function loadReview(): StoredReview | null {
  if (typeof window === "undefined") return null;
  const raw = getItem(REVIEW_KEY);
  if (raw === cachedReviewRaw) return cachedReview;
  cachedReviewRaw = raw;
  cachedReview = readReview(raw);
  return cachedReview;
}

export function saveReview(review: StoredReview) {
  if (typeof window === "undefined") return;
  const items = review.items.filter((item) => item.final);
  if (items.length === 0) return;
  cachedReview = { situation: review.situation, items };
  cachedReviewRaw = JSON.stringify(cachedReview);
  setItem(REVIEW_KEY, cachedReviewRaw);
}

export function subscribeReview(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === REVIEW_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function emptyReview(): StoredReview | null {
  return null;
}
