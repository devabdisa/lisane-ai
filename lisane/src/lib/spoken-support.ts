import { supportLanguages, type LanguageCode } from "../config/languages.ts";

export const spokenSupportOpeners = {
  am: {
    text: "አዎ፣ አማርኛ መናገር እችላለሁ።",
    names: ["amharic"],
    requests: ["አማርኛ ትናገሪያለሽ", "አማርኛ መናገር ትችያለሽ", "አማርኛ ትናገራለህ", "አማርኛ መናገር ትችላለህ"],
  },
  om: {
    text: "Eeyyee, Afaan Oromoo dubbachuu nan danda’a.",
    names: ["afaan oromoo", "afaan oromo", "afan oromo", "oromoo", "oromo"],
    requests: ["afaan oromoo dubbachuu dandeessaa", "afaan oromoo ni dubbattaa"],
  },
} satisfies Partial<Record<LanguageCode, { text: string; names: string[]; requests: string[] }>>;

export type SpokenSupportLanguage = keyof typeof spokenSupportOpeners;

function normalizeRequest(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}]+/gu, " ").trim();
}

const switchQuestion = /^(?:(?:hey|hi|okay|so|please) )*(?:(?:can|could|do|will|would) you )?(?:also )?(?:speak|talk|chat)(?: (?:to|with) me)?(?: in)?(?: (?:some|a little|(?:other|another|different) languages? (?:like|such as)))?$/u;
const switchClosing = /^(?:please|too|as well|with me|to me|for a second)$/u;

export function requestedSpokenSupport(text: string): SpokenSupportLanguage | null {
  const request = normalizeRequest(text);
  for (const { code } of supportLanguages) {
    if (!Object.hasOwn(spokenSupportOpeners, code)) continue;
    const language = code as SpokenSupportLanguage;
    const opener = spokenSupportOpeners[language];
    if (opener.requests.includes(request)) return language;

    for (const name of opener.names) {
      const start = request.lastIndexOf(` ${name}`);
      if (start < 0 || !switchQuestion.test(request.slice(0, start))) continue;
      const after = request.slice(start + name.length + 1);
      const closing = after.trim();
      if (!closing || (after.startsWith(" ") && switchClosing.test(closing))) return language;
    }
  }
  return null;
}
