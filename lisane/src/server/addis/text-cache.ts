const MAX_ENTRIES = 200;
const entries = new Map<string, string>();

export function recall(key: string): string | undefined {
  const value = entries.get(key);
  if (value === undefined) return undefined;
  entries.delete(key);
  entries.set(key, value);
  return value;
}

export function remember(key: string, value: string) {
  if (entries.has(key)) entries.delete(key);
  entries.set(key, value);
  if (entries.size <= MAX_ENTRIES) return;
  const oldest = entries.keys().next().value;
  if (oldest !== undefined) entries.delete(oldest);
}
