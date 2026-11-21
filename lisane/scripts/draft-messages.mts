// Drafts missing UI strings for every enabled interface language with Addis AI
// translate, and lists each draft in messages/REVIEW.md for native-speaker review.
// Existing translations are never overwritten, so reviewed text stays reviewed.
//
//   pnpm messages:draft                     translate missing keys
//   pnpm messages:draft --redraft-pending   also re-translate keys still waiting for review
//   pnpm messages:draft --dry-run           only report what would be translated

import { readFile, writeFile } from "node:fs/promises";
import { AddisAI } from "addisai";
import { defaultLocale, languages } from "../src/config/languages.ts";

type Messages = { [key: string]: string | Messages };
type Draft = { key: string; source: string; draft: string; note: string };

const messagesDir = new URL("../messages/", import.meta.url);
const reviewFile = new URL("REVIEW.md", messagesDir);
const maxTranslateChars = 5000;
const concurrency = 4;
const dryRun = process.argv.includes("--dry-run");
const redraftPending = process.argv.includes("--redraft-pending");

function flatten(messages: Messages, prefix = ""): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      entries.set(path, value);
    } else {
      for (const [childPath, childValue] of flatten(value, path)) {
        entries.set(childPath, childValue);
      }
    }
  }
  return entries;
}

function unflattenInSourceOrder(source: Messages, values: Map<string, string>, prefix = ""): Messages {
  const result: Messages = {};
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      const translated = values.get(path);
      if (translated !== undefined) result[key] = translated;
    } else {
      const child = unflattenInSourceOrder(value, values, path);
      if (Object.keys(child).length > 0) result[key] = child;
    }
  }
  return result;
}

async function readJson(url: URL): Promise<Messages> {
  try {
    return JSON.parse(await readFile(url, "utf8")) as Messages;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

// ICU arguments like {level} and rich-text tags like <br></br> must survive translation.
function tokensOf(text: string): string {
  return [...text.matchAll(/\{[^{}]+\}|<\/?[a-zA-Z]+>/g)]
    .map((match) => match[0])
    .sort()
    .join(" ");
}

async function readPendingReview(): Promise<Map<string, Map<string, string>>> {
  const pending = new Map<string, Map<string, string>>();
  let text: string;
  try {
    text = await readFile(reviewFile, "utf8");
  } catch {
    return pending;
  }
  let code: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^## .*\((\w+)\)$/);
    if (heading) {
      code = heading[1];
      pending.set(code, new Map());
      continue;
    }
    const row = line.match(/^\| `([^`]+)` \|.*\| ([^|]*) \|$/);
    if (code && row) pending.get(code)!.set(row[1], row[2].trim());
  }
  return pending;
}

function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, " ");
}

async function mapWithConcurrency<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function main() {
  const sourceMessages = await readJson(new URL(`${defaultLocale}.json`, messagesDir));
  const source = flatten(sourceMessages);
  const targets = languages.filter(
    (language) => language.uiEnabled && language.code !== defaultLocale && language.addis.translate,
  );

  if (!dryRun && !process.env.ADDIS_API_KEY) {
    console.error("ADDIS_API_KEY is not set. Add it to .env.local, or run with --dry-run.");
    process.exit(1);
  }
  const addis = dryRun ? undefined : new AddisAI();
  const pendingReview = await readPendingReview();
  const sections: string[] = [];

  for (const language of targets) {
    const file = new URL(`${language.code}.json`, messagesDir);
    const existing = flatten(await readJson(file));
    const previous = pendingReview.get(language.code) ?? new Map<string, string>();
    const missing = [...source.keys()].filter((key) => !existing.has(key));
    const stale = [...existing.keys()].filter((key) => !source.has(key));
    const redraft = redraftPending
      ? [...previous.keys()].filter((key) => existing.has(key) && source.has(key))
      : [];
    const toTranslate = [...missing, ...redraft];
    console.log(
      `${language.code}: ${missing.length} missing, ${redraft.length} to re-draft, ${stale.length} stale`,
    );

    const drafts: Draft[] = [];
    if (addis) {
      drafts.push(
        ...(await mapWithConcurrency(toTranslate, async (key): Promise<Draft> => {
          const text = source.get(key)!;
          if (text.length > maxTranslateChars) {
            throw new Error(`${key} is longer than ${maxTranslateChars} characters; split it.`);
          }
          const result = await addis.translate.create({ text, from: defaultLocale, to: language.code });
          if (tokensOf(result.text) !== tokensOf(text)) {
            return { key, source: text, draft: text, note: `placeholders lost, kept English (draft: ${result.text})` };
          }
          return { key, source: text, draft: result.text, note: `quality: ${result.quality ?? "unknown"}` };
        })),
      );
    }

    const values = new Map(existing);
    for (const key of stale) values.delete(key);
    for (const draft of drafts) values.set(draft.key, draft.draft);
    if (addis) {
      const output = unflattenInSourceOrder(sourceMessages, values);
      await writeFile(file, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    }

    const rows = new Map<string, string>();
    for (const [key, note] of previous) {
      if (values.has(key)) rows.set(key, note);
    }
    for (const draft of drafts) rows.set(draft.key, draft.note);

    const lines = [
      `## ${language.englishName} (${language.code})`,
      "",
      rows.size === 0 ? "Nothing waiting for review." : "| Key | English | Draft | Note |",
    ];
    if (rows.size > 0) lines.push("|---|---|---|---|");
    for (const [key, note] of rows) {
      lines.push(`| \`${key}\` | ${cell(source.get(key)!)} | ${cell(values.get(key) ?? "")} | ${cell(note)} |`);
    }
    sections.push(lines.join("\n"));
  }

  if (!addis) return;

  const header = [
    "# Translations waiting for review",
    "",
    "Every string below was machine-drafted and has not been checked by a native speaker yet.",
    "The Note column says how it was drafted.",
    "",
    "To review a string: correct it in `messages/<code>.json` if needed, then delete its row here.",
    "`pnpm messages:draft` only fills missing keys, and `--redraft-pending` only re-drafts rows",
    "still listed here, so reviewed text is never overwritten.",
  ].join("\n");
  await writeFile(reviewFile, `${header}\n\n${sections.join("\n\n")}\n`, "utf8");
}

await main();
