import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { curriculumUnitSchema, type CurriculumUnit } from "../src/schemas/curriculum.ts";

const root = fileURLToPath(new URL("../content/curriculum/english/", import.meta.url));

async function listUnits(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listUnits(file));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(file);
  }
  return files.sort();
}

export async function loadCurriculumUnits(): Promise<CurriculumUnit[]> {
  const files = await listUnits(root);
  const unitIds = new Map<string, string>();
  const positions = new Map<string, string>();
  const units: CurriculumUnit[] = [];
  const errors: string[] = [];

  function checkUnique(seen: Map<string, string>, key: string, label: string, file: string) {
    const first = seen.get(key);
    if (first) errors.push(`${file}: Duplicate ${label} "${key}" (also in ${first})`);
    else seen.set(key, file);
  }

  for (const file of files) {
    const name = relative(root, file).split(sep).join("/");
    let source: unknown;
    try {
      source = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const parsed = curriculumUnitSchema.safeParse(source);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".") || "(unit)";
        errors.push(`${name}: ${path}: ${issue.message}`);
      }
      continue;
    }

    const { section, id, position } = parsed.data;
    const expected = `${section}/${id}.json`;
    if (name !== expected) errors.push(`${name}: Expected file location ${expected}`);
    checkUnique(unitIds, id, "unit ID", name);
    checkUnique(positions, `${section}/${position}`, "unit position", name);
    units.push(parsed.data);
  }

  if (!files.length) errors.push("No curriculum units found");
  if (errors.length) throw new Error(errors.join("\n"));
  return units;
}
