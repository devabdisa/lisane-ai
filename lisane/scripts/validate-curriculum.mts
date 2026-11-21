import { loadCurriculumUnits } from "./curriculum-files.mts";

try {
  const units = await loadCurriculumUnits();
  console.log(`Validated ${units.length} English curriculum unit(s).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
