export const ADDIS_TRANSLATE_CHAR_CAP = 5_000;

export function chunkText(text: string, maxChars = ADDIS_TRANSLATE_CHAR_CAP): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const chunks: string[] = [];
  let rest = trimmed;
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    const breakAt = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const cut = breakAt > maxChars * 0.5 ? breakAt : maxChars;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
