const sentenceEnd = /[.!?።]/;

export function oneSpokenSentence(raw: string): string {
  const cleaned = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const end = cleaned.search(sentenceEnd);
  const sentence = end === -1 ? cleaned : cleaned.slice(0, end + 1);
  return sentence.trim().slice(0, 300);
}
