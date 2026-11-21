export type LanguageScript = "latin" | "ethiopic";
export type LanguageFont = "sans" | "ethiopic";

export type LanguageDefinition = {
  code: string;
  englishName: string;
  nativeName: string;
  script: LanguageScript;
  font: LanguageFont;
  dir: "ltr" | "rtl";
  /** Offered as an interface language (needs `messages/<code>.json`). */
  uiEnabled: boolean;
  /** Offered as a support language for explanations, hints and translations. */
  supportEnabled: boolean;
  /** What the Addis AI API can do for this language. */
  addis: {
    translate: boolean;
    chat: boolean;
    stt: boolean;
    tts: boolean;
  };
};

export const languages = [
  {
    code: "en",
    englishName: "English",
    nativeName: "English",
    script: "latin",
    font: "sans",
    dir: "ltr",
    uiEnabled: true,
    supportEnabled: true,
    addis: { translate: true, chat: false, stt: true, tts: false },
  },
  {
    code: "am",
    englishName: "Amharic",
    nativeName: "አማርኛ",
    script: "ethiopic",
    font: "ethiopic",
    dir: "ltr",
    uiEnabled: true,
    supportEnabled: true,
    addis: { translate: true, chat: true, stt: true, tts: true },
  },
  {
    code: "om",
    englishName: "Afaan Oromo",
    nativeName: "Afaan Oromoo",
    script: "latin",
    font: "sans",
    dir: "ltr",
    uiEnabled: true,
    supportEnabled: true,
    addis: { translate: true, chat: true, stt: true, tts: true },
  },
  {
    code: "ti",
    englishName: "Tigrinya",
    nativeName: "ትግርኛ",
    script: "ethiopic",
    font: "ethiopic",
    dir: "ltr",
    uiEnabled: false,
    supportEnabled: false,
    addis: { translate: true, chat: true, stt: true, tts: true },
  },
] as const satisfies readonly LanguageDefinition[];

type Language = (typeof languages)[number];
type UiLanguage = Extract<Language, { uiEnabled: true }>;

export type LanguageCode = Language["code"];
export type UiLocale = UiLanguage["code"];

export const defaultLocale = "en" satisfies UiLocale;

export const uiLocales: UiLocale[] = languages
  .filter((language): language is UiLanguage => language.uiEnabled)
  .map((language) => language.code);

export const supportLanguages: LanguageDefinition[] = languages.filter(
  (language) => language.supportEnabled,
);

export function isLanguageCode(code: string): code is LanguageCode {
  return languages.some((language) => language.code === code);
}

export function getLanguage(code: LanguageCode): LanguageDefinition {
  return languages.find((language) => language.code === code)!;
}

export const fontClassNames: Record<LanguageFont, string> = {
  sans: "font-sans",
  ethiopic: "font-ethiopic",
};
