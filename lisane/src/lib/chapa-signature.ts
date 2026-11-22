import { createHmac, timingSafeEqual } from "node:crypto";

export function chapaSignatureMatches(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = Buffer.from(header.trim());
  const expected = Buffer.from(digest);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
